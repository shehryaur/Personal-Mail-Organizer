/**
 * Date Range Presets & LocalStorage Key Constants
 * Scoped for the Personal Mail Organizer Dashboard.
 *
 * Separated from DateRangeControls.tsx to comply with React Fast Refresh:
 * component files must only export React components to enable HMR.
 */

export const RANGES = [
  { key: '7', label: '1 week', days: 7 },
  { key: '30', label: '1 month', days: 30 },
  { key: '90', label: '3 months', days: 90 },
  { key: '365', label: '1 year', days: 365 },
  { key: 'all', label: 'All', days: 0 },
] as const;

export type Range = (typeof RANGES)[number]['key'] | 'custom';
export type RangePreset = (typeof RANGES)[number];

export const RANGE_KEY = 'trackerRange';
export const FROM_KEY = 'trackerCustomFrom';
export const TO_KEY = 'trackerCustomTo';
