// Diagnostic: runs the dashboard's own feed + board code over a Sheet export
// and prints the To do list and the counts, so they can be checked by hand.
// Usage (from demo/): npx rolldown scripts/todo-report.ts -o ../data/todo-report.mjs --platform node && node ../data/todo-report.mjs ../data/tracker.csv
import { readFileSync } from 'node:fs';
import { adaptFeed, type FeedItem } from '../src/extension/feed';
import { buildBoard } from '../src/utils/board';

function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; } else if (c === '"') quoted = false; else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.length > 1) rows.push(row);
      row = [];
    } else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const head = rows.shift()!.map(h => h.trim().toLowerCase().replace(/\s+/g, '_'));
  return rows.map(r => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])));
}

const file = process.argv[2];
const items = parseCsv(readFileSync(file, 'utf8').replace(/^﻿/, '')) as unknown as FeedItem[];
const now = Date.now();
const { applications } = adaptFeed(items, now);
const board = buildBoard(applications, now);
console.log('Counts: ' + board.counts.map(c => `${c.label} ${c.count} (${c.note})`).join(' | '));
console.log(`To do: ${board.tasks.length}`);
board.tasks.forEach(t => {
  const e = t.card.app.emails.find(x => x.id === t.card.openEmailId)!;
  console.log(`- [${t.when}] ${t.card.app.company} | ${e.stage} | ${e.subject.slice(0, 90)} | ${e.receivedAt.slice(0, 10)}`);
});
