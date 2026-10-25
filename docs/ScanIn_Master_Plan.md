# ScanIn — Final Student, Teacher and Administrator Plan

Finalized: 24 October 2026. Based on the VeriSync project and the decisions in this conversation.

## Product and branding

- Name: **ScanIn**. School event attendance through QR scanning or manual event code.
- Keep Expo/React Native, Expo Router, Supabase authentication/database/realtime, Android and web.
- Green-and-mint branding replaces the earlier navy/teal and indigo proposals.
- Primary/action green `#047857`; background mint `#ECFDF5`; white cards; deep forest text `#064E3B`; secondary text `#52675F`; mint surface `#D1FAE5`; border `#C9DFD5`; success `#15803D`; late `#92400E`; error/absent `#BE123C`.
- Rounded cards, readable headings, clear status labels, keyboard-friendly forms, responsive grids.
- Uploaded `android-icon-background.png` is the launcher artwork. Prepared launcher/adaptive versions keep Android safe margins.
- Uploaded `qr-logo.png` is used on the splash screen and above Login/Registration.
- Keep the original Android package, Expo slug and EAS project identity so this remains an update; change the displayed app name to ScanIn.

## Login and registration

- Shared login for all roles; no role selector on login.
- Mint background with subtle decoration, white form, supplied logo, green actions.
- Email, password, show/hide password, Forgot Password, Sign In, Register link.
- Registration: Student/Teacher choice, full name, email, password, confirmation, password guidance, Create Account, Sign In link.
- No public Admin registration. Students are approved automatically; teachers wait for administrator approval.
- Validate fields, matching passwords and at least eight password characters; prevent repeated submissions.
- Email verification/resend and email password recovery with reset screen.
- Sessions persist; never remember the plaintext password. Clear the original app's saved-password key.
- Approved Student → Student Home; approved Teacher → Teacher Home; Admin → Admin Home.
- Pending/rejected/suspended accounts see their status, explanation and Sign Out.
- Profile's Change Password action is replaced with Change Profile Picture. Login still has password recovery.

## Shared attendance and audience rules

- Teacher/Admin selects Required or Optional and All Students or a course/year/block audience.
- All selected restrictions must match: BSIT + FIRST YEAR + A allows only that combination.
- Same course with a different year, another block, or another course is rejected when restricted.
- Server-side roster/permission checks apply equally to QR and manually entered codes; rejected submissions create no attendance.
- Students see only assigned published events and their own attendance.
- A roster is built on publish from approved students with completed official details. New profile completion and reviewed corrections reconcile unfinished events; completed rosters stay fixed. Existing recorded attendees are preserved for history.
- Default grace period: 15 minutes, configurable per event. At start through the grace boundary: Present. After grace and before end: Late. Before start or at/after end: blocked.
- Server time determines validity and status. Display and form-entry timezone is Philippine Time.
- Exactly one attendance per student/event, including QR → manual, manual → QR, and submissions from multiple devices. Database uniqueness and serialized event validation enforce this.
- Duplicate result offers View Record; it does not insert another card.
- Ended is derived from the scheduled end time; server checks block attendance immediately even before a minute worker runs.
- Early Close stops submissions. Reopen is permitted before the scheduled end. Ended-event extension requires admin review.
- After scheduled end, required expected students without records become Absent. Optional/cancelled events never create automatic absence.
- Absences never receive a fabricated scan timestamp. Reviewed manual corrections retain the original scan time where it exists and have a separate review time/reason.
- Attendance rate = Present + Late required assignments divided by completed required assignments. Exclude optional, cancelled, upcoming and ongoing events. Show no-data text when the denominator is zero.

## Student

### Navigation
Home · Events · Scan · History · Profile.

### Home
- Avatar, greeting, date, notification bell/unread count.
- Incomplete-details prompt.
- Clickable Total Attended, Present, Late and Absent cards; required-event rate.
- Scan QR / Enter Event Code shortcuts.
- Ongoing events and remaining time, next upcoming event, recent three attendance records and View All.

