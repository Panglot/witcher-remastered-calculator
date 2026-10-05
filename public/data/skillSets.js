// Skill sets: the skills related to one aspect of combat, highlighted together. A build usually
// combines several. ids can come from any tree; tree sets the chip colour.
export default [
  { id: "fast", name: "Fast attack / crit", tree: "combat", ids: ["c_mm", "c_ts", "c_rf", "c_wh", "c_cs", "g_cat", "g_bf"] },
  { id: "strong", name: "Strong attack / armor break", tree: "combat", ids: ["c_st", "c_crb", "c_sa", "c_rend", "c_dp", "g_bear"] },
  { id: "xbow", name: "Crossbow", tree: "combat", ids: ["c_ad", "c_cb", "c_lr", "c_ak", "c_ca", "c_ms"] },
  { id: "evade", name: "Evasion / counter", tree: "combat", ids: ["c_mm", "c_ff", "c_ca", "c_res", "c_und", "g_aibd"] },
  { id: "yrden", name: "Yrden control", tree: "signs", ids: ["s_sg", "s_mt", "s_scg", "s_cat", "s_fs", "g_grif"] },
  { id: "blast", name: "Aard / Igni blaster", tree: "signs", ids: ["s_fra", "s_as", "s_sw", "s_ma", "s_fst", "s_cat", "g_grif", "g_ea"] },
  { id: "quen", name: "Quen tank", tree: "signs", ids: ["s_es", "s_ash", "s_fs", "g_bear"] },
  { id: "spell", name: "Spellsword", tree: "signs", ids: ["s_cr", "s_foc", "s_aft", "s_rsn", "s_sid", "g_ab", "g_am", "g_wolf", "c_foa"] },
  { id: "axii", name: "Axii utility", tree: "signs", ids: ["s_del", "s_pm", "s_dom"] },
  { id: "bombs", name: "Bombs", tree: "alchemy", ids: ["a_eff", "a_pyro", "a_vc", "a_clb", "g_apy", "g_eos", "g_mant"] },
  { id: "poison", name: "Poison", tree: "alchemy", ids: ["a_pb", "a_tsh", "a_dbp", "a_ps", "g_viper"] },
  { id: "oils", name: "Oils / monster hunter", tree: "alchemy", ids: ["a_hi", "a_pc", "a_pb"] },
  { id: "tox", name: "Toxicity / potions", tree: "alchemy", ids: ["a_frz", "a_at", "a_ep", "a_ht", "a_dr", "a_se", "g_mc", "g_mb"] },
  { id: "deco", name: "Decoctions", tree: "alchemy", ids: ["a_adp", "a_tt", "g_syn"] },
  { id: "adren", name: "Adrenaline economy", tree: "general", ids: ["c_res", "c_rf", "g_ab", "g_aibd"] },
  { id: "sustain", name: "Sustain", tree: "general", ids: ["a_ref", "g_si", "g_gou", "g_ss", "c_und", "s_ash"] }
];
