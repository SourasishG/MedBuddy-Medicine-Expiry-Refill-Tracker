# MedBuddy Backend API Reference

This document serves as the comprehensive integration guide for frontend developers building client features against the MedBuddy Supabase backend.

---

## 1. Authentication & Authorization Model

### Authentication

- Supported sign-in methods:
  - **Email OTP / Code**: 6-digit one-time code sent via email (no passwords).
  - **Google OAuth**: One-tap sign-in.
- The client receives a JWT containing the user's `sub` claim (`auth.uid()`), which is automatically attached as an `Authorization: Bearer <token>` header to all PostgREST and RPC calls.

### Authorization & Permission Hierarchy

Every care profile has a collaborative care team with three hierarchical roles defined by `care_role`:

- **`owner`**: Full administrative control. Can create/edit medicines, log/snooze/undo doses, adjust stock, manage schedules, invite other users, assign roles, revoke access, and delete profiles.
- **`caregiver`**: Operational control (`can_edit`). Can create/edit medicines, schedules, boxes, and log/snooze/undo doses. Cannot invite owners or alter team roles.
- **`viewer`**: Read-only access (`can_view`). Can inspect medicines, schedules, dose history, and remaining quantities, but cannot log doses or modify inventory.

### Ledger & State Mutation Security

Direct client mutations on sensitive tables are strictly prohibited:

- `dose_events`: Cannot be directly inserted or updated via PostgREST. All dose status changes must go through `fn_log_dose`, `fn_log_as_needed`, `fn_snooze_dose`, or `fn_undo_dose`.
- `inventory_items.quantity_remaining`: Cannot be directly edited via PostgREST. Stock is updated automatically via the immutable ledger table `stock_movements`, driven by dose logging or stock adjustment RPCs.
- `stock_movements`: Direct client inserts and updates are revoked.

---

## 2. Database Tables & Views Reference

### `profiles`

Holds public user profile attributes linked 1:1 with `auth.users.id`.

- **Columns:** `id (uuid)`, `full_name (text)`, `avatar_url (text)`, `phone (text)`, `timezone (text)`, `created_at (timestamptz)`, `updated_at (timestamptz)`
- **Read (SELECT):** Authenticated users can read their own profile row (`id = auth.uid()`).
- **Write (UPDATE):** Authenticated users can update `full_name`, `avatar_url`, and `timezone` on their own profile row. Direct update of `phone` is restricted to verification flows.

### `care_profiles`

Represents the patient or individual whose medication is being managed (e.g. "Mum", "Dad", "Self").

- **Columns:** `id (uuid)`, `name (text)`, `timezone (text)`, `snooze_minutes (int)`, `renudge_after_minutes (int)`, `missed_after_minutes (int)`, `linked_user_id (uuid)`, `created_by (uuid)`, `created_at (timestamptz)`
- **Read (SELECT):** Any authenticated user who is a member of the profile (`can_view(id)`).
- **Write (UPDATE):** Only owners of the profile (`is_owner(id)`).
- **Insert:** Direct insert is revoked; callers must use `fn_create_care_profile()`.
- **Delete:** Direct delete is revoked; callers must use `fn_delete_my_data()` or owner administrative cleanup.

### `care_members` (View)

Secure view providing a directory of all team members participating in a care profile.

- **Columns:** `care_profile_id (uuid)`, `user_id (uuid)`, `role (care_role)`, `joined_at (timestamptz)`, `full_name (text)`, `avatar_url (text)`, `phone (text)`
- **Read (SELECT):** Any member who has access to the care profile (`can_view(care_profile_id)`).

### `care_access`

Association table tracking care profile membership, roles, and notification preferences.

- **Columns:** `care_profile_id (uuid)`, `user_id (uuid)`, `role (care_role)`, `notify_due (bool)`, `notify_missed (bool)`, `notify_expiry (bool)`, `created_at (timestamptz)`
- **Read (SELECT):** Members of the care profile can inspect fellow access records.
- **Write (INSERT/UPDATE/DELETE):** Direct client mutations are blocked. Callers use `fn_create_invite`, `fn_accept_invite`, `fn_set_role`, `fn_remove_access`, and `fn_set_my_notifications`.

