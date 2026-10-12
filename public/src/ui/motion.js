// Timeline motion: art the game animates frame by frame on a movie's timeline, looped with the Web
// Animations API. A group marked data-timeline="<layout>" holds children marked data-motion="<id>",
// each a motion of that timeline layout (gameArt.js, Art.timeline): its keyframe matrices, linear
// between keys, over its frame count at the movie's frame rate. Every motion starts on frame 1, as
// the game's sprites do when placed together.

const cssMatrix = key => `matrix(${key.slice(1).join(",")})`;

/**
 * Loops the motions under `el`.
 * @param {Element} el
 * @param {import("./gameArt.js").Art} art
 * @returns {Animation[]}
 */
export function playMotions(el, art) {
  return [...el.querySelectorAll("[data-timeline]")].flatMap(group => {
    const { fps, motions } = art.timeline(group.dataset.timeline);
    return [...group.querySelectorAll("[data-motion]")].map(g => {
      const { frames, keys } = motions[g.dataset.motion];
      const keyframes = keys.map(k => ({ offset: (k[0] - 1) / frames, transform: cssMatrix(k) }));
      // The last frame runs back into the first.
      keyframes.push({ offset: 1, transform: cssMatrix(keys[0]) });
      return g.animate(keyframes, { duration: frames / fps * 1000, iterations: Infinity });
    });
  });
}
