import React, { useState } from 'react';
import type { Application, Email } from '../types';
import { Icon } from './Icon';
import { CompanyLogo, StageTrack, DeadlineLane, EmptyLane, DayAxis, Chip, stageColor, timeLeft } from './Visuals';
import { TONES, type Tone } from '../theme';

type Section = Application['stage'];

// Columns: logo | company | stage | 7-day deadline lane (fills the width) | emails
const ROW_GRID = 'grid grid-cols-[24px_150px_300px_minmax(200px,1fr)_36px] items-center gap-4';

// Rendered like Gmail's category tabs (Primary / Promotions / Social)
const SECTIONS: { stage: Section; title: string; icon: string; tone: Tone }[] = [
  { stage: 'needs_action', title: 'Needs action', icon: 'schedule', tone: 'red' },
  { stage: 'in_progress', title: 'In progress', icon: 'hourglass_top', tone: 'blue' },
  { stage: 'closed', title: 'Closed', icon: 'archive', tone: 'grey' },
  { stage: 'ghosted', title: 'Ghosted', icon: 'person_off', tone: 'yellow' },
];

interface JobsBoardProps {
  applications: Application[];
  emails: Email[];
  searchQuery: string;
  onOpenEmail: (emailId: string) => void;
  onOpenFollowUp: (app: Application) => void;
}

export const JobsBoard: React.FC<JobsBoardProps> = ({
  applications,
  emails,
  searchQuery,
  onOpenEmail,
  onOpenFollowUp,
}) => {
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['app-palantir']));
  const [sectionFilter, setSectionFilter] = useState<Section | null>(null);
  const [view, setView] = useState<'list' | 'board'>('list');
  const [collapsed, setCollapsed] = useState<Set<Section>>(new Set());
  const toggleSection = (stage: Section) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(stage)) next.delete(stage);
      else next.add(stage);
      return next;
    });

  const q = searchQuery.toLowerCase();
  const visibleApps = applications.filter(
    (a) => !q || a.company.toLowerCase().includes(q) || a.role.toLowerCase().includes(q)
  );

  const appsIn = (stage: Section) => {
    const list = visibleApps.filter((a) => a.stage === stage);
    if (stage === 'needs_action') {
      return list.sort((a, b) => (a.deadline ?? '9999').localeCompare(b.deadline ?? '9999'));
    }
    return list.sort((a, b) => b.lastActivity.localeCompare(a.lastActivity));
  };

  const emailsFor = (appId: string) =>
    emails
      .filter((e) => e.applicationId === appId)
      .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));

  const toggle = (appId: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(appId)) next.delete(appId);
      else next.add(appId);
      return next;
    });

  const tabs: { key: Section | null; title: string; icon: string; tone: Tone }[] = [
    { key: null, title: 'All', icon: 'work', tone: 'blue' },
    ...SECTIONS.map((s) => ({ key: s.stage, title: s.title, icon: s.icon, tone: s.tone })),
  ];

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Gmail category tabs */}
      <div className="flex border-b border-[#e0e2ec] shrink-0 select-none overflow-x-auto font-gs">
        {tabs.map((t) => {
          const active = sectionFilter === t.key;
          const count = t.key ? visibleApps.filter((a) => a.stage === t.key).length : visibleApps.length;
          const accent = TONES[t.tone].fg;
          return (
            <button
              key={t.title}
              onClick={() => setSectionFilter(t.key)}
              className="relative flex items-center gap-4 h-14 pl-4 pr-4 min-w-[200px] text-sm cursor-pointer hover:bg-[#f2f6fc]"
              style={{ color: active ? accent : '#444746' }}
            >
              <Icon name={t.icon} size={20} fill={active} />
              <span className="font-medium">{t.title}</span>
              {count > 0 && t.key && <Chip tone={t.tone}>{count}</Chip>}
              {active && (
                <span className="absolute left-2 right-2 bottom-0 h-[3px] rounded-t-[3px]" style={{ backgroundColor: accent }} />
              )}
            </button>
          );
        })}

        {/* List / Board view toggle */}
        <div className="ml-auto flex items-center pr-4 pl-2 shrink-0">
          <div className="flex h-8 rounded-full border border-[#c4c7c5] overflow-hidden">
            {(
              [
                { key: 'list', icon: 'view_list', label: 'List view' },
                { key: 'board', icon: 'view_kanban', label: 'Board view' },
              ] as const
            ).map((v) => (
              <button
                key={v.key}
                onClick={() => setView(v.key)}
                title={v.label}
                aria-pressed={view === v.key}
                className={`w-11 flex items-center justify-center cursor-pointer ${
                  view === v.key ? 'bg-[#d3e3fd] text-[#041e49]' : 'text-[#444746] hover:bg-[#f2f6fc]'
                }`}
              >
                <Icon name={v.icon} size={20} fill={view === v.key} />
              </button>
            ))}
          </div>
        </div>
      </div>

      {view === 'board' ? (
        <KanbanView
          sections={KANBAN_ORDER.filter((s) => !sectionFilter || s.stage === sectionFilter)}
          appsIn={appsIn}
          emailsFor={emailsFor}
          onOpenEmail={onOpenEmail}
          onOpenFollowUp={onOpenFollowUp}
        />
      ) : (
        <>
      {/* Column headers so each row can be read across */}
      <div className={`${ROW_GRID} px-6 py-1.5 border-b border-[#f0f4f9] text-xs text-[#747775] shrink-0`}>
        <span />
        <span>Company</span>
        <span>Stage</span>
        <DayAxis />
        <Icon name="mail" size={16} title="Emails" />
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-auto">
        {SECTIONS.filter((s) => !sectionFilter || s.stage === sectionFilter).map((s) => {
          const apps = appsIn(s.stage);
          if (!apps.length) return null;
          return (
            <section key={s.stage}>
              {!sectionFilter && (
                // Gmail Priority Inbox style section header: grey band, chevron, large title
                <button
                  onClick={() => toggleSection(s.stage)}
                  className="sticky top-0 z-10 w-full bg-white border-t-[12px] border-[#f6f8fc] border-b border-b-[#e0e2ec] h-[68px] pl-3 pr-6 flex items-center gap-2 cursor-pointer text-left"
                >
                  <span className="w-10 h-10 flex items-center justify-center rounded-full text-[#444746] hover:bg-[#e8eaed]">
                    <Icon name={collapsed.has(s.stage) ? 'expand_more' : 'expand_less'} size={24} />
                  </span>
                  <span className="text-lg text-[#1f1f1f] font-gs">{s.title}</span>
                  <span className="ml-auto text-xs text-[#444746]">{apps.length}</span>
                </button>
              )}
              {/* Collapsing only applies on the All tab; a section's own tab always shows its rows */}
              {(sectionFilter || !collapsed.has(s.stage)) && apps.map((app) => (
                <ApplicationRow
                  key={app.id}
                  app={app}
                  emails={emailsFor(app.id)}
                  isExpanded={expanded.has(app.id)}
                  onToggle={() => toggle(app.id)}
                  onOpenEmail={onOpenEmail}
                  onOpenFollowUp={onOpenFollowUp}
                />
              ))}
            </section>
          );
        })}
      </div>
        </>
      )}
    </div>
  );
};

