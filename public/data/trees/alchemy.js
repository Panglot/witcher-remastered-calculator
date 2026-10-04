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
  skills: [
    { id: "a_ref", name: "Refreshment", game: "alchemy_s2", col: 2, row: 0, root: true,
      text: "Each potion dose heals 10% Vitality." },
    { id: "a_eff", name: "Efficiency", game: "alchemy_s8", col: 6, row: 0, root: true,
      text: "Increases the maximum number of bombs in each slot by 1." },
    { id: "a_frz", name: "Frenzy", game: "alchemy_s16", col: 10, row: 0, root: true,
      text: "If potion Toxicity is greater than 1, time automatically slows by 5% when the enemy is about to perform a counterattack." },
    { id: "a_adp", name: "Adaptability", game: "alchemy_s14", col: 0, row: 3,
      text: "Extends the duration of all mutagen decoctions by 33%." },
    { id: "a_ep", name: "Endure Pain", game: "alchemy_s20", col: 12, row: 3,
      text: "Increases maximum Vitality by 10% if Toxicity exceeds the safety threshold." },
    { id: "a_pyro", name: "Pyrotechnics", game: "alchemy_s10", col: 2, row: 6,
      text: "All bombs, even those that do not inflict damage, now deal 50 damage in addition to their normal effects." },
    { id: "a_hi", name: "Hunter Instinct", game: "alchemy_s27", col: 6, row: 6,
      text: "When Adrenaline points reach their maximum, increases critical hit damage against the targeted enemy type by 20% if the correct oil is applied." },
    { id: "a_pb", name: "Poisoned Blades", game: "alchemy_s12", col: 10, row: 6,
      text: "Oil applied to blades has a 5% chance of poisoning the target." },
    { id: "a_pc", name: "Protective Coating", game: "alchemy_s5", col: 2, row: 9, verified: true,
      text: "Adds 5% protection against attacks from the monster type targeted by the oil." },
    { id: "a_at", name: "Acquired Tolerance", game: "alchemy_s18", col: 6, row: 9,
      text: "Every learned alchemical recipe increases maximum Toxicity by 1." },
    { id: "a_tsh", name: "Toxic Shock", game: "alchemy_s23", col: 10, row: 9,
      text: "Hitting a poisoned enemy with a Strong Attack consumes the poison, causing an extra burst of poison damage equal to 25% of the attack. Can be used once every 5 seconds." },
    { id: "a_tt", name: "Tissue Transmutation", game: "alchemy_s13", col: 6, row: 12,
      text: "Decoctions increase maximum Vitality by 300 for the decoction's effective duration." },
    { id: "a_dr", name: "Delayed Recovery", game: "alchemy_s3", col: 4, row: 15,
      text: "When Toxicity is above 70%, each consumed potion increases the duration of active potions' effects by 5 seconds, up to their maximum duration." },
    { id: "a_ht", name: "High Tolerance", game: "alchemy_s24", col: 8, row: 15,
      text: "While at 80% Toxicity or higher, take 150% damage from enemies. Increases critical hit damage equal to 33% of current Toxicity." },
    { id: "a_vc", name: "Volatile Compound", game: "alchemy_s25", col: 2, row: 18,
      text: "Bomb damage increases by 0.1% per point of Toxicity." },
    { id: "a_dbp", name: "Debilitating Poison", game: "alchemy_s22", col: 10, row: 18,
      text: "Poisoned targets deal 5% less damage." },
    { id: "a_fm", name: "Fast Metabolism", game: "alchemy_s15", col: 6, row: 21,
      text: "Toxicity drops 1 point per second faster." },
    { id: "a_clb", name: "Cluster Bombs", game: "alchemy_s11", col: 2, row: 24,
      text: "Bombs explode into 2 fragments, dealing 40% of the original bomb's damage for each fragment." },
    { id: "a_se", name: "Side Effects", game: "alchemy_s4", col: 6, row: 24,
      text: "Drinking a potion has a 33% chance of activating the effects of another random potion without increasing Toxicity. You can only have one bonus effect at a time." },
    { id: "a_ps", name: "Potent Sting", game: "alchemy_s26", col: 10, row: 24,
      text: "Poisoned weapons deal an additional 5% damage, or an additional 10% damage to targets immune to poison." }
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
