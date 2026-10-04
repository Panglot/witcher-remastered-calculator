// Page background: the game's Character screen backdrop (docs/game-assets.md, "Backdrop") drawn
// behind every page, fixed to the window and scaled to cover it like the game screen would.
// Until the art loads (or if it fails) the body shows the same fill colour.
import { $ } from "./dom.js";
import { loadArt, DEFAULT_REGION, SCREEN } from "./gameArt.js";
import { createPieces } from "./gamePieces.js";

export function mountBackdrop() {
  const el = $("backdrop");
  const view = { region: DEFAULT_REGION };
  let pieces = null, drawn = null;

  loadArt().then(art => { pieces = createPieces(art); render(); })
    .catch(err => console.warn(`Page backdrop not drawn: ${err.message}`));

  // Redraws only when the region changes; nothing else here depends on the build.
  function render() {
    if (!pieces || drawn === view.region) return;
    drawn = view.region;
    el.innerHTML = `<svg viewBox="0 0 ${SCREEN.w} ${SCREEN.h}" preserveAspectRatio="xMidYMid slice">${pieces.backdrop(view.region)}</svg>`;
  }

  /** Switches the panorama, e.g. to another world's. */
  function setRegion(region) { view.region = region; render(); }

  return { render, setRegion };
}
