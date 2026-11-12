// CI pipeline: every job of the latest successful GitHub Actions run, as cards.
import { chromium } from '@playwright/test';
import { stage, savePng, escapeHtml } from '../lib.mjs';

const REPO = 'narek-am/fullstack-test-automation';

// Plain-language group for each job, in display order. A job goes into the first group that
// matches, in the order of MATCH_ORDER (so "Security (API tests)" lands in Security, not API).
const GROUPS = [
  ['🧱 Code & API', /Unit|API|Contract/],
  ['🗄️ Data', /^Data/],
  ['🖥️ User interface', /^UI|Mobile/],
  ['👁️ Looks', /Visual/],
  ['🔒 Security', /^Security/],
  ['⚡ Speed', /Performance/],
  ['♿ Quality & resilience', /Accessibility|Chaos/],
];
const MATCH_ORDER = ['🔒 Security', '⚡ Speed', '♿ Quality & resilience', '👁️ Looks', '🖥️ User interface', '🗄️ Data', '🧱 Code & API'];
const groupOf = (job) => MATCH_ORDER.find((title) => GROUPS.find(([t]) => t === title)[1].test(job.name));

export default async function ci() {
  const api = (path) => fetch(`https://api.github.com/repos/${REPO}${path}`).then((r) => r.json());
  const { workflow_runs: runs } = await api('/actions/runs?status=success&per_page=1');
  const run = runs[0];
  const { jobs } = await api(`/actions/runs/${run.id}/jobs?per_page=50`);
  const seconds = (j) => Math.round((new Date(j.completed_at) - new Date(j.started_at)) / 1000);
  const duration = (s) => (s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`);

  const unmatched = jobs.filter((j) => !groupOf(j)).map((j) => j.name);
  if (unmatched.length) throw new Error(`jobs without a group: ${unmatched.join(', ')}`);
  const cards = GROUPS.map(([title]) => {
    const own = jobs.filter((j) => groupOf(j) === title).sort((a, b) => a.name.localeCompare(b.name));
    return `
      <div style="background:#111c33;border:1px solid #23314f;border-radius:12px;padding:12px 14px">
        <div style="font:700 16px system-ui;color:#f8fafc;margin-bottom:8px">${title}</div>
        ${own.map((j) => `
          <div style="display:flex;gap:8px;align-items:baseline;font:14px/1.35 system-ui;margin:6px 0">
            <span style="color:${j.conclusion === 'success' ? '#4ade80' : '#f87171'}">${j.conclusion === 'success' ? '✔' : '✖'}</span>
            <span style="color:#e2e8f0;flex:1">${escapeHtml(j.name)}</span>
            <span style="color:#64748b">${duration(seconds(j))}</span>
          </div>`).join('')}
      </div>`;
  });

  const browser = await chromium.launch();
  const { page, show } = await stage(browser, { width: 1000, height: 900 });
  await show(`<div id="card" style="background:#0f172a;padding-bottom:6px">
    <div style="padding:24px 30px 0;display:flex;justify-content:space-between;align-items:end">
      <div>
        <div style="font:700 26px system-ui;color:#f8fafc">🤖 Every change is checked by ${jobs.length} automated jobs</div>
        <div style="font:17px system-ui;color:#94a3b8;margin-top:6px">They run in parallel on GitHub Actions: Linux, macOS and an Android emulator</div>
      </div>
      <div style="font:700 18px system-ui;color:#4ade80">✔ all ${jobs.filter((j) => j.conclusion === 'success').length} passed</div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;padding:18px 30px">${cards.join('')}</div></div>`);
  await savePng(page.locator('#card'), 'ci-pipeline');
  console.log(`  from run ${run.html_url}`);
  await browser.close();
}
