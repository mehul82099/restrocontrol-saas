# Database backup (weekly)

Prod DB = Vercel Prisma Postgres (PostgreSQL 17), free plan, **koi automatic backup nahi**.
Isliye `.github/workflows/db-backup.yml` har week ek `pg_dump` leta hai aur GitHub Actions artifact me 90 din ke liye rakhta hai.

- Schedule: every Sunday 21:30 UTC = **Monday 03:00 IST** (plus manual run).
- File: `restrocontrol-YYYY-MM-DD.dump` (pg_dump custom format, already compressed).
- Kahan milega: GitHub → Actions → "Weekly DB backup" → run → **Artifacts**.

> Note: artifacts private repo me sirf repo access wale log download kar sakte hain. Backup me customer data hai, isliye repo private hi rakho.

## 1. One-time setup: `BACKUP_DATABASE_URL` secret

Workflow ko **direct** connection string chahiye (`postgres://…@db.prisma.io:5432/…?sslmode=require`).
`prisma+postgres://accelerate.prisma-data.net/...` wala Accelerate URL **nahi chalega**, aur `pooled.db.prisma.io` bhi avoid karo (pg_dump ke liye direct host use karo).

Direct string kahan milega:
- **Prisma Console** (console.prisma.io) → project → database → **Connect to your database** → *Generate new connection string* → copy the **direct** one (host `db.prisma.io`).
- Ya **Vercel** → project → Settings → Environment Variables (ya Storage tab → Prisma Postgres DB → `.env.local` snippet): `POSTGRES_URL` / `DATABASE_URL` jo `postgres://…@db.prisma.io` se start ho. Agar sirf `PRISMA_DATABASE_URL` (`prisma+postgres://`) dikh raha hai, to woh mat lo; Prisma Console se direct string generate karo.

Secret add karna:
1. GitHub → `mehul82099/restrocontrol-saas` → **Settings → Secrets and variables → Actions → New repository secret**
2. Name: `BACKUP_DATABASE_URL`
3. Value: direct `postgres://…` string → **Add secret**

Secret missing ya galat type ka ho to workflow clear error ke saath fail hoga.

## 2. Manual run

GitHub → **Actions → Weekly DB backup → Run workflow** (branch: default). 1–3 min me artifact ready.
CLI se: `gh workflow run db-backup.yml`

Har run ke summary me file size aur "tables with data" count dikhta hai. 0 tables ya <1 KB dump hua to run fail ho jayega (taaki silent empty backup na bane).

## 3. Restore with `pg_restore`

Local machine pe PostgreSQL **17** client tools chahiye (`pg_restore --version` → 17.x).

```bash
# 1. Artifact download karo (zip) aur unzip karo
gh run download <run-id> -n restrocontrol-YYYY-MM-DD.dump

# 2. Pehle content check karo
pg_restore --list restrocontrol-YYYY-MM-DD.dump | head

# 3a. Safe option: naye / empty DB me restore (recommended, pehle yahin verify karo)
pg_restore --no-owner --no-privileges -d "postgres://USER:PASS@HOST:5432/DB?sslmode=require" restrocontrol-YYYY-MM-DD.dump

# 3b. Existing DB ko overwrite (DESTRUCTIVE – current data replace ho jayega)
pg_restore --clean --if-exists --no-owner --no-privileges -d "$DIRECT_URL" restrocontrol-YYYY-MM-DD.dump
```

Tips:
- Restore hamesha **direct** URL se karo, pooled/Accelerate se nahi.
- Prod overwrite se pehle ek fresh manual backup run kar lo.
- Ek table restore karni ho: `pg_restore -t "Order" --data-only ...`