### Events
- Search name/code; Upcoming, Ongoing, Closed/Ended and Cancelled filters; Required/Optional/Saved filter.
- Tap cards for full details: name, code, venue, description, start/end, organizer, audience, late allowance, event status and personal attendance.
- Upcoming: details only. Ongoing: QR/manual actions. Closed/Ended: details with attendance blocked. Cancelled: clear notice.
- Saved event is a bookmark/reminder, not attendance or a required-event assignment.
- The selected event context must match the submitted code.

### Scan
- Camera frame, QR detection, flashlight, permission instructions and manual alternative.
- Enter organizer's event code and Submit Attendance.
- Complete student profile, valid eligible event, valid window and no duplicate required.
- Loading/disabled state and explicit server confirmation.
- Result: event, student, status, recorded time, View Record; Scan Again.
- Distinct invalid, duplicate, not started, closed/ended, ineligible, incomplete-profile and connection results.
- Do not display raw QR JSON.

### History
- **Gallery-style cards, not a table**, grouped by event month/year; newest first.
- Search event name/code, month/year and status filters.
- Each card: event name, code, venue, description preview, event schedule, organizer, status and recorded date/time.
- Tap for full description and complete attendance detail.
- Absent card: no recorded scan time. One record/card per event.
- Student cannot edit/delete attendance; Report an Attendance Issue goes to admin review.

### Profile and requests
- Avatar; gallery selection, native crop/preview, save and remove. Initials fallback.
- Official name, student ID, course, year, block, gender, contact email and phone; age optional.
- Completion indicator and final-save confirmation; completed official details lock.
- Change Profile Picture remains available after details lock.
- Profile correction requests: field, proposed value and reason.
- Attendance issue: event/student, proposed correction, explanation, optional screenshot. Start from History or Event Details if no record exists.
- My Requests: Pending/Resolved/Declined and admin response.
- Notification preferences and Sign Out. No self-service role changes.

### Notifications
- Bell and read/unread list, Mark All as Read, links to related event/request.
- Start reminder: 30 minutes before saved or required events.
- End reminder: 10 minutes before an ongoing eligible event if not yet recorded.
- Schedule/cancellation and request-decision notices.
- Update/invalidate queued reminders on event changes and successful check-in.
- Background mobile push requires permission, installed build, configured push credentials and scheduled server worker. Web retains in-app notifications.

## Teacher

### Navigation and Home
Home · My Events · Attendance · Profile. No student Scan tab.
- Avatar/greeting/date/bell; My Events, Ongoing and Today's Check-ins cards.
- Create Event, today's events, active event monitoring, recent check-ins and upcoming events.
- Show QR, View Code and View Attendance per event. Monitor multiple active events individually.

### My Events
- Own events only; search and Draft/Upcoming/Ongoing/Closed/Ended/Cancelled/Archived filters.
- Fields: name, system-generated unique code, venue, description, PH start/end, Required/Optional, course/year/block audience, late allowance, automatic organizer.
- Fill → Preview → Save Draft/Publish.
- Publish, edit, close, reopen before end, cancel with reason, archive completed/cancelled events.
- Delete drafts without attendance only. Preserve event records once attendance exists.
- Restrict audience/start-time/late-rule changes once attendance exists; request administrator review. Ended extensions require review.
- Schedule/cancellation changes notify affected students.

### QR and attendance
- Large dark-on-white QR; visible/copyable code, event details, status and remaining time.
- Same eligibility, schedule and uniqueness rules for QR and manual entry.
- View Attendance per event with expected/eligible, Present, Late, Not Yet Recorded and finalized Absent counts.
- Student name/ID, course/year/block, status and scan time; full record view.
- Search name/ID, status/course/year/block filters, live updates, refresh and connection status.
- CSV/Excel export follows selected event and current filters.
- Teacher requests corrections; admin applies official changes with a reason/audit history.

