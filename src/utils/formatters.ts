/**
 * Formatting utilities for dates, deadlines, and urgency metrics.
 */

export function formatHoursRemaining(hours: number | null): string {
  if (hours === null) return 'No deadline';

  if (hours < 0) {
    const overdueMinutes = Math.round(Math.abs(hours) * 60);
    if (overdueMinutes < 60) {
      return `Overdue by ${overdueMinutes}m`;
    }
    const h = Math.floor(overdueMinutes / 60);
    const m = overdueMinutes % 60;
    return m > 0 ? `Overdue by ${h}h ${m}m` : `Overdue by ${h}h`;
  }

  const minutesRemaining = Math.round(hours * 60);
  if (minutesRemaining < 60) {
    return `Due in ${minutesRemaining}m`;
  }

  const h = Math.floor(minutesRemaining / 60);
  const m = minutesRemaining % 60;

  if (h < 24) {
    return m > 0 ? `Due in ${h}h ${m}m` : `Due in ${h}h`;
  }

  const days = Math.floor(h / 24);
  const remHours = h % 24;
  return remHours > 0 ? `Due in ${days}d ${remHours}h` : `Due in ${days}d`;
}

export function formatDeadlineDate(isoString: string | null): string {
  if (!isoString) return 'No deadline';
  const date = new Date(isoString);
  const now = new Date();

  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrow =
    date.getDate() === tomorrow.getDate() &&
    date.getMonth() === tomorrow.getMonth() &&
    date.getFullYear() === tomorrow.getFullYear();

  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (isToday) return `Today at ${timeStr}`;
  if (isTomorrow) return `Tomorrow at ${timeStr}`;

  return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })} at ${timeStr}`;
}

export function formatTimeRange(start: Date, end: Date): string {
  const startStr = start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const endStr = end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return `${startStr} – ${endStr}`;
}
