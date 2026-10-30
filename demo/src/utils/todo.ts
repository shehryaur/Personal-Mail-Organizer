// Is this email asking me to do something? Only these become to-dos: take an
// assessment, schedule/attend an interview, finish an application, send
// documents or information, sign or answer an offer. Receipts, rejections,
// surveys, "thanks for completing" and "thanks for interviewing" never are.
import type { Email } from '../types';

// Already done, or nothing left to do
const DONE = /thank(?:s| you) for (?:completing|submitting|taking|your time|interviewing|meeting|speaking|attending)|you(?:'ve|’ve| have) (?:completed|submitted|finished)|(?:has|have) been (?:completed|submitted|received)|successfully (?:completed|submitted)|\bexpired\b|no longer (?:available|active|open)|(?:was|has been) cancel+ed/i;
const SURVEY = /\bsurvey\b|feedback|share your (?:experience|thoughts)|rate (?:your|us)|how did we do/i;
// A live interview being set up, confirmed or held
const INTERVIEW_ASK = /schedul|\bbook\b|\bpick\b|select (?:a|your)|choose (?:a|your)|availab|\bconfirm|invit|calendly|goodtime|zoom\.us|meet\.google|teams\.microsoft|reschedul|appointment|let(?:'s|’s| us) (?:chat|talk|connect|meet)|\bcall\b|interview (?:on|at|with|for)|reminder|tomorrow|next round|coffee chat|\bchat\b|einladung|vorstellungsgespr|entrevista|entretien|colloquio/i;
// Something specific I have to send, answer or finish for an application
const OTHER_ASK = /incomplete|complete your (?:application|profile)|finish (?:your|the) application|started your (?:job )?application|\bdraft\b|\bmissing\b|additional (?:information|documents?)|please (?:provide|upload|submit|send|complete|fill|sign|confirm|reply|respond|share|let us know)|let (?:us|me) know|\breferences?\b|background check|\bsign\b|signature|questionnaire|action required|required documents|transcripts?|paperwork|onboarding|\bi-9\b|work authori[sz]ation|sponsorship|start date|availability|portfolio|writing sample/i;

export function asksForAction(e: Email): boolean {
  const text = `${e.subject} ${e.snippet}`;
  if (DONE.test(text) || SURVEY.test(text)) return false;
  switch (e.stage) {
    case 'assessment':
    case 'offer':
      return true;
    case 'interview':
      return INTERVIEW_ASK.test(text);
    case 'other':
      return OTHER_ASK.test(text);
    case 'review':
      return !!e.deadlineResolved;
    default:
      return false;
  }
}
