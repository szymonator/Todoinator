import AsyncStorage from '@react-native-async-storage/async-storage';
import { Task } from '../types/task';

const STORAGE_KEY = '@todoinator_tasks_v1';

export const INITIAL_SEED_TASKS: Task[] = [
  {
    id: 'seed-task-1',
    title: 'Fix Critical Production Crash',
    notes: 'Null pointer exception on checkout screen for Android users.',
    basePriority: 4, // High
    deadline: new Date(Date.now() + 3 * 3600 * 1000).toISOString(), // 3 hours from now
    blockedBy: [],
    completed: false,
    createdAt: new Date(Date.now() - 3600 * 1000).toISOString(),
    estimatedDurationMinutes: 60,
  },
  {
    id: 'seed-task-2',
    title: 'Submit Client Review Proposal',
    notes: 'Draft and review contract deliverables for the Q4 partnership.',
    basePriority: 3, // Important (Priority 3)
    deadline: new Date(Date.now() + 6 * 3600 * 1000).toISOString(), // 6 hours from now (due today!)
    blockedBy: [],
    completed: false,
    createdAt: new Date(Date.now() - 7200 * 1000).toISOString(),
    estimatedDurationMinutes: 60,
  },
  {
    id: 'seed-task-3',
    title: 'Rewrite Global Database Schema',
    notes: 'Long-term architectural refactor for multi-tenant scalability.',
    basePriority: 5, // Critical (Priority 5)
    deadline: new Date(Date.now() + 6 * 24 * 3600 * 1000).toISOString(), // 6 days from now (due next week!)
    blockedBy: [],
    completed: false,
    createdAt: new Date(Date.now() - 86400 * 1000).toISOString(),
    estimatedDurationMinutes: 90,
  },
  {
    id: 'seed-task-4',
    title: 'Deploy Hotfix to Google Play Store',
    notes: 'Requires production crash fix to be fully validated first.',
    basePriority: 4, // High
    deadline: new Date(Date.now() + 4 * 3600 * 1000).toISOString(), // 4 hours from now
    blockedBy: ['seed-task-1'], // Blocked by Task 1!
    completed: false,
    createdAt: new Date().toISOString(),
    estimatedDurationMinutes: 45,
  },
  {
    id: 'seed-task-5',
    title: 'Organize Engineering Documentation',
    notes: 'Review team onboarding wiki and prune stale markdown files.',
    basePriority: 1, // Low
    deadline: null, // No deadline
    blockedBy: [],
    completed: false,
    createdAt: new Date(Date.now() - 2 * 86400 * 1000).toISOString(),
    estimatedDurationMinutes: 30,
  },
];

export async function loadTasks(): Promise<Task[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) {
      // First launch seed
      await saveTasks(INITIAL_SEED_TASKS);
      return INITIAL_SEED_TASKS;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : INITIAL_SEED_TASKS;
  } catch (err) {
    console.error('Error loading tasks from AsyncStorage:', err);
    return INITIAL_SEED_TASKS;
  }
}

export async function saveTasks(tasks: Task[]): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  } catch (err) {
    console.error('Error saving tasks to AsyncStorage:', err);
    throw err;
  }
}

export async function resetToSampleTasks(): Promise<Task[]> {
  // Regenerate seed tasks with fresh timestamps relative to current time
  const freshSeeds: Task[] = [
    {
      ...INITIAL_SEED_TASKS[0],
      deadline: new Date(Date.now() + 3 * 3600 * 1000).toISOString(),
      completed: false,
      completedAt: null,
    },
    {
      ...INITIAL_SEED_TASKS[1],
      deadline: new Date(Date.now() + 6 * 3600 * 1000).toISOString(),
      completed: false,
      completedAt: null,
    },
    {
      ...INITIAL_SEED_TASKS[2],
      deadline: new Date(Date.now() + 6 * 24 * 3600 * 1000).toISOString(),
      completed: false,
      completedAt: null,
    },
    {
      ...INITIAL_SEED_TASKS[3],
      deadline: new Date(Date.now() + 4 * 3600 * 1000).toISOString(),
      completed: false,
      completedAt: null,
    },
    {
      ...INITIAL_SEED_TASKS[4],
      completed: false,
      completedAt: null,
    },
  ];
  await saveTasks(freshSeeds);
  return freshSeeds;
}