### `medicines`

Master catalogue of medications tracked in a care profile.

- **Columns:** `id (uuid)`, `care_profile_id (uuid)`, `name (text)`, `brand_name (text)`, `strength (text)`, `unit (text)`, `notes (text)`, `created_at (timestamptz)`, `archived_at (timestamptz)`
- **Read (SELECT):** Permitted if `can_view(care_profile_id)`.
- **Write (INSERT/UPDATE):** Permitted if `can_edit(care_profile_id)`.
- **Delete:** Hard delete is disallowed; set `archived_at` to current timestamp to archive.

### `inventory_items`

Physical medication packages, strips, or bottles in the medicine cabinet.

- **Columns:** `id (uuid)`, `medicine_id (uuid)`, `care_profile_id (uuid)`, `batch_number (text)`, `expiry_date (date)`, `quantity_initial (numeric)`, `quantity_remaining (numeric)`, `status (stock_status)`, `notes (text)`, `created_at (timestamptz)`
- **Read (SELECT):** Permitted if `can_view(care_profile_id)`.
- **Write (INSERT):** Permitted if `can_edit(care_profile_id)`. `quantity_remaining` is automatically initialized to match `quantity_initial`.
- **Write (UPDATE):** Direct updates to `quantity_remaining` and `status` are revoked. Only metadata (`batch_number`, `notes`, `expiry_date`) can be updated directly. Use `fn_adjust_stock` or `fn_discard_item` for quantity adjustments.

### `schedules`

Defines medication timing, frequencies, and recurrence rules.

- **Columns:** `id (uuid)`, `care_profile_id (uuid)`, `medicine_id (uuid)`, `frequency (schedule_freq)`, `interval_days (int)`, `days_of_week (int[])`, `start_date (date)`, `end_date (date)`, `dose_amount (numeric)`, `instructions (text)`, `is_active (bool)`, `created_at (timestamptz)`
- **Read (SELECT):** Permitted if `can_view(care_profile_id)`.
- **Write (INSERT/UPDATE):** Permitted if `can_edit(care_profile_id)`. After adding or updating a schedule, invoke `fn_resync_schedule(id)` to update upcoming dose events.

### `schedule_times`

Specific clock times for scheduled doses.

- **Columns:** `id (uuid)`, `schedule_id (uuid)`, `care_profile_id (uuid)`, `time_of_day (time)`
- **Read (SELECT):** Permitted if `can_view(care_profile_id)`.
- **Write (INSERT/UPDATE/DELETE):** Permitted if `can_edit(care_profile_id)`.

### `dose_events`

Individual occurrences of a dose at a specific datetime.

- **Columns:** `id (uuid)`, `care_profile_id (uuid)`, `medicine_id (uuid)`, `schedule_id (uuid)`, `schedule_time_id (uuid)`, `scheduled_for (timestamptz)`, `dose_amount (numeric)`, `status (dose_status)`, `snoozed_until (timestamptz)`, `taken_at (timestamptz)`, `logged_at (timestamptz)`, `logged_by (uuid)`, `stock_shortfall (numeric)`, `client_request_id (uuid)`
- **Read (SELECT):** Permitted if `can_view(care_profile_id)`.
- **Write (INSERT/UPDATE/DELETE):** Direct table writes are revoked. Callers must invoke RPC functions (`fn_log_dose`, `fn_log_as_needed`, `fn_snooze_dose`, `fn_undo_dose`).

### `stock_movements`

Immutable audit ledger recording every change in inventory count.

- **Columns:** `id (bigint)`, `inventory_item_id (uuid)`, `delta (numeric)`, `reason (text)`, `dose_event_id (uuid)`, `created_at (timestamptz)`, `created_by (uuid)`
- **Read (SELECT):** Permitted if user is a member of the associated care profile.
- **Write (INSERT/UPDATE/DELETE):** Direct client writes are blocked. Automatically managed by the system.

### `notifications`

Notification log generated for users.

