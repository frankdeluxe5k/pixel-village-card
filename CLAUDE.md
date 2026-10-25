# Pixel Village Card

A Home Assistant Lovelace custom card that draws a living 16-bit pixel-art mountain village. Residents
follow a daily routine, visitors come and go, animals wander, and the whole scene reacts to the time of
day, the weather, the season and whatever is happening in the user's home (scenes, scripts, any entity).
It's meant to be shared and to work across many different Home Assistant setups, not just one.

Repo: `github.com/frankdeluxe5k/pixel-village-card` (private; going public for HACS). Commit as `frankdeluxe5k`
(`89476351+frankdeluxe5k@users.noreply.github.com`). Only commit or push when the user asks.

## Files

- `pixel-village-card.js` — the whole card, one file, no dependencies, no build step. Classic script (not a
  module), so top-level functions are globals (handy in browser tests).
- `demo.html` — standalone preview: time slider, time-lapse, mood buttons, weather, season. Drives the card
  with a fake `hass` and `card.previewHour` / `card.previewSeason`. Also published as a claude.ai artifact.
- `README.md` — user docs (install, editor, reaction conditions, YAML, moods, options).
- `hacs.json` — HACS metadata (type Dashboard / category `plugin`, minimum HA 2024.11 for `getGridOptions`).
- `LICENSE` (MIT), `images/` (README screenshots, rendered from the demo), `.github/workflows/validate.yml`
  (`hacs/action` + `node --check`). HACS only works with public repos and wants a GitHub release, a repo
  description, topics and issues enabled; keep `PV_VERSION` equal to the release tag.

## Hard requirements

- **Lightweight.** It's shown on dashboards on a Raspberry Pi 5 and old wall tablets. The card runs in the
  browser; HA only serves the file. Measured with CPU throttled 6× (a weak tablet): 2–3 ms/frame by day,
  ~7 ms for a night party; about 6 MB of canvases per card (land/houses/glows shared between cards).
  - Draw sprites/scenery once into offscreen canvases and cache them; per-frame work is mostly `drawImage`.
    Never create gradients, rgba strings or per-pixel `fillRect` loops per frame: glows are cached sprites
    (`glowSprite`), the fire fills colour runs, stars use `globalAlpha`, bunting/sun/moon/fog are cached.
  - Static depth items (houses, props, tables, stage) are pre-sorted once (`_staticItems`) and merged with
    the moving ones each frame; `_poseOf` is cached per frame; café seats are a per-frame map.
  - Left-facing sprites are mirrored at draw time with `setTransform`, not cached twice. Each villager keeps
    at most `SPRITE_CACHE_MAX` sprites; guests drop theirs when they leave.
  - Land is built by the `buildLandSteps` generator a few ms per frame (`sharedLand(snow, season, budget)`),
    shared by all cards, with green and snowy variants both kept. `buildLand()` still builds it in one go.
  - The loop stops when the card is off screen (IntersectionObserver), disconnected or the tab is hidden; a
    loop id guards against duplicate loops. `_pace` drops to 10 fps if frames run long.
- **Home Assistant etiquette.** `set hass` only re-evaluates when an entity the card uses changed
  (`_watched`); listeners are added in `connectedCallback` and removed in `disconnectedCallback`; config
  errors throw clear messages (`validateConfig`); the editor ignores its own echoed config (`_emitted`) so it
  never rebuilds while the user types; time follows `hass.locale.time_zone` ("local" = browser).
- **Depth must be correct.** Anything standing behind something must be drawn behind it. This has been a
  recurring complaint; check it whenever adding art or movement (see "Depth and lighting" below).

## Coordinate systems

- Simulation units: `W = 224`, `H = 126`, `HORIZON = 60`. All positions in logic (villagers, animals,
  paths, house `base`) are in these units.
