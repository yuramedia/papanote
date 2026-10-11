import type { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase';
import type { UserRole } from './types';

class AuthStore {
  session = $state<Session | null>(null);
  ready = $state(false);
  isAdmin = $state(false);
  user = $derived<User | null>(this.session?.user ?? null);

  get isOwner(): boolean {
    return this.user?.email?.toLowerCase() === 'admin@yuramedia.com';
  }

  get role(): UserRole {
    if (!this.session?.user) return 'user';
    if (this.isOwner) return 'owner';
    if (this.isAdmin) return 'admin';
    return 'user';
  }

  async checkAdmin() {
    if (!this.session) {
      this.isAdmin = false;
      return;
    }
    try {
      const { data } = await supabase().rpc('is_admin');
      this.isAdmin = Boolean(data);
    } catch {
      this.isAdmin = false;
    }
  }

  async init() {
    const sb = supabase();
    const { data } = await sb.auth.getSession();
    this.session = data.session;
    await this.checkAdmin();
    sb.auth.onAuthStateChange(async (_event, session) => {
      this.session = session;
      await this.checkAdmin();
    });
    this.ready = true;
  }

  async signIn(email: string, password: string): Promise<string | null> {
    const { error } = await supabase().auth.signInWithPassword({ email, password });
    if (!error) return null;
    if (error.message.toLowerCase().includes('invalid')) return 'Email atau password salah.';
    return error.message;
  }

  async updatePassword(password: string): Promise<string | null> {
    const { error } = await supabase().auth.updateUser({ password });
    if (!error) return null;
    return error.message;
  }

  async signOut() {
    await supabase().auth.signOut();
  }
}

export const auth = new AuthStore();
