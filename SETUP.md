# Update note

For this updated package, begin with **START_HERE.md**. A working ScanIn database only needs the focused `Supabase/event_code_form_update.sql` update for the visible pre-generated code. The full migration instructions below apply to initial ScanIn installation.

# ScanIn setup

## 1. Keep a backup

Extract this project into a separate folder first. Back up the current Supabase database. This package has not changed your live database or deployed anything.

## 2. Configure Expo

Run from the folder containing `package.json`:

```bash
npm ci
```

The supplied `.env` and `.env.example` have been preserved exactly. Keep them as provided; do not overwrite either file. Never enter a service-role key into an `EXPO_PUBLIC_` variable.

`app.json` retains your original slug, Android package and EAS project ID. This avoids accidentally treating it as an unrelated application. The installed display name is ScanIn.

## 3. Apply database changes

**Existing VeriSync database:** run the whole `Supabase/scanin_migration.sql` in Supabase SQL Editor as the database owner. Do not rerun the old base schema afterward: it reinstalls old policies.

**New database:** run `Supabase/schema.sql` first, then `Supabase/scanin_migration.sql`.

The migration is additive and repeatable. It replaces policies and write permissions intentionally so old direct attendance writes are blocked. Use the new client together with this migration; old app versions' direct attendance writes will no longer work.

Existing events default to Optional/All Students, preserving their old behavior rather than retroactively generating absences. Existing records are retained. Configure required audiences on new events. Legacy events without complete schedules need organizer/admin review before new attendance.

New tables: `event_audience`, `saved_events`, `requests`, `notifications`, `push_tokens`, `audit_log`, `system_settings`. Added columns cover avatars, suspension, audience, late allowance, correction metadata and push delivery.

The migration creates public `avatars` and private `request-files` buckets, with owner-upload rules and a 5 MB image limit. Existing completed profiles remain locked; admin review is the correction route.

## 4. Set up an administrator

Register the intended account normally, then edit the email placeholder in `Supabase/seed_admin.sql` and run it in SQL Editor. Sign out/in afterward. There is no public Admin signup or role-change control.

Students register as approved. Teachers register as pending, then the admin approves them in Users. A student must complete official details before participating in event rosters/attendance.

## 5. Email links

In Supabase Authentication URL Configuration, allow the actual development/production redirect URLs for `/login` and `/reset-password`. Native builds retain the original `qr-attendance` scheme: allow `qr-attendance://login` and `qr-attendance://reset-password` as appropriate. Expo Go uses its own development URL; use that exact URL during development.

Email confirmation is controlled by your Supabase Auth settings. Recovery routes exchange returned tokens/code and allow setting a new password. Use a development or installed build to validate native deep links.

## 6. Run and verify

```bash
npm run typecheck
npm test
npx expo start --clear
```

Use `w` for web or the development build on Android. Camera on web requires HTTPS or localhost. Test profile selection/cropping, QR camera/torch and sharing on the actual phone.

The native image-picker, clipboard and notifications modules require rebuilding the installed app. An older APK will not acquire them from a JavaScript refresh.

```bash
npx eas-cli build --platform android --profile preview
```

Do not run a cloud build until the project credentials/environment are configured. The ZIP contains source, not a signed APK.

## 7. Background reminders

In-app notices and absence housekeeping run when an active app refreshes. For independent scheduled operation while every app is closed:

1. Configure Android FCM v1 / iOS APNs credentials in the original EAS project.
2. Set a random `SCANIN_WORKER_SECRET` as a Supabase Edge Function secret. Do not place it in the app or commit it.
3. Deploy the bundled `scanin-worker` Edge Function. Its config disables automatic JWT verification because it validates the private `x-scanin-worker-secret` header itself.
4. Supabase provides `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` inside the function. Keep these server-only. If Expo push access-token security is enabled, set server-side `EXPO_ACCESS_TOKEN` too.
5. Enable Supabase Cron (`pg_cron`) and `pg_net`. Put `scanin_worker_url` and `scanin_worker_secret` in Vault as described in `Supabase/worker_schedule.sql`, then run that schedule once.
6. Open Profile → Enable Background Notifications on an installed development/production app and grant permission. Expo Go Android and web do not support this mobile push route.
7. Confirm function/cron logs and delivery on a real device, including the app closed, event rescheduled/cancelled, check-in completed, reminder preferences disabled and sign-out.

The minute worker finalizes due required-event absences and deduplicates notice rows. Ended-event submissions are blocked immediately by the database regardless of the worker. Network/device restrictions can delay delivery; push sending is retried and failed work is exposed to admin. Provider acknowledgements are not proof the device displayed a notification.

## 8. Important operational behavior

- Published rosters use official complete profiles. First completion or approved profile corrections reconcile unfinished events. Completed rosters remain fixed; new students do not receive retroactive absences.
- QR/manual submissions lock and validate the event, so a concurrent closure cannot silently accept a late submission.
- Cancelled and optional events never generate automatic absence.
- Existing scan times remain factual. Missing records corrected by admin have a review time but no invented scan time.
- An ended-event extension clears only automatic system absences; reviewed/manual decisions remain intact. Affected students are notified. Recorded scan classifications are preserved unless separately corrected.
- Archiving preserves history and reports.
- Refresh/realtime is RLS-protected. Web background notifications are outside this delivery; web users have in-app notices.
