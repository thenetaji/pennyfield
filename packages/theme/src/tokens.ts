export type Scheme = "light" | "dark";

export const categoryKeys = [
  "red",
  "orange",
  "amber",
  "lime",
  "green",
  "teal",
  "cyan",
  "blue",
  "indigo",
  "purple",
  "pink",
  "brown",
  "gray",
] as const;

export type CategoryColorKey = (typeof categoryKeys)[number];

export type SemanticColors = {
  bg: string;
  surface: string;
  elevated: string;
  border: string;
  separator: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
  accent: string;
  accentText: string;
  accentSoft: string;
  onAccent: string;
  income: string;
  expense: string;
  warning: string;
  fill: string;
  overlay: string;
  overlayText: string;
};

export type AccentPresetKey = "blue" | "teal" | "plum" | "bronze" | "ivory";

/** The accent is one token group: fill, link text, soft tint, text on the fill, pressed fill. */
export type AccentColors = Pick<
  SemanticColors,
  "accent" | "accentText" | "accentSoft" | "onAccent"
> & { accentDeep: string };

export const accentPresets: Record<
  AccentPresetKey,
  Record<Scheme, AccentColors>
> = {
  blue: {
    light: {
      accent: "#2F5FD0",
      accentText: "#2A55BE",
      accentSoft: "rgba(47,95,208,0.12)",
      onAccent: "#FFFFFF",
      accentDeep: "#1E3A8A",
    },
    dark: {
      accent: "#7DA2F0",
      accentText: "#7DA2F0",
      accentSoft: "rgba(125,162,240,0.16)",
      onAccent: "#0B1430",
      accentDeep: "#5C84DC",
    },
  },
  teal: {
    light: {
      accent: "#137C78",
      accentText: "#0F6B68",
      accentSoft: "rgba(19,124,120,0.12)",
      onAccent: "#FFFFFF",
      accentDeep: "#0F4C4A",
    },
    dark: {
      accent: "#5CC4BD",
      accentText: "#5CC4BD",
      accentSoft: "rgba(92,196,189,0.16)",
      onAccent: "#06201F",
      accentDeep: "#3FA69F",
    },
  },
  plum: {
    light: {
      accent: "#7A3B96",
      accentText: "#6B3186",
      accentSoft: "rgba(122,59,150,0.12)",
      onAccent: "#FFFFFF",
      accentDeep: "#4A1D5E",
    },
    dark: {
      accent: "#C79ADB",
      accentText: "#C79ADB",
      accentSoft: "rgba(199,154,219,0.16)",
      onAccent: "#1E0B27",
      accentDeep: "#A879BE",
    },
  },
  bronze: {
    light: {
      accent: "#8F6A3A",
      accentText: "#7A5A30",
      accentSoft: "rgba(143,106,58,0.12)",
      onAccent: "#FFFFFF",
      accentDeep: "#5A3D1E",
    },
    dark: {
      accent: "#D9BC8F",
      accentText: "#D9BC8F",
      accentSoft: "rgba(217,188,143,0.16)",
      onAccent: "#1C130A",
      accentDeep: "#BC9E70",
    },
  },
  // Ink: black on light, white on dark. The mono accent.
  ivory: {
    light: {
      accent: "#1C1C1E",
      accentText: "#1C1C1E",
      accentSoft: "rgba(28,28,30,0.08)",
      onAccent: "#FFFFFF",
      accentDeep: "#3A3A3C",
    },
    dark: {
      accent: "#F2F2F7",
      accentText: "#E5E5EA",
      accentSoft: "rgba(242,242,247,0.12)",
      onAccent: "#000000",
      accentDeep: "#D1D1D6",
    },
  },
};

/** Default accent; `setAccent` re-skins at runtime. global.css `--tint*` mirror this default. */
export const accentPreset: AccentPresetKey = "blue";

/** The surface family: every non-accent token. `setPalette` switches it at runtime. */
export type PaletteKey = "system";

export type PaletteColors = Omit<SemanticColors, keyof AccentColors>;

/** Default palette; global.css mirrors it. */
export const palettePreset: PaletteKey = "system";

