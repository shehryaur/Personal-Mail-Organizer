import React, { useState } from 'react';
import type { Application, Email, DeterministicRule } from '../types';
import { getCountdown, formatNiceDate } from '../utils/dateUtils';
import {
  ShieldAlert,
  Cpu,
  Terminal,
  Calendar,
  CheckCircle2,
  Sliders,
  Plus,
} from 'lucide-react';

interface AuditInspectorPaneProps {
  application: Application | null;
  selectedEmail: Email | null;
  rules: DeterministicRule[];
  onAddRule: (rule: DeterministicRule) => void;
  onStageChange: (appId: string, newStage: Application['stage']) => void;
}

export const AuditInspectorPane: React.FC<AuditInspectorPaneProps> = ({
  application,
  selectedEmail,
  rules,
  onAddRule,
  onStageChange,
}) => {
  const [showRuleCreator, setShowRuleCreator] = useState(false);
  const [newRulePattern, setNewRulePattern] = useState('');
  const [ruleCreatedToast, setRuleCreatedToast] = useState<string | null>(null);

  if (!application) {
    return (
      <div className="w-96 border-l border-slate-800 bg-slate-950 p-6 flex flex-col items-center justify-center text-slate-500 text-xs shrink-0">
        <Cpu className="w-8 h-8 text-slate-700 mb-2" />
        <p>Select an email or application to inspect the decision audit trail.</p>
      </div>
    );
  }

  const primaryEmail = selectedEmail || application.emails[0];
  const countdown = application.deadline ? getCountdown(application.deadline) : null;
  const isGuardrailOverride = primaryEmail?.decisionSource === 'guardrail_override';

  const handleSynthesizeRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRulePattern) return;

    const newRule: DeterministicRule = {
      id: `rule-custom-${Date.now()}`,
      name: `User Rule: ${application.company} Override`,
      type: 'keyword',
      pattern: newRulePattern,
      targetStage: primaryEmail?.stage || 'assessment',
      action: 'star_inbox',
      matchesCount: 1,
      createdFromCorrection: true,
    };

    onAddRule(newRule);
    setRuleCreatedToast(`Synthesized rule: "${newRulePattern}" → ${primaryEmail?.stage}`);
    setShowRuleCreator(false);
    setNewRulePattern('');

    setTimeout(() => {
      setRuleCreatedToast(null);
    }, 4000);
  };

  return (
    <div className="w-96 border-l border-slate-800 bg-slate-950 flex flex-col h-full shrink-0 overflow-y-auto">
      {/* Pane Top Bar */}
      <div className="p-3 border-b border-slate-800 bg-slate-900/90 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-300">
          <Terminal className="w-4 h-4 text-emerald-400" />
          <span>Decision Audit Trail</span>
        </div>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800/60 font-semibold">
          AI Reads · Code Decides
        </span>
      </div>

      <div className="p-4 space-y-4 text-left">
        {/* Toast Alert */}
        {ruleCreatedToast && (
          <div className="bg-emerald-950 border border-emerald-700 text-emerald-300 text-xs p-2.5 rounded-lg flex items-center gap-2 animate-fadeIn font-mono">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{ruleCreatedToast}</span>
          </div>
        )}

        {/* SECTION 1: Entity Target Header */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-bold text-slate-100">{application.company}</span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
              {application.role}
            </span>
          </div>

          {/* Manual Stage Adjustment / Guardrail Learner Trigger */}
          <div className="mt-2.5 pt-2 border-t border-slate-800">
            <div className="text-[10px] font-mono uppercase text-slate-400 mb-1.5 flex items-center justify-between">
              <span>Operational Stage</span>
              <span className="text-slate-500">Click to re-classify</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5 text-[11px] font-mono">
              <button
                onClick={() => onStageChange(application.id, 'needs_action')}
                className={`px-2 py-1 rounded text-center cursor-pointer transition-colors ${
                  application.stage === 'needs_action'
                    ? 'bg-rose-950 text-rose-300 border border-rose-800 font-bold'
                    : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                Needs Action
              </button>
              <button
                onClick={() => onStageChange(application.id, 'in_progress')}
                className={`px-2 py-1 rounded text-center cursor-pointer transition-colors ${
                  application.stage === 'in_progress'
                    ? 'bg-blue-950 text-blue-300 border border-blue-800 font-bold'
                    : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                In Progress
              </button>
              <button
                onClick={() => onStageChange(application.id, 'ghosted')}
                className={`px-2 py-1 rounded text-center cursor-pointer transition-colors ${
                  application.stage === 'ghosted'
                    ? 'bg-orange-950 text-orange-300 border border-orange-800 font-bold'
                    : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                Likely Ghosted
              </button>
              <button
                onClick={() => onStageChange(application.id, 'closed')}
                className={`px-2 py-1 rounded text-center cursor-pointer transition-colors ${
                  application.stage === 'closed'
                    ? 'bg-slate-700 text-slate-200 border border-slate-600 font-bold'
                    : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                Archived
              </button>
            </div>
          </div>
        </div>

        {/* SECTION 2: Relative Deadline Resolution Box */}
        {application.deadline && (
          <div className="bg-slate-900/90 border border-amber-900/50 rounded-lg p-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-400 mb-1.5">
              <Calendar className="w-3.5 h-3.5 text-amber-400" />
              <span>Relative Deadline Resolution Engine</span>
            </div>

            <div className="space-y-1.5 text-[11px] font-mono">
              <div className="bg-slate-950 p-2 rounded border border-slate-800">
                <span className="text-slate-500">Raw Phrase:</span>{' '}
                <strong className="text-amber-300">"{application.deadlineRaw}"</strong>
              </div>

              <div className="text-[11px] text-slate-400 space-y-0.5 pl-1">
                <div>
                  <span className="text-slate-500">Anchor Timestamp:</span>{' '}
                  <span className="text-slate-300">{formatNiceDate(application.lastActivity)}</span>
                </div>
                <div>
                  <span className="text-slate-500">Computed Due Date:</span>{' '}
                  <span className="text-emerald-400 font-semibold">{formatNiceDate(application.deadline)}</span>
                </div>
              </div>

              {countdown && (
                <div className="pt-1.5 border-t border-slate-800/80 flex items-center justify-between text-xs">
                  <span className="text-slate-400">Live Remaining:</span>
                  <span className="font-bold text-amber-400 px-2 py-0.5 rounded bg-amber-950 border border-amber-800">
                    {countdown.text}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* SECTION 3: Guardrail Override Deep-Dive (Palantir Evaluation Highlight) */}
        {isGuardrailOverride && (
          <div className="bg-amber-950/40 border border-amber-600/70 rounded-lg p-3 space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
              <ShieldAlert className="w-4 h-4 text-amber-400" />
              <span>AI Failure Mode Caught by Safety Rule</span>
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed font-mono">
              {primaryEmail.guardrailNote}
            </p>
            <div className="bg-slate-950 p-2 rounded border border-amber-800/60 text-[10px] font-mono space-y-1">
              <div className="text-rose-400 line-through">
                ✖ Naive LLM Suggestion: Stage = "rejected" (archived)
              </div>
              <div className="text-emerald-400 font-bold">
                ✔ Guardrail Decision: Detected Calendly link → "interview" (starred in inbox)
              </div>
            </div>
          </div>
        )}

        {/* SECTION 4: Raw Email Snippet with Extraction Highlights */}
        {primaryEmail && (
          <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-300">Inspecting Message Snippet</span>
              <span className="text-[10px] font-mono text-slate-500">
                Confidence: {(primaryEmail.confidence * 100).toFixed(0)}%
              </span>
            </div>

            <div className="bg-slate-950 p-2.5 rounded border border-slate-800 text-[11px] text-slate-300 font-mono whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
              {primaryEmail.fullBody}
            </div>

            <div className="text-[11px] font-mono text-slate-400 pt-1">
              <span className="text-slate-500">Decision Source:</span>{' '}
              <span className="font-semibold text-blue-400 uppercase">{primaryEmail.decisionSource}</span>
              <div className="text-[10px] text-slate-400 mt-0.5 truncate" title={primaryEmail.ruleMatched || ''}>
                {primaryEmail.ruleMatched}
              </div>
            </div>
          </div>
        )}

        {/* SECTION 5: Human-in-the-Loop Active Guardrail Synthesizer */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-200">
              <Sliders className="w-3.5 h-3.5 text-blue-400" />
              <span>Guardrail Synthesizer</span>
            </div>
            <button
              onClick={() => setShowRuleCreator(!showRuleCreator)}
              className="text-[11px] text-blue-400 hover:text-blue-300 font-mono flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3 h-3" />
              <span>{showRuleCreator ? 'Cancel' : 'New Rule'}</span>
            </button>
          </div>

          <p className="text-[11px] text-slate-400 font-mono mb-2">
            Turn manual corrections into deterministic rules so AI never repeats errors.
          </p>

          {showRuleCreator && (
            <form onSubmit={handleSynthesizeRule} className="space-y-2 pt-2 border-t border-slate-800">
              <input
                type="text"
                placeholder="e.g. sender:@palantir.com or keyword:'interview'"
                value={newRulePattern}
                onChange={(e) => setNewRulePattern(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-200 font-mono placeholder-slate-600 focus:outline-none focus:border-blue-500"
              />
              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-mono text-xs py-1 rounded cursor-pointer transition-colors font-medium"
              >
                Synthesize Deterministic Guardrail
              </button>
            </form>
          )}

          {/* Active Rules Mini List */}
          <div className="space-y-1.5 mt-2">
            {rules.map((rule) => (
              <div
                key={rule.id}
                className="text-[10px] font-mono bg-slate-950 p-1.5 rounded border border-slate-800 flex items-center justify-between"
              >
                <div className="truncate max-w-[210px]">
                  <span className="font-semibold text-slate-300">{rule.name}</span>
                  <div className="text-slate-500 truncate">{rule.pattern}</div>
                </div>
                <span className="px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 shrink-0">
                  {rule.matchesCount} hits
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
