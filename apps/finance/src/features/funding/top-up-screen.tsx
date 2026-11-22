import * as React from "react";
import { Alert, ScrollView } from "react-native";

import { periodFor } from "@studio/dates";
import { Stagger } from "@studio/motion";
import { ListGroup, ListRow, showToast } from "@studio/ui";

import { useActions } from "@/data/actions";
import {
  useAccounts,
  useSetting,
  useSettings,
  useTodayKey,
} from "@/data/hooks";
import type { FundingMode } from "@/db/repos/settings";
import { PickRow } from "@/features/entry/form-row";

const OFF = "off";
const MODE_OPTIONS: { value: FundingMode; label: string }[] = [
  { value: "full", label: "Whole amount" },
  { value: "shortfall", label: "Only what's missing" },
];

/** Pick the main account and the accounts it tops up whenever money leaves them. */
export function TopUpScreen() {
  const actions = useActions();
  const settings = useSettings();
  const today = useTodayKey();
  const accounts = useAccounts();
  const [mainId, setMainId] = useSetting("funding_main_account_id");
  const [funded, setFunded] = useSetting("funded_accounts");
  const [mode, setMode] = useSetting("funding_mode");

  const main = accounts.find((a) => a.id === mainId);
  const others = accounts.filter(
    (a) =>
      a.id !== mainId &&
      a.id !== settings.investments_account_id &&
      (!main || a.currency === main.currency),
  );

  const offerBackfill = (accountId: string, name: string) => {
    const month = periodFor("month", today, {
      weekStart: settings.week_start,
      monthStart: settings.month_start,
    });
    const missing = actions.funding.countMissing(accountId, month.from, today);
    if (missing === 0) return;
    Alert.alert(
      `Top up ${missing} earlier ${missing === 1 ? "payment" : "payments"}?`,
      `${name} has payments this month without a top-up from ${main?.name ?? "the main account"}.`,
      [
        { text: "Not now", style: "cancel" },
        {
          text: "Add top-ups",
          onPress: () => {
            const added = actions.funding.backfill(
              accountId,
              month.from,
              today,
            );
            showToast({ message: `Added ${added}` });
          },
        },
      ],
    );
  };

  const toggle = (accountId: string, name: string) => (on: boolean) => {
    setFunded(
      on
        ? [...funded.filter((id) => id !== accountId), accountId]
        : funded.filter((id) => id !== accountId),
    );
    if (on) offerBackfill(accountId, name);
  };

  return (
    <ScrollView
      className="flex-1 bg-bg"
      contentInsetAdjustmentBehavior="automatic"
      contentContainerClassName="gap-6 py-4 pb-12"
    >
      <Stagger index={0}>
        <ListGroup footer="When you pay from a topped-up account, Pennyfield first moves the money in from the main account.">
          <PickRow
            label="Main account"
            value={main?.name ?? "Off"}
            title="Main account"
            options={[
              ...accounts
                .filter((a) => a.id !== settings.investments_account_id)
                .map((a) => ({ value: a.id, label: a.name })),
              { value: OFF, label: "Off" },
            ]}
            selected={mainId ?? OFF}
            onSelect={(id) => {
              setMainId(id === OFF ? null : id);
              if (id !== OFF) setFunded(funded.filter((f) => f !== id));
            }}
          />
          {main ? (
            <PickRow
              label="Move"
              value={MODE_OPTIONS.find((o) => o.value === mode)?.label ?? ""}
              options={MODE_OPTIONS}
              selected={mode}
              onSelect={setMode}
            />
          ) : null}
        </ListGroup>
      </Stagger>
      {main && others.length > 0 ? (
        <Stagger index={1}>
          <ListGroup header="Top up these accounts">
            {others.map((a) => (
              <ListRow
                key={a.id}
                label={a.name}
                switchValue={funded.includes(a.id)}
                onSwitchChange={toggle(a.id, a.name)}
              />
            ))}
          </ListGroup>
        </Stagger>
      ) : null}
    </ScrollView>
  );
}
