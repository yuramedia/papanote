import { describe, expect, test } from 'bun:test';
import { canAccessBoard, canManageBoardVisibility, getRoleBadgeInfo, getUserBoardRole, getVisibilityLabel } from '../src/lib/board-access';
import type { Board } from '../src/lib/types';
import type { User } from '@supabase/supabase-js';

const mockUser = (id: string, email: string): User =>
  ({
    id,
    email,
    app_metadata: {},
    user_metadata: {},
    aud: 'authenticated',
    created_at: new Date().toISOString(),
  }) as User;

const userAlice = mockUser('user-1', 'alice@yuramedia.com');
const userBob = mockUser('user-2', 'bob@yuramedia.com');
const userCharlie = mockUser('user-3', 'charlie@yuramedia.com');

const createTestBoard = (overrides: Partial<Board> = {}): Board => ({
  id: 'board-1',
  title: 'Papan Uji',
  position: 1000,
  visibility: 'public',
  member_ids: [],
  created_by: 'user-1',
  deleted_at: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides,
});

describe('canAccessBoard (Visibilitas Papan)', () => {
  describe('Papan Publik (public)', () => {
    const board = createTestBoard({ visibility: 'public' });

    test('pemilik dapat mengakses', () => {
      expect(canAccessBoard(board, userAlice, false)).toBe(true);
    });

    test('anggota lain dapat mengakses', () => {
      expect(canAccessBoard(board, userBob, false)).toBe(true);
    });

    test('admin dapat mengakses', () => {
      expect(canAccessBoard(board, userBob, true)).toBe(true);
    });

    test('user tanpa login tidak dapat mengakses', () => {
      expect(canAccessBoard(board, null, false)).toBe(false);
    });
  });

  describe('Papan Pribadi (private)', () => {
    const board = createTestBoard({ visibility: 'private', created_by: 'user-1' });

    test('pembuat papan dapat mengakses', () => {
      expect(canAccessBoard(board, userAlice, false)).toBe(true);
    });

    test('admin selalu dapat mengakses', () => {
      expect(canAccessBoard(board, userBob, true)).toBe(true);
    });

    test('anggota lain ditolak', () => {
      expect(canAccessBoard(board, userBob, false)).toBe(false);
      expect(canAccessBoard(board, userCharlie, false)).toBe(false);
    });
  });

  describe('Papan Anggota Tertentu (members)', () => {
    const board = createTestBoard({
      visibility: 'members',
      created_by: 'user-1',
      member_ids: ['user-1', 'user-2', 'charlie@yuramedia.com'],
    });

    test('pembuat papan dapat mengakses', () => {
      expect(canAccessBoard(board, userAlice, false)).toBe(true);
    });

    test('anggota yang id-nya terdaftar dapat mengakses', () => {
      expect(canAccessBoard(board, userBob, false)).toBe(true);
    });

    test('anggota yang email-nya terdaftar dapat mengakses', () => {
      expect(canAccessBoard(board, userCharlie, false)).toBe(true);
    });

    test('anggota luar yang tidak terdaftar ditolak', () => {
      const userDave = mockUser('user-4', 'dave@yuramedia.com');
      expect(canAccessBoard(board, userDave, false)).toBe(false);
    });

    test('admin selalu dapat mengakses', () => {
      const userAdmin = mockUser('user-99', 'admin@yuramedia.com');
      expect(canAccessBoard(board, userAdmin, true)).toBe(true);
    });
  });
});

describe('canManageBoardVisibility (Izin Mengubah Akses)', () => {
  const board = createTestBoard({ created_by: 'user-1' });

  test('pemilik papan berhak mengubah', () => {
    expect(canManageBoardVisibility(board, userAlice, false)).toBe(true);
  });

  test('admin berhak mengubah', () => {
    expect(canManageBoardVisibility(board, userBob, true)).toBe(true);
  });

  test('anggota biasa non-pemilik tidak berhak mengubah', () => {
    expect(canManageBoardVisibility(board, userBob, false)).toBe(false);
  });
});

describe('getVisibilityLabel', () => {
  test('label teks sesuai', () => {
    expect(getVisibilityLabel('public')).toBe('Semua Tim');
    expect(getVisibilityLabel('private')).toBe('Pribadi');
    expect(getVisibilityLabel('members')).toBe('Anggota Terpilih');
  });
});

describe('getUserBoardRole (Peran 3-Tier: owner, admin, user)', () => {
  const board = createTestBoard({
    created_by: 'user-1',
    member_roles: {
      'user-2': 'admin',
      'charlie@yuramedia.com': 'user',
    },
  });

  test('pembuat papan selalu mendapat role owner', () => {
    expect(getUserBoardRole(board, userAlice, false)).toBe('owner');
  });

  test('admin global selalu bertindak sebagai role admin', () => {
    const userAdmin = mockUser('user-99', 'admin@yuramedia.com');
    expect(getUserBoardRole(board, userAdmin, true)).toBe('admin');
  });

  test('anggota yang ditugaskan sebagai admin di papan mendapat role admin', () => {
    expect(getUserBoardRole(board, userBob, false)).toBe('admin');
  });

  test('anggota yang ditugaskan sebagai user di papan mendapat role user', () => {
    expect(getUserBoardRole(board, userCharlie, false)).toBe('user');
  });

  test('pengguna lain atau tanpa login default ke user', () => {
    const userDave = mockUser('user-4', 'dave@yuramedia.com');
    expect(getUserBoardRole(board, userDave, false)).toBe('user');
    expect(getUserBoardRole(board, null, false)).toBe('user');
  });
});

describe('getRoleBadgeInfo', () => {
  test('mengembalikan icon dan label yang benar untuk setiap role', () => {
    const ownerBadge = getRoleBadgeInfo('owner');
    expect(ownerBadge.label).toBe('Owner');
    expect(ownerBadge.icon).toBe('👑');

    const adminBadge = getRoleBadgeInfo('admin');
    expect(adminBadge.label).toBe('Admin');
    expect(adminBadge.icon).toBe('🛡️');

    const userBadge = getRoleBadgeInfo('user');
    expect(userBadge.label).toBe('User');
    expect(userBadge.icon).toBe('👤');
  });
});

