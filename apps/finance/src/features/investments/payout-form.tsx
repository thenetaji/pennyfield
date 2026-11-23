import { keyToLocalMs, toDateKey, type DateKey } from "@studio/dates";
import {
  currencySymbol,
  formatMoneyForSpeech,
  minorDigits,
} from "@studio/money";
import { haptic } from "@studio/theme";
import {
  AmountReadout,
  Input,
  ListGroup,
  ListRow,
  SegmentedControl,
} from "@studio/ui";
import { useRouter } from "expo-router";
import * as React from "react";
import { Keyboard, View } from "react-native";

import { useActions } from "@/data/actions";
import {
  useAccounts,
  useInvestment,
  useSettings,
  useTaxContext,
  useTodayKey,
} from "@/data/hooks";
import { ValidationError } from "@/db/errors";
import type { PayoutInput } from "@/db/repos/investments";
import type { PayoutKind } from "@/db/schema";
import { AmountKeypad } from "@/features/entry/amount-keypad";
import { EntryLayout } from "@/features/entry/entry-layout";
import { FormRow, PickRow } from "@/features/entry/form-row";
import { useSheetHeader } from "@/features/entry/sheet-header";
import { useAmountEntry } from "@/features/entry/use-amount-entry";
import { DatePicker } from "@/features/transaction-form/date-picker";

import { parseMinor } from "./format";

const KINDS: readonly PayoutKind[] = [
  "interest",
  "principal",
  "maturity",
  "sale",
];
const KIND_SEGMENTS = ["Interest", "Part back", "Maturity", "Sale"] as const;
const NONE = "none";

const toText = (minor: number, digits: number) =>
  minor === 0 ? "" : String(minor / 10 ** digits);

