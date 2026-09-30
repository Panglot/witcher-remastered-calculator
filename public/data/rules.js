// Game rules shared by every tree.
export default {
  maxRank: 3,
  slotGroups: 4,
  slotsPerGroup: 3,
  // Tab order in the planner. Each id must be registered in data/index.js.
  treeOrder: ["combat", "signs", "alchemy", "general"],
  // Mutagen colours a slot group can hold. "" means no mutagen.
  mutagens: {
    "": "No mutagen",
    red: "Red mutagen",
    blue: "Blue mutagen",
    green: "Green mutagen"
  }
};
