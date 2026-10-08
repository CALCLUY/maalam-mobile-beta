import { REACT_VERSION, REPO, TAILWIND_VERSION, getRef } from "./config";
import { installPhoneExperience } from "./mobile";

export type Step = "styles" | "tailwind" | "modules" | "render";

type ReactLike = {
  createElement?: (type: unknown, props?: unknown) => unknown;
  default?: ReactLike;
};
type ReactDomClientLike = {
  createRoot?: (el: Element) => { render: (node: unknown) => void };
  default?: ReactDomClientLike;
};

const ESM = "https://esm.sh";

function rawUrl(path: string, ref: string) {
  return `https://raw.githubusercontent.com/${REPO.owner}/${REPO.name}/${ref}/${path}`;
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { cache: "no-cache" });
  if (!res.ok) throw new Error(`Failed to fetch ${url} (${res.status})`);
  return res.text();
}

/** Turns the repo's CSS (written for @tailwindcss/vite) into something the Tailwind browser runtime can compile. */
function prepareCss(files: string[]): { tailwind: string; plainImports: string } {
  const plain: string[] = [];
  const bodies = files.map((css) =>
    css
      // Remove every Tailwind entry import; we add exactly one back at the top.
      .replace(/@import\s+(?:url\()?\s*["']tailwindcss(?:\/[^"']*)?["']\s*\)?[^;]*;/g, "")
      // Remote @import url(...) rules must live at the top of a normal stylesheet.
      .replace(/@import\s+(?:url\([^)]*\)|["']https?:[^"']+["'])[^;]*;/g, (rule) => {
        plain.push(rule);
        return "";
      }),
  );
  return { tailwind: `@import "tailwindcss";\n${bodies.join("\n\n")}`, plainImports: plain.join("\n") };
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.crossOrigin = "anonymous";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
}

async function dynamicImport<T>(url: string): Promise<T> {
  return (await import(/* @vite-ignore */ url)) as T;
}

export async function loadMaalam(onStep: (step: Step) => void): Promise<void> {
  const ref = getRef();

  // Start fetching JS modules right away (in parallel with the CSS work).
  const reactUrl = `${ESM}/react@${REACT_VERSION}/es2022/react.mjs`;
  const reactDomUrl = `${ESM}/react-dom@${REACT_VERSION}/client?deps=react@${REACT_VERSION}&target=es2022`;
  const appUrl = `${ESM}/gh/${REPO.owner}/${REPO.name}@${ref}/src/darija/App.tsx?target=es2022`;
  const modulesPromise = Promise.all([
    dynamicImport<ReactLike>(reactUrl),
    dynamicImport<ReactDomClientLike>(reactDomUrl),
    dynamicImport<{ default: unknown }>(appUrl),
  ]);
  // Avoid "unhandled rejection" noise; errors are surfaced when awaited below.
  modulesPromise.catch(() => undefined);

  // 1) Styles from the repo (globals.css + maalam.css)
  onStep("styles");
  const [globals, maalam] = await Promise.all([
    fetchText(rawUrl("src/globals.css", ref)),
    fetchText(rawUrl("src/maalam.css", ref)),
  ]);
  const { tailwind, plainImports } = prepareCss([globals, maalam]);
  if (plainImports) {
    const plainStyle = document.createElement("style");
    plainStyle.textContent = plainImports;
    document.head.appendChild(plainStyle);
  }
  const twStyle = document.createElement("style");
  twStyle.setAttribute("type", "text/tailwindcss");
  twStyle.textContent = tailwind;
  document.head.appendChild(twStyle);

  // 2) Tailwind v4 browser runtime compiles the CSS + utility classes on the fly
  onStep("tailwind");
  await loadScript(`https://cdn.jsdelivr.net/npm/@tailwindcss/browser@${TAILWIND_VERSION}`);

  // 3) App modules (compiled from the GitHub TypeScript source by esm.sh)
  onStep("modules");
  const [reactMod, reactDomMod, appMod] = await modulesPromise;
  const React = reactMod.createElement ? reactMod : reactMod.default!;
  const ReactDOM = reactDomMod.createRoot ? reactDomMod : reactDomMod.default!;
  const MaalamApp = appMod.default;
  if (!MaalamApp) throw new Error("The Maalam module has no default export.");

  // 4) Mount
  onStep("render");
  const rootEl = document.getElementById("root");
  if (!rootEl) throw new Error("#root element missing");
  if (!React.createElement || !ReactDOM.createRoot) throw new Error("React failed to load from esm.sh.");
  installPhoneExperience();
  ReactDOM.createRoot(rootEl).render(React.createElement(MaalamApp));

}