- Render pixels: everything is drawn at `S = 3` → canvas `RW × RH = 672 × 378`, `HZ = 180`. Layout constants
  for art (`POND`, `LAMPS`, `PATIO`, `CART`, `TABLES`, `FARM`, `SCREEN_Q`, `AMPHI`) are in render pixels;
  check each constant's comment.
- Pixel art rules: diagonals use clean, repeating stairs (the amphitheater uses an exact 2:1 step via
  `stairY`); no anti-aliased shapes (`fillPoly` is a scanline fill; `imageSmoothingEnabled = false`).

## Structure of pixel-village-card.js (in order)

1. **Constants:** moods (`MODES`), schedule, jobs, looks, `HOUSES` (each with its own `base` depth line; derived
   geometry in `h.g`, `h.door`, `h.glass`, `h.lantern`, `h.chimHi`), `PATHS` (village path network), fire,
   well, stump, screen/amphitheater, farm, café, band spots, seats, `FOOTPRINTS`, `NAV` (path graph),
   `route()` / `freeSpot()` / `blocked()`.
2. **Helpers:** seeded RNG, colour ramps (`ramp()`: hue-shifted 5-step ramps), Bayer dither, value noise,
   `P` (fillRect), `line`, `ellipse`, `fillPoly`, `tpl` (char-template sprites), `outline()` (selective dark
   outline), `flipH`.
3. **Villager sprites:** head/hair/hat/beard templates, limbs, torso outfits per job, tools, instruments,
   `KEYS`/`ANIM` keyframe animation tables, `buildVillager()` (+ `buildRider()` for the bicycle).
4. **Animals:** `animalSprite()` (dog, cat, rabbit, squirrel, bird), `CAT_SPOTS`, `RABBIT_ZONES`,
   `TREE_BASES`, `birdSpot()`.
5. **Foliage:** `seasonOf()`, `FOLIAGE` palettes, `paintClusters()`, spruce / ponderosa / aspen grove
   (`makeTree(kind, …)`), `drawShrub(kind, …)`.
6. **Scenery:** houses (`drawHouse`, `makeHouse` → per-house depth sprite), well, woodpile, `buildLand()`
   (terrain, mountains, hills, paths, plaza, pond, farm soil, ground decorations) which also returns
   `land.props` (trees and props as separate depth-sorted sprites), clouds, amphitheater, café, props.
7. **Reactions:** `reactionKind()`, `activatedAt()`, `evalReactions()`, `suggestReactions()`.
8. **Visual editor:** `PixelVillageCardEditor` (custom element `pixel-village-card-editor`).
9. **The card:** `PixelVillageCard` — setup/loop, world state, guests (visitors/mail/band), animal AI,
   villager planning (`_plan`, `_planGuest`, `_planMail`), simulation, rendering.

## How it hooks into Home Assistant

- Standard custom card: `setConfig`, `set hass`, `getCardSize`, `getGridOptions`, `getStubConfig`,
  `getConfigElement`, registered in `window.customCards`.
- Time comes from `hass.config.time_zone`; dawn/day/dusk/night from `sun.sun` (elevation/azimuth/rising).
- Weather from `weather_entity` or the first `weather.*`. `readWeather()` maps every HA condition (sunny,
  clear-night, partlycloudy, cloudy, windy, windy-variant, fog, rainy, pouring, lightning, lightning-rainy,
  hail, snowy, snowy-rainy, exceptional); keep it complete if HA adds conditions.
- **Mood resolution** (`_updateMode`): first matching reaction (`triggers`) → else `mode_entity` (an
  input_select/select whose state is a mood name) → else the daily schedule.
  - Reaction conditions (`when`): `activated` (scenes/buttons/events use their timestamp state,
    scripts/automations `last_triggered`, anything else `last_changed`; `duration` minutes), `on`,
    `state`, `not_state`, `numeric` (`above`/`below`, optional `attribute`).
  - Among `activated` reactions only the newest activation counts, and a newer one cancels older ones even
    after its own duration ends. Never-used scenes/buttons (`unknown`) never count as activated.
  - `mode: auto` = "Daily routine": send the village back to the schedule (e.g. Good morning ends Good night).
  - Old YAML without `when` must keep working (scenes/scripts/buttons → activated, `state:` → state, else on).
