/**
 * frameThrottle.ts — limits how often inference runs.
 *
 * WHY THIS EXISTS:
 * expo-camera fires a callback for every single camera frame (~30/sec).
 * Running YOLOv8 inference on every frame would:
 *   - Peg the JS thread → UI freeze
 *   - Drain battery fast
 *
 * This throttle lets us say "run inference every 300ms at most."
 *
 * FLUTTER ANALOGY:
 * In Flutter you'd use a Timer.periodic() or a debounce on a StreamController.
 * Here we track the last-run timestamp manually, which is simpler in JS.
 *
 * USAGE:
 *   const throttle = createFrameThrottle(300);
 *   // inside camera frame callback:
 *   throttle(() => runInference(frame));
 */
export function createFrameThrottle(intervalMs: number = 300) {
  let lastRunAt = 0;

  return function throttle(fn: () => void): void {
    const now = Date.now();
    if (now - lastRunAt >= intervalMs) {
      lastRunAt = now;
      fn();
    }
  };
}
