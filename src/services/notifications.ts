import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { Task } from '../types/task';
import { sortTasksByTrueUrgency } from '../utils/urgency';

// Configure foreground notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const MORNING_BRIEFING_ID = 'todoinator_morning_briefing';
const CHANNEL_BRIEFING = 'todoinator-briefing';
const CHANNEL_ALERTS = 'todoinator-alerts';

/**
 * Initializes Android notification channels and requests permissions.
 */
export async function initializeNotifications(): Promise<boolean> {
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHANNEL_BRIEFING, {
        name: 'Morning Briefing',
        description: 'Daily 8:00 AM briefing of top-urgency tasks',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#F97316',
      });

      await Notifications.setNotificationChannelAsync(CHANNEL_ALERTS, {
        name: 'Pre-Deadline Alerts',
        description: 'Urgent alerts 60 minutes before task deadlines',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 500, 250, 500],
        lightColor: '#EF4444',
      });
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    return finalStatus === 'granted';
  } catch (err) {
    console.warn('Notifications initialization error:', err);
    return false;
  }
}

/**
 * Builds the briefing summary message for the top 3 highest-urgency tasks.
 */
export function buildMorningBriefingText(tasks: Task[]): { title: string; body: string } {
  const { doNow } = sortTasksByTrueUrgency(tasks, new Date());
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

/**
 * Schedules the recurring 8:00 AM Morning Briefing notification.
 */
export async function scheduleDailyMorningBriefing(tasks: Task[]): Promise<string | null> {
  try {
    // Cancel any existing scheduled morning briefing to avoid duplicates
    await cancelMorningBriefing();

    const briefing = buildMorningBriefingText(tasks);

    // Schedule daily at 8:00 AM
    const identifier = await Notifications.scheduleNotificationAsync({
      identifier: MORNING_BRIEFING_ID,
      content: {
        title: briefing.title,
        body: briefing.body,
        data: { type: 'morning_briefing' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: 8,
        minute: 0,
        channelId: CHANNEL_BRIEFING,
      },
    });

    return identifier;
  } catch (err) {
    console.warn('Failed to schedule daily morning briefing:', err);
    return null;
  }
}

/**
 * Triggers an instant test morning briefing notification right now.
 * Allows user/tester to verify the notification layout immediately.
 */
export async function triggerTestMorningBriefing(tasks: Task[]): Promise<string | null> {
  try {
    const briefing = buildMorningBriefingText(tasks);

    const identifier = await Notifications.scheduleNotificationAsync({
      content: {
        title: briefing.title,
        body: briefing.body,
        data: { type: 'test_briefing' },
      },
      trigger: null, // trigger immediately
    });

    return identifier;
  } catch (err) {
    console.warn('Failed to trigger test morning briefing:', err);
    return null;
  }
}

/**
 * Schedules an alert exactly 60 minutes before a task's hard deadline.
 */
export async function schedulePreDeadlineAlert(task: Task): Promise<string | null> {
  if (!task.deadline || task.completed) {
    return null;
  }

  const deadlineMs = new Date(task.deadline).getTime();
  const alertMs = deadlineMs - 60 * 60 * 1000; // 60 minutes prior
  const nowMs = Date.now();

  // If the 60-minute mark has already passed, don't schedule a past alarm
  if (alertMs <= nowMs) {
    return null;
  }

  try {
    const notifId = `todoinator_deadline_${task.id}`;
    // Cancel any existing alert for this task
    await Notifications.cancelScheduledNotificationAsync(notifId);

    const identifier = await Notifications.scheduleNotificationAsync({
      identifier: notifId,
      content: {
        title: '⚠️ 60-Minute Deadline Warning',
        body: `Task "${task.title}" is due in exactly one hour! Priority: ${task.basePriority}/5`,
        data: { taskId: task.id, type: 'pre_deadline' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(alertMs),
        channelId: CHANNEL_ALERTS,
      },
    });

    return identifier;
  } catch (err) {
    console.warn(`Failed to schedule pre-deadline alert for task ${task.id}:`, err);
    return null;
  }
}

/**
 * Cancels a task's pre-deadline alert.
 */
export async function cancelTaskNotification(taskId: string): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(`todoinator_deadline_${taskId}`);
  } catch (err) {
    console.warn(`Failed to cancel notification for task ${taskId}:`, err);
  }
}

/**
 * Cancels the morning briefing notification.
 */
export async function cancelMorningBriefing(): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(MORNING_BRIEFING_ID);
  } catch (err) {
    // ignore if not scheduled
  }
}

/**
 * Synchronizes all notifications whenever tasks change:
 * - Updates the 8:00 AM Morning Briefing with fresh top-3 tasks
 * - Schedules/cancels 60-minute pre-deadline alerts for all tasks
 */
export async function syncAllNotifications(tasks: Task[]): Promise<void> {
  await scheduleDailyMorningBriefing(tasks);

  for (const task of tasks) {
    if (task.completed || !task.deadline) {
      await cancelTaskNotification(task.id);
    } else {
      await schedulePreDeadlineAlert(task);
    }
  }
}
