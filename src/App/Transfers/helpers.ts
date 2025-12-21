// import moment from 'moment';
import camelCase from 'lodash/camelCase';
import startCase from 'lodash/startCase';
import groupBy from 'lodash/groupBy';
import ColorScheme from 'color-scheme';
import { TransferError } from './types';

// Format date as readable: "21/12/2025 08:22:47"
export function toTransfersDateReadable(ISODateString: string): string {
  if (!ISODateString) return '';

  const date = new Date(ISODateString);

  // Check if date is valid
  if (isNaN(date.getTime())) return ISODateString;

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');

  return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
}

// Format date as ISO with timezone: "2025-12-21T08:22:47+07:00"
export function toTransfersDateISO(ISODateString: string): string {
  if (!ISODateString) return '';

  const date = new Date(ISODateString);

  // Check if date is valid
  if (isNaN(date.getTime())) return ISODateString;

  // Get timezone offset in minutes and convert to hours:minutes format
  const offset = -date.getTimezoneOffset();
  const offsetHours = String(Math.floor(Math.abs(offset) / 60)).padStart(2, '0');
  const offsetMinutes = String(Math.abs(offset) % 60).padStart(2, '0');
  const offsetSign = offset >= 0 ? '+' : '-';

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');

  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}${offsetSign}${offsetHours}:${offsetMinutes}`;
}

// Main function that uses the format preference
export function toTransfersDate(ISODateString: string, format: 'readable' | 'iso' = 'iso'): string {
  return format === 'readable' ? toTransfersDateReadable(ISODateString) : toTransfersDateISO(ISODateString);
}

export function toSpacedPascalCase(str: string): string {
  return startCase(camelCase(str));
}

interface ErrorCount {
  value: number;
  label: string;
  color: string;
}
export function getErrorsByType(errors: TransferError[]): ErrorCount[] {
  const colors = generateColors();
  return Object.entries(groupBy(errors, 'errorType')).map(([type, items], index) => ({
    label: toSpacedPascalCase(type),
    value: items.length,
    color: colors[index % colors.length],
  }));
}

export function generateColors() {
  const scm = new ColorScheme();
  return scm
    .from_hue(370)
    .scheme('analogic')
    .distance(0.1)
    .variation('pastel')
    .colors()
    .map((color: string) => `#${color}`);
}
