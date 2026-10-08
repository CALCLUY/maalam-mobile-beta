import { useEffect, useRef, useState } from "react";
import { LOGO_URL, REPO, getRef, repoUrl } from "./config";
import { t, uiDir, type StringKey } from "./i18n";
import { loadMaalam, type Step } from "./loader";

const STEPS: { id: Step; key: StringKey }[] = [
  { id: "styles", key: "loadStyles" },
  { id: "tailwind", key: "loadTailwind" },
  { id: "modules", key: "loadModules" },
  { id: "render", key: "loadRender" },
];

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m21.7 18-8-14a2 2 0 0 0-3.4 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  );
}

function Backdrop() {
  return (
    <>
      <div className="host__aurora" aria-hidden="true">
        <span />
        <span />
      </div>
      <div className="host__grid" aria-hidden="true" />
    </>
  );
}

export default function App() {
  const [step, setStep] = useState<Step>("styles");
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<"loading" | "closing" | "done">("loading");
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    loadMaalam(setStep)
      .then(() => {
        // Fade the loader out so the app is revealed underneath it.
        setPhase("closing");
        window.setTimeout(() => setPhase("done"), 400);
      })
      .catch((err: unknown) => {
        console.error(err);
        setError(err instanceof Error ? err.message : String(err));
      });
  }, []);

  if (phase === "done") return null;

  const dir = uiDir();

  if (error) {
    const repo = `${REPO.owner}/${REPO.name}`;
    return (
      <div className="host" dir={dir}>
        <Backdrop />
        <div className="host__stage host__stage--error">
          <div className="host__card">
            <div className="host__badge">
              <AlertIcon />
            </div>
            <h1 className="host__title">{t("errTitle")}</h1>
            <p className="host__text">{t("errText")}</p>
            <pre className="host__error" dir="ltr">{error}</pre>
            <div className="host__actions">
              <button type="button" className="host__btn host__btn--primary" onClick={() => window.location.reload()}>
                {t("errRetry")}
              </button>
              <a className="host__btn" href={repoUrl()} target="_blank" rel="noopener noreferrer">
                {t("errGithub")}
              </a>
              <a className="host__btn" href={`https://stackblitz.com/github/${repo}`} target="_blank" rel="noopener noreferrer">
                {t("errStackblitz")}
              </a>
              <a
                className="host__btn"
                href={`https://vercel.com/new/clone?repository-url=${encodeURIComponent(repoUrl())}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t("errVercel")}
              </a>
            </div>
            <p className="host__note" dir="ltr">
              {repo}@{getRef()}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const activeIndex = phase === "closing" ? STEPS.length : STEPS.findIndex((item) => item.id === step);
  const progress = phase === "closing" ? 100 : Math.round(((activeIndex + 0.5) / STEPS.length) * 100);

  return (
    <div className={`host${phase === "closing" ? " is-closing" : ""}`} dir={dir} role="status" aria-live="polite">
      <Backdrop />
      <div className="host__stage">
        <div className="host__brand">
          <div className="host__logo-wrap">
            <span className="host__logo-glow" aria-hidden="true" />
            <span className="host__logo-ring" aria-hidden="true" />
            <img className="host__logo" src={LOGO_URL} alt="Maalam" />
          </div>
          <h1 className="host__wordmark" dir="ltr">maalam</h1>
          <span className="host__beta">{t("betaChip")}</span>
          <p className="host__tagline">{t("loadTagline")}</p>
        </div>

        <ol className="host__steps">
          {STEPS.map((item, index) => {
            const state = index < activeIndex ? "done" : index === activeIndex ? "active" : "pending";
            return (
              <li key={item.id} className="host__step" data-state={state}>
                <span className="host__step-icon">
                  {state === "done" ? (
                    <span className="host__step-check">
                      <CheckIcon />
                    </span>
                  ) : state === "active" ? (
                    <span className="host__step-spinner" />
                  ) : (
                    <span className="host__step-dot" />
                  )}
                </span>
                <span className="host__step-label">{t(item.key)}</span>
              </li>
            );
          })}
        </ol>

        <div className="host__progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
          <span className="host__progress-fill" style={{ width: `${progress}%` }} />
        </div>
        <p className="host__hint">{t("loadHint")}</p>
      </div>
    </div>
  );
}
