import { createClient } from '@supabase/supabase-js';
import { env } from '../server/env.ts';

const supabaseUrl = env.supabaseUrl;
const anonKey = env.supabaseAnonKey;
const adminEmail = process.env.ADMIN_EMAIL ?? 'admin@yuramedia.com';
const adminPassword = process.env.ADMIN_PASSWORD;

if (!supabaseUrl || !anonKey) {
  console.error('SUPABASE_URL dan SUPABASE_ANON_KEY wajib diset di .env');
  process.exit(1);
}

if (!adminPassword) {
  console.error('ADMIN_PASSWORD wajib diberikan via env: ADMIN_PASSWORD="xxx" bun run seed');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, anonKey);

async function seed() {
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: adminEmail,
    password: adminPassword!,
  });
  if (authError || !authData.user) {
    console.error('Auth error:', authError);
    return;
  }
  const userId = authData.user.id;

  // Cek apakah sudah ada board
  const { data: existing } = await supabase.from('boards').select('id');
  if (existing && existing.length > 0) {
    console.log('Board sudah ada, melewati seed.');
    return;
  }

  // 1. Buat Board Utama
  const { data: board, error: bErr } = await supabase.from('boards').insert({
    title: 'Papan Utama',
    position: 1000,
    created_by: userId,
  }).select().single();

  if (bErr || !board) {
    console.error('Gagal membuat board:', bErr);
    return;
  }

  // 2. Buat Lists
  const listNames = ['Catatan Baru', 'Sedang Diproses', 'Selesai'];
  const createdLists = [];
  for (let i = 0; i < listNames.length; i++) {
    const { data: list, error: lErr } = await supabase.from('lists').insert({
      board_id: board.id,
      title: listNames[i],
      position: (i + 1) * 1000,
    }).select().single();
    if (lErr || !list) {
      console.error('Gagal membuat list:', lErr);
      return;
    }
    createdLists.push(list);
  }

  // 3. Buat Catatan Starter bergaya Obsidian
  const welcomeContent = `# Selamat Datang di Papanote! 🚀

Aplikasi papan catatan visual terpadu bergaya **Obsidian Markdown** dengan realtime sync.

### Fitur yang Bisa Dicoba:
- [x] Mendukung format **Markdown** lengkap
- [x] Mode **Live Preview** dan **Raw Editor**
- [ ] Coba buat tautan internal antarcatatan dengan wikilink: [[Catatan Proyek]]
- [ ] Atur batas waktu (*deadline*) dan aktifkan push reminder

> *Catatan ini disimpan secara realtime ke Supabase Cloud dan disinkronkan ke PostgreSQL internal.*`;

  await supabase.from('cards').insert({
    list_id: createdLists[0].id,
    title: 'Panduan Memulai',
    content: welcomeContent,
    position: 1000,
    created_by: userId,
    updated_by: userId,
  });

  const docxCardContent = `# Ekspor Dokumen Word (.docx)

Seluruh catatan dalam satu papan dapat diekspor langsung ke berkas **Microsoft Word (.docx)** dengan sekali klik pada tombol **Ekspor Word** di bilah atas papan.

Tautan kembali: [[Panduan Memulai]]`;

  await supabase.from('cards').insert({
    list_id: createdLists[1].id,
    title: 'Catatan Proyek',
    content: docxCardContent,
    position: 1000,
    created_by: userId,
    updated_by: userId,
  });

  console.log('🎉 Seed data awal berhasil dibuat di Supabase!');
}

seed().catch(console.error);
