// Viewer settings and their copy in localStorage, under their own key so loading or resetting a
// build never changes them (docs/roadmap.md, item 6). The key is versioned like the build's.
const SETTINGS_KEY = "w3r-skill-planner-settings-v1";

export function defaultSettings() {
  return {
    // Open accordion sections per side panel: { [panel name]: section ids }. Closed by default.
    openSections: {}
  };
}

export function loadSettings() {
  const settings = defaultSettings();
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "null");
    // Copy only known keys of the right type, so stale or broken fields fall back to defaults.
    if (saved && typeof saved === "object") Object.keys(settings).forEach(k => {
      if (k in saved && typeof saved[k] === typeof settings[k]) settings[k] = saved[k];
    });
  } catch (e) {}
  return settings;
}

export function saveSettings(settings) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (e) {}
}
