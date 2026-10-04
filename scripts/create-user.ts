/**
 * Buat akun user (registrasi mandiri ditiadakan — akun dikelola Admin).
 * Pemakaian: bun run create-user <email> [password]
 * Jika password tidak diberikan, password acak akan dibuat dan dicetak sekali.
 */
import { randomBytes } from 'node:crypto';
import { supabaseAdmin } from '../server/supabase.ts';

const [email, given] = process.argv.slice(2);
if (!email || !email.includes('@')) {
  console.error('Pemakaian: bun run create-user <email> [password]');
  process.exit(1);
}
const password = given ?? randomBytes(12).toString('base64url');

const { data, error } = await supabaseAdmin().auth.admin.createUser({
  email,
  password,
  email_confirm: true,
});
if (error) {
  console.error('Gagal membuat user:', error.message);
  process.exit(1);
}
console.log(`User dibuat: ${data.user.email} (${data.user.id})`);
if (!given) console.log(`Password: ${password}   ← simpan & kirim ke user, tidak akan ditampilkan lagi`);
