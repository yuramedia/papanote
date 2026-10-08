# papanote

Papan catatan visual tim ala Trello. **Supabase Cloud** dipakai sebagai cache, Auth, dan Realtime, sedangkan **PostgreSQL internal** perusahaan menjadi *source of truth*.

| Komponen | Teknologi |
| :--- | :--- |
| Frontend | Svelte 5 + Vite, Bits UI + Tailwind CSS v4 (100% Statis SPA) |
| Web Server | Caddy (`file_server` langsung menyajikan folder static `dist/`) |
| Background Sync | Bun Worker (Pull model: rekonsiliasi data, push, cleanup) |
| Cache, Auth & Realtime | Supabase Cloud (free tier) |
| Penyimpanan utama | PostgreSQL internal (`yura-postgres`) |
| CI/CD | GitHub Actions → GHCR → VPS yura-infra (Caddy HTTPS) |

## Arsitektur

```
Browser (Svelte Statis) ──write & read──▶ Supabase ──realtime WebSocket──▶ semua browser aktif
                                              ▲
                                              │ (Pull tiap 1 menit via service-role)
                                      papanote-worker (Bun di VPS)
                                              ├─ sinkronisasi ke PostgreSQL internal
                                              ├─ pengingat deadline tiap 1 menit (Web Push)
                                              └─ cleanup harian 03:00 WIB (purge cache Supabase)
```

- **Frontend 100% Statis:** Disajikan langsung oleh Caddy web server di VPS (`file_server`), tanpa container web server Node/Bun. Sangat cepat, efisien, dan minim memory.
- **Konfigurasi Statis:** Frontend memuat `config.json` publik dari root web server saat runtime (`/config.json`).
- **Pull Sync (Tanpa Webhook Publik):** Worker di VPS menarik data perubahan secara berkala dari Supabase ke PostgreSQL internal menggunakan aturan *last-write-wins* (`updated_at`). Tidak membutuhkan endpoint webhook publik masuk ke VPS.
- **Retensi Data:** Job harian membersihkan riwayat > 30 hari dan kartu terhapus dari Supabase setelah terverifikasi aman tersimpan di database internal.

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
bun run dev                 # Vite (5173) + worker Bun lokal
```

Tanpa `DATABASE_URL`, frontend tetap jalan normal, tetapi sinkronisasi ke Postgres internal dan job dinonaktifkan.

| Script | Fungsi |
| :--- | :--- |
| `bun run dev` | Dev server frontend + backend worker |
| `bun run build` | Build statis ke `dist/` |
| `bun run start` | Jalankan background sync worker |
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
   - `supabase/migrations/004_push_subscriptions.sql`
3. **Authentication → Providers → Email:** matikan **"Allow new users to sign up"**.
4. Buat user pertama: `bun run create-user nama@perusahaan.com`.

## Deploy (yura-infra)

1. **Provision database** (sekali, manual di VPS, agar password tidak muncul di log CI):
   ```bash
   mkdir -p /root/yura-infra/apps/papanote
   # salin app.yml ke folder di atas, lalu:
   cd /root/yura-infra && ./scripts/reload-databases.sh
   ```
   Simpan `DATABASE_URL` yang dicetak (hanya muncul sekali).
2. **GitHub Secrets** (Settings → Secrets and variables → Actions):
   `DEPLOY_SSH_KEY`, `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`.
3. **Variables:** `DEPLOY_ENABLED=true` (opsional: `VAPID_SUBJECT`).
4. Sesuaikan domain di `app.yml` **dan** `caddy-snippet.caddyfile`, lalu push ke `main`.

Pipeline: `ci` (check + test + build) → `build` (image `ghcr.io/yuramedia/papanote`) → `deploy` (SSH: ekstrak `dist/` untuk Caddy, generate `config.json`, jalankan `papanote-worker-production`, reload gateway).