- **Columns:** `id (uuid)`, `user_id (uuid)`, `care_profile_id (uuid)`, `dose_event_id (uuid)`, `inventory_item_id (uuid)`, `kind (notif_kind)`, `title (text)`, `body (text)`, `status (notif_status)`, `send_after (timestamptz)`, `sent_at (timestamptz)`, `attempts (int)`, `last_error (text)`, `dedupe_key (text)`, `created_at (timestamptz)`
- **Read (SELECT):** Permitted only where `user_id = auth.uid()`.
- **Write (INSERT/UPDATE/DELETE):** Direct client writes are blocked.

### `push_subscriptions`

Stores Web Push endpoints registered by the user's browser.

- **Columns:** `id (uuid)`, `user_id (uuid)`, `endpoint (text)`, `p256dh (text)`, `auth_key (text)`, `created_at (timestamptz)`, `last_success_at (timestamptz)`, `failure_count (int)`, `first_failure_at (timestamptz)`, `last_failure_at (timestamptz)`
- **Read / Insert / Delete:** Permitted where `user_id = auth.uid()`.

### `eligible_push_subscriptions` (View)

Internal view used by the notification sender to select active, non-degraded subscriptions.

- **Rule:** Includes subscriptions where `failure_count < 5` OR `last_failure_at < now() - interval '1 hour'` (cool-down window).
- **Cleanup cut-off:** Subscriptions failing continuously for > 7 days (`first_failure_at < now() - interval '7 days'`) are automatically pruned.
- **Access:** `service_role` only. Direct client access is revoked.

### `consents`

Records user agreement to terms and privacy policies.

- **Columns:** `id (uuid)`, `user_id (uuid)`, `consent_type (text)`, `version (text)`, `agreed_at (timestamptz)`, `revoked_at (timestamptz)`
- **Read / Insert:** Permitted where `user_id = auth.uid()`.

### `invites`

Pending invitation tokens for care team collaboration.

- **Columns:** `id (uuid)`, `care_profile_id (uuid)`, `created_by (uuid)`, `role (care_role)`, `token_hash (text)`, `hint (text)`, `expires_at (timestamptz)`, `accepted_at (timestamptz)`, `accepted_by (uuid)`, `revoked_at (timestamptz)`, `created_at (timestamptz)`
- **Read (SELECT):** Owners of the care profile can list active invites. Callers accept tokens via `fn_accept_invite`.

---

## 3. Client RPC Functions Reference

All functions are invoked via `supabase.rpc('<function_name>', { ...args })`.

---

### `fn_create_care_profile`

Creates a new care profile and registers the calling user as the first `owner`.

- **Arguments:**
  - `p_name (text, required)`: Display name for the care recipient (e.g. "Mum", "Self", "Grandpa").
  - `p_timezone (text, optional)`: Valid IANA timezone name. Defaults to `'Asia/Kolkata'`.
  - `p_is_me (boolean, optional)`: When `true`, links this care profile directly to the caller's profile (`linked_user_id = auth.uid()`). Defaults to `false`.
- **Returns:** `uuid` — The newly created `care_profile.id`.
- **Authorization:** Any authenticated user.
- **Errors:**
  - `42501`: Not authenticated.
  - `22023`: Invalid timezone string.
- **Example:**

```typescript
const { data: profileId, error } = await supabase.rpc('fn_create_care_profile', {
  p_name: 'Asha (Mum)',
  p_timezone: 'Asia/Kolkata',
  p_is_me: false,
});
```

---

### `fn_create_invite`

Generates a cryptographically secure, single-use invite token (valid for 7 days) to share access with a family member or caregiver.

- **Arguments:**
  - `p_care_profile (uuid, required)`: Target care profile ID.
  - `p_role (care_role, required)`: Role to grant upon acceptance (`'caregiver'` or `'viewer'`).
  - `p_hint (text, optional)`: Optional label (e.g. "For Dr. Rao" or "Sister").
- **Returns:** `text` — Plaintext 32-character invite token. (Only the SHA-256 hash is stored in the database).
- **Authorization:** Authenticated user with `owner` role on the care profile.
- **Errors:**
  - `42501`: Caller is not an owner of the care profile.
  - `22023`: Invalid role.
