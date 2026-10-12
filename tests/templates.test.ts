import { describe, it, expect, beforeEach } from 'bun:test';
import {
  formatTemplateDate,
  formatTemplateTime,
  renderTemplateString,
  getBuiltinTemplates,
  getUserTemplates,
  saveUserTemplate,
  deleteUserTemplate,
  getAllTemplates,
  getTemplateById,
  applyTemplate,
  type NoteTemplate,
} from '../src/lib/templates';

describe('Sistem Template Catatan Instan', () => {
  describe('Helper Format Tanggal & Variabel', () => {
    it('formatTemplateDate mengembalikan tanggal terformat dengan nama bulan', () => {
      const fixedDate = new Date(2026, 9, 12); // 12 Oktober 2026
      const formatted = formatTemplateDate(fixedDate);
      expect(formatted).toBe('12 Okt 2026');
    });

    it('formatTemplateTime mengembalikan format jam dan menit WIB', () => {
      const fixedDate = new Date(2026, 9, 12, 14, 30);
      const formatted = formatTemplateTime(fixedDate);
      expect(formatted).toBe('14:30 WIB');
    });

    it('renderTemplateString menggantikan placeholder token dengan tepat', () => {
      const template = 'Rapat pada {{date}} jam {{time}} oleh {{user}}';
      const rendered = renderTemplateString(template, {
        date: '12 Okt 2026',
        time: '10:00 WIB',
        user: 'Andi',
      });
      expect(rendered).toBe('Rapat pada 12 Okt 2026 jam 10:00 WIB oleh Andi');
    });

    it('renderTemplateString mendukung variabel custom dan membiarkan token asing', () => {
      const template = 'Topik: {{topic}} - Target: {{target}} - Asing: {{mystery}}';
      const rendered = renderTemplateString(template, {
        topic: 'Desain Kanban',
        target: 'Q4 2026',
      });
      expect(rendered).toBe('Topik: Desain Kanban - Target: Q4 2026 - Asing: {{mystery}}');
    });
  });

  describe('Daftar Template Bawaan (Builtin Templates)', () => {
    it('memiliki 6 template standar lengkap', () => {
      const builtin = getBuiltinTemplates();
      expect(builtin.length).toBe(6);

      const ids = builtin.map((t) => t.id);
      expect(ids).toContain('meeting-notes');
      expect(ids).toContain('bug-report');
      expect(ids).toContain('project-kickoff');
      expect(ids).toContain('daily-standup');
      expect(ids).toContain('feature-spec');
      expect(ids).toContain('blank-note');
    });

    it('setiap template bawaan memiliki tagar dan kategori valid', () => {
      const builtin = getBuiltinTemplates();
      for (const t of builtin) {
        expect(t.name).toBeTruthy();
        expect(t.titlePattern).toBeTruthy();
        expect(t.category).toBeTruthy();
        expect(Array.isArray(t.tags)).toBe(true);
      }

      const bugTemplate = getTemplateById('bug-report');
      expect(bugTemplate?.tags).toContain('bug');
      expect(bugTemplate?.tags).toContain('urgent');
      expect(bugTemplate?.category).toBe('Teknis');
    });
  });

  describe('Template Kustom Pengguna (CRUD)', () => {
    it('dapat membuat, membaca, memperbarui, dan menghapus template kustom', () => {
      // 1. Simpan template kustom baru
      const created = saveUserTemplate({
        id: 'test-custom-1',
        name: 'Template Retrospektif Sprint',
        titlePattern: 'Retro Sprint {{date}}',
        description: 'Format refleksi tim di akhir sprint.',
        category: 'Produktivitas',
        iconName: 'sparkles',
        tags: ['retro', 'agile'],
        content: '# 🔄 Sprint Retrospective {{date}}\n\n## Hal Baik\n- \n\n## Perlu Ditingkatkan\n- ',
      });

      expect(created.id).toBe('test-custom-1');
      expect(created.isCustom).toBe(true);

      // 2. Baca template kustom
      const userTemplates = getUserTemplates();
      expect(userTemplates.some((t) => t.id === 'test-custom-1')).toBe(true);

      // 3. Perbarui template kustom
      saveUserTemplate({
        id: 'test-custom-1',
        name: 'Template Retro Diperbarui',
        titlePattern: 'Retro v2 {{date}}',
        description: 'Deskripsi diperbarui',
        category: 'Produktivitas',
        iconName: 'sparkles',
        tags: ['retro'],
        content: 'Isi baru',
      });

      const updated = getTemplateById('test-custom-1');
      expect(updated?.name).toBe('Template Retro Diperbarui');

      // 4. Hapus template kustom
      const deleted = deleteUserTemplate('test-custom-1');
      expect(deleted).toBe(true);

      const afterDelete = getUserTemplates();
      expect(afterDelete.some((t) => t.id === 'test-custom-1')).toBe(false);
    });
  });

  describe('applyTemplate Logic', () => {
    it('menginterpolasi judul dan isi saat diterapkan', () => {
      const template: NoteTemplate = {
        id: 'temp-1',
        name: 'Test',
        titlePattern: 'Catatan {{date}}',
        description: 'Desc',
        category: 'Umum',
        iconName: 'file-text',
        tags: ['test'],
        content: '# Halo {{user}}, ini dibuat pada {{date}}',
      };

      const applied = applyTemplate(template, {
        variables: { date: '12 Okt 2026', user: 'Budi' },
      });

      expect(applied.title).toBe('Catatan 12 Okt 2026');
      expect(applied.content).toBe('# Halo Budi, ini dibuat pada 12 Okt 2026');
    });

    it('mendukung mode append jika catatan sudah memiliki konten sebelumnya', () => {
      const template: NoteTemplate = {
        id: 'temp-append',
        name: 'Append Test',
        titlePattern: 'Judul Baru',
        description: 'Desc',
        category: 'Umum',
        iconName: 'file-text',
        tags: [],
        content: '## Konten Tambahan',
      };

      const applied = applyTemplate(template, {
        currentContent: 'Konten lama yang sudah ada',
        append: true,
      });

      expect(applied.content).toContain('Konten lama yang sudah ada');
      expect(applied.content).toContain('---');
      expect(applied.content).toContain('## Konten Tambahan');
    });
  });
});
