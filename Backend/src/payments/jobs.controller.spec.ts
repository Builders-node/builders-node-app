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
  return { controller: new JobsController(billing as never, config as never), billing };
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
