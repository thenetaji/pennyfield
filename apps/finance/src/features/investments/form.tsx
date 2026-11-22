import {
  addMonths,
  keyToLocalMs,
  toDateKey,
  type DateKey,
} from "@studio/dates";
import {
  currencySymbol,
  formatMoneyForSpeech,
  minorDigits,
} from "@studio/money";
import { haptic } from "@studio/theme";
import { AmountReadout, Input, ListGroup, ListRow } from "@studio/ui";
import { useRouter } from "expo-router";
import * as React from "react";
import { Alert, Keyboard, View } from "react-native";

import { useActions } from "@/data/actions";
import {
  useAccounts,
  useInvestment,
  useSettings,
  useTodayKey,
} from "@/data/hooks";
import { ValidationError } from "@/db/errors";
import type { InvestmentInput } from "@/db/repos/investments";
import type { InvestmentPayoutSchedule, InvestmentType } from "@/db/schema";
import { AmountKeypad } from "@/features/entry/amount-keypad";
import { EntryLayout } from "@/features/entry/entry-layout";
import { FormRow, PickRow } from "@/features/entry/form-row";
import { useSheetHeader } from "@/features/entry/sheet-header";
import { useAmountEntry } from "@/features/entry/use-amount-entry";
import { DatePicker } from "@/features/transaction-form/date-picker";
import { TYPE_LABELS } from "@/lib/investments/tax";

import { parseRate, SCHEDULE_LABELS, SCHEDULES, TYPES } from "./format";

const noon = (key: DateKey) => keyToLocalMs(key, 12);
const NONE = "none";

function TextRow({
  label,
  value,
  onChange,
  placeholder,
  focus,
  keyboardType,
  showSeparator,
}: {
  label: string;
  value: string;
  onChange: (text: string) => void;
  placeholder?: string;
  focus: { onFocus: () => void; onBlur: () => void };
  keyboardType?: "default" | "decimal-pad";
  showSeparator?: boolean;
}) {
  return (
    <FormRow label={label} showSeparator={showSeparator}>
      <Input
        variant="inline"
        value={value}
        onChangeText={onChange}
        placeholder={placeholder ?? "Optional"}
        returnKeyType="done"
        keyboardType={keyboardType}
        accessibilityLabel={label}
        className="h-6 min-h-0 flex-1 py-0 text-right"
        {...focus}
      />
    </FormRow>
  );
}

