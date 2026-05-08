import * as ImageManipulator from "expo-image-manipulator";

export async function cropRegion(
  uri: string,
  frameWidth: number,
  frameHeight: number,
  bbox: { x: number; y: number; width: number; height: number }
): Promise<string | null> {
  try {
    // Convert 0–100 percentage → pixels
    const originX = (bbox.x / 100) * frameWidth;
    const originY = (bbox.y / 100) * frameHeight;
    const rawW    = (bbox.width  / 100) * frameWidth;
    const rawH    = (bbox.height / 100) * frameHeight;

    // Clamp so crop rectangle never exceeds image bounds
    // This is the fix for "Invalid crop options" error
    const clampedX = Math.max(0, Math.min(originX, frameWidth  - 1));
    const clampedY = Math.max(0, Math.min(originY, frameHeight - 1));
    const clampedW = Math.max(1, Math.min(rawW, frameWidth  - clampedX));
    const clampedH = Math.max(1, Math.min(rawH, frameHeight - clampedY));

    // Skip degenerate boxes
    if (clampedW < 10 || clampedH < 10) return null;

    const cropped = await ImageManipulator.manipulateAsync(
      uri,
      [{ crop: { originX: clampedX, originY: clampedY, width: clampedW, height: clampedH } }],
      { format: ImageManipulator.SaveFormat.JPEG }
    );

    return cropped.uri ?? null;
  } catch (err) {
    console.warn("[cropRegion] Failed to crop:", err);
    return null;
  }
}