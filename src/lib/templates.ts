/**
 * Sistem Template Catatan Instan untuk Papanote.
 * Menyediakan koleksi template terstruktur ala Notion / Obsidian
 * (Notula Rapat, Laporan Bug, Project Kickoff, Daily Standup, Feature Spec)
 * serta kemampuan menyimpan template kustom pengguna di penyimpanan lokal.
 */

export interface NoteTemplate {
  id: string;
  name: string;
  titlePattern: string;
  description: string;
  category: 'Produktivitas' | 'Teknis' | 'Proyek' | 'Umum';
  iconName: 'file-text' | 'users' | 'bug' | 'rocket' | 'sun' | 'clipboard-list' | 'sparkles';
  tags: string[];
  content: string;
  isCustom?: boolean;
  created_at?: string;
}

const STORAGE_KEY = 'papanote_user_templates';

/**
 * Format tanggal dalam bahasa Indonesia yang ramah (contoh: 12 Okt 2026)
 */
export function formatTemplateDate(date = new Date()): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const d = date.getDate();
  const m = months[date.getMonth()];
  const y = date.getFullYear();
  return `${d} ${m} ${y}`;
}

/**
 * Format waktu standar (contoh: 14:30 WIB)
 */
export function formatTemplateTime(date = new Date()): string {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes} WIB`;
}

/**
 * Mengganti token placeholder {{date}}, {{time}}, {{datetime}}, {{user}} dengan nilai dinamis
 */
export function renderTemplateString(text: string, customVars?: Record<string, string>): string {
  const now = new Date();
  const defaultVars: Record<string, string> = {
    date: formatTemplateDate(now),
    time: formatTemplateTime(now),
    datetime: `${formatTemplateDate(now)} ${formatTemplateTime(now)}`,
    user: 'Saya',
    ...customVars,
  };

  return text.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key) => {
    return defaultVars[key] !== undefined ? defaultVars[key] : match;
  });
}

/**
 * Daftar template bawaan berkualitas tinggi
 */
export const BUILTIN_TEMPLATES: NoteTemplate[] = [
  {
    id: 'meeting-notes',
    name: 'Notula Rapat (Meeting Notes)',
    titlePattern: 'Notula Rapat: {{date}}',
    description: 'Format rapi untuk mencatat agenda, peserta, hasil diskusi, dan action items tim.',
    category: 'Produktivitas',
    iconName: 'users',
    tags: ['meeting', 'work'],
    content: `# 📋 Notula Rapat: {{date}} #meeting #work

> **Waktu:** {{datetime}}  
> **Peserta:** @tim  
> **Fasilitator / Notulis:** {{user}}  

---

## 🎯 Agenda Rapat
1. Evaluasi progres kerja minggu ini
2. Pembahasan tantangan dan prioritas rilis
3. Tanya jawab & perencanaan langkah selanjutnya

## 💬 Poin Diskusi & Catatan
- Poin utama pembahasan:
- Masukan dari tim:

## ✅ Keputusan yang Diambil
- [x] Menyepakati timeline implementasi fitur baru

## 📌 Action Items (Tindak Lanjut)
- [ ] @nama: Menyelesaikan tugas prioritas pertama
- [ ] @nama: Menyiapkan laporan dan membagikan ke anggota tim
`,
  },
  {
    id: 'bug-report',
    name: 'Laporan Bug (Bug Report)',
    titlePattern: '[Bug] Masalah Singkat - {{date}}',
    description: 'Struktur baku pelaporan bug: langkah reproduksi, hasil aktual vs diharapkan, dan log.',
    category: 'Teknis',
    iconName: 'bug',
    tags: ['bug', 'urgent'],
    content: `# 🐛 Laporan Bug #bug #urgent

> **Prioritas:** P1 / Urgent  
> **Status:** Investigasi  
> **Tanggal Dilaporkan:** {{date}}  

---

## 🔍 Deskripsi Singkat
Jelaskan kendala atau bug yang ditemukan secara ringkas dan spesifik di sini.

