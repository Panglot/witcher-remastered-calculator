// Combat tree. Positions and icons come from the game files, links from in-game screenshots.
export default {
  name: "Combat",
  color: "var(--combat)",
  dark: "#4a1f1b",
  // Bonus granted per point spent anywhere in this tree.
  passive: { label: "Adrenaline gain", per: 1, unit: "%" },
  // Mutagen colour this tree's skills match, or null.
  mutagen: "red",

  // game: the game's skill id (icon file). col/row: the game's gridColumn/gridRow, in thirds of a
  // skill step (geralt_skills.xml). root: open without a connected point. verified: text checked in-game.
  // Text and per-rank numbers come from data/skillText.js (generated from the game files), by `game`.
  skills: [
    { id: "c_mm", name: "Muscle Memory", game: "sword_s22", col: 3, row: 0, root: true },
    { id: "c_ad", name: "Arrow Deflection", game: "sword_s33", col: 9, row: 0, root: true },
    { id: "c_st", name: "Strength Training", game: "sword_s23", col: 0, row: 3 },
    { id: "c_cb", name: "Cold Blood", game: "sword_s34", col: 12, row: 3 },
    { id: "c_ts", name: "Three Strikes", game: "sword_s24", col: 3, row: 6 },
    { id: "c_res", name: "Resolve", game: "sword_s16", col: 9, row: 6 },
    { id: "c_und", name: "Undying", game: "sword_s18", col: 6, row: 9 },
    { id: "c_crb", name: "Crushing Blow", game: "sword_s25", col: 0, row: 12 },
    { id: "c_rf", name: "Razor Focus", game: "sword_s20", col: 3, row: 12 },
    { id: "c_ff", name: "Fleet-Footed", game: "sword_s36", col: 6, row: 12 },
    { id: "c_lr", name: "Lightning Reflexes", game: "sword_s32", col: 9, row: 12 },
    { id: "c_ak", name: "Anatomical Knowledge", game: "sword_s26", col: 12, row: 12 },
    { id: "c_wh", name: "Whirl", game: "sword_s35", col: 6, row: 15 },
    { id: "c_rend", name: "Rend", game: "sword_s2", col: 3, row: 18 },
    { id: "c_ca", name: "Counterattack", game: "sword_s31", col: 9, row: 18 },
    { id: "c_sa", name: "Sunder Armor", game: "sword_s28", col: 0, row: 21 },
    { id: "c_cs", name: "Crippling Strike", game: "sword_s29", col: 6, row: 21 },
    { id: "c_ms", name: "Maiming Shot", game: "sword_s27", col: 12, row: 21 },
    { id: "c_dp", name: "Deadly Precision", game: "sword_s30", col: 3, row: 24 },
    { id: "c_foa", name: "Flood of Anger", game: "sword_s19", col: 9, row: 24 }
  ],

  // One-way connections: "a-b" means a point in a opens b (the game lights the line from a).
  // Written from the upper skill down, except that a root opens skills above it too.
  links: [
    "c_mm-c_st", "c_mm-c_ts", "c_st-c_ts", "c_st-c_crb", "c_ad-c_cb", "c_ad-c_res",
    "c_cb-c_res", "c_cb-c_ak", "c_ts-c_und", "c_res-c_und", "c_ts-c_rf", "c_res-c_lr",
    "c_und-c_ff", "c_ff-c_wh", "c_crb-c_rend", "c_rf-c_rend", "c_wh-c_rend", "c_wh-c_ca",
    "c_lr-c_ca", "c_ak-c_ca", "c_crb-c_sa", "c_ak-c_ms", "c_wh-c_cs", "c_rend-c_dp",
    "c_cs-c_dp", "c_cs-c_foa", "c_ca-c_foa"
  ]
};
