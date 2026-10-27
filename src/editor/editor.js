// The visual editor (pixel-village-card-editor).
import { DEFAULT_VILLAGERS } from '../content/jobs.js';
import { DEFAULT_SCHEDULE } from '../content/moods.js';
import { DEFAULT_FPS } from '../core/constants.js';
import { hourToTime, parseHour } from '../core/time.js';
import { EDITOR_HELPERS, EDITOR_LABELS, SCHEDULE_FIELDS, cleanReaction, defaultKind, modeInfo, reactionSchema } from './schema.js';
import { reactionKind } from '../ha/reactions.js';
import { suggestReactions } from '../ha/suggest.js';

export let haComponents;
export function loadHaComponents() {
  // ha-form and the pickers are lazy-loaded by Home Assistant; borrowing a built-in card's editor loads them.
  haComponents ||= (async () => {
    if (customElements.get('ha-form') && customElements.get('ha-entity-picker')) return;
    try {
      const helpers = await window.loadCardHelpers?.();
      const card = await helpers?.createCardElement({ type: 'entities', entities: [] });
      await card?.constructor?.getConfigElement?.();
    } catch (e) { /* fall through to waiting */ }
    await Promise.race([customElements.whenDefined('ha-form'), new Promise((r) => setTimeout(r, 4000))]);
    if (!customElements.get('ha-form')) haComponents = null; // try again next time the editor opens
  })();
  return haComponents;
}

export const stableJson = (v) => JSON.stringify(v, (k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.keys(x).sort().map((key) => [key, x[key]])) : x));

export class CompanionVillageCardEditor extends HTMLElement {
  setConfig(config) {
    // HA hands back every config we emit; rebuilding then would steal focus mid-typing.
    if (this._ready && this._emitted && stableJson(config) === this._emitted) return;
    this._config = { ...config, triggers: Array.isArray(config.triggers) ? config.triggers.map((t) => ({ ...t })) : [] };
    if (this._ready) this._refresh();
  }

  set hass(hass) {
    this._hass = hass;
    if (this._ready) {
      for (const f of this.shadowRoot.querySelectorAll('ha-form')) f.hass = hass;
      // suggestions scan every entity: at most every few seconds, not on every state change
      const now = Date.now();
      if (now - (this._suggAt || 0) > 5000) { this._suggAt = now; this._renderSuggestions(); }
    }
  }

  async connectedCallback() {
    if (this._ready) return;
    await loadHaComponents();
    this._ready = true;
    this._build();
  }

  _emit() {
    const c = { ...this._config };
    c.triggers = (c.triggers || []).map(cleanReaction).filter((t) => t.entity && t.mode);
    if (!c.triggers.length) delete c.triggers;
    // weather_entity: false means "no weather" and must survive; only empty values are dropped
    for (const k of ['title', 'weather_entity', 'mode_entity']) if (c[k] === '' || c[k] == null) delete c[k];
    if (c.sun_entity === 'sun.sun' || !c.sun_entity) delete c.sun_entity;
    for (const k of ['visitors', 'animals', 'show_status', 'events']) if (c[k] === true) delete c[k];
    if (c.event_frequency === 'daily' || !c.event_frequency) delete c.event_frequency;
    if (Number(c.fps) === DEFAULT_FPS) delete c.fps;
    if (Number(c.villagers) === DEFAULT_VILLAGERS) delete c.villagers;
    if (c.schedule) {
      const sch = {};
      for (const [k] of SCHEDULE_FIELDS) {
        const v = c.schedule[k], h = v === undefined || v === null || v === '' ? NaN : parseHour(v);
        if (h >= 0 && h < 24 && hourToTime(h) !== hourToTime(DEFAULT_SCHEDULE[k])) sch[k] = hourToTime(h);
      }
      if (Object.keys(sch).length) c.schedule = sch; else delete c.schedule;
    }
    if (c.schedule) this._config.schedule = c.schedule; else delete this._config.schedule;
    this._emitted = stableJson(c);
    this.dispatchEvent(new CustomEvent('config-changed', { detail: { config: c }, bubbles: true, composed: true }));
  }

  _form(schema, data, onChange) {
    if (!customElements.get('ha-form')) {
      const p = document.createElement('p');
      p.className = 'note';
      p.textContent = 'This version of Home Assistant can’t show the visual editor; use the code editor instead.';
      return p;
    }
    const f = document.createElement('ha-form');
    f.hass = this._hass;
    f.schema = schema;
    f.data = data;
    f.computeLabel = (s) => EDITOR_LABELS[s.name] ?? s.name;
    f.computeHelper = (s) => EDITOR_HELPERS[s.name];
    f.addEventListener('value-changed', (ev) => { ev.stopPropagation(); onChange(ev.detail.value, f); });
    return f;
  }

  _section(title, intro) {
    const s = document.createElement('section');
    s.innerHTML = `<h3>${title}</h3>${intro ? `<p class="note">${intro}</p>` : ''}`;
    this._root.appendChild(s);
    return s;
  }

