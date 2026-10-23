import React from 'react';
import type { Email } from '../types';
import { Icon } from './Icon';
import { trackSlots, slotStyle } from '../utils/track';

/** Large version of the board's stage track, with labels and dates */
export const ApplicationStepper: React.FC<{ emails: Email[] }> = ({ emails }) => {
  const slots = trackSlots(emails);

  return (
    <div className="w-full rounded-2xl border border-[#e0e2ec] px-6 py-4 select-none">
      <div className="flex items-start">
        {slots.map((slot, i) => {
          const next = slots[i + 1];
          const style = slotStyle(slot.status);
          return (
            <React.Fragment key={i}>
              <div className="flex flex-col items-center w-20 shrink-0">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center"
                  style={style.circle}
                >
                  <Icon name={slot.icon} size={18} />
                </div>
                <span
                  className={`text-xs mt-2 font-gs ${style.bold ? 'font-bold' : 'font-medium'}`}
                  style={{ color: style.label ?? '#9aa0a6' }}
                >
                  {slot.label}
                </span>
                <span className="text-[11px] text-[#747775] h-4">
                  {slot.date
                    ? new Date(slot.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                    : slot.status === 'upcoming'
                    ? 'likely next'
                    : ''}
                </span>
              </div>
              {next && <div className="flex-1 h-0.5 mt-4" style={{ backgroundColor: slotStyle(next.status).line }} />}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};
