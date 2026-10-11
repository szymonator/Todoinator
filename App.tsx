import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  Pressable,
  StatusBar,
  Alert,
} from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { setSystemNavBarStyle, setSystemNavBarHidden } from './src/utils/navigationBar';
import { Task, TaskUrgencyInfo, SuggestedAction } from './src/types/task';
import { colors } from './src/theme/colors';
import { sortTasksByTrueUrgency } from './src/utils/urgency';
import { loadTasks, saveTasks, resetToSampleTasks } from './src/services/storage';
import {
  initializeNotifications,
  syncAllNotifications,
} from './src/services/notifications';
import { getSuggestedAction } from './src/services/calendar';
import { TaskItem } from './src/components/TaskItem';
import { SuggestedActionCard } from './src/components/SuggestedActionCard';
import { FilterBar, FilterType } from './src/components/FilterBar';
import { TaskModal } from './src/components/TaskModal';
import { DiagnosticsModal } from './src/components/DiagnosticsModal';

export default function App() {
  return (
    <SafeAreaProvider>
      <TodoinatorMain />
    </SafeAreaProvider>
  );
}

function TodoinatorMain() {
  const insets = useSafeAreaInsets();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [tickerTime, setTickerTime] = useState<Date>(new Date());
  const [activeFilter, setActiveFilter] = useState<FilterType>('doNow');
  const [suggestedAction, setSuggestedAction] = useState<SuggestedAction | null>(null);
  const [isDemoCalendar, setIsDemoCalendar] = useState<boolean>(true);
  const [isNavCollapsed, setIsNavCollapsed] = useState<boolean>(false);

  // Modal states
  const [isTaskModalVisible, setIsTaskModalVisible] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [isDiagnosticsVisible, setIsDiagnosticsVisible] = useState(false);

  // Initialize notifications and load tasks
  useEffect(() => {
    async function init() {
      await initializeNotifications();
      const loaded = await loadTasks();
      setTasks(loaded);
      await syncAllNotifications(loaded);
    }
    init();
    setSystemNavBarStyle('dark');
  }, []);

  // System bar collapse/expand effect
  useEffect(() => {
    setSystemNavBarHidden(isNavCollapsed);
    StatusBar.setHidden(isNavCollapsed, 'fade');
  }, [isNavCollapsed]);

  // Real-time ticker: recalculates urgency every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setTickerTime(new Date());
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  // Update suggested action whenever tasks or tickerTime change
  useEffect(() => {
    async function updateSuggestedAction() {
      if (tasks.length === 0) {
        setSuggestedAction(null);
        return;
      }
      const suggestion = await getSuggestedAction(tasks, isDemoCalendar, tickerTime);
      setSuggestedAction(suggestion);
    }
    updateSuggestedAction();
  }, [tasks, isDemoCalendar, tickerTime]);

  // Evaluated and sorted tasks by True Urgency
  const { all, doNow, blocked, completed } = useMemo(() => {
    return sortTasksByTrueUrgency(tasks, tickerTime);
  }, [tasks, tickerTime]);

  // Filtered task list to display
  const displayedTasks = useMemo(() => {
    switch (activeFilter) {
      case 'doNow':
        return doNow;
      case 'blocked':
        return blocked;
      case 'completed':
        return completed;
      case 'all':
      default:
        return all;
    }
  }, [activeFilter, all, doNow, blocked, completed]);

  // Task actions
  const handleToggleComplete = useCallback(async (taskId: string) => {
    setTasks((prevTasks) => {
      const updated = prevTasks.map((t) => {
        if (t.id === taskId) {
          const isNowCompleted = !t.completed;
          return {
            ...t,
            completed: isNowCompleted,
            completedAt: isNowCompleted ? new Date().toISOString() : null,
          };
        }
        return t;
      });
      saveTasks(updated);
      syncAllNotifications(updated);
      return updated;
    });
  }, []);

  const handleDeleteTask = useCallback(async (taskId: string) => {
    Alert.alert(
      'Delete Task',
      'Are you sure you want to delete this task?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            setTasks((prevTasks) => {
              const updated = prevTasks
                .filter((t) => t.id !== taskId)
                .map((t) => ({
                  ...t,
                  blockedBy: t.blockedBy.filter((bId) => bId !== taskId),
                }));
              saveTasks(updated);
              syncAllNotifications(updated);
              return updated;
            });
          },
        },
      ]
    );
  }, []);

  const handleOpenEdit = useCallback((taskId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (task) {
      setEditingTask(task);
      setIsTaskModalVisible(true);
    }
  }, [tasks]);

  const handleSaveTask = useCallback(async (
    taskData: Omit<Task, 'id' | 'createdAt' | 'completed' | 'completedAt'> & { id?: string }
  ) => {
    setTasks((prevTasks) => {
      let updated: Task[];
      if (taskData.id) {
        // Edit existing
        updated = prevTasks.map((t) =>
          t.id === taskData.id
            ? {
                ...t,
                title: taskData.title,
                notes: taskData.notes,
                basePriority: taskData.basePriority,
                deadline: taskData.deadline,
                blockedBy: taskData.blockedBy,
                estimatedDurationMinutes: taskData.estimatedDurationMinutes,
              }
            : t
        );
      } else {
        // Create new
        const newTask: Task = {
          id: `task_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          title: taskData.title,
          notes: taskData.notes,
          basePriority: taskData.basePriority,
          deadline: taskData.deadline,
          blockedBy: taskData.blockedBy,
          completed: false,
          completedAt: null,
          createdAt: new Date().toISOString(),
          estimatedDurationMinutes: taskData.estimatedDurationMinutes,
        };
        updated = [newTask, ...prevTasks];
      }
      saveTasks(updated);
      syncAllNotifications(updated);
      return updated;
    });
  }, []);

  const handleResetToSeeds = useCallback(async () => {
    const fresh = await resetToSampleTasks();
    setTasks(fresh);
    await syncAllNotifications(fresh);
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: TaskUrgencyInfo }) => (
      <TaskItem
        info={item}
        onToggleComplete={handleToggleComplete}
        onPress={handleOpenEdit}
        onDelete={handleDeleteTask}
      />
    ),
    [handleToggleComplete, handleOpenEdit, handleDeleteTask]
  );

  return (
    <View
      style={[
        styles.mainContainer,
        {
          paddingTop: insets.top,
          paddingLeft: insets.left,
          paddingRight: insets.right,
          paddingBottom: isNavCollapsed ? 0 : insets.bottom,
        },
      ]}
    >
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />

      {/* Header Bar */}
      <View style={styles.header}>
        <View style={styles.headerTitleGroup}>
          <View style={styles.logoBadge}>
            <MaterialCommunityIcons name="lightning-bolt" size={22} color="#FFFFFF" />
          </View>
          <View>
            <Text style={styles.appName}>Todoinator</Text>
            <Text style={styles.appSubtitle}>Dynamic Urgency & Dependencies</Text>
          </View>
        </View>

        <View style={styles.headerActions}>
          {/* Quick Collapse / Expand System Bar Toggle */}
          <Pressable
            style={styles.headerIconButton}
            onPress={() => setIsNavCollapsed((prev) => !prev)}
            accessibilityRole="button"
            accessibilityLabel={isNavCollapsed ? 'Restore system bar' : 'Collapse system bar'}
          >
            <MaterialCommunityIcons
              name={isNavCollapsed ? 'fullscreen-exit' : 'fullscreen'}
              size={20}
              color={isNavCollapsed ? colors.primary : colors.textPrimary}
            />
          </Pressable>

          {/* Diagnostics Modal Toggle */}
          <Pressable
            style={styles.headerIconButton}
            onPress={() => setIsDiagnosticsVisible(true)}
            accessibilityRole="button"
            accessibilityLabel="Settings and diagnostics"
          >
            <MaterialCommunityIcons name="tune-vertical" size={20} color={colors.textPrimary} />
          </Pressable>
        </View>
      </View>

      {/* Content Area */}
      <View style={styles.content}>
        <FlatList
          data={displayedTasks}
          keyExtractor={(item) => item.task.id}
          renderItem={renderItem}
          ListHeaderComponent={
            <View style={styles.listHeader}>
              {/* Suggested Action Card */}
              <SuggestedActionCard
                suggestion={suggestedAction}
                isDemoMode={isDemoCalendar}
                onToggleDemoMode={() => setIsDemoCalendar(!isDemoCalendar)}
                onCompleteTask={handleToggleComplete}
                onOpenTask={handleOpenEdit}
              />

              {/* Filter Bar */}
              <FilterBar
                activeFilter={activeFilter}
                counts={{
                  doNow: doNow.length,
                  all: all.length,
                  blocked: blocked.length,
                  completed: completed.length,
                }}
                onSelectFilter={setActiveFilter}
              />
            </View>
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons
                name="checkbox-marked-circle-outline"
                size={48}
                color={colors.textTertiary}
              />
              <Text style={styles.emptyTitle}>No tasks found</Text>
              <Text style={styles.emptySubtitle}>
                {activeFilter === 'doNow'
                  ? 'All Do Now tasks are complete or currently blocked!'
                  : activeFilter === 'blocked'
                  ? 'No tasks are currently blocked by dependencies.'
                  : activeFilter === 'completed'
                  ? 'Completed tasks will show up here.'
                  : 'Tap the + button below to create your first task.'}
              </Text>
            </View>
          }
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: isNavCollapsed ? 80 : insets.bottom + 80 },
          ]}
          showsVerticalScrollIndicator={false}
        />
      </View>

      {/* Floating Action Button (FAB) positioned safely above navigation bar */}
      <Pressable
        style={[
          styles.fab,
          { bottom: isNavCollapsed ? 20 : insets.bottom + 20 },
        ]}
        onPress={() => {
          setEditingTask(null);
          setIsTaskModalVisible(true);
        }}
        accessibilityRole="button"
      >
        <MaterialCommunityIcons name="plus" size={28} color="#FFFFFF" />
      </Pressable>

      {/* Modals */}
      <TaskModal
        visible={isTaskModalVisible}
        editingTask={editingTask}
        allTasks={tasks}
        onClose={() => setIsTaskModalVisible(false)}
        onSave={handleSaveTask}
      />

      <DiagnosticsModal
        visible={isDiagnosticsVisible}
        tasks={tasks}
        isDemoMode={isDemoCalendar}
        onToggleDemoMode={() => setIsDemoCalendar(!isDemoCalendar)}
        isNavCollapsed={isNavCollapsed}
        onToggleNavCollapsed={() => setIsNavCollapsed((prev) => !prev)}
        onResetSeedTasks={handleResetToSeeds}
        onClose={() => setIsDiagnosticsVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant,
  },
  headerTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logoBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderCurve: 'continuous',
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appName: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  appSubtitle: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIconButton: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderCurve: 'continuous',
    backgroundColor: colors.surfaceCard,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  content: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
  },
  listHeader: {
    paddingTop: 16,
    paddingBottom: 12,
    gap: 16,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  emptySubtitle: {
    fontSize: 13,
    color: colors.textTertiary,
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 18,
  },
  fab: {
    position: 'absolute',
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 4px 16px rgba(249, 115, 22, 0.45)',
  },
});
