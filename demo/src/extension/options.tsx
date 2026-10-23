// Settings: the Apps Script web app URL, the feed token and the InboxSDK App ID.
// Stored in chrome.storage.local (this browser only, never synced).
import React, { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../index.css';
import { Icon } from '../components/Icon';
import { getFeed, type Settings } from './messages';

type Status = { kind: 'idle' } | { kind: 'busy' } | { kind: 'ok'; text: string } | { kind: 'error'; text: string };

const ERROR_TEXT: Record<string, string> = {
  not_configured: 'Fill in the web app URL and the feed token.',
  unauthorized: 'The web app answered, but the token is wrong. Copy it again from the Apps Script log.',
  bad_response: 'That URL didn’t return data. Use the web app URL (ends in /exec) and set access to “Anyone”.',
  network: 'Couldn’t reach the web app. Check the URL and your connection.',
};

const Field: React.FC<{
  label: string;
  hint: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  secret?: boolean;
}> = ({ label, hint, value, onChange, placeholder, secret }) => {
  const [show, setShow] = useState(false);
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium font-gs">{label}</span>
      <div className="flex items-center h-11 rounded-lg border border-[#c4c7c5] focus-within:border-[#0b57d0] focus-within:border-2 px-3 gap-2 bg-white">
        <input
          type={secret && !show ? 'password' : 'text'}
          value={value}
          onChange={e => onChange(e.target.value.trim())}
          placeholder={placeholder}
          spellCheck={false}
          className="flex-1 min-w-0 outline-none text-sm"
        />
        {secret && (
          <button type="button" onClick={() => setShow(!show)} title={show ? 'Hide' : 'Show'} className="text-[#444746] cursor-pointer">
            <Icon name={show ? 'visibility_off' : 'visibility'} size={20} />
          </button>
        )}
      </div>
      <span className="block text-xs text-[#747775]">{hint}</span>
    </label>
  );
};

const Options: React.FC = () => {
  const [s, setS] = useState<Settings>({ webAppUrl: '', token: '', appId: '' });
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  useEffect(() => {
    chrome.storage.local.get(['webAppUrl', 'token', 'appId']).then((v: Settings) =>
      setS({ webAppUrl: v.webAppUrl || '', token: v.token || '', appId: v.appId || '' })
    );
  }, []);

  const save = async () => {
    setStatus({ kind: 'busy' });
    await chrome.storage.local.set(s);
    const res = await getFeed(false);
    if (res.ok && res.feed) {
      const n = (res.feed.items || []).length;
      setStatus({
        kind: 'ok',
        text: `Connected. ${n} job email${n === 1 ? '' : 's'} in your tracker.` +
          (s.appId ? ' Reload Gmail to see Jobs Board in the sidebar.' : ' Add the InboxSDK App ID to show it in Gmail.'),
      });
    } else {
      setStatus({ kind: 'error', text: ERROR_TEXT[res.error || ''] || `Error: ${res.error}` });
    }
  };

  return (
    <div className="min-h-screen bg-[#f6f8fc] py-10 px-4 overflow-auto" style={{ height: '100vh' }}>
      <div className="max-w-xl mx-auto bg-white rounded-2xl p-6 space-y-5">
        <div className="flex items-center gap-3">
          <Icon name="work" size={28} fill className="text-[#0b57d0]" />
          <h1 className="text-[22px] font-gs">Jobs Board settings</h1>
        </div>
        <Field
          label="Apps Script web app URL"
          hint="Deploy → Manage deployments → Web app URL (ends in /exec)."
          value={s.webAppUrl || ''}
          onChange={v => setS({ ...s, webAppUrl: v })}
          placeholder="https://script.google.com/macros/s/…/exec"
        />
        <Field
          label="Feed token"
          hint="Printed in the Apps Script log when you run setup(). Keep it private."
          value={s.token || ''}
          onChange={v => setS({ ...s, token: v })}
          placeholder="64 characters"
          secret
        />
        <Field
          label="InboxSDK App ID"
          hint="From inboxsdk.com → your app. Starts with sdk_."
          value={s.appId || ''}
          onChange={v => setS({ ...s, appId: v })}
          placeholder="sdk_…"
        />
        <div className="flex items-center gap-3 pt-1">
          <button
            onClick={save}
            disabled={status.kind === 'busy'}
            className="h-10 px-6 shrink-0 whitespace-nowrap rounded-full bg-[#0b57d0] hover:bg-[#0842a0] text-white text-sm font-medium cursor-pointer disabled:opacity-60"
          >
            {status.kind === 'busy' ? 'Testing…' : 'Save & test connection'}
          </button>
          {status.kind === 'ok' && (
            <span className="flex items-center gap-1 text-sm text-[#137333]">
              <Icon name="check_circle" size={18} fill /> {status.text}
            </span>
          )}
          {status.kind === 'error' && (
            <span className="flex items-center gap-1 text-sm text-[#b3261e]">
              <Icon name="error" size={18} /> {status.text}
            </span>
          )}
        </div>
        <p className="text-xs text-[#747775] border-t border-[#f0f4f9] pt-4">
          These settings stay in this browser only. The token only lets this extension read your own tracker sheet.
        </p>
      </div>
    </div>
  );
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Options />
  </StrictMode>
);
