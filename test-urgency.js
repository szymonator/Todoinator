// Complete Verification Suite for Todoinator

// 1. Urgency Algorithm
const DECAY_K_FAST = 6.0;
const DECAY_LAMBDA_FAST = 0.04;
const DECAY_K_SLOW = 2.0;
const DECAY_LAMBDA_SLOW = 0.003;
const DECAY_K_TOTAL = DECAY_K_FAST + DECAY_K_SLOW;
const INHERITED_DEADLINE_BUFFER_MS = 48 * 60 * 60 * 1000;

function deriveTier(score, hoursRemaining, basePriority, isOverdue) {
  if (isOverdue) return 'overdue';
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

function evaluateAllTasksUrgency(allTasks, now) {
  const taskMap = new Map(allTasks.map((t) => [t.id, t]));
  const nowMs = now.getTime();

  const childrenMap = new Map();
  for (const t of allTasks) {
    if (t.completed) continue;
    for (const blockerId of t.blockedBy || []) {
      const list = childrenMap.get(blockerId) || [];
      list.push(t);
      childrenMap.set(blockerId, list);
    }
  }

  const deadlineMemo = new Map();
  const deadlineVisiting = new Set();

  function resolveEffectiveDeadline(taskId) {
    if (deadlineMemo.has(taskId)) return deadlineMemo.get(taskId);
    const task = taskMap.get(taskId);
    if (!task || task.completed) {
      const res = { deadline: task ? task.deadline : null, inherited: false };
      deadlineMemo.set(taskId, res);
      return res;
    }
    if (task.deadline) {
      const res = { deadline: task.deadline, inherited: false };
      deadlineMemo.set(taskId, res);
      return res;
    }
    if (deadlineVisiting.has(taskId)) return { deadline: null, inherited: false };
    deadlineVisiting.add(taskId);

    let earliestMs = null;
    for (const child of childrenMap.get(taskId) || []) {
      const childRes = resolveEffectiveDeadline(child.id);
      if (!childRes.deadline) continue;
      const childMs = new Date(childRes.deadline).getTime();
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

  const priorityMemo = new Map();
  const priorityVisiting = new Set();

  function resolveEffectivePriority(taskId) {
    if (priorityMemo.has(taskId)) return priorityMemo.get(taskId);
    const task = taskMap.get(taskId);
    if (!task) return 1;
    if (task.completed) {
      priorityMemo.set(taskId, task.basePriority);
      return task.basePriority;
    }
    if (priorityVisiting.has(taskId)) return task.basePriority;
    priorityVisiting.add(taskId);

    let maxPriority = task.basePriority;
    for (const child of childrenMap.get(taskId) || []) {
      const childPriority = resolveEffectivePriority(child.id);
      if (childPriority > maxPriority) maxPriority = childPriority;
    }
    priorityVisiting.delete(taskId);
    priorityMemo.set(taskId, maxPriority);
    return maxPriority;
  }

  const baseMap = new Map();
  for (const task of allTasks) {
    const activeBlockers = [];
    for (const blockerId of task.blockedBy || []) {
      const blocker = taskMap.get(blockerId);
      if (blocker && !blocker.completed) activeBlockers.push(blocker);
    }
    const isBlocked = activeBlockers.length > 0;
    const blockingTaskNames = activeBlockers.map((b) => b.title);

    const { deadline: effectiveDeadline, inherited: isInheritedDeadline } =
      resolveEffectiveDeadline(task.id);
    const effectivePriority = resolveEffectivePriority(task.id);

    let hoursRemaining = null;
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
      effectiveDeadline,
      effectivePriority,
      isInheritedDeadline,
    });
  }

  const scoreMemo = new Map();
  const scoreVisiting = new Set();

  function resolveEffectiveScore(taskId) {
    if (scoreMemo.has(taskId)) return scoreMemo.get(taskId);
    const base = baseMap.get(taskId);
    if (!base) return 0;
    if (base.task.completed) {
      scoreMemo.set(taskId, 0);
      return 0;
    }
    if (scoreVisiting.has(taskId)) return base.ownScore;
    scoreVisiting.add(taskId);

    let maxScore = base.ownScore;
    for (const child of childrenMap.get(taskId) || []) {
      const childScore = resolveEffectiveScore(child.id);
      if (childScore > maxScore) maxScore = childScore;
    }
    scoreVisiting.delete(taskId);
    scoreMemo.set(taskId, maxScore);
    return maxScore;
  }

  return allTasks.map((task) => {
    const base = baseMap.get(task.id);
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
      tier,
      effectiveDeadline: base.effectiveDeadline,
      effectivePriority: base.effectivePriority,
      isInheritedDeadline: base.isInheritedDeadline,
      isInheritedScore,
    };
  });
}

