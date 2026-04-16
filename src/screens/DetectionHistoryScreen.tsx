/**
 * DetectionHistoryScreen — HISTORY tab.
 *
 * All data comes from the `history` prop passed down from App.tsx.
 * Nothing is hardcoded — starts empty and grows as detections are confirmed
 * or corrected on the Scan / Learn screens.
 *
 * 🔌 AI INTEGRATION POINTS:
 *   1. Replace in-memory `history` array with expo-sqlite persistence in App.tsx
 *   2. Add pull-to-refresh wired to a database sync / reload
 */
import React from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ListRenderItemInfo,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { NavigationProps } from '../types/navigation';
import { useAppTheme } from '../theme/appTheme';
import { Detection } from '../types/detection';
import TopAppBar from '../components/TopAppBar';

type Props = NavigationProps & {
  /** All confirmed / corrected detections, newest first. */
  history: Detection[];
};

function StatusBadge({ status }: { status: Detection['status'] }) {
  const theme = useAppTheme();

  const config = {
    verified:  { color: theme.primary,   label: 'VERIFIED'  },
    corrected: { color: theme.secondary, label: 'CORRECTED' },
    ambiguous: { color: theme.amber,     label: 'AMBIGUOUS' },
    unknown:   { color: theme.error,     label: 'UNKNOWN'   },
  }[status];

  return (
    <View style={[styles.badge, { backgroundColor: config.color + '18', borderColor: config.color + '40' }]}>
      <Text style={[styles.badgeText, { color: config.color }]}>{config.label}</Text>
    </View>
  );
}

function HistoryItem({ item }: { item: Detection }) {
  const theme = useAppTheme();
  const leftColor = item.status === 'corrected' ? theme.primary
    : item.status === 'ambiguous' ? theme.error
    : theme.border;

  return (
    <TouchableOpacity
      style={[styles.item, { backgroundColor: theme.surface, borderColor: theme.border, borderLeftColor: leftColor }]}
      activeOpacity={0.7}
    >
      <View style={[styles.thumb, { backgroundColor: theme.surfaceElevated }]}>
        <MaterialCommunityIcons name="cube-outline" size={20} color={theme.mutedText} />
      </View>

      <View style={styles.itemInfo}>
        <View style={styles.itemTopRow}>
          <Text style={[styles.itemLabel, { color: theme.primaryText }]} numberOfLines={1}>
            {item.label}
          </Text>
          <Text style={[styles.itemTime, { color: theme.mutedText }]}>{item.timestamp}</Text>
        </View>

        <View style={[styles.barTrack, { backgroundColor: theme.border }]}>
          <View
            style={[
              styles.barFill,
              {
                width: `${item.confidence}%` as any,
                backgroundColor: item.confidence >= 85 ? theme.primary
                  : item.confidence >= 70 ? theme.amber
                  : theme.error,
              },
            ]}
          />
        </View>

        <View style={styles.itemBottomRow}>
          <StatusBadge status={item.status} />
          <Text style={[styles.confText, { color: theme.mutedText }]}>{item.confidence}%</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function EmptyHistory() {
  const theme = useAppTheme();
  return (
    <View style={styles.emptyState}>
      <MaterialCommunityIcons name="history" size={52} color={theme.mutedText} />
      <Text style={[styles.emptyTitle, { color: theme.mutedText }]}>No detections yet</Text>
      <Text style={[styles.emptyHint, { color: theme.mutedText }]}>
        Detections you confirm or correct on the Scan screen will appear here.
      </Text>
    </View>
  );
}

export default function DetectionHistoryScreen({ history }: Props) {
  const theme = useAppTheme();

  // Stats are derived entirely from the live history array — no hardcoded values.
  const total    = history.length;
  const accurate = history.filter(d => d.status !== 'ambiguous' && d.status !== 'unknown').length;
  const accuracy = total > 0 ? Math.round((accurate / total) * 100) : 0;
  const lastSeen = history.length > 0 ? history[0].timestamp : '—';

  const ListHeader = (
    <>
      <View style={[styles.statsCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: theme.primaryText }]}>{total}</Text>
            <Text style={[styles.statLabel, { color: theme.mutedText }]}>Detections</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: theme.divider }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: theme.primary }]}>{accuracy}%</Text>
            <Text style={[styles.statLabel, { color: theme.mutedText }]}>Accuracy</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: theme.divider }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: theme.secondary }]}>{lastSeen}</Text>
            <Text style={[styles.statLabel, { color: theme.mutedText }]}>Last Scan</Text>
          </View>
        </View>

        <View style={[styles.accTrack, { backgroundColor: theme.border }]}>
          <View style={[styles.accFill, { width: `${accuracy}%` as any, backgroundColor: theme.primary }]} />
        </View>
      </View>

      {total > 0 && (
        <Text style={[styles.listHeading, { color: theme.mutedText }]}>RECENT DETECTIONS</Text>
      )}
    </>
  );

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <TopAppBar title="HISTORY" />

      <FlatList<Detection>
        data={history}
        keyExtractor={item => item.id}
        renderItem={({ item }: ListRenderItemInfo<Detection>) => <HistoryItem item={item} />}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={<EmptyHistory />}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        ListFooterComponent={<View style={{ height: 96 }} />}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  listContent: {
    padding: 16,
    gap: 8,
  },

  // Stats card
  statsCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
    gap: 12,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  statDivider: {
    width: 1,
    height: 32,
  },
  accTrack: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  accFill: {
    height: 4,
    borderRadius: 2,
  },

  listHeading: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: 4,
  },

  // History item
  item: {
    flexDirection: 'row',
    borderRadius: 10,
    borderWidth: 1,
    borderLeftWidth: 3,
    padding: 12,
    gap: 12,
    alignItems: 'center',
  },
  thumb: {
    width: 44,
    height: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemInfo: { flex: 1, gap: 6 },
  itemTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemLabel: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  itemTime: {
    fontSize: 11,
    marginLeft: 6,
  },
  barTrack: {
    height: 3,
    borderRadius: 2,
    overflow: 'hidden',
  },
  barFill: {
    height: 3,
    borderRadius: 2,
  },
  itemBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  confText: {
    fontSize: 11,
  },

  // Badge
  badge: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.8,
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 32,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  emptyHint: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
  },
});
