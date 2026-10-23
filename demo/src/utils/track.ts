import type { CSSProperties } from 'react';
import type { Email } from '../types';

export type SlotStatus = 'done' | 'current' | 'upcoming' | 'skipped' | 'offer' | 'rejected' | 'waiting';

export interface TrackSlot {
  icon: string; // Material Symbol
  label: string;
  status: SlotStatus;
  date?: string; // ISO, when it happened
}

const STEP_INFO = {
  assessment: { icon: 'assignment', label: 'Test' },
  interview: { icon: 'groups', label: 'Interview' },
} as const;

/**
 * Slots built from what actually happened in the application's emails:
 * Applied → first real step (test or interview) → the step after it (or a preview
 * of what usually comes next) → outcome, only once there is one (offer / rejected).
 */
export function trackSlots(emails: Email[]): TrackSlot[] {
  const sorted = [...emails].sort((a, b) => a.receivedAt.localeCompare(b.receivedAt));
  const firstOf = (stage: Email['stage']) => sorted.find((e) => e.stage === stage)?.receivedAt;

  // Distinct real steps, in the order they first appeared
  const steps: (keyof typeof STEP_INFO)[] = [];
  for (const e of sorted) {
    if ((e.stage === 'assessment' || e.stage === 'interview') && !steps.includes(e.stage)) steps.push(e.stage);
  }
  const rejected = sorted.some((e) => e.stage === 'rejected');
  const offer = sorted.some((e) => e.stage === 'offer');
  const decided = rejected || offer;

  const applied: TrackSlot = {
    icon: 'check',
    label: 'Applied',
    status: 'done',
    date: firstOf('applied') ?? sorted[0]?.receivedAt,
  };

  const real = (i: number): TrackSlot => {
    const isLast = i === steps.length - 1;
    return {
      ...STEP_INFO[steps[i]],
      status: isLast && !decided ? 'current' : 'done',
      date: firstOf(steps[i]),
    };
  };
  // Unknown next steps ('more_horiz') stay faint and unlabeled; known ones show as "likely next"
  const preview = (icon: string, label: string): TrackSlot => ({
    icon,
    label,
    status: decided ? 'skipped' : icon === 'more_horiz' ? 'waiting' : 'upcoming',
  });

  const second = steps[0] ? real(0) : preview('more_horiz', 'Next step');
  const third = steps[1]
    ? real(1)
    : steps[0] === 'assessment'
    ? preview('groups', 'Interview')
    : steps[0] === 'interview'
    ? preview('groups', 'Final')
    : preview('more_horiz', 'Next step');

  // The outcome only appears once there is one
  if (offer) return [applied, second, third, { icon: 'check', label: 'Offer', status: 'offer', date: firstOf('offer') }];
  if (rejected) {
    return [applied, second, third, { icon: 'close', label: 'Rejected', status: 'rejected', date: firstOf('rejected') }];
  }
  return [applied, second, third];
}

/** Look of each status: green = passed, blue + halo = now, grey = not yet */
export function slotStyle(status: SlotStatus): {
  circle: CSSProperties;
  size: 'lg' | 'md' | 'sm';
  label: string | null; // label color, null = hide label
  bold?: boolean;
  line: string; // color of the connector leading INTO this slot
} {
  const GREEN = '#137333';
  const BLUE = '#0b57d0';
  switch (status) {
    case 'done':
      return { circle: { backgroundColor: GREEN, color: '#fff' }, size: 'md', label: GREEN, line: GREEN };
    case 'current':
      return {
        circle: { backgroundColor: BLUE, color: '#fff', boxShadow: '0 0 0 4px #d3e3fd' },
        size: 'lg',
        label: BLUE,
        bold: true,
        line: GREEN,
      };
    case 'offer':
      return { circle: { backgroundColor: GREEN, color: '#fff' }, size: 'md', label: GREEN, bold: true, line: GREEN };
    case 'rejected':
      return { circle: { backgroundColor: '#b3261e', color: '#fff' }, size: 'md', label: '#b3261e', bold: true, line: '#e0e2ec' };
    case 'upcoming':
      return { circle: { backgroundColor: '#f1f3f4', color: '#9aa0a6' }, size: 'sm', label: '#9aa0a6', line: '#e0e2ec' };
    default: // skipped, waiting
      return { circle: { backgroundColor: '#f8f9fa', color: '#c4c7c5', boxShadow: 'inset 0 0 0 1px #e0e2ec' }, size: 'sm', label: null, line: '#e0e2ec' };
  }
}
