# HA Companion Village

A Home Assistant Lovelace custom card that draws a living retro pixel-art village. Residents
follow a daily routine, visitors come and go, animals wander, and the whole scene reacts to the time of
day, the weather, the season and whatever is happening in the user's home (scenes, scripts, any entity).
It's meant to be shared and to work across many different Home Assistant setups, not just one.

Repo: `github.com/frankdeluxe5k/pixel-village-card` (public, on HACS). Version 3.0 replaced the old
single-file card (2.x, still in the history up to `43fbd34`) with the modular rewrite from the private
`github.com/frankdeluxe5k/companion-village-card` ("Village 2.0"), merged in with its history. That private
repo is kept for now as a staging copy under the other names (`custom:companion-village-card`) so it can be
previewed next to this one. Commit as `frankdeluxe5k` (`89476351+frankdeluxe5k@users.noreply.github.com`).
Only commit or push when the user asks. Everything pushed is public (commit messages, CLAUDE.md and history
included), so keep it free of real places, named inspirations and anything personal.

The display name is "HA Companion Village". The element type is `custom:pixel-village-card` (editor:
`pixel-village-card-editor`), the file `pixel-village-card.js`, the same as 2.x so existing installs and
dashboards upgrade in place; config options are unchanged from 2.x. The bundle is an IIFE, so none of the
card's top-level names leak into the page. Public text
stays vague about the setting: no real places and no named consoles, games or other inspirations.

## Files and build

- `src/` — the card as ES modules (layout below). No runtime dependencies.
- `build.mjs` (esbuild, the only build dependency): `npm run build` → `dist/pixel-village-card.js` (IIFE,
  es2020, not minified). `npm run build:dev` also writes `dist/pixel-village-card.dev.js` from
  `src/dev.js`, which exposes every module's exports as `window.CompanionVillage` (sprite sheets, route fuzz,
  the demo's event buttons). `npm run watch` rebuilds on change; `npm run check` = dev build + `node --check`.
  `dist/` is not committed.
- `demo.html` — standalone preview (loads the dev build; run `npm run build:dev` first): time slider,
  time-lapse, mood buttons, weather, season, events. Drives the card with a fake `hass` and `card.previewHour`
  / `previewSeason` / `previewWeather` / `previewEvent`.
- `tests/` — `pixel-diff.mjs` and `logic-diff.mjs` (see Testing).
- `README.md` — user docs. `hacs.json` — HACS metadata (Dashboard / `plugin`, minimum HA 2024.11 for
  `getGridOptions`, `filename: pixel-village-card.js`).