export const palettes: Record<PaletteKey, Record<Scheme, PaletteColors>> = {
  // Apple's own apps (Wallet, Health): grouped grey background, white cards, system label greys.
  system: {
    light: {
      bg: "#F2F2F7",
      surface: "#FFFFFF",
      elevated: "#FFFFFF",
      border: "rgba(60,60,67,0.12)",
      separator: "rgba(60,60,67,0.18)",
      text: "#000000",
      textSecondary: "#6C6C70",
      textTertiary: "#A1A1A6",
      income: "#248A3D",
      expense: "#D70015",
      warning: "#C93400",
      fill: "#E9E9EE",
      overlay: "#1C1C1E",
      overlayText: "#FFFFFF",
    },
    dark: {
      bg: "#000000",
      surface: "#1C1C1E",
      elevated: "#2C2C2E",
      border: "rgba(84,84,88,0.36)",
      separator: "rgba(84,84,88,0.5)",
      text: "#FFFFFF",
      textSecondary: "#98989F",
      textTertiary: "#636366",
      income: "#30D158",
      expense: "#FF453A",
      warning: "#FF9F0A",
      fill: "#2C2C2E",
      overlay: "#F2F2F7",
      overlayText: "#000000",
    },
  },
};

/** Each accent's hue, the source of its shades. */
const CHART_TINTS: Record<AccentPresetKey, { hue: number; saturation: number }> = {
  blue: { hue: 222, saturation: 64 },
  teal: { hue: 177, saturation: 73 },
  plum: { hue: 282, saturation: 43 },
  bronze: { hue: 34, saturation: 42 },
  ivory: { hue: 240, saturation: 3 },
};
// Strongest first: dark on light surfaces, light on dark ones. The last step still holds about 3:1.
const RAMP_LIGHTNESS: Record<Scheme, readonly number[]> = {
  light: [30, 38, 46, 52, 60, 68],
  dark: [86, 77, 68, 60, 51, 42],
};

type ChartColors = {
  /** Near black in the theme's hue, for full-bleed dark canvases. */
  chartInk: string;
};

function chartColors(preset: AccentPresetKey): ChartColors {
  const { hue, saturation } = CHART_TINTS[preset];
  return {
    chartInk: hslToHex(hue, saturation / 2, 7),
  };
}

export function buildColors(
  scheme: Scheme,
  preset: AccentPresetKey = accentPreset,
  palette: PaletteKey = palettePreset,
): SemanticColors & ChartColors & { accentDeep: string } {
  return {
    ...palettes[palette][scheme],
    ...accentPresets[preset][scheme],
    ...chartColors(preset),
  };
}

export const colors: Record<Scheme, SemanticColors & ChartColors & { accentDeep: string }> = {
  light: buildColors("light"),
  dark: buildColors("dark"),
};

export type ThemeOverrides = {
  /** Switch to another built-in accent preset. */
  accentPreset?: AccentPresetKey;
  /** Switch the surface palette. */
  palette?: PaletteKey;
  /** Or supply the app's own accent group per scheme (wins over `accentPreset`). */
  accent?: Record<Scheme, AccentColors>;
};

/**
 * Per-app theme override: call once at startup, before the first render. Updates `colors` in place so every
 * `useTokens()` consumer sees it. The category palette keys (`categoryKeys`) are stable and are not overridable,
 * because stored data refers to them. The app's global.css `--tint*` variables must be changed to match.
 */
export function configureTheme(overrides: ThemeOverrides): void {
  for (const scheme of ["light", "dark"] as const) {
    const accent =
      overrides.accent?.[scheme] ??
      accentPresets[overrides.accentPreset ?? accentPreset][scheme];
    if (overrides.palette)
      Object.assign(colors[scheme], palettes[overrides.palette][scheme]);
    Object.assign(
      colors[scheme],
      accent,
      chartColors(overrides.accentPreset ?? accentPreset),
    );
  }
}

/** Mint income wash (pill backgrounds). */
export const incomeSoft: Record<Scheme, string> = {
  light: "rgba(4,139,86,0.10)",
  dark: "rgba(100,216,164,0.12)",
};

/**
 * Data colours for charts and swatches: Apple's system hues, softened about a quarter so a screen of categories
 * reads calm rather than neon. The dark set is lighter, not brighter. Every light mark holds 3:1 on white.
 */
export const categoryColors: Record<
  Scheme,
  Record<CategoryColorKey, string>
> = {
  light: {
    red: "#E5534B",
    orange: "#E8893A",
    amber: "#D29A17",
    lime: "#86AA30",
    green: "#36A865",
    teal: "#349FB2",
    cyan: "#3F9ACF",
    blue: "#3B78E0",
    indigo: "#6261C4",
    purple: "#965FCB",
    pink: "#DB5880",
    brown: "#9C8061",
    gray: "#8E8E93",
  },
  dark: {
    red: "#EF6B63",
    orange: "#F09A52",
    amber: "#E6BA4A",
    lime: "#A3C75C",
    green: "#58C482",
    teal: "#5DBCCC",
    cyan: "#6BB6E4",
    blue: "#6297EF",
    indigo: "#8A88DF",
    purple: "#B386E0",
    pink: "#EA7C9D",
    brown: "#B79B7B",
    gray: "#98989D",
  },
};

