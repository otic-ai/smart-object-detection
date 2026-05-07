import * as ImageManipulator from "expo-image-manipulator";

/**
 * Crops the bounding box region from a native file URI.
 * Returns the cropped image as a native URI (fast — stays on native thread).
 *
 * @param uri         Native file URI from takePictureAsync or ImageManipulator
 * @param frameWidth  Actual pixel width of the image
 * @param frameHeight Actual pixel height of the image
 * @param bbox        Bounding box in 0–100 percentage coords
 */
export async function cropRegion(
  uri: string,
  frameWidth: number,
  frameHeight: number,
  bbox: { x: number; y: number; width: number; height: number }
): Promise<string | null> {
  try {
    // Convert percentage bbox → pixel coords, clamped to frame bounds
    const originX = Math.max(0, (bbox.x / 100) * frameWidth);
    const originY = Math.max(0, (bbox.y / 100) * frameHeight);
    const width   = Math.min(frameWidth  - originX, (bbox.width  / 100) * frameWidth);
    const height  = Math.min(frameHeight - originY, (bbox.height / 100) * frameHeight);

    // Guard: skip if bbox is degenerate
    if (width < 10 || height < 10) return null;

    const cropped = await ImageManipulator.manipulateAsync(
      uri,
      [{ crop: { originX, originY, width, height } }],
      { format: ImageManipulator.SaveFormat.JPEG } // URI output — no base64 overhead
    );

    return cropped.uri ?? null;
  } catch (err) {
    console.warn("[cropRegion] Failed to crop:", err);
    return null;
  }
}
