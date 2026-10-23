// Gmail (Material 3) tokens. See DESIGN.md.
import type { Stage } from './types';

export const TONES = {
  red: { bg: '#fce8e6', fg: '#b3261e' },
  yellow: { bg: '#fef7e0', fg: '#b06000' },
  blue: { bg: '#d3e3fd', fg: '#0b57d0' },
  green: { bg: '#e6f4ea', fg: '#137333' },
  grey: { bg: '#f1f3f4', fg: '#444746' },
  purple: { bg: '#e8def8', fg: '#6750a4' },
} as const;

export type Tone = keyof typeof TONES;

export const STAGE_TONES: Record<Stage, Tone> = {
  applied: 'grey',
  assessment: 'yellow',
  interview: 'blue',
  rejected: 'red',
  offer: 'green',
  review: 'purple',
};

