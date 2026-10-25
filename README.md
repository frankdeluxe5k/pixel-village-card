# Pixel Village Card

A tiny living pixel-art village for your Home Assistant dashboard. Villagers wake up, cook breakfast,
farm, chop wood, haul water, gather round the campfire, throw parties and go to bed, all following
your home's clock, the weather, and the scenes you run.

- **16-bit arcade look.** Chunky outlined sprites, hue-shifted shading, dithered skies, shingled roofs,
  snow-capped mountains, all drawn procedurally at 576×324 in the spirit of Neo Geo / SNES-era art.
- **Single file, zero dependencies.** It's a Lovelace card that runs in the browser showing the
  dashboard, so your Raspberry Pi only serves one ~100 KB file. No add-on, no container, no polling.
- **Efficient.** Scenery and sprites are rendered once and cached; animating costs ≈1 ms per frame at
  ~15 fps, and it stops completely when the card is scrolled off screen or the tab is hidden.
- **Reactive.** Map any entity (scenes, media players, alarm, input booleans…) to a village mood.

## Install

### Manual
1. Copy `pixel-village-card.js` to `/config/www/pixel-village-card.js` on your Pi.
2. **Settings → Dashboards → ⋮ → Resources → Add resource**
   URL `/local/pixel-village-card.js?v=1`, type **JavaScript module**.
   (Bump `?v=` whenever you update the file so browsers pick up the new version.)
3. Edit a dashboard → **Add card** → search "Pixel Village", or use a Manual card with the YAML below.

### HACS
Push this folder to a GitHub repo, then in HACS → ⋮ → **Custom repositories** add it as type
**Dashboard**, and install.

## Minimal config

```yaml
type: custom:pixel-village-card
```

That alone gives you a village that follows the time of day, uses `sun.sun` for sunrise and sunset,
and picks up the first `weather.*` entity it finds.

## Full example

```yaml
type: custom:pixel-village-card
title: Thornbrook
villagers: 6              # 1–10
weather_entity: weather.home
schedule:                 # when the village does what (24h times)
  wake: "06:30"
  work: "08:30"
  lunch: "12:00"
  work_after_lunch: "13:00"
  dinner: "18:00"
  evening: "19:30"
  sleep: "22:30"
triggers:                 # first match wins; these override the schedule
  - entity: alarm_control_panel.home
    state: armed_away
    mode: away
    label: Out adventuring
  - entity: scene.party_time        # scenes: active for `duration` minutes after you run them
    mode: party
    duration: 180
  - entity: scene.movie_night
    mode: movie
    duration: 150
  - entity: scene.goodnight
    mode: sleep
    duration: 480
  - entity: media_player.living_room_tv
    state: playing
    mode: cozy
  - entity: input_boolean.guests
    state: "on"
    mode: party
```

### Moods

| mode      | what happens |
|-----------|--------------|
| `sleep`   | Everyone's in bed, windows dark, little z's float from the houses |
| `morning` | Villagers come out stretching, the cook makes breakfast, smoke from chimneys |
| `work`    | Farmer tends the field, woodcutter chops and hauls logs, water carrier runs to the well, bard busks, kid plays |
| `meal`    | Pot over the fire, everyone sits round eating (breakfast / lunch / dinner text depends on the hour) |
| `evening` | Campfire, chatting, the bard plays, the kid goes to bed early |
| `party`   | Big fire, string lights, dancing in a ring, music notes and hearts |
| `movie`   | Movie night at the amphitheater: the screen rolls down on the stage, the cook makes popcorn, a projector comes out and everyone takes a seat on the tiers. Afterwards the screen rolls back up |
| `cozy`    | Everyone indoors with warm lit windows and smoking chimneys |
| `away`    | Everyone grabs a backpack and walking stick and heads off on an adventure. The last one out hangs a "BACK SOON!" sign on the coffee cart, and the first one home takes it down |

The village also has a little café with umbrella tables and a coffee cart. Villagers stop by for
coffee in the morning and evening, some work on laptops during the day, and the cook takes turns as barista.
On the left there's an amphitheater with a curtained stage, where the bard sometimes plays in the evening,
and the farm sits at the back of the village behind the well.

### Visitors and animals

Alongside the residents, the village gets company:

- **Visitors** wander in by the east road or the west lane, sightsee, grab a coffee, sit by the fire and
  leave again. More turn up for evenings, movie nights and parties; nobody visits at night.
- **The mail carrier** cycles in a few times a day, parks at two or three houses and walks a letter
  (or sometimes a parcel) to the door.
- **A travelling band** (drum, fiddle, accordion and horn) arrives for parties and plays behind the fire.
- **Animals:** two dogs follow their owners and nap by the door at night, a cat lounges about and bolts from
  the dogs, birds flock and peck, and rabbits and squirrels scatter when anyone comes close.

### Options

| option | default | notes |
|---|---|---|
| `villagers` | `6` | 1–10 villagers, each with a job |
| `title` | none | Card header |
| `weather_entity` | first `weather.*` | Set `false` to disable weather. Rain, storms (lightning), snow (snowy roofs and ground), fog and clouds are drawn. Heavy rain sends workers indoors. |
| `sun_entity` | `sun.sun` | Drives dawn, day, dusk, night and the sun's position |
| `schedule` | see above | `"HH:MM"` strings or decimal hours |
| `triggers` | `[]` | List of `{entity, mode, state?, attribute?, duration?, label?}`. `state` can be a string or a list. Without `state`, scene entities match for `duration` minutes (default 120) after activation, and only the most recently activated scene counts. Other entities match `"on"`. |
| `mode_entity` | none | An `input_select`/`input_text` whose state is one of the mode names. Handy for automations. |
| `visitors` | `true` | Visitors, the mail carrier and the party band |
| `animals` | `true` | Dogs, cat, birds, rabbits and squirrels |
| `show_status` | `true` | The one-line caption under the village |
| `fps` | `15` | 2–30 |
| `seed` | `42` | Change it to get a different set of villager looks |

### Driving it from automations

Create an `input_select.village_mode` with options `auto, sleep, morning, work, meal, evening, party, movie, cozy, away`,
set `mode_entity: input_select.village_mode`, and use `input_select.select_option` in any automation.
`auto` (or anything that isn't a mode name) falls back to the schedule.

## Interaction

Tap a villager and they hop and show a heart. Tap the campfire for sparks. Tap a sleeping house and
some z's float out.

## Preview

Open `demo.html` in a browser. It has a time slider, a time-lapse button, scene buttons and weather.
