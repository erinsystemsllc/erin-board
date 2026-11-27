/* Erin board — GitHub PR sync (Linear-style), read side.
 * PR events: GitHub webhook → Supabase Edge Function → table public.github_prs (setup: project doc claude/erin-board-github.md).
 * The board reads that table through Claude Data live sharing. One person shares the board's "Supabase" connector,
 * and a new share replaces the old one, so the share here also carries TeLog's queries (copied from telog-reports.js).
 * If you change a TeLog query there, change it here too — and add GH_SQL to telog-reports.js so a share from TeLog keeps GitHub.
 * index.html loads this file and calls window.ErinGitHub(E). If it throws, only the GitHub parts disappear.
 */
window.ErinGitHub = function(E){
'use strict';
const {h, S, render, toast, canWrite, transition, wfOf, projOf, isDone, writeIssue} = E;
const ARTIFACT = '4ebf8737-9594-4ea1-8999-5491704bc645';
const PROJECT = 'uolosxbouaksdxdmeoxp';
const GH_SQL = "select issue_key, repo, number, title, state, draft, merged, url, author, head_ref, checks, review_state, updated_at::text as updated_at from public.github_prs where updated_at > now() - interval '120 days' order by updated_at desc limit 1000";

// TeLog's shared queries, exactly as telog-reports.js shares them.
const DATE = {type:'string', pattern:'^[0-9]{4}-[0-9]{2}-[0-9]{2}$'};
const TQ = {
  emp: {sql:"select id, first_name, last_name, coalesce(nullif(team, ''), 'Unassigned') as team from public.employees order by 4, 2, 3"},
  time: {sql:"select employee_id, issue_key, work_date::text as d, sum(minutes)::int as m from public.time_entries where work_date between '{{start}}'::date and '{{end}}'::date group by 1, 2, 3", rules:{start:DATE, end:DATE}},
  hol: {sql:"select holiday_date::text as d, name from public.holidays where holiday_date between '{{start}}'::date and '{{end}}'::date order by 1", rules:{start:DATE, end:DATE}},
  ent: {sql:"select work_date::text as d, issue_key, minutes, coalesce(comment, '') as comment from public.time_entries where employee_id = {{emp}} and work_date between '{{start}}'::date and '{{end}}'::date order by work_date, created_at", rules:{emp:{type:'integer', minimum:1}, start:DATE, end:DATE}},
  me: {sql:"select id from public.employees where email = '{{email}}'", rules:{email:{type:'string', pattern:'^[a-z0-9._%+-]+@[a-z0-9.-]+$'}}}
};
const callOf = (sql, rules) => Object.assign({tool:'execute_sql', kind:'call', args:{project_id:PROJECT, query:sql}}, rules ? {rules} : {});
const ghCall = () => callOf(GH_SQL);

const G = {rows:null, at:0, err:'', busy:false, shareBusy:false, off:false};
try { G.off = localStorage.getItem('erinGhAutoOff') === '1'; } catch(e){}
const cl = window.claude;
const use = (n) => (cl && cl.use ? cl.use(n) : Promise.resolve(null));
const mcpP = use('mcp');

if (!document.getElementById('gh-css')){
  const st = document.createElement('style'); st.id = 'gh-css';
  st.textContent = '.gh-pr{display:flex;gap:.5rem;align-items:flex-start;font-size:.8125rem}.gh-pr .gh-b{min-width:0;flex:1}.gh-pr a{color:var(--fg);font-weight:500;text-decoration:none;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.gh-pr a:hover{text-decoration:underline}'
    + '.gh-st{display:inline-flex;align-items:center;height:1.25rem;padding:0 .4375rem;border-radius:9999px;font-size:.6875rem;font-weight:600;flex:none;white-space:nowrap}'
    + '.gh-st.open{background:#dcfce7;color:#166534}.gh-st.draft{background:var(--muted);color:var(--fg3)}.gh-st.merged{background:#ede9fe;color:#5b21b6}.gh-st.closed{background:#fee2e2;color:#991b1b}'
    + 'html[data-theme="dark"] .gh-st.open{background:#23402a;color:#9fe0ad}html[data-theme="dark"] .gh-st.merged{background:#3a2d52;color:#d4bdf7}html[data-theme="dark"] .gh-st.closed{background:#4a2326;color:#f5a3a3}';
  document.head.append(st);
}

function rowsOf(c){
  if (!c || !c.ok) return null;
  let t = (c.structuredContent && typeof c.structuredContent.result === 'string') ? c.structuredContent.result : (c.content || []).map(b => (b && b.text) || '').join('\n');
  try { const o = JSON.parse(t); if (o && typeof o.result === 'string') t = o.result; } catch(e){ /* plain text */ }
  const m = /<untrusted-data-[^>]*>\s*(\[[\s\S]*?\])\s*<\/untrusted-data-/.exec(t);
  try { const v = JSON.parse(m ? m[1] : t); return Array.isArray(v) ? v : []; } catch(e){ return null; }
}
function refresh(force){
  if (G.busy || !S.db) return;
  if (!force && G.at && Date.now() - G.at < 120000) return;
  G.busy = true;
  mcpP.then(mcp => { if (!mcp) throw {code:'no_mcp'}; return mcp.callTool('Claude Data', 'get_live_results', {artifact:ARTIFACT, calls:[Object.assign({connector:'Supabase'}, ghCall())]}, {cache:false}); })
    .then(r => { const c = ((r && r.payload && r.payload.calls) || [])[0]; if (c && c.ok){ const rows = rowsOf(c); G.rows = rows || []; G.err = rows ? '' : 'unreadable'; } else { G.rows = null; G.err = (c && c.error && c.error.code) || 'not_shared'; } })
    .catch(e => { G.rows = null; G.err = (e && e.code) || 'error'; })
    .then(() => { G.at = Date.now(); G.busy = false; autoApply(); render(); });
}
async function share(){
  if (G.shareBusy) return; G.shareBusy = true; render();
  try {
    const mcp = await mcpP; if (!mcp) throw {code:'no_mcp', message:'Connectors are not available here.'};
    const perms = await use('permissions');
    if (perms && perms.request){
      const st = await perms.request(['mcp:Supabase', 'mcp:Claude Data']).catch(() => null);
      if (st && (st['mcp:Supabase'] === 'denied' || st['mcp:Claude Data'] === 'denied')) throw {code:'denied', message:'Allow Supabase and Claude Data for this board, then try again.'};
    }
    const calls = Object.keys(TQ).map(k => callOf(TQ[k].sql, TQ[k].rules)).concat([ghCall()]);
    await mcp.callTool('Claude Data', 'share_live_queries', {artifact:ARTIFACT, connector:'Supabase', calls}, {cache:false});
    toast('Shared. Everyone now sees PR status on work items (TeLog reports stay shared too).');
  } catch(e){ toast('Not shared (' + ((e && e.code) || 'error') + '): ' + ((e && e.message) || '')); }
  G.shareBusy = false; G.at = 0; refresh(true); render();
}
const stateOf = (r) => r.merged ? 'merged' : r.state === 'closed' ? 'closed' : r.draft ? 'draft' : 'open';
const SL = {open:'Open', draft:'Draft', merged:'Merged', closed:'Closed'};
const CK = {success:'✓ checks passed', failure:'✗ checks failed', pending:'● checks running'};
const RV = {approved:'approved', changes_requested:'changes requested'};
function prsFor(key){ return (G.rows || []).filter(r => String(r.issue_key || '').toUpperCase() === key); }
function prRow(r){
  const st = stateOf(r), url = /^https:\/\//.test(r.url || '') ? r.url : null;
  return h('div', {class:'gh-pr'}, h('span', {class:'gh-st ' + st, text:SL[st]}),
    h('div', {class:'gh-b'}, url ? h('a', {href:url, target:'_blank', rel:'noopener', title:r.title || '', text:r.title || ('#' + r.number)}) : h('span', {text:r.title || ''}),
      h('div', {class:'hint', text:[(r.repo || '') + '#' + r.number, r.author ? '@' + r.author : '', CK[r.checks] || '', RV[r.review_state] || ''].filter(Boolean).join(' · ')})));
}
function prSection(it){
  refresh();
  const rows = prsFor(it.key);
  const head = h('p', {class:'sec-title', style:'margin:0', text:'Pull requests' + (rows.length ? ' (' + rows.length + ')' : '')});
  if (!G.rows){
    if (!G.at) return h('div', null, head, h('p', {class:'hint', text:'Loading…'}));
    return h('div', null, head, h('p', {class:'hint', text: ['not_shared', 'not_approved'].includes(G.err) ? 'GitHub isn\'t connected yet (Settings › GitHub).' : 'Couldn\'t load GitHub (' + G.err + ').'}));
  }
  return h('div', {style:'display:flex;flex-direction:column;gap:.375rem'}, head, rows.length ? rows.map(prRow) : h('p', {class:'hint', text:'No PRs yet. Put ' + it.key + ' in the branch name or PR title.'}));
}
function prBadge(key){
  const rows = prsFor(key); if (!rows.length) return null;
  const r = rows[0], st = stateOf(r);
  return h('span', {class:'gh-st ' + st, title:(r.repo || '') + '#' + r.number + ' · ' + SL[st] + (r.checks ? ' · ' + (CK[r.checks] || r.checks) : ''), text:SL[st] + (rows.length > 1 ? ' +' + (rows.length - 1) : '')});
}
// Linear-style: PR opened (not draft) while In Progress → Review; PR merged while in Review → next step. Once per PR.
function autoApply(){
  if (!G.rows || G.off || !canWrite() || !S.uid) return;
  const by = new Map();
  G.rows.forEach(r => { const k = String(r.issue_key || '').toUpperCase(); if (!k) return; if (!by.has(k)) by.set(k, []); by.get(k).push(r); });
  for (const [k, rs] of by){
    const it = S.issues.get(k); if (!it || isDone(it.status)) continue;
    const done = Array.isArray(it.ghAuto) ? it.ghAuto : [];
    const cols = wfOf(projOf(it)).cols, nxt = cols[cols.indexOf('review') + 1];
    const merged = rs.find(r => r.merged), open = rs.find(r => stateOf(r) === 'open');
    if (merged && it.status === 'review' && nxt){ const tag = merged.repo + '#' + merged.number + ':merged'; if (!done.includes(tag) && transition(k, nxt)) writeIssue(k, {ghAuto:[...done, tag].slice(-20)}); }
    else if (open && it.status === 'in_progress'){ const tag = open.repo + '#' + open.number + ':open'; if (!done.includes(tag) && transition(k, 'review')) writeIssue(k, {ghAuto:[...done, tag].slice(-20)}); }
  }
}
function settingsSection(){
  refresh();
  const ro = !canWrite();
  const status = G.rows ? G.rows.length + ' PRs loaded' + (G.at ? ' · updated ' + new Date(G.at).toLocaleTimeString() : '') : !G.at ? 'Checking…' : ['not_shared', 'not_approved'].includes(G.err) ? 'Not shared yet.' : 'Not loading (' + G.err + ').';
  const auto = h('input', {type:'checkbox', disabled:ro}); auto.checked = !G.off;
  auto.addEventListener('change', () => { G.off = !auto.checked; try { localStorage.setItem('erinGhAutoOff', G.off ? '1' : '0'); } catch(e){} render(); });
  return h('section', {class:'set-sec', id:'github'}, h('h2', {text:'GitHub'}),
    h('p', {class:'lead', text:'PRs from the LMS and EEA repos reach this board through a GitHub webhook that writes to the Supabase table github_prs (TeLog project). Put the work item key (LMS-123, EEA-45) in the branch name or PR title. Setup steps: project doc "erin-board-github".'}),
    h('div', {class:'set-row'}, h('div', {class:'grow'}, h('div', {text:'PR data'}), h('div', {class:'sub', text:status})),
      h('button', {class:'btn sm', text:'Refresh', onclick:() => refresh(true)}),
      ro ? null : h('button', {class:'btn sm primary', disabled:G.shareBusy, text:G.shareBusy ? 'Sharing…' : 'Share Supabase data', title:'Shares the GitHub query and the TeLog queries together, run with your Supabase access', onclick:share})),
    h('div', {class:'set-row'}, h('label', {style:'display:flex;align-items:center;gap:.5rem'}, auto, 'Move my board\'s work items automatically: PR opened → Review, PR merged → next step (this browser)')));
}
return {refresh, prSection, prBadge, settingsSection, prsFor};
};
