import type { Board, BoardMemberRole, BoardVisibility } from './types';
import type { User } from '@supabase/supabase-js';

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

  const assigned =
    board.member_roles?.[user.id] ||
    (user.email ? board.member_roles?.[user.email.toLowerCase()] : undefined);
  if (assigned) return assigned;

  return 'user';
}

/**
 * Menentukan apakah pengguna saat ini berhak melihat dan membuka papan.
 * Aturan:
 * 1. Admin tim selalu memiliki akses penuh (monitoring & manajemen).
 * 2. Pemilik papan (created_by / owner) selalu memiliki akses ke papannya sendiri.
 * 3. Jika visibility 'public' (atau belum diset): seluruh anggota tim yang login boleh melihat.
 * 4. Jika visibility 'private': hanya pemilik dan admin yang boleh melihat.
 * 5. Jika visibility 'members': pemilik, admin, dan anggota yang terdaftar di member_ids yang boleh melihat.
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
    const userIdMatch = list.includes(user.id);
    const userEmailMatch = user.email ? list.includes(user.email.toLowerCase()) : false;
    return userIdMatch || userEmailMatch;
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
