# Creative research

Live research was done with web search in this session, which returned search results rather than full pages. References marked *(knowledge)* come from prior design knowledge and weren't re-verified live.

## References and what they teach

| Reference | What makes it work | Principle taken |
|---|---|---|
| Johann Bayer, *Uranometria* (1603), plates engraved by Alexander Mair: [Linda Hall Library](https://www.lindahall.org/experience/digital-exhibitions/out-of-this-world/09-bayer-s-uranometria-and-its-legacy-1603-1705/), [Atlas Obscura](https://www.atlasobscura.com/articles/the-exquisite-drawings-from-the-first-map-of-the-entire-sky) | Ornament sits on top of a **precise engraved grid**, so readers can read star positions to a fraction of a degree | Beauty must sit on a measurable grid. The planisphere rings and the calendar rim are a real axis, not decoration |
| The planisphere and astrolabe as instruments *(knowledge)* | A rotating dial with a date scale on its rim: time is read by turning | The 48-month rim doubles as the time axis of the dial chart |
| GPU particle morphing with scroll ([three.js forum](https://discourse.threejs.org/t/valicred-kinetic-3d-particle-morphing-webgl-lore-scroller/93787), [Framer MorphField](https://www.framer.com/marketplace/components/particlecloud-scroll/)) | Target positions stored as attributes, blended in the vertex shader with `mix()`, with scroll mapped to one progress value | Implemented in `Sky.ts` with four targets, per-particle delay, and turbulence only *between* states |
| Scrollytelling in data journalism, e.g. NYT, The Pudding, Bloomberg *(knowledge)* | Text and graphic advance together; the graphic holds still while you read | Chapters hold a stable state through the middle of each section (smoothstep 0.18 to 0.82) |
| Product-globe heroes, e.g. Stripe, GitHub *(knowledge)* | Network on a sphere with arcs | **Deliberately avoided.** The globe is now a cliché. We kept arcs but put them on a flat instrument plate |
| Awwwards WebGL / data-viz winners ([Awwwards WebGL tag](https://www.awwwards.com/websites/)) | Search couldn't confirm specific 2026 data-viz Sites of the Day | Not used as a direct reference |
| Observable / Bloomberg terminal-style analytics *(knowledge)* | Dense but calm: thin rules, tabular figures, few colours with fixed meanings | Observatory: rules instead of cards, tabular numerals, colour encodes meaning only |

## Techniques worth avoiding
- Ambient particles with no meaning, which we call "space wallpaper". Every particle here belongs to a state that encodes something.
- Long loading intros. Ours is about 3 seconds, the content is readable within 1.5 seconds, and any scroll, wheel or key skips it.
- Scroll-jacking. The page scrolls natively; only the camera is damped.
- Glassmorphism cards, neon gradients, glowing KPI tiles.
- Motion behind charts. The sky drops to 32% opacity and about 30 fps on analytical pages.

## Conclusions
1. The space idea is strongest when it is about **navigation**, not about outer space: navigators read the sky to move cargo, and that is literally a supply chain metaphor.
2. The spectacle should *be* an analytical object. The dial chart and the strata are data shapes, not backdrops.
3. The analytics workspace should feel like the same instrument at rest: same palette roles, same type, no 3D.
