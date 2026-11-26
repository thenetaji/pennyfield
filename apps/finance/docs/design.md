# Pennyfield design rules

The look is calm and premium: one big number per screen, lots of space, white panels on the grey page.

## Building blocks (`@/components/app/surface`)
- `HeroWash` wraps the top of a main screen: a soft accent tint fading into the page.
- `StatHero` is the one big number: caps label, the amount, one grey line under it, and an optional `ChangePill`.
- `Eyebrow` names every block: small caps, letter-spaced, grey. Use it instead of `SectionHeader` and `ListGroup` headers on main screens. An optional `trailing` holds a "View all" link.
- `Panel` is the card: white, 22px radius, soft shadow, no border, `mx-4`. Rows inside are separated by hairlines inset 16px.

## Rules
- One hero number per screen. Everything else is `title2` or smaller.
- Colour: the theme accent for actions and the wash; green (`income`) only for gains and money in; red only for losses and overdue items. No other colours on main screens.
- Primary buttons are solid, full width, `size="lg"`. Secondary actions are text links in the accent colour.
- Panel rows: 16px horizontal padding, at least 56px tall, label on the left and value on the right. Secondary text goes underneath in `subhead`/`secondary`.
- Spacing: 24px between blocks (the `Eyebrow` gives the top gap), 20px page side padding for text and 16px for panels.
- Copy is short and plain ("Invested", "Interest to come"), with no sentences explaining the screen.
- Settings and forms on iOS use native SwiftUI controls from `@expo/ui/swift-ui` (Form, Section, Toggle, Picker). Android keeps the existing `ListGroup`/`ListRow`.
