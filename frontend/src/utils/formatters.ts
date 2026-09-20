/**
 * Formats any Date object, ISO string, or timestamp to 'Day/Month/Year' (e.g. 23/9/2026).
 */
export const formatDate = (date: Date | string | number | null | undefined): string => {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  const day = d.getDate();
  const month = d.getMonth() + 1;
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

/**
 * Standard date format string for react-datepicker: 'd/M/yyyy' -> e.g. 23/9/2026
 */
export const DATE_PICKER_FORMAT = 'd/M/yyyy';

/**
 * Formats a Date object to local 'YYYY-MM-DD' string without timezone skew.
 */
export const toISODateString = (date: Date | string | number | null | undefined): string => {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Formats a number as a comma-separated amount string.
 * e.g. 123456 → "123,456"   |   82650.5 → "82,650.5"
 * Uses en-US locale for consistent comma thousands separator.
 */
export const formatAmount = (value: number | string | null | undefined): string => {
  const num = parseFloat(String(value ?? 0));
  if (isNaN(num)) return '0';
  // Remove trailing zeros after decimal, keep up to 2 decimal places if needed
  return num.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
};
