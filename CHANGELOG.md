# Changelog & Developer Notes

## Start / Stop Camera Feature Modification

To reduce continuous camera background processing, save battery, and create a clearer user workflow, the `CameraDetectionScreen` was updated to operate on explicit open/close parameters.

* **State Architecture Modifications:**
  * Introduced `<CameraView>` lifecycle control via the `isCameraActive` Boolean state inside `CameraDetectionScreen`.
  * The camera now defaults to `false` when initialized. The `CameraView` unmounts entirely when `false`, guaranteeing no frames are piped out in the background.

* **Auto-Stop Implementation:**
  * To automate the workflow for users scanning multiple individual items, the `onConfirm()` method callback was paired with `setIsCameraActive(false)`. Now, when a detection is verified, the camera acts perfectly as a one-shot entity, dropping feed immediately so resources return to idle.

* **UX Updates:**
  * Configured a custom fallback container with a `MaterialCommunityIcons` "camera-off" icon when disabled.
  * Added dynamic "Start Scanning" and "Stop" buttons depending on context. The stop button shares layout space seamlessly with "Correct" and "Confirm" when there are pending bounding boxes on screen.

## Viewport Layout Override (Nav Bar Fix)

* **Problem resolved:** The absolute-positioned navigation bar (`MobileBottomNav`) was incorrectly floating directly over the primary scan area Action Buttons if the device included heavy bottom swipe bars/notches (e.g., iPhone Home indicator).
* **Fix applied:** Scrapped the hardcoded CSS margin. Brought in `useSafeAreaInsets` within `CameraDetectionScreen` and mapped the bottom spacing explicitly using the device's exact inset parameter (`insets.bottom + 76`), permanently aligning the results panel right above the navbar regardless of OS footprint.
