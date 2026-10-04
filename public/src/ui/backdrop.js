// Page background: the game's Character screen backdrop (docs/game-assets.md, "Backdrop") drawn
// behind every page, fixed to the window and scaled to cover it like the game screen would.
// Until the art loads (or if it fails) the body shows the same fill colour.
//
// The panorama follows the "background" setting (settings.js): a fixed region, a random one picked
// on every page load, or a new random one every CYCLE_MS. A new panorama fades in over the old one
// once its image has loaded.
import { $ } from "./dom.js";
import { artUrl, loadArt, REGIONS, SCREEN } from "./gameArt.js";
import { createPieces } from "./gamePieces.js";
import { BACKGROUND_CYCLE } from "../settings.js";

const CYCLE_MS = 15000;
const REGION_IDS = REGIONS.map(r => r.id);

/** A random region other than `current` (any region if there is no current one). */
function randomRegion(current) {
  const pool = REGION_IDS.filter(id => id !== current);
  return pool[Math.floor(Math.random() * pool.length)];
}

export function mountBackdrop(app) {
  const el = $("backdrop");
  // The region shown, the setting last applied, and the cycle timer while that is "cycle".
  const view = { region: null, applied: null, timer: null };
  let pieces = null, drawn = null;

  loadArt().then(art => { pieces = createPieces(art); render(); })
    .catch(err => console.warn(`Page backdrop not drawn: ${err.message}`));

  // Picks the region for a changed setting: the region itself, or a new random one for "random"
  // and on starting "cycle" from nothing. Starting "cycle" keeps the region shown until its first tick.
  function applySetting() {
    const choice = app.settings.background;
    if (choice === view.applied) return;
    view.applied = choice;
    clearInterval(view.timer);
    view.timer = null;
    if (REGION_IDS.includes(choice)) view.region = choice;
    else if (choice !== BACKGROUND_CYCLE || !view.region) view.region = randomRegion(view.region);
    if (choice === BACKGROUND_CYCLE) view.timer = setInterval(() => setRegion(randomRegion(view.region)), CYCLE_MS);
  }

  // Redraws only when the region changes; nothing else here depends on the build.
  function render() {
    applySetting();
    if (!pieces || drawn === view.region) return;
    drawn = view.region;
    const old = el.lastElementChild;
    el.insertAdjacentHTML("beforeend", `<svg viewBox="0 0 ${SCREEN.w} ${SCREEN.h}" preserveAspectRatio="xMidYMid slice">${pieces.backdrop(view.region)}</svg>`);
    if (old) fadeIn(el.lastElementChild, view.region);
  }

  // Shows `svg` over the panoramas before it once its image is ready, then drops those.
  function fadeIn(svg, region) {
    svg.classList.add("entering");
    const img = new Image();
    img.src = artUrl(`backdrop/panorama-${region}.jpg`);
    img.decode().catch(() => {}).then(() => {
      const dropOlder = () => { while (svg.isConnected && svg.previousElementSibling) svg.previousElementSibling.remove(); };
      svg.addEventListener("transitionend", dropOlder, { once: true });
      svg.getBoundingClientRect();
      svg.classList.remove("entering");
      // No transition (reduced motion) means no transitionend.
      if (parseFloat(getComputedStyle(svg).transitionDuration) === 0) dropOlder();
    });
  }

  /** Switches the panorama, e.g. to another world's. */
  function setRegion(region) { view.region = region; render(); }

  function settingChanged(key) { if (key === "background") render(); }

  return { render, setRegion, settingChanged };
}
