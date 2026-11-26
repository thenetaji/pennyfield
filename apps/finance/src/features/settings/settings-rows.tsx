import { useRouter } from "expo-router";
import * as React from "react";
import { StyleSheet, TextInput, View } from "react-native";

import { useAccounts, useSetting } from "@/data/hooks";
import { minorDigits } from "@studio/money";
import { accentPresets, haptic, useTokens, type AccentPresetKey } from "@studio/theme";
import {
  OptionPicker,
  Pressable,
  SymbolIcon,
  Switch,
  Text,
} from "@studio/ui";

import {
  MONTH_OPTIONS,
  ROW_OPTIONS,
  WEEK_OPTIONS,
  type PickerId,
  type SettingRow,
} from "./groups";

/** The colours the rows draw with. */
export type RowSkin = {
  text: string;
  secondary: string;
  tertiary: string;
  surface: string;
  separator: string;
  pressed: string;
  radius: number;
};

export function useRowSkin(): RowSkin {
  const { colors } = useTokens();
  return {
    text: colors.text,
    secondary: colors.textSecondary,
    tertiary: colors.textTertiary,
    surface: colors.surface,
    separator: colors.separator,
    pressed: colors.fill,
    radius: 22,
  };
}

export function SectionTitle({ title, skin }: { title: string; skin: RowSkin }) {
  return (
    <Text
      variant="footnote"
      accessibilityRole="header"
      className="mb-2 px-1 font-semibold uppercase tracking-[1.4px]"
      style={{ color: skin.secondary }}
    >
      {title}
    </Text>
  );
}

function Card({ skin, children }: { skin: RowSkin; children: React.ReactNode }) {
  return (
    <View style={{ backgroundColor: skin.surface, borderRadius: skin.radius, overflow: "hidden" }}>
      {children}
    </View>
  );
}

export function RowCard({ skin, children }: { skin: RowSkin; children: React.ReactNode[] }) {
  return (
    <Card skin={skin}>
      {children.map((child, i) => (
        <View key={i}>
          {i > 0 ? (
            <View
              style={{
                height: StyleSheet.hairlineWidth,
                backgroundColor: skin.separator,
                marginLeft: 60,
              }}
            />
          ) : null}
          {child}
        </View>
      ))}
    </Card>
  );
}

/** White symbol on a solid theme-colour tile, the leading mark of every row. */
export function IconTile({ name }: { name: string }) {
  const { colors } = useTokens();
  return (
    <View
      className="h-[30px] w-[30px] items-center justify-center rounded-[9px]"
      style={{ backgroundColor: colors.accent }}
    >
      <SymbolIcon name={name} size={16} color={colors.onAccent} />
    </View>
  );
}

function Chevron({ skin }: { skin: RowSkin }) {
  return <SymbolIcon name="chevron.right" size={13} color={skin.tertiary} weight="bold" />;
}

/** A row that opens something, with its value on the right. */
export function LinkRow({
  icon,
  label,
  value,
  caption,
  skin,
  onPress,
}: {
  icon?: string;
  label: string;
  value?: string;
  caption?: string;
  skin: RowSkin;
  onPress: () => void;
}) {
  const [pressed, setPressed] = React.useState(false);
  return (
    <Pressable
      role="button"
      accessibilityLabel={[label, value ?? caption].filter(Boolean).join(", ")}
      scale={1}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      className="min-h-[56px] flex-row items-center gap-3.5 px-4 py-2.5"
      style={{ backgroundColor: pressed ? skin.pressed : "transparent" }}
    >
      {icon ? <IconTile name={icon} /> : null}
      <View className="flex-1">
        <Text variant="body" numberOfLines={1} style={{ color: skin.text }}>
          {label}
        </Text>
        {caption ? (
          <Text variant="footnote" numberOfLines={1} style={{ color: skin.secondary }}>
            {caption}
          </Text>
        ) : null}
      </View>
      {value ? (
        <Text
          variant="body"
          numeric
          numberOfLines={1}
          className="max-w-[55%] shrink"
          style={{ color: skin.secondary }}
        >
          {value}
        </Text>
      ) : null}
      <Chevron skin={skin} />
    </Pressable>
  );
}

function ToggleRow({ row, skin }: { row: SettingRow; skin: RowSkin }) {
  return (
    <View className="min-h-[56px] flex-row items-center gap-3.5 px-4 py-2">
      <IconTile name={row.icon} />
      <Text variant="body" numberOfLines={1} className="flex-1" style={{ color: skin.text }}>
        {row.label}
      </Text>
      {row.value ? (
        <Text variant="body" numeric numberOfLines={1} className="shrink" style={{ color: skin.secondary }}>
          {row.value}
        </Text>
      ) : null}
      <Switch
        value={row.toggle?.value ?? false}
        onValueChange={row.toggle?.onChange}
        accessibilityLabel={row.label}
      />
    </View>
  );
}

function HourlyPayRow({ skin }: { skin: RowSkin }) {
  const [pay, setPay] = useSetting("hourly_pay");
  const [currency] = useSetting("display_currency");
  const scale = 10 ** minorDigits(currency);
  const shown = pay ? String(pay / scale) : "";
  const [text, setText] = React.useState(shown);
  const save = () => {
    const value = Number(text.replace(",", "."));
    setPay(Number.isFinite(value) && value > 0 ? Math.round(value * scale) : null);
  };
  return (
    <View className="min-h-[56px] flex-row items-center gap-3.5 px-4 py-2">
      <IconTile name="clock" />
      <Text variant="body" className="flex-1" style={{ color: skin.text }}>
        {`Hourly pay (${currency})`}
      </Text>
      <TextInput
        value={text}
        onChangeText={setText}
        onEndEditing={save}
        onBlur={save}
        keyboardType="decimal-pad"
        placeholder="Off"
        placeholderTextColor={skin.tertiary}
        accessibilityLabel="Hourly pay"
        style={{ color: skin.text, fontSize: 17, minWidth: 80, textAlign: "right" }}
      />
    </View>
  );
}

