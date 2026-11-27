# Artifact ↔ repo sync дүрэм

Erin board нь claude.ai artifact дээр ажилладаг. Тиймээс одоохондоо хоёр газар код байна. Дүрэм:

## Эх сурвалж аль нь вэ

| Хэсэг | Эх сурвалж | Хэрхэн өөрчлөх |
|---|---|---|
| `web/index.html`, `web/tests.js`, `web/tests.css`, `web/github.js` | **Artifact** | Claude (Cowork, "Jarvis Cloud" project)-ээр artifact-ийг засна → дараа нь repo руу sync |
| `web/telog-reports.js` | `ZayaPLT/Telog` repo | Zaya засна. Энд зөвхөн хуулбар |
| `supabase/` | **Энэ repo** | PR → merge → `supabase functions deploy` / `supabase db push` |
| `docs/` | Энэ repo | PR |

## Artifact → repo (board засагдах бүрт)

1. Board → Settings → **Source code** → **Download source (.zip)**
2. Zip-ийг задлах → `web/` хавтас гарна
3. GitHub: `erinsystemsllc/erin-board` → **Add file → Upload files** → `web` хавтсыг чирж оруулна
4. Commit message: `sync: artifact <version>` (version-ийг Claude publish хийхдээ хэлдэг)

## Developer board-ыг засах бол

1. Repo дээр branch + PR (`web/...` файл)
2. Review → merge
3. Egshiglen-ий Claude-д: "repo-ийн `web/<файл>`-ийн өөрчлөлтийг board artifact-д оруул" гэж хэлнэ
   - `tests.js`, `github.js` зэрэг жижиг модуль → бүтэн файлаар publish
   - `index.html` → зөвхөн өөрчлөгдсөн хэсгийг `edit_version`-оор (бүтэн index.html-ийг хуучин хуулбараас бүү дарж нийтэл — бусдын засварыг устгана)
4. Дараа нь дээрх "Artifact → repo" sync-ийг хийнэ

## Цаашид

Board artifact-аас гарч Next.js + Supabase web app болбол энэ repo цорын ганц эх сурвалж болно, sync хэрэггүй.
