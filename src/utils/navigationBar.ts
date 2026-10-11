import { requireOptionalNativeModule } from 'expo-modules-core';

// Safely query the native module without throwing if not yet compiled in the APK
const NativeNavModule: any = requireOptionalNativeModule('ExpoNavigationBar');

/**
 * Sets the navigation bar button style ('dark' = light icons for dark backgrounds).
 * Gracefully no-ops if ExpoNavigationBar native module is not present in the current build.
 */
export function setSystemNavBarStyle(style: 'dark' | 'light' = 'dark'): void {
  if (NativeNavModule?.setStyle) {
    try {
      NativeNavModule.setStyle(style);
    } catch {
      // Ignored if unsupported on device
    }
  }
}

/**
 * Toggles hiding/collapsing the navigation bar.
 * Gracefully no-ops if ExpoNavigationBar native module is not present in the current build.
 */
export function setSystemNavBarHidden(hidden: boolean): void {
  if (NativeNavModule?.setHidden) {
    try {
      NativeNavModule.setHidden(hidden);
    } catch {
      // Ignored if unsupported on device
    }
  }
}

export const isNativeNavBarAvailable = !!NativeNavModule;
