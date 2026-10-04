import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
} from 'docx';
import { byPosition } from './merge';
import { formatDateTime } from './format';
import type { Board, Card, List } from './types';

export interface OutlineCard {
  title: string;
  uploadedAt: string;
  deadline: string | null;
  lines: string[];
}
export interface OutlineList {
  title: string;
  cards: OutlineCard[];
}
export interface BoardOutline {
  title: string;
  exportedAt: string;
  lists: OutlineList[];
}

/** Susun struktur dokumen: papan → list (urut posisi) → kartu (urut posisi). */
export function buildOutline(board: Pick<Board, 'title'>, lists: List[], cards: Card[], now = new Date()): BoardOutline {
  return {
    title: board.title,
    exportedAt: formatDateTime(now.toISOString()),
    lists: [...lists]
      .filter((l) => !l.deleted_at)
      .sort(byPosition)
      .map((l) => ({
        title: l.title,
        cards: cards
          .filter((c) => c.list_id === l.id && !c.deleted_at)
          .sort(byPosition)
          .map((c) => ({
            title: c.title,
            uploadedAt: formatDateTime(c.uploaded_at),
            deadline: c.deadline_date ? formatDateTime(c.deadline_date) : null,
            lines: (c.content ?? '').split(/\r?\n/),
          })),
      })),
  };
}

function meta(label: string, value: string): TextRun[] {
  return [
    new TextRun({ text: `${label}: `, bold: true, size: 18, color: '64748B' }),
    new TextRun({ text: value, size: 18, color: '64748B' }),
  ];
}

export function buildDocument(outline: BoardOutline): Document {
  const children: Paragraph[] = [
    new Paragraph({ text: outline.title, heading: HeadingLevel.TITLE }),
    new Paragraph({ children: meta('Diekspor', outline.exportedAt), spacing: { after: 300 } }),
  ];

  if (outline.lists.length === 0) {
    children.push(new Paragraph({ children: [new TextRun({ text: 'Papan ini masih kosong.', italics: true })] }));
  }

  for (const list of outline.lists) {
    children.push(
      new Paragraph({
        text: list.title,
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 360, after: 120 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'CBD5E1', space: 4 } },
      }),
    );
    if (list.cards.length === 0) {
      children.push(new Paragraph({ children: [new TextRun({ text: '(Tidak ada kartu)', italics: true, color: '94A3B8' })] }));
    }
    for (const card of list.cards) {
      children.push(new Paragraph({ text: card.title, heading: HeadingLevel.HEADING_2, spacing: { before: 200 } }));
      const metaRuns = [...meta('Diunggah', card.uploadedAt)];
      if (card.deadline) metaRuns.push(new TextRun({ text: '   ' }), ...meta('Tenggat', card.deadline));
      children.push(new Paragraph({ children: metaRuns, spacing: { after: 80 } }));
      const hasContent = card.lines.some((l) => l.trim() !== '');
      if (hasContent) {
        for (const line of card.lines) {
          children.push(new Paragraph({ children: [new TextRun(line)], alignment: AlignmentType.LEFT }));
        }
      }
    }
  }

  return new Document({
    creator: 'papanote',
    title: outline.title,
    styles: { default: { document: { run: { font: 'Calibri', size: 22 } } } },
    sections: [{ children }],
  });
}

export function exportFileName(title: string, now = new Date()): string {
  const slug = title.trim().replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, '-') || 'papan';
  const d = now.toISOString().slice(0, 10);
  return `${slug}-${d}.docx`;
}

/** Bangun & unduh berkas .docx di browser (tanpa server). */
export async function exportBoardDocx(board: Board, lists: List[], cards: Card[]): Promise<void> {
  const blob = await Packer.toBlob(buildDocument(buildOutline(board, lists, cards)));
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = exportFileName(board.title);
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
