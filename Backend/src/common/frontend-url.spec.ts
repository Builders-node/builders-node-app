import { resolveFrontendBaseUrl } from './frontend-url';

describe('resolveFrontendBaseUrl', () => {
  it('returns a single origin, never the raw comma-separated allowlist', () => {
    // Regression: the member pass QR encoded the whole FRONTEND_URL string,
    // producing "https://buildersnode.com,https://…vercel.app/pass/<token>".
    const raw = 'https://buildersnode.com,https://builders-node-app.vercel.app';
    expect(resolveFrontendBaseUrl(raw)).toBe('https://buildersnode.com');
  });

  it('prefers the custom domain regardless of order', () => {
    const raw = 'https://builders-node-app.vercel.app,https://buildersnode.com';
    expect(resolveFrontendBaseUrl(raw)).toBe('https://buildersnode.com');
  });

  it('falls back to the vercel origin when no custom domain is configured', () => {
    expect(resolveFrontendBaseUrl('https://builders-node-app.vercel.app')).toBe(
      'https://builders-node-app.vercel.app',
    );
  });

  it('trims whitespace and strips trailing slashes', () => {
    expect(resolveFrontendBaseUrl(' https://buildersnode.com/ , https://x.vercel.app ')).toBe(
      'https://buildersnode.com',
    );
  });

  it('uses the fallback when unset or empty', () => {
    expect(resolveFrontendBaseUrl(undefined, 'https://buildersnode.com')).toBe('https://buildersnode.com');
    expect(resolveFrontendBaseUrl('', 'https://buildersnode.com')).toBe('https://buildersnode.com');
    expect(resolveFrontendBaseUrl('  ,  ', 'https://buildersnode.com')).toBe('https://buildersnode.com');
  });
});
