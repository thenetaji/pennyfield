import { FlashList } from "@shopify/flash-list";
import * as React from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";

import { DaySectionHeader } from "@studio/ui";
import type { TransactionListItem } from "@/data/hooks";
import { EntryTracker } from "@studio/motion";
import { useTokens } from "@studio/theme";

import { buildDayEntries, headerIndices, type ListEntry } from "./day-groups";
import { TransactionListRow } from "./transaction-list-row";
import type { MoneyContext } from "./use-money-context";

type TransactionDayListProps = {
  items: readonly TransactionListItem[];
  context: MoneyContext;
  header?: React.ReactElement | null;
  footer?: React.ReactElement | null;
  empty?: React.ReactElement | null;
  contentContainerStyle?: StyleProp<ViewStyle>;
  keyboardDismissMode?: "none" | "on-drag" | "interactive";
  /** "never" in sheets with their own header, where iOS would add a status-bar gap. */
  contentInsetAdjustmentBehavior?: "automatic" | "never";
  /** Scrolls to this day (or the nearest earlier one) whenever it changes. */
  focusDay?: string | null;
};

const RADIUS = 18;

const keyOf = (entry: ListEntry) => entry.key;
const typeOf = (entry: ListEntry) => entry.type;

/** Day-grouped ledger on FlashList: sticky day headers, memoised rows, stable keys. */
function TransactionDayList({
  items,
  context: callerContext,
  header,
  footer,
  empty,
  contentContainerStyle,
  keyboardDismissMode,
  contentInsetAdjustmentBehavior = "automatic",
  focusDay,
}: TransactionDayListProps) {
  const listRef = React.useRef<React.ComponentRef<typeof FlashList<ListEntry>>>(null);
  // Day headers already say the date, so rows under them always show the time (C4), whatever the caller passed.
  const context = React.useMemo(
    () =>
      callerContext.relativeTo
        ? { ...callerContext, relativeTo: undefined }
        : callerContext,
    [callerContext],
  );
  const entries = React.useMemo(
    () => buildDayEntries(items, context),
    [items, context],
  );
  // One tracker per mounted list: first screenful staggers in, later single inserts spring + shimmer.
  const [tracker] = React.useState(() => new EntryTracker());
  React.useMemo(() => tracker.sync(items.map((i) => i.id)), [tracker, items]);
  const sticky = React.useMemo(() => headerIndices(entries), [entries]);
  const { colors } = useTokens();
  const renderItem = React.useCallback(
    ({ item }: { item: ListEntry }) =>
      item.type === "header" ? (
        <DaySectionHeader
          label={item.label}
          total={item.total}
          share={item.share}
          inset
        />
      ) : (
        <View
          className="mx-4 overflow-hidden"
          style={{
            borderColor: colors.border,
            borderLeftWidth: 1,
            borderRightWidth: 1,
            borderTopWidth: item.first ? 1 : 0,
            borderBottomWidth: item.last ? 1 : 0,
            borderTopLeftRadius: item.first ? RADIUS : 0,
            borderTopRightRadius: item.first ? RADIUS : 0,
            borderBottomLeftRadius: item.last ? RADIUS : 0,
            borderBottomRightRadius: item.last ? RADIUS : 0,
            borderCurve: "continuous",
          }}
        >
          <TransactionListRow
            item={item.item}
            context={context}
            separator={!item.last}
            tracker={tracker}
          />
        </View>
      ),
    [context, tracker, colors.border],
  );
  // Scroll once per requested day, as soon as that day's entries are loaded.
  const scrolledTo = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!focusDay || scrolledTo.current === focusDay) return;
    const index = entries.findIndex(
      (e) => e.type === "header" && e.dateKey <= focusDay,
    );
    if (index < 0) return;
    scrolledTo.current = focusDay;
    listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0 });
  }, [focusDay, entries]);
  return (
    <FlashList
      ref={listRef}
      data={entries}
      renderItem={renderItem}
      keyExtractor={keyOf}
      getItemType={typeOf}
      stickyHeaderIndices={sticky}
      ListHeaderComponent={header}
      ListFooterComponent={footer}
      ListEmptyComponent={empty}
      contentInsetAdjustmentBehavior={contentInsetAdjustmentBehavior}
      keyboardDismissMode={keyboardDismissMode}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={contentContainerStyle}
    />
  );
}

export { TransactionDayList };
export type { TransactionDayListProps };
