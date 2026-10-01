import { Injectable, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { randomInt } from 'crypto';
import { normalizeCode } from '../campaigns/campaigns.service';
import { PrismaService } from '../database/prisma.service';
import { MailService } from '../mail/mail.service';
import { GuideRequestDto } from './dto';

const MAX_NAME = 120;

/** Which landings may ask. Checked rather than trusted — it reaches an admin screen. */
const GUIDE_SOURCES = ['ca'] as const;

/**
 * Where the guide page lives on the CA site.
 *
 * It is a page, served as it was authored — see Frontend/scripts/import-guide.mjs.
 * Static hosting can't check a key, so the path itself is the gate: it is not
 * guessable, not linked from anywhere, and this service is the only thing that
 * hands it out. Change it here and in that script together.
 *
 * `index.html` is spelled out rather than left to directory resolution: the
 * SPA catch-all answers a bare directory with the app shell, which served the
 * landing page where the guide should have been.
 */
const GUIDE_PATH = '/g/winter-2026-k7m2qx/index.html';

/**
 * The guide lead magnet.
 *
 * Deliberately not an Application. Someone who wants to read a PDF has not
 * asked to be reviewed, and putting them in the applicant pipeline would mean
 * an admin working through people who never applied.
 *
 * Every reader gets their own key. That is worth the unique column: a shared
 * key tells you nothing once it is out, where a key per person says who is
 * actually reading and can be taken from one of them without breaking it for
 * the rest. Nothing here needs configuring — the key is minted on request and
 * the guide ships with the app.
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
    const source = GUIDE_SOURCES.includes((dto.source ?? '') as (typeof GUIDE_SOURCES)[number]) ? dto.source! : null;
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

    // MailService.send never throws — a provider having a bad minute must not
    // lose a lead we have already stored. `sentAt` is what tells the two apart.
    await this.mail.sendGuideKey(lead.email, lead.name, lead.accessKey, this.unlockUrl(lead.accessKey));
    await this.prisma.guideRequest.update({ where: { id: lead.id }, data: { sentAt: new Date() } });

    return { sent: true, email: lead.email };
  }

  /**
   * Check a key and, only if it belongs to somebody, hand back where the guide
   * lives.
   *
   * The address is deliberately not in the page bundle. A gate whose answer
   * ships to every visitor in the JavaScript is theatre — this is the one place
   * the location exists, and it is behind the lookup.
   */
  async unlock(rawKey: string | undefined): Promise<{ guideUrl: string }> {
    const key = (rawKey ?? '').trim().toUpperCase();
    if (!key) throw new UnauthorizedException('That key is not right.');

    const lead = await this.prisma.guideRequest.findUnique({ where: { accessKey: key } });
    if (!lead) throw new UnauthorizedException('That key is not right.');

    // First open only: this answers "who actually read it", and overwriting it
    // on every visit would turn that into "who read it most recently".
    if (!lead.openedAt) {
      await this.prisma.guideRequest.update({ where: { id: lead.id }, data: { openedAt: new Date() } });
    }

    // The name rides along so the guide can open with it. The page is static,
    // so there is nowhere else it could come from.
    const named = lead.name ? `?name=${encodeURIComponent(lead.name)}` : '';
    return { guideUrl: `${this.guidePageUrl()}${named}` };
  }

  /** Every lead, newest first. */
  list() {
    return this.prisma.guideRequest.findMany({ orderBy: { createdAt: 'desc' } });
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

  /** The guide page itself. Overridable, so it can move without a release. */
  private guidePageUrl(): string {
    return process.env.GUIDE_URL?.trim() || `${this.caSiteUrl()}${GUIDE_PATH}`;
  }

  /** The gate, with the key already in it — what the email links to. */
  private unlockUrl(key: string): string {
    return `${this.caSiteUrl()}/guide?key=${encodeURIComponent(key)}`;
  }

  private caSiteUrl(): string {
    return (process.env.CA_SITE_URL ?? 'https://ca.buildersnode.com').replace(/\/+$/, '');
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
