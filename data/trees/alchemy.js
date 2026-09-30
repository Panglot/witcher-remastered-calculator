// Alchemy tree. Layout and links are read from in-game screenshots.
window.W3R_DATA = window.W3R_DATA || { trees: {} };

W3R_DATA.trees.alchemy = {
  name: "Alchemy",
  color: "var(--alchemy)",
  dark: "#223a1b",
  // Grid spacing in SVG units. col/row on each skill are multiplied by these.
  layout: { colW: 80, rowH: 88 },
  // Bonus granted per point spent anywhere in this tree.
  passive: { label: "Potion duration & bomb damage", per: 2, unit: "%" },
  // Mutagen colour this tree's skills match, or null.
  mutagen: "green",

  // root: open without a connected point. verified: text checked in-game.
  skills: [
    { id: "a_ref", name: "Refreshment", col: 1, row: 0, root: true,
      text: "Each potion dose heals 10% Vitality." },
    { id: "a_eff", name: "Efficiency", col: 3, row: 0, root: true,
      text: "Increases the maximum number of bombs in each slot by 1." },
    { id: "a_frz", name: "Frenzy", col: 5, row: 0, root: true,
      text: "If potion Toxicity is greater than 1, time automatically slows by 5% when the enemy is about to perform a counterattack." },
    { id: "a_adp", name: "Adaptability", col: 0, row: 1,
      text: "Extends the duration of all mutagen decoctions by 33%." },
    { id: "a_ep", name: "Endure Pain", col: 6, row: 1,
      text: "Increases maximum Vitality by 10% if Toxicity exceeds the safety threshold." },
    { id: "a_pyro", name: "Pyrotechnics", col: 1, row: 2,
      text: "All bombs, even those that do not inflict damage, now deal 50 damage in addition to their normal effects." },
    { id: "a_hi", name: "Hunter Instinct", col: 3, row: 2,
      text: "When Adrenaline points reach their maximum, increases critical hit damage against the targeted enemy type by 20% if the correct oil is applied." },
    { id: "a_pb", name: "Poisoned Blades", col: 5, row: 2,
      text: "Oil applied to blades has a 5% chance of poisoning the target." },
    { id: "a_pc", name: "Protective Coating", col: 1, row: 3, verified: true,
      text: "Adds 5% protection against attacks from the monster type targeted by the oil." },
    { id: "a_at", name: "Acquired Tolerance", col: 3, row: 3,
      text: "Every learned alchemical recipe increases maximum Toxicity by 1." },
    { id: "a_tsh", name: "Toxic Shock", col: 5, row: 3,
      text: "Hitting a poisoned enemy with a Strong Attack consumes the poison, causing an extra burst of poison damage equal to 25% of the attack. Can be used once every 5 seconds." },
    { id: "a_tt", name: "Tissue Transmutation", col: 3, row: 4,
      text: "Decoctions increase maximum Vitality by 300 for the decoction's effective duration." },
    { id: "a_dr", name: "Delayed Recovery", col: 2, row: 5,
      text: "When Toxicity is above 70%, each consumed potion increases the duration of active potions' effects by 5 seconds, up to their maximum duration." },
    { id: "a_ht", name: "High Tolerance", col: 4, row: 5,
      text: "While at 80% Toxicity or higher, take 150% damage from enemies. Increases critical hit damage equal to 33% of current Toxicity." },
    { id: "a_vc", name: "Volatile Compound", col: 1, row: 6,
      text: "Bomb damage increases by 0.1% per point of Toxicity." },
    { id: "a_dbp", name: "Debilitating Poison", col: 5, row: 6,
      text: "Poisoned targets deal 5% less damage." },
    { id: "a_fm", name: "Fast Metabolism", col: 3, row: 7,
      text: "Toxicity drops 1 point per second faster." },
    { id: "a_clb", name: "Cluster Bombs", col: 1, row: 8,
      text: "Bombs explode into 2 fragments, dealing 40% of the original bomb's damage for each fragment." },
    { id: "a_se", name: "Side Effects", col: 3, row: 8,
      text: "Drinking a potion has a 33% chance of activating the effects of another random potion without increasing Toxicity. You can only have one bonus effect at a time." },
    { id: "a_ps", name: "Potent Sting", col: 5, row: 8,
      text: "Poisoned weapons deal an additional 5% damage, or an additional 10% damage to targets immune to poison." }
  ],

  // Two-way connections: "a-b" means a point in either opens the other.
  links: [
    "a_ref-a_adp", "a_ref-a_pyro", "a_ref-a_hi", "a_eff-a_pyro", "a_eff-a_hi", "a_eff-a_pb",
    "a_frz-a_hi", "a_frz-a_pb", "a_frz-a_ep", "a_adp-a_pyro", "a_ep-a_pb", "a_pyro-a_pc",
    "a_hi-a_at", "a_pb-a_tsh", "a_pc-a_tt", "a_at-a_tt", "a_tsh-a_tt", "a_pc-a_vc",
    "a_tsh-a_dbp", "a_tt-a_dr", "a_tt-a_ht", "a_dr-a_vc", "a_ht-a_dbp", "a_dr-a_fm",
    "a_ht-a_fm", "a_vc-a_clb", "a_fm-a_se", "a_dbp-a_ps"
  ]
};
