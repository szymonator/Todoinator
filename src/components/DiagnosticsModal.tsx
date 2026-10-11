import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  Alert,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Task } from '../types/task';
import { colors } from '../theme/colors';
import {
  triggerTestMorningBriefing,
  scheduleDailyMorningBriefing,
  initializeNotifications,
  buildMorningBriefingText,
} from '../services/notifications';
import { requestCalendarPermissions, findTodayGaps } from '../services/calendar';

interface DiagnosticsModalProps {
  visible: boolean;
  tasks: Task[];
  isDemoMode: boolean;
  onToggleDemoMode: () => void;
  isNavCollapsed?: boolean;
  onToggleNavCollapsed?: () => void;
  onResetSeedTasks: () => void;
  onClose: () => void;
}

export const DiagnosticsModal: React.FC<DiagnosticsModalProps> = ({
  visible,
  tasks,
  isDemoMode,
  onToggleDemoMode,
  isNavCollapsed = false,
  onToggleNavCollapsed,
  onResetSeedTasks,
  onClose,
}) => {
  const [briefingStatus, setBriefingStatus] = useState<string | null>(null);
  const [calendarStatus, setCalendarStatus] = useState<string | null>(null);

  const briefing = buildMorningBriefingText(tasks);

  const handleTestBriefing = async () => {
    setBriefingStatus('Sending instant test notification...');
    const id = await triggerTestMorningBriefing(tasks);
    if (id) {
      setBriefingStatus('✅ Notification sent! Check your notification shade.');
    } else {
      setBriefingStatus('⚠️ Notification not sent. Please check system permissions.');
    }
  };

  const handleSchedule8AM = async () => {
    setBriefingStatus('Scheduling daily 8:00 AM briefing...');
    const id = await scheduleDailyMorningBriefing(tasks);
    if (id) {
      setBriefingStatus('✅ Scheduled daily for 8:00 AM!');
    } else {
      setBriefingStatus('⚠️ Failed to schedule daily briefing.');
    }
  };

  const handleRequestNotifPermission = async () => {
    const granted = await initializeNotifications();
    Alert.alert(
      'Notification Permission',
      granted ? 'Permission is granted!' : 'Permission denied or unavailable.',
      [{ text: 'OK' }]
    );
  };

  const handleRequestCalendarPermission = async () => {
    const { granted } = await requestCalendarPermissions();
    setCalendarStatus(granted ? '✅ Calendar permission granted!' : '⚠️ Permission not granted.');
    if (granted) {
      const gaps = await findTodayGaps(60, false);
      Alert.alert(
        'Calendar Connected',
        `Found ${gaps.length} free 1-hour windows in today's device calendar.`,
        [{ text: 'OK' }]
      );
    }
  };

  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={styles.headerTitleGroup}>
              <MaterialCommunityIcons name="cog-outline" size={20} color={colors.primaryLight} />
              <Text style={styles.modalTitle}>System Diagnostics & Tools</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10}>
              <MaterialCommunityIcons name="close" size={22} color={colors.textSecondary} />
            </Pressable>
          </View>

          <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContainer}>
            {/* Section 1: Notifications Engine */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionTitleRow}>
                <MaterialCommunityIcons name="bell-ring" size={18} color="#FBBF24" />
                <Text style={styles.sectionTitle}>Local Notification Engine</Text>
              </View>

              <Text style={styles.descriptionText}>
                Expo Notifications schedules the 8:00 AM Morning Briefing and 60-minute pre-deadline alerts purely on-device without any remote server.
              </Text>

              {/* Briefing Preview Box */}
              <View style={styles.previewBox}>
                <Text style={styles.previewTitle}>{briefing.title}</Text>
                <Text style={styles.previewBody}>{briefing.body}</Text>
              </View>

              {/* Action Buttons */}
              <View style={styles.actionButtonGroup}>
                <Pressable
                  style={[styles.actionBtn, styles.actionBtnPrimary]}
                  onPress={handleTestBriefing}
                >
                  <MaterialCommunityIcons name="send" size={16} color="#FFFFFF" />
                  <Text style={styles.actionBtnTextPrimary}>Trigger Morning Briefing Now (Test)</Text>
                </Pressable>

                <Pressable
                  style={styles.actionBtn}
                  onPress={handleSchedule8AM}
                >
                  <MaterialCommunityIcons name="calendar-clock" size={16} color={colors.primaryLight} />
                  <Text style={styles.actionBtnText}>Schedule Next 8:00 AM Alarm</Text>
                </Pressable>

                <Pressable
                  style={styles.actionBtn}
                  onPress={handleRequestNotifPermission}
                >
                  <MaterialCommunityIcons name="shield-check-outline" size={16} color={colors.secondary} />
                  <Text style={styles.actionBtnText}>Check Notification Permissions</Text>
                </Pressable>
              </View>

              {briefingStatus ? (
                <Text style={styles.statusFeedbackText}>{briefingStatus}</Text>
              ) : null}
            </View>

            {/* Section 2: Calendar Awareness */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionTitleRow}>
                <MaterialCommunityIcons name="calendar" size={18} color={colors.secondary} />
                <Text style={styles.sectionTitle}>Native Calendar Engine</Text>
              </View>

              <Text style={styles.descriptionText}>
                Reads device calendars to discover 1-hour free gaps today and recommend the top Do Now task.
              </Text>

              <View style={styles.actionButtonGroup}>
                <Pressable
                  style={[styles.actionBtn, isDemoMode ? styles.actionBtnActive : null]}
                  onPress={onToggleDemoMode}
                >
                  <MaterialCommunityIcons
                    name={isDemoMode ? 'toggle-switch' : 'toggle-switch-off-outline'}
                    size={20}
                    color={isDemoMode ? colors.secondary : colors.textTertiary}
                  />
                  <Text style={styles.actionBtnText}>
                    {isDemoMode ? 'Using Mock Calendar Events' : 'Using Native Device Calendar'}
                  </Text>
                </Pressable>

                <Pressable
                  style={styles.actionBtn}
                  onPress={handleRequestCalendarPermission}
                >
                  <MaterialCommunityIcons name="account-search-outline" size={16} color={colors.secondary} />
                  <Text style={styles.actionBtnText}>Request Native Calendar Access</Text>
                </Pressable>
              </View>

              {calendarStatus ? (
                <Text style={styles.statusFeedbackText}>{calendarStatus}</Text>
              ) : null}
            </View>

            {/* Section 3: Sample Data Reset */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionTitleRow}>
                <MaterialCommunityIcons name="database-refresh" size={18} color={colors.success} />
                <Text style={styles.sectionTitle}>Algorithm Demo Data</Text>
              </View>

              <Text style={styles.descriptionText}>
                Resets tasks with fresh deadlines relative to now (Priority 3 due today in 6h vs Priority 5 due next week in 6d, plus blocked dependency).
              </Text>

              <Pressable
                style={[styles.actionBtn, styles.actionBtnWarning]}
                onPress={() => {
                  onResetSeedTasks();
                  Alert.alert('Reset Complete', 'Loaded fresh demo tasks with relative timestamps.', [{ text: 'OK' }]);
                }}
              >
                <MaterialCommunityIcons name="refresh" size={16} color="#FFFFFF" />
                <Text style={styles.actionBtnTextPrimary}>Reset to Fresh Demo Tasks</Text>
              </Pressable>
            </View>

            {/* Section 4: Android Navigation Bar */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionTitleRow}>
                <MaterialCommunityIcons name="cellphone-cog" size={18} color={colors.primary} />
                <Text style={styles.sectionTitle}>Android System Bar</Text>
              </View>

              <Text style={styles.descriptionText}>
                The system bar is themed dark to match the app. You can also collapse/hide it to prevent any bottom button overlap.
              </Text>

              {onToggleNavCollapsed ? (
                <Pressable
                  style={[styles.actionBtn, isNavCollapsed ? styles.actionBtnActive : null]}
                  onPress={onToggleNavCollapsed}
                >
                  <MaterialCommunityIcons
                    name={isNavCollapsed ? 'fullscreen-exit' : 'fullscreen'}
                    size={20}
                    color={isNavCollapsed ? colors.primary : colors.textPrimary}
                  />
                  <Text style={styles.actionBtnText}>
                    {isNavCollapsed ? 'Restore System Navigation Bar' : 'Collapse / Hide Navigation Bar'}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderCurve: 'continuous',
    maxHeight: '90%',
    paddingBottom: 24,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant,
  },
  headerTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  scrollArea: {
    maxHeight: 520,
  },
  scrollContainer: {
    padding: 20,
    gap: 16,
  },
  sectionCard: {
    backgroundColor: colors.surfaceCard,
    borderRadius: 14,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    padding: 14,
    gap: 10,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  descriptionText: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 17,
  },
  previewBox: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 10,
    borderCurve: 'continuous',
    padding: 10,
    gap: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#FBBF24',
  },
  previewTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  previewBody: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  actionButtonGroup: {
    gap: 8,
    marginTop: 4,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderCurve: 'continuous',
  },
  actionBtnPrimary: {
    backgroundColor: colors.primary,
  },
  actionBtnActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderWidth: 1,
    borderColor: colors.secondary,
  },
  actionBtnWarning: {
    backgroundColor: '#059669',
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  actionBtnTextPrimary: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  statusFeedbackText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.secondary,
    marginTop: 4,
  },
});
