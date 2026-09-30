// Signs tree. Layout and links are read from in-game screenshots.
window.W3R_DATA = window.W3R_DATA || { trees: {} };

W3R_DATA.trees.signs = {
  name: "Signs",
  color: "var(--signs)",
  dark: "#1c2f4a",
  // Grid spacing in SVG units. col/row on each skill are multiplied by these.
  layout: { colW: 112, rowH: 88 },
  // Bonus granted per point spent anywhere in this tree.
  passive: { label: "Stamina regen in combat", per: 0.5, unit: "%" },
  // Mutagen colour this tree's skills match, or null.
  mutagen: "blue",

  // root: open without a connected point. verified: text checked in-game.
  skills: [
    { id: "s_fra", name: "Far-Reaching Aard", col: 0, row: 0, root: true,
      text: "Increases Aard range by 1 yard." },
    { id: "s_ma", name: "Melt Armor", col: 1, row: 0, root: true,
      text: "Damage dealt by Igni also reduces Armor. Reduction amount increases with skill level. Increases Burn chance by 10%." },
    { id: "s_sg", name: "Sustained Glyphs", col: 2, row: 0, root: true,
      text: "Increases Sign duration by 5 seconds and area of effect by 10%. Increases the number of alternate mode charges by 2 and number of standard mode traps by 1." },
    { id: "s_es", name: "Exploding Shield", col: 3, row: 0, root: true,
      text: "Whenever Quen shield breaks, it pushes enemies back. Push-back strength increases with skill level." },
    { id: "s_del", name: "Delusion", col: 4, row: 0, root: true,
      text: "Target does not move towards Geralt while Axii is being cast. Increases the effectiveness of Axii in conversations." },
    { id: "s_as", name: "Aard Sweep", col: 0, row: 1,
      text: "Alternate Sign mode: Aard strikes down all opponents within a certain radius. Reduces knock-down chance by 21%." },
    { id: "s_fst", name: "Firestream", col: 1, row: 1,
      text: "Emits a continuous stream of fire that damages enemies." },
    { id: "s_mt", name: "Magic Trap", col: 2, row: 1,
      text: "Releases a magic discharge that damages and slows enemies within a 14-yard radius." },
    { id: "s_ash", name: "Active Shield", col: 3, row: 1,
      text: "Creates an active shield. Maintaining and blocking with it drains Stamina by 100%. Damage absorbed by the shield restores Vitality." },
    { id: "s_pm", name: "Puppetmaster", col: 4, row: 1,
      text: "A targeted enemy briefly becomes an ally that deals 20% more damage." },
    { id: "s_scg", name: "Supercharged Glyphs", col: 2, row: 2,
      text: "Enemies under the influence of Yrden lose 10 Vitality or Essence per second. Damage scales with enemy level and Sign intensity." },
    { id: "s_sw", name: "Shockwave", col: 1, row: 3,
      text: "Increases damage dealt by Aard by 1% of current Vitality." },
    { id: "s_dom", name: "Domination", col: 3, row: 3,
      text: "Axii can influence two targets simultaneously, but the effect is 50% weaker." },
    { id: "s_cat", name: "Catalyst", col: 1, row: 4,
      text: "Increases Aard and Igni intensity by 30% against enemies inside Yrden." },
    { id: "s_fs", name: "Fortify Signs", col: 3, row: 4,
      text: "Increases the duration of Yrden, Quen and Axii by 20%." },
    { id: "s_cr", name: "Chain Reaction", col: 2, row: 5,
      text: "Casting a Sign increases the intensity of the next different Sign by 5%. Stacks up to 5 times." },
    { id: "s_foc", name: "Focus", col: 1, row: 6,
      text: "Adrenaline increases Sign intensity by 10% per Adrenaline point." },
    { id: "s_sid", name: "Sidestep", col: 3, row: 6,
      text: "After a successful dodge or roll, reduces the Stamina cost for the next Sign cast by 20%." },
    { id: "s_aft", name: "Aftershock", col: 2, row: 7,
      text: "Casting any Sign deals magic damage within a small radius. Damage increases with skill level and Sign intensity." },
    { id: "s_rsn", name: "Resonance", col: 2, row: 8,
      text: "After casting a Sign, the next three melee attacks deal additional damage equal to 10% of Sign intensity." }
  ],

  // Two-way connections: "a-b" means a point in either opens the other.
  links: [
    "s_fra-s_as", "s_ma-s_fst", "s_sg-s_mt", "s_es-s_ash", "s_del-s_pm", "s_as-s_sw",
    "s_fst-s_sw", "s_mt-s_sw", "s_fst-s_scg", "s_mt-s_scg", "s_ash-s_scg", "s_mt-s_dom",
    "s_ash-s_dom", "s_pm-s_dom", "s_sw-s_cat", "s_scg-s_cat", "s_scg-s_fs", "s_dom-s_fs",
    "s_cat-s_cr", "s_fs-s_cr", "s_cat-s_foc", "s_fs-s_sid", "s_cr-s_aft", "s_foc-s_aft",
    "s_sid-s_aft", "s_aft-s_rsn"
  ]
};
