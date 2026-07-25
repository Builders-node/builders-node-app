import { isValidAdminAccessKey } from './admin-access';

describe('isValidAdminAccessKey', () => {
  it('rejects missing keys', () => {
    expect(isValidAdminAccessKey(undefined, 'secret')).toBe(false);
    expect(isValidAdminAccessKey('secret', undefined)).toBe(false);
  });

  it('accepts only the configured admin key', () => {
    expect(isValidAdminAccessKey('secret', 'secret')).toBe(true);
    expect(isValidAdminAccessKey('wrong', 'secret')).toBe(false);
  });
});
