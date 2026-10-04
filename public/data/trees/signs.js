// Signs tree. Positions and icons come from the game files, links from in-game screenshots.
export default {
  name: "Signs",
  color: "var(--signs)",
  dark: "#1c2f4a",
  // Bonus granted per point spent anywhere in this tree.
  passive: { label: "Stamina regen in combat", per: 0.5, unit: "%" },
  // Mutagen colour this tree's skills match, or null.
  mutagen: "blue",

  // game: the game's skill id (icon file). col/row: the game's gridColumn/gridRow, in thirds of a
  // skill step (geralt_skills.xml). root: open without a connected point. verified: text checked in-game.
  // Text and per-rank numbers come from data/skillText.js (generated from the game files), by `game`.
  skills: [
    { id: "s_fra", name: "Far-Reaching Aard", game: "magic_s20", col: 0, row: 0, root: true },
    { id: "s_ma", name: "Melt Armor", game: "magic_s8", col: 3, row: 0, root: true },
    { id: "s_sg", name: "Sustained Glyphs", game: "magic_s42", col: 6, row: 0, root: true },
    { id: "s_es", name: "Exploding Shield", game: "magic_s13", col: 9, row: 0, root: true },
    { id: "s_del", name: "Delusion", game: "magic_s17", col: 12, row: 0, root: true },
    { id: "s_as", name: "Aard Sweep", game: "magic_s1", col: 0, row: 3 },
    { id: "s_fst", name: "Firestream", game: "magic_s28", col: 3, row: 3 },
    { id: "s_mt", name: "Magic Trap", game: "magic_s3", col: 6, row: 3 },
    { id: "s_ash", name: "Active Shield", game: "magic_s4", col: 9, row: 3 },
    { id: "s_pm", name: "Puppetmaster", game: "magic_s31", col: 12, row: 3 },
    { id: "s_scg", name: "Supercharged Glyphs", game: "magic_s11", col: 6, row: 6 },
    { id: "s_sw", name: "Shockwave", game: "magic_s33", col: 3, row: 9 },
    { id: "s_dom", name: "Domination", game: "magic_s19", col: 9, row: 9 },
    { id: "s_cat", name: "Catalyst", game: "magic_s35", col: 3, row: 12 },
    { id: "s_fs", name: "Fortify Signs", game: "magic_s36", col: 9, row: 12 },
    { id: "s_cr", name: "Chain Reaction", game: "magic_s37", col: 6, row: 15 },
    { id: "s_foc", name: "Focus", game: "magic_s38", col: 3, row: 18 },
    { id: "s_sid", name: "Sidestep", game: "magic_s39", col: 9, row: 18 },
    { id: "s_aft", name: "Aftershock", game: "magic_s40", col: 6, row: 21 },
    { id: "s_rsn", name: "Resonance", game: "magic_s41", col: 6, row: 24 }
  ],

  // One-way connections: "a-b" means a point in a opens b (the game lights the line from a).
  // Written from the upper skill down, except that a root opens skills above it too.
  links: [
    "s_fra-s_as", "s_ma-s_fst", "s_sg-s_mt", "s_es-s_ash", "s_del-s_pm", "s_as-s_sw",
    "s_fst-s_sw", "s_mt-s_sw", "s_fst-s_scg", "s_mt-s_scg", "s_ash-s_scg", "s_mt-s_dom",
    "s_ash-s_dom", "s_pm-s_dom", "s_sw-s_cat", "s_scg-s_cat", "s_scg-s_fs", "s_dom-s_fs",
    "s_cat-s_cr", "s_fs-s_cr", "s_cat-s_foc", "s_fs-s_sid", "s_cr-s_aft", "s_foc-s_aft",
    "s_sid-s_aft", "s_aft-s_rsn"
  ]
};
