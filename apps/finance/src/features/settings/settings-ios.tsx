import {
  Button,
  Form,
  HStack,
  Host,
  Image,
  LabeledContent,
  Picker,
  Section,
  Spacer,
  Text,
  TextField,
  Toggle,
  useNativeState,
} from "@expo/ui/swift-ui";
import { foregroundStyle, keyboardType, multilineTextAlignment, tag } from "@expo/ui/swift-ui/modifiers";
import { useRouter } from "expo-router";
import * as React from "react";

import { useAccounts, useSetting } from "@/data/hooks";
import { minorDigits } from "@studio/money";

import { MONTH_OPTIONS, ROW_OPTIONS, WEEK_OPTIONS, type SettingGroup, type SettingRow } from "./groups";
import { archiveChoices } from "./settings-rows";

type Choice = { value: string | number; label: string };
type Spec = { options: Choice[]; selected: string | number; onSelect: (value: string | number) => void };

const NO_ARCHIVE = "none";

function usePickerSpecs(): Record<string, Spec> {
  const accounts = useAccounts();
  const [weekStart, setWeekStart] = useSetting("week_start");
  const [monthStart, setMonthStart] = useSetting("month_start");
  const [defaultAccountId, setDefaultAccountId] = useSetting("default_account_id");
  const [rowDetail, setRowDetail] = useSetting("row_detail");
  const [archivedThrough, setArchivedThrough] = useSetting("archived_through");
  const archive = React.useMemo(() => archiveChoices(new Date()), []);
  return {
    week: {
      options: [...WEEK_OPTIONS],
      selected: weekStart,
      onSelect: (v) => setWeekStart(v as 1 | 7),
    },
    month: {
      options: [...MONTH_OPTIONS],
      selected: monthStart,
      onSelect: (v) => setMonthStart(v as number),
    },
    account: {
      options: accounts.map((a) => ({ value: a.id, label: a.name })),
      selected: defaultAccountId ?? "",
      onSelect: (v) => setDefaultAccountId(v as string),
    },
    rows: {
      options: [...ROW_OPTIONS],
      selected: rowDetail,
      onSelect: (v) => setRowDetail(v as typeof rowDetail),
    },
    archive: {
      options: archive.map((o) => ({ value: o.value ?? NO_ARCHIVE, label: o.label })),
      selected: archivedThrough ?? NO_ARCHIVE,
      onSelect: (v) => setArchivedThrough(v === NO_ARCHIVE ? null : (v as string)),
    },
  };
}

const primary = foregroundStyle({ type: "hierarchical", style: "primary" });
const secondary = foregroundStyle({ type: "hierarchical", style: "secondary" });

function HourlyPay() {
  const [pay, setPay] = useSetting("hourly_pay");
  const [currency] = useSetting("display_currency");
  const scale = 10 ** minorDigits(currency);
  const text = useNativeState(pay ? String(pay / scale) : "");
  const latest = React.useRef(pay ? String(pay / scale) : "");
  return (
    <LabeledContent label={`Hourly pay (${currency})`}>
      <TextField
        text={text}
        placeholder="Off"
        onTextChange={(next) => {
          latest.current = next;
        }}
        onFocusChange={(focused) => {
          if (focused) return;
          const value = Number(latest.current.replace(",", "."));
          setPay(Number.isFinite(value) && value > 0 ? Math.round(value * scale) : null);
        }}
        modifiers={[keyboardType("decimal-pad"), multilineTextAlignment("trailing")]}
      />
    </LabeledContent>
  );
}

function Row({ row, specs }: { row: SettingRow; specs: Record<string, Spec> }) {
  const router = useRouter();
  if (row.custom === "hourly_pay") return <HourlyPay />;
  if (row.toggle) {
    return <Toggle label={row.label} isOn={row.toggle.value} onIsOnChange={row.toggle.onChange} />;
  }
  const spec = row.picker ? specs[row.picker] : undefined;
  if (spec) {
    return (
      <Picker label={row.label} selection={spec.selected} onSelectionChange={spec.onSelect}>
        {spec.options.map((o) => (
          <Text key={String(o.value)} modifiers={[tag(o.value)]}>
            {o.label}
          </Text>
        ))}
      </Picker>
    );
  }
  const href = row.href;
  return (
    <Button onPress={() => href && router.push(href)}>
      <HStack spacing={8}>
        <Text modifiers={[primary]}>{row.label}</Text>
        <Spacer />
        {row.value ? <Text modifiers={[secondary]}>{row.value}</Text> : null}
        <Image systemName="chevron.right" size={13} color="#8E8E93" />
      </HStack>
    </Button>
  );
}

/** Native grouped list for iOS: one Section per group. */
export function IosSettingsList({
  groups,
  titled = true,
}: {
  groups: readonly SettingGroup[];
  titled?: boolean;
}) {
  const specs = usePickerSpecs();
  return (
    <Host style={{ flex: 1 }}>
      <Form>
        {groups.map((group) => (
          <Section key={group.id} title={titled ? group.title : undefined}>
            {group.rows.map((row) => (
              <Row key={row.key} row={row} specs={specs} />
            ))}
          </Section>
        ))}
      </Form>
    </Host>
  );
}
