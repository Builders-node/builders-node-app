import { BadRequestException, Injectable, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { randomInt, timingSafeEqual } from 'crypto';
import { GUIDE_ACCESS_KEY, GUIDE_KEY, parseGuideAccessKey, parseGuideUrl } from '../admin/global-settings';
import { normalizeCode } from '../campaigns/campaigns.service';
import { PrismaService } from '../database/prisma.service';
import { MailService } from '../mail/mail.service';
import { GuideRequestDto } from './dto';

const MAX_NAME = 120;

/** Which landings may ask. Checked rather than trusted — it reaches an admin screen. */
const GUIDE_SOURCES = ['ca'] as const;

/**
 * The guide lead magnet.
 *
 * Deliberately not an Application. Someone who wants to read a PDF has not
 * asked to be reviewed, and putting them in the applicant pipeline would mean
 * an admin working through people who never applied.
 */
@Injectable()
export class GuideService {
  private readonly logger = new Logger(GuideService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  /**
   * Record the lead and send the guide.
   *
   * Upserted by address: asking twice is one person who lost the email, not a
   * second lead. `createdAt` therefore keeps saying when they first asked,
   * which is the number worth reporting.
   */
  async request(dto: GuideRequestDto) {
    // The link is the one thing an admin genuinely has to supply: there is no
    // sensible default for where the guide lives. Storing an address and
    // quietly sending nothing would leave somebody waiting for an email that is
    // never coming, so this fails rather than pretending.
    if (!(await this.guideUrl())) {
      this.logger.error('A guide was requested but no guide link is configured (admin settings → Guide leads).');
      throw new BadRequestException("The guide isn't available right now — sorry. Try again a little later.");
    }

    // The key, on the other hand, has a perfectly good default: a random one.
    // Making an admin invent a second value before anything worked was a step
    // that existed only because the code asked for it.
    const accessKey = await this.ensureAccessKey();

    const email = dto.email.trim().toLowerCase();
    const name = dto.name?.trim().slice(0, MAX_NAME) || null;
    const source = GUIDE_SOURCES.includes((dto.source ?? '') as (typeof GUIDE_SOURCES)[number]) ? dto.source! : null;
    // Only recorded when it matches a link an admin actually made, the same
    // rule the apply form uses: `?src=` sits in a URL anyone can edit.
    const campaignCode = await this.resolveCampaignCode(dto.campaignCode);

    const lead = await this.prisma.guideRequest.upsert({
      where: { email },
      create: { email, name, source, campaignCode },
      // A returning request keeps whatever we already knew: a second visit with
      // the name field left blank should not erase the name from the first.
      update: {
        name: name ?? undefined,
        source: source ?? undefined,
        campaignCode: campaignCode ?? undefined,
      },
    });

    // MailService.send never throws — a provider having a bad minute must not
    // lose a lead we have already stored. `sentAt` is what tells the two apart.
    await this.mail.sendGuideKey(lead.email, lead.name, accessKey, this.guidePageUrl(accessKey));
    await this.prisma.guideRequest.update({ where: { id: lead.id }, data: { sentAt: new Date() } });

    return { sent: true, email: lead.email };
  }

  /** Every lead, newest first. */
  list() {
    return this.prisma.guideRequest.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async remove(id: string) {
    const lead = await this.prisma.guideRequest.findUnique({ where: { id } });
    if (!lead) throw new NotFoundException('Lead not found.');
    await this.prisma.guideRequest.delete({ where: { id } });
    return { deleted: true, email: lead.email };
  }

  /**
   * Check a key and, only if it holds, hand back where the guide lives.
   *
   * The URL is deliberately not in the page bundle. A gate whose answer ships
   * to every visitor in the JavaScript is theatre — this is the one place the
   * link exists, and it is behind the check.
   */
  async unlock(rawKey: string | undefined): Promise<{ guideUrl: string }> {
    const expected = await this.accessKey();
    const given = (rawKey ?? '').trim();
    if (!expected || !given || !sameKey(given, expected)) {
      throw new UnauthorizedException('That key is not right.');
    }

    const guideUrl = await this.guideUrl();
    if (!guideUrl) {
      this.logger.error('The guide was unlocked but no guide link is configured (admin settings → Guide leads).');
      throw new BadRequestException("Your key is right, but the guide isn't available right now — sorry. Try again a little later.");
    }
    return { guideUrl };
  }

  /** Where the guide lives, as an admin set it. */
  async guideUrl(): Promise<string | null> {
    const row = await this.prisma.globalSetting.findUnique({ where: { key: GUIDE_KEY } });
    return parseGuideUrl(row?.value);
  }

  /** The one key that unlocks the guide page. */
  async accessKey(): Promise<string | null> {
    const row = await this.prisma.globalSetting.findUnique({ where: { key: GUIDE_ACCESS_KEY } });
    return parseGuideAccessKey(row?.value);
  }

  /**
   * The key, minting one the first time somebody needs it.
   *
   * `create`-and-catch rather than read-then-write: two requests arriving
   * together would otherwise mint two keys and the second would overwrite the
   * first, invalidating a key that had already gone out in an email.
   */
  private async ensureAccessKey(): Promise<string> {
    const existing = await this.accessKey();
    if (existing) return existing;

    try {
      const created = await this.prisma.globalSetting.create({
        data: { key: GUIDE_ACCESS_KEY, value: createGuideKey() },
      });
      this.logger.log('No guide key was set, so one was generated. It is visible in admin settings → Guide leads.');
      return created.value;
    } catch {
      // Lost the race — whoever won wrote a perfectly good key.
      const settled = await this.accessKey();
      if (settled) return settled;
      throw new BadRequestException("The guide isn't available right now — sorry. Try again a little later.");
    }
  }

  /** The guide page, with the key already in it — what the email links to. */
  private guidePageUrl(key: string): string {
    const base = (process.env.CA_SITE_URL ?? 'https://ca.buildersnode.com').replace(/\/+$/, '');
    return `${base}/guide?key=${encodeURIComponent(key)}`;
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
 * which is the pair people get wrong reading one off a phone. Matches the
 * Generate button in admin settings.
 */
function createGuideKey(): string {
  const alphabet = 'BCDFGHJKLMNPQRSTVWXZ23456789';
  const block = () => Array.from({ length: 4 }, () => alphabet[randomInt(alphabet.length)]).join('');
  return `BN-${block()}-${block()}`;
}

/**
 * Constant-time comparison.
 *
 * This key is a marketing gate rather than a credential, so a timing attack on
 * it is not a realistic worry — but the correct comparison costs three lines
 * and removes the question entirely.
 */
function sameKey(given: string, expected: string): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  // timingSafeEqual throws on a length mismatch, which would itself leak the
  // length — so the lengths are checked first and the compare always runs.
  return a.length === b.length && timingSafeEqual(a, b);
}
