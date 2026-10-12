export interface CalendarDay {
  date: Date;
  dateKey: string; // "YYYY-MM-DD"
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  isWeekend: boolean;
}

export function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getMonthDays(year: number, month: number): CalendarDay[] {
  // month is 0-indexed (0 = Jan, 11 = Dec)
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  // ISO: Monday = 0, Sunday = 6
  const startDayOfWeek = firstDay.getDay(); // 0 is Sunday, 1 is Monday
  const mondayOffset = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;

  const todayKey = toDateKey(new Date());
  const days: CalendarDay[] = [];

  // Padding hari dari bulan sebelumnya
  const prevMonthLastDate = new Date(year, month, 0).getDate();
  for (let i = mondayOffset - 1; i >= 0; i--) {
    const d = new Date(year, month - 1, prevMonthLastDate - i);
    const key = toDateKey(d);
    const dow = d.getDay();
    days.push({
      date: d,
      dateKey: key,
      dayNumber: d.getDate(),
      isCurrentMonth: false,
      isToday: key === todayKey,
      isWeekend: dow === 0 || dow === 6,
    });
  }

  // Hari dalam bulan saat ini
  for (let i = 1; i <= lastDay.getDate(); i++) {
    const d = new Date(year, month, i);
    const key = toDateKey(d);
    const dow = d.getDay();
    days.push({
      date: d,
      dateKey: key,
      dayNumber: i,
      isCurrentMonth: true,
      isToday: key === todayKey,
      isWeekend: dow === 0 || dow === 6,
    });
  }

  // Padding untuk melengkapi baris kelipatan 7
  const remaining = (7 - (days.length % 7)) % 7;
  for (let i = 1; i <= remaining; i++) {
    const d = new Date(year, month + 1, i);
    const key = toDateKey(d);
    const dow = d.getDay();
    days.push({
      date: d,
      dateKey: key,
      dayNumber: i,
      isCurrentMonth: false,
      isToday: key === todayKey,
      isWeekend: dow === 0 || dow === 6,
    });
  }

  return days;
}

export function getWeekDays(referenceDate: Date): CalendarDay[] {
  const d = new Date(referenceDate);
  const dayOfWeek = d.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(d);
  monday.setDate(d.getDate() + mondayOffset);

  const todayKey = toDateKey(new Date());
  const days: CalendarDay[] = [];

  for (let i = 0; i < 7; i++) {
    const day = new Date(monday);
    day.setDate(monday.getDate() + i);
    const key = toDateKey(day);
    const dow = day.getDay();
    days.push({
      date: day,
      dateKey: key,
      dayNumber: day.getDate(),
      isCurrentMonth: true,
      isToday: key === todayKey,
      isWeekend: dow === 0 || dow === 6,
    });
  }
  return days;
}

export function updateDateKeepingTime(originalIso: string | null, targetDateKey: string): string {
  const [y, m, d] = targetDateKey.split('-').map(Number);
  let hours = 23;
  let minutes = 59;

  if (originalIso) {
    const orig = new Date(originalIso);
    if (!Number.isNaN(orig.getTime())) {
      hours = orig.getHours();
      minutes = orig.getMinutes();
    }
  }

  const updated = new Date(y, m - 1, d, hours, minutes, 0);
  return updated.toISOString();
}

export const MONTH_NAMES_ID = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

export const DAY_NAMES_ID = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
export const SHORT_DAY_NAMES_ID = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
