# MedBuddy: Database and Feature Design (v1)

Companion files: `medbuddy_schema.sql` (the schema), `medbuddy_schema_tests.sql` (the test scenario) and `medbuddy_er_diagram.png` (the diagram).
Target: Supabase (PostgreSQL 15+), free tier. No frontend is designed here.

## 1. Key design decisions

| Decision | Why |
|---|---|
| **A "care profile" is separate from a user account.** A user can manage several care profiles (self, mother, child), and a care profile does not need an account. | An elderly parent may never install the app. A caregiver still needs to track their medicines. |
| **Access is one table, `care_access`, with three roles:** owner (full control), caregiver (edit and log doses), viewer (read-only). | Family sharing, caregiver alerts and removal all become simple rows. No separate "family group" concept. |
| **Medicine, box and schedule are three different things.** `medicines` = what it is. `inventory_items` = a physical box with its own quantity and expiry. `schedules` = when it is taken. | A household often holds two boxes of the same medicine with different expiry dates. Doses are taken from the earliest-expiring usable box first. |
| **Dose events are generated ahead of time (7 days) from schedules.** | The scheduler only has to ask "which pending doses are due?". Missed doses and caregiver alerts become simple queries. |
| **Stock changes go through a ledger (`stock_movements`).** | Undo is exact, and every change is traceable. Remaining quantity is a cached sum. |
| **Notifications use an outbox table with a `dedupe_key`.** | If a job runs twice, nobody gets two reminders. A sender can retry failures safely. |
| **Users cannot write dose or stock data directly.** They call functions that check permissions. | Stock can't be edited by hand, and a viewer can't log doses, even with a modified client. |
| **Row-level security on every table.** | The database itself enforces "only my data, plus what was shared with me". |

Improvements over the first sketch: care profiles for people without accounts, multiple boxes per medicine, the stock ledger, the notification outbox, invite links instead of phone matching (safer and works for Google users), and lock-screen privacy.

## 2. Features and where they live

| Feature | Release | Tables and functions |
|---|---|---|
| Sign-in, consent | v1 | `profiles`, `consents`, Supabase Auth |
| Cabinet with expiry colours | v1 | `medicines`, `inventory_items`, view `inventory_status` |
| Dose schedules (daily, chosen weekdays, every N days, as needed) | v1 | `schedules`, `schedule_times`, `fn_generate_dose_events`, `fn_resync_schedule` |
| Taken / Skipped / Snoozed, undo | v1 | `dose_events`, `fn_log_dose`, `fn_undo_dose`, `fn_snooze_dose` |
| Stock updates automatically | v1 | `stock_movements`, `_deduct_stock` |
| Reminders and re-nudge | v1 | `notifications`, `push_subscriptions`, `fn_enqueue_due_notifications` |
| Expiry alerts (30, 15, 7 days, expired) | v1 | `fn_enqueue_expiry_notifications` |
| Refill prediction | v1 | view `medicine_supply` |
| Large-text mode, hide names on lock screen | v1 | `profiles` columns |
| Download and delete my data | v1 | `fn_export_my_data`, `fn_delete_my_data` |
| Family sharing, invites | v1.1 | `care_access`, `invites`, `fn_create_invite`, `fn_accept_invite`, view `care_members` |
| Caregiver missed-dose alerts | v1.1 | `care_access.notify_missed`, `dose_missed` notifications |
| Opened-date tracking | v1.1 | `inventory_items.opened_on`, `medicines.shelf_life_after_opening_days` |
| Scanning, doctor PDF, disposal guidance | v1.2 | App-side work, plus `medicine_catalog` for autocomplete |

The schema already contains the v1.1 and v1.2 tables, so no migration is needed later.

## 3. Rules the database enforces

- **Expiry colour:** green above 30 days, amber 8 to 30 days, red 7 days or less (or expired). The date used is the earlier of the printed expiry and "opened on + shelf life after opening".
- **Alert thresholds:** one alert per box at 30, 15, 7 days and at expiry. A box added with 5 days left gets one alert, not three.
- **Stock use:** earliest-expiring usable box first. Expired and finished boxes are never used. If no box can cover a dose, it is still logged and the gap is recorded in `stock_shortfall`.
- **Missed:** a dose still pending 120 minutes after its time (changeable per care profile). A gentle re-nudge goes out at 30 minutes.
- **Snooze:** 10 minutes by default, changeable per care profile.
- **Time zones:** each care profile has its own time zone. Schedules are saved as local times, so 8:00 PM stays 8:00 PM.
- **Past doses are never back-filled:** creating a schedule at 3 PM does not invent a missed 8 AM dose.
- **Last owner:** a care profile always keeps at least one owner.
- **Reminder recipients:** the person themself gets due reminders. Caregivers and viewers get missed-dose and expiry alerts by default, and each person can change their own settings.

