import * as React from "react";
import { View } from "react-native";

import { Button, Input, showToast, Text } from "@studio/ui";
import { formatMoney, parseAmountText } from "@studio/money";
import { useActions } from "@/data/actions";
import { useCategories } from "@/data/hooks";
import type { AccountType } from "@/db/schema";

import { balanceCorrection, correctionCategory } from "./model";

type Props = {
  account: { id: string; type: AccountType; currency: string; balance: number };
  locale?: string;
  onClose: () => void;
};

/** Type the real balance; the difference is recorded as one entry so the account matches. */
export function CountBalance({ account, locale, onClose }: Props) {
  const actions = useActions();
  const categories = useCategories();
  const [text, setText] = React.useState("");
  const cash = account.type === "cash";
  const counted = parseAmountText(text, account.currency);

  const save = () => {
    if (counted === null || counted < 0) return;
    const fix = balanceCorrection(account.balance, counted);
    if (!fix) {
      showToast({ message: "Balance already matches" });
      onClose();
      return;
    }
    const categoryId = correctionCategory(categories, fix.kind);
    const spent = fix.kind === "expense";
    actions.transactions.create({
      kind: fix.kind,
      title: cash
        ? spent
          ? "Cash spent"
          : "Cash found"
        : "Balance correction",
      amount: fix.amount,
      accountId: account.id,
      categoryId,
      occurredAt: Date.now(),
    });
    const amount = formatMoney(fix.amount, account.currency, {
      locale,
      sign: "none",
    });
    showToast({
      message: spent ? `Recorded ${amount} spent` : `Recorded ${amount} added`,
    });
    onClose();
  };

  return (
    <View className="gap-2 px-4">
      <Text variant="footnote" tone="secondary" className="px-1">
        {cash
          ? "How much cash do you have right now? The difference is added as one entry."
          : "What does your bank app show? The difference is added as one entry."}
      </Text>
      <Input
        value={text}
        onChangeText={setText}
        placeholder={formatMoney(account.balance, account.currency, {
          locale,
          sign: "none",
        })}
        accessibilityLabel={cash ? "Cash you have" : "Real balance"}
        keyboardType="decimal-pad"
        autoFocus
        returnKeyType="done"
        onSubmitEditing={save}
      />
      <View className="flex-row gap-2">
        <Button variant="secondary" className="flex-1" onPress={onClose}>
          Cancel
        </Button>
        <Button
          className="flex-1"
          disabled={counted === null || counted < 0}
          onPress={save}
        >
          Save
        </Button>
      </View>
    </View>
  );
}
