import { PriorityLevel, Task, TaskUrgencyInfo, UrgencyTier } from '../types/task';

// Two-timescale exponential decay parameters:
// F(H) = 1 + K_FAST * exp(-LAMBDA_FAST * H) + K_SLOW * exp(-LAMBDA_SLOW * H)
// - Fast component (half-life ~17h): sharp spike in the final 24-48h so P3 due today (~23.1) overtakes P5 due next week (~11.1).
// - Slow component (half-life ~9.6d): meaningful differentiation across multi-day/week deadlines (e.g. 6d vs 11d vs 27d).
const DECAY_K_FAST = 6.0;
const DECAY_LAMBDA_FAST = 0.04;
const DECAY_K_SLOW = 2.0;
const DECAY_LAMBDA_SLOW = 0.003;
const DECAY_K_TOTAL = DECAY_K_FAST + DECAY_K_SLOW; // 8.0
const INHERITED_DEADLINE_BUFFER_MS = 48 * 60 * 60 * 1000; // 2 days

interface BaseEvaluation {
  task: Task;
  rawBaseScore: number;
  ownScore: number;
  hoursRemaining: number | null;
  decayFactor: number;
  tier: UrgencyTier;
  isBlocked: boolean;
  blockingTaskNames: string[];
  blockedTaskNames: string[];
  effectiveDeadline: string | null;
  effectivePriority: PriorityLevel;
  isInheritedDeadline: boolean;
}

function deriveTier(
  score: number,
  hoursRemaining: number | null,
  basePriority: number,
  isOverdue: boolean
): UrgencyTier {
  if (isOverdue) {
    return 'overdue';
  }
  if (hoursRemaining !== null) {
    if (score >= 20 || hoursRemaining <= 8) return 'critical';
    if (score >= 12 || hoursRemaining <= 24) return 'urgent';
    if (score >= 6 || hoursRemaining <= 72) return 'moderate';
    return 'low';
  }
  if (score >= 20) return 'critical';
  if (score >= 12) return 'urgent';
  if (score >= 6 || basePriority >= 4) return 'moderate';
  return 'low';
}

/**
 * Evaluates all tasks together, resolving:
 * 1. Inherited earlier deadlines (up to 48h earlier) for blockers with no explicit deadline.
 * 2. Inherited urgency scores: a blocker's score is at least the max effective score of tasks it blocks.
 */
