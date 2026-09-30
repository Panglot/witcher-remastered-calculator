// General tree. Layout and links are read from in-game screenshots.
window.W3R_DATA = window.W3R_DATA || { trees: {} };

W3R_DATA.trees.general = {
  name: "General",
  color: "var(--general)",
  dark: "#46331a",
  // Grid spacing in SVG units. col/row on each skill are multiplied by these.
  layout: { colW: 112, rowH: 64 },
  // Bonus granted per point spent anywhere in this tree.
  passive: { label: "Vitality gain", per: 1, unit: "%" },
  // Mutagen colour this tree's skills match, or null.
  mutagen: null,

  // root: open without a connected point. verified: text checked in-game.
  skills: [
    { id: "g_cat", name: "Cat School Techniques", col: 2, row: 0, root: true, verified: true,
      text: "Each piece of Light Armor increases critical hit damage by 8% and Fast Attack damage by 2%." },
    { id: "g_bf", name: "Battle Frenzy", col: 0, row: 2,
      text: "Increases critical hit chance by 3% per Adrenaline point available." },
    { id: "g_wolf", name: "Wolf School Techniques", col: 2, row: 2, root: true, verified: true,
      text: "Each piece of Medium Armor increases weapon damage by 2% and Sign intensity by 2%." },
    { id: "g_ab", name: "Adrenaline Burst", col: 4, row: 2,
      text: "Increases Adrenaline generation by 2% and allows Signs to generate Adrenaline." },
    { id: "g_aibd", name: "Attack Is the Best Defense", col: 1, row: 3,
      text: "Each successful defensive action generates Adrenaline points. Scales with every skill level." },
    { id: "g_ss", name: "Sun and Stars", col: 3, row: 3,
      text: "During the day, Vitality regenerates by an additional 10 points per second when Geralt is not in combat. During the night, Stamina regenerates by an additional 1 point per second during combat." },
    { id: "g_sb", name: "Strong Back", col: 0, row: 4,
      text: "Increases maximum inventory weight by 20 per rank." },
    { id: "g_bear", name: "Bear School Techniques", col: 2, row: 4, root: true, verified: true,
      text: "Each piece of Heavy Armor increases maximum Vitality by 2% and Strong Attack damage by 2%." },
    { id: "g_si", name: "Survival Instinct", col: 4, row: 4,
      text: "Increases maximum Vitality by 8%." },
    { id: "g_gou", name: "Gourmand", col: 1, row: 5,
      text: "Consuming food regenerates Vitality for 5 minutes per rank." },
    { id: "g_am", name: "Anger Management", col: 3, row: 5,
      text: "Allows casting Signs with Adrenaline points when Stamina is empty. Consumes 2 Adrenaline points per cast." },
    { id: "g_ea", name: "Elemental Attunement", col: 0, row: 6,
      text: "Increases non-physical damage (fire, frost, force, magic, poison) by 3%." },
    { id: "g_grif", name: "Griffin School Techniques", col: 2, row: 6, root: true, verified: true,
      text: "Each piece of Medium Armor increases Sign intensity by 2% and Stamina regeneration by 0/s.",
      note: "The game shows \"0/s\" at rank 1. Check the value again after investing." },
    { id: "g_syn", name: "Synergy", col: 4, row: 6,
      text: "Increases bonuses for mutagens placed in mutagen slots by 10%." },
    { id: "g_eos", name: "Element of Surprise", col: 1, row: 7,
      text: "Hitting enemies with a bomb increases your melee damage by 10% for 10 seconds." },
    { id: "g_mc", name: "Metabolic Control", col: 3, row: 7,
      text: "Increases maximum Toxicity by 10." },
    { id: "g_apy", name: "Advanced Pyrotechnics", col: 0, row: 8,
      text: "When thrown, bombs have a 10% chance of not being consumed. Grants immunity to damage dealt by the thrown bomb." },
    { id: "g_mant", name: "Manticore School Techniques", col: 2, row: 8, root: true, verified: true,
      text: "Each piece of Medium Armor increases sword damage by 2% and bomb damage by 2%." },
    { id: "g_mb", name: "Metabolic Boost", col: 4, row: 8,
      text: "Consumes Adrenaline and reduces the Toxicity cost of potions by 10% per Adrenaline point. Does not affect mutagen decoctions." },
    { id: "g_viper", name: "Viper School Techniques", col: 2, row: 10, root: true, verified: true,
      text: "Each piece of Medium Armor increases maximum Vitality by 2% and poison damage by 2%." }
  ],

  // Two-way connections: "a-b" means a point in either opens the other.
  links: [
    "g_cat-g_bf", "g_cat-g_ab", "g_cat-g_aibd", "g_cat-g_ss", "g_bf-g_sb", "g_ab-g_si",
    "g_aibd-g_wolf", "g_aibd-g_bear", "g_ss-g_wolf", "g_ss-g_bear", "g_aibd-g_sb", "g_ss-g_si",
    "g_sb-g_gou", "g_si-g_am", "g_gou-g_bear", "g_gou-g_grif", "g_am-g_bear", "g_am-g_grif",
    "g_gou-g_ea", "g_am-g_syn", "g_ea-g_apy", "g_syn-g_mb", "g_ea-g_eos", "g_syn-g_mc",
    "g_eos-g_grif", "g_eos-g_mant", "g_mc-g_grif", "g_mc-g_mant", "g_eos-g_viper", "g_mc-g_viper",
    "g_apy-g_viper", "g_mb-g_viper"
  ]
};