- **Example:**

```typescript
const { data: inviteToken, error } = await supabase.rpc('fn_create_invite', {
  p_care_profile: careProfileId,
  p_role: 'caregiver',
  p_hint: 'Sister Priya',
});
```

---

### `fn_accept_invite`

Accepts a pending invite token and links the calling user to the care profile.

- **Arguments:**
  - `p_token (text, required)`: The plaintext token received from the invite link.
- **Returns:** `uuid` — The `care_profile.id` joined.
- **Authorization:** Any authenticated user.
- **Errors:**
  - `42501`: Not authenticated.
  - `P0001`: Token is invalid, expired, revoked, or already accepted.
- **Example:**

```typescript
const { data: careProfileId, error } = await supabase.rpc('fn_accept_invite', {
  p_token: tokenFromUrl,
});
```

---

### `fn_revoke_invite`

Revokes an unaccepted invite token so it can no longer be used.

- **Arguments:**
  - `p_invite (uuid, required)`: The ID of the invite record.
- **Returns:** `void`
- **Authorization:** Authenticated `owner` of the care profile.

---

### `fn_set_role`

Modifies the role of an existing care team member.

- **Arguments:**
  - `p_care_profile (uuid, required)`: Care profile ID.
  - `p_user (uuid, required)`: Target user ID to update.
  - `p_role (care_role, required)`: New role (`'owner'`, `'caregiver'`, or `'viewer'`).
- **Returns:** `void`
- **Authorization:** Authenticated `owner` of the care profile.
- **Errors:**
  - `P0001`: Cannot demote the last remaining owner of a care profile.

---

### `fn_remove_access`

Removes a member from the care profile team.

- **Arguments:**
  - `p_care_profile (uuid, required)`: Care profile ID.
  - `p_user (uuid, required)`: Target user ID to remove.
- **Returns:** `void`
- **Authorization:** Authenticated `owner` of the care profile.
- **Errors:**
  - `P0001`: Cannot remove the last remaining owner.

---

### `fn_leave_profile`

Allows the current user to voluntarily leave a care profile.

- **Arguments:**
  - `p_care_profile (uuid, required)`: Care profile ID.
- **Returns:** `void`
- **Authorization:** Any member of the care profile.
- **Errors:**
  - `P0001`: Cannot leave if you are the last remaining owner.

---

### `fn_set_my_notifications`

Updates notification preferences for the calling user for a specific care profile.

- **Arguments:**
  - `p_care_profile (uuid, required)`: Care profile ID.
  - `p_due (boolean, required)`: Receive dose due reminders.
  - `p_missed (boolean, required)`: Receive missed dose escalation alerts.
  - `p_expiry (boolean, required)`: Receive stock expiry & low-inventory warnings.
- **Returns:** `void`
- **Authorization:** Any member of the care profile.
- **Example:**

```typescript
const { error } = await supabase.rpc('fn_set_my_notifications', {
  p_care_profile: careProfileId,
  p_due: true,
  p_missed: true,
  p_expiry: false,
});
```

---

### `fn_resync_schedule`

Regenerates upcoming `pending` dose events for a schedule over the next 7 days, purging any orphan future doses if times changed.

- **Arguments:**
  - `p_schedule (uuid, required)`: Schedule ID.
- **Returns:** `int` — Number of dose events created or refreshed.
- **Authorization:** Authenticated user with edit rights (`can_edit`).
- **Example:**

```typescript
const { data: count, error } = await supabase.rpc('fn_resync_schedule', {
  p_schedule: scheduleId,
});
```

---

### `fn_log_dose`

Logs a scheduled dose event as `taken` or `skipped`. Automatically executes **First-Expired-First-Out (FEFO)** inventory deduction from the earliest-expiring active box.

- **Arguments:**
  - `p_event (uuid, required)`: The ID of the `dose_events` record.
  - `p_status (dose_status, required)`: Target status (`'taken'` or `'skipped'`).
  - `p_taken_at (timestamptz, optional)`: When the dose was actually ingested. Defaults to `now()`.
  - `p_client_request_id (uuid, optional)`: Client idempotency key for safe offline retries.
