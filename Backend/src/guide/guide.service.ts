import { Injectable, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { randomInt } from 'crypto';
import { normalizeCode } from '../campaigns/campaigns.service';
import { resolveFrontendBaseUrl } from '../common/frontend-url';
import { PrismaService } from '../database/prisma.service';
import { MailService } from '../mail/mail.service';
import { GuideRequestDto } from './dto';

const MAX_NAME = 120;

/**
 * The sites that carry a guide, and which landing asked. Checked rather than
 * trusted — it reaches an admin screen and decides which guide a link opens.
 */
const GUIDE_SITES = ['main', 'ca'] as const;
type GuideSite = (typeof GUIDE_SITES)[number];

const isGuideSite = (value: unknown): value is GuideSite => GUIDE_SITES.includes(value as GuideSite);

/**
 * Where each site's guide page lives. Two guides that differ only in section
 * 05: the CA one is "Getting here from Canada", the main one covers the world.
 *
 * They are pages, served as they were authored — see
 * Frontend/scripts/import-guide.mjs. Static hosting can't check a key, so the
 * path itself is the gate: it is not guessable, not linked from anywhere, and
 * this service is the only thing that hands it out. Change it here and in that
 * script together.
 *
 * `index.html` is spelled out rather than left to directory resolution: the
 * SPA catch-all answers a bare directory with the app shell, which served the
 * landing page where the guide should have been.
 */
const GUIDE_PATHS: Record<GuideSite, string> = {
  main: '/g/founders-2026-zcvhs4/index.html',
  ca: '/g/winter-2026-k7m2qx/index.html',
};

/**
 * One code for everybody, for links handed out by hand —
 * `buildersnode.com/guide?key=BN-GUIDE-2026` opens the guide with nothing to
 * type and no email asked for. It sits beside the per-reader keys rather than
 * replacing them: those still say who asked through the form.
 *
 * `GUIDE_SHARED_KEY` replaces it when a link has gone further than it should.
 */
const DEFAULT_SHARED_KEY = 'BN-GUIDE-2026';

/**
 * The guide lead magnet.
 *
 * Deliberately not an Application. Someone who wants to read a PDF has not
 * asked to be reviewed, and putting them in the applicant pipeline would mean
 * an admin working through people who never applied.
 *
 * Every reader who asks through the form gets their own key. That is worth
 * the unique column: a key per person says who is actually reading and can be
 * taken from one of them without breaking it for the rest. The one shared code
 * is for links handed out by hand, where there is no form to ask through.
 * Nothing here needs configuring — keys are minted on request and the guides
 * ship with the app.
 */
@Injectable()
export class GuideService {
  private readonly logger = new Logger(GuideService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  /**
   * Record the reader and email them their key.
   *
   * Upserted by address: asking twice is one person who lost the email, not a
   * second lead — and they get the key they already have rather than a new one,
   * because the first is still sitting in their inbox and would stop working.
   */
  async request(dto: GuideRequestDto) {
    const email = dto.email.trim().toLowerCase();
    const name = dto.name?.trim().slice(0, MAX_NAME) || null;
    const source = isGuideSite(dto.source) ? dto.source : null;
    // Only recorded when it matches a link an admin actually made, the same
    // rule the apply form uses: `?src=` sits in a URL anyone can edit.
    const campaignCode = await this.resolveCampaignCode(dto.campaignCode);

    const lead = await this.prisma.guideRequest.upsert({
      where: { email },
      create: { email, name, source, campaignCode, accessKey: createGuideKey() },
      // A returning reader keeps everything already known about them — their
      // name if they left it last time, and above all their key.
      update: {
        name: name ?? undefined,
        source: source ?? undefined,
        campaignCode: campaignCode ?? undefined,
      },
    });

    // Sending never throws — a provider having a bad minute must not lose a
    // lead already stored. But `sentAt` is a claim that an email exists, so it
    // is only written when one actually went out: with no mail provider
    // configured the lead is kept and the admin list says "Not sent", rather
    // than showing a delivery that never happened.
    const delivered = await this.mail.sendGuideKey(
      lead.email,
      lead.name,
      lead.accessKey,
      // The site they asked on, so the link opens the guide they asked for.
      this.unlockUrl(lead.accessKey, source ?? (isGuideSite(lead.source) ? lead.source : 'main')),
    );
    if (delivered) {
      await this.prisma.guideRequest.update({ where: { id: lead.id }, data: { sentAt: new Date() } });
    }

    return { sent: delivered, email: lead.email };
  }

  /**
   * Check a key and, only if it belongs to somebody, hand back where the guide
   * lives.
   *
   * The address is deliberately not in the page bundle. A gate whose answer
   * ships to every visitor in the JavaScript is theatre — this is the one place
   * the location exists, and it is behind the lookup.
   */
  async unlock(rawKey: string | undefined, rawSite?: string): Promise<{ guideUrl: string }> {
    // Older CA pages don't say which site they are; the CA guide was the only one.
    const site: GuideSite = isGuideSite(rawSite) ? rawSite : 'ca';
    const key = (rawKey ?? '').trim().toUpperCase();
    if (!key) throw new UnauthorizedException('That key is not right.');

    if (key === this.sharedKey()) return { guideUrl: this.guidePageUrl(site) };

    const lead = await this.prisma.guideRequest.findUnique({ where: { accessKey: key } });
    if (!lead) throw new UnauthorizedException('That key is not right.');

    // First open only: this answers "who actually read it", and overwriting it
    // on every visit would turn that into "who read it most recently".
    if (!lead.openedAt) {
      await this.prisma.guideRequest.update({ where: { id: lead.id }, data: { openedAt: new Date() } });
    }

    // A key opens the guide of the site it is used on: someone who asked on
    // the CA landing and later follows a main-site link still gets in.
    return { guideUrl: this.guidePageUrl(site) };
  }

  /**
   * Every lead, newest first, with where they went next: the status of their
   * application if they applied (matched by email). A lead magnet is only
   * worth what it turns into, and this list couldn't say.
   */
  async list() {
    const leads = await this.prisma.guideRequest.findMany({ orderBy: { createdAt: 'desc' } });
    const applications = await this.prisma.application.findMany({
      where: { email: { in: leads.map((lead) => lead.email) } },
      select: { email: true, status: true, createdAt: true },
    });
    const byEmail = new Map(applications.map((app) => [app.email, app]));
    return leads.map((lead) => ({
      ...lead,
      applicationStatus: byEmail.get(lead.email)?.status ?? null,
      appliedAt: byEmail.get(lead.email)?.createdAt ?? null,
    }));
  }

  /**
   * Email a lead their key again — for "Not sent" (the provider was down, or
   * mail wasn't configured yet) or someone who lost it. Same key: the one in
   * any earlier email keeps working.
   */
  async resend(id: string) {
    const lead = await this.prisma.guideRequest.findUnique({ where: { id } });
    if (!lead) throw new NotFoundException('Lead not found.');
    const site = lead.source === 'ca' ? 'ca' : 'main';
    const delivered = await this.mail.sendGuideKey(lead.email, lead.name, lead.accessKey, this.unlockUrl(lead.accessKey, site));
    if (delivered) {
      await this.prisma.guideRequest.update({ where: { id }, data: { sentAt: new Date() } });
    }
    return { sent: delivered };
  }

  /**
   * Remove a reader, which also takes their key with them.
   *
   * The point of a key per person: this stops one of them reading without
   * touching anybody else's access.
   */
  async remove(id: string) {
    const lead = await this.prisma.guideRequest.findUnique({ where: { id } });
    if (!lead) throw new NotFoundException('Lead not found.');
    await this.prisma.guideRequest.delete({ where: { id } });
    return { deleted: true, email: lead.email };
  }

  private guidePageUrl(site: GuideSite): string {
    return `${siteUrl(site)}${GUIDE_PATHS[site]}`;
  }

  private unlockUrl(key: string, site: GuideSite): string {
    return guideUnlockUrl(key, site);
  }

  private sharedKey(): string {
    return (process.env.GUIDE_SHARED_KEY?.trim() || DEFAULT_SHARED_KEY).toUpperCase();
  }

  private async resolveCampaignCode(raw?: string): Promise<string | null> {
    const code = normalizeCode(raw);
    if (!code) return null;
    const link = await this.prisma.campaignLink.findUnique({ where: { code }, select: { code: true } });
    return link?.code ?? null;
  }
}

/**
 * A readable key: no vowels, so it can't spell anything, and no 0/O or 1/I,
 * which is the pair people get wrong reading one off a phone.
 *
 * Eight characters from a 28-letter alphabet is about 37 bits — far past
 * guessing at ten tries a minute, which is what the endpoint allows.
 */
function createGuideKey(): string {
  const alphabet = 'BCDFGHJKLMNPQRSTVWXZ23456789';
  const block = () => Array.from({ length: 4 }, () => alphabet[randomInt(alphabet.length)]).join('');
  return `BN-${block()}-${block()}`;
}

function siteUrl(site: GuideSite): string {
  if (site === 'ca') return (process.env.CA_SITE_URL ?? 'https://ca.buildersnode.com').replace(/\/+$/, '');
  return resolveFrontendBaseUrl(process.env.FRONTEND_URL);
}

/**
 * The gate, with the key already in it — what every email about the guide
 * links to, on the site the reader asked on (main when unknown).
 */
export function guideUnlockUrl(key: string, site?: string | null): string {
  const resolved: GuideSite = isGuideSite(site) ? site : 'main';
  return `${siteUrl(resolved)}/guide?key=${encodeURIComponent(key)}`;
}
