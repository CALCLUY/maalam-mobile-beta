/**
 * Where the Maalam source code is loaded from.
 *
 * The app is compiled live from GitHub (via esm.sh), so any change you push to
 * this repo/branch shows up here automatically (CDN caches may take a few
 * minutes). To use your own fork, change `owner` / `name`. To pin an exact
 * version, set `ref` to a commit SHA or tag.
 *
 * Tip: you can also test another branch/commit without editing this file by
 * opening the site with `?ref=<branch-or-sha>` in the URL.
 */
export const REPO = {
  owner: "CALCLUY",
  name: "maalam-alpha",
  ref: "main",
};

/** Versions must match the repo's package.json so React is shared (one instance). */
export const REACT_VERSION = "19.2.6";
export const TAILWIND_VERSION = "4.1.17";

/**
 * Logo for the tool, shown exactly as-is (browser tab, loading screen, and the
 * app's own logo tile). If you change it, also update the matching URL in
 * src/index.css (.maalam-logo override) and the favicon links in index.html.
 */
export const LOGO_URL =
  "https://i.ibb.co/rKYMdtMv/Color-matching-first-image-2-K-20261006234249.jpg";

export function getRef(): string {
  try {
    const fromUrl = new URLSearchParams(window.location.search).get("ref");
    if (fromUrl && /^[\w./-]+$/.test(fromUrl)) return fromUrl;
  } catch {
    /* ignore */
  }
  return REPO.ref;
}

export function repoUrl(): string {
  return `https://github.com/${REPO.owner}/${REPO.name}`;
}