/** Add or edit a deposit or bond: amount on the keypad, then where it came from and its terms. */
export function InvestmentForm({
  mode,
  investmentId,
}: {
  mode: "new" | "edit";
  investmentId?: string;
}) {
  const router = useRouter();
  const actions = useActions();
  const settings = useSettings();
  const today = useTodayKey();
  const accounts = useAccounts({ includeArchived: true });
  const detail = useInvestment(mode === "edit" ? investmentId : undefined);
  const source = detail?.investment;

  const holdingId = settings.investments_account_id;
  const currency =
    source?.currency ??
    accounts.find((a) => a.id === holdingId)?.currency ??
    settings.display_currency;
  const digits = minorDigits(currency);

  const [amount, setAmount] = React.useState(source?.amount ?? 0);
  const [name, setName] = React.useState(source?.name ?? "");
  const [type, setType] = React.useState<InvestmentType>(source?.type ?? "fd");
  const [buyDate, setBuyDate] = React.useState<DateKey>(
    source?.buyDate ?? today,
  );
  const [maturityDate, setMaturityDate] = React.useState<DateKey>(
    source?.maturityDate ?? addMonths(today, 12),
  );
  const [rateText, setRateText] = React.useState(
    source?.rate != null ? String(source.rate) : "",
  );
  const [payout, setPayout] = React.useState<InvestmentPayoutSchedule>(
    source?.payout ?? "quarterly",
  );
  const [fromId, setFromId] = React.useState<string>(
    mode === "edit"
      ? (source?.fromAccountId ?? NONE)
      : (settings.default_account_id ?? NONE),
  );
  const [issuer, setIssuer] = React.useState(source?.issuer ?? "");
  const [platform, setPlatform] = React.useState(source?.platform ?? "");
  const [reference, setReference] = React.useState(source?.reference ?? "");
  const [rating, setRating] = React.useState(source?.rating ?? "");
  const [listed, setListed] = React.useState(source?.listed ?? true);
  const [closed, setClosed] = React.useState(!!source?.closedOn);
  const [closedOn, setClosedOn] = React.useState<DateKey>(
    source?.closedOn ?? source?.maturityDate ?? today,
  );
  const [note, setNote] = React.useState(source?.note ?? "");
  const [keypadOpen, setKeypadOpen] = React.useState(mode === "new");
  const [textFocused, setTextFocused] = React.useState(false);
  const entry = useAmountEntry(digits, amount, setAmount);

  const rate = parseRate(rateText);
  const fallbackName = issuer.trim() || TYPE_LABELS[type];
  const disabled = amount <= 0 || Number.isNaN(rate) || maturityDate < buyDate;

  const close = () => {
    if (router.canDismiss()) router.dismiss();
    else if (router.canGoBack()) router.back();
    else router.replace("/investments");
  };

  const save = () => {
    if (disabled) {
      haptic("error");
      return;
    }
    const input: InvestmentInput = {
      name: name.trim() || fallbackName,
      type,
      issuer,
      platform,
      reference,
      rating,
      listed: type === "fd" ? false : listed,
      amount,
      rate,
      payout,
      buyDate,
      maturityDate,
      closedOn: closed ? closedOn : null,
      fromAccountId: fromId === NONE ? null : fromId,
      note,
    };
    try {
      if (mode === "edit" && investmentId)
        actions.investments.update(investmentId, input);
      else actions.investments.create(input);
    } catch (error) {
      haptic("error");
      if (error instanceof ValidationError) return;
      throw error;
    }
    haptic("success");
    close();
  };

  const remove = () => {
    if (!investmentId) return;
    Alert.alert(
      "Delete investment",
      "Its payouts and the entries it added to your accounts are deleted too.",
      [
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            actions.investments.delete(investmentId);
            if (router.canDismiss()) router.dismissAll();
            router.replace("/investments");
          },
        },
        { text: "Cancel", style: "cancel" },
      ],
    );
  };

  const header = useSheetHeader({
    title: mode === "edit" ? "Edit investment" : "New investment",
    onCancel: close,
    onSave: save,
    saveDisabled: disabled,
  });

  if (mode === "edit" && !source) return null;

  const accountOptions = [
    ...accounts
      .filter(
        (a) =>
          a.currency === currency &&
          a.id !== holdingId &&
          (!a.archivedAt || a.id === fromId),
      )
      .map((a) => ({ value: a.id, label: a.name })),
    { value: NONE, label: "None" },
  ];
  const fromLabel =
    accountOptions.find((o) => o.value === fromId)?.label ?? "None";
  const focus = {
    onFocus: () => setTextFocused(true),
    onBlur: () => setTextFocused(false),
  };
  const showKeypad = keypadOpen && !textFocused;

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
            accessibilityLabel={`Amount invested, ${formatMoneyForSpeech(amount, currency, { sign: "none" })}`}
          />
        </View>
        <ListGroup footer="Choose None if the money left your accounts before you started using Pennyfield.">
          <TextRow
            label="Name"
            value={name}
            onChange={setName}
            placeholder={fallbackName}
            focus={focus}
          />
          <PickRow
            label="Type"
            value={TYPE_LABELS[type]}
            options={TYPES.map((t) => ({ value: t, label: TYPE_LABELS[t] }))}
            selected={type}
            onSelect={setType}
          />
          <TextRow
            label="Rate"
            value={rateText}
            onChange={setRateText}
            placeholder="% a year"
            keyboardType="decimal-pad"
            focus={focus}
          />
          <PickRow
            label="Interest paid"
            value={SCHEDULE_LABELS[payout]}
            options={SCHEDULES.map((s) => ({
              value: s,
              label: SCHEDULE_LABELS[s],
            }))}
            selected={payout}
            onSelect={setPayout}
          />
          <FormRow label="Bought">
            <DatePicker
              value={noon(buyDate)}
              mode="date"
              display="compact"
              onChange={(ms) => setBuyDate(toDateKey(ms))}
            />
          </FormRow>
          <FormRow label="Matures">
            <DatePicker
              value={noon(maturityDate)}
              mode="date"
              display="compact"
              minimumDate={noon(buyDate)}
              onChange={(ms) => setMaturityDate(toDateKey(ms))}
            />
          </FormRow>
          <PickRow
            label="Paid from"
            value={fromLabel}
            options={accountOptions}
            selected={fromId}
            onSelect={setFromId}
          />
        </ListGroup>
        <ListGroup>
          <TextRow
            label={type === "fd" ? "Bank" : "Issuer"}
            value={issuer}
            onChange={setIssuer}
            focus={focus}
          />
          <TextRow
            label="Platform"
            value={platform}
            onChange={setPlatform}
            focus={focus}
          />
          <TextRow
            label={type === "fd" ? "FD number" : "ISIN"}
            value={reference}
            onChange={setReference}
            focus={focus}
          />
          {type === "fd" ? null : (
            <TextRow
              label="Rating"
              value={rating}
              onChange={setRating}
              focus={focus}
            />
          )}
          {type === "fd" ? null : (
            <ListRow
              label="Listed on an exchange"
              switchValue={listed}
              onSwitchChange={setListed}
            />
          )}
          <TextRow label="Note" value={note} onChange={setNote} focus={focus} />
        </ListGroup>
        {mode === "edit" ? (
          <ListGroup>
            <ListRow
              label="Fully paid back"
              switchValue={closed}
              onSwitchChange={setClosed}
            />
            {closed ? (
              <FormRow label="On">
                <DatePicker
                  value={noon(closedOn)}
                  mode="date"
                  display="compact"
                  minimumDate={noon(buyDate)}
                  onChange={(ms) => setClosedOn(toDateKey(ms))}
                />
              </FormRow>
            ) : null}
          </ListGroup>
        ) : null}
        {mode === "edit" ? (
          <ListGroup>
            <ListRow
              label="Delete investment"
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
