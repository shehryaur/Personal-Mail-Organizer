import React, { useState } from 'react';
import type { Application } from '../types';
import { formatNiceDate } from '../utils/dateUtils';
import { Icon } from './Icon';

interface FollowUpModalProps {
  application: Application | null;
  onClose: () => void;
}

export const FollowUpModal: React.FC<FollowUpModalProps> = ({ application, onClose }) => {
  const [copied, setCopied] = useState(false);

  if (!application) return null;

  const subject = `Following up: ${application.role} application – Shehryar`;
  const body = `Hi ${application.company} Recruiting Team,

I hope you are having a productive week.

I wanted to briefly follow up on my application for the ${application.role} position submitted on ${formatNiceDate(
    application.lastActivity
  )}.

I remain very excited about ${application.company}'s work and would welcome the opportunity to discuss how my background in high-density product design and AI workflows can support your team.

Please let me know if there are any additional materials or portfolio walk-throughs I can provide.

Best regards,
Shehryar`;

  const handleCopy = () => {
    navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white border border-[#e0e2ec] rounded-2xl max-w-lg w-full p-5 shadow-2xl text-left space-y-4">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-[#f0f4f9] pb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded bg-[#fef7e0] flex items-center justify-center text-[#b06000]">
              <Icon name="send" size={14} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[#1f1f1f]">
                Contextual Follow-Up Draft
              </h3>
              <p className="text-xs text-[#747775]">
                {application.company} · {application.daysSinceLastActivity} days silent
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#444746] cursor-pointer p-1 rounded-full hover:bg-[#eaebef] transition-colors"
          >
            <Icon name="close" size={16} />
          </button>
        </div>

        {/* Generated Email Template */}
        <div className="space-y-3 text-xs">
          <div>
            <label className="text-[10px] uppercase text-[#747775] font-semibold block mb-1">
              Subject
            </label>
            <div className="bg-[#f8fafd] p-2.5 rounded-lg border border-[#e0e2ec] text-[#1f1f1f] font-medium">
              {subject}
            </div>
          </div>

          <div>
            <label className="text-[10px] uppercase text-[#747775] font-semibold block mb-1">
              Generated Body
            </label>
            <div className="bg-[#f8fafd] p-3 rounded-lg border border-[#e0e2ec] text-[#1f1f1f] whitespace-pre-wrap leading-relaxed max-h-56 overflow-y-auto">
              {body}
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-[#f0f4f9]">
          <span className="text-[10px] text-[#747775]">
            Anchored to last inbound email timestamp
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-full text-xs text-[#0b57d0] hover:bg-[#f1f3f4] cursor-pointer transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 bg-[#0b57d0] hover:bg-[#0842a0] text-white text-xs px-4 py-1.5 rounded-full cursor-pointer transition-colors font-medium shadow-sm"
            >
              {copied ? <Icon name="check" size={14} className="text-white" /> : <Icon name="content_copy" size={14} />}
              <span>{copied ? 'Copied to Clipboard' : 'Copy Draft'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
