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
import MobileBottomNav from './src/components/MobileBottomNav';
import CameraDetectionScreen from './src/screens/CameraDetectionScreen';
import CorrectionLearningScreen from './src/screens/CorrectionLearningScreen';
import DetectionHistoryScreen from './src/screens/DetectionHistoryScreen';

export default function App() {
  const [route, setRoute] = useState<AppRoute>('scan');
  const routeHistoryRef = useRef<AppRoute[]>([]);

  // ─── Shared detection state ────────────────────────────────────────────────
  const [activeDetection, setActiveDetection]         = useState<Detection | null>(null);
  const [activeBoundingBoxes, setActiveBoundingBoxes] = useState<BoundingBox[]>([]);
  const [detectionHistory, setDetectionHistory]       = useState<Detection[]>([]);
  // Ref so onDetectionResult always sees the latest history without re-creating.
  const historyRef = useRef<Detection[]>([]);

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

  // Keep historyRef in sync with state so callbacks never stale-close over it.
  useEffect(() => { historyRef.current = detectionHistory; }, [detectionHistory]);

  // ─── Demo detection — fires once on mount so the pipeline is visible ───────
  // Remove this block once the real YOLOv8 model is wired in.
  useEffect(() => {
    const timer = setTimeout(() => {
      const demoRaw: Detection = {
        id: 'demo-1',
        label: 'bottle',
        confidence: 68,
        status: 'ambiguous',
        timestamp: new Date().toLocaleTimeString(),
      };
      const demoBoxes: BoundingBox[] = [{
        x: 30, y: 20, width: 40, height: 55,
        label: 'bottle', confidence: 68,
      }];
      onDetectionResult(demoRaw, demoBoxes);
    }, 2000);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Detection callbacks ───────────────────────────────────────────────────

  /**
   * 🔌 AI INTEGRATION POINT
   * Call this from the YOLOv8 / TFLite model on each processed frame.
   * Raw detection is passed through matchAndScore() before being stored,
   * so the UI always shows the refined label, status, and suggestions.
   */
  const onDetectionResult = useCallback((raw: Detection, boxes: BoundingBox[]) => {
    const input: DetectionInput = {
      id:         raw.id,
      class:      raw.label.toLowerCase(),
      confidence: raw.confidence / 100,   // matchAndScore expects 0–1
    };

    const pastLabels = historyRef.current.map(d => d.label);
    const match      = matchAndScore(input, pastLabels);

    const enhanced: Detection = {
      ...raw,
      label:       match.label,
      confidence:  Math.round(match.confidence * 100),
      status:      match.status,
      suggestions: match.suggestions,
    };

    setActiveDetection(enhanced);
    setActiveBoundingBoxes(boxes);
  }, []);

  /** User confirmed the active detection is correct — saves to history. */
  const onConfirmDetection = useCallback(() => {
    if (!activeDetection) return;
    const verified: Detection = { ...activeDetection, status: 'verified', suggestions: undefined };
    setDetectionHistory(prev => {
      historyRef.current = [verified, ...prev];
      return historyRef.current;
    });
    setActiveDetection(null);
    setActiveBoundingBoxes([]);
  }, [activeDetection]);

  /** Clear active detection (called when camera stops) */
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
    setDetectionHistory(prev => {
      historyRef.current = [corrected, ...prev];
      return historyRef.current;
    });
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

