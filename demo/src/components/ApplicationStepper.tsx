import React from 'react';
import type { Stage } from '../types';
import { Check, Clock, ShieldAlert } from 'lucide-react';

interface ApplicationStepperProps {
  stage: Stage;
  appliedDate: string;
  currentEventDate?: string;
  isGuardrailOverride?: boolean;
}

export const ApplicationStepper: React.FC<ApplicationStepperProps> = ({
  stage,
  appliedDate,
  currentEventDate,
  isGuardrailOverride,
}) => {
  const steps = [
    { id: 'applied', label: 'Applied', date: appliedDate },
    { id: 'assessment', label: 'Assessment', date: stage === 'assessment' ? currentEventDate : undefined },
    { id: 'interview', label: 'Interview', date: stage === 'interview' ? currentEventDate : undefined },
    { id: 'offer', label: 'Decision', date: undefined },
  ];

  const getStepStatus = (stepId: string) => {
    if (stage === 'rejected') {
      if (stepId === 'applied') return 'completed';
      return 'neutral';
    }

    const order = ['applied', 'assessment', 'interview', 'offer'];
    const currentIndex = order.indexOf(stage === 'review' ? 'assessment' : stage);
    const stepIndex = order.indexOf(stepId);

    if (stepIndex < currentIndex) return 'completed';
    if (stepIndex === currentIndex) return 'current';
    return 'upcoming';
  };

  return (
    <div className="w-full bg-[#f8fafd] border border-[#e0e2ec] rounded-xl p-3 select-none">
      <div className="text-[11px] font-medium text-[#444746] uppercase tracking-wider mb-2 flex items-center justify-between">
        <span>Application Pipeline Checkpoints</span>
        {isGuardrailOverride && (
          <span className="flex items-center gap-1 text-[10px] font-semibold text-[#1967d2] bg-[#e8f0fe] px-2 py-0.5 rounded-full border border-[#aecbfa]">
            <ShieldAlert className="w-3 h-3 text-[#1967d2]" />
            <span>Guardrail Active</span>
          </span>
        )}
      </div>

      <div className="flex items-center justify-between relative">
        {/* Connecting Line Track */}
        <div className="absolute top-3.5 left-4 right-4 h-0.5 bg-[#e0e2ec] z-0" />

        {steps.map((step, idx) => {
          const status = getStepStatus(step.id);
          const isCompleted = status === 'completed';
          const isCurrent = status === 'current';

          return (
            <div key={step.id} className="relative z-10 flex flex-col items-center group">
              {/* Node Circle */}
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-all duration-300 ${
                  isCompleted
                    ? 'bg-[#137333] text-white shadow-xs'
                    : isCurrent
                    ? 'bg-[#0b57d0] text-white ring-4 ring-[#c2e7ff] shadow-sm'
                    : 'bg-white border-2 border-[#c4c7c5] text-[#747775]'
                }`}
              >
                {isCompleted ? (
                  <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                ) : isCurrent ? (
                  <Clock className="w-3.5 h-3.5 stroke-[2.5] animate-pulse" />
                ) : (
                  <span>{idx + 1}</span>
                )}
              </div>

              {/* Step Label */}
              <span
                className={`text-xs mt-1.5 font-medium transition-colors ${
                  isCurrent
                    ? 'text-[#0b57d0] font-bold'
                    : isCompleted
                    ? 'text-[#1f1f1f]'
                    : 'text-[#747775]'
                }`}
              >
                {step.label}
              </span>

              {/* Step Subtitle / Date */}
              {step.date && (
                <span className="text-[10px] text-[#747775] font-mono mt-0.5">
                  {step.date}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
