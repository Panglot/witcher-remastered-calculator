// Top-level pages. Each `[data-page]` element is a page, shown when the URL hash names it
// (#demo), so every page has its own link. No hash or an unknown one shows the first page.
import { $ } from "./dom.js";

export function mountPages(app) {
  const pages = [...document.querySelectorAll("[data-page]")];
  const nav = $("pageNav");

  window.addEventListener("hashchange", () => app.render());

  function current() {
    const id = location.hash.slice(1);
    return pages.some(p => p.dataset.page === id) ? id : pages[0].dataset.page;
  }

  function render() {
    const page = current();
    pages.forEach(p => { p.hidden = p.dataset.page !== page; });
    nav.querySelectorAll("[data-nav]").forEach(a => {
      if (a.dataset.nav === page) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
  }

  return { render };
}
