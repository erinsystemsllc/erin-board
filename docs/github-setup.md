# GitHub PR sync — тохиргоо

## 1. Supabase

Board-д холбогдсон Supabase project: `uolosxbouaksdxdmeoxp` (TeLog). `github_prs` хүснэгтийг энд үүсгэнэ.

```bash
# SQL editor-т supabase/migrations/001_github_prs.sql-ийг ажиллуулна, эсвэл:
supabase db push
supabase secrets set GITHUB_WEBHOOK_SECRET=<урт санамсаргүй тэмдэгт>
supabase functions deploy github-webhook --no-verify-jwt
```

## 2. GitHub App (erinsystemsllc org, owner хийнэ)

Org-д 55 repo байгаа тул repo бүр дээр webhook нэмэхийн оронд нэг GitHub App үүсгэнэ.

- Org → Settings → Developer settings → GitHub Apps → **New GitHub App**
- Name: `Erin board`
- Webhook URL: `https://uolosxbouaksdxdmeoxp.supabase.co/functions/v1/github-webhook`
- Webhook secret: дээрх `GITHUB_WEBHOOK_SECRET`
- Repository permissions: **Pull requests: Read**, **Checks: Read**, **Metadata: Read** (diff харах, board-оос review хийх үед: Pull requests: Read & write, Contents: Read)
- Subscribe to events: **Pull request**, **Pull request review**, **Check suite**
- "Where can this GitHub App be installed?" → Only on this account
- Create → **Install App** → LMS ба EEA-ийн repo-ууд (эсвэл All repositories)

Шалгах: App → Advanced → Recent Deliveries дээр `ping` → 200 "pong".

## 3. Board

Board → Settings → **GitHub** → **Share Supabase data** (TeLog project-д хандах эрхтэй хүн дарна). Энэ нь GitHub ба TeLog-ийн query-г хамт share хийнэ.

⚠️ Board дээр Supabase connector-ийг нэг л хүн share хийнэ, шинэ share өмнөхийг солино. TeLog хуудаснаас share хийх бол `telog-reports.js`-ийн query жагсаалтад `web/github.js`-ийн `GH_SQL`-ийг нэмэх хэрэгтэй.

## Ажлын урсгал (developer)

1. Branch: `LMS-6555-ai-credit` (board дээрх Development → Copy branch name)
2. PR нээх → board дээр ажил **Review** болно, Reviews хуудсанд гарна.
3. Reviewer GitHub дээр (эсвэл дараа нь board дээр) review хийнэ.
4. Merge → ажил дараагийн алхам руу автоматаар шилжинэ.
