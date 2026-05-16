/**
 * App.tsx — SYNTHETIC_EYE root component.
 *
 * Custom AppRoute state-machine router (otic-mobile pattern).
 * No React Navigation — routing is pure useState.
 *
 * Detection state is lifted here so Scan, Learn, and History screens
 * all share the same source of truth.
 *
 * To navigate from any screen:  navigateTo('learn')
 * To go back:                   goBack()
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppRoute } from './src/types/navigation';
import { BoundingBox, Detection } from './src/types/detection';
import { matchAndScore, DetectionInput } from './src/matching';
import { preloadModel } from './src/detection/DetectionEngine';
import MobileBottomNav from './src/components/MobileBottomNav';
import CameraDetectionScreen from './src/screens/CameraDetectionScreen';
import CorrectionLearningScreen from './src/screens/CorrectionLearningScreen';
import DetectionHistoryScreen from './src/screens/DetectionHistoryScreen';

// ── Kick off model load immediately at module init time ──────────────────────
// By the time the user taps the Scan tab, the model is already warm.
preloadModel();

export default function App() {
  const [route, setRoute] = useState<AppRoute>('scan');
  const routeHistoryRef = useRef<AppRoute[]>([]);

  // ─── Shared detection state ────────────────────────────────────────────────
  const [activeDetection, setActiveDetection]         = useState<Detection | null>(null);
  const [activeBoundingBoxes, setActiveBoundingBoxes] = useState<BoundingBox[]>([]);
  const [detectionHistory, setDetectionHistory]       = useState<Detection[]>([]);

  // historyRef keeps useDetectionLoop's interval closure up-to-date without
  // re-creating the loop every time history grows.
  const historyRef = useRef<string[]>([]);
  useEffect(() => {
    historyRef.current = detectionHistory.map(d => d.label);
  }, [detectionHistory]);

  // ─── Navigation ────────────────────────────────────────────────────────────
  const navigateTo = (nextRoute: AppRoute) => {
    setRoute(current => {
      if (current !== nextRoute) routeHistoryRef.current.push(current);
      return nextRoute;
    });
  };

  const goBack = () => {
    setRoute(current => routeHistoryRef.current.pop() ?? current);
  };

  // ─── Detection callbacks ───────────────────────────────────────────────────

  /**
   * Called by useDetectionLoop after the full pipeline:
   *   capture → resize → YOLOv8 → feature extraction → matchAndScore
   *
   * The Detection received here is already fully enriched — just lift into state.
   */
  const onDetectionResult = useCallback((detection: Detection, boxes: BoundingBox[]) => {
    setActiveDetection(detection);
    setActiveBoundingBoxes(boxes);
  }, []);

  /** User confirmed the active detection is correct — saves to history. */
  const onConfirmDetection = useCallback(() => {
    if (!activeDetection) return;
    const verified: Detection = { ...activeDetection, status: 'verified', suggestions: undefined };
    setDetectionHistory(prev => [verified, ...prev]);
    setActiveDetection(null);
    setActiveBoundingBoxes([]);
  }, [activeDetection]);

  /** Clear active detection (called when camera stops). */
  const clearDetection = useCallback(() => {
    setActiveDetection(null);
    setActiveBoundingBoxes([]);
  }, []);

  /** User saved a correction from the Learn screen — saves corrected entry to history. */
  const onSaveCorrection = useCallback((correctedLabel: string) => {
    if (!activeDetection) return;
    const corrected: Detection = {
      ...activeDetection,
      label:       correctedLabel,
      status:      'corrected',
      suggestions: undefined,
    };
    setDetectionHistory(prev => [corrected, ...prev]);
    setActiveDetection(null);
    setActiveBoundingBoxes([]);
  }, [activeDetection]);

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />

      {route === 'scan' && (
        <CameraDetectionScreen
          navigateTo={navigateTo}
          goBack={goBack}
          detection={activeDetection}
          boundingBoxes={activeBoundingBoxes}
          onDetectionResult={onDetectionResult}
          onConfirm={onConfirmDetection}
          onClearDetection={clearDetection}
        />
      )}
      {route === 'learn' && (
        <CorrectionLearningScreen
          navigateTo={navigateTo}
          goBack={goBack}
          currentDetection={activeDetection}
          onSaveCorrection={onSaveCorrection}
        />
      )}
      {route === 'history' && (
        <DetectionHistoryScreen
          navigateTo={navigateTo}
          goBack={goBack}
          history={detectionHistory}
        />
      )}

      <MobileBottomNav activeRoute={route} navigateTo={navigateTo} />
    </SafeAreaProvider>
  );
}