- **Returns:** `dose_events` row — Updated dose record including `stock_shortfall` (if inventory was insufficient).
- **Authorization:** Authenticated user with edit rights (`can_edit`).
- **Errors:**
  - `42501`: Unauthorized / insufficient permissions.
  - `P0001`: Dose event already finalized; cannot re-log without undoing first.
- **Example:**

```typescript
const { data: updatedDose, error } = await supabase.rpc('fn_log_dose', {
  p_event: doseId,
  p_status: 'taken',
  p_taken_at: new Date().toISOString(),
});
```

---

### `fn_log_as_needed`

Records an unscheduled or PRN (as-needed) dose taken immediately (e.g. SOS painkillers, antacids). Creates the dose event and applies FEFO stock deduction in a single transaction.

- **Arguments:**
  - `p_medicine (uuid, required)`: Medicine ID.
  - `p_amount (numeric, required)`: Dose amount taken (e.g. 1, 2).
  - `p_taken_at (timestamptz, optional)`: Timestamp taken. Defaults to `now()`.
  - `p_client_request_id (uuid, optional)`: Client idempotency key.
- **Returns:** `dose_events` row.
- **Authorization:** Authenticated user with edit rights (`can_edit`).
- **Example:**

```typescript
const { data: prnDose, error } = await supabase.rpc('fn_log_as_needed', {
  p_medicine: medicineId,
  p_amount: 1,
});
```

---

### `fn_snooze_dose`

Snoozes a due dose event for a specified duration, postponing reminders.

- **Arguments:**
  - `p_event (uuid, required)`: Dose event ID.
  - `p_minutes (int, optional)`: Number of minutes to snooze. Defaults to profile setting (e.g. 15).
- **Returns:** `dose_events` row with updated `snoozed_until` timestamp.
- **Authorization:** Authenticated user with edit rights (`can_edit`).

---

### `fn_undo_dose`

Reverses a previously logged dose (`taken` or `skipped`). Restores any deducted inventory back to the exact boxes it was consumed from, creates compensating ledger movements, and resets the dose status to `pending`.

- **Arguments:**
  - `p_event (uuid, required)`: Dose event ID to undo.
- **Returns:** `dose_events` row.
- **Authorization:** Authenticated user with edit rights (`can_edit`).
- **Example:**

```typescript
const { data: resetDose, error } = await supabase.rpc('fn_undo_dose', {
  p_event: doseId,
});
```

---

### `fn_adjust_stock`

Manually adjusts remaining quantity of a box (e.g. pill dropped, spilled, or physical count discrepancy).

- **Arguments:**
  - `p_item (uuid, required)`: `inventory_items.id`.
  - `p_delta (numeric, required)`: Change in quantity (positive to add, negative to subtract).
- **Returns:** `void`
- **Authorization:** Authenticated user with edit rights (`can_edit`).

---

### `fn_discard_item`

Marks a medicine box as discarded (e.g. expired, contaminated, or damaged) and zeroes out remaining stock.

- **Arguments:**
  - `p_item (uuid, required)`: `inventory_items.id`.
- **Returns:** `void`
- **Authorization:** Authenticated user with edit rights (`can_edit`).

---

### `fn_export_my_data`

Generates a complete, structured JSON export of all personal health records, care profiles, medicines, inventory, schedules, doses, and logs associated with the caller per GDPR / DPDP Article 12 compliance.

- **Arguments:** None (`{}`)
- **Returns:** `jsonb` object:
  ```json
  {
    "profile": { ... },
    "care_profiles": [
      {
        "id": "...",
        "name": "...",
        "role": "owner",
        "medicines": [ ... ],
        "inventory": [ ... ],
        "schedules": [ ... ],
        "dose_events": [ ... ]
      }
    ],
    "consents": [ ... ]
  }
  ```
- **Authorization:** Any authenticated user.

---

### `fn_delete_my_data`

