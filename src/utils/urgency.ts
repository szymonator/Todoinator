import { Task, TaskUrgencyInfo, UrgencyTier } from '../types/task';

// Exponential decay parameters:
// F(H) = 1 + K * exp(-lambda * H)
// K = 8.0, lambda = 0.04 gives:
// H = 6h (due today): F ~ 7.29 -> Priority 3 score = 21.88
// H = 168h (due next week): F ~ 1.01 -> Priority 5 score = 5.05
// Priority 3 due today naturally overtakes Priority 5 due next week!
const DECAY_K = 8.0;
const DECAY_LAMBDA = 0.04;

/**
 * Calculates the True Urgency score and metadata for a single task.
 */
export function evaluateTaskUrgency(
  task: Task,
  allTasks: Task[],
  now: Date = new Date()
): TaskUrgencyInfo {
  const taskMap = new Map<string, Task>(allTasks.map((t) => [t.id, t]));

  // Find active blockers (tasks in blockedBy that are NOT completed)
  const activeBlockers: Task[] = [];
  for (const blockerId of task.blockedBy) {
    const blocker = taskMap.get(blockerId);
    if (blocker && !blocker.completed) {
      activeBlockers.push(blocker);
    }
  }

  const isBlocked = activeBlockers.length > 0;
  const blockingTaskNames = activeBlockers.map((b) => b.title);

  // Find downstream tasks that this task is actively blocking
  const blockedTasks = allTasks.filter(
    (t) => !t.completed && t.blockedBy.includes(task.id)
  );
  const blockedTaskNames = blockedTasks.map((t) => t.title);

  let hoursRemaining: number | null = null;
  let decayFactor = 1.0;
  let score = task.basePriority * 1.0;
  let tier: UrgencyTier = 'low';

  if (task.completed) {
    score = 0;
    tier = 'low';
  } else if (task.deadline) {
    const deadlineTime = new Date(task.deadline).getTime();
    const currentTime = now.getTime();
    const diffMs = deadlineTime - currentTime;
    hoursRemaining = diffMs / (1000 * 60 * 60);

    if (hoursRemaining <= 0) {
      // Overdue: critical escalation with penalty for hours past due
      const overdueHours = Math.abs(hoursRemaining);
      decayFactor = 1.0 + DECAY_K + overdueHours * 0.5;
      score = task.basePriority * decayFactor;
      tier = 'overdue';
    } else {
      // Future deadline: exponential decay based on hours remaining
      decayFactor = 1.0 + DECAY_K * Math.exp(-DECAY_LAMBDA * hoursRemaining);
      score = task.basePriority * decayFactor;

      if (score >= 20 || hoursRemaining <= 8) {
        tier = 'critical';
      } else if (score >= 12 || hoursRemaining <= 24) {
        tier = 'urgent';
      } else if (score >= 6 || hoursRemaining <= 72) {
        tier = 'moderate';
      } else {
        tier = 'low';
      }
    }
  } else {
    // No deadline: base priority multiplier is 1.0
    decayFactor = 1.0;
    score = task.basePriority * 1.0;
    tier = task.basePriority >= 4 ? 'moderate' : 'low';
  }

  if (isBlocked && !task.completed) {
    tier = 'blocked';
  }

  return {
    task,
    score: Math.round(score * 10) / 10, // 1 decimal place
    hoursRemaining: hoursRemaining !== null ? Math.round(hoursRemaining * 10) / 10 : null,
    decayFactor: Math.round(decayFactor * 100) / 100,
    isBlocked,
    blockingTaskNames,
    blockedTaskNames,
    tier,
  };
}

/**
 * Sorts tasks by the True Urgency algorithm:
 * 1. Do Now (incomplete, unblocked) tasks sorted by Urgency Score DESC
 * 2. Blocked tasks sorted by Urgency Score DESC (placed after Do Now tasks)
 * 3. Completed tasks sorted by completedAt DESC
 */
export function sortTasksByTrueUrgency(
  tasks: Task[],
  now: Date = new Date()
): {
  all: TaskUrgencyInfo[];
  doNow: TaskUrgencyInfo[];
  blocked: TaskUrgencyInfo[];
  completed: TaskUrgencyInfo[];
} {
  const evaluated = tasks.map((task) => evaluateTaskUrgency(task, tasks, now));

  const doNow: TaskUrgencyInfo[] = [];
  const blocked: TaskUrgencyInfo[] = [];
  const completed: TaskUrgencyInfo[] = [];

  for (const info of evaluated) {
    if (info.task.completed) {
      completed.push(info);
    } else if (info.isBlocked) {
      blocked.push(info);
    } else {
      doNow.push(info);
    }
  }

  // Sort Do Now tasks by urgency score descending
  doNow.sort((a, b) => b.score - a.score);

  // Sort blocked tasks by urgency score descending
  blocked.sort((a, b) => b.score - a.score);

  // Sort completed tasks by completedAt descending
  completed.sort((a, b) => {
    const timeA = a.task.completedAt ? new Date(a.task.completedAt).getTime() : 0;
    const timeB = b.task.completedAt ? new Date(b.task.completedAt).getTime() : 0;
    return timeB - timeA;
  });

  return {
    all: [...doNow, ...blocked, ...completed],
    doNow,
    blocked,
    completed,
  };
}

/**
 * Detects whether adding `candidateBlockerId` as a blocker for `taskId` would create a dependency cycle.
 * Uses Depth-First Search (DFS) traversal.
 */
export function wouldCreateCycle(
  taskId: string,
  candidateBlockerId: string,
  tasks: Task[]
): boolean {
  if (taskId === candidateBlockerId) {
    return true;
  }

  const taskMap = new Map<string, Task>(tasks.map((t) => [t.id, t]));
  const visited = new Set<string>();

  // Check if candidateBlockerId already depends on taskId directly or indirectly
  function dfs(currentId: string): boolean {
    if (currentId === taskId) {
      return true;
    }
    if (visited.has(currentId)) {
      return false;
    }
    visited.add(currentId);

    const currentTask = taskMap.get(currentId);
    if (!currentTask) return false;

    for (const blockerId of currentTask.blockedBy) {
      if (dfs(blockerId)) {
        return true;
      }
    }
    return false;
  }

  return dfs(candidateBlockerId);
}