// Board view: one column per section, one small card per application
const KANBAN_ORDER = ['needs_action', 'in_progress', 'ghosted', 'closed'].map(
  (k) => SECTIONS.find((s) => s.stage === k)!
);

const KanbanView: React.FC<{
  sections: typeof SECTIONS;
  appsIn: (stage: Section) => Application[];
  emailsFor: (appId: string) => Email[];
  onOpenEmail: (emailId: string) => void;
  onOpenFollowUp: (app: Application) => void;
}> = ({ sections, appsIn, emailsFor, onOpenEmail, onOpenFollowUp }) => (
  <div className="flex-1 flex gap-3 p-4 overflow-x-auto overflow-y-hidden">
    {sections.map((s) => {
      const apps = appsIn(s.stage);
      return (
        <div key={s.stage} className="flex-1 min-w-[240px] max-w-[380px] flex flex-col bg-[#f6f8fc] rounded-2xl">
          <div className="flex items-center gap-2 px-4 h-12 font-gs text-sm font-medium" style={{ color: TONES[s.tone].fg }}>
            <Icon name={s.icon} size={20} />
            <span className="text-[#1f1f1f]">{s.title}</span>
            <span className="ml-auto">
              <Chip tone={s.tone}>{apps.length}</Chip>
            </span>
          </div>
          <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-2">
            {apps.map((app) => (
              <KanbanCard
                key={app.id}
                app={app}
                emails={emailsFor(app.id)}
                onOpenEmail={onOpenEmail}
                onOpenFollowUp={onOpenFollowUp}
              />
            ))}
          </div>
        </div>
      );
    })}
  </div>
);

