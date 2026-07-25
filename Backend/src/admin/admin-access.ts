export function isValidAdminAccessKey(providedKey: string | undefined, expectedKey: string | undefined): boolean {
  if (!providedKey || !expectedKey) {
    return false;
  }

  return providedKey === expectedKey;
}
