import React, { useState } from 'react';
import type { Application } from '../types';
import { formatNiceDate } from '../utils/dateUtils';
import { X, Copy, Check, Send } from 'lucide-react';

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
    <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-lg w-full p-5 shadow-2xl text-left space-y-4">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded bg-orange-950 border border-orange-800 flex items-center justify-center text-orange-400">
              <Send className="w-3.5 h-3.5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-100">
                Contextual Follow-Up Draft
              </h3>
              <p className="text-xs text-slate-400 font-mono">
                {application.company} · {application.daysSinceLastActivity} days silent
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 cursor-pointer p-1 rounded hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Generated Email Template */}
        <div className="space-y-3 font-mono text-xs">
          <div>
            <label className="text-[10px] uppercase text-slate-500 font-semibold block mb-1">
              Subject
            </label>
            <div className="bg-slate-950 p-2.5 rounded border border-slate-800 text-slate-200 font-medium">
              {subject}
            </div>
          </div>

          <div>
            <label className="text-[10px] uppercase text-slate-500 font-semibold block mb-1">
              Generated Body
            </label>
            <div className="bg-slate-950 p-3 rounded border border-slate-800 text-slate-300 whitespace-pre-wrap leading-relaxed max-h-56 overflow-y-auto">
              {body}
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-800">
          <span className="text-[10px] font-mono text-slate-500">
            Anchored to last inbound email timestamp
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800 font-mono cursor-pointer transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white font-mono text-xs px-3.5 py-1.5 rounded cursor-pointer transition-colors font-medium shadow-sm"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied to Clipboard' : 'Copy Draft'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