### Reports, profile and notifications
- Per-event totals, course/year/block breakdown and completed-required-event rate; CSV/Excel.
- Optional events: attendee counts only, no automatic absences or required rate.
- Profile picture, teacher details, My Requests, notification preferences and Sign Out.
- Upcoming/ending event reminders, summary-ready notices, admin decisions. Recent check-ins stay on dashboard rather than notification spam.

## Administrator

### Navigation and Home
Home · Users · Events · Attendance · Profile. Direct admin landing after login; no Scan.
- Admin Profile contains an Admin Tools button. Admin Tools opens Reports, Requests, Activity Logs and System Settings.
- Overall student/teacher/event/today counts, ongoing events with organizer/live totals.
- Pending teacher approvals and requests; management shortcuts and recent activity.

### Users
- Search name/email/student ID; role/status/course/year/block filters.
- View student details/history and teacher details/events.
- Approve/decline teacher registration with reason.
- Correct locked student details with reason/audit; resolve student correction requests.
- Suspend/reactivate non-admin accounts with reason. Cannot suspend self or change roles through the app.
- No exposed passwords and no routine hard deletion of accounts with records.
- Administrator promotion remains an explicit trusted SQL setup action.

### Events and attendance
- See all organizers' events; create/admin-manage with the same fields and validation.
- QR/code display, audience, status, attendance, cancellation/archival.
- Review teacher event changes, inspect current/proposed fields and affected roster/records.
- Recorded scan classifications are not silently recomputed when an event rule changes.
- Reviewed audience changes preserve recorded attendees and reconcile unrecorded assignments. Reviewed extensions clear only system-generated absences, preserving correction history.
- Select event → full attendance, expected roster, status counts, organizer and student details.
- Filters/search/live updates and filtered CSV/Excel.
- Correct/void record or resolve missing record after verification. Reason and audit required; retain original scan time, separate review time, and student notification.
- Voiding a required ended-event record may result in a system Absent record at finalization.

### Requests, reports and logs
- Central Profile/Attendance/Event requests; Pending/Resolved/Declined.
- Review reason/attachment/current/proposed values; approve/decline with response, notify requester, preserve audit. A reviewed request cannot be applied twice.
- Overall/per-event/per-student/course/year/block/organizer reports, monthly check-in chart, CSV/Excel.
- School-wide rate weights all completed required student-event assignments, not an average of event percentages.
- Read-only logs: actor/action/record, before/after values, reason, time.

### Settings and profile
- Course/year/block lists, default 15-minute allowance and 30/10-minute reminders.
- New defaults do not silently change existing event rules. Reminder timing governs future reminders.
- Avatar, admin details, notification preferences and Sign Out.
- Alerts for pending teachers, new requests and background processing errors.

## Delivery and verification boundaries

This package contains implemented source, an additive SQL migration, server worker, setup guide and automated tests. It does not modify the user's running Supabase instance, publish a website, create a signed APK, or deploy the worker automatically. See `SETUP.md` and `VERIFICATION.md` for the checks actually performed and device/cloud checks still required.


## Final repair decisions implemented

- Full screens live directly in their `app`, tabs and admin route files. Shared visual controls/forms remain in components.
- Project-owned application, worker and test code uses `.ts` and `.tsx` only; original `.cjs` and `.mjs` tests are converted.
- `.env` and `.env.example` are preserved byte-for-byte from the latest uploaded project.
- Supporting screens have visible Back controls and role-correct fallback destinations. Modal details and forms have Close. Android Back is handled on supporting screens; Home does not return to Login.
- Student/Teacher/Admin profile headers center the picture, name, role and email. Admin uses Profile instead of More, with an Admin Tools button.
- Create/Edit Event has exactly two combined controls: Start Date & Time and End Date & Time, with calendar/time selection, AM/PM and Philippine Time.
- Event Code is visible and generated before save, can regenerate before first save, and becomes read-only afterward. Server format/uniqueness validation preserves the displayed code.
- App/server type-checks are separated correctly. Role data and important API results have explicit models; optional section failures do not block the entire account/dashboard.
- Scan locks reset for a new event; Sign Out still attempts authentication sign-out if device push cleanup fails.
