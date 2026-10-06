// Skill sets: the skills that share one theme, highlighted together (ui/skillSets.js). Sets describe
// what skills do, not builds: a build usually combines several, and a skill sits in every set it fits.
//
// What makes a set: highlighting it shows something one tree doesn't (a "Signs" set would just be the
// Signs tree). What puts a skill in a set: its text names the set's theme as something it improves,
// consumes or scales from. A trigger alone doesn't count (Maiming Shot triggers on a Sign crit but is
// a crossbow skill), unless the trigger is the skill's point (Sidestep: after a dodge).
//
// Sets are listed under the tree whose panel section shows them (sections in tree order); their skills
// can come from any tree. A set lists its skills in `ids`, or by role in `roles` ({ role: ids }) when
// what each skill does with the theme is worth telling apart; the role shows in the skill's tooltip
// ("Adrenaline (spends)"). Each role word means one thing in every set:
//   raises: increases the maximum, or the stat itself (Vitality, Toxicity, Sign intensity)
//   builds / regenerates / heals: refills the current amount (Adrenaline / Stamina / Vitality)
//   spends: costs it to use; saves: reduces that cost or a loss of it
//   lowers: reduces it (Toxicity, where less is better)
//   scales: its effect grows with the amount; needs: only works at a threshold
export default [
  {
    tree: "combat", sets: [
      { id: "fast", name: "Fast attacks", ids: ["c_mm", "c_st", "c_ts", "c_wh", "c_cs", "g_cat"] },
      { id: "strong", name: "Strong attacks", ids: ["c_st", "c_ts", "c_crb", "c_rend", "c_sa", "c_dp", "g_bear", "a_tsh"] },
      { id: "weapon", name: "Weapon damage", ids: ["g_wolf", "g_mant", "g_eos", "s_rsn", "c_ca", "c_ak", "a_ps"] },
      { id: "armor", name: "Armor penetration", ids: ["s_ma", "c_sa", "c_rend"] },
      { id: "crit", name: "Critical hits", ids: ["c_cs", "c_ms", "g_cat", "g_bf", "a_ht", "a_hi"] },
      { id: "xbow", name: "Crossbow", ids: ["c_cb", "c_lr", "c_ak", "c_ca", "c_ms"] },
      { id: "defense", name: "Dodge and counter", ids: ["c_mm", "c_ad", "c_ff", "c_ca", "s_sid", "g_aibd", "a_frz"] }
    ]
  },
  {
    tree: "signs", sets: [
      { id: "aard", name: "Aard", ids: ["s_fra", "s_as", "s_sw", "s_cat"] },
      { id: "igni", name: "Igni", ids: ["s_ma", "s_fst", "s_cat", "g_ea"] },
      { id: "yrden", name: "Yrden", ids: ["s_sg", "s_mt", "s_scg", "s_cat", "s_fs"] },
      { id: "quen", name: "Quen", ids: ["s_es", "s_ash", "s_fs"] },
      { id: "axii", name: "Axii", ids: ["s_del", "s_pm", "s_dom", "s_fs"] },
      {
        id: "intensity", name: "Sign intensity", roles: {
          raises: ["g_grif", "g_wolf", "s_foc", "s_cr", "s_cat", "c_foa"],
          scales: ["s_scg", "s_aft", "s_rsn"]
        }
      }
    ]
  },
  {
    tree: "alchemy", sets: [
      { id: "bombs", name: "Bombs", ids: ["a_eff", "a_pyro", "a_vc", "a_clb", "g_apy", "g_eos", "g_mant", "g_ea"] },
      { id: "oils", name: "Oils", ids: ["a_hi", "a_pc", "a_pb"] },
      { id: "poison", name: "Poison", ids: ["a_pb", "a_tsh", "a_dbp", "a_ps", "g_viper", "g_ea"] },
      { id: "potions", name: "Potions and decoctions", ids: ["a_ref", "a_dr", "a_se", "g_mb", "a_adp", "a_tt"] }
    ]
  },
  {
    tree: "general", sets: [
      {
        id: "adrenaline", name: "Adrenaline", roles: {
          builds: ["c_rf", "c_cb", "c_dp", "g_aibd", "g_ab"],
          saves: ["c_res"],
          spends: ["c_wh", "c_und", "c_foa", "g_mb", "g_am"],
          scales: ["c_rend", "s_foc", "g_bf"],
          needs: ["a_hi"]
        }
      },
      {
        id: "vitality", name: "Vitality", roles: {
          raises: ["g_bear", "g_viper", "g_si", "a_ep", "a_tt"],
          heals: ["a_ref", "c_und", "s_ash", "g_gou", "g_ss"],
          scales: ["s_sw"]
        }
      },
      {
        id: "stamina", name: "Stamina", roles: {
          regenerates: ["g_grif", "g_ss"],
          spends: ["c_wh", "s_fst", "s_ash"],
          saves: ["s_sid"],
          scales: ["c_rend"]
        }
      },
      {
        id: "toxicity", name: "Toxicity", roles: {
          raises: ["g_mc", "a_at"],
          lowers: ["a_fm", "g_mb", "a_se"],
          scales: ["a_vc", "a_ht"],
          needs: ["a_frz", "a_ep", "a_dr"]
        }
      }
    ]
  }
];