/** Money coming back from an investment: interest (with tax withheld), part of the principal, maturity or a sale. */
export function PayoutForm({
  investmentId,
  payoutId,
}: {
  investmentId: string;
  payoutId?: string;
}) {
  const router = useRouter();
  const actions = useActions();
  const settings = useSettings();
  const today = useTodayKey();
  const tax = useTaxContext();
  const accounts = useAccounts({ includeArchived: true });
  const detail = useInvestment(investmentId);
  const inv = detail?.investment;
  const source = payoutId
    ? detail?.payouts.find((p) => p.id === payoutId)
    : undefined;

  const currency = inv?.currency ?? settings.display_currency;
  const digits = minorDigits(currency);
  const left = inv ? inv.amount - (detail?.totals.principalBack ?? 0) : 0;
  const due = !!inv?.maturityDate && inv.maturityDate <= today && !inv.closedOn;

  const [kind, setKind] = React.useState<PayoutKind>(
    source?.kind ?? (due ? "maturity" : "interest"),
  );
  const [gross, setGross] = React.useState(
    source?.gross ?? (due ? Math.max(0, left) : 0),
  );
  const [tdsText, setTdsText] = React.useState(
    toText(source?.tds ?? 0, digits),
  );
  const [dateKey, setDateKey] = React.useState<DateKey>(
    source?.dateKey ?? (due && inv?.maturityDate ? inv.maturityDate : today),
  );
  const [accountId, setAccountId] = React.useState<string>(
    payoutId
      ? (source?.accountId ?? NONE)
      : (inv?.fromAccountId ?? settings.default_account_id ?? NONE),
  );
  const [note, setNote] = React.useState(source?.note ?? "");
  const [keypadOpen, setKeypadOpen] = React.useState(!payoutId);
  const [textFocused, setTextFocused] = React.useState(false);
  const entry = useAmountEntry(digits, gross, setGross);

  const tds = kind === "interest" ? parseMinor(tdsText, digits) : 0;
  const disabled = gross <= 0 || Number.isNaN(tds) || tds >= gross;

  const close = () => {
    if (router.canDismiss()) router.dismiss();
    else if (router.canGoBack()) router.back();
  };

  const save = () => {
    if (disabled) {
      haptic("error");
      return;
    }
    const input: PayoutInput = {
      kind,
      dateKey,
      gross,
      tds,
      accountId: accountId === NONE ? null : accountId,
      note,
    };
    try {
      if (payoutId) actions.investments.updatePayout(payoutId, input);
      else actions.investments.addPayout(investmentId, input);
    } catch (error) {
      haptic("error");
      if (error instanceof ValidationError) return;
      throw error;
    }
    haptic("success");
    close();
  };

  const remove = () => {
    if (!payoutId) return;
    actions.investments.deletePayout(payoutId);
    close();
  };

  const header = useSheetHeader({
    title: payoutId ? "Edit payout" : "Add payout",
    onCancel: close,
    onSave: save,
    saveDisabled: disabled,
  });

  if (!inv || (payoutId && !source)) return null;

  const accountOptions = [
    ...accounts
      .filter(
        (a) =>
          a.currency === currency &&
          a.id !== settings.investments_account_id &&
          (!a.archivedAt || a.id === accountId),
      )
      .map((a) => ({ value: a.id, label: a.name })),
    { value: NONE, label: "None" },
  ];
  const showKeypad = keypadOpen && !textFocused;
  const focus = {
    onFocus: () => setTextFocused(true),
    onBlur: () => setTextFocused(false),
  };

  return (
    <>
      {header}
      <EntryLayout
        keypad={
          showKeypad ? (
            <AmountKeypad entry={entry} digits={digits} onSave={save} />
          ) : null
        }
      >
        <View className="px-4">
          <SegmentedControl
            values={KIND_SEGMENTS}
            selectedIndex={KINDS.indexOf(kind)}
            onChange={(index) => {
              const next = KINDS[index] ?? "interest";
              setKind(next);
              if (!payoutId && next === "maturity" && gross === 0)
                setGross(Math.max(0, left));
            }}
            accessibilityLabel="Kind"
          />
        </View>
        <View className="h-[92px] justify-center">
          <AmountReadout
            symbol={currencySymbol(currency)}
            value={entry.view.display}
            expression={entry.view.expression}
            onPress={() => {
              Keyboard.dismiss();
              setTextFocused(false);
              setKeypadOpen(true);
            }}
            accessibilityLabel={`${kind === "interest" ? "Gross interest" : "Amount"}, ${formatMoneyForSpeech(gross, currency, { sign: "none" })}`}
          />
        </View>
        <ListGroup
          footer={
            kind === "interest"
              ? "Enter the interest before tax. The amount after tax is added to the account."
              : kind === "maturity"
                ? "Enter the principal only; add the last interest as a separate Interest payout."
                : undefined
          }
        >
          {kind === "interest" ? (
            <FormRow label={tax.rules === "india" ? "TDS" : "Tax withheld"}>
              <Input
                variant="inline"
                value={tdsText}
                onChangeText={setTdsText}
                placeholder={`${currencySymbol(currency)}0`}
                keyboardType="decimal-pad"
                returnKeyType="done"
                accessibilityLabel="Tax withheld"
                className="h-6 min-h-0 flex-1 py-0 text-right"
                {...focus}
              />
            </FormRow>
          ) : null}
          <FormRow label="Date">
            <DatePicker
              value={keyToLocalMs(dateKey, 12)}
              mode="date"
              display="compact"
              onChange={(ms) => setDateKey(toDateKey(ms))}
            />
          </FormRow>
          <PickRow
            label="Paid into"
            value={
              accountOptions.find((o) => o.value === accountId)?.label ?? "None"
            }
            options={accountOptions}
            selected={accountId}
            onSelect={setAccountId}
          />
          <FormRow label="Note">
            <Input
              variant="inline"
              value={note}
              onChangeText={setNote}
              placeholder="Optional"
              returnKeyType="done"
              accessibilityLabel="Note"
              className="h-6 min-h-0 flex-1 py-0 text-right"
              {...focus}
            />
          </FormRow>
        </ListGroup>
        {payoutId ? (
          <ListGroup>
            <ListRow
              label="Delete payout"
              destructive
              centered
              onPress={remove}
            />
          </ListGroup>
        ) : null}
      </EntryLayout>
    </>
  );
}
