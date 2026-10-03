import { JobsController } from './jobs.controller';

/**
 * Who is allowed to run the daily job.
 *
 * It updates member records and sends email, so an open endpoint would be a
 * way for anyone to spam every overdue member on demand.
 */
function makeController(env: Record<string, string | undefined>) {
  const billing = { runDaily: jest.fn().mockResolvedValue({ markedOverdue: 0, remindersSent: 0, failures: [] }) };
  const config = { get: (key: string) => env[key] };
  const cleanup = { runDaily: jest.fn().mockResolvedValue({ readNotifications: { deleted: 0 } }) };
  return { controller: new JobsController(billing as never, config as never, cleanup as never, {} as never), billing, cleanup };
}

/** Minimal stand-in for the bits of the express request the guard reads. */
function request(headers: Record<string, string>) {
  return { header: (name: string) => headers[name.toLowerCase()] } as never;
}

describe('JobsController authorisation', () => {
  it('runs for the cron secret Vercel sends', async () => {
    const { controller, billing } = makeController({ CRON_SECRET: 's3cret' });
    await controller.runDailyViaCron(request({ authorization: 'Bearer s3cret' }));
    expect(billing.runDaily).toHaveBeenCalled();
  });

  it('runs for an operator holding the admin key', async () => {
    const { controller, billing } = makeController({ ADMIN_ACCESS_KEY: 'admin-key' });
    await controller.runDailyManually(request({ 'x-admin-key': 'admin-key' }));
    expect(billing.runDaily).toHaveBeenCalled();
  });

  it('refuses the wrong secret', () => {
    const { controller, billing } = makeController({ CRON_SECRET: 's3cret' });
    expect(() => controller.runDailyViaCron(request({ authorization: 'Bearer nope' }))).toThrow(/cron secret/);
    expect(billing.runDaily).not.toHaveBeenCalled();
  });

  it('refuses a caller with no credentials at all', () => {
    const { controller, billing } = makeController({ CRON_SECRET: 's3cret', ADMIN_ACCESS_KEY: 'admin-key' });
    expect(() => controller.runDailyViaCron(request({}))).toThrow();
    expect(billing.runDaily).not.toHaveBeenCalled();
  });

  it('stays closed when nothing is configured, rather than falling open', () => {
    // The dangerous default: no secret set, so every request looks authorised.
    const { controller, billing } = makeController({});
    expect(() => controller.runDailyViaCron(request({}))).toThrow();
    expect(billing.runDaily).not.toHaveBeenCalled();
  });

  it('does not accept an empty secret as a match', () => {
    const { controller } = makeController({ CRON_SECRET: '   ' });
    expect(() => controller.runDailyViaCron(request({ authorization: 'Bearer ' }))).toThrow();
  });
});

describe('JobsController — what one run does', () => {
  it('cleans up, bills against the job clock, and reports both', async () => {
    const { controller, billing, cleanup } = makeController({ CRON_SECRET: 's3cret' });
    const before = Date.now();
    const result = await controller.runDailyViaCron(request({ authorization: 'Bearer s3cret' }));

    expect(cleanup.runDaily).toHaveBeenCalled();
    // The billing deadline is measured from when the job started.
    const deadline = billing.runDaily.mock.calls[0][1] as number;
    expect(deadline).toBeGreaterThanOrEqual(before + 20_000);
    expect(deadline).toBeLessThanOrEqual(Date.now() + 20_000);
    expect(result).toMatchObject({ markedOverdue: 0, cleanup: { readNotifications: { deleted: 0 } } });
  });
});
