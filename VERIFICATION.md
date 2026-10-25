# ScanIn repair verification

## Passed locally

- App TypeScript: `npm run typecheck` passes. The Deno worker is excluded from the Expo compiler and checked separately.
- Worker TypeScript: Deno check passes at the actual `Supabase/functions/scanin-worker/index.ts` path.
- `npm test`: **69 checks** — 17 domain/request-validation checks, 14 Back destination checks, and 38 PostgreSQL/RLS integration checks.
- Expo web export and Android JavaScript/Hermes bundle export pass. These are compilation/bundling checks, not a signed APK build.
- Browser checks use mocked Supabase responses: Login/Registration and validation; centered profile role; Notifications → Back → Profile; Student Home and History descriptions; manual duplicate result; teacher event form and attendance roster; combined Start/End date-time picker; generated code changes before save; API submission retains the shown code and correct Philippine-time conversion; Admin Profile tab, Admin Tools and Reports Back.
- Failure handling checks verify that an optional notifications fetch failure does not block Home, and push-token cleanup failure does not prevent authentication Sign Out.
- Final source audit confirms no project-owned `.js`, `.jsx`, `.mjs` or `.cjs` files, and no one-line screen re-export routes.
- Both `.env` and `.env.example` match the original uploaded ScanIn.zip byte-for-byte.

## Database coverage

The integration harness runs actual PostgreSQL functions and RLS in PGlite, with simulated Supabase Auth/Storage schemas. It checks audience course/year/block restrictions, duplicates in both QR/manual orders, scoped reads, direct-write denial, profile locking, role protections, teacher restrictions, request decisions, corrections/audit, Close/Reopen, server Late calculation, suspension, automatic absence, cancellation, roster reconciliation, code/event mismatch, reviewed end extensions, and the repeatable focused Event Code update.

The focused update additionally checks that the displayed code is saved unchanged, duplicate/invalid codes are rejected, and saved codes cannot change.

## Remaining real-environment checks

No live Supabase SQL, production data, signed APK or cloud deployment was changed. Apply `Supabase/event_code_form_update.sql` to an already-working ScanIn database before relying on the pre-save displayed code. For a first-time database installation, follow the base schema/full migration instructions instead.

Real Supabase authentication/verification/reset emails, hosted uploads, realtime delivery, concurrent devices, native calendar/time picker behavior, camera/torch, gallery/crop, Android hardware Back, sharing and installed launcher/splash must still be checked on the actual phone/project. Background push requires its existing server worker, schedule, permission and FCM/APNs/Expo configuration. An accepted push ticket is not proof of device delivery.

The uploaded environment files were intentionally preserved. Local build/smoke checks used placeholder credentials and isolated mock responses; the user's live backend was not contacted by these checks.