- `.github/workflows/validate.yml` (`hacs/action` + `npm ci` + `npm run check`), `release.yml` (publishing a
  GitHub release builds the card and attaches `dist/pixel-village-card.js`, which is what HACS downloads;
  it fails if `src/version.js` doesn't match the tag). Releases are tagged `v<PV_VERSION>`; bump
  `src/version.js` and `package.json` together. HACS also needs the repo public, a repo description, topics
  and issues enabled.
- `LICENSE` (MIT), `images/` (README screenshots, rendered from the demo).

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
  - Land is built by the `buildLandSteps` generator a few ms per frame (`sharedLand(snow, look, budget)`),
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

## Module layout (src/)

Imports run one way: `core` ← `world` ← `art` ← `content/events` ← `ha` ← `editor` / `card` ← `index`. The
plain data files in `content/` (`moods`, `jobs`, `band`, `crew-looks`) import nothing, so anything may use them
(art reads outfits and band colours from there). Keep the graph free of cycles. Only `index.js` has side effects (defining the elements); every other module just declares
things, plus a few one-time setup statements on its own data (house geometry, path smoothing, extra hats).

- `index.js` (element registration, `window.customCards`), `version.js` (`PV_VERSION`), `dev.js` (test build).
- `core/` — knows nothing about the village: `constants.js` (`W H HORIZON S RW RH HZ OUT DEFAULT_FPS`),
  `math.js` (`rand pick pickWeighted clamp01 lerp mulberry32 towardX`), `color.js` (`ramp()`: hue-shifted 5-step ramps,
  `skinRamp`, mixing), `noise.js` (Bayer dither, value noise), `pixels.js` (`mk`, `P` = fillRect, `line`,
  `ellipse`, `fillPoly`, `tpl` char-template sprites, `outline()` selective dark outline, `flipH`, `opaqueBox`),
  `time.js` (`parseHour`, `hourToTime`, `dayKey`, `seasonOf`).
- `world/` — `layout.js`: `HOUSES` (each with its own `base` depth line; derived geometry in `h.g`, `h.door`,
  `h.glass`, `h.lantern`, `h.chimHi`), `PATHS`, fire, well, stump, pond, lamps, screen/amphitheater, farm,
  café, band spots, seats. `nav.js`: `FOOTPRINTS`, `NAV` (path graph), `EVENT_BLOCKS`/`setEventBlocks`,
  `route()` / `freeSpot()` / `blocked()` / `clearPath()` (exact segment-vs-rect test, `segHits`, so paths can't
  clip a corner between samples). Spots no NAV node can see (behind a house, right in front of a cart) detour
  via `CORNERS` (static footprint corners) and `eventCorners`; a route that starts inside a footprint steps
  out to its front first. `spots.js`: `CAT_SPOTS`, `RABBIT_ZONES`, `TREE_BASES`, `birdSpot()`.
- `art/` — procedural drawing; callers cache the results. `villager/` (`frame.js` sprite size/anchor: 49×50,
  anchor x 24, feet row 42, so a full tool swing fits (tools reach 24 px right and 7 px below the feet); keep
  `SW = 2·AX + 1`, since mirroring flips around the canvas,
  `head.js` heads/faces/hair/beards/`HATS`, `anim.js` `KEYS`/`ANIM`/`LIFT`/`ACTION_POSE`/`POSE_TOOL`,
  `body.js` limbs/torso/`drawOutfit`, `tools.js` tools/carried things/instruments, `build.js`
  `buildVillager()` + `buildRider()` for the bicycle), `animals.js` (`animalSprite()`), `foliage.js`
  (`FOLIAGE` palettes, `paintClusters()`, spruce / ponderosa / aspen grove `makeTree(kind, …)`, `SHRUBS`,
  `drawShrub(kind, …)`), `houses.js`, `props.js`, `backdrop.js` (`paintBackdrop`), `land.js`
  (`buildLandSteps` / `buildLand`: terrain, paths, plaza, pond, farm soil, ground decorations, and
  `land.props`, trees and props as separate depth-sorted sprites), `venues.js` (amphitheater, stage, screen
  card and film, café, back farm), `sky.js` (`SKY`, `TINT`, clouds, `glowSprite`), `text.js` (font, `GLYPHS`),
  `palette.js` (shared material ramps), `shared.js` (caches shared by every card: land, houses, party lights).
- `content/` — what lives in the village: `moods.js` (`MODES`, `DEFAULT_SCHEDULE`, `scheduleMode`,
  `DAY_MOODS`), `jobs.js` (`JOBS`, `LOOKS`), `band.js`, `crew-looks.js` (`CREW_LOOKS`), `events/` (one file per
  event, collected in `events/index.js` → `EVENTS`, plus `eventsForDay`, `EVENT_MODES`, `eventOfMode`).
- `ha/` — Home Assistant glue: `weather.js` (`readWeather`, `autoWeather`), `reactions.js` (`reactionKind()`,
  `activatedAt()`, `evalReactions()`), `suggest.js` (`suggestReactions()`), `validate.js` (`validateConfig`).
- `editor/` — `schema.js` (form schemas, labels, helper text, `MODE_OPTIONS`), `editor.js`
  (`CompanionVillageCardEditor`, `loadHaComponents`).
- `card/` — `CompanionVillageCard`. `card.js` holds the class (config, `set hass`, lifecycle, loop, pacing);
  the other methods live in files by concern as plain objects that `card.js` copies onto the prototype
  (non-enumerable, like class methods), so every method still uses `this._…` as before: `world.js`
  (`_initVillage`, time, `_updateMode`, `_onModeChange`), `events.js`, `guests.js` (visitors, mail, band),
  `animals.js`, `plan.js` (`_plan`, `_think`, `_arrive`), `update.js` (simulation step, particles, weather,
  clicks), `render.js` (`_render`, land, static items, sky), `screen.js` (screen, film, projector, console),
  `lights.js` (lights after the tint, `_redrawInFrontOfLights`), `effects.js` (fireflies, particles,
  weather), `sprites.js` (poses, sprite cache, bubbles). A new method goes in the file of its concern; add a
  new file to the list in `card.js` only for a genuinely new concern.

### Where to add things

| Adding | Where |
|---|---|
| A random event | a file in `content/events/` + one line in `events/index.js` (see "Random events") |
| A mood | `content/moods.js` (`MODES`), then its behaviour in `card/plan.js` |
| A resident job / outfit | `content/jobs.js`, behaviour in `card/plan.js` |
| A pose or animation | `art/villager/anim.js` (+ tools in `tools.js`) |
| Another take on an existing pose | `KEYS` + `ANIM` entries and a row in `VARIANTS` (`anim.js`); effects keyed on `v.variant` in `_actionFx` |
| A place in the village | `world/layout.js`, its footprint in `world/nav.js`, its art in `art/` |
| Scenery art | `art/` (a new file for a new kind of thing), cached; never drawn per frame |
| A config option | `ha/validate.js`, `editor/schema.js`, read in `card/` |

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
- Fire square with flagstones, stone-ringed fire pit, benches (`BENCHES`) and two street lamps; pond with lilies. The
  pit and the benches are `FOOTPRINTS`; walkers cross the square through the gap between the back bench and the fire
  (two hub nodes in `NAV`, and square links that would cross a footprint are dropped).
- Farm at the back centre (drawn smaller to read as distance), scarecrow, small haystack at its left end;
  well behind and right of the tavern.
- Café at the front right: brick patio, four umbrella tables with stools, coffee cart (cook is barista).
- Amphitheater at the front left: low turf terraces with fieldstone faces and log benches, painted onto
  the ground (no outline); a small rustic screen panel turned ~45° toward the seats, partly off the left
  edge, on an angled deck; projector behind the back row; bushes hide the deck's left corner.
- Backdrop (`paintBackdrop`, a generator inside `buildLandSteps`), back to front: the far range
  (hazy, jagged ridgelines from asymmetric cones; a flat-topped massif with a sheer east face; faceted
  rock from ridged noise lit from the left, warm granite patches; snow above a ragged snowline, mostly in
  gullies, deeper in winter/spring); a nearer granite range (rock, tundra band, forest below a ragged
  treeline); forested foothills with meadows and four tilted sandstone slabs; a forest edge of
  spruce/fir spires, flat-crowned ponderosa and aspen groves (two rows, gold in fall, bare in winter); the
  meadow. Snow is by altitude only (a ragged snowline per range, tongues down the gullies), never a rim along
  ridgelines; every range has a selective 1 px silhouette outline (a pale rim on sunlit western flanks, a deeper shade of
  the rock on the shaded side; never a flat black line, it grabs the eye). Distant forest is drawn as tidy rows of
  conifer tips (`forestTex`) with a spiky top edge and a clean tundra band above, not random speckle. Layers stop at the next layer's top (trees count from the hill line, not their tips). Each layer
  gets more haze with distance; everything frosts when it snows.
- Foliage: blue spruce, ponderosa pine, aspen groves; Gambel oak, rabbitbrush, juniper, wild rose, sagebrush.
  Snow caps everything when it snows (that's the weather; the seasons never put snow in the village).
- Seasons: US calendar starts (Mar 20 / Jun 21 / Sep 22 / Dec 21, flipped south of the equator via
  `LOOK_STARTS`, all in `core/time.js`), six looks in `SEASON_LOOKS` (`spring-early`, `spring-late`, `summer`, `fall-early`,
  `fall-late`, `winter`) with `snowpack` (how far down the peaks are white; deepest in early spring),
  `leaves` (litter 0-2), `bloom` (wildflowers 0-3), `bare` (deciduous leaves gone), `melt`, `blossom`. Art
  functions take a look key or a plain season name (`lookOf()` maps either); land, trees and shrubs are
  keyed by look, houses by snow + `decorOf()` (`bloom`, `bare`, `harvest` mums/pumpkins/corn shock,
  `winter` evergreens/wreaths/balcony swags from December). Gambel oak is bare until May and holds dry
  brown leaves in late fall; the pond freezes in winter; café umbrellas are furled ('winter'/'bare' decor).
  Fallen leaves are baked into the ground (flat, nothing stands behind them).
- Seasonal chores (`card/plan.js`: `_seasonChore`, work mood; shovelling also in the morning): rake into `LEAF_SPOTS`
  piles (`_piles`, per card, drawn through `_eventItems`; sprites in `art/seasonal.js`), the kid leaps in full piles, fall-early harvest
  (`v.harvested` → pumpkin crate to the tavern), firewood to every door, sowing in spring; with snowy land
  shovelling at each house, the snowman at `SNOWMAN_AT` (`_snowman` 0-3, a block through `_eventBlocks`,
  melts without snow) and snowballs (`_hits` land on the target). Falling leaves are capped particles
  (`_fallingLeaves`). Chimneys smoke all day when it's cold; three birds hide in winter.
- Moods: sleep, morning, work, meal, evening, party (travelling band, string lights, dancing), movie
  (screen rolls down, popcorn, seats on the tiers), gaming (retro games on the screen with wired
  controllers to a console on the deck, handhelds at the café), cozy (everyone indoors), away (backpacks and
  walking sticks, last one out pulls down the amphitheater screen with a "BACK SOON!" card on it,
  `_sign === 2`; the rigger raises it when they're back). In cozy, visitors go into the tavern (gone at its door).
- Events: merchant (led in from the west lane with a mule pulling his cart, parked east of the pond with the mule
  hitched on the east side, away from the pond), salesman (doors), artists (sculpture by the farm, on show
  until bedtime), landscapers (trim shrubs into tidy domes for the day, prune trees from a ladder), fair (tent,
  carousel, ring toss east of the pond, into the evening with lights). About one a day by default.
- People: 9 residents by default (`DEFAULT_VILLAGERS` in `content/jobs.js`: farmer, cook, woodcutter, water
  carrier, bard, kid, handyman, grandmother (`elder`), a second kid; a tenth is a second farmer). Fixed looks
  in `LOOKS.fixed`: the handyman has a shaved head (`HAIR.bald`, no hair at all), a full beard and a beaming smile, burgundy shirt and grey trousers, tool
  belt, with a German Shepherd (dog coat 2: black `saddle`, `prick` ears); the grandmother has a grey `bun`,
  glasses, a cardigan and a long skirt (`skirt: 'long'`) and walks slower. 8 visitors who come
  and go, a mail carrier on a red bicycle (letters or, randomly, parcels), a 4-piece band for parties:
  young garage-rock kids (drums, bass, two guitars; swoopy/spiky hair, tees, flannel, stripes, studded
  belts, white-soled sneakers) playing in front of the tavern, above the string lights over the square.
  Animals: 2 dogs (follow owners, nap at their door), a cat, birds (land only on open ground or roof ridges),
  rabbits, squirrels.
- Café poses (`TABLE_POSES`: sip, laptop, handheld): everyone sits behind a table whose far edge is sprite row FY - 14,
  so hands and anything held stay at FY - 15 or above (a mug resting on the edge), never behind the top;
  children's hands are raised 2 px to match. The table draws the laptop (lid on the pole side, screen facing the
  sitter) and their coffee; laptops only go to table seats, never the cart stools.
- Animation variants (`VARIANTS` in `art/villager/anim.js`): base pose → `[[pose, weight], …]`, default first,
  rarest last (dances: sway/jig/spin; kidplay: hop/twirl; chop: side swing/lean on the axe; farm: dig/weed by
  hand; sweep and rake; cook: season/taste; chat: wave/laugh; idle: shade the eyes/whistle; guitar and bass:
  rock/jump; the kid's ball: kick). `_variantOf` (`card/sprites.js`) picks one per plan, re-picks every 6-12 s
  in long actions (`REROLL`), and never while carrying or wearing a pack. It draws from the villager's own
  `v.vrng` (`mulberry32` of its seed), not `Math.random`. `BASE_POSE` maps a variant back so tools follow
  the base. Keyframes may carry `legs` (`[backOff, backLift, frontOff, frontLift]`, as in the walk), `tool`
  (override, `null` = empty hands) and `turn` (draw the frame mirrored: a spin; `_mirrored(v)` is used for
  drawing, geometry and blinks).
- Handyman (`_handyPlan`): mends fences (`mend` → hammer), firewood, fetch with his own dog, chat. Grandmother
  (`_elderPlan`): knits at the fire seats (`knit`, a sitting pose; also most evenings), scatters seed
  (`feed`; perched birds within reach fly down to peck near her, `a.lured`), waters window boxes (`tend`),
  chats; she sits out parties on the bench and never shovels.
- Two kids play together: `_playmate` + `_invite(o, plan)` (sets `o.invite` and a quick rethink; `_plan`
  hands it out first in work/meal). Catch (`_catchPlan`/`_catchFx`, a shared `game` with `holder`/`next`,
  poses `holdball`/`catchready`, a clear line between them or the game's off) and chase (`_chaseRound`,
  `v.chaseLeft`, the chased one sometimes turns round and becomes the chaser).
- The kid (`_kidPlan`, work and meal): chat, run about (`kidplay`), yo-yo, bounce a ball (or kick it),
  spinning top, fetch or tag with a dog (activity drawn from `v.vrng`). `_freeDog` borrows the nearest dog on
  show; `dog.play = { kid, plan, kind, stage }` takes over from following the owner until the kid's plan
  changes. Fetch: the dog joins, sits beside the kid (`ready`), the kid winds up and throws (`_fetchFx`, a
  `ball` particle), the dog runs to where it lands (`chase`), brings it back in its mouth and sits again. The
  ball is part of the dog's sprite (`animalSprite(…, holding)`, 2 px wider each side so it mirrors in place),
  so the light redraw and depth masks include it. Throws only go where `clearPath` is clear (`_throwTarget`). `_playOver` ends a game as soon as the kid moves on, even
  mid-dash, and a dog holding the ball drops it. Tag runs a few rounds (`v.tagLeft`), the dog at the kid's heels.

## Random events (read before adding one)

`EVENTS` (`content/events/index.js`, one file per event) is the registry; everything else is generated from it:
the schedule (`eventsForDay`: seeded by date + `seed`, a week of history so the same kind never runs on
consecutive days), reaction modes (`event:<kind>` in `REACTION_MODES`/`MODE_OPTIONS`/`validateConfig`),
suggestion words, the editor helper text and the demo's Event buttons. The card side is `_spawnEvents`
(once a second: preview → reaction → schedule; mood/weather gates in `_eventOk`), `_startEvent` (crew from
`_makeGuest(role)`, `instant` placement when the card loads mid-event), `_eventStage`, `_buildEvent`
(setup/packup progress from crew doing `build`), `_eventVisit` (capped onlookers, `plan.onlook`),
`_eventItems` (props join the depth sort), `EVENT_BLOCKS` (temporary footprints `blocked()` checks, per card
but shared like `FOOTPRINTS`; always change it through `setEventBlocks`, which refreshes the flat `eventRects`
list; a card only registers blocks while its loop runs. When blocks appear, anyone standing there re-plans,
anyone walking through re-routes to the same target, and `_arrive` re-plans anyone who lands inside one).
A guest whose plan says "leave" while still off screen is retired in `_think` (`_retireGuest`); otherwise
it stays `active` forever and an event waiting on its crew never ends.

Adding an event:
1. A registry entry (`content/events/<kind>.js`, exported and listed in `events/index.js`; the order there is the
   order of the schedule's weighted draw, so append new ones at the end): label/icon/text, `crew` roles, `weight`, `hours`, `minutes`, `moods`, `suggest` words,
   optional `setupSecs`/`packSecs`, and hooks (`crewPlan` required; `start`, `instant`, `tick`, `visit`,
   `props`, `blocks`, `lights` + `lightRects` (where those lights are, `[x, y, w, h, depth line, tint?]` in px,
   so people in front get redrawn), `keep`). Put spots on open ground off the NAV paths, away from doors and
   benches; reuse `CART_AT`/`SCULPT_AT`/`FAIR_AT` areas or add a constant beside them.
2. Crew looks in `CREW_LOOKS` (outfit pieces drawn by `drawOutfit`; add a piece there for a new garment),
   hats in `HATS`.
3. New poses: `KEYS` + `ANIM` + `ACTION_POSE`; tools via `POSE_TOOL`/`drawTool`/`drawCarry`; particles in
   `_actionFx`; glyphs in `GLYPHS`.
4. Prop art as `make…()` functions in the event's own file (cached with `_eventArt`, never per frame).
5. Lasting changes (like trimmed shrubs) go through per-card overrides, never the shared land props.
6. README events table row. Check with the bench: each stage's screenshot, nobody/no animal inside
   `blocked()` rects, frame time under ~7 ms at 6× throttle, `eventsForDay` counts, real-HA reaction.

## Depth and lighting (read before touching rendering)

Render order in `_render`:
1. Sky (pre-divided by the tint), sun, clouds — then the land layer on top, so the sun, clouds and anything
   in the sky sit behind the mountains.
2. Ground-level details nobody can stand behind (pond sparkle, bunting for now), then depth-sorted items by
   simulation `y`: villagers, animals (non-flying), houses (`y = base + 0.3`), props and trees (`sortY` = their
   ground line), stage (with the screen and its BACK SOON card), tables, projector (with its reels), parked
   bike, console, event props. Every item has `g()` → `[canvas, x, y, mirrored]` (reused per-person records,
   geometry cached per frame) so the light redraw knows what's in front of what.
3. Flying birds, then the night tint (`multiply` over everything).
4. Lights after the tint: windows, lanterns, street lamps, café candles, fire, event lights, party bulbs. Stars
   hidden by the mountains are dropped once (`_visStars`); the cached moon sprite is clipped by `_skyMask`.
5. `_redrawInFrontOfLights`: anyone (villagers and animals) whose sprite overlaps a light rect with them in
   front of its depth line, or who is near the fire (inside its glow after dark, warm tint graded by distance;
   by day only over the flames, untinted) is redrawn on top with the matching tint. Redraws go back to front
   and each one is cut away (`destination-out`) wherever a nearer item that isn't redrawn covers it (opaque
   boxes from `outline()`, `opaqueBox`), so lights never show through people and people never cover benches or
   others in front of them. Props are redrawn too if they could ever stand in front of a light (`lit`, worked
   out once; none do today). Film, handheld glows, fireflies, particles and bubbles come after it.

Rules learned the hard way:
- Never bake something into the ground layer if anything can walk behind it — make it a prop sprite with a
  `sortY`.
- Anything drawn after the tint can paint over sprites in front of it; add it before the redraw and give it a
  rect (like windows, bulbs, `lightRects`), or draw it inside its depth item before the tint (like the reels).
- Animals and birds must only stand in valid spots (`birdSpot`, `freeSpot`, zones); never in the hills,
  never inside a footprint. Roof-perched birds sort just after their house.

## Art direction and preferences

- Retro pixel art: chunky dark outlines, hue-shifted shading, dense detail. Don't make houses or people too
  small (camera was pulled back once, ~15%, and that's the limit).
- Faces: 3/4 head with a jaw and chin, two eyes (white + dark lid pixel + iris colour), brows, shaded nose,
  mouth. Per-person traits from `faceOf(v)` (eye, iris,
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
- Original 192×108, 9 px villagers — replaced by the 3× art pass.
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
- Single round deciduous tree/bush style — replaced by the current conifer, aspen and shrub set.

## Testing

- **Refactors must be pixel-identical.** `npm run build:dev && node tests/pixel-diff.mjs` renders 43 seeded
  scenarios (every mood, season × weather, each event's stages, mood transitions, 1 and 10 villagers, southern
  hemisphere, the real event schedule) with a baseline and with `dist/`, and fails on any differing pixel or
  status line. The benches find the card under either name (`pixel-village-card` or the pre-merge `companion-village-card`), so baselines from before the merge still work. The baseline (`tests/baseline.mjs`) is built from a commit's `src/` (`--base <commit>`, default
  `DEFAULT_BASE`), or is a single-file card from the pre-split history (`--base 0062655:companion-village-card.js`).
  `--only <name>` filters; `--out <dir>` writes base/current/diff PNGs with a count and bounding box. Each
  scenario gets a fresh page with `Math.random` seeded and `performance.now`/`Date` faked, and steps
  `_update`/`_render` directly (`card._running = true`, no loop). Nothing may call `Math.random` at module
  load, or module order would shift the random stream.
  `node tests/logic-diff.mjs` compares the building blocks with the baseline: 3000 routes, `freeSpot`,
  `blocked`, bird spots, a year of `eventsForDay`, seasons, schedule, weather mapping, reactions,
  suggestions, config errors, every pose/frame sprite, animals, foliage, and the editor's DOM and form data
  (with stand-in `ha-form` elements). For an intended change in looks or behaviour, review the diffs
  (`--out`), then move `DEFAULT_BASE` to the commit that made it.
- Other useful checks (scripts not kept): screenshots per mood/time/weather/season; 4× zoomed crops; sprite
  sheets from the dev build (`CompanionVillage.buildVillager`, `animalSprite`, `makeTree`, `drawShrub`); mood
  transitions; "walls" (sample walking villagers, assert `!blocked(x, y)`); animal validity (nobody above
  `HORIZON + 3` or inside footprints); pixel probes for window/fire overlap; v1 and v2 on one page.
- Animation edge cases (scripts not kept): every pose × frame × job × carry/gear built on an oversized canvas
  to measure how far art really reaches (the canvas must hold it, or tools get clipped); a long simulation
  fuzz over every mood × season × weather × event × 1/6/10 villagers asserting no NaN or off-map positions,
  known poses only, no variant while carrying, dogs never stopped in `blocked()`, dog games released when the
  kid moves on, thrown balls landing on open ground; a night probe that the held ball survives the light redraw.
- Route fuzz: `world/nav.js` imports cleanly in Node (no DOM needed), so fuzz `route()` directly: random
  pairs, check every segment with a fine sample against `FOOTPRINTS` + event rects; expect zero failures.
- Timing: throttle with CDP `Emulation.setCPUThrottlingRate` (6×) and force a flush (`getImageData(0,0,1,1)`)
  when timing `_render`, or you only measure command recording. At the split: ~3 ms by day, ~8 ms party night.
- Playwright 1.49.1 (a devDependency) matches the cached `chromium-1148`.
- Real Home Assistant: `uv venv --python 3.13` + `uv pip install homeassistant pymicro-vad pyspeex-noise`
  (2026.2 worked; without those two the frontend hangs on "Loading data"). Don't use `demo:` (broken deps
  stall `get_services`); use a template weather driven by an `input_text`, plus a few scenes/scripts/helpers;
  dashboard url_paths need a hyphen; onboard via `/api/onboarding/*`, add the resource
  and a dedicated storage dashboard over the websocket API (`/lovelace` redirects to the new Home dashboard
  in 2026). Log the browser in by putting `hassTokens` in localStorage. In edit mode, card changes need the
  dialog's Save; then read back with `lovelace/config`.
- Manual installs live at `/config/www/pixel-village-card.js` (from `dist/`). Bump the resource `?v=` after updates.

## Backlog (agreed, in order)

1. Thicker winter snowcaps on the mountains, like real life (`snowAmt` in `art/backdrop.js`); snow still only
   falls when the weather entity says so.
2. A day context (`core/calendar.js`): season and holidays worked out once per day, with `previewDate`.
3. An `ACTIVITIES` registry (`content/activities/`) replacing the `_plan`
   switch, weighted by mood × job × personality × season/holiday.
4. Villager names and simple personalities (`content/personalities/`, optional `residents:` config): likes
   (movie, gaming, party…) raise activity weights and trigger an excited beat on mood changes.
5. Decor providers: events, holidays and seasons add cached props/lights the same way (`_eventItems` today).
6. A `HOLIDAYS` registry (`content/holidays/`, fixed / nth-weekday / last-weekday / Easter rules), US by
   default, `holidays:` and `custom_holidays:` config for other countries.
