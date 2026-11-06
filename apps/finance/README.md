# Finance

A local-first expense tracker for iPhone. It has Dime's calm interface plus the depth Dime lacks: title and memo, split transactions, charts and breakdowns, budgets, recurring payments, multiple accounts and currencies.

"Finance" is a working name. The shortlist and how each name was checked are in `docs/SPEC.md` §Name. Renaming means changing `app.json` → `expo.name` and `APP_NAME` in `apps/finance/src/constants/app.ts`.

## Run it on your iPhone

1. Install **Expo Go** from the App Store.
2. On this machine, from the repository root:
   ```sh
   pnpm install
   pnpm dev:finance                                   # same Wi-Fi as the phone
   pnpm --filter finance exec expo start --tunnel     # from anywhere
   ```
3. Scan the QR code with the iPhone Camera.

No Mac and no Apple Developer account are needed for this. Your data stays on the phone, in SQLite. The only thing the app asks the internet for is whether an update exists, which Expo's servers answer and which shares your IP address, platform and app version, never your money data.

**Demo data**: in a dev build, open Settings → About → Load demo data to load six months of realistic entries.

## Updates

JS-only changes can reach installed apps without a new build, using [EAS Update](https://docs.expo.dev/eas-update/introduction/):

```sh
pnpm --filter finance publish:update --message "What changed"
```

This needs a login to the Expo account in `app.json`. Only apps with the same `version` receive an update, so bump `version` and ship a new build whenever native code changes.

If you fork this, change `owner`, `extra.eas.projectId` and `updates.url` in `app.json`, or remove `updates`. Otherwise your builds receive this project's updates.

## What's in v1

| Area | Features |
|---|---|
| Entry | Custom keypad with + and −, title memory (fills category and account), recent categories, title + memo, splits across categories, transfers including cross-currency, repeat rules |
| Activity | Day-grouped ledger, month picker, filters, search by text or amount, swipe to delete (with undo) or duplicate |
| Insights | Category donut, daily/monthly bars with scrubbing, week/month/year/custom periods, category drill-down |
| Budgets | Overall and per-category budgets, weekly/monthly/yearly, with a pace chart |
| Recurring | Rules with an upcoming list, auto-post, post now, skip |
| Accounts | Cash/bank/card, per-account currency, manual exchange rates, reorder, archive |
| Data | CSV export, import from Dime, Cashew or our own CSV |
| Privacy | Face ID lock, app-switcher privacy cover |

## Project

- `docs/SPEC.md`: the product and design contract (screens, data model, tokens, copy).
- `docs/RESEARCH.md`: what users praise and hate in Dime, Cashew and the best trackers.
- `../../docs/CONVENTIONS.md`: engineering rules (studio-wide).
- `../../docs/DEV.md`: commands and repository layout.
- `docs/QA.md`: the screen-by-screen checklist.
- Stack: Expo SDK 57, expo-router with native tabs, TypeScript strict, Uniwind + React Native Reusables, expo-sqlite + Drizzle, Skia charts, Reanimated, FlashList.
- `pnpm verify` (from the root) runs typecheck, lint, tests and the iOS bundle for everything. `pnpm screenshots --app finance` renders every screen in light and dark for review.

## Before the App Store

- A real support address in `FEEDBACK_EMAIL` (`apps/finance/src/constants/app.ts`).
- The final name and app icon.
- The Apple Developer account, then `eas build -p ios` and `eas submit`.

Dime and Cashew are GPL-3.0. They're cloned to `.reference/` (gitignored) for studying UX only; no code from them is used.