export function evaluateAllTasksUrgency(
  allTasks: Task[],
  now: Date = new Date()
): TaskUrgencyInfo[] {
  const taskMap = new Map<string, Task>(allTasks.map((t) => [t.id, t]));
  const nowMs = now.getTime();

  // Build adjacency list: blockerId -> incomplete downstream tasks it blocks
  const childrenMap = new Map<string, Task[]>();
  for (const t of allTasks) {
    if (t.completed) continue;
    for (const blockerId of t.blockedBy) {
      const list = childrenMap.get(blockerId) ?? [];
      list.push(t);
      childrenMap.set(blockerId, list);
    }
  }

  // 1. Resolve effectiveDeadline (memoized with cycle guard)
  const deadlineMemo = new Map<string, { deadline: string | null; inherited: boolean }>();
  const deadlineVisiting = new Set<string>();

  function resolveEffectiveDeadline(taskId: string): { deadline: string | null; inherited: boolean } {
    const cached = deadlineMemo.get(taskId);
    if (cached) return cached;

    const task = taskMap.get(taskId);
    if (!task || task.completed) {
      const res = { deadline: task?.deadline ?? null, inherited: false };
      deadlineMemo.set(taskId, res);
      return res;
    }

    if (task.deadline) {
      const res = { deadline: task.deadline, inherited: false };
      deadlineMemo.set(taskId, res);
      return res;
    }

    if (deadlineVisiting.has(taskId)) {
      return { deadline: null, inherited: false };
    }
    deadlineVisiting.add(taskId);

    let earliestMs: number | null = null;
    const children = childrenMap.get(taskId) ?? [];
    for (const child of children) {
      const childRes = resolveEffectiveDeadline(child.id);
      if (!childRes.deadline) continue;

      const childMs = new Date(childRes.deadline).getTime();
      // Give up to 48h buffer before the blocked task's deadline; if closer than 48h,
      // split the remaining time in half so the blocker isn't marked artificially overdue.
      const derivedMs =
        childMs > nowMs
          ? childMs - Math.min(INHERITED_DEADLINE_BUFFER_MS, (childMs - nowMs) * 0.5)
          : childMs;

      if (earliestMs === null || derivedMs < earliestMs) {
        earliestMs = derivedMs;
      }
    }

    deadlineVisiting.delete(taskId);

    const res =
      earliestMs !== null
        ? { deadline: new Date(earliestMs).toISOString(), inherited: true }
        : { deadline: null, inherited: false };
    deadlineMemo.set(taskId, res);
    return res;
  }

  // 2. Resolve effectivePriority (blocker inherits max basePriority of tasks it blocks)
  const priorityMemo = new Map<string, PriorityLevel>();
  const priorityVisiting = new Set<string>();

  function resolveEffectivePriority(taskId: string): PriorityLevel {
    const cached = priorityMemo.get(taskId);
    if (cached !== undefined) return cached;

    const task = taskMap.get(taskId);
    if (!task) return 1;
    if (task.completed) {
      priorityMemo.set(taskId, task.basePriority);
      return task.basePriority;
    }

    if (priorityVisiting.has(taskId)) {
      return task.basePriority;
    }
    priorityVisiting.add(taskId);

    let maxPriority: PriorityLevel = task.basePriority;
    const children = childrenMap.get(taskId) ?? [];
    for (const child of children) {
      const childPriority = resolveEffectivePriority(child.id);
      if (childPriority > maxPriority) {
        maxPriority = childPriority;
      }
    }

    priorityVisiting.delete(taskId);
    priorityMemo.set(taskId, maxPriority);
    return maxPriority;
  }

  // 3. Compute base evaluation for each task using its effectiveDeadline & effectivePriority
  const baseMap = new Map<string, BaseEvaluation>();
  for (const task of allTasks) {
    const activeBlockers: Task[] = [];
    for (const blockerId of task.blockedBy) {
      const blocker = taskMap.get(blockerId);
      if (blocker && !blocker.completed) {
        activeBlockers.push(blocker);
      }
    }

    const isBlocked = activeBlockers.length > 0;
    const blockingTaskNames = activeBlockers.map((b) => b.title);
    const blockedTasks = childrenMap.get(task.id) ?? [];
    const blockedTaskNames = blockedTasks.map((t) => t.title);

    const { deadline: effectiveDeadline, inherited: isInheritedDeadline } =
      resolveEffectiveDeadline(task.id);
    const effectivePriority = resolveEffectivePriority(task.id);

    let hoursRemaining: number | null = null;
    let decayFactor = 1.0;
    let rawBaseScore = task.basePriority * 1.0;
    let ownScore = effectivePriority * 1.0;
    let isOverdue = false;

    if (task.completed) {
      rawBaseScore = 0;
      ownScore = 0;
    } else if (effectiveDeadline) {
      const deadlineTime = new Date(effectiveDeadline).getTime();
      hoursRemaining = (deadlineTime - nowMs) / (1000 * 60 * 60);

      if (hoursRemaining <= 0) {
        const overdueHours = Math.abs(hoursRemaining);
        decayFactor = 1.0 + DECAY_K_TOTAL + overdueHours * 0.5;
        rawBaseScore = task.basePriority * decayFactor;
        ownScore = effectivePriority * decayFactor;
        isOverdue = true;
      } else {
        decayFactor =
          1.0 +
          DECAY_K_FAST * Math.exp(-DECAY_LAMBDA_FAST * hoursRemaining) +
          DECAY_K_SLOW * Math.exp(-DECAY_LAMBDA_SLOW * hoursRemaining);
        rawBaseScore = task.basePriority * decayFactor;
        ownScore = effectivePriority * decayFactor;
      }
    }

    const tier = task.completed
      ? 'low'
      : isBlocked
        ? 'blocked'
        : deriveTier(ownScore, hoursRemaining, effectivePriority, isOverdue);

    baseMap.set(task.id, {
      task,
      rawBaseScore,
      ownScore,
      hoursRemaining,
      decayFactor,
      tier,
      isBlocked,
      blockingTaskNames,
      blockedTaskNames,
      effectiveDeadline,
      effectivePriority,
      isInheritedDeadline,
    });
  }

  // 4. Resolve effectiveScore (blocker inherits max effectiveScore of tasks it blocks)
  const scoreMemo = new Map<string, number>();
  const scoreVisiting = new Set<string>();

  function resolveEffectiveScore(taskId: string): number {
    const cached = scoreMemo.get(taskId);
    if (cached !== undefined) return cached;

    const base = baseMap.get(taskId);
    if (!base) return 0;
    if (base.task.completed) {
      scoreMemo.set(taskId, 0);
      return 0;
    }

    if (scoreVisiting.has(taskId)) {
      return base.ownScore;
    }
    scoreVisiting.add(taskId);

    let maxScore = base.ownScore;
    const children = childrenMap.get(taskId) ?? [];
    for (const child of children) {
      const childScore = resolveEffectiveScore(child.id);
      if (childScore > maxScore) {
        maxScore = childScore;
      }
    }

    scoreVisiting.delete(taskId);
    scoreMemo.set(taskId, maxScore);
    return maxScore;
  }

  return allTasks.map((task) => {
    const base = baseMap.get(task.id)!;
    const effectiveScore = resolveEffectiveScore(task.id);
    const roundedRawBase = Math.round(base.rawBaseScore * 10) / 10;
    const roundedEffective = Math.round(effectiveScore * 10) / 10;
    const isInheritedScore =
      !task.completed &&
      (roundedEffective > roundedRawBase || base.effectivePriority > task.basePriority);

    let tier = base.tier;
    if (isInheritedScore && !base.isBlocked && tier !== 'overdue') {
      tier = deriveTier(effectiveScore, base.hoursRemaining, base.effectivePriority, false);
    }

    return {
      task,
      score: roundedEffective,
      hoursRemaining:
        base.hoursRemaining !== null ? Math.round(base.hoursRemaining * 10) / 10 : null,
      decayFactor: Math.round(base.decayFactor * 100) / 100,
      isBlocked: base.isBlocked,
      blockingTaskNames: base.blockingTaskNames,
      blockedTaskNames: base.blockedTaskNames,
      tier,
      effectiveDeadline: base.effectiveDeadline,
      effectivePriority: base.effectivePriority,
      isInheritedDeadline: base.isInheritedDeadline,
      isInheritedScore,
    };
  });
}

/**
 * Calculates the True Urgency score and metadata for a single task.
 */
export function evaluateTaskUrgency(
  task: Task,
  allTasks: Task[],
  now: Date = new Date()
): TaskUrgencyInfo {
  const results = evaluateAllTasksUrgency(allTasks, now);
  const match = results.find((r) => r.task.id === task.id);
  if (match) return match;

  // Fallback if task isn't in allTasks
  return evaluateAllTasksUrgency([task, ...allTasks], now)[0];
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
  const evaluated = evaluateAllTasksUrgency(tasks, now);

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

  const compareUrgency = (a: TaskUrgencyInfo, b: TaskUrgencyInfo) => {
    if (b.score !== a.score) return b.score - a.score;
    const hA = a.hoursRemaining ?? Number.POSITIVE_INFINITY;
    const hB = b.hoursRemaining ?? Number.POSITIVE_INFINITY;
    return hA - hB;
  };

  // Sort Do Now tasks by urgency score descending, then earliest deadline
  doNow.sort(compareUrgency);

  // Sort blocked tasks by urgency score descending, then earliest deadline
  blocked.sort(compareUrgency);

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
