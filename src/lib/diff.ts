export type DiffType = 'added' | 'removed' | 'unchanged';

export interface DiffLine {
  type: DiffType;
  text: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}

export interface DiffResult {
  lines: DiffLine[];
  additions: number;
  deletions: number;
}

/**
 * Hitung perbedaan baris demi baris antara oldText dan newText
 * menggunakan algoritma Longest Common Subsequence (LCS).
 */
export function computeLineDiff(oldText: string, newText: string): DiffResult {
  const oldLines = oldText ? oldText.split('\n') : [];
  const newLines = newText ? newText.split('\n') : [];

  const m = oldLines.length;
  const n = newLines.length;

  // Batasi ukuran tabel untuk performa jika dokumen sangat besar
  const maxLines = 800;
  if (m > maxLines || n > maxLines) {
    // Sederhanakan jika melebihi batas wajar catatan
    return {
      lines: [
        ...oldLines.map((text, idx) => ({ type: 'removed' as const, text, oldLineNumber: idx + 1 })),
        ...newLines.map((text, idx) => ({ type: 'added' as const, text, newLineNumber: idx + 1 })),
      ],
      additions: newLines.length,
      deletions: oldLines.length,
    };
  }

  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  const lines: DiffLine[] = [];
  let i = m;
  let j = n;
  let additions = 0;
  let deletions = 0;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      lines.unshift({
        type: 'unchanged',
        text: oldLines[i - 1],
        oldLineNumber: i,
        newLineNumber: j,
      });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      lines.unshift({
        type: 'added',
        text: newLines[j - 1],
        newLineNumber: j,
      });
      additions++;
      j--;
    } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
      lines.unshift({
        type: 'removed',
        text: oldLines[i - 1],
        oldLineNumber: i,
      });
      deletions++;
      i--;
    }
  }

  return { lines, additions, deletions };
}
