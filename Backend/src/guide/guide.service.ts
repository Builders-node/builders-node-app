import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { GUIDE_KEY, parseGuideUrl } from '../admin/global-settings';
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
    const guideUrl = await this.guideUrl();
    if (!guideUrl) {
      // Storing the address and quietly sending nothing would leave somebody
      // waiting for an email that is never coming. Better to fail loudly here,
      // where an admin can see it, than in their inbox.
      this.logger.error('A guide was requested but no guide URL is configured (admin settings → Guide).');
      throw new BadRequestException('The guide is not available right now. Please try again shortly.');
    }

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
    await this.mail.sendGuide(lead.email, lead.name, guideUrl);
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

  /** Where the guide lives, as an admin set it. */
  async guideUrl(): Promise<string | null> {
    const row = await this.prisma.globalSetting.findUnique({ where: { key: GUIDE_KEY } });
    return parseGuideUrl(row?.value);
  }

  private async resolveCampaignCode(raw?: string): Promise<string | null> {
    const code = normalizeCode(raw);
    if (!code) return null;
    const link = await this.prisma.campaignLink.findUnique({ where: { code }, select: { code: true } });
    return link?.code ?? null;
  }
}
