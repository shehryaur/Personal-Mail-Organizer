# Design: match Gmail

The demo should look like a feature inside Gmail, not a separate dashboard.
Source of truth: Gmail's 2022+ Material 3 web UI.

## Rules
- **Icons:** Google **Material Symbols Outlined** only (the set Gmail uses), via `<Icon name="…" />`. Filled variant (`fill`) only for active states, like a starred star or a selected nav item. No emoji, no arrow glyphs (→ ↗) in UI text; use an icon.
- **Font:** Google Sans for UI, Roboto as fallback.
- **Color:** the neutral surfaces carry the page. Color only appears as **tonal chips** (light container + dark text), the way Gmail shows labels and categories. No saturated blocks of color behind text.
- **Shape:** pills (`rounded-full`) for chips and nav items, `rounded-2xl` for the main surface, 1px `#e0e2ec`-style dividers, no heavy shadows.

## Tokens (`src/theme.ts`)
| Role | Hex | Where Gmail uses it |
|---|---|---|
| Page background | `#f6f8fc` | Behind nav and mail surface |
| Surface | `#ffffff` | Mail list / reading pane |
| Row hover | `#f2f6fc` | List row hover |
| Nav selected | `#d3e3fd` / text `#041e49` | Active folder pill |
| Compose | `#c2e7ff` / text `#001d35` | Compose button |
| Primary | `#0b57d0` | Links, primary buttons, focus |
| Text | `#1f1f1f` / `#444746` / `#747775` | Primary / secondary / tertiary |
| Outline | `#c4c7c5`, divider `#e0e2ec` | Checkboxes, separators |
| Star | `#f4b400` | Starred |

Tonal pairs (container / on-container):
| Tone | Container | Text | Used for |
|---|---|---|---|
| Red | `#fce8e6` | `#b3261e` | Due within 48h, rejected |
| Yellow | `#fef7e0` | `#b06000` | Assessment, due this week, ghosted |
| Blue | `#d3e3fd` | `#0b57d0` | Interview, in progress |
| Green | `#e6f4ea` | `#137333` | Offer, guardrail kept it |
| Grey | `#f1f3f4` | `#444746` | Applied, closed |
| Purple | `#e8def8` | `#6750a4` | Needs review |

## Icons used
`menu` `search` `tune` `help` `settings` `apps` `edit` `work` `inbox` `star` `error` `schedule` `send` `draft`
`chevron_right` `expand_more` `arrow_back` `arrow_forward` `archive` `delete` `more_vert` `refresh`
`check_box` `check_box_outline_blank` `check` `check_circle` `close` `content_copy` `mail` `flag` `reply` `forward`
`auto_awesome` (AI) `code` (rule) `verified_user` (guardrail) `person_off` (ghosted) `hourglass_top` (in progress) `open_in_new`
