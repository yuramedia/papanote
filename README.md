# papanote

Papan catatan visual tim ala Trello. **Supabase Cloud** dipakai sebagai cache, Auth, dan Realtime, sedangkan **PostgreSQL internal** perusahaan menjadi *source of truth*.

| Komponen | Teknologi |
| :--- | :--- |
| Frontend | Svelte 5 + Vite, Bits UI + Tailwind CSS v4 |
| Runtime / bundler | Bun |
| Server sinkronisasi | Bun (`Bun.serve`, `Bun.sql`) dalam satu container dengan frontend |
| Cache, Auth & Realtime | Supabase Cloud (free tier) |
| Penyimpanan utama | PostgreSQL internal (`yura-postgres`) |
| CI/CD | GitHub Actions → GHCR → VPS yura-infra (Caddy HTTPS) |

## Arsitektur

```
Browser (Svelte) ──write──▶ Supabase ──realtime WebSocket──▶ semua browser aktif
                               │
                               └─ Database Webhook ──▶ papanote (Bun) ──▶ PostgreSQL internal
                                                       ├─ rekonsiliasi tiap 5 menit (menutup webhook yang hilang)
                                                       ├─ pengingat deadline tiap 1 menit (Web Push)
                                                       └─ cleanup harian 03:00 WIB (purge cache Supabase)
```

- **Write:** perubahan dari UI langsung ditulis ke Supabase (optimistic update).
- **Realtime:** Supabase menyiarkan `postgres_changes` ke semua klien.
- **Sync:** trigger webhook (INSERT/UPDATE) mengirim baris ke `POST /api/webhook/supabase`, lalu di-upsert ke Postgres internal dengan aturan *last-write-wins* (`updated_at`).
- **Retensi:** job harian menghapus dari Supabase riwayat yang lebih tua dari 30 hari dan board/list/kartu yang di-soft-delete lebih dari 7 hari. Penghapusan **hanya** dilakukan pada baris yang sudah terverifikasi ada di Postgres internal. DELETE tidak pernah dikirim ke internal, jadi data permanen tetap utuh.

## Fitur

- Login-only (email/password). Tidak ada registrasi; akun dibuat Admin lewat `bun run create-user`.
- Banyak papan → list → kartu. Semua user yang login bisa melihat & mengedit semua papan.
- Teks biasa dengan auto-save saat **on-blur**, plus indikator *Menyimpan… / Tersimpan*.
- **Riwayat versi:** trigger DB menyalin konten lama ke `card_histories` sebelum update. Ada tombol *Pulihkan*, dan riwayat otomatis dihapus setelah 30 hari.
- **Fractional indexing:** memindahkan kartu hanya meng-update **satu** baris (nilai tengah float). Rebalance otomatis dilakukan jika presisi habis.
- Label *Diunggah*, *Tenggat* (warna: normal / < 24 jam / lewat), dan toggle notifikasi.
- **Web Push:** pengingat 24 jam & 1 jam sebelum tenggat, serta saat kartu ber-notifikasi diubah anggota lain (wajib HTTPS).
- **Ekspor Word (.docx):** dibuat di browser dengan struktur Papan → List (Heading 1) → Kartu (Heading 2) + metadata + isi.

## Pengembangan lokal

```bash
bun install
cp .env.example .env        # isi SUPABASE_URL, SUPABASE_ANON_KEY, dst.
bun run vapid               # generate VAPID key → tempel ke .env
bun run dev                 # Vite (5173) + server Bun (3000), /api di-proxy
```

Tanpa `DATABASE_URL`, server tetap jalan, tetapi sinkronisasi ke Postgres internal dan semua job dinonaktifkan.

| Script | Fungsi |
| :--- | :--- |
| `bun run dev` | Dev server frontend + backend |
| `bun run build` | Build statis ke `dist/` |
| `bun run start` | Server produksi (menyajikan `dist/` + `/api`) |
| `bun run check` | `svelte-check` (TypeScript + Svelte) |
| `bun test` | Unit test |
| `bun run create-user <email> [password]` | Buat akun (butuh service role key) |
| `bun run vapid` | Generate pasangan VAPID key |

## Setup Supabase (sekali)

1. Buat project di [supabase.com](https://supabase.com).
2. Buka **SQL Editor**, lalu jalankan secara berurutan:
   - `supabase/migrations/001_schema.sql`
   - `supabase/migrations/002_triggers.sql`
   - `supabase/migrations/003_rls_realtime.sql`
3. **Authentication → Providers → Email:** matikan **"Allow new users to sign up"**.
4. Salin `supabase/webhooks.sql.template`, ganti `__APP_URL__` (domain HTTPS) & `__WEBHOOK_SECRET__`, lalu jalankan di SQL Editor.
5. Buat user: `bun run create-user nama@perusahaan.com`.

## Deploy (yura-infra)

1. **Provision database** (sekali, manual di VPS, agar password tidak muncul di log CI):
   ```bash
   mkdir -p /root/yura-infra/apps/papanote
   # salin app.yml ke folder di atas, lalu:
   cd /root/yura-infra && ./scripts/reload-databases.sh
   ```
   Simpan `DATABASE_URL` yang dicetak (hanya muncul sekali).
2. **GitHub Secrets** (Settings → Secrets and variables → Actions):
   `DEPLOY_SSH_KEY`, `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `WEBHOOK_SECRET`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`.
3. **Variables:** `DEPLOY_ENABLED=true` (opsional: `VAPID_SUBJECT`).
4. Sesuaikan domain di `app.yml` **dan** `caddy-snippet.caddyfile`, lalu push ke `main`.

Pipeline: `ci` (check + test + build) → `build` (image `ghcr.io/yuramedia/papanote`) → `deploy` (SSH: `.env.production`, `docker compose up -d`, `reload-databases.sh`, `reload-gateway.sh`).

> `caddy-snippet.caddyfile` dipakai karena CSP default yura-infra tidak mengizinkan `https://*.supabase.co`.

## Struktur

```
src/                 Frontend Svelte (routes/, components/, lib/)
public/              sw.js (Web Push), manifest, ikon
server/              Server Bun: index.ts, webhook.ts, sync.ts, push.ts, jobs/, db/
supabase/            Migrasi SQL Supabase + template webhook
scripts/             create-user.ts, generate-vapid.ts
tests/               Unit test (bun test)
```
