# Changelog

All notable changes to Finance. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## 0.6.0 update - 2026-11-11 (2)

### Changed
- **Groups are back** as an optional field under Business in Edit category. Insights has both breakdowns again: Groups (like Essentials and Lifestyle) and Business / personal.
- The Home Business card covers the last 3 months, so a payout and the costs it paid for land in the same window instead of making one month look negative. It also shows this month's combined spending, personal and business.
- The Home hero reads "Personal spending" once you have business entries, so it's clear business costs are in the Business card.
- The add sheet shows applied tags on the Tags chip, which now sits next to Account. Tags in the picker are larger.

### Fixed
- Applying a tag no longer pushes the add sheet's fields up into the header.

## 0.6.0 update - 2026-11-11

### Added
- **Business and personal:** turn on Business for a category (Edit category) and its entries count as business. Flip a single entry with the Business/Personal chip in the add sheet. The chip only shows once a category is marked Business.
- **Business on Home:** the hero shows personal spending only, and a Business card shows this month's money in, money out and profit. Tap it for the Business page: profit, margin, ROI, by month, costs by category and every business entry.

### Changed
- Category groups are replaced by the Business switch. Insights' "Groups" breakdown now splits business from personal.
- Existing `business` tags are converted on update: a category where most entries carry the tag becomes Business. The tags themselves are kept.

## 0.6.0 update - 2026-11-10

### Added
- **Accounts remembered per type:** expenses, income and transfers each open on the account you last used for them, and a transfer opens on your last from/to pair.
- **Count cash / Update balance** on an account: type the real amount and the difference is added as one entry.
- **Profit on tags:** a tag with both income and spending shows revenue, costs, profit, margin and ROI for the month, the year or all time, with a monthly list. Spending in a category called Tax or Income tax is kept out of costs and shown as profit after tax.

## 0.6.0 update - 2026-11-09

### Added
- **More default categories:** Fuel, Rent, EMI & Loans, Insurance, Family and Personal care for spending; Interest and Business for income. Existing installs get the ones they don't have yet.
- Short notes on the category and tag pickers explaining what each is for.

### Changed
- "Memo" is now "Note", and the Title field shows an example.

### Fixed
- Category icons in the add sheet were hard to see in the Ink look.
- Search results and recent searches no longer slide over the search bar.

## [0.6.0] - 2026-11-06

### Added
- **Advanced tab** replaces the Budgets tab, with Budgets, What if, Money map, Monthly recap and Ask.
- **What if:** change your spending, income or a one-off purchase and see your forecast balance for the next year.
- **Money map:** categories as tiles sized by spending. Tap one to see its payees.
- **Monthly recap:** last month's summary, ready to share.
- **Ask** (iPhones with Apple Intelligence): questions about your spending, answered on the phone.
- **Daily spending amount** on Home, after upcoming bills.
- **Quick add:** type "uber 250 card yesterday" to open a filled-in transaction.
- **Widgets:** Home and Lock Screen on iPhone, home screen on Android. Add a Control Center button, an Action Button shortcut or use Siri.
- **Price increase alerts** for regular payments.
- **Hourly pay:** see costs in hours of work.

### Changed
- **New default look:** Ink, with Blue, Teal, Plum and Bronze as alternatives. Charts and icons use shades of your theme colour. Multicolour categories are still in Settings.
- **Fewer icon options:** Solid (default) or Line.
- **About** now shows the app icon and version, with Check for updates, Report a bug and Source code.
- **Larger buttons and switches** throughout, with the selected option filled in your theme colour.
- **Settings** is organised into groups with search, in Calm, Glass or List style.
- **Home and Insights** are reordered and grouped into clearer sections.
- Charts animate when you scroll to them.
- Small fixes can now reach your phone without a new install. The app checks when it opens and applies them the next time you open it. Your financial data isn't sent.

### Fixed
- Adding or editing an account, budget, category or recurring rule, and Search, showed two titles, with the form sliding over the Cancel and Save bar.
- Tapping the amount while typing a name opened the keypad on top of the keyboard, leaving no room for the form.
- Switches turned almost white when on, hiding the thumb in dark mode. They now use iOS green.
- Switches sat above the middle of their row.

## [0.5.2] - 2026-11-05

### Changed
- New default look: duotone icons on graphite tiles with a soft colour accent per category, on the Titanium palette. Installs that never changed their icons or category colours switch over; a look you picked is kept.

## [0.5.1] - 2026-11-05

### Added
- Choose what the line under each transaction shows in Settings → Transaction rows: the memo (or the category when there is none, the default), the category, the category and memo, or the category and account.
- Long-press a transaction to add or edit its memo, change its category, move it to another account, or see every payment to the same merchant.
- The transaction screen shows the memo under the title (tap to edit), how this payment compares with earlier ones to the same merchant, and the category budget it draws on. Category and account open their own screens.
- Activity shows spending per day for the month in view, with the daily average; tap a day to jump to it. Each day header has a bar for that day's spending against the month's biggest day.
- Activity quick filters: Expense, Income, With memo and a minimum amount.
- Home shows the last seven days as bars under the month's spending; tap a day to open it in Activity.
- The Add sheet fills in the last amount when you pick a previous title, suggests earlier memos while you type one, shows what you have spent today, and offers "Add another" after saving.

