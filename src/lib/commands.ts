export interface PaletteCommand {
  id: string;
  title: string;
  description?: string;
  category: 'Tampilan' | 'Aksi' | 'Papan' | 'Filter';
  shortcut?: string;
  keywords?: string[];
  iconName:
    | 'kanban'
    | 'notes'
    | 'calendar'
    | 'graph'
    | 'canvas'
    | 'plus'
    | 'list-plus'
    | 'export'
    | 'users'
    | 'filter-x'
    | 'home';
  action: () => void | Promise<void>;
}

/**
 * Memfilter daftar perintah berdasarkan query.
 * Otomatis menghapus awalan '>' jika ada.
 */
export function filterCommands(commands: PaletteCommand[], query: string): PaletteCommand[] {
  let cleanQuery = query.trim().toLowerCase();
  if (cleanQuery.startsWith('>')) {
    cleanQuery = cleanQuery.slice(1).trim();
  }

  if (!cleanQuery) return commands;

  return commands.filter((cmd) => {
    const titleMatch = cmd.title.toLowerCase().includes(cleanQuery);
    const descMatch = cmd.description ? cmd.description.toLowerCase().includes(cleanQuery) : false;
    const catMatch = cmd.category.toLowerCase().includes(cleanQuery);
    const keywordMatch = cmd.keywords ? cmd.keywords.some((k) => k.toLowerCase().includes(cleanQuery)) : false;
    return titleMatch || descMatch || catMatch || keywordMatch;
  });
}
