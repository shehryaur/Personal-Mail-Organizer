import React from 'react';
import type { Email, Stage } from '../types';
import { SIMULATED_NOW } from '../utils/dateUtils';
import { STAGE_TONES, TONES, type Tone } from '../theme';
import { Icon } from './Icon';
import { trackSlots, slotStyle } from '../utils/track';

/**
 * Company logo from its domain. DuckDuckGo's icon service returns 404 when it has no
 * icon (Google's returns a generic globe), so the empty-slot fallback actually triggers.
 */
export const CompanyLogo: React.FC<{ domain: string; size?: number; muted?: boolean }> = ({
  domain,
  size = 24,
  muted,
}) => {
  const [failed, setFailed] = React.useState(false);
  return (
    <div className="shrink-0 flex items-center justify-center" style={{ width: size, height: size }}>
      {!failed && (
        <img
          src={`https://icons.duckduckgo.com/ip3/${domain}.ico`}
          alt=""
          width={size}
          height={size}
          onError={() => setFailed(true)}
          className={`rounded-md ${muted ? 'grayscale opacity-50' : ''}`}
        />
      )}
    </div>
  );
};

/** Tonal chip: light container + dark text, like Gmail labels */
export const Chip: React.FC<{
  tone: Tone;
  icon?: string;
  fill?: boolean;
  title?: string;
  /** 'label' = Gmail's small square-cornered label in list rows */
  shape?: 'pill' | 'label';
  children?: React.ReactNode;
}> = ({ tone, icon, fill, title, shape = 'pill', children }) => (
  <span
    title={title}
    className={`inline-flex items-center gap-1 whitespace-nowrap ${
      shape === 'label' ? 'h-5 px-1.5 rounded text-xs' : 'h-6 px-2.5 rounded-full text-xs font-medium'
    }`}
    style={{ backgroundColor: TONES[tone].bg, color: TONES[tone].fg }}
  >
    {icon && <Icon name={icon} size={shape === 'label' ? 14 : 16} fill={fill} />}
    {children}
  </span>
);

/**
 * Applied (check) → test or interview icon → next step → decision
 * (green check = offer, red ✕ = rejected, only once decided). Hover a circle for its name.
 */
export const StageTrack: React.FC<{ emails: Email[]; faded?: boolean; compact?: boolean }> = ({
  emails,
  faded,
  compact,
}) => {
  const slots = trackSlots(emails);
  const SIZES = { lg: [26, 16], md: [22, 14], sm: [20, 12] } as const;
  return (
    <div className={`flex items-center ${faded ? 'opacity-50' : ''}`}>
      {slots.map((slot, i) => {
        const style = slotStyle(slot.status);
        const [box, icon] = SIZES[style.size];
        return (
          <React.Fragment key={i}>
            {i > 0 && (
              <div className={`${compact ? 'w-2.5 mx-1' : 'w-4 mx-1.5'} h-0.5 rounded-full`} style={{ backgroundColor: style.line }} />
            )}
            <div
              className="flex items-center gap-1.5 shrink-0"
              title={slot.status === 'upcoming' ? `${slot.label} (likely next)` : slot.label}
            >
              <div
                className="rounded-full flex items-center justify-center"
                style={{ width: box, height: box, ...style.circle }}
              >
                <Icon name={slot.icon} size={icon} />
              </div>
              {style.label && !compact && (
                <span
                  className={`text-[13px] font-gs ${style.bold ? 'font-bold' : 'font-medium'}`}
                  style={{ color: style.label }}
                >
                  {slot.label}
                </span>
              )}
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
};

/** How much of the window between "email received" and "deadline" is left */
export function timeLeft(startIso: string, deadlineIso: string) {
  const start = new Date(startIso).getTime();
  const end = new Date(deadlineIso).getTime();
  const remainingMs = end - SIMULATED_NOW;
  const fraction = Math.max(0, Math.min(1, remainingMs / Math.max(1, end - start)));
  const hours = Math.max(0, Math.floor(remainingMs / 3600000));
  const label = hours >= 24 ? `${Math.floor(hours / 24)}d` : `${hours}h`;
  const tone: Tone = hours < 48 ? 'red' : hours < 120 ? 'yellow' : 'blue';
  return { fraction, label, tone, color: TONES[tone].fg, hours };
}

export const DeadlineBar: React.FC<{ startIso: string; deadlineIso: string; width?: number }> = ({
  startIso,
  deadlineIso,
  width = 80,
}) => {
  const { fraction, label, color } = timeLeft(startIso, deadlineIso);
  return (
    <div className="flex items-center gap-2 shrink-0">
      <div className="h-1 rounded-full bg-[#e0e2ec] overflow-hidden" style={{ width }}>
        <div className="h-full rounded-full" style={{ width: `${fraction * 100}%`, backgroundColor: color }} />
      </div>
      <span className="text-xs font-medium w-7 tabular-nums" style={{ color }}>
        {label}
      </span>
    </div>
  );
};

/** Shared time axis for the board: today on the left, AXIS_DAYS on the right */
export const AXIS_DAYS = 7;
const DAY_MS = 86400000;
const dayGrid = {
  backgroundImage: `repeating-linear-gradient(to right, #e0e2ec 0 1px, transparent 1px calc(100% / ${AXIS_DAYS}))`,
};

export const DayAxis: React.FC = () => {
  const labels = Array.from({ length: AXIS_DAYS }, (_, i) =>
    i === 0 ? 'Today' : new Date(SIMULATED_NOW + i * DAY_MS).toLocaleDateString('en-US', { weekday: 'short' })
  );
  return (
    <div className="grid h-full items-center" style={{ gridTemplateColumns: `repeat(${AXIS_DAYS}, 1fr)` }}>
      {labels.map((l) => (
        <span key={l} className="pl-1.5 border-l border-[#e0e2ec]">
          {l}
        </span>
      ))}
    </div>
  );
};

/** Bar from today to the deadline on the shared axis, with the time left at its end */
export const DeadlineLane: React.FC<{ startIso: string; deadlineIso: string }> = ({ startIso, deadlineIso }) => {
  const { label, color, hours } = timeLeft(startIso, deadlineIso);
  const pct = Math.min(100, (hours / 24 / AXIS_DAYS) * 100);
  return (
    <div className="relative h-7 flex items-center" style={dayGrid}>
      <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, minWidth: 6, backgroundColor: color }} />
      <span className="ml-2 text-xs font-medium tabular-nums" style={{ color }}>
        {label}
      </span>
      {pct >= 100 && <Icon name="arrow_forward" size={14} style={{ color }} />}
    </div>
  );
};

export const EmptyLane: React.FC<{ children?: React.ReactNode }> = ({ children }) => (
  <div className="relative h-7 flex items-center" style={dayGrid}>
    {children}
  </div>
);

export const ConfidenceRing: React.FC<{ value: number; size?: number }> = ({ value, size = 32 }) => {
  const stroke = 3;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const color = value >= 0.85 ? '#0b57d0' : TONES.yellow.fg;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} title="Confidence">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e0e2ec" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={`${value * c} ${c}`}
          strokeLinecap="round"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-medium text-[#1f1f1f]">
        {Math.round(value * 100)}
      </span>
    </div>
  );
};

export const stageColor = (stage: Stage) => TONES[STAGE_TONES[stage]].fg;
