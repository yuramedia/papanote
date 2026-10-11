import type { Board, BoardMemberRole, BoardVisibility } from './types';
import type { User } from '@supabase/supabase-js';

/**
 * Mengambil seluruh identitas valid pengguna:
 * 1. user.id (UUID)
 * 2. user.email (lowercase)
 * 3. username (bagian sebelum '@' pada email, lowercase & dengan awalan '@')
 * 4. user_metadata.username (jika ada, lowercase & dengan awalan '@')
 */
export function getUserIdentities(user: User | null): string[] {
  if (!user) return [];
  const identities: string[] = [user.id];

  if (user.email) {
    const email = user.email.toLowerCase().trim();
    identities.push(email);
    const prefix = email.split('@')[0];
    if (prefix) {
      identities.push(prefix);
      identities.push(`@${prefix}`);
    }
  }

  const metaUsername = user.user_metadata?.username;
  if (typeof metaUsername === 'string' && metaUsername.trim()) {
    const clean = metaUsername.toLowerCase().trim().replace(/^@/, '');
    if (clean) {
      identities.push(clean);
      identities.push(`@${clean}`);
    }
  }

  return Array.from(new Set(identities));
}

/**
 * Menentukan peran pengguna pada papan tertentu:
 * - 'owner': Pembuat/pemilik papan (created_by)
 * - 'admin': Admin tim atau admin yang ditugaskan khusus di papan
 * - 'user': Anggota biasa (kolaborator catatan)
 */
export function getUserBoardRole(board: Board, user: User | null, isAdmin: boolean): BoardMemberRole {
  if (!user) return 'user';
  if (board.created_by && board.created_by === user.id) return 'owner';
  if (isAdmin) return 'admin';

  if (!board.member_roles) return 'user';

  const userIdentities = getUserIdentities(user);
  for (const [key, role] of Object.entries(board.member_roles)) {
    const cleanKey = key.toLowerCase().trim();
    if (userIdentities.some((id) => id.toLowerCase().trim() === cleanKey)) {
      return role;
    }
  }

  return 'user';
}

/**
 * Menentukan apakah pengguna saat ini berhak melihat dan membuka papan.
 * Aturan:
 * 1. Admin tim selalu memiliki akses penuh (monitoring & manajemen).
 * 2. Pemilik papan (created_by / owner) selalu memiliki akses ke papannya sendiri.
 * 3. Jika visibility 'public' (atau belum diset): seluruh anggota tim yang login boleh melihat.
 * 4. Jika visibility 'private': hanya pemilik dan admin yang boleh melihat.
 * 5. Jika visibility 'members': pemilik, admin, dan anggota yang terdaftar di member_ids
 *    (berdasarkan ID, email, atau username) yang boleh melihat.
 */
export function canAccessBoard(board: Board, user: User | null, isAdmin: boolean): boolean {
  if (isAdmin) return true;
  if (!user) return false;
  if (board.created_by && board.created_by === user.id) return true;

  const visibility: BoardVisibility = board.visibility || 'public';
  if (visibility === 'public') return true;
  if (visibility === 'private') return false;

  if (visibility === 'members') {
    const list = board.member_ids || [];
    if (list.length === 0) return false;

    const userIdentities = getUserIdentities(user);
    return list.some((m) => {
      const cleanMember = m.toLowerCase().trim();
      return userIdentities.some((id) => id.toLowerCase().trim() === cleanMember);
    });
  }

  return true;
}

/**
 * Menentukan apakah pengguna saat ini berhak mengubah pengaturan visibilitas papan.
 * Owner papan atau Admin yang boleh mengubah hak akses & visibilitas.
 */
export function canManageBoardVisibility(board: Board, user: User | null, isAdmin: boolean): boolean {
  if (isAdmin) return true;
  if (!user) return false;
  const role = getUserBoardRole(board, user, isAdmin);
  return role === 'owner' || role === 'admin';
}

export function getVisibilityLabel(visibility?: BoardVisibility): string {
  switch (visibility) {
    case 'private':
      return 'Pribadi';
    case 'members':
      return 'Anggota Terpilih';
    case 'public':
    default:
      return 'Semua Tim';
  }
}

export function getRoleBadgeInfo(role: BoardMemberRole): { label: string; icon: string; class: string } {
  switch (role) {
    case 'owner':
      return { label: 'Owner', icon: '👑', class: 'bg-purple-100 text-purple-700 ring-1 ring-purple-600/20' };
    case 'admin':
      return { label: 'Admin', icon: '🛡️', class: 'bg-amber-100 text-amber-700 ring-1 ring-amber-600/20' };
    case 'user':
    default:
      return { label: 'User', icon: '👤', class: 'bg-slate-100 text-slate-600 ring-1 ring-slate-400/20' };
  }
}