/** How categories are drawn: mono (shades of the theme's hue, the default) or colour. */
export type CategoryMode = "mono" | "colour";

/**
 * Mono category shades. Each key keeps one fixed step (colour follows the entity, never its rank), and the steps
 * are spread so neighbouring keys differ in lightness.
 */
const MONO_STEPS: Record<CategoryColorKey, number> = {
  red: 0,
  orange: 2,
  amber: 4,
  lime: 1,
  green: 3,
  teal: 5,
  cyan: 1,
  blue: 0,
  indigo: 3,
  purple: 2,
  pink: 4,
  brown: 5,
  gray: 3,
};

function hslToHex(hue: number, saturation: number, lightness: number): string {
  const s = saturation / 100;
  const l = lightness / 100;
  const channel = (n: number) => {
    const k = (n + hue / 30) % 12;
    const value = l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(value * 255)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${channel(0)}${channel(8)}${channel(4)}`;
}

/** One hue from strong to faint: every monochrome chart in a theme draws from this. */
export function monoRamp(accent: AccentPresetKey, scheme: Scheme): string[] {
  const { hue, saturation } = CHART_TINTS[accent];
  return RAMP_LIGHTNESS[scheme].map((l) => hslToHex(hue, saturation, l));
}

export function monoCategoryColors(
  accent: AccentPresetKey,
  scheme: Scheme,
): Record<CategoryColorKey, string> {
  const ramp = monoRamp(accent, scheme);
  return Object.fromEntries(
    categoryKeys.map((key) => [key, ramp[MONO_STEPS[key]]!]),
  ) as Record<CategoryColorKey, string>;
}

/** Solid tile fill (same in both schemes), as on iOS Settings icons; white glyph on top. */
export const categoryInk: Record<CategoryColorKey, string> = {
  red: "#E5534B",
  orange: "#E8893A",
  amber: "#D29A17",
  lime: "#86AA30",
  green: "#36A865",
  teal: "#349FB2",
  cyan: "#3F9ACF",
  blue: "#3B78E0",
  indigo: "#6261C4",
  purple: "#965FCB",
  pink: "#DB5880",
  brown: "#9C8061",
  gray: "#8E8E93",
};

export const spacing = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
} as const;
export const gutter = 16;

export const radii = {
  key: 8,
  tile: 999,
  button: 12,
  card: 18,
  sheet: 20,
  pill: 999,
} as const;

export type TypeStyle = {
  size: number;
  line: number;
  weight: "400" | "500" | "600" | "700";
  tracking: number;
};

export const typeScale = {
  display: { size: 54, line: 60, weight: "700", tracking: -2.4 },
  hero: { size: 44, line: 50, weight: "700", tracking: -2 },
  amountEntry: { size: 44, line: 52, weight: "600", tracking: -1 },
  largeTitle: { size: 34, line: 41, weight: "700", tracking: -0.4 },
  title1: { size: 28, line: 34, weight: "700", tracking: -0.3 },
  title2: { size: 22, line: 28, weight: "600", tracking: -0.2 },
  headline: { size: 17, line: 22, weight: "600", tracking: 0 },
  body: { size: 17, line: 22, weight: "400", tracking: 0 },
  callout: { size: 16, line: 21, weight: "400", tracking: 0 },
  subhead: { size: 15, line: 20, weight: "400", tracking: 0 },
  footnote: { size: 13, line: 18, weight: "400", tracking: 0 },
  caption: { size: 12, line: 16, weight: "500", tracking: 0.1 },
} as const satisfies Record<string, TypeStyle>;

export type TypeVariant = keyof typeof typeScale;

/** SF Pro Rounded on iOS (as in Wallet and Fitness) for amounts; other platforms keep their system face. */
export const roundedFamily = "ui-rounded";

export const durations = {
  press: 120,
  chip: 200,
  progress: 200,
  row: 250,
  countUp: 400,
  toast: 5000,
} as const;

export const springs = {
  press: { damping: 20, stiffness: 300, mass: 0.8 },
  layout: { damping: 18, stiffness: 220 },
  sheetChip: { damping: 16, stiffness: 180 },
} as const;

export const pressScale = {
  row: 0.97,
  card: 0.97,
  key: 0.92,
  fab: 0.92,
} as const;
export const pressOpacity = { text: 0.6 } as const;

export const shadows = {
  fab: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 6,
  },
  toast: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
} as const;

export const dynamicType = {
  hero: 1.4,
  keypad: 1.2,
  rowAmount: 1.6,
  default: 2,
} as const;

export function withAlpha(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
