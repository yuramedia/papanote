import { supabase } from './supabase';

/**
 * Ekstraksi URL gambar pertama dari teks markdown atau tag HTML img.
 * Digunakan sebagai Cover Image / Thumbnail kartu.
 */
export function extractFirstImage(content: string | null | undefined): string | null {
  if (!content) return null;
  // Match Markdown image: ![alt](url)
  const mdMatch = content.match(/!\[.*?\]\((https?:\/\/[^\s)]+|data:image\/[^)]+)\)/);
  if (mdMatch) return mdMatch[1];

  // Match HTML tag: <img src="url" ...>
  const htmlMatch = content.match(/<img[^>]+src=["'](https?:\/\/[^"']+|data:image\/[^"']+)["']/i);
  if (htmlMatch) return htmlMatch[1];

  return null;
}

/**
 * Bersihkan teks dari format gambar & header untuk cuplikan pratinjau kartu yang rapi.
 */
export function cleanSnippet(content: string | null | undefined): string {
  if (!content) return '';
  return content
    .replace(/!\[.*?\]\(.*?\)/g, '')
    .replace(/<img[^>]*>/gi, '')
    .replace(/^#+\s+/gm, '')
    .replace(/\[\[(.*?)\]\]/g, '$1')
    .trim();
}

/**
 * Kompresi gambar menjadi Data URL (Base64 JPEG/WebP) jika bucket Supabase belum diset.
 */
export async function compressImageToBase64(file: File, maxWidth = 1200, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    // Jika bukan di browser (lingkungan test), baca langsung sebagai data URL
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
      return;
    }

    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      let { width, height } = img;
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(objectUrl);
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);

      const mimeType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
      resolve(canvas.toDataURL(mimeType, quality));
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    };

    img.src = objectUrl;
  });
}

/**
 * Unggah berkas gambar lampiran:
 * 1. Coba simpan ke Supabase Storage (bucket 'attachments')
 * 2. Jika bucket belum ada atau gagal, fallback otomatis ke Data URL Base64 yang dikompres
 */
export async function uploadAttachment(
  file: File,
  pathPrefix = 'cards',
): Promise<{ url: string; name: string }> {
  const ext = file.name.split('.').pop() || 'png';
  const cleanName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const filename = `${pathPrefix}/${Date.now()}-${cleanName}`;

  try {
    const { data, error } = await supabase().storage.from('attachments').upload(filename, file, {
      cacheControl: '3600',
      upsert: true,
    });

    if (!error && data) {
      const { data: pub } = supabase().storage.from('attachments').getPublicUrl(filename);
      if (pub?.publicUrl) {
        return { url: pub.publicUrl, name: file.name };
      }
    }
  } catch {
    // Abaikan error jaringan storage dan gunakan fallback kompresi Base64
  }

  // Fallback: Data URL Base64
  const base64Url = await compressImageToBase64(file);
  return { url: base64Url, name: file.name };
}

/**
 * Sisipkan kode Markdown gambar ke posisi kursor yang sesuai.
 */
export function insertImageMarkdown(
  content: string,
  url: string,
  alt = 'Lampiran Gambar',
  cursorPos?: number,
): { newContent: string; newCursor: number } {
  const md = `\n![${alt}](${url})\n`;
  if (typeof cursorPos !== 'number' || cursorPos < 0 || cursorPos > content.length) {
    const newContent = content ? `${content.trimEnd()}\n${md}` : md.trimStart();
    return { newContent, newCursor: newContent.length };
  }

  const before = content.slice(0, cursorPos);
  const after = content.slice(cursorPos);
  const newContent = `${before}${md}${after}`;
  return { newContent, newCursor: cursorPos + md.length };
}