const KanbanCard: React.FC<{
  app: Application;
  emails: Email[];
  onOpenEmail: (emailId: string) => void;
  onOpenFollowUp: (app: Application) => void;
}> = ({ app, emails, onOpenEmail, onOpenFollowUp }) => {
  const isClosed = app.stage === 'closed';
  const isGhosted = app.stage === 'ghosted';
  const hasGuardrail = emails.some((e) => e.decisionSource === 'guardrail_override');
  // Open the newest email that isn't an auto-reply
  const target = emails.find((e) => e.stage !== 'applied') ?? emails[0];
  const deadline = app.deadline && !isClosed ? timeLeft(app.lastActivity, app.deadline) : null;

  return (
    <div
      onClick={() => target && onOpenEmail(target.id)}
      title={app.currentStatus}
      className={`bg-white rounded-xl border border-[#e0e2ec] p-3 space-y-2.5 cursor-pointer hover:shadow-[0_1px_2px_0_rgba(60,64,67,.3),0_1px_3px_1px_rgba(60,64,67,.15)] ${
        isClosed ? 'opacity-60' : ''
      }`}
    >
      <div className="flex items-center gap-2.5">
        <CompanyLogo domain={app.domain} size={28} muted={isClosed || isGhosted} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="font-medium text-[#1f1f1f] truncate">{app.company}</span>
            {hasGuardrail && <Icon name="verified_user" size={16} className="text-[#137333]" title="Guardrail kept this in the inbox" />}
          </div>
          <div className="text-xs text-[#747775] truncate">{app.role}</div>
        </div>
      </div>

      <StageTrack emails={emails} faded={isClosed || isGhosted} compact />

      <div className="flex items-center justify-between h-6">
        {deadline ? (
          <Chip tone={deadline.tone} icon="schedule">
            {deadline.label} left
          </Chip>
        ) : isGhosted ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpenFollowUp(app);
            }}
            title="Draft a follow-up"
            className="cursor-pointer hover:brightness-95"
          >
            <Chip tone="yellow" icon="send">
              Follow up · {app.daysSinceLastActivity}d
            </Chip>
          </button>
        ) : (
          <span />
        )}
        <span className="flex items-center gap-1 text-xs text-[#747775]" title="Emails">
          <Icon name="mail" size={14} />
          {emails.length}
        </span>
      </div>
    </div>
  );
};

interface ApplicationRowProps {
  app: Application;
  emails: Email[];
  isExpanded: boolean;
  onToggle: () => void;
  onOpenEmail: (emailId: string) => void;
  onOpenFollowUp: (app: Application) => void;
}

const ApplicationRow: React.FC<ApplicationRowProps> = ({
  app,
  emails,
  isExpanded,
  onToggle,
  onOpenEmail,
  onOpenFollowUp,
}) => {
  const isClosed = app.stage === 'closed';
  const isGhosted = app.stage === 'ghosted';
  const hasGuardrail = emails.some((e) => e.decisionSource === 'guardrail_override');

  return (
    <div className={`border-b border-[#f2f4f8] ${isExpanded ? 'bg-[#f8fafd]' : ''}`}>
      <div
        onClick={onToggle}
        title={`${app.currentStatus} — ${app.role}`}
        className={`${ROW_GRID} px-6 py-2.5 cursor-pointer hover:bg-[#f2f6fc]`}
      >
        <CompanyLogo domain={app.domain} muted={isClosed || isGhosted} />

        <div className="min-w-0 flex items-center gap-2">
          <span className={`font-medium truncate ${isClosed ? 'text-[#747775]' : 'text-[#1f1f1f]'}`}>
            {app.company}
          </span>
          {hasGuardrail && <Icon name="verified_user" size={18} className="text-[#137333]" title="Guardrail kept this in the inbox" />}
        </div>

        <StageTrack emails={emails} faded={isClosed || isGhosted} />

        {app.deadline && !isClosed ? (
          <DeadlineLane startIso={app.lastActivity} deadlineIso={app.deadline} />
        ) : (
          <EmptyLane>
            {isGhosted && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenFollowUp(app);
                }}
                title={`No reply for ${app.daysSinceLastActivity} days. Draft a follow-up`}
                className="cursor-pointer hover:brightness-95"
              >
                <Chip tone="yellow" icon="send">
                  Follow up · {app.daysSinceLastActivity}d silent
                </Chip>
              </button>
            )}
          </EmptyLane>
        )}

        <div className="flex items-center gap-1 text-xs text-[#747775]" title="Emails">
          <Icon name="mail" size={14} />
          {emails.length}
        </div>
      </div>

      {isExpanded && (
        <div className="ml-[63px] mr-6 max-w-[720px] pb-3 border-l-2 border-[#e0e2ec]">
          {emails.map((m) => {
            const isAutoReply = m.stage === 'applied';
            return (
              <button
                key={m.id}
                onClick={() => onOpenEmail(m.id)}
                className="relative w-full flex items-center gap-3 pl-5 pr-2 py-1.5 text-left text-xs hover:bg-[#f2f6fc] rounded-r-lg cursor-pointer"
              >
                <span
                  className="absolute -left-[5px] w-2 h-2 rounded-full ring-2 ring-white"
                  style={{ backgroundColor: stageColor(m.stage) }}
                />
                <span className="w-12 text-[#747775] shrink-0 tabular-nums">
                  {new Date(m.receivedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
                <span className={`truncate flex-1 min-w-0 ${isAutoReply ? 'text-[#747775]' : 'text-[#1f1f1f] font-medium'}`}>
                  {isAutoReply ? 'Application confirmation email' : m.subject}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
