import { test } from "node:test";
import assert from "node:assert/strict";
import data from "../public/data/index.js";
import { createCatalog } from "../public/src/core/catalog.js";
import { encodeBuildCode, decodeBuildCode, applyBuildData, exportFile, exportFileName, shareLink, readShareLink, isEmptyBuild } from "../public/src/core/build.js";

const cat = createCatalog(data);
// A custom total of 4, as builds were before progress was kept.
const blank = () => ({ pts: {}, slots: Array(cat.slots.total).fill(null), mut: Array(cat.slots.groups).fill(""), budget: 4, progress: cat.budget.normalize(null, 4), name: "" });
const sample = () => {
  const s = blank();
  s.pts = { c_mm: 2, c_st: 1 }; s.slots[0] = "c_mm"; s.mut[1] = "red-greater"; s.budget = 12; s.name = "Crossbow and bombs";
  return s;
};
const loaded = text => { const s = blank(); assert.ok(applyBuildData(cat, s, decodeBuildCode(text))); return s; };
const buildOf = s => [s.pts, s.slots, s.mut, s.budget, s.progress, s.name];

test("build code round-trips, including the name", () => {
  const a = sample();
  assert.deepEqual(buildOf(loaded(encodeBuildCode(a))), buildOf(a));
});

test("names outside Latin-1 survive the code", () => {
  const a = sample(); a.name = "Ведьмак · 猫";
  assert.equal(loaded(encodeBuildCode(a)).name, a.name);
});

test("codes made before names were added still load", () => {
  const code = "W3R1." + btoa(JSON.stringify({ p: { c_mm: 1 }, s: Array(12).fill(null), m: ["green", "", "", ""], b: 4 }));
  const s = loaded(code);
  assert.deepEqual(s.pts, { c_mm: 1 });
  assert.equal(s.name, "");
  // Mutagens were stored as a bare colour then.
  assert.deepEqual(s.mut, ["green-normal", "", "", ""]);
});

test("a calculated budget round-trips its progress; codes without one load as a custom total", () => {
  const a = sample();
  cat.budget.setNgPlus(a, true);
  cat.budget.setField(a, "level", 60);
  const s = loaded(encodeBuildCode(a));
  assert.deepEqual([s.progress, s.budget], [{ ngPlus: true, level: 60, places: 60, other: 6, custom: false }, 59 + 66]);
  const old = loaded("W3R1." + btoa(JSON.stringify({ p: {}, s: Array(12).fill(null), m: ["", "", "", ""], b: 40 })));
  assert.deepEqual([old.progress.custom, old.budget], [true, 40]);
});

test("codes are found inside surrounding text and across line breaks", () => {
  const code = encodeBuildCode(sample());
  assert.equal(loaded(`Here's my build: ${code} have fun`).name, "Crossbow and bombs");
  assert.equal(loaded(code.slice(0, 20) + "\n  " + code.slice(20)).name, "Crossbow and bombs");
});

test("export file loads back, even when the name contains the code prefix", () => {
  const a = sample(); a.name = "Test W3R1.oops";
  const file = exportFile(a);
  assert.equal(file.name, "test-w3r1oops.txt");
  assert.deepEqual(buildOf(loaded(file.text)), buildOf(a));
});

test("bad codes are rejected", () => {
  assert.equal(decodeBuildCode("hello"), null);
  assert.equal(decodeBuildCode("W3R1."), null);
  assert.equal(decodeBuildCode("W3R1.not-base64!"), null);
  assert.equal(decodeBuildCode("W3R1." + btoa("{}")), null);
});

test("applying data drops unknown skills, clamps ranks, and clears invalid slots", () => {
  const s = blank();
  applyBuildData(cat, s, { p: { c_mm: 9, nope: 2, c_st: 0 }, s: ["nope", ...Array(11).fill(null)], m: ["purple", "red-lesser", "constructor", ""] });
  assert.deepEqual(s.pts, { c_mm: 3 });
  assert.equal(s.slots[0], null);
  assert.deepEqual(s.mut, ["", "red-lesser", "", ""]);
});

test("export file names are safe", () => {
  assert.equal(exportFileName("Crossbow and bombs!"), "crossbow-and-bombs.txt");
  assert.equal(exportFileName("Ведьмак"), "ведьмак.txt");
  assert.equal(exportFileName("../../etc"), "etc.txt");
  assert.equal(exportFileName(""), "witcher-build.txt");
});

test("share link carries the code and loads back, pasted or opened", () => {
  const a = sample(); a.name = "Ведьмак + bombs / 100%";
  const link = shareLink("https://example.com/planner/?x=1#top", a);
  assert.ok(link.startsWith("https://example.com/planner/?x=1&build=W3R1."));
  assert.ok(!link.includes("#"));
  assert.deepEqual(buildOf(loaded(link)), buildOf(a));
  assert.deepEqual(buildOf(loaded(`Try this: ${link} !`)), buildOf(a));
  const { code, rest } = readShareLink(link);
  assert.deepEqual(buildOf(loaded(code)), buildOf(a));
  assert.equal(rest, "https://example.com/planner/?x=1");
  assert.deepEqual(readShareLink("https://example.com/"), { code: "", rest: "https://example.com/" });
});

test("text with a stray percent sign still loads its code", () => {
  const a = sample(); a.name = "100% crit";
  assert.equal(loaded(exportFile(a).text).name, "100% crit");
});

test("a build is empty without points, mutagens and a name", () => {
  assert.ok(isEmptyBuild(blank()));
  assert.ok(isEmptyBuild({ ...blank(), budget: 30 }));
  assert.ok(!isEmptyBuild({ ...blank(), name: "x" }));
  assert.ok(!isEmptyBuild({ ...blank(), pts: { c_mm: 1 } }));
  assert.ok(!isEmptyBuild({ ...blank(), mut: ["", "red-lesser", "", ""] }));
});
