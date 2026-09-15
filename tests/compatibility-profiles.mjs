// Screen dimensions describe the desktop; viewports describe page content.
// Toolbar allowances and DPR values are test assumptions, not measured hardware.
// Reflow profiles approximate layout space after zoom; they do not emulate browser UI zoom.
export const COMPATIBILITY_PROFILES = [
  { id: "desktop-default", screen: [1440, 900], viewport: [1440, 800], dpr: 2, priority: "primary" },
  { id: "desktop-default-full", screen: [1440, 900], viewport: [1440, 900], dpr: 2, priority: "primary" },
  { id: "desktop-more-space", screen: [1680, 1050], viewport: [1680, 950], dpr: 2 },
  { id: "desktop-larger-text", screen: [1280, 800], viewport: [1280, 700], dpr: 2 },
  { id: "desktop-largest-text", screen: [1024, 640], viewport: [1024, 540], dpr: 2 },
  { id: "external-desktop", screen: [1920, 1200], viewport: [1920, 1080], dpr: 1, priority: "primary" },
  { id: "external-full", screen: [1920, 1200], viewport: [1920, 1200], dpr: 1 },
  { id: "windowed", screen: [1440, 900], viewport: [800, 600], dpr: 2 },
  { id: "reflow-125-equivalent", screen: [1440, 900], viewport: [1152, 640], dpr: 2 },
  { id: "reflow-150-equivalent", screen: [1440, 900], viewport: [960, 533], dpr: 2 },
  { id: "reflow-200-equivalent", screen: [1440, 900], viewport: [720, 400], dpr: 2 },
  { id: "mobile-portrait", screen: [390, 844], viewport: [390, 744], dpr: 3, mobile: true },
  { id: "mobile-landscape", screen: [844, 390], viewport: [844, 320], dpr: 3, mobile: true },
  { id: "mobile-narrow", screen: [320, 740], viewport: [320, 640], dpr: 2, mobile: true },
  { id: "tablet-portrait", screen: [1024, 1366], viewport: [1024, 1266], dpr: 2, mobile: true },
  { id: "tablet-landscape", screen: [1366, 1024], viewport: [1366, 924], dpr: 2, mobile: true },
];

export function profileContext(profile, browserName) {
  const size = ([width, height]) => ({ width, height });
  return { screen: size(profile.screen), viewport: size(profile.viewport), deviceScaleFactor: profile.dpr,
    hasTouch: Boolean(profile.mobile), isMobile: Boolean(profile.mobile && browserName !== "firefox") };
}
