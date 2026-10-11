// Game rules shared by every tree.
export default {
  maxRank: 3,
  slotGroups: 4,
  slotsPerGroup: 3,
  // Total skill points (earned, spent or not) that open each slot, from geralt_skills.xml (5.01,
  // checked 2026-10-11; the same in abilities_plus). The remastered menu compares them with free +
  // spent points, not the level (PlayerAbilityManager.ws, UpdateSkillSlots). sockets: by slot index
  // (group * slotsPerGroup + socket, the game's slotId - 1); mutagens: by group.
  slotUnlocks: {
    sockets: [0, 2, 4, 6, 8, 10, 12, 15, 18, 22, 26, 30],
    mutagens: [2, 9, 16, 28]
  },
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
