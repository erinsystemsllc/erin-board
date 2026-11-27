# Erin board

Erin Systems-ийн багийн task tracker (Jira-г орлох). Jarvis LMS ба E-accounting бүтээгдэхүүний board, backlog, sprint, timelog, test management, reviews.

- **Board:** https://claude.ai/artifact/Aj14wnMzrQLELFzWkvnQPN (claude.ai artifact, Erin Systems байгууллагад хуваалцсан)
- **Эзэмшигч / PO:** Egshiglen

## Бүтэц

| Хавтас | Юу байна |
|---|---|
| `web/` | Board-ын модулиуд. `github.js` — PR sync-ийн board тал (PR жагсаалт, автомат статус, Settings › GitHub). |
| `supabase/migrations/` | `github_prs` хүснэгт |
| `supabase/functions/github-webhook/` | GitHub webhook → `github_prs` (Edge Function) |
| `docs/` | Тохиргооны заавар |

> `web/index.html`, `web/tests.js`, `web/tests.css` одоохондоо artifact дотор эх сурвалжтай. Artifact-аас repo руу sync хийх нь дараагийн алхам.
> `telog-reports.js`-ийн эх сурвалж нь `ZayaPLT/Telog` repo.

## GitHub ↔ Erin board (Linear маягийн)

1. PR-ийн branch, title эсвэл body-д work item key бичнэ: `LMS-6555`, `EEA-45`.
2. GitHub webhook PR-ийн өөрчлөлтийг Supabase Edge Function руу илгээнэ → `public.github_prs`.
3. Board PR-ийн төлөвийг work item дээр харуулна. PR нээгдэхэд **In Progress → Review**, merge хийхэд **Review → дараагийн алхам** (LMS: Done, EEA: On Develop).

Тохиргооны алхмууд: [docs/github-setup.md](docs/github-setup.md)
