// Slot locks, like the game's: a socket or diamond opens once the build's total points (its
// budget: earned, spent or not) reach its value in rules.slotUnlocks (catalog.slots.unlocks). The
// game compares the same total (PlayerAbilityManager.ws, UpdateSkillSlots), so places of power and
// items count, not only the level.
//
// How locks act is a viewer setting (settings.js, slotLocking), not part of the build:
// - LOCK_NONE: no slot is locked.
// - LOCK_SOFT: locked slots show it, but still take items; the slots in use add to the points a
//   build needs (core/stats.js, points).
// - LOCK_HARD: as soft, but nothing new goes into a locked slot (core/slotKinds.js). Items already
//   in one (a loaded code, a total lowered by hand) stay.
// Pure: works on a plain build object { slots, mut, budget } and the catalog.

export const LOCK_NONE = "none";
export const LOCK_SOFT = "soft";
export const LOCK_HARD = "hard";

/** @param {ReturnType<import("./catalog.js").createCatalog>} catalog */
export function createSlotLocks(catalog) {
  const { unlocks } = catalog.slots;
  // Holder list and unlock values by slot kind name (core/slotKinds.js).
  const KINDS = { skill: { list: "slots", at: unlocks.sockets }, mutagen: { list: "mut", at: unlocks.mutagens } };

  /** Total points that open holder i of a kind. */
  const unlockAt = (kind, i) => KINDS[kind].at[i] || 0;

  /** Holder i is locked: shown with a lock, and refused in hard mode. */
  const isLocked = (b, kind, i, mode) => mode !== LOCK_NONE && b.budget < unlockAt(kind, i);

  /** Nothing new can go into holder i. */
  const isBlocked = (b, kind, i, mode) => mode === LOCK_HARD && isLocked(b, kind, i, mode);

  /** The total points that open every holder in use (0 when none is). */
  function required(b) {
    return Object.entries(KINDS).reduce((most, [kind, { list }]) =>
      b[list].reduce((m, item, i) => item ? Math.max(m, unlockAt(kind, i)) : m, most), 0);
  }

  return { unlockAt, isLocked, isBlocked, required };
}