## 🔁 Langkah untuk Mereproduksi (Reproduction Steps)
1. Buka halaman ...
2. Klik tombol ...
3. Masukkan input data ...
4. Amati error atau perilaku tidak wajar yang terjadi.

## 🎯 Hasil yang Diharapkan (Expected Behavior)
Sistem seharusnya menampilkan respon atau halaman yang valid.

## ❌ Hasil Aktual (Actual Behavior)
Sistem malah menampilkan error atau halaman macet.

## 💻 Lingkungan & Device
- **Browser & OS:** Google Chrome / Windows 11
- **Versi Aplikasi:** v1.0.0

## 📸 Tangkapan Layar / Bukti (Screenshots)
<!-- Tempelkan gambar di sini dengan Ctrl + V -->
`,
  },
  {
    id: 'project-kickoff',
    name: 'Rencana Proyek (Project Kickoff)',
    titlePattern: '[Proyek] Nama Proyek Baru',
    description: 'Template perencanaan inisiatif proyek: latar belakang, deliverables, milestone, dan risiko.',
    category: 'Proyek',
    iconName: 'rocket',
    tags: ['project', 'planning'],
    content: `# 🚀 Project Kickoff: Nama Proyek #project #planning

> **Project Lead:** {{user}}  
> **Target Peluncuran:** {{date}}  
> **Status:** Fase Perencanaan  

---

## 🎯 Latar Belakang & Tujuan
Jelaskan tujuan strategis proyek dan masalah utama yang ingin diselesaikan bagi pengguna.

## 📦 Deliverables Utama
- [ ] Deliverable Fase 1: Fondasi sistem & arsitektur
- [ ] Deliverable Fase 2: Implementasi fitur inti
- [ ] Deliverable Fase 3: Pengujian performa & peluncuran

## 📅 Jadwal Milestone
| Fase Proyek | Target Selesai | PIC | Status |
|---|---|---|---|
| Riset & Desain | {{date}} | Desainer | Pending |
| Pengembangan | {{date}} | Engineer | Pending |
| QA & Testing | {{date}} | QA Lead | Pending |
| Peluncuran | {{date}} | All Tim | Pending |

## ⚠️ Risiko & Rencana Mitigasi
- **Risiko 1:** Keterlambatan dependensi eksternal  
  *Mitigasi:* Gunakan mocking data pada fase pengembangan awal.
`,
  },
  {
    id: 'daily-standup',
    name: 'Daily Standup & Jurnal Kerja',
    titlePattern: 'Standup: {{date}}',
    description: 'Format harian standar: apa yang dikerjakan kemarin, rencana hari ini, dan blocker.',
    category: 'Produktivitas',
    iconName: 'sun',
    tags: ['standup', 'daily'],
    content: `# ☀️ Daily Standup: {{date}} #standup #daily

> **Tanggal:** {{date}}  
> **Fokus Utama:** Menyelesaikan task prioritas tinggi  

---

## ⏪ Kemarin (Yesterday)
- [x] Menyelesaikan perbaikan bug pada modul autentikasi
- [x] Melakukan peninjauan kode (code review) tim

## ⏩ Hari Ini (Today)
- [ ] Mengimplementasikan fitur baru
- [ ] Menulis unit test & pengujian integrasi
- [ ] Sinkronisasi dengan tim produk

## 🚧 Hambatan / Kendala (Blockers)
- Tidak ada (semua berjalan lancar).
`,
  },
  {
    id: 'feature-spec',
    name: 'Spesifikasi Fitur (PRD / Feature Spec)',
    titlePattern: '[Spec] Nama Fitur Baru',
    description: 'Dokumen spesifikasi produk & teknis: user problem, solusi, cakupan, dan metriks.',
    category: 'Teknis',
    iconName: 'clipboard-list',
    tags: ['spec', 'feature'],
    content: `# 📐 Spesifikasi Fitur: Nama Fitur #spec #feature

> **Penulis:** {{user}}  
> **Dibuat:** {{date}}  
> **Target Rilis:** Sprint Mendatang  

---

## 👤 Masalah Pengguna (User Problem)
Pengguna saat ini mengalami kesulitan ketika ... karena ketiadaan fasilitas ...

