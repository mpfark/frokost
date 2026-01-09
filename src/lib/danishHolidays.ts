import { addDays, startOfDay, isWeekend, isBefore, isAfter, addYears } from "date-fns";

export interface DanishHoliday {
  date: Date;
  name: string;
  official: boolean;
}

/**
 * Calculate Easter Sunday for a given year using the Computus algorithm
 * (Anonymous Gregorian algorithm)
 */
function calculateEasterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

/**
 * Get all Danish holidays for a given year
 */
function getHolidaysForYear(year: number): DanishHoliday[] {
  const easter = calculateEasterSunday(year);
  
  const holidays: DanishHoliday[] = [
    // Fixed date holidays
    { date: new Date(year, 0, 1), name: "Nytårsdag", official: true },
    { date: new Date(year, 11, 25), name: "Juledag", official: true },
    { date: new Date(year, 11, 26), name: "2. juledag", official: true },
    
    // Easter-based holidays
    { date: addDays(easter, -3), name: "Skærtorsdag", official: true },
    { date: addDays(easter, -2), name: "Langfredag", official: true },
    { date: easter, name: "Påskedag", official: true },
    { date: addDays(easter, 1), name: "2. påskedag", official: true },
    { date: addDays(easter, 39), name: "Kristi Himmelfartsdag", official: true },
    { date: addDays(easter, 49), name: "Pinsedag", official: true },
    { date: addDays(easter, 50), name: "2. pinsedag", official: true },
    
    // Optional holidays (commonly closed but not official)
    { date: new Date(year, 5, 5), name: "Grundlovsdag", official: false },
    { date: new Date(year, 11, 24), name: "Juleaftensdag", official: false },
    { date: new Date(year, 11, 31), name: "Nytårsaftensdag", official: false },
  ];
  
  return holidays;
}

/**
 * Get upcoming Danish holidays from today until max 1 year in the future.
 * Filters out weekends since there's typically no lunch on weekends.
 */
export function getUpcomingDanishHolidays(): DanishHoliday[] {
  const today = startOfDay(new Date());
  const oneYearFromNow = addYears(today, 1);
  const currentYear = today.getFullYear();
  
  // Get holidays for current year and next year to cover the full year ahead
  const allHolidays = [
    ...getHolidaysForYear(currentYear),
    ...getHolidaysForYear(currentYear + 1),
  ];
  
  return allHolidays
    .filter(holiday => {
      const holidayDate = startOfDay(holiday.date);
      // Only include holidays that are in the future and within 1 year
      return !isBefore(holidayDate, today) && 
             !isAfter(holidayDate, oneYearFromNow) &&
             !isWeekend(holidayDate);
    })
    .sort((a, b) => a.date.getTime() - b.date.getTime());
}

/**
 * Filter out holidays that are already closed
 */
export function filterAlreadyClosedHolidays(
  holidays: DanishHoliday[], 
  closedDates: { date: string }[]
): DanishHoliday[] {
  const closedDateStrings = new Set(
    closedDates.map(cd => startOfDay(new Date(cd.date)).toISOString())
  );
  
  return holidays.filter(
    holiday => !closedDateStrings.has(startOfDay(holiday.date).toISOString())
  );
}
