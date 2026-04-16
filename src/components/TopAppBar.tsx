/**
 * TopAppBar — SYNTHETIC_EYE logo header.
 *
 * Follows otic-mobile's ScreenTitleBar pattern.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../theme/appTheme';

type Props = {
  title?: string;
  showAiBadge?: boolean;
};

export default function TopAppBar({ title = 'SYNTHETIC_EYE', showAiBadge = true }: Props) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.surface,
          borderBottomColor: theme.border,
          paddingTop: insets.top + 8,
        },
      ]}
    >
      {/* Logo row */}
      <View style={styles.logoRow}>
        <MaterialCommunityIcons name="eye-outline" size={18} color={theme.primary} />
        <Text style={[styles.title, { color: theme.primaryText }]}>{title}</Text>
      </View>

      {/* AI status badge */}
      {showAiBadge && (
        <View
          style={[
            styles.badge,
            {
              borderColor: theme.primary + '40',
              backgroundColor: theme.primary + '18',
            },
          ]}
        >
          <View style={[styles.dot, { backgroundColor: theme.primary }]} />
          <Text style={[styles.badgeText, { color: theme.primary }]}>AI ACTIVE</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 2.5,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
  },
});
