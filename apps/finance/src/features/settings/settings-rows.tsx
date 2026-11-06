import { useRouter } from "expo-router";
import * as React from "react";
import { StyleSheet, TextInput, View } from "react-native";

import { useAccounts, useSetting } from "@/data/hooks";
import { SETTINGS_STYLES } from "@/db/repos/settings";
import { minorDigits } from "@studio/money";
import { haptic, useTokens } from "@studio/theme";
import {
  OptionPicker,
  Pressable,
  SegmentedControl,
  SymbolIcon,
  Switch,
  Text,
} from "@studio/ui";

import {
  MONTH_OPTIONS,
  ROW_OPTIONS,
  STYLE_LABELS,
  WEEK_OPTIONS,
  type PickerId,
  type SettingRow,
} from "./groups";

/** The colours one style draws with; Glass stays dark in either theme. */
export type RowSkin = {
  text: string;
  secondary: string;
  tertiary: string;
  surface: string;
  separator: string;
  pressed: string;
  radius: number;
};

export function useRowSkin(glass: boolean): RowSkin {
  const { colors } = useTokens();
  return glass
    ? {
        text: "#FFFFFF",
        secondary: "rgba(255,255,255,0.6)",
        tertiary: "rgba(255,255,255,0.38)",
        surface: "rgba(255,255,255,0.08)",
        separator: "rgba(255,255,255,0.1)",
        pressed: "rgba(255,255,255,0.08)",
        radius: 16,
      }
    : {
        text: colors.text,
        secondary: colors.textSecondary,
        tertiary: colors.textTertiary,
        surface: colors.surface,
        separator: colors.separator,
        pressed: colors.fill,
        radius: 18,
      };
}

export function SectionTitle({ title, skin }: { title: string; skin: RowSkin }) {
  return (
    <Text
      variant="footnote"
      accessibilityRole="header"
      className="mb-2 px-1 font-bold uppercase tracking-[0.6px]"
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
                marginLeft: 16,
              }}
            />
          ) : null}
          {child}
        </View>
      ))}
    </Card>
  );
}

function Chevron({ skin }: { skin: RowSkin }) {
  return <SymbolIcon name="chevron.right" size={13} color={skin.tertiary} weight="bold" />;
}

/** A row that opens something, with its value on the right. */
export function LinkRow({
  label,
  value,
  caption,
  skin,
  onPress,
}: {
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
      className="min-h-[52px] flex-row items-center gap-3 px-4 py-2.5"
      style={{ backgroundColor: pressed ? skin.pressed : "transparent" }}
    >
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
    <View className="min-h-[52px] flex-row items-center gap-3 px-4 py-2">
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
    <View className="min-h-[52px] flex-row items-center gap-3 px-4 py-2">
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

export function StylePicker({ skin }: { skin: RowSkin }) {
  const [style, setStyle] = useSetting("settings_style");
  return (
    <View className="gap-2 px-4 py-3">
      <Text variant="body" style={{ color: skin.text }}>
        Settings style
      </Text>
      <SegmentedControl
        values={SETTINGS_STYLES.map((s) => STYLE_LABELS[s])}
        selectedIndex={SETTINGS_STYLES.indexOf(style)}
        onChange={(i) => setStyle(SETTINGS_STYLES[i] ?? "calm")}
        accessibilityLabel="Settings style"
      />
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
  if (row.custom === "settings_style") return <StylePicker skin={skin} />;
  if (row.toggle) return <ToggleRow row={row} skin={skin} />;
  return (
    <LinkRow
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
