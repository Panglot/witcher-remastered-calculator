// Mutagens for the slot groups: the pure single-colour ones, three sizes each. Each is unlimited,
// so one mutagen can sit in any number of groups at once.
// Values match the Remaster's game files (def_item_ingredients.xml, *_mutagen_color_*_x abilities).
// A group's bonus is `value` once, plus `value` again for every slotted skill of the same colour
// (up to 4 times `value` with three).
//
// Item fields:
//   id      used in build codes, so don't rename one
//   color   a key of `stats`; skills of this tree colour (trees/*.js `mutagen`) add to the bonus
//   size    "lesser" | "normal" | "greater", names the icon mutagens/item-<color>-<size>.png
//   col/row its cell in the Mutagens tab's 9 x 10 inventory grid, from 0 at the top left
//   type, rarity  tooltip lines; default to `item` below
export default {
  // Tooltip lines every item shares unless it sets its own, as an in-game Greater blue mutagen shows them.
  item: { type: "Alchemy ingredient", rarity: "Common item" },
  // What each colour raises. `unit` follows the number.
  stats: {
    red: { label: "Attack power", unit: "%" },
    blue: { label: "Sign intensity", unit: "%" },
    green: { label: "Vitality", unit: "" }
  },
  items: [
    { id: "red-lesser", name: "Lesser red mutagen", color: "red", size: "lesser", value: 5, col: 0, row: 0 },
    { id: "red-normal", name: "Red mutagen", color: "red", size: "normal", value: 7, col: 1, row: 0 },
    { id: "red-greater", name: "Greater red mutagen", color: "red", size: "greater", value: 10, col: 2, row: 0 },
    { id: "blue-lesser", name: "Lesser blue mutagen", color: "blue", size: "lesser", value: 5, col: 0, row: 1 },
    { id: "blue-normal", name: "Blue mutagen", color: "blue", size: "normal", value: 7, col: 1, row: 1 },
    { id: "blue-greater", name: "Greater blue mutagen", color: "blue", size: "greater", value: 10, col: 2, row: 1 },
    { id: "green-lesser", name: "Lesser green mutagen", color: "green", size: "lesser", value: 50, col: 0, row: 2 },
    { id: "green-normal", name: "Green mutagen", color: "green", size: "normal", value: 100, col: 1, row: 2 },
    { id: "green-greater", name: "Greater green mutagen", color: "green", size: "greater", value: 150, col: 2, row: 2 }
  ],
  // Build codes made before mutagen sizes stored only the colour.
  aliases: { red: "red-normal", blue: "blue-normal", green: "green-normal" }
};