  _build() {
    const root = this.shadowRoot || this.attachShadow({ mode: 'open' });
    root.innerHTML = `
      <style>
        :host { display: block; }
        section { margin-bottom: 20px; }
        h3 { margin: 18px 0 6px; font-size: 15px; font-weight: 500; }
        .note { margin: 0 0 10px; font-size: 13px; color: var(--secondary-text-color); line-height: 1.45; }
        .reaction { border: 1px solid var(--divider-color, #ddd); border-radius: 12px; padding: 8px 12px 12px; margin-bottom: 10px; }
        .rhead { display: flex; align-items: center; gap: 6px; margin-bottom: 4px; }
        .rhead .t { flex: 1; font-weight: 500; font-size: 14px; }
        .rhead .n { color: var(--secondary-text-color); font-size: 12px; }
        button { font: inherit; font-size: 13px; border-radius: 8px; border: 1px solid var(--divider-color, #ccc);
          background: var(--card-background-color, #fff); color: var(--primary-text-color); padding: 6px 10px; cursor: pointer; }
        button.icon { padding: 2px 8px; min-width: 30px; }
        button.primary { background: var(--primary-color); border-color: var(--primary-color); color: var(--text-primary-color, #fff); }
        button:disabled { opacity: 0.4; cursor: default; }
        .row { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
        .sugg { display: flex; align-items: center; gap: 10px; padding: 6px 0; border-top: 1px solid var(--divider-color, #eee); }
        .sugg .what { flex: 1; font-size: 13px; line-height: 1.35; }
        .sugg .what b { font-weight: 500; }
        .sugg .what span { color: var(--secondary-text-color); }
        .empty { font-size: 13px; color: var(--secondary-text-color); padding: 6px 0; }
      </style>
      <div id="root"></div>`;
    this._root = root.getElementById('root');
    const cfg = this._config;

    const gen = this._section('Village');
    gen.appendChild(this._form([
      { name: 'title', selector: { text: {} } },
      { name: 'villagers', selector: { number: { min: 1, max: 10, step: 1, mode: 'slider' } } },
      { type: 'grid', name: '', schema: [
        { name: 'visitors', selector: { boolean: {} } },
        { name: 'animals', selector: { boolean: {} } },
      ] },
      { type: 'grid', name: '', schema: [
        { name: 'events', selector: { boolean: {} } },
        { name: 'event_frequency', selector: { select: { mode: 'dropdown', options: [
          { value: 'rare', label: 'Rarely (a couple a week)' }, { value: 'daily', label: 'About once a day' }, { value: 'often', label: 'Often (a few a day)' },
        ] } } },
      ] },
      { name: 'show_status', selector: { boolean: {} } },
      { name: 'fps', selector: { number: { min: 2, max: 30, step: 1, mode: 'box' } } },
    ], {
      title: cfg.title ?? '', villagers: cfg.villagers ?? DEFAULT_VILLAGERS, visitors: cfg.visitors !== false, animals: cfg.animals !== false,
      events: cfg.events !== false, event_frequency: cfg.event_frequency ?? 'daily',
      show_status: cfg.show_status !== false, fps: cfg.fps ?? 15,
    }, (v) => { Object.assign(this._config, v); this._emit(); }));

    const env = this._section('Surroundings', 'The village follows the sun and the weather. A mood helper lets automations set the mood directly.');
    env.appendChild(this._form([
      { name: 'weather_entity', selector: { entity: { domain: 'weather' } } },
      { name: 'sun_entity', selector: { entity: { domain: 'sun' } } },
      { name: 'mode_entity', selector: { entity: { domain: ['input_select', 'select', 'input_text'] } } },
    ], { weather_entity: cfg.weather_entity || '', sun_entity: cfg.sun_entity ?? 'sun.sun', mode_entity: cfg.mode_entity ?? '' },
    (v) => {
      // weather turned off in YAML (false) shows as an empty picker; keep it off unless one is picked
      if (this._config.weather_entity === false && !v.weather_entity) v = { ...v, weather_entity: false };
      Object.assign(this._config, v); this._emit();
    }));

    const sch = this._section('Daily routine', 'What the villagers do when nothing else is going on.');
    const schData = {};
    for (const [k] of SCHEDULE_FIELDS) schData[k] = `${hourToTime(parseHour(cfg.schedule?.[k] ?? DEFAULT_SCHEDULE[k]))}:00`;
    sch.appendChild(this._form([{ type: 'grid', name: '', schema: SCHEDULE_FIELDS.map(([name]) => ({ name, selector: { time: {} } })) }], schData,
      (v) => { this._config.schedule = { ...v }; this._emit(); }));

    const re = this._section('Reactions', 'Tie anything in your home to a village mood: scenes, scripts, automations, buttons, switches, media players, people, alarms, sensors. The first reaction that matches wins, so put the most important ones on top.');
    this._list = document.createElement('div');
    re.appendChild(this._list);
    const add = document.createElement('div');
    add.className = 'row';
    add.innerHTML = '<button class="primary" id="add">+ Add reaction</button>';
    add.querySelector('#add').onclick = () => {
      this._config.triggers.push({ entity: '', mode: 'party' });
      this._renderList(); this._emit();
    };
    re.appendChild(add);

    const sg = this._section('Suggestions', 'Based on what’s in your Home Assistant. Add the ones you like and tweak them above.');
    this._sugg = document.createElement('div');
    sg.appendChild(this._sugg);

    this._renderList();
    this._renderSuggestions();
  }