- **Visual editor:** built from HA's own `ha-form` + selectors (entity, state with `filter_entity`,
  attribute, time, number, boolean). `loadHaComponents()` forces HA to lazy-load them by asking a built-in
  card for its editor. It emits `config-changed` with cleaned YAML (defaults stripped). Smart default
  condition per entity domain (`defaultKind`), and suggestions from the user's own entities (scene/script
  names like "movie", "goodnight", "gaming"; TVs; alarm panels; `zone.home` people count).
- The user's own mapping: Good Morning → Daily routine, Cinema → Movie night, Lounge → Party,
  Gaming → Game night, Good Night → Night, Away → Adventure.

## The scene (current design)

- Six log-cabin chalets at different depths: low fieldstone footing, log upper walls with notched corners,
  wood-shake roofs with rocks on them, stone chimneys with slate hoods, cream window frames with heart
  shutters, geranium boxes, picket fences, lanterns. The tavern has a balcony, hanging mug sign, barrels.
- Paths: cobbled main road entering from the east edge to the fire square, a cobbled lane up to the
  tavern, dirt paths to each house, a west lane out the left edge, and worn footpaths to the well/farm, café
  and amphitheater. Villagers and animals walk this network (`route()`), never through `FOOTPRINTS`.
- Fire square with flagstones, stone-ringed fire pit, benches and two street lamps; pond with lilies.
- Farm at the back centre (drawn smaller to read as distance), scarecrow, small haystack at its left end;
  well behind and right of the tavern.
- Café at the front right: brick patio, four umbrella tables with stools, coffee cart (cook is barista).
- Amphitheater at the front left: low turf terraces with fieldstone faces and log benches, painted onto
  the ground (no outline); a small rustic screen panel turned ~45° toward the seats, partly off the left
  edge, on an angled deck; projector behind the back row; bushes hide the deck's left corner.
- Foliage themed on the Colorado Front Range: blue spruce, ponderosa pine, aspen groves; Gambel oak,
  rabbitbrush, juniper, wild rose, sagebrush. Seasons follow the real date (aspens gold in fall, bare in
  winter, tawny winter grass); snow caps everything when it snows.
- Moods: sleep, morning, work, meal, evening, party (travelling band, string lights, dancing), movie
  (screen rolls down, popcorn, seats on the tiers), gaming (retro games on the screen with wired
  controllers to a console on the deck, handhelds at the café), cozy (everyone indoors), away (backpacks and
  walking sticks, last one out hangs "BACK SOON!" on the coffee cart).
- Events: merchant (hand cart east of the pond), salesman (doors), artists (sculpture by the farm, on show
  until bedtime), landscapers (trim shrubs into tidy domes for the day, prune trees from a ladder), fair (tent,
  carousel, ring toss east of the pond, into the evening with lights). About one a day by default.
- People: 6 residents by default (farmer, cook, woodcutter, water carrier, bard, kid), 8 visitors who come
  and go, a mail carrier on a red bicycle (letters or, randomly, parcels), a 4-piece band for parties:
  young garage-rock kids (drums, bass, two guitars; swoopy/spiky hair, tees, flannel, stripes, studded
  belts, white-soled sneakers) playing in front of the tavern, above the string lights over the square.
  Animals: 2 dogs (follow owners, nap at their door), a cat, birds (land only on open ground or roof ridges),
  rabbits, squirrels.

## Random events (read before adding one)

