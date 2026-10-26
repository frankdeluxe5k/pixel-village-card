/*
 * HA Companion Village for Home Assistant
 * A tiny living pixel-art village that follows the time of day, the weather
 * and whatever is happening in your home (scenes, media players, alarm...).
 *
 * Everything is drawn procedurally: no image files, no dependencies.
 * The simulation runs on a 224x126 grid; art is drawn at 3x (672x378) in a
 * retro pixel-art style. Sprites and scenery are rendered once and cached, and
 * the card only animates while it is actually on screen.
 */

// Entry point: the only module with side effects (defines the elements and registers the card).
import { CompanionVillageCard } from './card/card.js';
import { CompanionVillageCardEditor } from './editor/editor.js';
import { PV_VERSION } from './version.js';

if (!customElements.get('companion-village-card-editor')) customElements.define('companion-village-card-editor', CompanionVillageCardEditor);
if (!customElements.get('companion-village-card')) {
  customElements.define('companion-village-card', CompanionVillageCard);
  window.customCards = window.customCards || [];
  window.customCards.push({
    type: 'companion-village-card',
    name: 'HA Companion Village',
    description: 'A tiny pixel-art village that lives along with your home.',
    preview: true,
    documentationURL: 'https://github.com/frankdeluxe5k/companion-village-card',
  });
  console.info(`%c HA-COMPANION-VILLAGE %c v${PV_VERSION} `, 'background:#3f9a50;color:#fff;border-radius:3px 0 0 3px', 'background:#2c3a70;color:#fff;border-radius:0 3px 3px 0');
}
