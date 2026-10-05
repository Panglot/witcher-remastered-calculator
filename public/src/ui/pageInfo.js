// The page's own text outside the game screen: the fan content notice in
// the window's bottom right corner or, on phones, under the share tools in the bottom bar (the Esc menu and About show it too), the repo link and contact About
// offers, and the browser tab title, which carries the build name when the build has one.

export const FAN_NOTICE = "Unofficial fan work, not approved or endorsed by CD PROJEKT RED.";
export const REPO_URL = "https://github.com/Panglot/witcher-remastered-calculator";
// Discord has no profile links by username, so About shows the name and offers to copy it.
export const CONTACT_DISCORD = "SkyLordPanglot";

const SEPARATOR = " - ";

export function mountPageInfo(app) {
  const baseTitle = document.title;
  // Two places: the window's corner, and the bottom bar on phones (styles.css shows one of them).
  document.querySelectorAll("[data-fan-notice]").forEach(el => { el.textContent = FAN_NOTICE; });

  function render() {
    const name = app.state.name.trim();
    document.title = name ? name + SEPARATOR + baseTitle : baseTitle;
  }

  return { render };
}
