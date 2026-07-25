export type InvitationEmail = {
  to: string;
  subject: string;
  setupUrl: string;
  temporaryPassword: string;
};

export function buildCredentialInvitation(input: {
  email: string;
  token: string;
  temporaryPassword: string;
  frontendUrl: string;
}): InvitationEmail {
  return {
    to: input.email,
    subject: 'Set up your Builders Node account',
    setupUrl: `${input.frontendUrl.replace(/\/$/, '')}/setup-password?token=${input.token}`,
    temporaryPassword: input.temporaryPassword,
  };
}
