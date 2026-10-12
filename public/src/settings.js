// Viewer settings and their copy in localStorage, under their own key so loading or resetting a
// build never changes them; only the menu's "Reset all data" clears them with the build. The key
// is versioned like the build's.
import { HOLD_MS } from "./ui/hold.js";
import { REGIONS } from "./ui/gameArt.js";
import { LOCK_NONE, LOCK_SOFT, LOCK_HARD } from "./core/slotLocks.js";

const SETTINGS_KEY = "w3r-skill-planner-settings-v1";

// Background choices besides a fixed region: a random one on every page load, or a new random one
// every few seconds (ui/backdrop.js).
export const BACKGROUND_RANDOM = "random";
export const BACKGROUND_CYCLE = "cycle";

// Skill descriptions in the tooltip (ui/tooltip.js): the game's current and next level blocks, or
// one text with every rank's numbers and the current one highlighted (core/skillText.js, allRanksParts).
export const SKILL_TEXT_CLASSIC = "classic";
export const SKILL_TEXT_MODERN = "modern";

// Taking out a skill point or a mutation that others need (core/planner.js removePoint,
// core/mutations.js unresearch): refused until those are removed, or removed together with them.
export const REMOVAL_BLOCK = "block";
export const REMOVAL_CASCADE = "cascade";

// The active mutation in the slot panel (ui/slots.js): the game's name and description beside the
// orb, or the orb alone with both in its tooltip.
export const MUTATION_LOOK_CLASSIC = "classic";
export const MUTATION_LOOK_MODERN = "modern";

export function defaultSettings() {
  return {
    // Open accordion sections per side panel: { [panel name]: section ids }. Closed by default.
    openSections: {},
    // How long a skill must be held to learn a point (ui/hold.js); 0 learns it at once.
    holdMs: HOLD_MS,
    // Page background (ui/backdrop.js): a REGIONS id, or BACKGROUND_RANDOM / BACKGROUND_CYCLE.
    background: BACKGROUND_RANDOM,
    // Skill descriptions: SKILL_TEXT_CLASSIC or SKILL_TEXT_MODERN.
    skillText: SKILL_TEXT_CLASSIC,
    // Skill sets panel (ui/skillSets.js): highlight only the skills in every selected set, not in any;
    // and name a skill's sets in its tooltip always, not only the selected ones.
    skillSetsMatchAll: false,
    skillSetsInTooltip: false,
    // How slot locks act (core/slotLocks.js): LOCK_NONE, LOCK_SOFT or LOCK_HARD.
    slotLocking: LOCK_SOFT,
    // REMOVAL_BLOCK or REMOVAL_CASCADE.
    removal: REMOVAL_CASCADE,
    // MUTATION_LOOK_CLASSIC or MUTATION_LOOK_MODERN.
    mutationLook: MUTATION_LOOK_CLASSIC
  };
}

/**
 * Settings picked from a few fixed values, as the game's options sliders do (ui/options.js): the
 * setting's key, its name and its choices in slider order, left to right. A saved value outside
 * the choices falls back to the default. offFirst: the first choice means off, shown in grey (ui/options.js).
 * @typedef {{ key: string, label: string, choices: { value: any, label: string }[], offFirst?: boolean }} Option
 * @type {Record<string, Option>}
 */
export const OPTIONS = {
  holdMs: {
    key: "holdMs", label: "Skill learn speed",
    choices: [0, 200, 400, 600, 800, 1000].map(ms => ({ value: ms, label: ms ? `${ms} ms` : "Instant" }))
  },
  background: {
    key: "background", label: "Background",
    choices: [
      { value: BACKGROUND_RANDOM, label: "Random" },
      { value: BACKGROUND_CYCLE, label: "Cycle" },
      ...REGIONS.map(r => ({ value: r.id, label: r.label }))
    ]
  },
  skillText: {
    key: "skillText", label: "Skill descriptions",
    hint: "Modern combines all the levels of a skill into one.",
    choices: [{ value: SKILL_TEXT_CLASSIC, label: "Classic" }, { value: SKILL_TEXT_MODERN, label: "Modern" }]
  },
  slotLocking: {
    key: "slotLocking", label: "Slot locking", offFirst: true,
    hint: "Soft locked slots still take skills and mutagens, but display the requirements.\nHard locked slots do not allow slotting, as in the game.",
    choices: [{ value: LOCK_NONE, label: "No locking" }, { value: LOCK_SOFT, label: "Soft" }, { value: LOCK_HARD, label: "Hard" }]
  },
  removal: {
    key: "removal", label: "Skills removal cascade",
    hint: "Off stops you from removing skills that are needed for others.\nOn allows you to remove any skill and skills requiring it will auto remove.",
    choices: [{ value: REMOVAL_BLOCK, label: "Off" }, { value: REMOVAL_CASCADE, label: "On" }]
  },
  mutationLook: {
    key: "mutationLook", label: "Mutation look",
    hint: "Classic shows the active mutation's name and description beside it, as in the game.\nModern shows only the name beside it and the description in its tooltip.",
    choices: [{ value: MUTATION_LOOK_CLASSIC, label: "Classic" }, { value: MUTATION_LOOK_MODERN, label: "Modern" }]
  }
};

const allowed = (k, value) => !OPTIONS[k] || OPTIONS[k].choices.some(c => c.value === value);

export function loadSettings() {
  const settings = defaultSettings();
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "null");
    // Copy only known keys of the right type, so stale or broken fields fall back to defaults.
    if (saved && typeof saved === "object") Object.keys(settings).forEach(k => {
      if (k in saved && typeof saved[k] === typeof settings[k] && allowed(k, saved[k])) settings[k] = saved[k];
    });
  } catch (e) {}
  return settings;
}

/** Deletes the saved settings and resets `settings` in place to the defaults (panels read the object). */
export function clearSavedSettings(settings) {
  try { localStorage.removeItem(SETTINGS_KEY); } catch (e) {}
  Object.keys(settings).forEach(k => { delete settings[k]; });
  Object.assign(settings, defaultSettings());
}

export function saveSettings(settings) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (e) {}
}
