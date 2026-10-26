// Which chat models does your provider actually answer right now? (Listed is not
// the same as callable: retired models can still appear in /v1/models.)
// Sends one tiny request per candidate model and prints the ones that work, fastest first.
//
//   PowerShell:  $env:AI_KEY = "<your key>";  node tests/probe-models.js
//   Optional:    $env:AI_BASE_URL (default NVIDIA)
const KEY = process.env.AI_KEY || process.env.NIM_KEY;
if (!KEY) {
  console.log('Set your key first:  $env:AI_KEY = "<your key>"');
  process.exit(1);
}
const BASE = (process.env.AI_BASE_URL || 'https://integrate.api.nvidia.com/v1').replace(/\/+$/, '');
// Chat models only: skip embeddings, vision, safety, reward, code and parsing models
const SKIP = /embed|retriev|vision|-vl|vlm|guard|safety|reward|parse|code|coder|diffusion|omni|reasoning|chatqa|recurrentgemma|minitron|-2b\b|gemma-2b|llama2|mixtral-8x22b-v0\.1/i;

async function main() {
  const list = await fetch(BASE + '/models', { headers: { Authorization: 'Bearer ' + KEY } }).then(r => r.json()).catch(() => null);
  const ids = ((list && list.data) || []).map(m => m.id).filter(id => !SKIP.test(id)).sort();
  if (!ids.length) {
    console.log('Could not read the model list from ' + BASE + '/models');
    process.exit(1);
  }
  console.log(`Testing ${ids.length} chat models at ${BASE} …\n`);

  const probe = async model => {
    const t0 = Date.now();
    try {
      const res = await fetch(BASE + '/chat/completions', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          temperature: 0,
          max_tokens: 40,
          messages: [{ role: 'user', content: 'Reply with only this JSON: {"category": "applied", "confidence": 0.9}' }],
        }),
        signal: AbortSignal.timeout(60000),
      });
      const text = await res.text();
      let reply = '';
      try { reply = JSON.parse(text).choices[0].message.content || ''; } catch { /* not a chat reply */ }
      return { model, code: res.status, ms: Date.now() - t0, json: /\{[\s\S]*"category"[\s\S]*\}/.test(reply), reply: reply.replace(/\s+/g, ' ').slice(0, 60) };
    } catch (e) {
      return { model, code: 'timeout/error', ms: Date.now() - t0, json: false, reply: String(e).slice(0, 60) };
    }
  };

  const results = [];
  let next = 0;
  const worker = async () => { while (next < ids.length) { const r = await probe(ids[next++]); results.push(r); process.stdout.write('.'); } };
  await Promise.all(Array.from({ length: 4 }, worker));
  process.stdout.write('\n\n');

  const ok = results.filter(r => r.code === 200 && r.json).sort((a, b) => a.ms - b.ms);
  const answeredOddly = results.filter(r => r.code === 200 && !r.json);
  const failed = results.filter(r => r.code !== 200);
  console.log('WORKS and returns clean JSON (fastest first):');
  ok.forEach(r => console.log(`  ${String(r.ms).padStart(6)} ms  ${r.model}`));
  if (answeredOddly.length) {
    console.log('\nAnswers, but not clean JSON (avoid):');
    answeredOddly.forEach(r => console.log(`  ${r.model}: ${r.reply}`));
  }
  console.log('\nNot available (' + failed.length + '): ' + failed.map(r => `${r.model} [${r.code}]`).join(', '));
}
main();
