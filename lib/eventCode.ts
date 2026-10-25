import * as Crypto from "expo-crypto";
/** Displayed before save; PostgreSQL validates format and uniqueness on insert. */
export function generateEventCode(): string {
  return (
    "SI-" + Crypto.randomUUID().replaceAll("-", "").slice(0, 10).toUpperCase()
  );
}
