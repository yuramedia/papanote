import type { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase';

class AuthStore {
  session = $state<Session | null>(null);
  ready = $state(false);
  user = $derived<User | null>(this.session?.user ?? null);

  async init() {
    const sb = supabase();
    const { data } = await sb.auth.getSession();
    this.session = data.session;
    sb.auth.onAuthStateChange((_event, session) => {
      this.session = session;
    });
    this.ready = true;
  }

  async signIn(email: string, password: string): Promise<string | null> {
    const { error } = await supabase().auth.signInWithPassword({ email, password });
    if (!error) return null;
    if (error.message.toLowerCase().includes('invalid')) return 'Email atau password salah.';
    return error.message;
  }

  async signOut() {
    await supabase().auth.signOut();
  }
}

export const auth = new AuthStore();
