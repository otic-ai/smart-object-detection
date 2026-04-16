/**
 * MobileBottomNav — otic-mobile pattern.
 *
 * Custom bottom tab bar driven by AppRoute state.
 * No React Navigation — activeRoute prop + navigateTo callback.
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppRoute } from '../types/navigation';
import { useAppTheme } from '../theme/appTheme';

type Props = {
  activeRoute: AppRoute;
  navigateTo: (route: AppRoute) => void;
};

type TabItem = {
  route: AppRoute;
  icon: string;
  label: string;
};

const TABS: TabItem[] = [
  { route: 'scan',    icon: 'cube-scan', label: 'Scan'    },
  { route: 'learn',   icon: 'brain',     label: 'Learn'   },
  { route: 'history', icon: 'history',   label: 'History' },
];

export default function MobileBottomNav({ activeRoute, navigateTo }: Props) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.navBackground,
          borderTopColor: theme.navBorder,
          paddingBottom: insets.bottom + 8,
        },
      ]}
    >
      {TABS.map(tab => {
        const active = activeRoute === tab.route;
        const color = active ? theme.primary : theme.mutedText;

        return (
          <TouchableOpacity
            key={tab.route}
            style={styles.tab}
            onPress={() => navigateTo(tab.route)}
            activeOpacity={0.7}
          >
            {/* Active indicator line */}
            {active && (
              <View style={[styles.indicator, { backgroundColor: theme.primary }]} />
            )}

            <MaterialCommunityIcons
              name={tab.icon as React.ComponentProps<typeof MaterialCommunityIcons>['name']}
              size={22}
              color={color}
            />
            <Text style={[styles.label, { color }]}>{tab.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    borderTopWidth: 1,
    paddingTop: 10,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingTop: 4,
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  indicator: {
    position: 'absolute',
    top: -10,
    height: 2,
    width: 28,
    borderRadius: 1,
  },
});