const SWATCHES: readonly AccentPresetKey[] = ["violet", "emerald", "blue", "teal", "plum", "bronze", "ivory"];

/** The theme colour as a row of swatches, so it changes in one tap. */
function AccentRow({ skin }: { skin: RowSkin }) {
  const { colors, isDark } = useTokens();
  const [accent, setAccent] = useSetting("accent");
  return (
    <View className="px-4 py-3">
      <View className="flex-row items-center gap-3.5">
        <IconTile name="paintbrush.fill" />
        <Text variant="body" className="flex-1" style={{ color: skin.text }}>
          Colour
        </Text>
      </View>
      <View className="mt-3 flex-row justify-between pl-[44px]">
        {SWATCHES.map((key) => {
          const selected = accent === key;
          return (
            <Pressable
              key={key}
              role="radio"
              accessibilityLabel={key === "ivory" ? "Ink" : key}
              accessibilityState={{ selected }}
              hitSlop={4}
              scale={0.9}
              onPress={() => {
                haptic("selection");
                setAccent(key);
              }}
              className="h-9 w-9 items-center justify-center rounded-full"
              style={{ borderWidth: 2, borderColor: selected ? colors.text : "transparent" }}
            >
              <View
                className="h-7 w-7 rounded-full"
                style={{ backgroundColor: accentPresets[key][isDark ? "dark" : "light"].accent }}
              />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** One row of a group page, whichever kind it is. */
export function GroupRow({
  row,
  skin,
  onPicker,
}: {
  row: SettingRow;
  skin: RowSkin;
  onPicker: (id: PickerId) => void;
}) {
  const router = useRouter();
  if (row.custom === "hourly_pay") return <HourlyPayRow skin={skin} />;
  if (row.custom === "accent") return <AccentRow skin={skin} />;
  if (row.toggle) return <ToggleRow row={row} skin={skin} />;
  return (
    <LinkRow
      icon={row.icon}
      label={row.label}
      value={row.value}
      skin={skin}
      onPress={() => {
        if (row.href) router.push(row.href);
        else if (row.picker) onPicker(row.picker);
      }}
    />
  );
}

/** An explanation folded behind an info button, under a group. */
export function FoldedNote({ text, skin }: { text: string; skin: RowSkin }) {
  const [open, setOpen] = React.useState(false);
  return (
    <View className="mt-1.5 px-1">
      <Pressable
        role="button"
        accessibilityLabel={open ? "Hide details" : "More about this"}
        hitSlop={10}
        scale={0.96}
        className="self-start py-1"
        onPress={() => {
          haptic("selection");
          setOpen((v) => !v);
        }}
      >
        <SymbolIcon name="info.circle" size={15} color={open ? skin.secondary : skin.tertiary} />
      </Pressable>
      {open ? (
        <Text variant="footnote" style={{ color: skin.secondary }}>
          {text}
        </Text>
      ) : null}
    </View>
  );
}

/** The pickers a group's rows can open. */
export function GroupPickers({
  open,
  onClose,
}: {
  open: PickerId | null;
  onClose: () => void;
}) {
  const accounts = useAccounts();
  const [weekStart, setWeekStart] = useSetting("week_start");
  const [monthStart, setMonthStart] = useSetting("month_start");
  const [defaultAccountId, setDefaultAccountId] = useSetting("default_account_id");
  const [rowDetail, setRowDetail] = useSetting("row_detail");
  const [archivedThrough, setArchivedThrough] = useSetting("archived_through");
  const archiveOptions = React.useMemo(() => archiveChoices(new Date()), []);
  const accountOptions = React.useMemo(
    () => accounts.map((a) => ({ value: a.id as string | null, label: a.name })),
    [accounts],
  );
  return (
    <>
      <OptionPicker
        visible={open === "rows"}
        title="Under each transaction"
        options={ROW_OPTIONS}
        selected={rowDetail}
        onSelect={setRowDetail}
        onClose={onClose}
      />
      <OptionPicker
        visible={open === "archive"}
        title="Leave out of totals"
        options={archiveOptions}
        selected={archivedThrough}
        onSelect={setArchivedThrough}
        onClose={onClose}
      />
      <OptionPicker
        visible={open === "week"}
        title="Week starts on"
        options={WEEK_OPTIONS}
        selected={weekStart}
        onSelect={setWeekStart}
        onClose={onClose}
      />
      <OptionPicker
        visible={open === "month"}
        title="Month starts on"
        options={MONTH_OPTIONS}
        selected={monthStart}
        onSelect={setMonthStart}
        onClose={onClose}
      />
      <OptionPicker
        visible={open === "account"}
        title="Default account"
        options={accountOptions}
        selected={defaultAccountId}
        onSelect={(id) => {
          if (id !== null) setDefaultAccountId(id);
        }}
        onClose={onClose}
      />
    </>
  );
}

/** Off, the last calendar year, or the last April–March year: entries up to that day stop counting in totals. */
export function archiveChoices(now: Date): { value: string | null; label: string }[] {
  const y = now.getFullYear();
  const fyEnd = now.getMonth() >= 3 ? y : y - 1;
  return [
    { value: null, label: "Nothing" },
    { value: `${y - 1}-12-31`, label: `${y - 1} and before` },
    { value: `${fyEnd}-03-31`, label: `Up to March ${fyEnd} (Apr–Mar year)` },
  ];
}
