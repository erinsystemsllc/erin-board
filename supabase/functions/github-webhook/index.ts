// Erin board — GitHub webhook → public.github_prs
// Events: pull_request, pull_request_review, check_suite / check_run.
// A PR is linked to a work item when its branch, title or body contains a key like LMS-123 or EEA-45.
// Deploy:  supabase secrets set GITHUB_WEBHOOK_SECRET=...  &&  supabase functions deploy github-webhook --no-verify-jwt
import { createClient } from "npm:@supabase/supabase-js@2";

const SECRET = Deno.env.get("GITHUB_WEBHOOK_SECRET")!;
const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const KEY_RE = /\b(LMS|EEA)-\d+\b/gi;
const enc = new TextEncoder();

async function verify(sig: string, body: string): Promise<boolean> {
  const key = await crypto.subtle.importKey("raw", enc.encode(SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(body)));
  const hex = "sha256=" + [...mac].map((b) => b.toString(16).padStart(2, "0")).join("");
  if (hex.length !== sig.length) return false;
  let d = 0;
  for (let i = 0; i < hex.length; i++) d |= hex.charCodeAt(i) ^ sig.charCodeAt(i);
  return d === 0;
}

// deno-lint-ignore no-explicit-any
const keysOf = (pr: any): string[] =>
  [...new Set(([pr.head?.ref, pr.title, pr.body].filter(Boolean).join(" ").match(KEY_RE) || []).map((k: string) => k.toUpperCase()))];

Deno.serve(async (req) => {
  const body = await req.text();
  if (!(await verify(req.headers.get("x-hub-signature-256") || "", body))) {
    return new Response("bad signature", { status: 401 });
  }
  const ev = req.headers.get("x-github-event");
  const p = JSON.parse(body);
  if (ev === "ping") return new Response("pong");
  const now = new Date().toISOString();

  // CI results: update checks on every PR in the suite.
  if (ev === "check_suite" || ev === "check_run") {
    const src = p.check_run || p.check_suite;
    const suite = p.check_suite || p.check_run?.check_suite;
    const c = src?.conclusion;
    const checks = !c ? "pending" : ["success", "neutral", "skipped"].includes(c) ? "success" : "failure";
    for (const x of suite?.pull_requests || []) {
      await sb.from("github_prs").update({ checks, updated_at: now }).eq("repo", p.repository.full_name).eq("number", x.number);
    }
    return new Response("ok");
  }

  const pr = p.pull_request;
  if (!pr) return new Response("ignored");
  const keys = keysOf(pr);
  if (!keys.length) return new Response("no work item key");

  const row: Record<string, unknown> = {
    repo: p.repository.full_name,
    number: pr.number,
    title: pr.title,
    state: pr.state,
    draft: !!pr.draft,
    merged: !!pr.merged,
    url: pr.html_url,
    author: pr.user?.login,
    head_ref: pr.head?.ref,
    updated_at: now,
  };
  if (ev === "pull_request_review") {
    const s = p.review?.state;
    if (s === "approved" || s === "changes_requested") row.review_state = s;
  }
  const { error } = await sb
    .from("github_prs")
    .upsert(keys.map((k) => ({ ...row, issue_key: k })), { onConflict: "issue_key,repo,number" });
  return new Response(error ? error.message : "ok", { status: error ? 500 : 200 });
});
