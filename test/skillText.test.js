import { test } from "node:test";
import assert from "node:assert/strict";
import data from "../public/data/index.js";
import { createCatalog } from "../public/src/core/catalog.js";
import { rankText, rankValues, allRanksParts } from "../public/src/core/skillText.js";

test("one template is filled with each rank's numbers", () => {
  const skill = { text: "Deals {dmg}% more for {sec} s.", values: { dmg: [15, 30, 45], sec: [6, 6, 6] } };
  assert.equal(rankText(skill, 1), "Deals 15% more for 6 s.");
  assert.equal(rankText(skill, 3), "Deals 45% more for 6 s.");
  assert.deepEqual(rankValues(skill, 2), { dmg: 30, sec: 6 });
});

test("per-rank templates use only the numbers their rank has", () => {
  const skill = { text: ["Your next attack.", "Your next {n} attacks."], values: { n: [null, 2] } };
  assert.equal(rankText(skill, 1), "Your next attack.");
  assert.equal(rankText(skill, 2), "Your next 2 attacks.");
  assert.deepEqual(rankValues(skill, 1), {});
});

test("text without numbers stays as it is", () => {
  assert.equal(rankText({ text: "Pushes enemies back." }, 2), "Pushes enemies back.");
  assert.equal(rankText({}, 1), "");
});

test("every skill has text at every rank, with every placeholder filled", () => {
  const cat = createCatalog(data);
  for (const n of Object.values(cat.nodes)) {
    for (let r = 1; r <= cat.maxRank; r++) {
      const text = rankText(n, r);
      assert.ok(text.length > 0, `${n.id} has no rank ${r} text`);
      assert.doesNotMatch(text, /\{\w+\}/, `${n.id} rank ${r}: ${text}`);
    }
  }
});

test("catalog reports skills the extracted text doesn't match", () => {
  const cat = createCatalog({
    rules: { ...data.rules, treeOrder: ["a"] },
    trees: { a: { skills: [{ id: "x", name: "X", game: "g1" }, { id: "y", name: "Y", game: "g2" }], links: [] } },
    skillSets: [],
    skillText: { g1: { name: "Not X", maxRank: data.rules.maxRank, text: "t" } }
  });
  assert.equal(cat.problems.length, 2);
  assert.equal(cat.nodes.x.text, "t");
});

test("all ranks at once: each number becomes its list of values", () => {
  const skill = { text: "Gain {a} point(s). Lasts {b} s.", values: { a: [0.3, 0.6, 1], b: [5, 5, 5] } };
  assert.deepEqual(allRanksParts(skill, 3), ["Gain ", { values: [0.3, 0.6, 1] }, " point(s). Lasts ", { values: [5, 5, 5] }, " s."]);
  assert.deepEqual(allRanksParts({ text: "Pushes enemies back." }, 3), ["Pushes enemies back."]);
});

test("all ranks at once: per-rank wording uses the fullest template, missing numbers are 0 or `missing`", () => {
  const off = { text: ["Shield drains {v}%.", "Shield drains {v}%.", "Shield doesn't drain."], values: { v: [100, 50, null] } };
  assert.deepEqual(allRanksParts(off, 3), ["Shield drains ", { values: [100, 50, 0] }, "%."]);
  const words = { text: ["Your next attack.", "Your next {n} attacks.", "Your next {n} attacks."], values: { n: [null, 2, 3] }, missing: { n: 1 } };
  assert.deepEqual(allRanksParts(words, 3), ["Your next ", { values: [1, 2, 3] }, " attacks."]);
});

test("all ranks at once: every skill keeps every number of its ranks", () => {
  const cat = createCatalog(data);
  for (const n of Object.values(cat.nodes)) {
    const parts = allRanksParts(n, cat.maxRank);
    assert.ok(!parts.some(p => typeof p === "string" && /\{\w+\}/.test(p)), `${n.id} has an unfilled placeholder`);
    // Every number a rank's own text shows appears at that rank in the list.
    for (let r = 1; r <= cat.maxRank; r++) {
      const shown = parts.filter(p => typeof p !== "string").map(p => p.values[r - 1]);
      for (const v of Object.values(rankValues(n, r))) assert.ok(shown.includes(v), `${n.id} rank ${r} loses ${v}`);
    }
  }
});
