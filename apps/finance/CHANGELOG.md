# Changelog

All notable changes to Finance. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

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