Implements the right to erasure / right to be forgotten. Permanently cascades and deletes the user's profile, owned care profiles, all inventory, dose events, notifications, and subscriptions.

- **Arguments:** None (`{}`)
- **Returns:** `void`
- **Authorization:** Any authenticated user.
- **Errors:**
  - `P0001`: If the caller is an owner of a shared care profile that has other active co-owners, the profile is preserved and ownership is transferred, or caller is prompted to transfer ownership before deletion.

---

## 4. Helper Permission Functions

These functions are available as SQL functions and PostgREST RPC endpoints to test access conditions:

- **`can_view(cp uuid) -> boolean`**: Checks if `auth.uid()` has any membership (`owner`, `caregiver`, or `viewer`) on care profile `cp`.
- **`can_edit(cp uuid) -> boolean`**: Checks if `auth.uid()` has edit permissions (`owner` or `caregiver`) on care profile `cp`.
- **`is_owner(cp uuid) -> boolean`**: Checks if `auth.uid()` is an `owner` of care profile `cp`.
- **`is_valid_tz(tz text) -> boolean`**: Validates whether a timezone identifier exists in `pg_timezone_names`.

---

## 5. Worker & Administrative Functions (`service_role` Only)

These functions are strictly restricted to backend background workers and the `service_role`. Direct execution by `anon` or `authenticated` roles is revoked (`42501 Not allowed`).

### `fn_scheduler_health`

Evaluates the health and status of background scheduling and Vault configurations.

- **Arguments:** None (`{}`)
- **Returns:** `jsonb` containing:
  - `secrets`: Boolean presence indicators (`has_cron_secret`, `has_project_url`). Secret values are NEVER returned.
  - `jobs`: Last status, start time, and error messages for each `medbuddy-*` cron job.
  - `pending_overdue_count`: Number of pending notifications older than 5 minutes past their `send_after` time.
  - `recent_failed_count`: Number of notifications marked `failed` in the last 24 hours.
  - `last_success_at`: Timestamp of the most recent successful notification delivery.
- **CLI Helper:** `npm run health` (`scripts/health.mjs`).

### `fn_record_push_failure`

Records a dispatch failure against a push subscription.

- **Arguments:** `p_id (uuid)`: ID of the failed `push_subscriptions` record.
- **Behavior:** Increments `failure_count`, sets `last_failure_at = now()`, and initializes `first_failure_at` if null.

### `fn_record_push_success`

Records a successful push dispatch.

- **Arguments:** `p_id (uuid)`: ID of the successful `push_subscriptions` record.
- **Behavior:** Resets `failure_count = 0`, clears `first_failure_at` and `last_failure_at` to null, and updates `last_success_at = now()`.

### `fn_trigger_notification_sender`

Dispatches pending notifications to the Edge Function via `pg_net`.

- **Behavior:** Reads `project_url` and `cron_secret` dynamically from `vault.decrypted_secrets`. If either secret is absent, raises an explicit PostgreSQL exception to ensure failure visibility in `cron.job_run_details`.

### `fn_cleanup_old_notifications`

Purges delivered or failed notifications older than 30 days and prunes push subscriptions failing continuously for > 7 days.

---

## 6. Standard Error Codes Reference

| Error Code | PostgreSQL State | Description                                                       | Recommended Client Action                                           |
| ---------- | ---------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------- |
| `401`      | `42501`          | Unauthorized / Session expired                                    | Redirect to sign-in / refresh token.                                |
| `403`      | `42501`          | Permission denied by RLS policy                                   | Display "You do not have permission to view or edit this resource". |
| `404`      | `P0002`          | Entity not found                                                  | Show 404 or empty state.                                            |
| `409`      | `23505`          | Unique constraint violation (e.g. duplicate active schedule time) | Alert user to existing duplicate record.                            |
| `400`      | `22023`          | Invalid argument (e.g. invalid timezone or negative dose amount)  | Validate input in UI before submitting.                             |
| `400`      | `P0001`          | Business logic exception (e.g. cannot demote last owner)          | Display error message returned in `error.message`.                  |
