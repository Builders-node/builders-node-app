import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

/** Codes live in URLs people paste into bios and QR codes — keep them boring. */
const CODE_PATTERN = /^[a-z0-9][a-z0-9-]{1,39}$/;

/** Enough to name a link; not a place to paste an essay. */
const MAX_LABEL = 80;
const MAX_CHANNEL = 40;

/** A visitor key is a random value a browser invents for itself. */
const MAX_VISITOR_KEY = 64;

export type CampaignInput = { code?: string; label?: string; channel?: string; active?: boolean };

/**
 * Trackable links for the channels we post on.
 *
 * The question this answers is "which channel is actually worth the effort",
 * and that needs both halves of the funnel: how many people arrived, and how
 * many of them applied. Reach on its own flatters whichever channel is loudest.
 *
 * Deliberately thin on personal data. A visit stores a random key the browser
 * made up and nothing else — no address, no fingerprint — so this never becomes
 * a second, quieter profile of people who only ever read the landing page.
 */
@Injectable()
export class CampaignsService {
  private readonly logger = new Logger(CampaignsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Every link with its numbers, newest first. */
  async list() {
    const links = await this.prisma.campaignLink.findMany({ orderBy: { createdAt: 'desc' } });
    if (links.length === 0) return [];

    const codes = links.map((link) => link.code);
    const ids = links.map((link) => link.id);

    // Three aggregates rather than a per-link loop: this screen is opened to
    // compare links, so it always loads all of them at once.
    const [visitTotals, visitors, applications] = await Promise.all([
      this.prisma.campaignVisit.groupBy({ by: ['linkId'], where: { linkId: { in: ids } }, _count: { _all: true } }),
      this.prisma.campaignVisit.findMany({
        where: { linkId: { in: ids } },
        select: { linkId: true, visitorKey: true },
        distinct: ['linkId', 'visitorKey'],
      }),
      this.prisma.application.groupBy({ by: ['campaignCode'], where: { campaignCode: { in: codes } }, _count: { _all: true } }),
    ]);

    const viewsByLink = new Map(visitTotals.map((row) => [row.linkId, row._count._all]));
    const peopleByLink = new Map<string, number>();
    for (const row of visitors) peopleByLink.set(row.linkId, (peopleByLink.get(row.linkId) ?? 0) + 1);
    const appsByCode = new Map(applications.map((row) => [row.campaignCode ?? '', row._count._all]));

    return links.map((link) => {
      const views = viewsByLink.get(link.id) ?? 0;
      const people = peopleByLink.get(link.id) ?? 0;
      const applied = appsByCode.get(link.code) ?? 0;
      return {
        id: link.id,
        code: link.code,
        label: link.label,
        channel: link.channel,
        active: link.active,
        createdAt: link.createdAt,
        views,
        people,
        applications: applied,
        // Of the people who arrived, how many applied. Against people rather
        // than views: one person refreshing five times is not four lost leads.
        conversionRate: people > 0 ? Math.round((applied / people) * 1000) / 10 : 0,
      };
    });
  }

  async create(input: CampaignInput, createdById?: string) {
    const label = (input.label ?? '').trim();
    if (!label) throw new BadRequestException('Give the link a name you will recognise later.');
    if (label.length > MAX_LABEL) throw new BadRequestException('That name is too long.');

    const channel = (input.channel ?? '').trim();
    if (!channel) throw new BadRequestException('Say which channel this link is for.');
    if (channel.length > MAX_CHANNEL) throw new BadRequestException('That channel name is too long.');

    // A code the admin typed wins; otherwise one is derived from the name, so
    // the common case is "type a name, get a link".
    const code = normalizeCode(input.code) ?? slugify(label);
    if (!code || !CODE_PATTERN.test(code)) {
      throw new BadRequestException('The code can use lowercase letters, numbers and dashes.');
    }

    const clash = await this.prisma.campaignLink.findUnique({ where: { code }, select: { id: true } });
    if (clash) throw new BadRequestException(`The code "${code}" is already in use.`);

    return this.prisma.campaignLink.create({ data: { code, label, channel, createdById } });
  }

  /**
   * Rename or retire. The code itself is never editable: it is already out
   * there in somebody's post, and changing it would break every link printed
   * so far while silently orphaning the visits it has already collected.
   */
  async update(id: string, input: CampaignInput) {
    const link = await this.prisma.campaignLink.findUnique({ where: { id } });
    if (!link) throw new NotFoundException('Link not found.');

    const data: { label?: string; channel?: string; active?: boolean } = {};
    if (input.label !== undefined) {
      const label = input.label.trim();
      if (!label) throw new BadRequestException('Give the link a name you will recognise later.');
      if (label.length > MAX_LABEL) throw new BadRequestException('That name is too long.');
      data.label = label;
    }
    if (input.channel !== undefined) {
      const channel = input.channel.trim();
      if (!channel) throw new BadRequestException('Say which channel this link is for.');
      if (channel.length > MAX_CHANNEL) throw new BadRequestException('That channel name is too long.');
      data.channel = channel;
    }
    if (input.active !== undefined) data.active = Boolean(input.active);

    return this.prisma.campaignLink.update({ where: { id }, data });
  }

  /**
   * Delete a link and everything it measured.
   *
   * Retiring is the usual move — it keeps the numbers. This exists for links
   * created by mistake, so it says plainly what goes with it.
   */
  async remove(id: string) {
    const link = await this.prisma.campaignLink.findUnique({
      where: { id },
      include: { _count: { select: { visits: true } } },
    });
    if (!link) throw new NotFoundException('Link not found.');

    await this.prisma.campaignLink.delete({ where: { id } });
    return { deleted: true, code: link.code, visitsDiscarded: link._count.visits };
  }

  /**
   * Record an arrival. Public, unauthenticated, and quiet about everything.
   *
   * Never throws at the caller: this runs on a visitor's first paint, and a
   * misspelled code in someone's post must not turn the landing page into an
   * error. An unknown or retired code is simply not counted.
   */
  async recordVisit(code: string | undefined, visitorKey: string | undefined): Promise<{ counted: boolean }> {
    const normalized = normalizeCode(code);
    const key = (visitorKey ?? '').trim().slice(0, MAX_VISITOR_KEY);
    if (!normalized || !key) return { counted: false };

    try {
      const link = await this.prisma.campaignLink.findUnique({
        where: { code: normalized },
        select: { id: true, active: true },
      });
      if (!link?.active) return { counted: false };

      await this.prisma.campaignVisit.create({ data: { linkId: link.id, visitorKey: key } });
      return { counted: true };
    } catch (error) {
      this.logger.warn(`Could not record a campaign visit: ${(error as Error).message}`);
      return { counted: false };
    }
  }
}

/** Lower-case and trim a code from a URL or a form; null if it isn't one. */
export function normalizeCode(raw: string | undefined | null): string | null {
  const code = (raw ?? '').trim().toLowerCase();
  if (!code || code.length > 40) return null;
  return CODE_PATTERN.test(code) ? code : null;
}

/** "Ivan's launch thread!" → "ivans-launch-thread" */
export function slugify(label: string): string {
  return label
    .toLowerCase()
    .normalize('NFD')
    // Strip the combining marks NFD just separated out, so é becomes e.
    .replace(/[\u0300-\u036f]/g, '')
    // Apostrophes vanish rather than becoming separators: "Ivan's" is one word,
    // and "ivan-s-launch" reads like a typo in every post it appears in.
    .replace(/['\u2019]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '');
}
