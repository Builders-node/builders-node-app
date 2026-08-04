import { linksFromUrls } from './profile-fields';

/**
 * The apply form gives us two free-text URL boxes, so these have to be keyed by
 * what the URL actually is rather than which box it came from.
 */
describe('linksFromUrls', () => {
  it('keys each URL by its host, not its position', () => {
    expect(linksFromUrls(['https://github.com/someone', 'https://x.com/someone'])).toEqual({
      github: 'https://github.com/someone',
      twitter: 'https://x.com/someone',
    });
  });

  it('treats twitter.com and x.com as the same link', () => {
    expect(linksFromUrls(['https://twitter.com/a'])).toEqual({ twitter: 'https://twitter.com/a' });
    expect(linksFromUrls(['https://x.com/a'])).toEqual({ twitter: 'https://x.com/a' });
  });

  it('files anything unrecognised under website', () => {
    expect(linksFromUrls(['https://my-startup.dev'])).toEqual({ website: 'https://my-startup.dev' });
  });

  it('keeps the first of two same-kind links rather than overwriting', () => {
    expect(linksFromUrls(['https://linkedin.com/in/first', 'https://linkedin.com/in/second'])).toEqual({
      linkedin: 'https://linkedin.com/in/first',
    });
  });

  it('accepts a bare host and drops values that are not URLs at all', () => {
    expect(linksFromUrls(['github.com/someone', 'just some text', '', '   '])).toEqual({
      github: 'github.com/someone',
    });
  });

  it('returns nothing for a non-array', () => {
    expect(linksFromUrls(undefined)).toEqual({});
    expect(linksFromUrls('https://x.com/a')).toEqual({});
  });
});
