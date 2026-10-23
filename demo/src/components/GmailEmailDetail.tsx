import React, { useState } from 'react';
import type { Email, DeterministicRule } from '../types';
import { getCountdown, formatNiceDate } from '../utils/dateUtils';
import {
  ArrowLeft,
  Star,
  Clock,
  ShieldCheck,
  ShieldAlert,
  Archive,
  Reply,
  Forward,
  CheckCircle2,
  Sliders,
} from 'lucide-react';

interface GmailEmailDetailProps {
  email: Email;
  onBack: () => void;
  onToggleStar: () => void;
  onAddRule: (rule: DeterministicRule) => void;
}

export const GmailEmailDetail: React.FC<GmailEmailDetailProps> = ({
  email,
  onBack,
  onToggleStar,
  onAddRule,
}) => {
  const [showRuleForm, setShowRuleForm] = useState(false);
  const [ruleInput, setRuleInput] = useState(`domain:${email.senderDomain}`);
  const [ruleToast, setRuleToast] = useState<string | null>(null);

  const countdown = email.deadlineResolved ? getCountdown(email.deadlineResolved) : null;
  const isGuardrailOverride = email.decisionSource === 'guardrail_override';

  const handleSynthesizeRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ruleInput) return;

    const newRule: DeterministicRule = {
      id: `rule-${Date.now()}`,
      name: `Guardrail for ${email.company}`,
      type: 'keyword',
      pattern: ruleInput,
      targetStage: email.stage,
      action: 'star_inbox',
      matchesCount: 1,
      createdFromCorrection: true,
    };

    onAddRule(newRule);
    setRuleToast(`Saved deterministic rule: "${ruleInput}"`);
    setShowRuleForm(false);
    setTimeout(() => setRuleToast(null), 3500);
  };

  return (
    <div className="flex-1 bg-white flex flex-col h-full overflow-hidden select-text">
      {/* Detail Top Navigation Toolbar */}
      <div className="h-12 px-4 border-b border-[#f2f4f8] flex items-center justify-between shrink-0 bg-[#fbfcfe]">
        <div className="flex items-center gap-2">
          <button
            onClick={onBack}
            className="p-2 rounded-full hover:bg-[#eaebef] text-[#444746] transition-colors cursor-pointer"
            title="Back to list"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <button
            onClick={onToggleStar}
            className="p-2 rounded-full hover:bg-[#eaebef] text-[#444746] transition-colors cursor-pointer"
            title="Star email"
          >
            <Star
              className={`w-5 h-5 ${
                email.isStarred ? 'fill-[#f4b400] text-[#f4b400]' : 'text-[#747775]'
              }`}
            />
          </button>
          <button
            className="p-2 rounded-full hover:bg-[#eaebef] text-[#444746] transition-colors cursor-pointer"
            title="Archive"
          >
            <Archive className="w-5 h-5" />
          </button>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-[#5e5e5e]">
          <span>Received {formatNiceDate(email.receivedAt)}</span>
        </div>
      </div>

      {/* Main Email Body & AI Triage Inspector Card */}
      <div className="flex-1 overflow-y-auto p-6 max-w-4xl mx-auto w-full space-y-6">
        {/* Rule Saved Toast */}
        {ruleToast && (
          <div className="bg-[#e6f4ea] border border-[#ceead6] text-[#137333] px-4 py-2.5 rounded-lg flex items-center gap-2 text-xs font-medium animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 text-[#137333] shrink-0" />
            <span>{ruleToast}</span>
          </div>
        )}

        {/* Minimalist "AI Reads, Code Decides" Triage Card */}
        <div className="bg-[#f8fafd] border border-[#d3e3fd] rounded-xl p-4 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#0b57d0]" />
              <span className="text-xs font-semibold text-[#041e49]">
                Triage Card: AI Reads · Code Decides
              </span>
            </div>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-[#eaf1fb] text-[#0b57d0]">
              {(email.confidence * 100).toFixed(0)}% Confidence
            </span>
          </div>

          {/* Key Parameters */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="bg-white p-2.5 rounded-lg border border-[#e0e2ec]">
              <span className="text-[10px] uppercase text-[#747775] font-semibold block mb-0.5">
                Stage Classification
              </span>
              <span className="font-semibold text-[#1f1f1f] capitalize">{email.stage}</span>
            </div>

            <div className="bg-white p-2.5 rounded-lg border border-[#e0e2ec]">
              <span className="text-[10px] uppercase text-[#747775] font-semibold block mb-0.5">
                Action Taken by Code
              </span>
              <span className="font-semibold text-[#0b57d0]">
                {email.actionNeeded ? 'Starred & Kept in Inbox' : 'Archived (No Action Required)'}
              </span>
            </div>

            <div className="bg-white p-2.5 rounded-lg border border-[#e0e2ec]">
              <span className="text-[10px] uppercase text-[#747775] font-semibold block mb-0.5">
                Relative Deadline
              </span>
              {countdown && !countdown.isPassed ? (
                <div className="flex items-center gap-1 font-semibold text-[#b06000]">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{countdown.text}</span>
                </div>
              ) : (
                <span className="text-[#747775]">No deadline detected</span>
              )}
            </div>
          </div>

          {/* Mathematical Resolution for Relative Dates */}
          {email.deadlineRaw && (
            <div className="bg-white p-2.5 rounded-lg border border-[#fce8b2] text-xs font-mono text-[#444746] flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="text-[#b06000] font-semibold">"{email.deadlineRaw}"</span>
                <span className="text-[#747775]">
                  {' '}
                  resolved from email arrival ({formatNiceDate(email.receivedAt)}) →{' '}
                </span>
                <strong className="text-[#137333] font-semibold">
                  Due {formatNiceDate(email.deadlineResolved || '')}
                </strong>
              </div>
            </div>
          )}

          {/* Safety Guardrail Alert (Stripe Example) */}
          {isGuardrailOverride && (
            <div className="bg-[#fce8e6] border border-[#f5c2c7] p-3 rounded-lg text-xs text-[#c5221f] space-y-1">
              <div className="flex items-center gap-1.5 font-semibold">
                <ShieldAlert className="w-4 h-4 text-[#c5221f]" />
                <span>Deterministic Guardrail Overrode AI</span>
              </div>
              <p className="text-[11px] leading-relaxed text-[#5e5e5e]">
                {email.guardrailNote}
              </p>
            </div>
          )}

          {/* Quick Guardrail Synthesizer Toggle */}
          <div className="pt-2 border-t border-[#e0e2ec]/60 flex items-center justify-between text-xs">
            <span className="text-[#747775]">
              Rule: <code className="text-[#1f1f1f] bg-white px-1.5 py-0.5 rounded border border-[#dadce0]">{email.ruleMatched}</code>
            </span>
            <button
              onClick={() => setShowRuleForm(!showRuleForm)}
              className="text-[#0b57d0] hover:underline flex items-center gap-1 font-medium cursor-pointer"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>{showRuleForm ? 'Close Rule' : 'Add Permanent Rule'}</span>
            </button>
          </div>

          {showRuleForm && (
            <form onSubmit={handleSynthesizeRule} className="pt-2 flex items-center gap-2">
              <input
                type="text"
                value={ruleInput}
                onChange={(e) => setRuleInput(e.target.value)}
                placeholder="e.g. domain:@company.com"
                className="flex-1 px-3 py-1.5 bg-white border border-[#c2e7ff] rounded text-xs font-mono text-[#1f1f1f] outline-none focus:ring-1 focus:ring-[#0b57d0]"
              />
              <button
                type="submit"
                className="px-3 py-1.5 bg-[#0b57d0] text-white rounded text-xs font-medium cursor-pointer hover:bg-[#0842a0] transition-colors"
              >
                Save Guardrail
              </button>
            </form>
          )}
        </div>

        {/* Email Header Info */}
        <div className="border-b border-[#f2f4f8] pb-4">
          <h2 className="text-xl font-normal text-[#1f1f1f] mb-4">{email.subject}</h2>

          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#e8def8] text-[#4a4458] flex items-center justify-center font-semibold text-base">
                {email.company.charAt(0)}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-[#1f1f1f]">{email.company}</span>
                  <span className="text-xs text-[#747775]">&lt;{email.from}&gt;</span>
                </div>
                <div className="text-xs text-[#747775]">to me</div>
              </div>
            </div>

            <span className="text-xs text-[#747775] font-mono">
              {formatNiceDate(email.receivedAt)}
            </span>
          </div>
        </div>

        {/* Plain Text Body */}
        <div className="text-sm text-[#1f1f1f] whitespace-pre-wrap leading-relaxed font-sans py-2">
          {email.fullBody}
        </div>

        {/* Reply / Forward Buttons */}
        <div className="pt-6 border-t border-[#f2f4f8] flex items-center gap-3">
          <button className="px-5 py-2 border border-[#747775] hover:bg-[#f8fafd] text-[#444746] rounded-full text-xs font-medium flex items-center gap-2 cursor-pointer transition-colors">
            <Reply className="w-4 h-4" />
            <span>Reply</span>
          </button>
          <button className="px-5 py-2 border border-[#747775] hover:bg-[#f8fafd] text-[#444746] rounded-full text-xs font-medium flex items-center gap-2 cursor-pointer transition-colors">
            <Forward className="w-4 h-4" />
            <span>Forward</span>
          </button>
        </div>
      </div>
    </div>
  );
};
