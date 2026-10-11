// Run the analysis steps for a song: node tools/analyze.mjs <slug> [stems] [beats] [lyrics]
// With no steps named, runs all three in order. Extra flags pass through (e.g. --ft, --whisper small).
import { spawnSync } from 'node:child_process';

const [slug, ...rest] = process.argv.slice(2);
if (!slug) { console.error('usage: node tools/analyze.mjs <slug> [stems|beats|lyrics ...] [flags]'); process.exit(1); }
const steps = rest.filter(s => ['stems', 'beats', 'lyrics'].includes(s));
const flags = rest.filter(s => !steps.includes(s));
for (const step of steps.length ? steps : ['stems', 'beats', 'lyrics']) {
  console.log(`\n== ${step} ==`);
  const r = spawnSync('uv', ['run', '--project', '.', 'python', `${step}.py`, slug, ...flags], { cwd: 'analysis', stdio: 'inherit' });
  if (r.status !== 0) process.exit(r.status ?? 1);
}
