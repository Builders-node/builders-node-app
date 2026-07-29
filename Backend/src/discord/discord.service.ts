import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../database/prisma.service';

const DISCORD_API = 'https://discord.com/api/v10';
// identify → read their Discord id/username; guilds.join → let the bot add them to
// the server (and set roles) in one step.
const SCOPES = 'identify guilds.join';

type DiscordUser = { id: string; username: string; global_name?: string | null };

/**
 * Links a Builders Node account to a Discord account and grants the right server
 * role via the bot. Entirely env-gated: with Discord unconfigured, isEnabled()
 * is false and the endpoints report "not configured" instead of failing.
 */
@Injectable()
export class DiscordService {
  private readonly logger = new Logger(DiscordService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  private cfg(key: string): string | undefined {
    const value = this.config.get<string>(key);
    return value && value.trim() !== '' ? value : undefined;
  }

  /** All the pieces required for the OAuth + role-grant flow to work. */
  isEnabled(): boolean {
    return Boolean(
      this.cfg('DISCORD_CLIENT_ID') &&
        this.cfg('DISCORD_CLIENT_SECRET') &&
        this.cfg('DISCORD_BOT_TOKEN') &&
        this.cfg('DISCORD_GUILD_ID') &&
        this.cfg('DISCORD_REDIRECT_URI'),
    );
  }

  /** Which Discord env vars the runtime can see (booleans only — never values). */
  configStatus() {
    return {
      enabled: this.isEnabled(),
      present: {
        DISCORD_CLIENT_ID: Boolean(this.cfg('DISCORD_CLIENT_ID')),
        DISCORD_CLIENT_SECRET: Boolean(this.cfg('DISCORD_CLIENT_SECRET')),
        DISCORD_BOT_TOKEN: Boolean(this.cfg('DISCORD_BOT_TOKEN')),
        DISCORD_GUILD_ID: Boolean(this.cfg('DISCORD_GUILD_ID')),
        DISCORD_REDIRECT_URI: Boolean(this.cfg('DISCORD_REDIRECT_URI')),
        DISCORD_ROLE_MEMBER: Boolean(this.cfg('DISCORD_ROLE_MEMBER')),
        DISCORD_ROLE_APPLICANT: Boolean(this.cfg('DISCORD_ROLE_APPLICANT')),
      },
    };
  }

  private requireEnabled() {
    if (!this.isEnabled()) {
      throw new BadRequestException('Discord integration is not configured on the server.');
    }
  }

  /** Builds the Discord OAuth URL, embedding a short-lived signed state that ties the flow to this user. */
  getAuthorizeUrl(userId: string): string {
    this.requireEnabled();
    const state = this.jwt.sign({ sub: userId, purpose: 'discord' }, { expiresIn: '10m' });
    const params = new URLSearchParams({
      client_id: this.cfg('DISCORD_CLIENT_ID')!,
      redirect_uri: this.cfg('DISCORD_REDIRECT_URI')!,
      response_type: 'code',
      scope: SCOPES,
      state,
      prompt: 'consent',
    });
    return `${DISCORD_API.replace('/api/v10', '')}/oauth2/authorize?${params.toString()}`;
  }

  /** Handles the OAuth callback: exchange code, link account, assign role. Returns the linked userId. */
  async handleCallback(code: string, state: string): Promise<{ userId: string; username: string }> {
    this.requireEnabled();

    let userId: string;
    try {
      const payload = this.jwt.verify<{ sub: string; purpose?: string }>(state);
      if (payload.purpose !== 'discord') throw new Error('bad purpose');
      userId = payload.sub;
    } catch {
      throw new UnauthorizedException('Discord link request is invalid or expired.');
    }

    const accessToken = await this.exchangeCode(code);
    const discordUser = await this.fetchDiscordUser(accessToken);

    // Guard against one Discord account being linked to two members.
    const clash = await this.prisma.user.findUnique({ where: { discordId: discordUser.id }, select: { id: true } });
    if (clash && clash.id !== userId) {
      throw new BadRequestException('This Discord account is already linked to another member.');
    }

    const displayName = discordUser.global_name || discordUser.username;
    await this.prisma.user.update({
      where: { id: userId },
      data: { discordId: discordUser.id, discordUsername: displayName },
    });

    await this.grantRoles(userId, discordUser.id, accessToken);
    return { userId, username: displayName };
  }

  /** Removes the link and best-effort strips the assigned roles. */
  async unlink(userId: string): Promise<{ unlinked: true }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { discordId: true } });
    if (user?.discordId && this.isEnabled()) {
      for (const roleId of await this.targetRoleIds(userId)) {
        await this.removeRole(user.discordId, roleId);
      }
    }
    await this.prisma.user.update({ where: { id: userId }, data: { discordId: null, discordUsername: null } });
    return { unlinked: true };
  }

  // ── Discord API helpers ────────────────────────────────────────────────────

  private async exchangeCode(code: string): Promise<string> {
    const body = new URLSearchParams({
      client_id: this.cfg('DISCORD_CLIENT_ID')!,
      client_secret: this.cfg('DISCORD_CLIENT_SECRET')!,
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.cfg('DISCORD_REDIRECT_URI')!,
    });
    const res = await fetch(`${DISCORD_API}/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (!res.ok) {
      this.logger.error(`Discord token exchange failed: ${res.status} ${await res.text().catch(() => '')}`);
      throw new BadRequestException('Could not complete Discord sign-in. Please try again.');
    }
    const json = (await res.json()) as { access_token: string };
    return json.access_token;
  }

  private async fetchDiscordUser(accessToken: string): Promise<DiscordUser> {
    const res = await fetch(`${DISCORD_API}/users/@me`, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!res.ok) {
      throw new BadRequestException('Could not read your Discord profile.');
    }
    return (await res.json()) as DiscordUser;
  }

  /** Role ids to grant, chosen by membership status. */
  private async targetRoleIds(userId: string): Promise<string[]> {
    const membership = await this.prisma.membership.findUnique({ where: { userId }, select: { status: true } });
    const isActive = membership?.status === 'ACTIVE_MEMBER' || membership?.status === 'APPROVED';
    const memberRole = this.cfg('DISCORD_ROLE_MEMBER');
    const applicantRole = this.cfg('DISCORD_ROLE_APPLICANT');
    // Active members get the member role; everyone else the applicant role
    // (falling back to the member role if no applicant role is configured).
    const chosen = isActive ? memberRole : applicantRole ?? memberRole;
    return [chosen].filter((value): value is string => Boolean(value));
  }

  /** Adds the member to the guild (if needed) and ensures the target roles are set. */
  private async grantRoles(userId: string, discordId: string, accessToken: string): Promise<void> {
    const guild = this.cfg('DISCORD_GUILD_ID')!;
    const bot = this.cfg('DISCORD_BOT_TOKEN')!;
    const roles = await this.targetRoleIds(userId);

    // Join the guild with roles (no-op / 204 if already a member).
    const joinRes = await fetch(`${DISCORD_API}/guilds/${guild}/members/${discordId}`, {
      method: 'PUT',
      headers: { Authorization: `Bot ${bot}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ access_token: accessToken, roles }),
    });
    if (!joinRes.ok && joinRes.status !== 204) {
      this.logger.warn(`Discord guild join returned ${joinRes.status}: ${await joinRes.text().catch(() => '')}`);
    }

    // Ensure each role is set even if they were already a member (join won't update roles then).
    for (const roleId of roles) {
      const res = await fetch(`${DISCORD_API}/guilds/${guild}/members/${discordId}/roles/${roleId}`, {
        method: 'PUT',
        headers: { Authorization: `Bot ${bot}` },
      });
      if (!res.ok && res.status !== 204) {
        this.logger.warn(`Discord add-role ${roleId} returned ${res.status}: ${await res.text().catch(() => '')}`);
      }
    }
  }

  private async removeRole(discordId: string, roleId: string): Promise<void> {
    const guild = this.cfg('DISCORD_GUILD_ID')!;
    const bot = this.cfg('DISCORD_BOT_TOKEN')!;
    await fetch(`${DISCORD_API}/guilds/${guild}/members/${discordId}/roles/${roleId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bot ${bot}` },
    }).catch(() => undefined);
  }
}
