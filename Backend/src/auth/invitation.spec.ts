import { buildCredentialInvitation } from './invitation';

describe('buildCredentialInvitation', () => {
  it('creates a setup password link from the invite token', () => {
    expect(
      buildCredentialInvitation({
        email: 'maya@example.com',
        token: 'invite-token',
        temporaryPassword: 'Temp123456',
        frontendUrl: 'https://terminus.town/',
      }),
    ).toEqual({
      to: 'maya@example.com',
      subject: 'Set up your Builders Node account',
      setupUrl: 'https://terminus.town/setup-password?token=invite-token',
      temporaryPassword: 'Temp123456',
    });
  });
});
