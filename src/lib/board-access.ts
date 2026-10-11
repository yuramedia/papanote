import type { Board, BoardVisibility } from './types';
import type { User } from '@supabase/supabase-js';

/**
 * Menentukan apakah pengguna saat ini berhak melihat dan membuka papan.
 * Aturan:
 * 1. Admin tim selalu memiliki akses penuh (monitoring & manajemen).
 * 2. Pemilik papan (created_by) selalu memiliki akses ke papannya sendiri.
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
 * Hanya pemilik papan atau Admin yang boleh mengubah hak akses.
 */
export function canManageBoardVisibility(board: Board, user: User | null, isAdmin: boolean): boolean {
  if (isAdmin) return true;
  if (!user) return false;
  return board.created_by === user.id;
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
