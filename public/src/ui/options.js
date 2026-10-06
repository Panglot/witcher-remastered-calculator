// Option rows like the game's options list (OptionListModule, W3SubMenuListItemRenderer): the name
// on the left, the current value right-aligned, and a slider (W3Slider) on the right that picks one
// of a few values. Two choices make the short toggle slider (SubMenuSliderToggle), more the long
// one (SubMenuSlider). Sizes are the game's, in px of the 1920x1080 screen (docs/game-assets.md).
//
// Options are settings.js OPTIONS; `store` reads and writes their values ({ get(key), set(key, value) }).
// An option's `hint` shows as a tooltip on its row, titled with its label; a line of it that starts
// with a choice's name has the name marked (one line per choice: "All highlights ...").
// Pointer: pressing or dragging on a slider picks the nearest choice (CLIK's trackPress and drag);
// a click on a toggle row flips it (activate). Keys: the caller routes them to step().
import { esc } from "./dom.js";

// initToggleSlider: the slider's width, and the margins the thumb's centre stays within. thumbHit
// is the thumb sprite's width, which CLIK's updateThumb centres on the value; the visible bar
// starts 0.6 into it and is thumbWidth wide.
const SLIDERS = {
  list: { width: 296, offsetLeft: 32, offsetRight: 35, thumbHit: 68.1, thumbWidth: 51.3 },
  toggle: { width: 140, offsetLeft: 35, offsetRight: 45, thumbHit: 68.3, thumbWidth: 68.3 }
};
const THUMB_ART = 0.6;
// The track shape spans x -8.1 to 368 around the slider's origin and is 9-sliced, so stretched to
// the slider's width its left edge lands at -8.1 * width / 376.1.
const TRACK = { left: -8.1, width: 376.1 };

const sliderOf = option => SLIDERS[option.choices.length === 2 ? "toggle" : "list"];
const trackLeft = s => TRACK.left * s.width / TRACK.width;
const travel = s => s.width - s.offsetLeft - s.offsetRight;

function indexOf(option, value) {
  return Math.max(0, option.choices.findIndex(c => c.value === value));
}

/** The thumb's left edge in the track box, for choice `i`. */
function thumbX(option, i) {
  const s = sliderOf(option), last = option.choices.length - 1;
  return -trackLeft(s) + s.offsetLeft - s.thumbHit / 2 + THUMB_ART + (last ? i / last : 0) * travel(s);
}

/** The choice nearest to a pointer at clientX over the slider's track box. */
function indexAt(option, box, clientX) {
  const s = sliderOf(option), r = box.getBoundingClientRect(), last = option.choices.length - 1;
  const x = (clientX - r.left) / r.width * s.width + trackLeft(s);
  return Math.max(0, Math.min(last, Math.round((x - s.offsetLeft) / travel(s) * last)));
}

/** One focusable row per option; `variant` is an extra class for every row (side panels' "gopt-inline"). */
export function optionRowsHtml(options, variant = "") {
  return options.map(o => {
    const s = sliderOf(o), toggle = s === SLIDERS.toggle;
    const slider = `<span class="gopt-slider" style="--x:${trackLeft(s).toFixed(2)};--w:${s.width};--tw:${s.thumbWidth}"><span class="gopt-thumb"></span></span>`;
    const hint = o.hint
      ? ` data-hint-title="${esc(o.label)}" data-hint="${esc(o.hint)}" data-hint-terms="${esc(o.choices.map(c => c.label).join("|"))}"`
      : "";
    return `<div class="gopt${toggle ? " toggle" : ""}${variant ? ` ${variant}` : ""}" data-key="${esc(o.key)}" tabindex="0" role="slider"
        aria-label="${esc(o.label)}" aria-valuemin="0" aria-valuemax="${o.choices.length - 1}"${hint}>
      <span class="gopt-label">${esc(o.label)}</span>
      <span class="gopt-value"></span>
      ${slider}
    </div>`;
  }).join("");
}

/**
 * Draws the rows' values and wires the pointer. Returns step(row, by, wrap) for keys: moves the
 * row's choice by `by`, stopping at the ends (CLIK's left / right) or wrapping round (its A button);
 * and redraw(), for when the values changed elsewhere.
 */
export function bindOptionRows(root, options, store) {
  const byKey = Object.fromEntries(options.map(o => [o.key, o]));

  function draw(row) {
    const o = byKey[row.dataset.key], i = indexOf(o, store.get(o.key));
    const value = row.querySelector(".gopt-value");
    value.textContent = o.choices[i].label;
    // An on/off option (offFirst) shows its first choice, off, in grey, as the game does.
    row.classList.toggle("off", !!o.offFirst && i === 0);
    row.querySelector(".gopt-thumb").style.setProperty("--at", thumbX(o, i).toFixed(2));
    row.setAttribute("aria-valuenow", i);
    row.setAttribute("aria-valuetext", o.choices[i].label);
  }

  function choose(row, i) {
    const o = byKey[row.dataset.key];
    if (i === indexOf(o, store.get(o.key))) return;
    store.set(o.key, o.choices[i].value);
    draw(row);
  }

  function step(row, by, wrap = false) {
    const o = row && byKey[row.dataset.key];
    if (!o) return false;
    const n = o.choices.length, i = indexOf(o, store.get(o.key)) + by;
    choose(row, wrap ? (i + n) % n : Math.max(0, Math.min(n - 1, i)));
    return true;
  }

  root.addEventListener("pointerdown", e => {
    const box = e.target.closest(".gopt-slider");
    if (!box || e.button !== 0) return;
    const row = box.closest(".gopt"), o = byKey[row.dataset.key];
    e.preventDefault();
    row.focus({ preventScroll: true });
    choose(row, indexAt(o, box, e.clientX));
    // Dragging keeps picking until the button is let go, wherever the pointer goes.
    box.setPointerCapture(e.pointerId);
    box.classList.add("dragging");
    const move = m => choose(row, indexAt(o, box, m.clientX));
    const end = () => {
      box.classList.remove("dragging");
      box.removeEventListener("pointermove", move);
      box.removeEventListener("lostpointercapture", end);
    };
    box.addEventListener("pointermove", move);
    box.addEventListener("lostpointercapture", end);
  });
  root.addEventListener("click", e => {
    const row = e.target.closest(".gopt.toggle");
    if (row && !e.target.closest(".gopt-slider")) step(row, 1, true);
  });

  const redraw = () => root.querySelectorAll(".gopt[data-key]").forEach(draw);
  redraw();
  return { step, redraw };
}

const ARROW_STEPS = { ArrowLeft: -1, ArrowRight: 1 };

/**
 * Keys for option rows outside the settings menu (side panels), as in the settings: left and right
 * pick, Enter and Space flip. `rows` is what bindOptionRows returned for `root`.
 */
export function bindOptionKeys(root, rows) {
  root.querySelectorAll(".gopt[data-key]").forEach(row => row.addEventListener("keydown", e => {
    const by = ARROW_STEPS[e.key];
    if (by) rows.step(row, by);
    else if (e.key === "Enter" || e.key === " ") rows.step(row, 1, true);
    else return;
    e.preventDefault();
  }));
}
