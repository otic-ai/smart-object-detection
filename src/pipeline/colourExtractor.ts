import * as jpegJs from "jpeg-js";
// ✅ Legacy import — avoids deprecation error on Expo SDK 54+

import * as ImageManipulator from "expo-image-manipulator";
import * as FileSystem from "expo-file-system/legacy";
import { decode as decodeBase64 } from "base64-arraybuffer";

const COLOUR_MAP: [string, [number, number, number]][] = [
  ["red",    [220,  30,  30]],
  ["orange", [230, 120,  30]],
  ["yellow", [220, 200,  30]],
  ["green",  [ 30, 150,  60]],
  ["blue",   [ 30,  80, 200]],
  ["purple", [120,  30, 180]],
  ["pink",   [220, 100, 150]],
  ["brown",  [120,  70,  30]],
  ["black",  [ 20,  20,  20]],
  ["white",  [240, 240, 240]],
  ["silver", [180, 180, 190]],
];

function euclideanDistance(r: number, g: number, b: number, ref: [number, number, number]): number {
  return Math.sqrt((r - ref[0]) ** 2 + (g - ref[1]) ** 2 + (b - ref[2]) ** 2);
}

function dominantColourFromRgba(data: Uint8Array, width: number, height: number): string | null {
  const totalPixels = width * height;
  if (totalPixels === 0) return null;
  const step = Math.max(1, Math.floor(totalPixels / 200));
  const tally: Record<string, number> = {};
  for (let i = 0; i < data.length; i += step * 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    if (r > 230 && g > 230 && b > 230) continue;
    let bestName = "unknown", bestDist = Infinity;
    for (const [name, ref] of COLOUR_MAP) {
      const dist = euclideanDistance(r, g, b, ref);
      if (dist < bestDist) { bestDist = dist; bestName = name; }
    }
    tally[bestName] = (tally[bestName] ?? 0) + 1;
  }
  const sorted = Object.entries(tally).sort((a, b) => b[1] - a[1]);
  return sorted[0]?.[0] ?? null;
}

// export async function extractDominantColour(uri: string): Promise<string | null> {
//   try {
//     const base64 = await FileSystem.readAsStringAsync(uri, {
//       encoding: FileSystem.EncodingType.Base64,
//     });
//     const buffer = decodeBase64(base64);
//     const { data, width, height } = jpegJs.decode(new Uint8Array(buffer), {
//       useTArray: true, formatAsRGBA: true,
//     });
//     return dominantColourFromRgba(data, width, height);
//   } catch (err) {
//     console.warn("[ColourExtractor] Failed:", err);
//     return null;
//   }

// }

export async function extractDominantColour(uri: string): Promise<string | null> {
  try {
    // Downsample to 32×32 natively FIRST — then decode tiny buffer in JS
    const thumb = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 32, height: 32 } }],
      { base64: true, format: ImageManipulator.SaveFormat.JPEG }
    );
    if (!thumb.base64) return null;

    const buffer = decodeBase64(thumb.base64);
    const { data, width, height } = jpegJs.decode(new Uint8Array(buffer), {
      useTArray: true, formatAsRGBA: true,
    });
    return dominantColourFromRgba(data, width, height);
  } catch (err) {
    console.warn("[ColourExtractor] Failed:", err);
    return null;
  }
}