## 💡 Solusi yang Diusulkan
Menambahkan kemampuan ... yang memungkinkan pengguna untuk ... secara instan.

## 🧭 Alur Interaksi Pengguna (User Flow)
1. Pengguna membuka tampilan ...
2. Memilih aksi ...
3. Sistem memproses permintaan dan memberikan umpan balik visual yang jelas.

## 📋 Cakupan Pekerjaan (Scope)
- **In-Scope (Dikerjakan):**
  - Komponen antarmuka pengguna
  - Validasi input & penanganan error
- **Out-of-Scope (Fase Selanjutnya):**
  - Integrasi API pihak ketiga tingkat lanjut

## 🏆 Kriteria Keberhasilan (Success Metrics)
- [ ] Mengurangi tingkat kesalahan pengguna minimal 25%
- [ ] Waktu respon interaksi di bawah 100ms
`,
  },
  {
    id: 'blank-note',
    name: 'Catatan Kosong (Blank Note)',
    titlePattern: 'Catatan Baru',
    description: 'Mulai dengan lembaran kosong tanpa format bawaan.',
    category: 'Umum',
    iconName: 'file-text',
    tags: [],
    content: '',
  },
];

// Fallback in-memory jika localStorage tidak tersedia (misal saat SSR / testing)
let memoryCustomTemplates: NoteTemplate[] = [];

/**
 * Ambil daftar template bawaan
 */
export function getBuiltinTemplates(): NoteTemplate[] {
  return BUILTIN_TEMPLATES;
}

/**
 * Ambil daftar template buatan pengguna dari localStorage
 */
export function getUserTemplates(): NoteTemplate[] {
  if (typeof window === 'undefined' || !window.localStorage) {
    return memoryCustomTemplates;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Simpan template kustom baru atau perbarui yang ada
 */
export function saveUserTemplate(
  data: Omit<NoteTemplate, 'id' | 'isCustom' | 'created_at'> & { id?: string },
): NoteTemplate {
  const current = getUserTemplates();
  const id = data.id || `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const template: NoteTemplate = {
    ...data,
    id,
    isCustom: true,
    created_at: new Date().toISOString(),
  };

  const existingIdx = current.findIndex((t) => t.id === id);
  let updated: NoteTemplate[];
  if (existingIdx >= 0) {
    updated = [...current];
    updated[existingIdx] = template;
  } else {
    updated = [template, ...current];
  }

  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // ignore quota error
    }
  } else {
    memoryCustomTemplates = updated;
  }

  return template;
}

/**
 * Hapus template kustom berdasarkan ID
 */
export function deleteUserTemplate(id: string): boolean {
  const current = getUserTemplates();
  const filtered = current.filter((t) => t.id !== id);
  if (filtered.length === current.length) return false;

  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    } catch {
      // ignore
    }
  } else {
    memoryCustomTemplates = filtered;
  }

  return true;
}

/**
 * Gabungan seluruh template (bawaan + kustom)
 */
export function getAllTemplates(): NoteTemplate[] {
  const user = getUserTemplates();
  return [...user, ...BUILTIN_TEMPLATES];
}

/**
 * Cari template berdasarkan ID
 */
export function getTemplateById(id: string): NoteTemplate | undefined {
  return getAllTemplates().find((t) => t.id === id);
}

/**
 * Menerapkan template ke catatan:
 * Menginterpolasi titlePattern dan content dengan variabel terkini.
 */
export function applyTemplate(
  template: NoteTemplate,
  options?: {
    currentContent?: string;
    variables?: Record<string, string>;
    append?: boolean;
  },
): { title: string; content: string } {
  const vars = options?.variables ?? {};
  const evaluatedTitle = renderTemplateString(template.titlePattern, vars);
  const evaluatedContent = renderTemplateString(template.content, vars);

  if (options?.append && options?.currentContent?.trim()) {
    return {
      title: evaluatedTitle,
      content: `${options.currentContent.trim()}\n\n---\n\n${evaluatedContent}`,
    };
  }

  return {
    title: evaluatedTitle,
    content: evaluatedContent,
  };
}
