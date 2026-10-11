import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  Platform,
  Alert,
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Task, PriorityLevel, PRIORITY_MAP } from '../types/task';
import { wouldCreateCycle } from '../utils/urgency';
import { colors } from '../theme/colors';

interface TaskModalProps {
  visible: boolean;
  editingTask: Task | null;
  allTasks: Task[];
  onClose: () => void;
  onSave: (taskData: Omit<Task, 'id' | 'createdAt' | 'completed' | 'completedAt'> & { id?: string }) => void;
}

export const TaskModal: React.FC<TaskModalProps> = ({
  visible,
  editingTask,
  allTasks,
  onClose,
  onSave,
}) => {
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [basePriority, setBasePriority] = useState<PriorityLevel>(3);
  const [hasDeadline, setHasDeadline] = useState(false);
  const [deadlineDate, setDeadlineDate] = useState<Date>(new Date(Date.now() + 6 * 3600 * 1000));
  const [blockedBy, setBlockedBy] = useState<string[]>([]);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  useEffect(() => {
    if (editingTask) {
      setTitle(editingTask.title);
      setNotes(editingTask.notes || '');
      setBasePriority(editingTask.basePriority);
      if (editingTask.deadline) {
        setHasDeadline(true);
        setDeadlineDate(new Date(editingTask.deadline));
      } else {
        setHasDeadline(false);
        setDeadlineDate(new Date(Date.now() + 6 * 3600 * 1000));
      }
      setBlockedBy(editingTask.blockedBy || []);
    } else {
      // Default new task
      setTitle('');
      setNotes('');
      setBasePriority(3);
      setHasDeadline(false);
      setDeadlineDate(new Date(Date.now() + 6 * 3600 * 1000));
      setBlockedBy([]);
    }
  }, [editingTask, visible]);

  const handleDateChange = (_event: DateTimePickerEvent, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      const updated = new Date(deadlineDate);
      updated.setFullYear(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
      setDeadlineDate(updated);
    }
  };

  const handleTimeChange = (_event: DateTimePickerEvent, selectedTime?: Date) => {
    setShowTimePicker(false);
    if (selectedTime) {
      const updated = new Date(deadlineDate);
      updated.setHours(selectedTime.getHours(), selectedTime.getMinutes(), 0, 0);
      setDeadlineDate(updated);
    }
  };

  const handleQuickDeadline = (hoursFromNow: number) => {
    setHasDeadline(true);
    setDeadlineDate(new Date(Date.now() + hoursFromNow * 3600 * 1000));
  };

  const toggleBlocker = (candidateId: string) => {
    if (blockedBy.includes(candidateId)) {
      setBlockedBy(blockedBy.filter((id) => id !== candidateId));
    } else {
      // Verify no cycle
      if (editingTask && wouldCreateCycle(editingTask.id, candidateId, allTasks)) {
        Alert.alert(
          'Circular Dependency Detected',
          'Selecting this task would create a circular dependency loop (A blocks B, B blocks A).',
          [{ text: 'OK' }]
        );
        return;
      }
      setBlockedBy([...blockedBy, candidateId]);
    }
  };

  const handleSave = () => {
    if (!title.trim()) {
      Alert.alert('Required Field', 'Please enter a task title.', [{ text: 'OK' }]);
      return;
    }

    onSave({
      id: editingTask?.id,
      title: title.trim(),
      notes: notes.trim() ? notes.trim() : undefined,
      basePriority,
      deadline: hasDeadline ? deadlineDate.toISOString() : null,
      blockedBy,
      estimatedDurationMinutes: editingTask?.estimatedDurationMinutes || 60,
    });
    onClose();
  };

  // Filter available candidate blockers (exclude self)
  const candidateTasks = allTasks.filter((t) => {
    if (editingTask && t.id === editingTask.id) return false;
    return !t.completed;
  });

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
            <Text style={styles.modalTitle}>
              {editingTask ? 'Edit Task' : 'New Task'}
            </Text>
            <Pressable onPress={onClose} hitSlop={10} style={styles.closeButton}>
              <MaterialCommunityIcons name="close" size={22} color={colors.textSecondary} />
            </Pressable>
          </View>

          <ScrollView
            style={styles.formScroll}
            contentContainerStyle={styles.formContainer}
            keyboardShouldPersistTaps="handled"
          >
            {/* Title Input */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Task Name *</Text>
              <TextInput
                style={styles.textInput}
                value={title}
                onChangeText={setTitle}
                placeholder="e.g. Deploy urgent bugfix to server"
                placeholderTextColor={colors.textTertiary}
                autoFocus={!editingTask}
              />
            </View>

            {/* Notes Input */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Notes / Context (Optional)</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                value={notes}
                onChangeText={setNotes}
                placeholder="Additional instructions or checklist..."
                placeholderTextColor={colors.textTertiary}
                multiline
                numberOfLines={2}
              />
            </View>

            {/* Base Priority Selector */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Base Priority (1 - 5)</Text>
              <View style={styles.prioritySelectorRow}>
                {([1, 2, 3, 4, 5] as PriorityLevel[]).map((level) => {
                  const meta = PRIORITY_MAP[level];
                  const isSelected = basePriority === level;
                  return (
                    <Pressable
                      key={level}
                      style={[
                        styles.priorityChip,
                        isSelected ? { backgroundColor: meta.color, borderColor: meta.color } : null,
                      ]}
                      onPress={() => setBasePriority(level)}
                    >
                      <Text
                        style={[
                          styles.priorityChipLevel,
                          isSelected ? styles.priorityChipLevelSelected : { color: meta.color },
                        ]}
                      >
                        {level}
                      </Text>
                      <Text
                        style={[
                          styles.priorityChipLabel,
                          isSelected ? styles.priorityChipLabelSelected : null,
                        ]}
                      >
                        {meta.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Optional Deadline */}
            <View style={styles.fieldGroup}>
              <View style={styles.deadlineToggleRow}>
                <View>
                  <Text style={styles.fieldLabel}>Hard Deadline (Optional)</Text>
                  <Text style={styles.fieldSubtext}>
                    Powers the exponential True Urgency time-decay
                  </Text>
                </View>
                <Pressable
                  style={[styles.togglePill, hasDeadline ? styles.togglePillActive : null]}
                  onPress={() => setHasDeadline(!hasDeadline)}
                >
                  <Text style={[styles.togglePillText, hasDeadline ? styles.togglePillTextActive : null]}>
                    {hasDeadline ? 'Enabled' : 'None'}
                  </Text>
                </Pressable>
              </View>

              {hasDeadline ? (
                <View style={styles.deadlineContainer}>
                  {/* Quick Preset Buttons */}
                  <View style={styles.presetsRow}>
                    <Pressable style={styles.presetButton} onPress={() => handleQuickDeadline(3)}>
                      <Text style={styles.presetText}>+3 Hours</Text>
                    </Pressable>
                    <Pressable style={styles.presetButton} onPress={() => handleQuickDeadline(6)}>
                      <Text style={styles.presetText}>+6 Hours (Today)</Text>
                    </Pressable>
                    <Pressable style={styles.presetButton} onPress={() => handleQuickDeadline(24)}>
                      <Text style={styles.presetText}>Tomorrow</Text>
                    </Pressable>
                    <Pressable style={styles.presetButton} onPress={() => handleQuickDeadline(168)}>
                      <Text style={styles.presetText}>Next Week</Text>
                    </Pressable>
                  </View>

                  {/* Pickers Buttons */}
                  <View style={styles.pickerButtonsRow}>
                    <Pressable
                      style={styles.pickerButton}
                      onPress={() => setShowDatePicker(true)}
                    >
                      <MaterialCommunityIcons name="calendar" size={16} color={colors.primaryLight} />
                      <Text style={styles.pickerButtonText}>
                        {deadlineDate.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                      </Text>
                    </Pressable>

                    <Pressable
                      style={styles.pickerButton}
                      onPress={() => setShowTimePicker(true)}
                    >
                      <MaterialCommunityIcons name="clock-outline" size={16} color={colors.primaryLight} />
                      <Text style={styles.pickerButtonText}>
                        {deadlineDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </Pressable>
                  </View>

                  {showDatePicker ? (
                    <DateTimePicker
                      value={deadlineDate}
                      mode="date"
                      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                      onChange={handleDateChange}
                    />
                  ) : null}

                  {showTimePicker ? (
                    <DateTimePicker
                      value={deadlineDate}
                      mode="time"
                      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                      onChange={handleTimeChange}
                    />
                  ) : null}
                </View>
              ) : null}
            </View>

            {/* Blocked By Dependencies */}
            <View style={styles.fieldGroup}>
              <View>
                <Text style={styles.fieldLabel}>Blocked By (Task Dependencies)</Text>
                <Text style={styles.fieldSubtext}>
                  This task cannot start until selected prerequisite tasks are completed
                </Text>
              </View>

              {candidateTasks.length === 0 ? (
                <Text style={styles.emptyCandidatesText}>
                  No other active tasks available to block this task.
                </Text>
              ) : (
                <View style={styles.candidateList}>
                  {candidateTasks.map((cand) => {
                    const isSelected = blockedBy.includes(cand.id);
                    const causesLoop =
                      editingTask && wouldCreateCycle(editingTask.id, cand.id, allTasks);

                    return (
                      <Pressable
                        key={cand.id}
                        style={[
                          styles.candidateItem,
                          isSelected ? styles.candidateItemSelected : null,
                          causesLoop ? styles.candidateItemDisabled : null,
                        ]}
                        onPress={() => !causesLoop && toggleBlocker(cand.id)}
                        disabled={causesLoop}
                      >
                        <MaterialCommunityIcons
                          name={isSelected ? 'checkbox-marked' : 'checkbox-blank-outline'}
                          size={20}
                          color={isSelected ? colors.primaryLight : colors.textTertiary}
                        />
                        <View style={{ flex: 1 }}>
                          <Text
                            style={[
                              styles.candidateTitle,
                              isSelected ? styles.candidateTitleSelected : null,
                              causesLoop ? styles.candidateTitleDisabled : null,
                            ]}
                            numberOfLines={1}
                          >
                            {cand.title}
                          </Text>
                          {causesLoop ? (
                            <Text style={styles.loopWarningText}>
                              ⚠️ Selecting this would create a circular loop
                            </Text>
                          ) : null}
                        </View>
                        <Text style={styles.candidatePriority}>
                          P{cand.basePriority}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </View>
          </ScrollView>

          {/* Footer Save & Cancel */}
          <View style={styles.footerRow}>
            <Pressable style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>
            <Pressable style={styles.saveButton} onPress={handleSave}>
              <Text style={styles.saveButtonText}>
                {editingTask ? 'Save Changes' : 'Create Task'}
              </Text>
            </Pressable>
          </View>
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
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  closeButton: {
    padding: 4,
  },
  formScroll: {
    maxHeight: 520,
  },
  formContainer: {
    padding: 20,
    gap: 18,
  },
  fieldGroup: {
    gap: 8,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  fieldSubtext: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  textInput: {
    backgroundColor: colors.surfaceCard,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: 12,
    borderCurve: 'continuous',
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: colors.textPrimary,
    fontSize: 15,
  },
  textArea: {
    minHeight: 64,
    textAlignVertical: 'top',
  },
  prioritySelectorRow: {
    flexDirection: 'row',
    gap: 6,
  },
  priorityChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    backgroundColor: colors.surfaceCard,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  priorityChipLevel: {
    fontSize: 16,
    fontWeight: '700',
  },
  priorityChipLevelSelected: {
    color: '#FFFFFF',
  },
  priorityChipLabel: {
    fontSize: 10,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  priorityChipLabelSelected: {
    color: '#FFFFFF',
  },
  deadlineToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  togglePill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderCurve: 'continuous',
    backgroundColor: colors.surfaceCard,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  togglePillActive: {
    backgroundColor: colors.primaryContainer,
    borderColor: colors.primary,
  },
  togglePillText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  togglePillTextActive: {
    color: colors.onPrimaryContainer,
  },
  deadlineContainer: {
    backgroundColor: colors.surfaceCard,
    borderRadius: 12,
    borderCurve: 'continuous',
    padding: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  presetsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  presetButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderCurve: 'continuous',
  },
  presetText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  pickerButtonsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  pickerButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderCurve: 'continuous',
  },
  pickerButtonText: {
    fontSize: 13,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  emptyCandidatesText: {
    fontSize: 12,
    color: colors.textTertiary,
    fontStyle: 'italic',
  },
  candidateList: {
    gap: 6,
  },
  candidateItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surfaceCard,
    padding: 10,
    borderRadius: 10,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  candidateItemSelected: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(249, 115, 22, 0.12)',
  },
  candidateItemDisabled: {
    opacity: 0.4,
  },
  candidateTitle: {
    fontSize: 13,
    color: colors.textPrimary,
  },
  candidateTitleSelected: {
    fontWeight: '600',
    color: colors.textPrimary,
  },
  candidateTitleDisabled: {
    color: colors.textTertiary,
  },
  candidatePriority: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textTertiary,
  },
  loopWarningText: {
    fontSize: 10,
    color: colors.danger,
    marginTop: 2,
  },
  footerRow: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.outlineVariant,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderCurve: 'continuous',
    backgroundColor: colors.surfaceCard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  saveButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderCurve: 'continuous',
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