### Changed
- Insights puts the month-end forecast right under the total and groups the rest of the analyzer together. "More insights" is folded into Insights.
- Cash flow is drawn as money in and money out adding up over the period, with the gap between them shaded.
- Category trends show the change in money by default; tap for the percentage.
- Share bars for categories and merchants all measure against the largest row.
- Budgets on Home are slim bars that read like the forecast.
- The calendar tints each day by how much you spent; the separate heatmap on Home is gone.
- Customize Home moved to Home's top bar.
- Settings starts straight with your settings; the app card at the top is gone (the version is under About).
- Tapping Top categories on Home opens Insights on the same month; "All" under Recent opens the current month in Activity.

### Fixed
- Cash flow drew spending in the accent colour instead of the spending colour.

## [0.5.0] - 2026-11-04

### Added
- Spend analyzer in Insights for the current month: a month-end forecast (what you have spent, bills still due and your everyday pace, against your budget), categories running well above or below their usual level by this day of the month, your patterns over the last three months (busiest weekday, time of day, typical payment) and repeat payments that are not set up yet, which you can track as recurring in one tap.
- Home shows what is left across your accounts, under the spending figures, with each account's balance. Tap it for Accounts. It can be moved or hidden in Settings → Home screen.
- Adding an expense shows what is left in its budget after it, or how far it goes over.
- Merchants: Activity can group the month by merchant, with each one's total, number of payments and average. Searching for a merchant shows the same summary above the results. Tap either for every payment to it.

### Changed
- Home leads with spending: what you spent this month is the big number, with your pace against the budget or last month, the spending curve and a strip for today, your daily average and what is left of the budget (or what you earned, without one).
- A new app icon: a silver receipt with a gold total on graphite, with matching dark, tinted and Android themed versions.
- Settings is easier to scan: colour tiles like iOS Settings, a summary of your entries, accounts and categories, clearer groups, and notes on what the month start and your data choices do.
- Activity puts the month's spent, earned and net above the monthly chart, with a key for the bars and lines, and lists each day as its own card.
- Insights keeps Spent, Earned or Both next to the account and tag filters, in one row.
- A friendlier first screen before your first transaction.

### Removed
- The alternate Rupee app icon.

### Fixed
- Tapping a bar or point on a chart no longer deselects it a moment later. The selection stays until you tap it again or tap elsewhere, and resets when you change period.
- Payments to one merchant written different ways are combined everywhere: "TikHub", "TIKHUB API", "tikhub.io" and "Tikhub Pvt Ltd" are one payee in Activity, Search, Insights and the year in review.

## [0.3.1] - 2026-10-27

### Changed
- Titanium is the default look: graphite and warm white in dark mode, a champagne titanium accent, a light-catching edge on every card, and symbols on brushed-metal tiles.
- Home shows what you spent and earned this month under net worth, in place of "Left this month" and "Safe to spend".

### Fixed
- The category summary card had no side padding, so its figures touched the edges.
- Chart end labels and the scrub read-out were clipped at the right edge on iPhone.

## [0.3.0] - 2026-10-27

### Added
- Home opens on what matters: net worth, what is left this month and how much you can spend per day, with a spending pace curve against last month. Budget status, upcoming bills, top categories and recent entries appear only when there is something to show.
- Budgets show their pace: calm while on track, amber when the period is heading over, red once over, with upcoming bills drawn ahead of time.
- Rollover budgets: carry what is left (or overspent) into the next period.
- Hide amounts: mask every amount in the app with one tap, charts keep their shape.
- Insights: net worth over time (total or by account), cash flow with savings rate, a money flow chart from income to categories and savings, period comparison by category, top payees, and category trends with sparklines.
- Monthly report and a year in review, both shareable as an image with or without amounts.
- Spending calendar with bills due and no-spend days, plus your current and best no-spend streak.

### Changed
- New look. Pick it in Settings → Appearance: System (clean white and black, like Apple's own apps; the new default), Titanium (graphite and brushed metal, made for dark mode) or Paper (the original warm look). Ink is the new default accent; Blue and Titanium join the others.
- Mono by default: categories, icons and charts in shades of grey, told apart by symbol and lightness, with an ink accent. Colour is reserved for money that means something: income, spending and budgets that are over. Prefer colour? Settings → Appearance → Categories → Colour.
- Icons are SF Symbols by default, in ink on neutral tiles. Soft tints, colour tiles (like iOS Settings) and symbols only are in Settings → Appearance → Icon tiles.
- Amounts use SF Pro Rounded, as in Wallet and Fitness.
- Settings opens with a summary card and groups rows into Money, Preferences, Appearance, Privacy and alerts, and Data.
- The Insights tab icon is a bar chart.
- Category rows show their group and how many transactions they hold.

### Fixed
- Editing a category from Insights opened it over an empty Settings screen.
- The category editor's body could slide under its toolbar on iOS.
- Reordering categories snapped rows back and scrolled the list while dragging.
- Finishing a swipe on a category opened it; tapping another row now closes an open swipe first.
- Deleting a category nothing uses asked where to move its transactions; it now deletes at once with Undo.
- Picking a colour in the category editor lagged.

## [0.2.0] - 2026-10-15

### Added
- Pocket money: mark an account you top up from another (for example Cash from Salary) with a refill amount. Home shows what is left, leftover included, with a Refill button that opens the transfer already filled in. After a refill, the next entry opens as an expense on that account.
- Accent colours in Settings → Appearance: Gold, Silver, Slate, Sage and Copper. Silver is the new default.
- New app icon, and a Rupee alternate icon you can pick in Settings → Appearance → App icon.

### Fixed
- Edit sheets for accounts, budgets, recurring rules and categories opened blank on iOS 26.
- The keyboard covered the memo field and the bottom of the add sheet while typing.
