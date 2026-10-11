import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { colors } from '../theme/colors';

export type FilterType = 'doNow' | 'all' | 'blocked' | 'completed';

interface FilterBarProps {
  activeFilter: FilterType;
  counts: {
    doNow: number;
    all: number;
    blocked: number;
    completed: number;
  };
  onSelectFilter: (filter: FilterType) => void;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  activeFilter,
  counts,
  onSelectFilter,
}) => {
  const tabs: { key: FilterType; label: string; count: number }[] = [
    { key: 'doNow', label: 'Do Now', count: counts.doNow },
    { key: 'all', label: 'All', count: counts.all },
    { key: 'blocked', label: 'Blocked', count: counts.blocked },
    { key: 'completed', label: 'Done', count: counts.completed },
  ];

  return (
    <View style={styles.container}>
      {tabs.map((tab) => {
        const isActive = activeFilter === tab.key;
        return (
          <Pressable
            key={tab.key}
            style={[styles.tab, isActive ? styles.tabActive : null]}
            onPress={() => onSelectFilter(tab.key)}
            accessibilityRole="button"
          >
            <Text style={[styles.tabLabel, isActive ? styles.tabLabelActive : null]}>
              {tab.label}
            </Text>
            <View style={[styles.countBadge, isActive ? styles.countBadgeActive : null]}>
              <Text style={[styles.countText, isActive ? styles.countTextActive : null]}>
                {tab.count}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceCard,
    borderRadius: 12,
    borderCurve: 'continuous',
    padding: 4,
    gap: 4,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 8,
    borderCurve: 'continuous',
  },
  tabActive: {
    backgroundColor: colors.primaryContainer,
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  tabLabelActive: {
    color: colors.onPrimaryContainer,
    fontWeight: '700',
  },
  countBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
    borderCurve: 'continuous',
  },
  countBadgeActive: {
    backgroundColor: colors.primary,
  },
  countText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  countTextActive: {
    color: '#FFFFFF',
  },
});