function evaluateTaskUrgency(task, allTasks, now) {
  const results = evaluateAllTasksUrgency(allTasks, now);
  return results.find((r) => r.task.id === task.id);
}

function sortTasksByTrueUrgency(tasks, now) {
  const evaluated = evaluateAllTasksUrgency(tasks, now);
  const doNow = [];
  const blocked = [];
  const completed = [];

  for (const info of evaluated) {
    if (info.task.completed) {
      completed.push(info);
    } else if (info.isBlocked) {
      blocked.push(info);
    } else {
      doNow.push(info);
    }
  }

  const compareUrgency = (a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const hA = a.hoursRemaining !== null ? a.hoursRemaining : Number.POSITIVE_INFINITY;
    const hB = b.hoursRemaining !== null ? b.hoursRemaining : Number.POSITIVE_INFINITY;
    return hA - hB;
  };

  doNow.sort(compareUrgency);
  blocked.sort(compareUrgency);
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

// 2. Cycle Detection
function wouldCreateCycle(taskId, candidateBlockerId, tasks) {
  if (taskId === candidateBlockerId) return true;
  const taskMap = new Map(tasks.map((t) => [t.id, t]));
  const visited = new Set();

  function dfs(currentId) {
    if (currentId === taskId) return true;
    if (visited.has(currentId)) return false;
    visited.add(currentId);

    const currentTask = taskMap.get(currentId);
    if (!currentTask) return false;

    for (const blockerId of currentTask.blockedBy || []) {
      if (dfs(blockerId)) return true;
    }
    return false;
  }

  return dfs(candidateBlockerId);
}

// 3. Morning Briefing Text Builder
function buildMorningBriefingText(tasks, now) {
  const { doNow } = sortTasksByTrueUrgency(tasks, now);
  const top3 = doNow.slice(0, 3);
  const title = '☀️ Todoinator Morning Briefing';

  if (top3.length === 0) {
    return {
      title,
      body: 'All caught up! You have no pending urgent tasks today.',
    };
  }

  const lines = top3.map((info, idx) => {
    const timeInfo = info.hoursRemaining !== null ? ` (due in ${info.hoursRemaining}h)` : '';
    return `${idx + 1}. ${info.task.title} [Urgency: ${info.score}]${timeInfo}`;
  });

  return {
    title,
    body: `Top ${top3.length} priorities for today:\n${lines.join('\n')}`,
  };
}

// 4. Pre-Deadline Alert Timing Check
function calculateAlertTime(deadlineIso) {
  const deadlineMs = new Date(deadlineIso).getTime();
  const alertMs = deadlineMs - 60 * 60 * 1000;
  return new Date(alertMs);
}

// RUN TESTS
function runSuite() {
  console.log('\n=============================================');
  console.log('🧪 RUNNING COMPLETE VERIFICATION SUITE');
  console.log('=============================================\n');

  const now = new Date('2026-10-11T12:00:00.000Z');

  // Test 1: Priority Override
  console.log('--- Test 1: Priority Override Mathematics ---');
  const taskP3 = {
    id: 't1',
    title: 'Urgent Client Deliverable',
    basePriority: 3,
    deadline: new Date('2026-10-11T18:00:00.000Z').toISOString(), // 6h remaining
    blockedBy: [],
    completed: false,
  };
  const taskP5 = {
    id: 't2',
    title: 'Long-term Architecture Overhaul',
    basePriority: 5,
    deadline: new Date('2026-10-18T12:00:00.000Z').toISOString(), // 168h remaining
    blockedBy: [],
    completed: false,
  };
  const eval1 = evaluateTaskUrgency(taskP3, [taskP3, taskP5], now);
  const eval2 = evaluateTaskUrgency(taskP5, [taskP3, taskP5], now);

  console.log(`Task 1 (P3 due in 6h): Score = ${eval1.score}`);
  console.log(`Task 2 (P5 due in 168h): Score = ${eval2.score}`);
  if (eval1.score > eval2.score) {
    console.log(`✅ PASS: Priority 3 due today (${eval1.score}) beats Priority 5 due next week (${eval2.score})`);
  } else {
    throw new Error('Priority override failed');
  }

  // Test 2: Overdue Escalation
  console.log('\n--- Test 2: Overdue Escalation ---');
  const taskOverdue = {
    id: 't_od',
    title: 'Missed Regulatory Filing',
    basePriority: 2,
    deadline: new Date('2026-10-11T10:00:00.000Z').toISOString(), // 2h overdue
    blockedBy: [],
    completed: false,
  };
  const evalOD = evaluateTaskUrgency(taskOverdue, [taskOverdue], now);
  console.log(`Overdue Task: Score = ${evalOD.score}, Tier = ${evalOD.tier}`);
  if (evalOD.tier === 'overdue' && evalOD.score === 20.0) {
    console.log('✅ PASS: Overdue task escalates to overdue tier with penalty factor');
  } else {
    throw new Error('Overdue calculation failed');
  }

  // Test 3: Dependency Resolution & Unblocking
  console.log('\n--- Test 3: Dependency Resolution & Unblocking ---');
  const taskBlocked = {
    id: 't_blocked',
    title: 'Release Production Build',
    basePriority: 5,
    deadline: new Date('2026-10-11T19:00:00.000Z').toISOString(),
    blockedBy: ['t1'],
    completed: false,
  };
  const tasksList = [taskP3, taskP5, taskBlocked];
  const sorted1 = sortTasksByTrueUrgency(tasksList, now);

  if (sorted1.blocked.length === 1 && sorted1.blocked[0].task.id === 't_blocked') {
    console.log('✅ PASS: Blocked task placed in blocked partition');
  } else {
    throw new Error('Blocked partitioning failed');
  }

  // Complete blocker
  taskP3.completed = true;
  taskP3.completedAt = now.toISOString();
  const sorted2 = sortTasksByTrueUrgency(tasksList, now);

  if (sorted2.blocked.length === 0 && sorted2.doNow.some((t) => t.task.id === 't_blocked')) {
    console.log('✅ PASS: Completing blocker immediately promotes dependent task to Do Now list');
  } else {
    throw new Error('Unblocking failed');
  }

  // Test 4: Cycle Prevention
  console.log('\n--- Test 4: Cycle Prevention ---');
  const taskA = { id: 'A', title: 'A', basePriority: 1, blockedBy: ['B'] };
  const taskB = { id: 'B', title: 'B', basePriority: 1, blockedBy: ['C'] };
  const taskC = { id: 'C', title: 'C', basePriority: 1, blockedBy: [] };
  const graph = [taskA, taskB, taskC];

  if (wouldCreateCycle('C', 'A', graph) === true) {
    console.log('✅ PASS: Cycle C -> A (when A -> B -> C) correctly prevented');
  } else {
    throw new Error('Cycle detection failed');
  }

  if (wouldCreateCycle('C', 'D', graph) === false) {
    console.log('✅ PASS: Independent dependency allowed without false positive');
  } else {
    throw new Error('Independent dependency failed');
  }

  // Test 5: Morning Briefing Notification Builder
  console.log('\n--- Test 5: Morning Briefing Generation ---');
  taskP3.completed = false; // reset
  const briefing = buildMorningBriefingText(tasksList, now);
  console.log('Generated Briefing Content:\n' + briefing.body);
  if (briefing.body.includes('1. Release Production Build') || briefing.body.includes('Urgent Client Deliverable')) {
    console.log('✅ PASS: Morning briefing correctly formatted top urgency tasks');
  } else {
    throw new Error('Briefing text generation failed');
  }

  // Test 6: 60-Minute Pre-Deadline Alert Timing
  console.log('\n--- Test 6: 60-Minute Alert Exact Time ---');
  const alertTime = calculateAlertTime('2026-10-11T18:00:00.000Z');
  if (alertTime.toISOString() === '2026-10-11T17:00:00.000Z') {
    console.log(`✅ PASS: Deadline at 18:00:00 -> Alert scheduled at exactly ${alertTime.toISOString()} (60 mins prior)`);
  } else {
    throw new Error('Alert timing calculation failed');
  }

  // Test 7: Priority Score Inheritance & Transitive Chain
  console.log('\n--- Test 7: Priority Score Inheritance & Transitive Chain ---');
  const tLowBlocker = {
    id: 't_low_blocker',
    title: 'Gather API Keys',
    basePriority: 1,
    deadline: null,
    blockedBy: [],
    completed: false,
  };
  const tMidBlocked = {
    id: 't_mid_blocked',
    title: 'Configure Auth',
    basePriority: 2,
    deadline: null,
    blockedBy: ['t_low_blocker'],
    completed: false,
  };
  const tCritTarget = {
    id: 't_crit_target',
    title: 'Launch Payment Flow',
    basePriority: 5,
    deadline: new Date(now.getTime() + 4 * 3600 * 1000).toISOString(), // 4h from now
    blockedBy: ['t_mid_blocked'],
    completed: false,
  };
  const chainSorted = sortTasksByTrueUrgency([tLowBlocker, tMidBlocked, tCritTarget], now);
  const evalLow = chainSorted.doNow.find((t) => t.task.id === 't_low_blocker');
  const evalCrit = chainSorted.blocked.find((t) => t.task.id === 't_crit_target');

  console.log(
    `Low Blocker inherited Score = ${evalLow.score} (isInheritedScore=${evalLow.isInheritedScore}), Target Score = ${evalCrit.score}`
  );
  if (
    evalLow &&
    evalCrit &&
    evalLow.effectivePriority === 5 &&
    evalLow.score >= evalCrit.score &&
    evalLow.isInheritedScore
  ) {
    console.log('✅ PASS: Transitive blocker inherited P5 and >= critical urgency score');
  } else {
    throw new Error('Priority score inheritance failed');
  }

  // Test 8: Inherited Earlier Deadline (48h Buffer & Short-Term Clamping)
  console.log('\n--- Test 8: Inherited Earlier Deadline ---');
  const tBlocker5d = {
    id: 't_b5d',
    title: 'Prepare Slides',
    basePriority: 2,
    deadline: null,
    blockedBy: [],
    completed: false,
  };
  const tTarget5d = {
    id: 't_t5d',
    title: 'Board Presentation',
    basePriority: 4,
    deadline: new Date(now.getTime() + 120 * 3600 * 1000).toISOString(), // 5 days (120h)
    blockedBy: ['t_b5d'],
    completed: false,
  };
  const res5d = evaluateTaskUrgency(tBlocker5d, [tBlocker5d, tTarget5d], now);
  console.log(
    `5d target -> Blocker hoursRemaining = ${res5d.hoursRemaining}h (isInheritedDeadline=${res5d.isInheritedDeadline})`
  );
  if (res5d.isInheritedDeadline && res5d.hoursRemaining === 72) {
    console.log('✅ PASS: Blocker without deadline received 48h earlier effective deadline (72h vs 120h)');
  } else {
    throw new Error('48h buffer inherited deadline failed');
  }

  // Short-term clamping check: 12h target -> 6h blocker (not overdue!)
  console.log(
    `4h target -> Chain blocker hoursRemaining = ${evalLow.hoursRemaining}h (effectiveDeadline=${evalLow.effectiveDeadline})`
  );
  if (evalLow.isInheritedDeadline && evalLow.hoursRemaining > 0 && evalLow.hoursRemaining < 4) {
    console.log('✅ PASS: Short-term clamping kept blocker ahead of target without making it artificially overdue');
  } else {
    throw new Error('Short-term clamping failed');
  }

  // Test 9: Multi-Week Differentiation & User Screenshot Scenario
  console.log('\n--- Test 9: Multi-Week Differentiation & Cybersec Scenario ---');
  const tAlgo = {
    id: 'algo',
    title: 'Revise for Algorithms test',
    basePriority: 5,
    deadline: new Date(now.getTime() + (6 * 24 + 3) * 3600 * 1000).toISOString(),
    blockedBy: [],
    completed: false,
  };
  const tDaad = {
    id: 'daad',
    title: 'Apply to DAAD',
    basePriority: 5,
    deadline: new Date(now.getTime() + (11 * 24 + 12) * 3600 * 1000).toISOString(),
    blockedBy: [],
    completed: false,
  };
  const tDb = {
    id: 'db',
    title: 'Databases Coursework',
    basePriority: 5,
    deadline: new Date(now.getTime() + (27 * 24 + 1) * 3600 * 1000).toISOString(),
    blockedBy: [],
    completed: false,
  };
  const tCyberLabs = {
    id: 'cyber_labs',
    title: 'Missed Cybersec labs',
    basePriority: 4,
    deadline: null,
    blockedBy: [],
    completed: false,
  };
  const tCyberCw = {
    id: 'cyber_cw',
    title: 'Cybersec coursework',
    basePriority: 5,
    deadline: new Date(now.getTime() + (13 * 24 + 1) * 3600 * 1000).toISOString(),
    blockedBy: ['cyber_labs'],
    completed: false,
  };

  const scenario = sortTasksByTrueUrgency([tDb, tDaad, tAlgo, tCyberLabs, tCyberCw], now);
  scenario.doNow.forEach((item, idx) => {
    console.log(
      `  #${idx + 1}: ${item.task.title} -> Score=${item.score}, EffP=P${item.effectivePriority}, Hours=${item.hoursRemaining}h`
    );
  });

  const labsIdx = scenario.doNow.findIndex((i) => i.task.id === 'cyber_labs');
  const dbIdx = scenario.doNow.findIndex((i) => i.task.id === 'db');
  const labsItem = scenario.doNow[labsIdx];

  if (labsItem.effectivePriority === 5 && labsIdx < dbIdx && labsItem.score > scenario.doNow[dbIdx].score) {
    console.log('✅ PASS: Missed Cybersec labs inherited P5, scored higher, and sorted ahead of Databases Coursework!');
  } else {
    throw new Error('Cybersec scenario ordering/inheritance failed');
  }

  console.log('\n=============================================');
  console.log('🎉 ALL 9 VERIFICATION SUITES PASSED FLAWLESSLY!');
  console.log('=============================================\n');
}

runSuite();
