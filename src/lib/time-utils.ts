import { differenceInMinutes, parseISO, getDaysInMonth, format, isWeekend, addHours } from 'date-fns';
import type { AppData } from './local-storage';

export const DAILY_STANDARD_HOURS = 8;
export const LUNCH_BREAK_HOURS = 1;
export const LUNCH_DEDUCT_THRESHOLD = 6;

export function formatDuration(hoursDecimal: number): string {
  const negative = hoursDecimal < 0;
  const abs = Math.abs(hoursDecimal);
  if (isNaN(abs)) return '0 時 00 分鐘';
  const hours = Math.floor(abs);
  const minutes = Math.round((abs - hours) * 60);
  const prefix = negative ? '-' : '';
  return `${prefix}${hours} 時 ${minutes.toString().padStart(2, '0')} 分鐘`;
}

export function calculateWorkedHours(clockInIso: string | null, clockOutIso: string | null): number {
  if (!clockInIso) return 0;

  const inTime = parseISO(clockInIso);
  const outTime = clockOutIso ? parseISO(clockOutIso) : new Date();

  let diffMinutes = differenceInMinutes(outTime, inTime);

  if (diffMinutes < 0) {
    diffMinutes += 24 * 60;
  }

  let workedHours = diffMinutes / 60;

  if (workedHours >= LUNCH_DEDUCT_THRESHOLD) {
    workedHours -= LUNCH_BREAK_HOURS;
  }

  return Math.max(0, workedHours);
}

export function getEffectiveDailyHours(dateStr: string, data: AppData): number {
  const record = data.workRecords[dateStr];
  const worked = record ? calculateWorkedHours(record.clockIn, record.clockOut) : 0;
  const leaves = data.leaveRecords.filter(l => l.date === dateStr);
  const leaveHours = leaves.reduce((sum, l) => sum + l.hours, 0);
  return worked + leaveHours;
}

export function isHoliday(dateStr: string, data: AppData): boolean {
  return data.holidays?.includes(dateStr) ?? false;
}

export function getDefaultMonthlyStandardHours(year: number, month: number, data?: AppData): number {
  const daysInMonth = getDaysInMonth(new Date(year, month - 1, 1));
  let workDays = 0;
  for (let i = 1; i <= daysInMonth; i++) {
    const d = new Date(year, month - 1, i);
    const dateStr = format(d, 'yyyy-MM-dd');
    if (!isWeekend(d) && !(data && isHoliday(dateStr, data))) {
      workDays++;
    }
  }
  return workDays * DAILY_STANDARD_HOURS;
}

export function getMonthlyStandardHours(year: number, month: number, data: AppData): number {
  const key = `${year}-${month.toString().padStart(2, '0')}`;
  if (data.monthlyStandardOverrides && data.monthlyStandardOverrides[key] !== undefined) {
    return data.monthlyStandardOverrides[key];
  }
  return getDefaultMonthlyStandardHours(year, month, data);
}

export function getMonthlyActualHours(year: number, month: number, data: AppData): number {
  const daysInMonth = getDaysInMonth(new Date(year, month - 1, 1));
  let totalHours = 0;
  for (let i = 1; i <= daysInMonth; i++) {
    const dayStr = format(new Date(year, month - 1, i), 'yyyy-MM-dd');
    totalHours += getEffectiveDailyHours(dayStr, data);
  }
  return totalHours;
}

export function getMonthlyExpectedHoursToDate(year: number, month: number, data: AppData, today: Date): number {
  const todayYear = today.getFullYear();
  const todayMonth = today.getMonth() + 1;
  const todayDay = today.getDate();

  if (year > todayYear || (year === todayYear && month > todayMonth)) return 0;

  if (year < todayYear || (year === todayYear && month < todayMonth)) {
    return getMonthlyStandardHours(year, month, data);
  }

  let workDays = 0;
  for (let i = 1; i <= todayDay; i++) {
    const d = new Date(year, month - 1, i);
    const dateStr = format(d, 'yyyy-MM-dd');
    if (!isWeekend(d) && !isHoliday(dateStr, data)) {
      workDays++;
    }
  }
  return workDays * DAILY_STANDARD_HOURS;
}

export function getMonthlyDiffThroughYesterday(year: number, month: number, data: AppData, today: Date): { diff: number; throughToday: boolean } {
  const todayYear = today.getFullYear();
  const todayMonth = today.getMonth() + 1;
  const todayDay = today.getDate();

  if (year > todayYear || (year === todayYear && month > todayMonth)) return { diff: 0, throughToday: false };

  if (year < todayYear || (year === todayYear && month < todayMonth)) {
    return {
      diff: getMonthlyActualHours(year, month, data) - getMonthlyStandardHours(year, month, data),
      throughToday: true,
    };
  }

  const todayStr = format(today, 'yyyy-MM-dd');
  const todayRecord = data.workRecords[todayStr];
  const todayComplete = !!(todayRecord?.clockOut);

  const lastDay = todayComplete ? todayDay : todayDay - 1;
  if (lastDay <= 0) return { diff: 0, throughToday: false };

  let expectedHours = 0;
  let actualHours = 0;
  for (let i = 1; i <= lastDay; i++) {
    const d = new Date(year, month - 1, i);
    const dateStr = format(d, 'yyyy-MM-dd');
    if (!isWeekend(d) && !isHoliday(dateStr, data)) {
      expectedHours += DAILY_STANDARD_HOURS;
    }
    actualHours += getEffectiveDailyHours(dateStr, data);
  }
  return { diff: actualHours - expectedHours, throughToday: todayComplete };
}

export function getEstimatedClockOut(clockInIso: string | null, leaveHours: number = 0): Date | null {
  if (!clockInIso) return null;
  const requiredHours = Math.max(0, DAILY_STANDARD_HOURS - leaveHours);
  if (requiredHours <= 0) return null;
  const clockIn = parseISO(clockInIso);
  const lunchAdd = requiredHours + LUNCH_BREAK_HOURS >= LUNCH_DEDUCT_THRESHOLD ? LUNCH_BREAK_HOURS : 0;
  return addHours(clockIn, requiredHours + lunchAdd);
}
