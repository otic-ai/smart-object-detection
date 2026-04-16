/**
 * CorrectionLearningScreen — LEARN tab.
 *
 * Displays the active detection passed from the Scan screen and lets the
 * user correct it. All data comes from props — nothing is hardcoded.
 *
 * When there is no active detection (`currentDetection === null`), the
 * screen shows an empty "nothing to correct" state.
 *
 * 🔌 AI INTEGRATION POINTS:
 *   1. Replace the empty suggestions section with real similarity-search results
 *   2. Wire `onSaveCorrection` persistence to expo-sqlite in App.tsx
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { NavigationProps } from '../types/navigation';
import { Detection } from '../types/detection';
import { useAppTheme } from '../theme/appTheme';
import TopAppBar from '../components/TopAppBar';

type Props = NavigationProps & {
  /** Active detection from App.tsx. Null = no detection pending correction. */
  currentDetection: Detection | null;
  /** Called with the user-chosen label when they save a correction. */
  onSaveCorrection: (correctedLabel: string) => void;
};

export default function CorrectionLearningScreen({
  navigateTo,
  currentDetection,
  onSaveCorrection,
}: Props) {
  const theme = useAppTheme();
  const [searchText, setSearchText] = useState('');

  const handleSaveCorrection = () => {
    if (!currentDetection || !searchText.trim()) return;
    // 🔌 AI INTEGRATION POINT:
    //   App.tsx `onSaveCorrection` persists to expo-sqlite and feeds the
    //   correction back into the learning pipeline.
    onSaveCorrection(searchText.trim());
    navigateTo('scan');
  };

  // ─── No active detection ───────────────────────────────────────────────────
  if (!currentDetection) {
    return (
      <View style={[styles.root, { backgroundColor: theme.background }]}>
        <TopAppBar title="CORRECTION" />
        <View style={styles.emptyState}>
          <MaterialCommunityIcons name="cube-off-outline" size={52} color={theme.mutedText} />
          <Text style={[styles.emptyTitle, { color: theme.mutedText }]}>Nothing to correct</Text>
          <Text style={[styles.emptyHint, { color: theme.mutedText }]}>
            Go to Scan and confirm or correct a detection first.
          </Text>
        </View>
      </View>
    );
  }

  // ─── Active detection ──────────────────────────────────────────────────────
  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <TopAppBar title="CORRECTION" />

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* Current detection card — populated from model output */}
        <View style={[styles.detectionCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.detectionRow}>
            <View style={[styles.thumb, { backgroundColor: theme.surfaceElevated }]}>
              <MaterialCommunityIcons name="cube-outline" size={24} color={theme.mutedText} />
            </View>
            <View style={styles.detectionInfo}>
              <Text style={[styles.detectionLabel, { color: theme.primaryText }]}>
                {currentDetection.label}
              </Text>
              <Text style={[styles.detectionConf, { color: theme.amber }]}>
                {currentDetection.confidence}% confidence
              </Text>
            </View>
          </View>
          <View style={[styles.badge, { backgroundColor: theme.amber + '20', borderColor: theme.amber + '40' }]}>
            <Text style={[styles.badgeText, { color: theme.amber }]}>
              {currentDetection.status.toUpperCase()}
            </Text>
          </View>
        </View>

        {/* Section heading */}
        <Text style={[styles.sectionHeading, { color: theme.secondaryText }]}>
          WHAT IS THIS OBJECT?
        </Text>

        {/* Search input */}
        {/* 🔌 Wire to real similarity search / product database */}
        <View style={[styles.searchBar, { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder }]}>
          <MaterialCommunityIcons name="magnify" size={18} color={theme.mutedText} />
          <TextInput
            style={[styles.searchInput, { color: theme.inputText }]}
            placeholder="Type the correct object name…"
            placeholderTextColor={theme.inputPlaceholder}
            value={searchText}
            onChangeText={setSearchText}
          />
        </View>

        {/* Suggestions — empty until real similarity search is wired */}
        <Text style={[styles.suggestionsHeading, { color: theme.mutedText }]}>
          AI SUGGESTIONS
        </Text>
        {/* 🔌 AI INTEGRATION POINT — replace this with SuggestionCard components
             driven by a real similarity search against your object database */}
        <View style={[styles.emptySuggestions, { borderColor: theme.border }]}>
          <MaterialCommunityIcons name="magnify" size={20} color={theme.mutedText} />
          <Text style={[styles.emptySuggestionsText, { color: theme.mutedText }]}>
            No suggestions yet — connect similarity search
          </Text>
        </View>

        {/* Feedback notice */}
        <View style={[styles.notice, { backgroundColor: theme.secondary + '12', borderColor: theme.secondary + '30' }]}>
          <MaterialCommunityIcons name="information-outline" size={16} color={theme.secondary} />
          <Text style={[styles.noticeText, { color: theme.secondary }]}>
            Your correction helps SYNTHETIC_EYE improve over time.
          </Text>
        </View>
      </ScrollView>

      {/* Fixed save button */}
      <View style={[styles.footer, { backgroundColor: theme.surface, borderTopColor: theme.border }]}>
        <TouchableOpacity
          style={[
            styles.saveBtn,
            { backgroundColor: searchText.trim() ? theme.primary : theme.primary + '40' },
          ]}
          onPress={handleSaveCorrection}
          disabled={!searchText.trim()}
          activeOpacity={0.8}
        >
          <Text style={[styles.saveBtnText, { color: '#0E0E0E' }]}>Save Correction</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  // Empty state (no active detection)
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 32,
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

  content: {
    padding: 16,
    paddingBottom: 24,
    gap: 12,
  },

  // Detection card
  detectionCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  detectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  thumb: {
    width: 52,
    height: 52,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detectionInfo: { flex: 1 },
  detectionLabel: { fontSize: 16, fontWeight: '700' },
  detectionConf: { fontSize: 13, marginTop: 2 },
  badge: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8 },

  // Section headings
  sectionHeading: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginTop: 4,
  },
  suggestionsHeading: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
  },

  // Search
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    height: 44,
  },

  // Empty suggestions
  emptySuggestions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    padding: 16,
  },
  emptySuggestionsText: {
    fontSize: 13,
    flex: 1,
  },

  // Notice
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
  },
  noticeText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
  },

  // Footer
  footer: {
    padding: 16,
    paddingBottom: 88,
    borderTopWidth: 1,
  },
  saveBtn: {
    height: 48,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