  _refresh() {
    // a config change from outside (e.g. the YAML editor): rebuild everything
    this._build();
  }

  _renderList() {
    const list = this._config.triggers;
    this._list.innerHTML = '';
    if (!list.length) this._list.innerHTML = '<div class="empty">No reactions yet — the village just follows its daily routine.</div>';
    list.forEach((t, i) => {
      const box = document.createElement('div');
      box.className = 'reaction';
      const title = () => {
        const st = this._hass?.states?.[t.entity];
        return `${modeInfo(t.mode)?.icon || ''} ${st?.attributes?.friendly_name || t.entity || 'New reaction'}`;
      };
      box.innerHTML = `<div class="rhead"><span class="n">${i + 1}</span><span class="t"></span>
        <button class="icon" data-a="up" title="Move up" ${i === 0 ? 'disabled' : ''}>↑</button>
        <button class="icon" data-a="down" title="Move down" ${i === list.length - 1 ? 'disabled' : ''}>↓</button>
        <button class="icon" data-a="del" title="Remove">✕</button></div>`;
      box.querySelector('.t').textContent = title();
      box.querySelector('[data-a=up]').onclick = () => { [list[i - 1], list[i]] = [list[i], list[i - 1]]; this._renderList(); this._emit(); };
      box.querySelector('[data-a=down]').onclick = () => { [list[i + 1], list[i]] = [list[i], list[i + 1]]; this._renderList(); this._emit(); };
      box.querySelector('[data-a=del]').onclick = () => { list.splice(i, 1); this._renderList(); this._emit(); };
      const data = { ...t, when: reactionKind(t), duration: t.duration ?? 120 };
      const form = this._form(reactionSchema(t), data, (v, f) => {
        const entityChanged = v.entity !== t.entity;
        // another entity's states and attributes don't carry over
        if (entityChanged) v = { ...v, state: v.state === t.state ? undefined : v.state, attribute: v.attribute === t.attribute ? undefined : v.attribute };
        Object.assign(t, v);
        if (entityChanged && !list[i]._whenTouched) t.when = defaultKind(t.entity, this._hass?.states);
        if (v.when !== data.when) list[i]._whenTouched = true;
        Object.keys(t).forEach((k) => { if (t[k] === undefined) delete t[k]; });
        const next = reactionSchema(t);
        if (JSON.stringify(next) !== JSON.stringify(f.schema)) f.schema = next;
        f.data = { ...t, when: reactionKind(t), duration: t.duration ?? 120 };
        Object.assign(data, f.data);
        box.querySelector('.t').textContent = title();
        this._emit();
      });
      box.appendChild(form);
      this._list.appendChild(box);
    });
  }

  _renderSuggestions() {
    if (!this._sugg) return;
    const sugg = suggestReactions(this._hass?.states, this._config.triggers);
    const key = JSON.stringify(sugg.map((s) => s.entity + s.mode));
    if (key === this._suggKey) return;
    this._suggKey = key;
    this._sugg.innerHTML = '';
    if (!sugg.length) { this._sugg.innerHTML = '<div class="empty">Nothing obvious to suggest — add reactions by hand above.</div>'; return; }
    for (const s of sugg) {
      const row = document.createElement('div');
      row.className = 'sugg';
      const st = this._hass.states[s.entity];
      row.innerHTML = `<div class="what"><b></b><br><span></span></div><button>Add</button>`;
      row.querySelector('b').textContent = `${modeInfo(s.mode).icon} ${modeInfo(s.mode).label}`;
      row.querySelector('span').textContent = `${st?.attributes?.friendly_name || s.entity} — ${s.why}`;
      row.querySelector('button').onclick = () => {
        const { why, ...t } = s;
        this._config.triggers.push(t);
        this._suggKey = null;
        this._renderList(); this._renderSuggestions(); this._emit();
      };
      this._sugg.appendChild(row);
    }
    if (sugg.length > 1) {
      const all = document.createElement('div');
      all.className = 'row';
      all.style.marginTop = '8px';
      all.innerHTML = '<button>Add all suggestions</button>';
      all.querySelector('button').onclick = () => {
        for (const { why, ...t } of sugg) this._config.triggers.push(t);
        this._suggKey = null;
        this._renderList(); this._renderSuggestions(); this._emit();
      };
      this._sugg.appendChild(all);
    }
  }
}
