// Build-wide totals for the Statistics panel: the stats that add up across the build, and what
// feeds each (core/stats.js `totals`). Hand-written: the game's placeholder names don't say what a
// number raises (`spell_power` is Sign intensity in Flood of Anger but knock-down reduction in
// Aard Sweep), so each source is picked by reading its skill text (data/skillText.js).
//
// A stat is listed when more than one thing can raise it. Effects that only hit a subset (Catalyst:
// Aard and Igni only), one attack (Counterattack) or scale with a live value (High Tolerance:
// current Toxicity) are left out.
//
// Stat fields: id, label, unit, color, sources (in the order the panel lists them).
//   color: the band behind the row, like the slot groups' bonus labels: the mutagen colour that
//   raises the stat, else the colour of the tree whose skills or passive do (combat red, signs blue,
//   alchemy green).
// Source kinds:
//   { mutagen: "<colour>" }  the equipped mutagens of that colour, raised by `synergy` below
//   { passive: "<tree>" }    a tree's passive bonus. Counts only next to another source, since the
//                            tree's bar shows it already.
//   { skill: "<id>", value: "<placeholder>", times?: n, when?: "text", armor?: "light" | "medium" | "heavy" }
//     a slotted skill's number at its rank, times `times` (per Adrenaline point, per armor piece).
//     when: the condition, shown after the value. A source with one counts only towards the
//     total's "up to", not the bonus that always applies; armor needs one too, since the planner
//     doesn't know what Geralt wears. armor: the armor type it needs; within one stat
//     only the armor type that gives the most counts, since Geralt wears one set.
//
// Limits read from the game files (5.0, checked 2026-10-06):
const ADRENALINE = 3;   // max Adrenaline points: `focus` base 3, gameplay\abilities\geralt_stats.xml
const ARMOR_PIECES = 4; // armor, boots, trousers, gloves: SetPerkArmorBonus, PlayerAbilityManager.ws

export default {
  // Raises every mutagen bonus by its number in percent, as its tooltip says. The game adds it per
  // mutagen in the same steps as the bonus (rank x (matching skills + 1)); the per-mutagen numbers
  // aren't checked.
  synergy: { skill: "g_syn", value: "synergy_bonus" },
  stats: [
    {
      id: "attack-power", label: "Attack power", unit: "%", color: "red",
      sources: [
        { mutagen: "red" },
        { skill: "g_wolf", value: "attack_power", times: ARMOR_PIECES, when: "4 Medium Armor pieces", armor: "medium" }
      ]
    },
    {
      id: "sign-intensity", label: "Sign intensity", unit: "%", color: "blue",
      sources: [
        { mutagen: "blue" },
        { skill: "c_foa", value: "spell_power", when: "Signs cast with 3 Adrenaline" },
        { skill: "s_foc", value: "spell_power", times: ADRENALINE, when: "at 3 Adrenaline" },
        { skill: "s_cr", value: "damage", times: 5, when: "at 5 stacks" },
        { skill: "g_grif", value: "spell_power", times: ARMOR_PIECES, when: "4 Medium Armor pieces", armor: "medium" },
        { skill: "g_wolf", value: "spell_power", times: ARMOR_PIECES, when: "4 Medium Armor pieces", armor: "medium" }
      ]
    },
    {
      id: "vitality", label: "Vitality", unit: "", color: "green",
      sources: [
        { mutagen: "green" },
        { skill: "a_tt", value: "vitality", when: "during decoctions" }
      ]
    },
    {
      id: "vitality-max", label: "Maximum Vitality", unit: "%", color: "green",
      sources: [
        { skill: "g_si", value: "vitality" },
        { skill: "a_ep", value: "vitality", when: "Toxicity above the safety threshold" },
        { skill: "g_bear", value: "vitality", times: ARMOR_PIECES, when: "4 Heavy Armor pieces", armor: "heavy" },
        // The game's text puts this number in the Vitality spot.
        { skill: "g_viper", value: "poison_dmg_multiplier", times: ARMOR_PIECES, when: "4 Medium Armor pieces", armor: "medium" }
      ]
    },
    {
      id: "crit-damage", label: "Critical hit damage", unit: "%", color: "red",
      sources: [
        { skill: "g_cat", value: "critical_hit_damage_bonus", times: ARMOR_PIECES, when: "4 Light Armor pieces", armor: "light" },
        { skill: "a_hi", value: "critical_hit_damage_bonus", when: "at full Adrenaline, with the right oil" }
      ]
    },
    {
      id: "adrenaline-gain", label: "Adrenaline gain", unit: "%", color: "red",
      sources: [
        { passive: "combat" },
        { skill: "g_ab", value: "focus_gain" }
      ]
    },
    {
      id: "stamina-regen", label: "Stamina regeneration", unit: "/s", color: "blue",
      sources: [
        { skill: "g_grif", value: "staminaRegen", times: ARMOR_PIECES, when: "4 Medium Armor pieces", armor: "medium" },
        { skill: "g_ss", value: "staminaRegen_tooltip", when: "at night, in combat" }
      ]
    },
    {
      id: "bomb-damage", label: "Bomb damage", unit: "%", color: "green",
      sources: [
        { passive: "alchemy" },
        { skill: "g_mant", value: "bomb_dmg_multiplier", times: ARMOR_PIECES, when: "4 Medium Armor pieces", armor: "medium" }
      ]
    }
  ]
};
