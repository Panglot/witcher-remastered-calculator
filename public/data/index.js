// All game data in one object. To add a tree: create data/trees/<id>.js, import it here,
// and add its id to rules.treeOrder.
import rules from "./rules.js";
import archetypes from "./archetypes.js";
import combat from "./trees/combat.js";
import signs from "./trees/signs.js";
import alchemy from "./trees/alchemy.js";
import general from "./trees/general.js";

export default {
  rules,
  archetypes,
  trees: { combat, signs, alchemy, general }
};
