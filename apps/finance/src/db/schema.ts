import { sql } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  type AnySQLiteColumn,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import type { RecurringKind, TransactionKind } from "../lib/ledger/kinds";

export type AccountType = "cash" | "bank" | "card" | "other";
export type CategoryKind = "expense" | "income";
export type TransactionSide = "business" | "personal";
export type {
  LendingKind,
  RecurringKind,
  TransactionKind,
} from "../lib/ledger/kinds";
export type Frequency = "daily" | "weekly" | "monthly" | "yearly";
export type BudgetPeriod = "weekly" | "monthly" | "yearly";
export type BudgetScope = "all" | "categories";
export type InvestmentType = "fd" | "bond" | "gsec" | "tbill" | "other";
export type InvestmentPayoutSchedule =
  | "monthly"
  | "quarterly"
  | "half_yearly"
  | "yearly"
  | "cumulative"
  | "at_maturity";
export type PayoutKind = "interest" | "principal" | "maturity" | "sale";

export const accounts = sqliteTable("accounts", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").$type<AccountType>().notNull(),
  currency: text("currency").notNull(),
  openingBalance: integer("opening_balance").notNull().default(0),
  color: text("color").notNull(),
  icon: text("icon").notNull(),
  isDefault: integer("is_default", { mode: "boolean" })
    .notNull()
    .default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  archivedAt: integer("archived_at"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const categories = sqliteTable(
  "categories",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    kind: text("kind").$type<CategoryKind>().notNull(),
    icon: text("icon").notNull(),
    color: text("color").notNull(),
    /** Optional group name ("Essentials") that Insights can roll categories up into; null stands alone. */
    groupName: text("group_name"),
    /** Spending or income here counts as business unless a transaction overrides it. */
    isBusiness: integer("is_business", { mode: "boolean" })
      .notNull()
      .default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    archivedAt: integer("archived_at"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => [index("categories_kind_sort_idx").on(t.kind, t.sortOrder)],
);

export const recurringRules = sqliteTable(
  "recurring_rules",
  {
    id: text("id").primaryKey(),
    kind: text("kind").$type<RecurringKind>().notNull(),
    title: text("title").notNull(),
    memo: text("memo").notNull().default(""),
    amount: integer("amount").notNull(),
    currency: text("currency").notNull(),
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id),
    categoryId: text("category_id").references(() => categories.id),
    transferAccountId: text("transfer_account_id").references(
      () => accounts.id,
    ),
    transferAmount: integer("transfer_amount"),
    frequency: text("frequency").$type<Frequency>().notNull(),
    interval: integer("interval").notNull().default(1),
    anchorDay: integer("anchor_day"),
    startDate: text("start_date").notNull(),
    endDate: text("end_date"),
    nextDue: text("next_due").notNull(),
    autoPost: integer("auto_post", { mode: "boolean" }).notNull().default(true),
    pausedAt: integer("paused_at"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => [index("recurring_rules_next_due_idx").on(t.nextDue)],
);

export const people = sqliteTable("people", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: integer("created_at").notNull(),
});

export const tags = sqliteTable(
  "tags",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    color: text("color").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [uniqueIndex("tags_name_unique").on(t.name)],
);

export const transactions = sqliteTable(
  "transactions",
  {
    id: text("id").primaryKey(),
    kind: text("kind").$type<TransactionKind>().notNull(),
    title: text("title").notNull().default(""),
    memo: text("memo").notNull().default(""),
    amount: integer("amount").notNull(),
    currency: text("currency").notNull(),
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id),
    categoryId: text("category_id").references(() => categories.id),
    transferAccountId: text("transfer_account_id").references(
      () => accounts.id,
    ),
    transferAmount: integer("transfer_amount"),
    transferCurrency: text("transfer_currency"),
    occurredAt: integer("occurred_at").notNull(),
    dateKey: text("date_key").notNull(),
    isSplit: integer("is_split", { mode: "boolean" }).notNull().default(false),
    recurringRuleId: text("recurring_rule_id").references(
      () => recurringRules.id,
    ),
    /** Counterparty of the lending kinds; null otherwise. */
    personId: text("person_id").references(() => people.id),
    /** Overrides the category's business flag; null follows the category. */
    side: text("side").$type<TransactionSide>(),
    /** Set on an automatic top-up: the payment it funds. Deleting the payment deletes the top-up. */
    fundsTransactionId: text("funds_transaction_id").references(
      (): AnySQLiteColumn => transactions.id,
      { onDelete: "cascade" },
    ),
    /** The owner skipped the automatic top-up for this payment. */
    noFunding: integer("no_funding", { mode: "boolean" })
      .notNull()
      .default(false),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => [
    index("transactions_person_idx").on(t.personId),
    index("transactions_date_idx").on(
      sql`${t.dateKey} desc`,
      sql`${t.occurredAt} desc`,
    ),
    index("transactions_account_date_idx").on(t.accountId, t.dateKey),
    index("transactions_category_date_idx").on(t.categoryId, t.dateKey),
    index("transactions_rule_idx").on(t.recurringRuleId),
    index("transactions_transfer_account_idx").on(t.transferAccountId),
    index("transactions_funds_idx").on(t.fundsTransactionId),
  ],
);

export const transactionSplits = sqliteTable(
  "transaction_splits",
  {
    id: text("id").primaryKey(),
    transactionId: text("transaction_id")
      .notNull()
      .references(() => transactions.id, { onDelete: "cascade" }),
    categoryId: text("category_id")
      .notNull()
      .references(() => categories.id),
    amount: integer("amount").notNull(),
    sortOrder: integer("sort_order").notNull(),
  },
  (t) => [
    index("transaction_splits_tx_idx").on(t.transactionId),
    index("transaction_splits_category_idx").on(t.categoryId),
  ],
);

export const transactionTags = sqliteTable(
  "transaction_tags",
  {
    transactionId: text("transaction_id")
      .notNull()
      .references(() => transactions.id, { onDelete: "cascade" }),
    tagId: text("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.transactionId, t.tagId] }),
    index("transaction_tags_tag_idx").on(t.tagId),
  ],
);

export const attachments = sqliteTable(
  "attachments",
  {
    id: text("id").primaryKey(),
    transactionId: text("transaction_id")
      .notNull()
      .references(() => transactions.id, { onDelete: "cascade" }),
    uri: text("uri").notNull(),
    width: integer("width"),
    height: integer("height"),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [index("attachments_tx_idx").on(t.transactionId)],
);

export const budgets = sqliteTable("budgets", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  amount: integer("amount").notNull(),
  currency: text("currency").notNull(),
  period: text("period").$type<BudgetPeriod>().notNull(),
  startAnchor: integer("start_anchor").notNull(),
  scope: text("scope").$type<BudgetScope>().notNull(),
  /** Envelope rollover: the previous period's leftover (or overspend) carries into this one. */
  rollover: integer("rollover", { mode: "boolean" }).notNull().default(false),
  archivedAt: integer("archived_at"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const budgetCategories = sqliteTable(
  "budget_categories",
  {
    budgetId: text("budget_id")
      .notNull()
      .references(() => budgets.id, { onDelete: "cascade" }),
    categoryId: text("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.budgetId, t.categoryId] })],
);

export const titleMemory = sqliteTable(
  "title_memory",
  {
    titleNorm: text("title_norm").primaryKey(),
    title: text("title").notNull(),
    kind: text("kind").$type<CategoryKind>().notNull(),
    categoryId: text("category_id"),
    accountId: text("account_id"),
    lastAmount: integer("last_amount"),
    lastCurrency: text("last_currency"),
    useCount: integer("use_count").notNull().default(1),
    lastUsedAt: integer("last_used_at").notNull(),
  },
  (t) => [
    index("title_memory_kind_idx").on(
      t.kind,
      sql`${t.useCount} desc`,
      sql`${t.lastUsedAt} desc`,
    ),
  ],
);

export const fxRates = sqliteTable(
  "fx_rates",
  {
    base: text("base").notNull(),
    quote: text("quote").notNull(),
    rate: real("rate").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.base, t.quote] })],
);

/**
 * A fixed deposit, bond or similar holding. Its money sits in a holding account (the `investments_account_id`
 * setting): buying is a transfer into it, principal coming back is a transfer out of it.
 */
export const investments = sqliteTable(
  "investments",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    type: text("type").$type<InvestmentType>().notNull(),
    issuer: text("issuer").notNull().default(""),
    platform: text("platform").notNull().default(""),
    /** ISIN, FD number or any other reference. */
    reference: text("reference").notNull().default(""),
    rating: text("rating").notNull().default(""),
    listed: integer("listed", { mode: "boolean" }).notNull().default(false),
    amount: integer("amount").notNull(),
    currency: text("currency").notNull(),
    /** Yearly rate or yield in percent. */
    rate: real("rate"),
    payout: text("payout").$type<InvestmentPayoutSchedule>().notNull(),
    buyDate: text("buy_date").notNull(),
    maturityDate: text("maturity_date"),
    closedOn: text("closed_on"),
    /** Account the money came from; null when it left before tracking began. */
    fromAccountId: text("from_account_id"),
    /** Ledger entries this investment posted, rewritten on every change. */
    buyTransactionId: text("buy_transaction_id"),
    closeTransactionId: text("close_transaction_id"),
    /** First interest date; later ones repeat from it. Null repeats from the purchase date. */
    firstPayoutDate: text("first_payout_date"),
    /** Interest per payout as the issuer states it; null works it out from the rate. */
    couponAmount: integer("coupon_amount"),
    /** What comes back at maturity; null is the amount invested. */
    redemptionAmount: integer("redemption_amount"),
    /** Bonds: units bought. */
    units: real("units"),
    /** Bonds: face value of one unit, minor units; what the issuer repays per unit. */
    faceValue: integer("face_value"),
    /** Bonds: clean price paid per unit, minor units, without accrued interest. */
    cleanPrice: integer("clean_price"),
    /** Bonds: accrued interest settled at purchase, minor units; positive was paid to the seller, negative was received. */
    accruedAtBuy: integer("accrued_at_buy"),
    note: text("note").notNull().default(""),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => [index("investments_maturity_idx").on(t.maturityDate)],
);

/** The issuer's own payout schedule; when an investment has rows here they replace the calculated one. */
export const investmentSchedule = sqliteTable(
  "investment_schedule",
  {
    id: text("id").primaryKey(),
    investmentId: text("investment_id")
      .notNull()
      .references(() => investments.id, { onDelete: "cascade" }),
    dateKey: text("date_key").notNull(),
    kind: text("kind").$type<"interest" | "principal">().notNull(),
    amount: integer("amount").notNull(),
  },
  (t) => [index("investment_schedule_investment_idx").on(t.investmentId)],
);

export const investmentPayouts = sqliteTable(
  "investment_payouts",
  {
    id: text("id").primaryKey(),
    investmentId: text("investment_id")
      .notNull()
      .references(() => investments.id, { onDelete: "cascade" }),
    kind: text("kind").$type<PayoutKind>().notNull(),
    dateKey: text("date_key").notNull(),
    /** Before tax was withheld, in the investment's currency. */
    gross: integer("gross").notNull(),
    tds: integer("tds").notNull().default(0),
    /** Account the money arrived in; null keeps it out of balances. */
    accountId: text("account_id"),
    transactionId: text("transaction_id"),
    note: text("note").notNull().default(""),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [
    index("investment_payouts_investment_idx").on(t.investmentId),
    index("investment_payouts_date_idx").on(t.dateKey),
  ],
);

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export const schema = {
  accounts,
  categories,
  recurringRules,
  transactions,
  transactionSplits,
  people,
  tags,
  transactionTags,
  attachments,
  budgets,
  budgetCategories,
  titleMemory,
  fxRates,
  investments,
  investmentPayouts,
  investmentSchedule,
  settings,
};

export type Schema = typeof schema;

export type AccountRow = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;
export type CategoryRow = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;
export type TransactionRow = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
export type PersonRow = typeof people.$inferSelect;
export type NewPerson = typeof people.$inferInsert;
export type TagRow = typeof tags.$inferSelect;
export type NewTag = typeof tags.$inferInsert;
export type TransactionTagRow = typeof transactionTags.$inferSelect;
export type AttachmentRow = typeof attachments.$inferSelect;
export type NewAttachment = typeof attachments.$inferInsert;
export type SplitRow = typeof transactionSplits.$inferSelect;
export type NewSplit = typeof transactionSplits.$inferInsert;
export type RecurringRuleRow = typeof recurringRules.$inferSelect;
export type NewRecurringRule = typeof recurringRules.$inferInsert;
export type BudgetRow = typeof budgets.$inferSelect;
export type NewBudget = typeof budgets.$inferInsert;
export type BudgetCategoryRow = typeof budgetCategories.$inferSelect;
export type TitleMemoryRow = typeof titleMemory.$inferSelect;
export type FxRateRow = typeof fxRates.$inferSelect;
export type SettingRow = typeof settings.$inferSelect;
export type InvestmentRow = typeof investments.$inferSelect;
export type PayoutRow = typeof investmentPayouts.$inferSelect;
export type ScheduleRow = typeof investmentSchedule.$inferSelect;
