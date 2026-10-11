<script lang="ts">
  import { DropdownMenu } from 'bits-ui';
  import LogOut from '@lucide/svelte/icons/log-out';
  import StickyNote from '@lucide/svelte/icons/sticky-note';
  import Settings from '@lucide/svelte/icons/settings';
  import Users from '@lucide/svelte/icons/users';
  import KeyRound from '@lucide/svelte/icons/key-round';
  import { auth } from '../lib/auth.svelte';
  import { router } from '../lib/router.svelte';
  import AdminUsersDialog from './AdminUsersDialog.svelte';
  import ChangePasswordDialog from './ChangePasswordDialog.svelte';
  import type { Snippet } from 'svelte';

  let {
    title = '',
    leftControls,
    center,
    rightStatus,
    children,
  }: {
    title?: string;
    leftControls?: Snippet;
    center?: Snippet;
    rightStatus?: Snippet;
    children?: Snippet;
  } = $props();

  let openAdmin = $state(false);
  let openChangePassword = $state(false);
</script>

<header class="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-white/10 bg-slate-900 px-4 text-white">
  <!-- SISI KIRI: Logo, Title / Breadcrumb & Left Controls (Switcher) -->
  <div class="flex items-center gap-3 min-w-0 shrink-0">
    <button class="flex items-center gap-2 font-semibold tracking-tight cursor-pointer" onclick={() => router.go('/')}>
      <span class="grid size-8 place-items-center rounded-lg bg-white/10"><StickyNote class="size-4" /></span>
      papanote
    </button>
    {#if title}
      <span class="text-white/30">/</span>
      <h1 class="truncate font-medium max-w-[120px] sm:max-w-[180px] md:max-w-xs">{title}</h1>
    {/if}
    {@render leftControls?.()}
  </div>

  <!-- TENGAH: Kotak Pencarian (Search in Center) -->
  <div class="flex flex-1 items-center justify-center max-w-sm mx-2">
    {@render center?.()}
  </div>

  <!-- SISI KANAN: Controls, Settings (Kelola User + Ganti Password), Email, Live Status (di kanan email!), Logout -->
  <div class="flex items-center gap-2.5 shrink-0">
    {@render children?.()}

    <!-- MENU SETTINGS (Kelola User & Ganti Password) -->
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        class="btn bg-white/10 hover:bg-white/20 text-white text-xs flex items-center gap-1.5 py-1.5 px-3 rounded-lg font-medium transition-colors cursor-pointer"
        title="Pengaturan Akun & Sistem"
      >
        <Settings class="size-3.5 text-indigo-300" />
        <span class="hidden sm:inline">Settings</span>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content class="menu-content min-w-52" align="end" sideOffset={6}>
          <!-- Ringkasan Akun -->
          <div class="px-3 py-2 border-b border-slate-100 mb-1">
            <p class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Akun Terdaftar</p>
            <p class="text-xs font-semibold text-slate-800 truncate">@{auth.username}</p>
            <p class="text-[11px] text-slate-500 truncate">{auth.user?.email}</p>
            <span
              class="inline-flex items-center gap-1 mt-1 rounded px-1.5 py-0.5 text-[10px] font-semibold {auth.role === 'owner'
                ? 'bg-purple-100 text-purple-700'
                : auth.role === 'admin'
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-slate-100 text-slate-600'}"
            >
              {#if auth.role === 'owner'}
                👑 Owner
              {:else if auth.role === 'admin'}
                🛡️ Admin
              {:else}
                👤 User
              {/if}
            </span>
          </div>

          <!-- Opsi: Ganti Password -->
          <DropdownMenu.Item
            class="menu-item text-xs"
            onSelect={() => (openChangePassword = true)}
          >
            <KeyRound class="size-4 text-indigo-500" />
            <span>Ganti Password</span>
          </DropdownMenu.Item>

          <!-- Opsi: Kelola User (Khusus Admin) -->
          {#if auth.isAdmin}
            <DropdownMenu.Item
              class="menu-item text-xs"
              onSelect={() => (openAdmin = true)}
            >
              <Users class="size-4 text-amber-500" />
              <span>Kelola User Tim</span>
            </DropdownMenu.Item>
          {/if}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>

    <!-- Username / Email Pengguna -->
    <span class="hidden text-sm text-white/70 lg:inline truncate max-w-[200px]" title={auth.user?.email}>
      @{auth.username}
    </span>

    <!-- Status Live / Offline (Tepat di sebelah kanan email) -->
    {@render rightStatus?.()}

    <!-- Tombol Keluar -->
    <button
      class="btn text-white/80 hover:bg-white/10 hover:text-white"
      onclick={() => auth.signOut()}
      title="Keluar"
    >
      <LogOut class="size-4" />
    </button>
  </div>
</header>

<AdminUsersDialog bind:open={openAdmin} />
<ChangePasswordDialog bind:open={openChangePassword} />
