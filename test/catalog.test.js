import { test } from "node:test";
import assert from "node:assert/strict";
import data from "../public/data/index.js";
import { createCatalog } from "../public/src/core/catalog.js";

test("game data has no problems (unknown links, duplicate ids, bad skill sets)", () => {
  assert.deepEqual(createCatalog(data).problems, []);
});

test("every tree has a root skill and every skill is reachable from one", () => {
  const cat = createCatalog(data);
  for (const t of cat.order) {
    const skills = cat.skillsIn(t);
    const reached = new Set(skills.filter(s => s.root).map(s => s.id));
    assert.ok(reached.size > 0, `${t} has no root skill`);
    const queue = [...reached];
    while (queue.length) cat.nodes[queue.shift()].to.forEach(n => { if (!reached.has(n)) { reached.add(n); queue.push(n); } });
    assert.deepEqual(skills.filter(s => !reached.has(s.id)).map(s => s.id), [], `unreachable skills in ${t}`);
  }
});

test("links run from the upper skill down, or out of a root", () => {
  const cat = createCatalog(data);
  const wrong = cat.edges.filter(([a, b]) => !(cat.nodes[a].root || cat.nodes[a].row < cat.nodes[b].row)).map(e => e.join("-"));
  assert.deepEqual(wrong, []);
});

test("no two skills in a tree share a grid cell", () => {
  const cat = createCatalog(data);
  for (const t of cat.order) {
    const cells = cat.skillsIn(t).map(s => `${s.col},${s.row}`);
    assert.equal(new Set(cells).size, cells.length, `overlapping skills in ${t}`);
  }
});

test("every mutagen has its own grid cell", () => {
  const cells = Object.values(createCatalog(data).mutagens).map(m => `${m.col},${m.row}`);
  assert.equal(new Set(cells).size, cells.length);
});

test("catalog reports data mistakes instead of throwing", () => {
  const cat = createCatalog({
    rules: { ...data.rules, treeOrder: ["a", "missing"] },
    trees: { a: { skills: [{ id: "x", name: "X" }, { id: "x", name: "X again" }], links: ["x-nope"] } },
    skillSets: [{ tree: "a", sets: [{ id: "set", ids: ["ghost"] }, { id: "set", roles: { r: ["x", "x"] } }] }, { tree: "nope", sets: [] }]
  });
  assert.equal(cat.problems.length, 7);
  assert.deepEqual(cat.order, ["a"]);
});

test("catalog reports totals that read unknown skills, numbers, colours or trees, or armor with no condition", () => {
  const cat = createCatalog({
    rules: { ...data.rules, treeOrder: ["a"] },
    mutagens: { stats: { red: { label: "Attack power", unit: "%" } }, items: [] },
    trees: { a: { skills: [{ id: "x", name: "X" }], links: [] } },
    skillSets: [],
    totals: {
      synergy: { skill: "ghost", value: "v" },
      stats: [{ id: "s", sources: [{ skill: "x", value: "nope", armor: "heavy" }, { mutagen: "teal" }, { passive: "b" }, { mutagen: "red" }, {}] }]
    }
  });
  assert.equal(cat.problems.length, 6);
});
