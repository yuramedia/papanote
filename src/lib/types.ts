export interface Board {
  id: string;
  title: string;
  position: number;
  created_by: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface List {
  id: string;
  board_id: string;
  title: string;
  position: number;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Card {
  id: string;
  list_id: string;
  title: string;
  content: string;
  position: number;
  deadline_date: string | null;
  enable_notification: boolean;
  created_by: string | null;
  updated_by: string | null;
  deleted_at: string | null;
  uploaded_at: string;
  updated_at: string;
}

export interface CardHistory {
  id: string;
  card_id: string;
  old_content: string | null;
  changed_by: string | null;
  created_at: string;
}

export interface AppConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  vapidPublicKey: string;
}
