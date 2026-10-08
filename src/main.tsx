import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { initI18n } from "./i18n";

// Language first: sets the page direction/title and starts translating the
// remote app's screens as soon as they appear.
initI18n();

// The host React tree only shows the loader / error screen.
// The real Maalam app is mounted into #root with its own React (from esm.sh).
createRoot(document.getElementById("host")!).render(<App />);
