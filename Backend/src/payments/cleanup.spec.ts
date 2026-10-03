import { CleanupService } from './cleanup.service';

/**
 * Daily housekeeping. Pinned: each step is independent, and the windows are
 * the ones documented — nothing unread, nothing recent.
 */
function makeService() {
  const deleteMany = (count: number) => jest.fn().mockResolvedValue({ count });
  const prisma = {
    applicationVerification: { deleteMany: deleteMany(2) },
    passwordResetToken: { deleteMany: deleteMany(3) },
    emailVerificationToken: { deleteMany: deleteMany(4) },
    notification: { deleteMany: deleteMany(5) },
  };
  const service = new CleanupService(prisma as never);
  jest.spyOn((service as unknown as { logger: { error: () => void; log: () => void } }).logger, 'error').mockImplementation(() => undefined);
  jest.spyOn((service as unknown as { logger: { error: () => void; log: () => void } }).logger, 'log').mockImplementation(() => undefined);
  return { service, prisma };
}

const NOW = new Date('2026-10-02T13:00:00.000Z');
const daysBefore = (days: number) => new Date(NOW.getTime() - days * 24 * 3600 * 1000);

describe('CleanupService.runDaily', () => {
  it('reports how many rows each step removed', async () => {
    const { service } = makeService();
    await expect(service.runDaily(NOW)).resolves.toEqual({
      applicationVerifications: { deleted: 2 },
      passwordResetTokens: { deleted: 3 },
      emailVerificationTokens: { deleted: 4 },
      readNotifications: { deleted: 5 },
    });
  });

  it('uses the documented windows, and never touches unread notifications', async () => {
    const { service, prisma } = makeService();
    await service.runDaily(NOW);
    expect(prisma.applicationVerification.deleteMany).toHaveBeenCalledWith({ where: { createdAt: { lt: daysBefore(30) } } });
    expect(prisma.passwordResetToken.deleteMany).toHaveBeenCalledWith({ where: { expiresAt: { lt: daysBefore(7) } } });
    expect(prisma.emailVerificationToken.deleteMany).toHaveBeenCalledWith({ where: { expiresAt: { lt: daysBefore(7) } } });
    expect(prisma.notification.deleteMany).toHaveBeenCalledWith({
      where: { readAt: { not: null }, createdAt: { lt: daysBefore(180) } },
    });
  });

  it('keeps going when one step fails, and says which', async () => {
    const { service, prisma } = makeService();
    prisma.passwordResetToken.deleteMany.mockRejectedValueOnce(new Error('lock timeout'));
    const result = await service.runDaily(NOW);
    expect(result.passwordResetTokens).toEqual({ error: 'lock timeout' });
    expect(result.emailVerificationTokens).toEqual({ deleted: 4 });
    expect(result.readNotifications).toEqual({ deleted: 5 });
  });
});
