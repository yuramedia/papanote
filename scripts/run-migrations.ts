import fs from 'fs';
import path from 'path';

const ref = process.env.SUPABASE_PROJECT_REF;
const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!ref || !token) {
  console.error('SUPABASE_PROJECT_REF and SUPABASE_ACCESS_TOKEN environment variables required');
  process.exit(1);
}
const files = [
  '001_schema.sql',
  '002_triggers.sql',
  '003_rls_realtime.sql',
  '004_push_subscriptions.sql',
  '005_admin_users.sql'
];

async function run() {
  for (const file of files) {
    console.log(`Running migration: ${file}...`);
    const sqlPath = path.join('supabase', 'migrations', file);
    const sql = fs.readFileSync(sqlPath, 'utf-8');
    
    const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query: sql })
    });
    
    const text = await res.text();
    if (res.status >= 200 && res.status < 300) {
      console.log(`✅ ${file}: Berhasil (${res.status})`);
    } else {
      console.error(`❌ ${file}: Gagal (${res.status}): ${text}`);
      process.exit(1);
    }
  }
  console.log('🎉 Seluruh migrasi berhasil diterapkan!');

  // Verifikasi tabel
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query: "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;" })
  });
  const tables = await res.json();
  console.log('Tabel di schema public:', tables);
}

run().catch(console.error);
