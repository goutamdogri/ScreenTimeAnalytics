export const DEVICE_PLATFORMS = [
  'linux-x11',
  'linux-wayland',
  'windows',
  'macos',
  'unknown',
] as const;

export type DevicePlatform = (typeof DEVICE_PLATFORMS)[number];
