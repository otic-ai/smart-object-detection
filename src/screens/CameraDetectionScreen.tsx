/**
 * CameraDetectionScreen — SCAN tab.
 *
 * Shows a live camera feed using expo-camera's CameraView.
 * Handles the permission request flow (asking → denied → granted).
 * Detection label, confidence, and bounding boxes are populated entirely
 * by the model via the `onDetectionResult` callback — nothing is hardcoded.
 *
 * 🔌 AI INTEGRATION POINTS:
 *   1. Capture frames via cameraRef.current.takePictureAsync() or a frame processor
 *   2. Pass frames to on-device YOLOv8 / TFLite model (react-native-fast-tflite)
 *   3. Call `onDetectionResult(detection, boxes)` with model output each frame
 */
import React, { useRef, useState, useEffect, useCallback } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Animated, Easing } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { NavigationProps } from "../types/navigation";
import { BoundingBox, Detection } from "../types/detection";
import { useAppTheme } from "../theme/appTheme";
import TopAppBar from "../components/TopAppBar";
import { useDetectionLoop } from "../detection/useDetectionLoop";

type Props = NavigationProps & {
  /** Active detection from the model pipeline. Null = no detection yet. */
  detection: Detection | null;
  /** Bounding boxes for the current frame, emitted by the model. */
  boundingBoxes: BoundingBox[];
  /**
   * 🔌 AI INTEGRATION POINT — call this from the YOLOv8 / TFLite model
   * on each processed frame.
   */
  onDetectionResult: (detection: Detection, boxes: BoundingBox[]) => void;
  /** Called when the user confirms the current detection is correct. */
  onConfirm: () => void;
  /** Called when the camera is stopped to clear old detection results. */
  onClearDetection: () => void;
};

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
  const cameraRef = useRef<CameraView>(null); // 🔌 use cameraRef for frame capture
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isCameraReady, setIsCameraReady] = useState(false);

  const mountIdRef = useRef(Date.now());
  
  const { isModelReady, modelError, modelLoadProgress } = useDetectionLoop({
    onDetectionResult,
    isActive: isCameraActive && isCameraReady, // Only start when BOTH active AND ready
    cameraRef,
    throttleMs: 500, // 2 FPS - allow more time for all async operations
  });

  // Spinner animation for model loading
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

  // Safety reset on mount (handles hot reload)
  useEffect(() => {
    console.log("[Camera] Component mounted - resetting states");
    setIsCameraActive(false);
    setIsCameraReady(false);
     mountIdRef.current = Date.now(); // refresh the key too
    return () => {
      console.log("[Camera] Component unmounting - resetting states");
      setIsCameraActive(false);
      setIsCameraReady(false);
    };
  }, []);

  // Clear detection when camera is stopped
  useEffect(() => {
    if (!isCameraActive) {
      onClearDetection();
      setIsCameraReady(false);
      console.log("[Camera] Camera deactivated - clearing detection and ready state");
    }
  }, [isCameraActive, onClearDetection]);

  // ─── Permission: not yet determined ───────────────────────────────────────
  // Show permission screen only if not granted
  if (!permission) {
    return (
      <View style={[styles.root, { backgroundColor: theme.background }]}>
        <TopAppBar />
        <View style={styles.permissionState}>
          <MaterialCommunityIcons
            name="camera-outline"
            size={52}
            color={theme.mutedText}
          />
          <Text style={[styles.permissionTitle, { color: theme.mutedText }]}>
            Checking camera permission…
          </Text>
        </View>
      </View>
    );
  }

  // ─── Permission: denied ────────────────────────────────────────────────────
  if (!permission.granted) {
    return (
      <View style={[styles.root, { backgroundColor: theme.background }]}>
        <TopAppBar />
        <View style={styles.permissionState}>
          <MaterialCommunityIcons
            name="camera-off-outline"
            size={52}
            color={theme.error}
          />
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

  // ─── Permission: granted — show live camera ────────────────────────────────
  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <TopAppBar />

      {/* ─── Camera viewport ──────────────────────────────────────────── */}
      <View style={styles.cameraContainer}>
        {/* Inactive overlay — shown on top when camera is paused */}
        {!isCameraActive && (
          <View
            style={[
              styles.inactiveCamera,
              {
                backgroundColor: theme.surface,
                ...StyleSheet.absoluteFillObject,
                zIndex: 20,
              },
            ]}
          >
            {!isModelReady && !modelError ? (
              /* ── Model still loading ── */
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
              /* ── Model failed to load ── */
              <>
                <MaterialCommunityIcons name="alert-circle-outline" size={64} color={theme.error} />
                <Text style={[styles.inactiveTitle, { color: theme.error }]}>
                  Model Failed to Load
                </Text>
                <Text style={[styles.inactiveSub, { color: theme.mutedText }]}>
                  {modelError}
                </Text>
              </>
            ) : (
              /* ── Model ready, camera paused ── */
              <>
                <MaterialCommunityIcons
                  name="camera-off"
                  size={64}
                  color={theme.mutedText}
                />
                <Text style={[styles.inactiveTitle, { color: theme.primaryText }]}>
                  Camera Paused
                </Text>
                <Text style={[styles.inactiveSub, { color: theme.mutedText }]}>
                  Press Start to begin scanning
                </Text>
              </>
            )}
          </View>
        )}

        {/* CameraView always mounted — never unmounts */}
        <View style={{ flex: 1 }}>
          <CameraView 
            key={`camera-${mountIdRef.current}`}
            ref={cameraRef} 
            style={styles.camera} 
            facing="back" 
            active={isCameraActive}
            onCameraReady={() => {
              console.log("[Camera] ✅ onCameraReady fired — hardware ready");
              setTimeout(() => {
                console.log("[Camera] ✅ settle delay done — marking ready for capture");
                setIsCameraReady(true);
              }, 500);
            }} 
          />

          {/* Detection overlay */}
          <View style={styles.overlay}>
            <View
              style={[
                styles.corner,
                styles.topLeft,
                { borderColor: theme.primary },
              ]}
            />
            <View
              style={[
                styles.corner,
                styles.topRight,
                { borderColor: theme.primary },
              ]}
            />
            <View
              style={[
                styles.corner,
                styles.bottomLeft,
                { borderColor: theme.primary },
              ]}
            />
            <View
              style={[
                styles.corner,
                styles.bottomRight,
                { borderColor: theme.primary },
              ]}
            />

            {!hasDetection && isCameraActive && (
              <View style={styles.waitingOverlay}>
                <Text
                  style={[
                    styles.waitingLabel,
                    { color: modelError ? theme.error : theme.mutedText },
                  ]}
                >
                  {modelError ??
                    (!isModelReady
                      ? "Loading model…"
                      : "Waiting for detection…")}
                </Text>
              </View>
            )}

            {boundingBoxes.map((box, i) => (
              <View
                key={i}
                style={[
                  styles.boundingBox,
                  {
                    left: `${box.x}%` as any,
                    top: `${box.y}%` as any,
                    width: `${box.width}%` as any,
                    height: `${box.height}%` as any,
                    borderColor: theme.primary,
                  },
                ]}
              >
                <View
                  style={[styles.boxLabel, { backgroundColor: theme.primary }]}
                >
                  <Text style={styles.boxLabelText}>
                    {box.label} {box.confidence}%
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      </View>

      {/* ─── Bottom result panel ──────────────────────────────────────── */}
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
        <View style={styles.resultRow}>
          {hasDetection ? (
            <View>
              <Text
                style={[styles.detectionLabel, { color: theme.primaryText }]}
              >
                {detection.label}
              </Text>
              <Text style={[styles.resultSub, { color: theme.mutedText }]}>
                {detection.confidence}% confidence
              </Text>
            </View>
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
              <Text style={[styles.waitingTitle, { color: theme.mutedText }]}>
                No detection
              </Text>
              <Text style={[styles.resultSub, { color: theme.mutedText }]}>
                Waiting for camera feed…
              </Text>
            </View>
          )}
          {/* 🔌 Confidence ring (SVG) goes here */}
        </View>

        {/* Action buttons */}
        <View style={styles.actions}>
          {!isCameraActive ? (
            <TouchableOpacity
              style={[
                styles.btnPrimary,
                {
                  backgroundColor: isModelReady && !modelError
                    ? theme.primary
                    : theme.surface,
                  borderWidth: isModelReady && !modelError ? 0 : 1,
                  borderColor: theme.border,
                  opacity: isModelReady && !modelError ? 1 : 0.6,
                },
              ]}
              activeOpacity={isModelReady && !modelError ? 0.8 : 1}
              onPress={() => {
                if (isModelReady && !modelError) setIsCameraActive(true);
              }}
              disabled={!isModelReady || !!modelError}
            >
              <Text
                style={[
                  styles.btnPrimaryText,
                  { color: isModelReady && !modelError ? "#0E0E0E" : theme.mutedText },
                ]}
              >
                {!isModelReady && !modelError ? "Model Loading…" : "Start Scanning"}
              </Text>
            </TouchableOpacity>
          ) : (
            <>
              {/* Stop button always visible when active */}
              <TouchableOpacity
                style={[
                  styles.btnSecondary,
                  { borderColor: theme.error, flex: hasDetection ? 0.4 : 1 },
                ]}
                activeOpacity={0.7}
                onPress={() => setIsCameraActive(false)}
              >
                <Text style={[styles.btnSecondaryText, { color: theme.error }]}>
                  Stop
                </Text>
              </TouchableOpacity>

              {/* Correct / Confirm buttons only when detection is present */}
              {hasDetection && (
                <>
                  <TouchableOpacity
                    style={[
                      styles.btnSecondary,
                      { borderColor: theme.border, flex: 0.8 },
                    ]}
                    activeOpacity={0.7}
                    onPress={() => navigateTo("learn")}
                  >
                    <Text
                      style={[
                        styles.btnSecondaryText,
                        { color: theme.secondaryText },
                      ]}
                    >
                      Correct
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.btnPrimary,
                      { backgroundColor: theme.primary, flex: 1.2 },
                    ]}
                    activeOpacity={0.7}
                    onPress={() => {
                      onConfirm();
                      setIsCameraActive(false);
                    }}
                  >
                    <Text style={[styles.btnPrimaryText, { color: "#0E0E0E" }]}>
                      Confirm
                    </Text>
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
  root: {
    flex: 1,
  },

  // Permission states
  permissionState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    paddingHorizontal: 32,
  },
  permissionTitle: {
    fontSize: 17,
    fontWeight: "700",
    textAlign: "center",
  },
  permissionHint: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 20,
  },
  permissionBtn: {
    marginTop: 8,
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 10,
  },
  permissionBtnText: {
    fontSize: 14,
    fontWeight: "700",
  },

  // Camera
  cameraContainer: {
    flex: 1,
  },
  inactiveCamera: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  modelLoadingRing: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 4,
    // borderTopColor set inline via theme.primary
    // borderColor (the other 3 sides) set inline via theme.border
  },
  inactiveTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginTop: 8,
  },
  inactiveSub: {
    fontSize: 14,
  },
  camera: {
    flex: 1,
  },
  waitingOverlay: {
    position: "absolute",
    bottom: 20,
    alignSelf: "center",
  },
  waitingLabel: {
    fontSize: 13,
    fontWeight: "600",
  },

  // Corner brackets
  corner: {
    position: "absolute",
    width: 24,
    height: 24,
    borderWidth: 2,
  },
  topLeft: { top: 20, left: 20, borderRightWidth: 0, borderBottomWidth: 0 },
  topRight: { top: 20, right: 20, borderLeftWidth: 0, borderBottomWidth: 0 },
  bottomLeft: { bottom: 20, left: 20, borderRightWidth: 0, borderTopWidth: 0 },
  bottomRight: { bottom: 20, right: 20, borderLeftWidth: 0, borderTopWidth: 0 },

  // Bounding box overlay
  boundingBox: {
    position: "absolute",
    borderWidth: 2,
  },
  boxLabel: {
    position: "absolute",
    top: 0,
    left: 0,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  boxLabelText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#0E0E0E",
  },

  // Result panel
  resultPanel: {
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderTopWidth: 1,
    gap: 14,
  },
  resultRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  detectionLabel: {
    fontSize: 18,
    fontWeight: "700",
  },
  waitingTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  resultSub: {
    fontSize: 12,
    marginTop: 2,
  },

  // Buttons
  actions: {
    flexDirection: "row",
    gap: 10,
  },
  btnPrimary: {
    flex: 1,
    height: 44,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  btnPrimaryText: {
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  btnSecondary: {
    flex: 1,
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  btnSecondaryText: {
    fontSize: 14,
    fontWeight: "600",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
  },
});
