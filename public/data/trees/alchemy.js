// Alchemy tree. Positions and icons come from the game files, links from in-game screenshots.
export default {
  name: "Alchemy",
  color: "var(--alchemy)",
  dark: "#223a1b",
  // Bonus granted per point spent anywhere in this tree.
  passive: { label: "Potion duration & bomb damage", per: 2, unit: "%" },
  // Mutagen colour this tree's skills match, or null.
  mutagen: "green",

  // game: the game's skill id (icon file). col/row: the game's gridColumn/gridRow, in thirds of a
  // skill step (geralt_skills.xml). root: open without a connected point. verified: text checked in-game.
  // Text and per-rank numbers come from data/skillText.js (generated from the game files), by `game`.
  skills: [
    { id: "a_ref", name: "Refreshment", game: "alchemy_s2", col: 2, row: 0, root: true },
    { id: "a_eff", name: "Efficiency", game: "alchemy_s8", col: 6, row: 0, root: true },
    { id: "a_frz", name: "Frenzy", game: "alchemy_s16", col: 10, row: 0, root: true },
    { id: "a_adp", name: "Adaptability", game: "alchemy_s14", col: 0, row: 3 },
    { id: "a_ep", name: "Endure Pain", game: "alchemy_s20", col: 12, row: 3 },
    { id: "a_pyro", name: "Pyrotechnics", game: "alchemy_s10", col: 2, row: 6 },
    { id: "a_hi", name: "Hunter Instinct", game: "alchemy_s27", col: 6, row: 6 },
    { id: "a_pb", name: "Poisoned Blades", game: "alchemy_s12", col: 10, row: 6 },
    { id: "a_pc", name: "Protective Coating", game: "alchemy_s5", col: 2, row: 9, verified: true },
    { id: "a_at", name: "Acquired Tolerance", game: "alchemy_s18", col: 6, row: 9 },
    { id: "a_tsh", name: "Toxic Shock", game: "alchemy_s23", col: 10, row: 9 },
    { id: "a_tt", name: "Tissue Transmutation", game: "alchemy_s13", col: 6, row: 12 },
    { id: "a_dr", name: "Delayed Recovery", game: "alchemy_s3", col: 4, row: 15 },
    { id: "a_ht", name: "High Tolerance", game: "alchemy_s24", col: 8, row: 15 },
    { id: "a_vc", name: "Volatile Compound", game: "alchemy_s25", col: 2, row: 18 },
    { id: "a_dbp", name: "Debilitating Poison", game: "alchemy_s22", col: 10, row: 18 },
    { id: "a_fm", name: "Fast Metabolism", game: "alchemy_s15", col: 6, row: 21 },
    { id: "a_clb", name: "Cluster Bombs", game: "alchemy_s11", col: 2, row: 24 },
    { id: "a_se", name: "Side Effects", game: "alchemy_s4", col: 6, row: 24 },
    { id: "a_ps", name: "Potent Sting", game: "alchemy_s26", col: 10, row: 24 }
  ],

  // One-way connections: "a-b" means a point in a opens b (the game lights the line from a).
  // Written from the upper skill down, except that a root opens skills above it too.
  links: [
    "a_ref-a_adp", "a_ref-a_pyro", "a_ref-a_hi", "a_eff-a_pyro", "a_eff-a_hi", "a_eff-a_pb",
    "a_frz-a_hi", "a_frz-a_pb", "a_frz-a_ep", "a_adp-a_pyro", "a_ep-a_pb", "a_pyro-a_pc",
    "a_hi-a_at", "a_pb-a_tsh", "a_pc-a_tt", "a_at-a_tt", "a_tsh-a_tt", "a_pc-a_vc",
    "a_tsh-a_dbp", "a_tt-a_dr", "a_tt-a_ht", "a_dr-a_vc", "a_ht-a_dbp", "a_dr-a_fm",
    "a_ht-a_fm", "a_vc-a_clb", "a_fm-a_se", "a_dbp-a_ps"
  ]
};
