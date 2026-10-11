export type PriorityLevel = 1 | 2 | 3 | 4 | 5;

export interface PriorityMeta {
  level: PriorityLevel;
  label: string;
  color: string;
  badgeBg: string;
}

export const PRIORITY_MAP: Record<PriorityLevel, PriorityMeta> = {
  1: { level: 1, label: 'Low', color: '#10B981', badgeBg: 'rgba(16, 185, 129, 0.15)' },
  2: { level: 2, label: 'Medium', color: '#3B82F6', badgeBg: 'rgba(59, 130, 246, 0.15)' },
  3: { level: 3, label: 'Important', color: '#F59E0B', badgeBg: 'rgba(245, 158, 11, 0.15)' },
  4: { level: 4, label: 'High', color: '#F97316', badgeBg: 'rgba(249, 115, 22, 0.15)' },
  5: { level: 5, label: 'Critical', color: '#EF4444', badgeBg: 'rgba(239, 68, 68, 0.15)' },
};

export interface Task {
  id: string;
  title: string;
  notes?: string;
  basePriority: PriorityLevel;
  deadline: string | null; // ISO 8601 string or null
  blockedBy: string[]; // array of Task IDs that block this task
  completed: boolean;
  completedAt?: string | null;
  createdAt: string;
  estimatedDurationMinutes: number; // default 60 minutes
}

export type UrgencyTier = 'overdue' | 'critical' | 'urgent' | 'moderate' | 'low' | 'blocked';

export interface TaskUrgencyInfo {
  task: Task;
  score: number;
  hoursRemaining: number | null;
  decayFactor: number;
  isBlocked: boolean;
  blockingTaskNames: string[];
  blockedTaskNames: string[];
  tier: UrgencyTier;
}

export interface CalendarGap {
  id: string;
  start: Date;
  end: Date;
  durationMinutes: number;
  formattedTime: string;
}

export interface SuggestedAction {
  gap: CalendarGap;
  task: TaskUrgencyInfo;
}
