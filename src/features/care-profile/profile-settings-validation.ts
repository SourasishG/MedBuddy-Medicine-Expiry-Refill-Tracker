export const DEFAULT_FALLBACK_SNOOZE_MINUTES = 10;
export const DEFAULT_RENUDGE_MINUTES = 30;
export const DEFAULT_MISSED_MINUTES = 120;

export const PERMISSION_DENIED_MESSAGE = 'You don’t have permission to change this profile.';
export const GENERIC_UPDATE_ERROR_MESSAGE =
  'Could not update care profile. Please check the details and try again.';

export interface ProfileValidationInput {
  name?: string | null;
  snoozeMinutes?: number | string | null;
  missedMinutes?: number | string | null;
  renudgeMinutes?: number | string | null;
}

export interface ValidationResult {
  isValid: boolean;
  error?: string;
  cleanName?: string;
  snoozeMinutes?: number;
  missedMinutes?: number;
}

export function validateProfileSettings(input: ProfileValidationInput): ValidationResult {
  const cleanName = (input.name ?? '').trim();
  if (!cleanName) {
    return {
      isValid: false,
      error: 'Please enter a name for this care profile.',
    };
  }

  if (
    input.snoozeMinutes === '' ||
    input.snoozeMinutes === null ||
    input.snoozeMinutes === undefined
  ) {
    return {
      isValid: false,
      error: 'Snooze duration must be between 5 and 120 minutes.',
    };
  }
  const snooze = Number(input.snoozeMinutes);
  if (!Number.isFinite(snooze) || !Number.isInteger(snooze) || snooze < 5 || snooze > 120) {
    return {
      isValid: false,
      error: 'Snooze duration must be between 5 and 120 minutes.',
    };
  }

  if (
    input.missedMinutes === '' ||
    input.missedMinutes === null ||
    input.missedMinutes === undefined
  ) {
    return {
      isValid: false,
      error: 'Missed dose cutoff must be between 30 and 720 minutes.',
    };
  }
  const missed = Number(input.missedMinutes);
  if (!Number.isFinite(missed) || !Number.isInteger(missed) || missed < 30 || missed > 720) {
    return {
      isValid: false,
      error: 'Missed dose cutoff must be between 30 and 720 minutes.',
    };
  }

  const renudgeRaw = Number(input.renudgeMinutes);
  const renudge = Number.isFinite(renudgeRaw) ? renudgeRaw : DEFAULT_RENUDGE_MINUTES;
  if (missed <= renudge) {
    return {
      isValid: false,
      error: `Missed must be greater than the re-nudge time (${renudge} minutes).`,
    };
  }

  return {
    isValid: true,
    cleanName,
    snoozeMinutes: snooze,
    missedMinutes: missed,
  };
}

export function getUpdateErrorMessage(
  error: { code?: string; message?: string } | null,
  rowsUpdated: number,
): string | null {
  if (error) {
    const isPermissionError =
      error.code === '42501' ||
      error.message?.toLowerCase().includes('permission') ||
      error.message?.toLowerCase().includes('policy') ||
      error.message?.toLowerCase().includes('violates row-level security');
    if (isPermissionError) {
      return PERMISSION_DENIED_MESSAGE;
    }
    return GENERIC_UPDATE_ERROR_MESSAGE;
  }

  if (rowsUpdated !== 1) {
    return PERMISSION_DENIED_MESSAGE;
  }

  return null;
}
