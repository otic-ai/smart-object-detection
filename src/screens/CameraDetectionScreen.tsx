/**
 * CameraDetectionScreen — SCAN tab.
 *
 * Shows a live camera feed using expo-camera's CameraView.
 * Handles the permission request flow (asking → denied → granted).
 * Detection label, confidence, and bounding boxes are populated entirely
 * by the model via the `onDetectionResult` callback — nothing is hardcoded.
 *
 * 🔌 AI INTEGRATION POINTS:
 *   1. Capture frames via cameraRef.current.takePictureAsync()
 *   2. Pass frames to on-device YOLOv8 / TFLite model (react-native-fast-tflite)
 *   3. Call `onDetectionResult(detection, boxes)` with model output each frame
 */
import React, { useRef, useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { NavigationProps } from "../types/navigation";
import { BoundingBox, Detection } from "../types/detection";
import { useAppTheme } from "../theme/appTheme";
import TopAppBar from "../components/TopAppBar";
import { useDetectionLoop } from "../detection/useDetectionLoop";

type Props = NavigationProps & {
  detection: Detection | null;
  boundingBoxes: BoundingBox[];
  onDetectionResult: (detection: Detection, boxes: BoundingBox[]) => void;
  onConfirm: () => void;
  onClearDetection: () => void;
};

// Status → colour pill config
const STATUS_CONFIG = {
  verified:  { label: "Verified",  color: "#22C55E" },
  ambiguous: { label: "Ambiguous", color: "#F59E0B" },
  corrected: { label: "Corrected", color: "#3B82F6" },
  unknown:   { label: "Unknown",   color: "#6B7280" },
} as const;

export default function CameraDetectionScreen({
  navigateTo,
  detection,
  boundingBoxes,
  onDetectionResult,
  onConfirm,
  onClearDetection,
}: Props) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const hasDetection = detection !== null;
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const mountIdRef = useRef(Date.now());

  const { isModelReady, modelError, modelLoadProgress } = useDetectionLoop({
    onDetectionResult,
    isActive: isCameraActive && isCameraReady,
    cameraRef,
    throttleMs: 500,
  });

  // ── Spinner animation ────────────────────────────────────────────────────────
  const spinAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (isModelReady) return;
    const loop = Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 900,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [isModelReady, spinAnim]);

  const spinInterpolate = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  // ── Safety reset on mount ────────────────────────────────────────────────────
  useEffect(() => {
    setIsCameraActive(false);
    setIsCameraReady(false);
    mountIdRef.current = Date.now();
    return () => {
      setIsCameraActive(false);
      setIsCameraReady(false);
    };
  }, []);

  // ── Clear detection when camera stops ────────────────────────────────────────
  useEffect(() => {
    if (!isCameraActive) {
      onClearDetection();
      setIsCameraReady(false);
    }
  }, [isCameraActive, onClearDetection]);

  // ─── Permission: not yet determined ─────────────────────────────────────────
  if (!permission) {
    return (
      <View style={[styles.root, { backgroundColor: theme.background }]}>
        <TopAppBar />
        <View style={styles.permissionState}>
          <MaterialCommunityIcons name="camera-outline" size={52} color={theme.mutedText} />
          <Text style={[styles.permissionTitle, { color: theme.mutedText }]}>
            Checking camera permission…
          </Text>
        </View>
      </View>
    );
  }

  // ─── Permission: denied ──────────────────────────────────────────────────────
  if (!permission.granted) {
    return (
      <View style={[styles.root, { backgroundColor: theme.background }]}>
        <TopAppBar />
        <View style={styles.permissionState}>
          <MaterialCommunityIcons name="camera-off-outline" size={52} color={theme.error} />
          <Text style={[styles.permissionTitle, { color: theme.primaryText }]}>
            Camera access required
          </Text>
          <Text style={[styles.permissionHint, { color: theme.mutedText }]}>
            SYNTHETIC_EYE needs the camera to detect objects in real time.
          </Text>
          <TouchableOpacity
            style={[styles.permissionBtn, { backgroundColor: theme.primary }]}
            onPress={requestPermission}
            activeOpacity={0.8}
          >
            <Text style={[styles.permissionBtnText, { color: "#0E0E0E" }]}>
              Grant Permission
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ─── Permission: granted ─────────────────────────────────────────────────────
  const statusCfg = detection ? STATUS_CONFIG[detection.status] ?? STATUS_CONFIG.unknown : null;

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <TopAppBar />

      {/* ─── Camera viewport ─────────────────────────────────────────────── */}
      <View style={styles.cameraContainer}>
        {!isCameraActive && (
          <View
            style={[
              styles.inactiveCamera,
              { backgroundColor: theme.surface, ...StyleSheet.absoluteFillObject, zIndex: 20 },
            ]}
          >
            {!isModelReady && !modelError ? (
              <>
                <Animated.View
                  style={[
                    styles.modelLoadingRing,
                    {
                      borderTopColor: theme.primary,
                      borderColor: theme.border,
                      transform: [{ rotate: spinInterpolate }],
                    },
                  ]}
                />
                <Text style={[styles.inactiveTitle, { color: theme.primaryText, marginTop: 20 }]}>
                  Loading Model…
                </Text>
                <Text style={[styles.inactiveSub, { color: theme.mutedText }]}>
                  {modelLoadProgress ?? "Initialising YOLOv8"}
                </Text>
              </>
            ) : modelError ? (
              <>
                <MaterialCommunityIcons name="alert-circle-outline" size={64} color={theme.error} />
                <Text style={[styles.inactiveTitle, { color: theme.error }]}>Model Failed to Load</Text>
                <Text style={[styles.inactiveSub, { color: theme.mutedText }]}>{modelError}</Text>
              </>
            ) : (
              <>
                <MaterialCommunityIcons name="camera-off" size={64} color={theme.mutedText} />
                <Text style={[styles.inactiveTitle, { color: theme.primaryText }]}>Camera Paused</Text>
                <Text style={[styles.inactiveSub, { color: theme.mutedText }]}>Press Start to begin scanning</Text>
              </>
            )}
          </View>
        )}

        <View style={{ flex: 1 }}>
          <CameraView
            key={`camera-${mountIdRef.current}`}
            ref={cameraRef}
            style={styles.camera}
            facing="back"
            active={isCameraActive}
            pictureSize="640x480"
            onCameraReady={() => { setTimeout(() => setIsCameraReady(true), 500); }}
          />

          <View style={styles.overlay}>
            <View style={[styles.corner, styles.topLeft,    { borderColor: theme.primary }]} />
            <View style={[styles.corner, styles.topRight,   { borderColor: theme.primary }]} />
            <View style={[styles.corner, styles.bottomLeft, { borderColor: theme.primary }]} />
            <View style={[styles.corner, styles.bottomRight,{ borderColor: theme.primary }]} />

            {!hasDetection && isCameraActive && (
              <View style={styles.waitingOverlay}>
                <Text style={[styles.waitingLabel, { color: modelError ? theme.error : theme.mutedText }]}>
                  {modelError ?? (!isModelReady ? "Loading model…" : "Waiting for detection…")}
                </Text>
              </View>
            )}

            {boundingBoxes.map((box, i) => (
              <View
                key={i}
                style={[
                  styles.boundingBox,
                  {
                    left:   `${box.x}%` as any,
                    top:    `${box.y}%` as any,
                    width:  `${box.width}%` as any,
                    height: `${box.height}%` as any,
                    borderColor: theme.primary,
                  },
                ]}
              >
                <View style={[styles.boxLabel, { backgroundColor: theme.primary }]}>
                  <Text style={styles.boxLabelText}>
                    {box.label} {box.confidence}%
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      </View>

      {/* ─── Bottom result panel ──────────────────────────────────────────── */}
      <View
        style={[
          styles.resultPanel,
          {
            backgroundColor: theme.surface,
            borderTopColor: theme.border,
            marginBottom: insets.bottom + 76,
          },
        ]}
      >
        {hasDetection ? (
          <>
            {/* ── Row 1: Label + status pill ── */}
            <View style={styles.detectionHeaderRow}>
              <Text style={[styles.detectionLabel, { color: theme.primaryText }]}>
                {detection.label}
              </Text>
              {statusCfg && (
                <View style={[styles.statusPill, { backgroundColor: statusCfg.color + "22", borderColor: statusCfg.color }]}>
                  <Text style={[styles.statusPillText, { color: statusCfg.color }]}>
                    {statusCfg.label}
                  </Text>
                </View>
              )}
            </View>

            {/* ── Row 2: Confidence ── */}
            <Text style={[styles.resultSub, { color: theme.mutedText }]}>
              {detection.confidence}% confidence
            </Text>

            {/* ── Row 3: Feature chips (OCR + Colour) ── */}
            {(detection.ocrText || detection.dominantColor) && (
              <View style={styles.featureRow}>
                {detection.ocrText && (
                  <View style={[styles.featureChip, { backgroundColor: theme.border }]}>
                    <MaterialCommunityIcons name="text-recognition" size={12} color={theme.mutedText} />
                    <Text style={[styles.featureChipText, { color: theme.primaryText }]} numberOfLines={1}>
                      {detection.ocrText}
                    </Text>
                  </View>
                )}
                {detection.dominantColor && (
                  <View style={[styles.featureChip, { backgroundColor: theme.border }]}>
                    <MaterialCommunityIcons name="palette-outline" size={12} color={theme.mutedText} />
                    <Text style={[styles.featureChipText, { color: theme.primaryText }]}>
                      {detection.dominantColor}
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* ── Row 4: Suggestions (ambiguous only) ── */}
            {detection.suggestions && detection.suggestions.length > 0 && (
              <View style={styles.suggestionsRow}>
                <Text style={[styles.suggestionsLabel, { color: theme.mutedText }]}>
                  Could also be:
                </Text>
                {detection.suggestions.map((s, i) => (
                  <View key={i} style={[styles.suggestionChip, { borderColor: theme.border }]}>
                    <Text style={[styles.suggestionChipText, { color: theme.secondaryText }]}>{s}</Text>
                  </View>
                ))}
              </View>
            )}
          </>
        ) : !isCameraActive ? (
          <View>
            <Text style={[styles.waitingTitle, { color: theme.mutedText }]}>
              {!isModelReady && !modelError ? "Loading Model…" : "Camera Stopped"}
            </Text>
            <Text style={[styles.resultSub, { color: theme.mutedText }]}>
              {!isModelReady && !modelError
                ? modelLoadProgress ?? "Initialising YOLOv8"
                : "Ready to scan when you are"}
            </Text>
          </View>
        ) : (
          <View>
            <Text style={[styles.waitingTitle, { color: theme.mutedText }]}>No detection</Text>
            <Text style={[styles.resultSub, { color: theme.mutedText }]}>Waiting for camera feed…</Text>
          </View>
        )}

        {/* ── Action buttons ── */}
        <View style={styles.actions}>
          {!isCameraActive ? (
            <TouchableOpacity
              style={[
                styles.btnPrimary,
                {
                  backgroundColor: isModelReady && !modelError ? theme.primary : theme.surface,
                  borderWidth: isModelReady && !modelError ? 0 : 1,
                  borderColor: theme.border,
                  opacity: isModelReady && !modelError ? 1 : 0.6,
                },
              ]}
              activeOpacity={isModelReady && !modelError ? 0.8 : 1}
              onPress={() => { if (isModelReady && !modelError) setIsCameraActive(true); }}
              disabled={!isModelReady || !!modelError}
            >
              <Text style={[styles.btnPrimaryText, { color: isModelReady && !modelError ? "#0E0E0E" : theme.mutedText }]}>
                {!isModelReady && !modelError ? "Model Loading…" : "Start Scanning"}
              </Text>
            </TouchableOpacity>
          ) : (
            <>
              <TouchableOpacity
                style={[styles.btnSecondary, { borderColor: theme.error, flex: hasDetection ? 0.4 : 1 }]}
                activeOpacity={0.7}
                onPress={() => setIsCameraActive(false)}
              >
                <Text style={[styles.btnSecondaryText, { color: theme.error }]}>Stop</Text>
              </TouchableOpacity>

              {hasDetection && (
                <>
                  <TouchableOpacity
                    style={[styles.btnSecondary, { borderColor: theme.border, flex: 0.8 }]}
                    activeOpacity={0.7}
                    onPress={() => navigateTo("learn")}
                  >
                    <Text style={[styles.btnSecondaryText, { color: theme.secondaryText }]}>Correct</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.btnPrimary, { backgroundColor: theme.primary, flex: 1.2 }]}
                    activeOpacity={0.7}
                    onPress={() => { onConfirm(); setIsCameraActive(false); }}
                  >
                    <Text style={[styles.btnPrimaryText, { color: "#0E0E0E" }]}>Confirm</Text>
                  </TouchableOpacity>
                </>
              )}
            </>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  permissionState: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14, paddingHorizontal: 32 },
  permissionTitle: { fontSize: 17, fontWeight: "700", textAlign: "center" },
  permissionHint:  { fontSize: 13, textAlign: "center", lineHeight: 20 },
  permissionBtn:   { marginTop: 8, paddingHorizontal: 28, paddingVertical: 12, borderRadius: 10 },
  permissionBtnText: { fontSize: 14, fontWeight: "700" },

  cameraContainer: { flex: 1 },
  inactiveCamera:  { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  modelLoadingRing: { width: 64, height: 64, borderRadius: 32, borderWidth: 4 },
  inactiveTitle: { fontSize: 20, fontWeight: "700", marginTop: 8 },
  inactiveSub:   { fontSize: 14 },
  camera: { flex: 1 },

  waitingOverlay: { position: "absolute", bottom: 20, alignSelf: "center" },
  waitingLabel:   { fontSize: 13, fontWeight: "600" },

  corner:      { position: "absolute", width: 24, height: 24, borderWidth: 2 },
  topLeft:     { top: 20, left: 20,   borderRightWidth: 0, borderBottomWidth: 0 },
  topRight:    { top: 20, right: 20,  borderLeftWidth: 0,  borderBottomWidth: 0 },
  bottomLeft:  { bottom: 20, left: 20,  borderRightWidth: 0, borderTopWidth: 0 },
  bottomRight: { bottom: 20, right: 20, borderLeftWidth: 0,  borderTopWidth: 0 },

  boundingBox:  { position: "absolute", borderWidth: 2 },
  boxLabel:     { position: "absolute", top: 0, left: 0, paddingHorizontal: 4, paddingVertical: 2 },
  boxLabelText: { fontSize: 10, fontWeight: "700", color: "#0E0E0E" },

  overlay: { ...StyleSheet.absoluteFillObject, zIndex: 10 },

  // Result panel
  resultPanel: { paddingHorizontal: 20, paddingVertical: 14, borderTopWidth: 1, gap: 6 },

  detectionHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  detectionLabel:     { fontSize: 18, fontWeight: "700" },
  waitingTitle:       { fontSize: 18, fontWeight: "700" },
  resultSub:          { fontSize: 12, marginTop: 2 },

  // Status pill
  statusPill:     { flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99, borderWidth: 1 },
  statusPillText: { fontSize: 11, fontWeight: "700" },

  // Feature chips — OCR text + colour
  featureRow:       { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 },
  featureChip:      { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, maxWidth: "70%" },
  featureChipText:  { fontSize: 11, fontWeight: "600", flexShrink: 1 },

  // Suggestions row
  suggestionsRow:    { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6, marginTop: 2 },
  suggestionsLabel:  { fontSize: 11 },
  suggestionChip:    { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  suggestionChipText:{ fontSize: 11, fontWeight: "600" },

  // Buttons
  actions:      { flexDirection: "row", gap: 10, marginTop: 8 },
  btnPrimary:   { flex: 1, height: 44, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  btnPrimaryText:   { fontSize: 14, fontWeight: "700", letterSpacing: 0.5 },
  btnSecondary:     { flex: 1, height: 44, borderRadius: 8, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  btnSecondaryText: { fontSize: 14, fontWeight: "600" },
});