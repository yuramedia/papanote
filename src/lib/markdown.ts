import { marked } from 'marked';

// Konfigurasi dasar marked
marked.setOptions({
  gfm: true,
  breaks: true,
});

/**
 * Render teks markdown menjadi HTML dengan dukungan:
 * 1. Standard GFM (heading, bold, italic, code, blockquote, link, list)
 * 2. Obsidian Wikilinks `[[Judul Catatan]]` atau `[[id-atau-slug|Label]]`
 * 3. Interactive Task Checkbox placeholder
 */
export function renderMarkdown(content: string, onWikilinkClickAttr = 'data-wikilink'): string {
  if (!content) return '<p class="text-slate-400 italic">Belum ada catatan markdown. Klik "Edit" untuk mulai menulis...</p>';

  // Parsing obsidian-style wikilinks: [[Target]] atau [[Target|Alias]]
  const transformed = content.replace(/\[\[(.*?)\]\]/g, (_, match: string) => {
    const parts = match.split('|');
    const target = parts[0].trim();
    const label = (parts[1] || parts[0]).trim();
    return `<a href="#wikilink" class="obsidian-wikilink text-brand-600 bg-brand-50 hover:bg-brand-100 px-1 py-0.5 rounded font-medium no-underline inline-flex items-center gap-0.5 transition" ${onWikilinkClickAttr}="${encodeURIComponent(target)}"><span class="opacity-60 text-xs">[[</span>${label}<span class="opacity-60 text-xs">]]</span></a>`;
  });

  return marked.parse(transformed) as string;
}
