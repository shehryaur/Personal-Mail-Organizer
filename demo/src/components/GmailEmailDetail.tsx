import React, { useState } from 'react';
import type { Email, DeterministicRule, Application } from '../types';
import { getCountdown, formatNiceDate } from '../utils/dateUtils';
import { ApplicationStepper } from './ApplicationStepper';
import { ConfidenceRing, Chip, timeLeft } from './Visuals';
import { STAGE_TONES } from '../theme';
import { Icon } from './Icon';

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

interface GmailEmailDetailProps {
  email: Email;
  application?: Application;
  onBack: () => void;
  onToggleStar: () => void;
  onAddRule: (rule: DeterministicRule) => void;
}

export const GmailEmailDetail: React.FC<GmailEmailDetailProps> = ({
  email,
  application,
  onBack,
  onToggleStar,
  onAddRule,
}) => {
  const [showRuleForm, setShowRuleForm] = useState(false);
  const [ruleInput, setRuleInput] = useState(`domain:${email.senderDomain}`);
  const [ruleToast, setRuleToast] = useState<string | null>(null);

  const countdown = email.deadlineResolved ? getCountdown(email.deadlineResolved) : null;
  const isGuardrailOverride = email.decisionSource === 'guardrail_override';
  const deadline = email.deadlineResolved ? timeLeft(email.receivedAt, email.deadlineResolved) : null;

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
      {/* Top Navigation Toolbar */}
      <div className="h-12 px-6 border-b border-[#f2f4f8] flex items-center justify-between shrink-0 bg-[#fbfcfe]">
        <div className="flex items-center gap-2">
          <button
            onClick={onBack}
            className="p-2 rounded-full hover:bg-[#eaebef] text-[#444746] transition-colors cursor-pointer"
            title="Back to inbox"
          >
            <Icon name="arrow_back" size={20} />
          </button>
          <button
            onClick={onToggleStar}
            className="p-2 rounded-full hover:bg-[#eaebef] text-[#444746] transition-colors cursor-pointer"
            title="Star email"
          >
            <Icon name="star" size={20} fill={email.isStarred} className={email.isStarred ? 'text-[#f4b400]' : 'text-[#444746]'} />
          </button>
          <button
            className="p-2 rounded-full hover:bg-[#eaebef] text-[#444746] transition-colors cursor-pointer"
            title="Archive"
          >
            <Icon name="archive" size={20} />
          </button>
        </div>

        <div className="flex items-center gap-2 text-xs text-[#5e5e5e]">
          <span>Received {formatNiceDate(email.receivedAt)}</span>
        </div>
      </div>

      {/* Main Container */}
      <div className="flex-1 overflow-y-auto px-8 py-6 max-w-4xl mx-auto w-full space-y-6">
        {/* Rule Saved Toast */}
        {ruleToast && (
          <div className="bg-[#e6f4ea] border border-[#ceead6] text-[#137333] px-4 py-2.5 rounded-lg flex items-center gap-2 text-xs font-medium animate-fadeIn">
            <Icon name="check_circle" size={16} className="text-[#137333] shrink-0" />
            <span>{ruleToast}</span>
          </div>
        )}

        {/* 1. Logistics-Style Pipeline Stepper (Checkpoint Flow) */}
        <ApplicationStepper emails={application?.emails ?? [email]} />

        {/* 2. Decision at a glance: confidence · stage · who decided · what happened */}
        <div className="rounded-2xl border border-[#e0e2ec] p-4 space-y-4">
          <div className="flex items-center gap-2 flex-wrap text-xs font-medium">
            <ConfidenceRing value={email.confidence} />
            <Chip tone={STAGE_TONES[email.stage]} icon="label">
              <span className="capitalize">{email.stage}</span>
            </Chip>
            <Chip
              tone="grey"
              icon={email.decisionSource === 'ai' ? 'auto_awesome' : 'code'}
              title={email.ruleMatched ?? undefined}
            >
              {email.decisionSource === 'ai' ? 'AI' : 'Rule'}
            </Chip>
            <Chip tone="grey" icon={email.actionNeeded ? 'inbox' : 'archive'}>
              {email.actionNeeded ? 'Kept in inbox' : 'Archived'}
            </Chip>
            <button
              onClick={() => setShowRuleForm(!showRuleForm)}
              title="Save as permanent rule"
              className="ml-auto w-9 h-9 flex items-center justify-center rounded-full text-[#444746] hover:bg-[#eaebef] cursor-pointer"
            >
              <Icon name="tune" size={20} />
            </button>
          </div>

          {/* Guardrail: AI said one thing, code overruled it */}
          {isGuardrailOverride && (
            <div className="flex items-center gap-2 flex-wrap" title={email.guardrailNote}>
              <Chip tone="red" icon="auto_awesome">
                <span className="line-through">AI: rejected</span>
              </Chip>
              <Icon name="arrow_forward" size={18} className="text-[#747775]" />
              <Chip tone="green" icon="verified_user">
                Calendly link
              </Chip>
              <Icon name="arrow_forward" size={18} className="text-[#747775]" />
              <Chip tone="blue" icon="label">
                Interview
              </Chip>
            </div>
          )}

          {/* Relative deadline: received ──── now ──── due */}
          {email.deadlineResolved && countdown && !countdown.isPassed && (
            <div title={`"${email.deadlineRaw}"`}>
              <div className="relative h-2 rounded-full bg-[#f1f3f4]">
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-[#dadce0]"
                  style={{ width: `${(1 - deadline!.fraction) * 100}%` }}
                />
                <div
                  className="absolute -top-1 w-4 h-4 rounded-full border-2 border-white shadow"
                  style={{ left: `calc(${(1 - deadline!.fraction) * 100}% - 8px)`, backgroundColor: deadline!.color }}
                />
              </div>
              <div className="flex justify-between mt-2 text-[11px] text-[#747775]">
                <span className="flex items-center gap-1">
                  <Icon name="mail" size={12} /> {shortDate(email.receivedAt)}
                </span>
                <span className="font-semibold" style={{ color: deadline!.color }}>
                  {countdown.text}
                </span>
                <span className="flex items-center gap-1 font-semibold text-[#1f1f1f]">
                  <Icon name="flag" size={12} /> {shortDate(email.deadlineResolved)}
                </span>
              </div>
            </div>
          )}

          {showRuleForm && (
            <form onSubmit={handleSynthesizeRule} className="pt-2 flex items-center gap-2">
              <input
                type="text"
                value={ruleInput}
                onChange={(e) => setRuleInput(e.target.value)}
                placeholder="e.g. domain:@company.com"
                className="flex-1 px-3 py-1.5 bg-white border border-[#c2e7ff] rounded-lg text-xs text-[#1f1f1f] outline-none focus:ring-2 focus:ring-[#0b57d0]"
              />
              <button
                type="submit"
                className="px-4 py-1.5 bg-[#0b57d0] text-white rounded-lg text-xs font-medium cursor-pointer hover:bg-[#0842a0] transition-colors shadow-2xs"
              >
                Save Guardrail
              </button>
            </form>
          )}
        </div>

        {/* 3. Real Email Header Info */}
        <div className="border-b border-[#f2f4f8] pb-4">
          <h2 className="text-[22px] leading-7 font-normal text-[#1f1f1f] mb-4 font-gs">{email.subject}</h2>

          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#c2e7ff] text-[#001d35] flex items-center justify-center font-bold text-base shadow-2xs">
                {email.company.charAt(0)}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-[#1f1f1f]">{email.company}</span>
                  <span className="text-xs text-[#747775]">
                    &lt;{email.from.match(/<([^>]+)>/)?.[1] ?? email.from}&gt;
                  </span>
                </div>
                <div className="text-xs text-[#747775]">to me</div>
              </div>
            </div>

            <span className="text-xs text-[#747775]">
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
            <Icon name="reply" size={16} />
            <span>Reply</span>
          </button>
          <button className="px-5 py-2 border border-[#747775] hover:bg-[#f8fafd] text-[#444746] rounded-full text-xs font-medium flex items-center gap-2 cursor-pointer transition-colors">
            <Icon name="forward" size={16} />
            <span>Forward</span>
          </button>
        </div>
      </div>
    </div>
  );
};
