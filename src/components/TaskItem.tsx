import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { TaskUrgencyInfo, PRIORITY_MAP } from '../types/task';
import { colors } from '../theme/colors';
import { formatHoursRemaining } from '../utils/formatters';

interface TaskItemProps {
  info: TaskUrgencyInfo;
  onToggleComplete: (taskId: string) => void;
  onPress: (taskId: string) => void;
  onDelete: (taskId: string) => void;
}

export const TaskItem: React.FC<TaskItemProps> = React.memo(({
  info,
  onToggleComplete,
  onPress,
  onDelete,
}) => {
  const { task, score, hoursRemaining, isBlocked, blockingTaskNames, blockedTaskNames, tier } = info;
  const priorityMeta = PRIORITY_MAP[task.basePriority];

  const getUrgencyBadgeStyle = () => {
    switch (tier) {
      case 'overdue':
        return { bg: colors.badgeUrgentBg, text: colors.badgeUrgent, label: 'OVERDUE' };
      case 'critical':
        return { bg: colors.badgeUrgentBg, text: colors.badgeUrgent, label: 'CRITICAL' };
      case 'urgent':
        return { bg: colors.badgeHighBg, text: colors.badgeHigh, label: 'URGENT' };
      case 'moderate':
        return { bg: colors.badgeMediumBg, text: colors.badgeMedium, label: 'MODERATE' };
      case 'blocked':
        return { bg: colors.blockedBg, text: colors.blocked, label: 'BLOCKED' };
      default:
        return { bg: colors.badgeLowBg, text: colors.badgeLow, label: 'NORMAL' };
    }
  };

  const urgencyStyle = getUrgencyBadgeStyle();

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        task.completed ? styles.cardCompleted : null,
        isBlocked ? styles.cardBlocked : null,
        pressed ? styles.cardPressed : null,
      ]}
      onPress={() => onPress(task.id)}
      accessibilityRole="button"
    >
      <View style={styles.contentRow}>
        {/* Completion Checkbox */}
        <Pressable
          style={styles.checkboxContainer}
          onPress={() => onToggleComplete(task.id)}
          hitSlop={10}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: task.completed }}
        >
          <MaterialCommunityIcons
            name={task.completed ? 'checkbox-marked-circle' : 'checkbox-blank-circle-outline'}
            size={24}
            color={task.completed ? colors.success : colors.textTertiary}
          />
        </Pressable>

        {/* Main Details */}
        <View style={styles.detailsColumn}>
          {/* Title Row */}
          <View style={styles.titleRow}>
            <Text
              style={[
                styles.title,
                task.completed ? styles.titleCompleted : null,
              ]}
              numberOfLines={2}
            >
              {task.title}
            </Text>

            {/* Quick Delete */}
            <Pressable
              onPress={() => onDelete(task.id)}
              hitSlop={8}
              style={styles.deleteButton}
              accessibilityRole="button"
            >
              <MaterialCommunityIcons name="trash-can-outline" size={18} color={colors.textTertiary} />
            </Pressable>
          </View>

          {/* Notes preview if present */}
          {task.notes ? (
            <Text style={styles.notesText} numberOfLines={1}>
              {task.notes}
            </Text>
          ) : null}

          {/* Badges / Metrics Row */}
          <View style={styles.badgeRow}>
            {/* Urgency Score */}
            {!task.completed ? (
              <View style={[styles.badge, { backgroundColor: urgencyStyle.bg }]}>
                <MaterialCommunityIcons
                  name={tier === 'overdue' ? 'alert-octagon' : 'fire'}
                  size={12}
                  color={urgencyStyle.text}
                />
                <Text style={[styles.badgeText, { color: urgencyStyle.text }]}>
                  Score: {score}
                </Text>
              </View>
            ) : null}

            {/* Base Priority */}
            <View style={[styles.badge, { backgroundColor: priorityMeta.badgeBg }]}>
              <Text style={[styles.badgeText, { color: priorityMeta.color }]}>
                P{priorityMeta.level} {priorityMeta.label}
              </Text>
            </View>

            {/* Deadline Countdown */}
            {!task.completed && task.deadline ? (
              <View style={[styles.badge, styles.badgeNeutral]}>
                <MaterialCommunityIcons name="clock-outline" size={12} color={colors.textSecondary} />
                <Text style={styles.badgeTextNeutral}>
                  {formatHoursRemaining(hoursRemaining)}
                </Text>
              </View>
            ) : null}

            {/* Completed timestamp */}
            {task.completed ? (
              <View style={[styles.badge, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
                <Text style={[styles.badgeText, { color: colors.success }]}>Completed</Text>
              </View>
            ) : null}
          </View>

          {/* Blocked By Badge */}
          {isBlocked && !task.completed ? (
            <View style={styles.blockerAlertBox}>
              <MaterialCommunityIcons name="lock" size={14} color="#F87171" />
              <Text style={styles.blockerAlertText}>
                Blocked by: {blockingTaskNames.join(', ')}
              </Text>
            </View>
          ) : null}

          {/* Blocks Other Tasks Pill */}
          {!task.completed && blockedTaskNames.length > 0 ? (
            <View style={styles.downstreamAlertBox}>
              <MaterialCommunityIcons name="arrow-right-bold" size={12} color={colors.secondary} />
              <Text style={styles.downstreamAlertText}>
                Prerequisite for: {blockedTaskNames.join(', ')}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceCard,
    borderRadius: 14,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    padding: 14,
    marginVertical: 4,
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.18)',
  },
  cardCompleted: {
    opacity: 0.6,
    borderColor: 'transparent',
  },
  cardBlocked: {
    borderColor: 'rgba(239, 68, 68, 0.25)',
    backgroundColor: 'rgba(26, 28, 32, 0.95)',
  },
  cardPressed: {
    backgroundColor: colors.surfaceCardHover,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  checkboxContainer: {
    paddingTop: 2,
  },
  detailsColumn: {
    flex: 1,
    gap: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
    flex: 1,
    lineHeight: 20,
  },
  titleCompleted: {
    textDecorationLine: 'line-through',
    color: colors.textTertiary,
  },
  deleteButton: {
    padding: 2,
  },
  notesText: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderCurve: 'continuous',
  },
  badgeNeutral: {
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  badgeTextNeutral: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  blockerAlertBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderCurve: 'continuous',
  },
  blockerAlertText: {
    fontSize: 11,
    color: '#F87171',
    fontWeight: '600',
  },
  downstreamAlertBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderCurve: 'continuous',
  },
  downstreamAlertText: {
    fontSize: 11,
    color: colors.secondary,
    fontWeight: '500',
  },
});
