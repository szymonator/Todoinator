// Complete Verification Suite for Todoinator

// 1. Urgency Algorithm
const DECAY_K = 8.0;
const DECAY_LAMBDA = 0.04;

function evaluateTaskUrgency(task, allTasks, now) {
  const taskMap = new Map(allTasks.map((t) => [t.id, t]));

  const activeBlockers = [];
  for (const blockerId of task.blockedBy || []) {
    const blocker = taskMap.get(blockerId);
    if (blocker && !blocker.completed) {
      activeBlockers.push(blocker);
    }
  }

  const isBlocked = activeBlockers.length > 0;
  const blockingTaskNames = activeBlockers.map((b) => b.title);

  let hoursRemaining = null;
  let decayFactor = 1.0;
  let score = task.basePriority * 1.0;
  let tier = 'low';

  if (task.completed) {
    score = 0;
    tier = 'low';
  } else if (task.deadline) {
    const deadlineTime = new Date(task.deadline).getTime();
    const currentTime = now.getTime();
    const diffMs = deadlineTime - currentTime;
    hoursRemaining = diffMs / (1000 * 60 * 60);

    if (hoursRemaining <= 0) {
      const overdueHours = Math.abs(hoursRemaining);
      decayFactor = 1.0 + DECAY_K + overdueHours * 0.5;
      score = task.basePriority * decayFactor;
      tier = 'overdue';
    } else {
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
    decayFactor = 1.0;
    score = task.basePriority * 1.0;
    tier = task.basePriority >= 4 ? 'moderate' : 'low';
  }

  if (isBlocked && !task.completed) {
    tier = 'blocked';
  }

  return {
    task,
    score: Math.round(score * 10) / 10,
    hoursRemaining: hoursRemaining !== null ? Math.round(hoursRemaining * 10) / 10 : null,
    decayFactor: Math.round(decayFactor * 100) / 100,
    isBlocked,
    blockingTaskNames,
    tier,
  };
}

function sortTasksByTrueUrgency(tasks, now) {
  const evaluated = tasks.map((task) => evaluateTaskUrgency(task, tasks, now));
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

  doNow.sort((a, b) => b.score - a.score);
  blocked.sort((a, b) => b.score - a.score);
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

  console.log('\n=============================================');
  console.log('🎉 ALL 6 VERIFICATION SUITES PASSED FLAWLESSLY!');
  console.log('=============================================\n');
}

runSuite();
