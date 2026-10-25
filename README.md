# ScanIn

School event attendance for students, teachers and administrators. Expo SDK 54 / React Native / Expo Router / Supabase.

Start with **[START_HERE.md](START_HERE.md)**. The finalized role plans are in **[docs/ScanIn_Master_Plan.md](docs/ScanIn_Master_Plan.md)**.

This source replaces the original VeriSync UI and tightens all attendance writes into validated database RPCs. Existing Android application and EAS identities are retained; the displayed brand is ScanIn.

```bash
npm ci
npm run typecheck
npm test
npx expo start
```

The supplied `.env` and `.env.example` are included unchanged. Dependencies and generated build output are excluded. Apply the focused SQL update described in `START_HERE.md` when updating an existing ScanIn database. Do not use a service-role key in Expo.

## Main source

- `app/`: student/teacher tabs, admin area and authentication routes.
- `components/`: reusable buttons, cards, dialogs, date/time controls and event forms. Full screen implementations now live directly in `app/`.
- `lib/AppData.tsx`: RLS-filtered loading, refresh, realtime and server clock.
- `lib/domain.ts`: date, event-state and attendance-rate calculations.
- `Supabase/scanin_migration.sql`: eligibility, rosters, records, requests, notifications, audit, permissions and storage.
- `Supabase/functions/scanin-worker/index.ts`: scheduled housekeeping and mobile push sender.
- `tests/`: deterministic domain and PostgreSQL/RLS integration checks.

The functional event QR is generated from each event's code. The uploaded QR-style brand logo is decorative and is not used as an attendance payload.
