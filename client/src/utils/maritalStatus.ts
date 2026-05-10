// Marital-status options shown in the AddPerson / EditPerson forms.
// Stored as plain text in `persons.marital_status`; values are the canonical
// English keys so we can localize the labels later without a DB migration.
export const MARITAL_STATUSES = [
  { value: 'married',   label: 'Женат/Замужем' },
  { value: 'divorced',  label: 'Разведен(-а)' },
  { value: 'separated', label: 'Не проживают совместно' },
  { value: 'widowed',   label: 'Смерть супруга(-и)' },
  { value: 'engaged',   label: 'Помолвлен(-а)' },
  { value: 'spouse',    label: 'Супруг(-а)' },
  { value: 'dating',    label: 'Встречаются' },
  { value: 'annulled',  label: 'Признание брака недействительным' },
  { value: 'unknown',   label: 'Неизвестное' },
  { value: 'other',     label: 'Другое' },
] as const;

export type MaritalStatus = typeof MARITAL_STATUSES[number]['value'];

export const maritalStatusLabel = (value: string | null | undefined): string | null => {
  if (!value) return null;
  return MARITAL_STATUSES.find((s) => s.value === value)?.label ?? value;
};
