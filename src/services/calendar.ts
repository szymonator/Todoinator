import * as Calendar from 'expo-calendar';
import { CalendarGap, SuggestedAction, Task } from '../types/task';
import { sortTasksByTrueUrgency } from '../utils/urgency';
import { formatTimeRange } from '../utils/formatters';

export interface CalendarPermissionState {
  granted: boolean;
  canAskAgain: boolean;
}

/**
 * Requests read-only calendar permissions from the device using modern Expo Calendar API.
 */
export async function requestCalendarPermissions(): Promise<CalendarPermissionState> {
  try {
    const { status, canAskAgain } = await Calendar.requestCalendarPermissions();
    return {
      granted: status === 'granted',
      canAskAgain,
    };
  } catch (err) {
    console.warn('Calendar permission error:', err);
    return { granted: false, canAskAgain: true };
  }
}

/**
 * Checks current calendar permissions status using modern Expo Calendar API.
 */
export async function getCalendarPermissionsStatus(): Promise<boolean> {
  try {
    const { status } = await Calendar.getCalendarPermissions();
    return status === 'granted';
  } catch (err) {
    return false;
  }
}

interface RawTimeInterval {
  start: Date;
  end: Date;
}

/**
 * Generates realistic mock calendar events for today to test gap detection
 * when native calendar is empty or permissions are not available.
 */
export function getMockTodayEvents(now: Date = new Date()): RawTimeInterval[] {
  const base = new Date(now);

  const event1Start = new Date(base);
  event1Start.setHours(9, 30, 0, 0);
  const event1End = new Date(base);
  event1End.setHours(10, 30, 0, 0);

  const event2Start = new Date(base);
  event2Start.setHours(12, 0, 0, 0);
  const event2End = new Date(base);
  event2End.setHours(13, 0, 0, 0);

  const event3Start = new Date(base);
  event3Start.setHours(15, 30, 0, 0);
  const event3End = new Date(base);
  event3End.setHours(16, 30, 0, 0);

  return [
    { start: event1Start, end: event1End },
    { start: event2Start, end: event2End },
    { start: event3Start, end: event3End },
  ];
}

/**
 * Scans today's schedule and discovers contiguous free gaps >= minDurationMinutes (default 60 min).
 */
export async function findTodayGaps(
  minDurationMinutes: number = 60,
  forceDemoMode: boolean = false,
  customNow: Date = new Date()
): Promise<CalendarGap[]> {
  const now = customNow;
  let busyIntervals: RawTimeInterval[] = [];

  const hasPermission = await getCalendarPermissionsStatus();

  if (hasPermission && !forceDemoMode) {
    try {
      const calendars = await Calendar.getCalendars();

      if (calendars.length > 0) {
        const startOfDay = new Date(now);
        startOfDay.setHours(0, 0, 0, 0);

        const endOfDay = new Date(now);
        endOfDay.setHours(23, 59, 59, 999);

        const events = await Calendar.listEvents(calendars, startOfDay, endOfDay);
        busyIntervals = events
          .filter((e) => !e.allDay)
          .map((e) => ({
            start: new Date(e.startDate),
            end: new Date(e.endDate),
          }));
      }
    } catch (err) {
      console.warn('Failed to fetch native calendar events, falling back to mock:', err);
      busyIntervals = getMockTodayEvents(now);
    }
  } else {
    // Demo / fallback mode
    busyIntervals = getMockTodayEvents(now);
  }

  // Define today's active window from current time (or start of day) to 21:00 (9:00 PM)
  const windowStart = new Date(now);
  // Round up to next 15-minute mark
  const remainderMinutes = 15 - (windowStart.getMinutes() % 15);
  windowStart.setMinutes(windowStart.getMinutes() + (remainderMinutes === 15 ? 0 : remainderMinutes));
  windowStart.setSeconds(0, 0);

  const windowEnd = new Date(now);
  windowEnd.setHours(21, 0, 0, 0); // Active work window until 9:00 PM

  if (windowStart.getTime() >= windowEnd.getTime()) {
    // Late at night, look at tomorrow morning's window
    return [];
  }

  // Filter and clip busy intervals to [windowStart, windowEnd]
  const relevantBusy: RawTimeInterval[] = [];
  for (const interval of busyIntervals) {
    if (interval.end <= windowStart || interval.start >= windowEnd) {
      continue;
    }
    const clippedStart = interval.start < windowStart ? windowStart : interval.start;
    const clippedEnd = interval.end > windowEnd ? windowEnd : interval.end;
    if (clippedStart < clippedEnd) {
      relevantBusy.push({ start: clippedStart, end: clippedEnd });
    }
  }

  // Sort by start time
  relevantBusy.sort((a, b) => a.start.getTime() - b.start.getTime());

  // Merge overlapping busy intervals
  const mergedBusy: RawTimeInterval[] = [];
  for (const interval of relevantBusy) {
    if (mergedBusy.length === 0) {
      mergedBusy.push({ ...interval });
    } else {
      const last = mergedBusy[mergedBusy.length - 1];
      if (interval.start.getTime() <= last.end.getTime()) {
        if (interval.end.getTime() > last.end.getTime()) {
          last.end = interval.end;
        }
      } else {
        mergedBusy.push({ ...interval });
      }
    }
  }

  // Find free gaps between windowStart, merged intervals, and windowEnd
  const gaps: CalendarGap[] = [];
  let currentPointer = new Date(windowStart);

  for (const busy of mergedBusy) {
    const gapMs = busy.start.getTime() - currentPointer.getTime();
    const gapMinutes = Math.floor(gapMs / (1000 * 60));

    if (gapMinutes >= minDurationMinutes) {
      gaps.push({
        id: `gap-${currentPointer.getTime()}`,
        start: new Date(currentPointer),
        end: new Date(busy.start),
        durationMinutes: gapMinutes,
        formattedTime: formatTimeRange(currentPointer, busy.start),
      });
    }

    if (busy.end.getTime() > currentPointer.getTime()) {
      currentPointer = new Date(busy.end);
    }
  }

  // Check remaining gap after last busy event until windowEnd
  const finalGapMs = windowEnd.getTime() - currentPointer.getTime();
  const finalGapMinutes = Math.floor(finalGapMs / (1000 * 60));
  if (finalGapMinutes >= minDurationMinutes) {
    gaps.push({
      id: `gap-${currentPointer.getTime()}`,
      start: new Date(currentPointer),
      end: new Date(windowEnd),
      durationMinutes: finalGapMinutes,
      formattedTime: formatTimeRange(currentPointer, windowEnd),
    });
  }

  return gaps;
}

/**
 * Finds the top Suggested Action by pairing the earliest/best 1-hour gap
 * with the highest-urgency Do Now task that fits.
 */
export async function getSuggestedAction(
  tasks: Task[],
  forceDemoMode: boolean = false,
  now: Date = new Date()
): Promise<SuggestedAction | null> {
  const { doNow } = sortTasksByTrueUrgency(tasks, now);
  if (doNow.length === 0) {
    return null;
  }

  const gaps = await findTodayGaps(60, forceDemoMode, now);
  if (gaps.length === 0) {
    return null;
  }

  // Pick highest-urgency Do Now task
  const topTask = doNow[0];
  // Pick first available gap today
  const bestGap = gaps[0];

  return {
    gap: bestGap,
    task: topTask,
  };
}
