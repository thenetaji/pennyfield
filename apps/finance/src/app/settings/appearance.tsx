import * as React from "react";
import { ScrollView, View } from "react-native";

import { IconTile, ListGroup, ListRow, Pressable, SegmentedControl, Text } from "@studio/ui";
import { useSetting } from "@/data/hooks";
import { AppIcon, useIconPrefs, type IconBackground, type IconStyle } from "@studio/icons";
import {
  accentPresets,
  haptic,
  useTokens,
  type AccentPresetKey,
  type CategoryColorKey,
} from "@studio/theme";

const MODES = [
  { value: "system", label: "Automatic" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
] as const;

const ACCENTS: readonly { key: AccentPresetKey; label: string }[] = [
  { key: "blue", label: "Blue" },
  { key: "teal", label: "Teal" },
  { key: "plum", label: "Plum" },
  { key: "bronze", label: "Bronze" },
  { key: "ivory", label: "Ink" },
];

const CATEGORY_MODES = [
  { value: "mono", label: "Theme colour", subtitle: "Shades of your theme colour" },
  { value: "colour", label: "Multicolour", subtitle: "A different colour for each category" },
] as const;

const ICON_LOOKS: readonly {
  label: string;
  subtitle: string;
  style: IconStyle;
  background: IconBackground;
}[] = [
  { label: "Solid", subtitle: "White on your theme colour", style: "phosphor-fill", background: "solid" },
  { label: "Line", subtitle: "Thin, with no background", style: "lucide", background: "glyph-only" },
];

const SAMPLES: readonly { icon: string; color: CategoryColorKey }[] = [
  { icon: "food", color: "red" },
  { icon: "groceries", color: "green" },
  { icon: "car", color: "blue" },
  { icon: "shopping", color: "pink" },
  { icon: "health", color: "teal" },
  { icon: "entertainment", color: "purple" },
];

function SectionTitle({ children }: { children: string }) {
  return (
    <Text variant="footnote" tone="secondary" className="px-8 pb-2" accessibilityRole="header">
      {children}
    </Text>
  );
}

export default function Appearance() {
  const { colors, scheme } = useTokens();
  const [theme, setTheme] = useSetting("theme");
  const [accent, setAccent] = useSetting("accent");
  const [categoryColors, setCategoryColors] = useSetting("category_colors");
  const [style, setStyle] = useSetting("icon_style");
  const [, setBackground] = useSetting("icon_background");
  const store = useIconPrefs();

  return (
    <ScrollView
      className="flex-1 bg-bg"
      contentInsetAdjustmentBehavior="automatic"
      contentContainerClassName="gap-6 py-4 pb-12"
    >
      <View className="px-4">
        <View
          className="flex-row justify-between rounded-[20px] bg-surface px-5 py-5"
          style={{ borderWidth: 1, borderColor: colors.border }}
          accessibilityLabel="Icon preview"
        >
          {SAMPLES.map((sample) => (
            <IconTile key={sample.icon} icon={sample.icon} color={sample.color} size={42} />
          ))}
        </View>
      </View>

      <View>
        <SectionTitle>Appearance</SectionTitle>
        <View className="px-4">
          <SegmentedControl
            accessibilityLabel="Appearance"
            values={MODES.map((mode) => mode.label)}
            selectedIndex={MODES.findIndex((mode) => mode.value === theme)}
            onChange={(index) => setTheme(MODES[index]!.value)}
          />
        </View>
      </View>

      <View>
        <SectionTitle>Theme</SectionTitle>
        <View
          className="mx-4 flex-row justify-between rounded-[20px] bg-surface px-3 py-4"
          style={{ borderWidth: 1, borderColor: colors.border }}
          accessibilityRole="radiogroup"
        >
          {ACCENTS.map(({ key, label }) => {
            const on = accent === key;
            const fill = accentPresets[key][scheme];
            return (
              <Pressable
                key={key}
                role="radio"
                accessibilityLabel={label}
                accessibilityState={{ selected: on }}
                popWhen={on}
                onPress={() => {
                  if (on) return;
                  haptic("selection");
                  setAccent(key);
                }}
                className="flex-1 items-center gap-1.5"
              >
                <View
                  className="h-11 w-11 items-center justify-center rounded-full"
                  style={{ borderWidth: 2, borderColor: on ? fill.accent : "transparent" }}
                >
                  <View
                    className="h-8 w-8 items-center justify-center rounded-full"
                    style={{ backgroundColor: fill.accent }}
                  >
                    {on ? <AppIcon name="check" size={14} color={fill.onAccent} /> : null}
                  </View>
                </View>
                <Text variant="caption" tone={on ? "default" : "secondary"} numberOfLines={1}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View>
        <SectionTitle>Categories</SectionTitle>
        <ListGroup>
          {CATEGORY_MODES.map((option) => (
            <ListRow
              key={option.value}
              label={option.label}
              subtitle={option.subtitle}
              trailing={
                categoryColors === option.value ? (
                  <AppIcon name="check" size={16} color={colors.accent} />
                ) : undefined
              }
              onPress={() => {
                if (categoryColors === option.value) return;
                haptic("selection");
                setCategoryColors(option.value);
              }}
            />
          ))}
        </ListGroup>
      </View>

      <View>
        <SectionTitle>Icons</SectionTitle>
        <ListGroup>
          {ICON_LOOKS.map((look) => (
            <ListRow
              key={look.style}
              label={look.label}
              subtitle={look.subtitle}
              trailing={
                style === look.style ? (
                  <AppIcon name="check" size={16} color={colors.accent} />
                ) : undefined
              }
              onPress={() => {
                if (style === look.style) return;
                haptic("selection");
                store.setStyle(look.style);
                store.setBackground(look.background);
                setStyle(look.style);
                setBackground(look.background);
              }}
            />
          ))}
        </ListGroup>
      </View>
    </ScrollView>
  );
}
