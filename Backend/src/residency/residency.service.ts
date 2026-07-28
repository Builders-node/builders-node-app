import { BadRequestException, Injectable, NotFoundException, PayloadTooLargeException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

// Manual E-Residency: the member applies on prospera.co, then uploads a proof
// file here. An admin verifies it. No external API integration.
export const PROSPERA_APPLY_URL = 'https://prospera.co/e-residency';

// Base64 payload cap (~3.5 MB base64 ≈ ~2.5 MB file) to stay under the
// serverless request body limit (Vercel Hobby is 4.5 MB).
const MAX_PROOF_BASE64_LENGTH = 3_500_000;

export type SubmitProofInput = {
  fileName: string;
  fileType: string;
  dataBase64: string;
};

@Injectable()
export class ResidencyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async getResidency(userId: string) {
    const application = await this.prisma.residencyApplication.findUnique({ where: { userId } });
    return {
      status: application?.status ?? 'NOT_STARTED',
      applyUrl: PROSPERA_APPLY_URL,
      hasProof: Boolean(application?.proofData),
      proofFileName: application?.proofFileName ?? null,
      submittedAt: application?.submittedAt ?? null,
      reviewedAt: application?.reviewedAt ?? null,
      reviewNote: application?.reviewNote ?? null,
    };
  }

  async submitProof(userId: string, input: SubmitProofInput) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found.');
    }
    const data = (input.dataBase64 ?? '').split(',').pop() ?? '';
    if (!data) {
      throw new BadRequestException('Proof file is empty.');
    }
    if (data.length > MAX_PROOF_BASE64_LENGTH) {
      throw new PayloadTooLargeException('Proof file is too large (max ~3 MB).');
    }

    await this.prisma.residencyApplication.upsert({
      where: { userId },
      create: {
        userId,
        status: 'PENDING_REVIEW',
        stage: 'Proof submitted — pending review',
        proofFileName: input.fileName,
        proofFileType: input.fileType,
        proofData: data,
        submittedAt: new Date(),
      },
      update: {
        status: 'PENDING_REVIEW',
        stage: 'Proof submitted — pending review',
        proofFileName: input.fileName,
        proofFileType: input.fileType,
        proofData: data,
        submittedAt: new Date(),
        reviewedAt: null,
        reviewNote: null,
      },
    });

    await this.notifications.notifyAdmins({
      type: 'info',
      title: 'E-Residency proof submitted',
      body: `${user.email} uploaded an E-Residency proof for review.`,
      link: '/admin',
    });

    return this.getResidency(userId);
  }

  async getProof(userId: string) {
    const application = await this.prisma.residencyApplication.findUnique({ where: { userId } });
    if (!application?.proofData) {
      throw new NotFoundException('No proof file uploaded.');
    }
    return {
      fileName: application.proofFileName ?? 'proof',
      fileType: application.proofFileType ?? 'application/octet-stream',
      dataBase64: application.proofData,
    };
  }
}
