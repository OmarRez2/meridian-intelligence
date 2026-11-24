# Meridian design system

Tokens live in `src/styles/base.css` (`:root`).

## Colour: every colour has one job
| Token | Hex | Role |
|---|---|---|
| `--abyss` | #060f22 | Ground (cyanotype night, deliberately not black) |
| `--prussian` / `--prussian-2` | #0d2142 / #13305c | Surfaces, panels |
| `--chalk` | #e8edf2 | Primary text, neutral data |
| `--haze` / `--haze-dim` | #93a7c2 / #6b7f9c | Secondary text, axes |
| `--brass` | #d4a85a | **Inbound**: suppliers, purchasing, the instrument itself |
| `--glacier` | #8fd8e8 | **Outbound**: customers, demand, sales |
| `--ember` | #ef7a8a | **Risk only**: below reorder, late, records held for review |
| `--demo` | #c9b6ff | Synthetic-data marking. Nothing else uses it |
| good delta | #9fe3c3 | Favourable change in KPI deltas |

## Type
- **Display:** Cormorant Garamond 300/400 (italic 300 for the single brass word in the hero lock-up only).
- **UI and body:** IBM Plex Sans 400/500.
- **Data:** IBM Plex Sans Condensed with tabular figures, for axes, values and KPIs. The hero KPI uses Cormorant with lining tabular numerals.
- **Scale:** perfect fourth (1.333) from 16px; display sizes use `clamp()`.
- **Rules:** sentence case everywhere; no all-caps labels except in the Manifest study, where stencil caps *are* the concept.

## Layout
- **Homepage:** text column on the left third (max 31rem) over an ink wash; the instrument occupies the right two-thirds. On mobile the instrument sits behind and below a darkened text block.
- **Observatory:** a 12-column grid with one hero KPI plus three supporting readings in a ruled strip (no cards). Panels span 4/6/8/12 columns, collapse to 6 at 1100px and to 12 at 760px.
- Hairline rules (`--rule`) separate content; panels use one subtle gradient and a 4px radius.

## Motion
| Moment | Technique | Timing |
|---|---|---|
| Intro | Camera dolly (expo out), rim engraving (shader `uDraw`), network unfolding from the hub (`uWarp` 1→0), letter rise | ~3.2s total, skippable by scroll/wheel/key |
| Chapters | Scroll → Rig keyframes, smoothstep hold between 18% and 82% of each section, critically damped camera (k≈3.2/s) | Continuous |
| Morph | Per-particle delay; turbulence and swirl only during transitions | GPU |
| Dive to Observatory | Particles gather into a ring around the hub, camera plunges, radial veil, workspace assembles outward | ~1.05s + 1.2s |
| Filters and domains | Line tweens (power3.inOut, 0.75s), bar width transitions with 28ms stagger, KPI count-up | User-triggered |
| Reduced motion | Static compositions per chapter, no twinkle, flow or intro; charts update instantly | `prefers-reduced-motion` or `?reduced` |

## Phase-2 additions
- **Status badges** (`statusBadge()`): one pill style per validation status. Lavender for synthetic, dashed haze for illustrative and placeholder, brass for unverified project records. Glacier for reconciled and green for approved are reserved; nothing uses them yet.
- **Page grammar:** breadcrumb, then "0N of 06" (the pages are a real sequence, so they are numbered), display title and standfirst. Sections use a 4/8 split: title and note on the left, content on the right. Every page ends with a large "Next" link and the shared footer.
- **Sky per page:** the homepage owns the instrument at full strength. Overview and directions keep it at 55%, Team at 36%, and the long-reading pages (Insights, Engineering) at 26% and desaturated, so it never crosses body text at full strength. Each route has its own camera angle (`ROUTE_RIGS`).
- **Territory labels:** only in chapter I. They are placed largest-first, and a label that would collide, or fall over the copy column, is skipped for that frame.
- **Layer focus** (`Rig.focus`): in the strata state the raw layers dim and the top lattice brightens, so "order at the top" is visible rather than asserted.
- **Phone composition:** `Rig.shiftY` lifts the instrument into the top half with a view offset, and the chapter copy sits below on a gradient sheet.
- **Motion pause:** a "Pause motion" button in the nav stops the sky, CSS animation and the Journey canvas; the choice is remembered. Reduced motion hides the button and starts still.

## Patterns
- **KPI:** label, value, delta against the like-for-like prior period (e.g. 2016 Jan–May vs 2015 Jan–May), sparkline, and a "?" definition toggle showing the definition, formula and "Proposed definition" status from the metric registry.
- **Reference marks:** no fixed thresholds. Trends draw "Average for the period"; bar lists draw a tick at "Average of the groups shown". Both are computed from the data on screen.
- **Active filters:** removable chips plus "Clear all". Removing a chip moves focus to the next chip or to the year control.
- **Panel:** title, a hint describing what interaction is available, and a Chart/Table toggle (accessible alternative).
- **Cross-filter:** select a bar to filter the whole workspace; select again to clear. Filters that don't apply to a domain are dimmed and explained in the scope line.
- **Drill-down:** select a month on any trend (mouse, or arrows + Enter) to open the month drawer; Escape returns focus.
- **Demo marking:** lavender pill plus plain sentence, on the hero, dial chapter, Observatory header and every KPI definition.
