// Game rules shared by every tree.
export default {
  maxRank: 3,
  slotGroups: 4,
  slotsPerGroup: 3,
  // Tab order in the planner. Each id must be registered in data/index.js.
  treeOrder: ["combat", "signs", "alchemy", "general"],
  // Where skill points come from (core/budget.js). Read from the game files (5.0, checked 2026-10-06).
  points: {
    // Levels 2 to 100 give 1 point each: geralt_levelups.xml, GetMaxLevel() in levelManager.ws. NG+ has the same cap.
    maxLevel: 100,
    // 1 point each, the first time (placeOfPowerEntity.ws), per playthrough: 25 in the base game and
    // Hearts of Stone, 5 in Toussaint. Counted in the world files, matches the online guides.
    placesOfPower: 30,
    // Items that give points when used (playerWitcher.ws), once per playthrough.
    items: [{ name: "Imlerith's acorn", points: 2 }, { name: "Golden egg", points: 1 }]
  }
};
