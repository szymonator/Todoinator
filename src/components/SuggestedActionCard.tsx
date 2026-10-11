import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SuggestedAction } from '../types/task';
import { colors } from '../theme/colors';
import { PRIORITY_MAP } from '../types/task';

interface SuggestedActionCardProps {
  suggestion: SuggestedAction | null;
  isDemoMode: boolean;
  onToggleDemoMode: () => void;
  onCompleteTask: (taskId: string) => void;
  onOpenTask: (taskId: string) => void;
}

export const SuggestedActionCard: React.FC<SuggestedActionCardProps> = ({
  suggestion,
  isDemoMode,
  onToggleDemoMode,
  onCompleteTask,
  onOpenTask,
}) => {
  if (!suggestion) {
    return (
      <View style={styles.emptyContainer}>
        <View style={styles.headerRow}>
          <View style={styles.titleIconRow}>
            <MaterialCommunityIcons name="calendar-clock" size={20} color={colors.secondary} />
            <Text style={styles.title}>Suggested Action</Text>
          </View>
          <Pressable
            onPress={onToggleDemoMode}
            style={styles.demoPill}
            accessibilityRole="button"
          >
            <Text style={styles.demoPillText}>
              {isDemoMode ? 'Demo Calendar (Active)' : 'Native Calendar'}
            </Text>
          </Pressable>
        </View>
        <Text style={styles.emptySubtext}>
          No 1-hour free gaps found in today's remaining schedule or all urgent tasks are complete.
        </Text>
      </View>
    );
  }

  const { gap, task } = suggestion;
  const priorityMeta = PRIORITY_MAP[task.task.basePriority];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={styles.titleIconRow}>
          <MaterialCommunityIcons name="lightning-bolt" size={20} color="#FBBF24" />
          <Text style={styles.title}>Suggested Action</Text>
        </View>
        <Pressable
          onPress={onToggleDemoMode}
          style={[styles.demoPill, isDemoMode ? styles.demoPillActive : null]}
          accessibilityRole="button"
        >
          <Text style={styles.demoPillText}>
            {isDemoMode ? 'Demo Data' : 'Device Sync'}
          </Text>
        </Pressable>
      </View>

      {/* Free Slot Info */}
      <View style={styles.slotRow}>
        <MaterialCommunityIcons name="clock-outline" size={16} color={colors.secondary} />
        <Text style={styles.slotText}>
          {gap.formattedTime} ({gap.durationMinutes}m gap available)
        </Text>
      </View>

      {/* Recommended Task Box */}
      <Pressable
        style={styles.taskBox}
        onPress={() => onOpenTask(task.task.id)}
        accessibilityRole="button"
      >
        <View style={styles.taskBoxHeader}>
          <Text style={styles.taskTitle} numberOfLines={1}>
            {task.task.title}
          </Text>
        </View>

        <View style={styles.badgesRow}>
          {/* Urgency Badge */}
          <View style={[styles.badge, { backgroundColor: colors.badgeUrgentBg }]}>
            <MaterialCommunityIcons name="fire" size={13} color={colors.badgeUrgent} />
            <Text style={[styles.badgeText, { color: colors.badgeUrgent }]}>
              Urgency {task.score}
            </Text>
          </View>

          {/* Priority Badge */}
          <View style={[styles.badge, { backgroundColor: priorityMeta.badgeBg }]}>
            <Text style={[styles.badgeText, { color: priorityMeta.color }]}>
              P{priorityMeta.level} {priorityMeta.label}
            </Text>
          </View>

          {/* Time info */}
          {task.hoursRemaining !== null ? (
            <View style={[styles.badge, { backgroundColor: 'rgba(255, 255, 255, 0.08)' }]}>
              <Text style={styles.badgeTextMuted}>
                {task.hoursRemaining <= 0
                  ? 'Overdue'
                  : `Due in ${task.hoursRemaining}h`}
              </Text>
            </View>
          ) : null}
        </View>
      </Pressable>

      {/* Action CTA */}
      <View style={styles.ctaRow}>
        <Pressable
          style={styles.ctaButton}
          onPress={() => onCompleteTask(task.task.id)}
          accessibilityRole="button"
        >
          <MaterialCommunityIcons name="check-circle-outline" size={16} color="#FFFFFF" />
          <Text style={styles.ctaButtonText}>Mark Task Done</Text>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surfaceCard,
    borderRadius: 16,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: 'rgba(249, 115, 22, 0.35)',
    padding: 16,
    gap: 12,
    boxShadow: '0 4px 16px rgba(249, 115, 22, 0.15)',
  },
  emptyContainer: {
    backgroundColor: colors.surfaceCard,
    borderRadius: 16,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    padding: 16,
    gap: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  demoPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  demoPillActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.4)',
  },
  demoPillText: {
    fontSize: 11,
    color: colors.secondary,
    fontWeight: '600',
  },
  emptySubtext: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  slotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  slotText: {
    fontSize: 13,
    color: colors.secondary,
    fontWeight: '600',
  },
  taskBox: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 12,
    borderCurve: 'continuous',
    padding: 12,
    gap: 8,
  },
  taskBoxHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  taskTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
    flex: 1,
  },
  badgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderCurve: 'continuous',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  badgeTextMuted: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  ctaRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderCurve: 'continuous',
  },
  ctaButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
});