`EVENTS` (section "random events" in the card file) is the registry; everything else is generated from it:
the schedule (`eventsForDay`: seeded by date + `seed`, a week of history so the same kind never runs on
consecutive days), reaction modes (`event:<kind>` in `REACTION_MODES`/`MODE_OPTIONS`/`validateConfig`),
suggestion words, the editor helper text and the demo's Event buttons. The card side is `_spawnEvents`
(once a second: preview → reaction → schedule; mood/weather gates in `_eventOk`), `_startEvent` (crew from
`_makeGuest(role)`, `instant` placement when the card loads mid-event), `_eventStage`, `_buildEvent`
(setup/packup progress from crew doing `build`), `_eventVisit` (capped onlookers, `plan.onlook`),
`_eventItems` (props join the depth sort), `EVENT_BLOCKS` (temporary footprints `blocked()` checks; anyone
standing where one appears re-plans, and `_arrive` re-plans anyone who lands inside one).

Adding an event:
1. A registry entry: label/icon/text, `crew` roles, `weight`, `hours`, `minutes`, `moods`, `suggest` words,
   optional `setupSecs`/`packSecs`, and hooks (`crewPlan` required; `start`, `instant`, `tick`, `visit`,
   `props`, `blocks`, `lights`, `keep`). Put spots on open ground off the NAV paths, away from doors and
   benches; reuse `CART_AT`/`SCULPT_AT`/`FAIR_AT` areas or add a constant beside them.
2. Crew looks in `CREW_LOOKS` (outfit pieces drawn by `drawOutfit`; add a piece there for a new garment),
   hats in `HATS`.
3. New poses: `KEYS` + `ANIM` + `ACTION_POSE`; tools via `POSE_TOOL`/`drawTool`/`drawCarry`; particles in
   `_actionFx`; glyphs in `GLYPHS`.
4. Prop art as `make…()` functions in "event props" (cached with `_eventArt`, never per frame).
5. Lasting changes (like trimmed shrubs) go through per-card overrides, never the shared land props.
6. README events table row. Check with the bench: each stage's screenshot, nobody/no animal inside
   `blocked()` rects, frame time under ~7 ms at 6× throttle, `eventsForDay` counts, real-HA reaction.

## Depth and lighting (read before touching rendering)

Render order in `_render`:
1. Sky (pre-divided by the tint), sun, clouds — then the land layer on top, so the sun, clouds and anything
   in the sky sit behind the mountains.
2. Depth-sorted items by simulation `y`: villagers, animals (non-flying), houses (`y = base + 0.3`), props and
   trees (`sortY` = their ground line), stage, tables, sign, parked bike, console.
3. Flying birds, then the night tint (`multiply` over everything).
4. Lights after the tint: windows, lanterns, street lamps, fire, film, party lights. Stars hidden by the
   mountains are dropped once (`_visStars`); the cached moon sprite is clipped by `_skyMask`.
5. `_redrawInFrontOfLights`: anyone (villagers and animals) standing in front of a lit window, lantern,
   lamp or the fire is redrawn on top with the matching tint (warm tint near the fire), so lights never show
   through them.

Rules learned the hard way:
- Never bake something into the ground layer if anything can walk behind it — make it a prop sprite with a
  `sortY`.
- Anything drawn after the tint can paint over sprites in front of it; handle it like windows/fire.
- Animals and birds must only stand in valid spots (`birdSpot`, `freeSpot`, zones); never in the hills,
  never inside a footprint. Roof-perched birds sort just after their house.

## Art direction and preferences

- 16-bit SNES / Neo Geo look, Metal Slug as the influence: chunky dark outlines, hue-shifted shading, dense
  detail. Don't make houses or people too small (camera was pulled back once, ~15%, and that's the limit).
- Faces (Stardew Valley / modern indie as the reference): 3/4 head with a jaw and chin, two eyes (white +
  dark lid pixel + iris colour), brows, shaded nose, mouth. Per-person traits from `faceOf(v)` (eye, iris,
  brow, mouth, nose, blush, freckles, glasses, mustache) drawn by `drawHead`. Skin uses `skinRamp()`, not
  `ramp()` (the hue-shifted ramp turned light skin red). Avoid generic round faces and big cheek spots.
