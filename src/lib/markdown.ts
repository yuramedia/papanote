import { marked } from 'marked';
import { getTagColor } from './tags';

// Konfigurasi dasar marked
marked.setOptions({
  gfm: true,
  breaks: true,
});

/**
 * Render teks markdown menjadi HTML dengan dukungan:
 * 1. Standard GFM (heading, bold, italic, code, blockquote, link, list)
 * 2. Obsidian Wikilinks `[[Judul Catatan]]` atau `[[id-atau-slug|Label]]`
 * 3. Obsidian Tags `#tag`, `#project/papanote` dengan pewarnaan dinamis
 * 4. Interactive Task Checkbox placeholder
 */
export function renderMarkdown(content: string, onWikilinkClickAttr = 'data-wikilink'): string {
  if (!content) return '<p class="text-slate-400 italic">Belum ada catatan markdown. Klik "Edit" untuk mulai menulis...</p>';

  // 1. Simpan blok kode sementara agar isi kode tidak diubah oleh wikilink atau tag
  const codeBlocks: string[] = [];
  let protectedContent = content.replace(/(```[\s\S]*?```|`[^`\n]*`)/g, (match) => {
    codeBlocks.push(match);
    return `%%CODE_BLOCK_${codeBlocks.length - 1}%%`;
  });

  // 2. Simpan wikilink sementara agar tidak tertukar dengan tag
  const wikilinks: string[] = [];
  protectedContent = protectedContent.replace(/\[\[(.*?)\]\]/g, (match) => {
    wikilinks.push(match);
    return `%%WIKILINK_${wikilinks.length - 1}%%`;
  });

  // 3. Parsing obsidian-style tags: #tag, #project/papanote
  // Hindari heading (diawali '# '), hex colors (#fff, #38bdf8), dan angka murni (#123)
  protectedContent = protectedContent.replace(
    /(^|[\s([{"'<])#([a-zA-Z0-9_\-\/]+)(?=[\s)\]}"'>,.;:!?]|$)/g,
    (fullMatch, prefix: string, tag: string) => {
      if (/^\d+$/.test(tag)) return fullMatch;
      if (/^[\/\-_]|[\/\-_]$/.test(tag)) return fullMatch;
      if (tag.includes('//')) return fullMatch;
      if (/^[0-9a-fA-F]{3}$/.test(tag) || /^[0-9a-fA-F]{6}$/.test(tag) || /^[0-9a-fA-F]{8}$/.test(tag)) {
        return fullMatch;
      }

      const style = getTagColor(tag);
      return `${prefix}<span class="obsidian-tag inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-xs font-medium ${style.bg} ${style.text} border ${style.border} cursor-pointer transition select-none hover:shadow-xs" data-tag="${tag.toLowerCase()}"><span class="opacity-60">#</span>${tag}</span>`;
    }
  );

  // 4. Kembalikan dan parse wikilinks
  protectedContent = protectedContent.replace(/%%WIKILINK_(\d+)%%/g, (_, idx) => {
    const raw = wikilinks[Number(idx)] ?? '';
    const inner = raw.slice(2, -2);
    const parts = inner.split('|');
    const target = parts[0].trim();
    const label = (parts[1] || parts[0]).trim();
    return `<a href="javascript:void(0)" class="obsidian-wikilink text-brand-600 bg-brand-50 hover:bg-brand-100 px-1 py-0.5 rounded font-medium no-underline inline-flex items-center gap-0.5 transition" ${onWikilinkClickAttr}="${encodeURIComponent(target)}"><span class="opacity-60 text-xs">[[</span>${label}<span class="opacity-60 text-xs">]]</span></a>`;
  });

  // 5. Kembalikan blok kode
  protectedContent = protectedContent.replace(/%%CODE_BLOCK_(\d+)%%/g, (_, idx) => {
    return codeBlocks[Number(idx)] ?? '';
  });

  return marked.parse(protectedContent) as string;
}
