// Game rules shared by every tree.
window.W3R_DATA = window.W3R_DATA || { trees: {} };

W3R_DATA.rules = {
  maxRank: 3,
  slotGroups: 4,
  slotsPerGroup: 3,
  // Tab order in the planner. Each id must have a file in data/trees/.
  treeOrder: ["combat", "signs", "alchemy", "general"],
  // Mutagen colours a slot group can hold. "" means no mutagen.
  mutagens: {
    "": "No mutagen",
    red: "Red mutagen",
    blue: "Blue mutagen",
    green: "Green mutagen"
  }
};
