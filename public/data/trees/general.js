// General tree. Positions and icons come from the game files, links from in-game screenshots.
export default {
  name: "General",
  color: "var(--general)",
  dark: "#46331a",
  // Bonus granted per point spent anywhere in this tree.
  passive: { label: "Vitality gain", per: 1, unit: "%" },
  // Mutagen colour this tree's skills match, or null.
  mutagen: null,

  // game: the game's skill id (icon file). col/row: the game's gridColumn/gridRow, in thirds of a
  // skill step (geralt_skills.xml). root: open without a connected point. verified: text checked in-game.
  // midLines: lines end at the skill's vertical middle (the game's corMidHor/midCorHor overrides).
  skills: [
    { id: "g_cat", name: "Cat School Techniques", game: "perk_23", col: 6, row: 0, root: true, verified: true,
      text: "Each piece of Light Armor increases critical hit damage by 8% and Fast Attack damage by 2%." },
    { id: "g_bf", name: "Battle Frenzy", game: "perk_40", col: 0, row: 5,
      text: "Increases critical hit chance by 3% per Adrenaline point available." },
    { id: "g_wolf", name: "Wolf School Techniques", game: "perk_26", col: 6, row: 5, root: true, verified: true,
      text: "Each piece of Medium Armor increases weapon damage by 2% and Sign intensity by 2%." },
    { id: "g_ab", name: "Adrenaline Burst", game: "perk_42", col: 12, row: 5,
      text: "Increases Adrenaline generation by 2% and allows Signs to generate Adrenaline." },
    { id: "g_aibd", name: "Attack Is the Best Defense", game: "perk_31", col: 3, row: 7.5, midLines: true,
      text: "Each successful defensive action generates Adrenaline points. Scales with every skill level." },
    { id: "g_ss", name: "Sun and Stars", game: "perk_38", col: 9, row: 7.5, midLines: true,
      text: "During the day, Vitality regenerates by an additional 10 points per second when Geralt is not in combat. During the night, Stamina regenerates by an additional 1 point per second during combat." },
    { id: "g_sb", name: "Strong Back", game: "perk_35", col: 0, row: 10,
      text: "Increases maximum inventory weight by 20 per rank." },
    { id: "g_bear", name: "Bear School Techniques", game: "perk_25", col: 6, row: 10, root: true, verified: true,
      text: "Each piece of Heavy Armor increases maximum Vitality by 2% and Strong Attack damage by 2%." },
    { id: "g_si", name: "Survival Instinct", game: "perk_30", col: 12, row: 10,
      text: "Increases maximum Vitality by 8%." },
    { id: "g_gou", name: "Gourmand", game: "perk_41", col: 3, row: 12.5, midLines: true,
      text: "Consuming food regenerates Vitality for 5 minutes per rank." },
    { id: "g_am", name: "Anger Management", game: "perk_34", col: 9, row: 12.5, midLines: true,
      text: "Allows casting Signs with Adrenaline points when Stamina is empty. Consumes 2 Adrenaline points per cast." },
    { id: "g_ea", name: "Elemental Attunement", game: "perk_37", col: 0, row: 15,
      text: "Increases non-physical damage (fire, frost, force, magic, poison) by 3%." },
    { id: "g_grif", name: "Griffin School Techniques", game: "perk_24", col: 6, row: 15, root: true, verified: true,
      text: "Each piece of Medium Armor increases Sign intensity by 2% and Stamina regeneration by 0/s.",
      note: "The game shows \"0/s\" at rank 1. Check the value again after investing." },
    { id: "g_syn", name: "Synergy", game: "perk_43", col: 12, row: 15,
      text: "Increases bonuses for mutagens placed in mutagen slots by 10%." },
    { id: "g_eos", name: "Element of Surprise", game: "perk_44", col: 3, row: 17.5, midLines: true,
      text: "Hitting enemies with a bomb increases your melee damage by 10% for 10 seconds." },
    { id: "g_mc", name: "Metabolic Control", game: "perk_33", col: 9, row: 17.5, midLines: true,
      text: "Increases maximum Toxicity by 10." },
    { id: "g_apy", name: "Advanced Pyrotechnics", game: "perk_39", col: 0, row: 20,
      text: "When thrown, bombs have a 10% chance of not being consumed. Grants immunity to damage dealt by the thrown bomb." },
    { id: "g_mant", name: "Manticore School Techniques", game: "perk_27", col: 6, row: 20, root: true, verified: true,
      text: "Each piece of Medium Armor increases sword damage by 2% and bomb damage by 2%." },
    { id: "g_mb", name: "Metabolic Boost", game: "perk_32", col: 12, row: 20,
      text: "Consumes Adrenaline and reduces the Toxicity cost of potions by 10% per Adrenaline point. Does not affect mutagen decoctions." },
    { id: "g_viper", name: "Viper School Techniques", game: "perk_28", col: 6, row: 25, root: true, verified: true,
      text: "Each piece of Medium Armor increases maximum Vitality by 2% and poison damage by 2%." }
  ],

  // One-way connections: "a-b" means a point in a opens b (the game lights the line from a).
  // Written from the upper skill down, except that a root opens skills above it too.
  links: [
    "g_cat-g_bf", "g_cat-g_ab", "g_cat-g_aibd", "g_cat-g_ss", "g_bf-g_sb", "g_ab-g_si",
    "g_wolf-g_aibd", "g_bear-g_aibd", "g_wolf-g_ss", "g_bear-g_ss", "g_aibd-g_sb", "g_ss-g_si",
    "g_sb-g_gou", "g_si-g_am", "g_bear-g_gou", "g_grif-g_gou", "g_bear-g_am", "g_grif-g_am",
    "g_gou-g_ea", "g_am-g_syn", "g_ea-g_apy", "g_syn-g_mb", "g_ea-g_eos", "g_syn-g_mc",
    "g_grif-g_eos", "g_mant-g_eos", "g_grif-g_mc", "g_mant-g_mc", "g_viper-g_eos", "g_viper-g_mc",
    "g_viper-g_apy", "g_viper-g_mb"
  ]
};
