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
  skills: [
    { id: "c_mm", name: "Muscle Memory", game: "sword_s22", col: 3, row: 0, root: true,
      text: "After a successful dodge or roll, your next Fast Attack deals 30% additional damage.",
      note: "Sportskeeda words it as the next 3 Fast Attacks in a row. Hover it in-game to settle." },
    { id: "c_ad", name: "Arrow Deflection", game: "sword_s33", col: 9, row: 0, root: true,
      text: "You can parry ranged arrow attacks. A perfectly-timed parry deflects arrows back at the enemy, causing damage. It has a 15% chance to instantly kill the target." },
    { id: "c_st", name: "Strength Training", game: "sword_s23", col: 0, row: 3,
      text: "Fast attacks increase the next Strong Attack's damage by 15%." },
    { id: "c_cb", name: "Cold Blood", game: "sword_s34", col: 12, row: 3,
      text: "Every bolt that reaches its target generates Adrenaline points." },
    { id: "c_ts", name: "Three Strikes", game: "sword_s24", col: 3, row: 6,
      text: "The third Fast or Strong Attack has a 20% chance to make the next attack even more powerful, but only if it is the same attack type as the last." },
    { id: "c_res", name: "Resolve", game: "sword_s16", col: 9, row: 6,
      text: "Reduces Adrenaline point loss by 33% when taking damage." },
    { id: "c_und", name: "Undying", game: "sword_s18", col: 6, row: 9,
      text: "When Vitality reaches 0, immediately consumes Adrenaline points to restore 10% Vitality per point. Can only be used once every 30 seconds." },
    { id: "c_crb", name: "Crushing Blow", game: "sword_s25", col: 0, row: 12,
      text: "A Strong Attack has a 20% chance to increase the damage dealt by the next 2 Strong Attacks by 50%." },
    { id: "c_rf", name: "Razor Focus", game: "sword_s20", col: 3, row: 12,
      text: "Gain 1 Adrenaline point upon entering combat. Increases Adrenaline generation from weapon strikes by 10%." },
    { id: "c_ff", name: "Fleet-Footed", game: "sword_s36", col: 6, row: 12,
      text: "Reduces damage received while dodging by 33%." },
    { id: "c_lr", name: "Lightning Reflexes", game: "sword_s32", col: 9, row: 12,
      text: "Time slows by an additional 30% while aiming with the crossbow. Increases headshot damage by 250%. Grants a 5% chance to instantly kill the target." },
    { id: "c_ak", name: "Anatomical Knowledge", game: "sword_s26", col: 12, row: 12,
      text: "Increases crossbow damage by 10% of current silver sword damage." },
    { id: "c_wh", name: "Whirl", game: "sword_s35", col: 6, row: 15,
      text: "A spinning attack that strikes all enemies in your immediate vicinity. Maintaining the attack consumes Stamina and Adrenaline." },
    { id: "c_rend", name: "Rend", game: "sword_s2", col: 3, row: 18,
      text: "Deals additional damage proportional to Stamina consumed. Ignores enemy defenses. Adrenaline points increase total damage by 10% per point upon hitting an enemy." },
    { id: "c_ca", name: "Counterattack", game: "sword_s31", col: 9, row: 18,
      text: "After a successful counterattack or dodge, the next attack deals 33% additional damage. Damage dealt by crossbows is multiplied by 2." },
    { id: "c_sa", name: "Sunder Armor", game: "sword_s28", col: 0, row: 21,
      text: "Strong Attacks sunder enemy Armor, reducing damage resistance by 10%. Stacks up to 1 time." },
    { id: "c_cs", name: "Crippling Strike", game: "sword_s29", col: 6, row: 21,
      text: "Critical hits from Fast Attacks cripple enemies, increasing their damage taken by 10%." },
    { id: "c_ms", name: "Maiming Shot", game: "sword_s27", col: 12, row: 21,
      text: "After a critical hit from a weapon or Sign, the next crossbow shot disables monster special abilities for 4 seconds." },
    { id: "c_dp", name: "Deadly Precision", game: "sword_s30", col: 3, row: 24,
      text: "All attacks have a chance to make the next Strong Attack instantly kill an enemy. Enemies immune to this effect generate 0.1 Adrenaline instead." },
    { id: "c_foa", name: "Flood of Anger", game: "sword_s19", col: 9, row: 24,
      text: "When casting a Sign, consumes 3 Adrenaline points to cast the Sign at its highest level. Increases Sign intensity by 50%." }
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