## 4. Core flows

**Add a medicine:** create the medicine, then one or more boxes (quantity, expiry, optional batch and storage place), then an optional schedule with times of day. The app then calls `fn_resync_schedule`.

**A dose is due:** every minute, `fn_enqueue_due_notifications` queues reminders for pending doses that are due. A sender function delivers them with Web Push and marks them sent or failed.

**Log a dose:** `fn_log_dose` updates the dose, deducts stock from the earliest-expiring box, and cancels any reminders still queued. Undo reverses it exactly.

**A dose is missed:** the same job marks it missed and queues alerts for every caregiver and viewer who has `notify_missed` on.

**Invite a family member:** the owner creates an invite link (the token is shown once, only its hash is stored, and it expires in 7 days). The other person signs in, opens the link, and gets the chosen role.

**Delete my data:** care profiles where the user is the only owner are deleted with all their medicines, boxes and history. Where another owner exists, the user is only removed. Then the account is deleted.

## 5. Security and privacy

- Row-level security is on for every table. The anonymous role has no access at all.
- Users can only edit the columns they should. For example, they cannot edit `phone` (set by the backend after verification) or a box's remaining quantity.
- Invite tokens, and everything else secret, are never stored in plain text.
- No date of birth, diagnosis, doctor name or address is collected. Free-text fields (`purpose`, `notes`) are short, optional, and marked as sensitive in the UI.
- Notification text can hide medicine names (`hide_names_in_notifications`) so nothing private shows on a lock screen.
- Medicine names are health data. Before real users join: a consent screen, an app privacy notice, and a lawyer's review (India's DPDP Act applies).

## 6. Scheduler and push

| Job | When | What |
|---|---|---|
| `fn_enqueue_due_notifications` | Every minute | Due, re-nudge, snooze and missed alerts |
| `fn_generate_dose_events(7)` | Daily | Keeps 7 days of upcoming doses ready |
| `fn_enqueue_expiry_notifications` | Daily | Expiry and low-stock alerts |
| Sender (Supabase Edge Function) | Every minute | Sends queued notifications with Web Push, marks them sent or failed, and removes dead subscriptions |

The three database jobs run with `pg_cron` (commented SQL is at the end of the schema file). The sender is not written yet.

## 7. What was tested

The schema was loaded into a real PostgreSQL 16 server and run through a scripted scenario of about 100 checks:

- Boxes used earliest-expiry first, expired boxes ignored, logging twice and retrying safely, and exact undo.
- Row-level security: a stranger sees nothing and every attempted write is refused; viewers are read-only; caregivers can log doses.
- Invites: tokens stored hashed, single use, expiring.
- Reminders, re-nudge, missed doses and snooze, with no duplicates when the job runs twice.
- Expiry and low-stock alerts, time zones (8:00 in New York is not 8:00 UTC), weekday and every-N-days schedules.
- Last-owner protection, data export, and deletion removing everything.

Two real problems were found and fixed:

1. A removed member could still see a care profile they had created. Care profiles are now created through `fn_create_care_profile`.
2. **Permissions on Supabase.** Supabase gives its signed-in role broad default permissions on everything created in `public`. A first version of the schema did not take these back, so a signed-in user could have called scheduler-only functions and edited stock directly. The schema now revokes them and also locks the defaults for future objects. The tests were extended (T6b) to simulate Supabase's defaults, and they pass.

**Not yet tested:** Supabase itself. The test used a stand-in for Supabase's login functions, so run the schema on a real Supabase project early and repeat the permission checks there. Also untested: `pg_cron` and the push sender, which don't exist yet.

## 8. Known limits and open questions

1. **Reminders are best-effort.** Web Push can be delayed or dropped, and on iPhone only works once the app is added to the Home Screen. The app should show a "Due now" list that doesn't depend on notifications.
2. **Free Supabase pauses** a project after about a week of no activity. Fine for a pilot, not for real users.
3. **Daylight-saving gaps** (a scheduled time that doesn't exist on one day) are not handled specially. India has no daylight saving, so this only matters if you support other regions.
4. **Medicine catalog:** left empty. Importing a drug list needs a licence check, so decide whether to hand-curate a small list or skip autocomplete in v1.
5. **Free-text notes** are not encrypted beyond Supabase's disk encryption. Decide whether that is enough, or whether to remove the fields.
6. **Phone sign-in:** `profiles.phone` is ready, but SMS verification is not set up and costs money.
7. **No drug-interaction checks and no dose advice**, by design.