- Characters: chibi, detailed faces/outfits, multi-frame keyframed animations (6-frame walk, 4-frame
  actions, rest/lift/sip rhythms, idle breathing). Animation frames are fine as long as sprites stay cached.
- Mountain-chalet houses; the user likes the stone, the shingle roofs ("thatch"), and the chimneys.
- Clouds: smooth banded shading, no dithering speckle.
- Integrate things into the environment; avoid anything that looks like a sticker slapped on top.
- The user reviews visually and is specific; when they say something looks bad, rebuild it properly rather
  than tweaking.

## Tried and rejected

- A Home Assistant add-on/container — a browser card is lighter; there's no server process.
- Original 192×108, 9 px villagers — replaced by the 16-bit 3× art pass.
- Timber-framed plaster houses, then houses with too much stone on the front — now low stone footing + logs.
- Dithered, rough clouds.
- All houses in a straight row on a straight road; then a uniform S-shaped "squiggle" road. Now a realistic
  path network with depth.
- Movie night with lawn chairs carried from home in the open; then movie night at the café. Now the
  amphitheater.
- Farm on the left front — moved to the back centre.
- Farm and haystack reaching behind the blue house (villagers working there were hidden by its roof) —
  the farm now starts right of that house, a small haystack sits just left of the farm, and the well is
  behind and right of the tavern (brown house). Goal: a tidy village; the clutter comes from people,
  animals and weather.
- Barbershop-quartet band (boaters, fiddle/accordion/horn) standing in line with the string lights —
  replaced by the rock band set back in front of the tavern.
- Amphitheater versions: a big red velvet curtained stage (gaudy); large outlined stone tiers (looked like a
  sticker, overlapped the road); a flat front-facing screen; a first "45°" attempt that only stretched one
  edge taller; uneven diagonals. Now: small rustic panel, sheared toward the seats with 2:1 stairs.
- Single round deciduous tree/bush style — replaced by Front Range species.

## Testing (nothing is checked in; recreate as needed)

- Playwright + Chromium against `demo.html` (`file://`). Useful checks used so far:
  screenshots per mood/time/weather/season; 4× zoomed crops; sprite sheets of poses/animals/foliage
  (`buildVillager`, `animalSprite`, `makeTree`, `drawShrub` are globals); a stress run timing `_render`;
  mood transitions (movie/away flows); "walls" (sample walking villagers, assert `!blocked(x, y)`); animal
  validity (nobody above `HORIZON + 3` or inside footprints); pixel probes for window/fire overlap; the
  reaction engine with fake states (`evalReactions`, `suggestReactions`).
- Deterministic before/after checks: a bench page that seeds `Math.random`, fakes `performance.now`, steps
  `_update` without rendering, then renders one frame — lets you pixel-diff a refactor against the old file.
  Throttle with CDP `Emulation.setCPUThrottlingRate` (6×) and force a flush (`getImageData(0,0,1,1)`) when
  timing `_render`, or you only measure command recording.
- Real Home Assistant: `uv venv --python 3.13` + `uv pip install homeassistant pymicro-vad pyspeex-noise`
  (2026.2 worked; without those two the frontend hangs on "Loading data"). Don't use `demo:` (broken deps
  stall `get_services`); use a template weather driven by an `input_text`, plus a few scenes/scripts/helpers;
  dashboard url_paths need a hyphen; onboard via `/api/onboarding/*`, add the resource
  and a dedicated storage dashboard over the websocket API (`/lovelace` redirects to the new Home dashboard
  in 2026). Log the browser in by putting `hassTokens` in localStorage. In edit mode, card changes need the
  dialog's Save; then read back with `lovelace/config`.
- The card file is at `/config/www/pixel-village-card.js` on the user's Pi; bump the resource `?v=` after
  updates.
