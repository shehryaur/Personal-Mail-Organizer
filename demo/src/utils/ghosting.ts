import type { Application, Email } from '../types';
import { SIMULATED_NOW } from './dateUtils';

/** An application is "ghosted" if it never got past "applied" and nothing arrived for this many days */
export const GHOSTED_AFTER_DAYS = 60;

const DAY_MS = 86400000;

export function applyGhostingRule(applications: Application[], emails: Email[]): Application[] {
  return applications.map((app) => {
    const appEmails = emails.filter((e) => e.applicationId === app.id);
    const lastEmail = appEmails.reduce(
      (latest, e) => (e.receivedAt > latest ? e.receivedAt : latest),
      app.lastActivity
    );
    const days = Math.floor((SIMULATED_NOW - new Date(lastEmail).getTime()) / DAY_MS);
    const onlyApplied = appEmails.length > 0 && appEmails.every((e) => e.stage === 'applied');

    let stage = app.stage;
    if (stage !== 'closed') {
      if (onlyApplied && days >= GHOSTED_AFTER_DAYS) stage = 'ghosted';
      else if (stage === 'ghosted') stage = 'in_progress';
    }
    return { ...app, stage, daysSinceLastActivity: days };
  });
}
