import type { AccountIdentity } from "./types";

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function emailsMatch(
  identity: Pick<AccountIdentity, "email" | "canonicalEmail">,
  email: string,
): boolean {
  const normalized = normalizeEmail(email);
  return [identity.email, identity.canonicalEmail].some(
    (value) => !!value && normalizeEmail(value) === normalized,
  );
}
