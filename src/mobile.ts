import { addHomeStyles, createHomeNavigation, didAutoStart, syncSetupScreen, type HomeNav } from "./home";
import { getLang, onLangChange, openLanguageSheet, t, tr, uiDir } from "./i18n";
import {
  addHistoryStyles,
  getRestorableConversation,
  historyCount,
  openHistorySheet,
  resumeConversation,
  syncHistoryFromDom,
  triggerNewChat,
  type SavedConversation,
} from "./history";

type MobileView = "board" | "chat" | "settings";
type IconName = "chat" | "settings" | "forward" | "eraser" | "dots" | "close" | "spark" | "camera" | "upload" | "check" | "home" | "features" | "play" | "history" | "arrow" | "globe";
type ItemGroup = "attach" | "main" | "board" | "session";

/** One row in the left control panel. `run` holds a direct reference to the real action. */
type RailItem = {
  id: string;
  label: string;
  svg: string;
  disabled: boolean;
  pressed: boolean | null;
  group: ItemGroup;
  run: () => void;
};

// Phones only: narrow portrait screens, or compact touch devices in landscape.
// Desktop/tablet widths keep the original GitHub app layout unchanged.
const PHONE_QUERY = "(max-width: 767px), (max-width: 940px) and (orientation: landscape) and (pointer: coarse)";

// Fallback board detection (the real board is `.board-wrap`; this only matters
// if the GitHub app's markup changes in the future).
const BOARD_SELECTOR = [
  "[data-board]",
  '[data-testid*="board" i]',
  '[aria-label*="board" i]',
  '[class*="blackboard" i]',
  '[class*="chalkboard" i]',
  '[class*="board-stage" i]',
  '[class*="board-surface" i]',
  '[class*="board-canvas" i]',
  '[class*="board-viewport" i]',
  '[class*="board-frame" i]',
  '[class*="board-shell" i]',
  '[class*="board-area" i]',
  '[class*="board-container" i]',
  '[class*="board-host" i]',
  '[class*="board" i]',
].join(",");

const ICON_PATHS: Record<IconName, string> = {
  chat: '<path d="M20 11.5a7.5 7.5 0 0 1-8 7.5 8 8 0 0 1-3.5-.8L4 20l1.3-3.6A7.2 7.2 0 0 1 4 12c0-4.1 3.6-7.5 8-7.5s8 3.1 8 7Z"/><path d="M8 11h8M8 14h5"/>',
  settings:
    '<path d="M12 8.2a3.8 3.8 0 1 0 0 7.6 3.8 3.8 0 0 0 0-7.6Z"/><path d="m19.4 15 .1.1a1.7 1.7 0 0 1-2.4 2.4l-.1-.1a1.7 1.7 0 0 0-2.9 1.2v.2a1.7 1.7 0 0 1-3.4 0v-.2a1.7 1.7 0 0 0-2.9-1.2l-.1.1a1.7 1.7 0 0 1-2.4-2.4l.1-.1a1.7 1.7 0 0 0-1.2-2.9H4a1.7 1.7 0 0 1 0-3.4h.2a1.7 1.7 0 0 0 1.2-2.9l-.1-.1a1.7 1.7 0 0 1 2.4-2.4l.1.1a1.7 1.7 0 0 0 2.9-1.2V2a1.7 1.7 0 0 1 3.4 0v.2a1.7 1.7 0 0 0 2.9 1.2l.1-.1a1.7 1.7 0 0 1 2.4 2.4l-.1.1a1.7 1.7 0 0 0 1.2 2.9h.2a1.7 1.7 0 0 1 0 3.4h-.2a1.7 1.7 0 0 0-1.2 2.9Z"/>',
  forward: '<path d="m6 17 5-5-5-5"/><path d="m13 17 5-5-5-5"/>',
  eraser: '<path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21"/><path d="M22 21H7"/><path d="m5 11 9 9"/>',
  dots: '<circle cx="12" cy="5" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="12" cy="19" r="1.2"/>',
  close: '<path d="M18 6 6 18M6 6l12 12"/>',
  spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18"/>',
  camera: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5"/><path d="M12 3v12"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  home: '<path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M9 20v-6h6v6"/>',
  features: '<path d="M12 3 4.5 7v10L12 21l7.5-4V7L12 3Z"/><path d="m4.5 7 7.5 4 7.5-4M12 11v10"/>',
  play: '<path d="m9 18 6-6-6-6"/>',
  history: '<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/><path d="M12 7v5l3 2"/>',
  arrow: '<path d="M12 19V5"/><path d="m5 12 7-7 7 7"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a14 14 0 0 1 0 18"/><path d="M12 3a14 14 0 0 0 0 18"/>',
};

const PHONE_CSS = `
html.maalam-phone {
  --maalam-rail-size: 2.85rem;
  --maalam-rail-gutter: calc(3.35rem + env(safe-area-inset-left));
}

html.maalam-phone,
html.maalam-phone body {
  width: 100%;
  height: 100%;
  min-height: 100%;
  max-width: 100%;
  overflow: hidden;
  overscroll-behavior: none;
  -webkit-text-size-adjust: 100%;
}

html.maalam-phone #root {
  width: 100%;
  height: var(--maalam-viewport-height, 100dvh);
  min-height: var(--maalam-viewport-height, 100dvh);
  overflow: hidden;
}

/* ---- Phone shell: fixed, full-screen, board-first ---- */
html.maalam-phone .chat-shell {
  position: fixed !important;
  inset: 0 !important;
  z-index: 1 !important;
  display: flex !important;
  width: 100vw !important;
  max-width: 100vw !important;
  height: var(--maalam-viewport-height, 100dvh) !important;
  min-height: var(--maalam-viewport-height, 100dvh) !important;
  max-height: var(--maalam-viewport-height, 100dvh) !important;
  flex-direction: column !important;
  overflow: hidden !important;
  padding-top: 0 !important;
  padding-bottom: 0 !important;
}

/* Everything that used to sit on top of the blackboard is hidden:
   the app header, and the board's own top bar (title, badges, mini buttons). */
html.maalam-phone .chat-header,
html.maalam-phone .board-topbar {
  display: none !important;
}

/* Attach (paperclip) and Continue live in the left rail, not in the chat composer.
   They stay in the DOM, so the rail can still trigger the real buttons. */
html.maalam-phone .attach-button,
html.maalam-phone .continue-button {
  display: none !important;
}

/* Board always owns the full phone screen. */
html.maalam-phone .chat-shell [data-maalam-board-wrap] {
  position: fixed !important;
  inset: 0 !important;
  z-index: 1 !important;
  display: flex !important;
  width: 100vw !important;
  height: var(--maalam-viewport-height, 100dvh) !important;
  min-width: 0 !important;
  max-width: 100vw !important;
  min-height: var(--maalam-viewport-height, 100dvh) !important;
  max-height: var(--maalam-viewport-height, 100dvh) !important;
  flex: none !important;
  flex-direction: column !important;
  align-items: stretch !important;
  overflow: hidden !important;
}

html.maalam-phone .chat-shell [data-maalam-board-wrap]:not(.board-wrap) {
  margin: 0 !important;
  padding: 0 !important;
  gap: 0 !important;
}

html.maalam-phone .chat-shell [data-maalam-board-area] {
  position: relative !important;
  z-index: 1 !important;
  display: flex !important;
  width: 100% !important;
  height: 100% !important;
  min-width: 0 !important;
  min-height: 0 !important;
  flex: 1 1 auto !important;
  flex-direction: column !important;
  align-items: stretch !important;
  align-self: stretch !important;
  overflow: hidden !important;
}

html.maalam-phone .chat-shell [data-maalam-board-area]:not(.board-wrap) {
  margin: 0 !important;
  padding: 0 !important;
}

html.maalam-phone .chat-shell [data-maalam-board-area] > * {
  min-width: 0 !important;
  min-height: 0 !important;
  max-width: 100% !important;
  flex: 1 1 auto !important;
}

html.maalam-phone .chat-shell [data-maalam-board-root] {
  width: 100% !important;
  height: 100% !important;
  min-width: 0 !important;
  min-height: 0 !important;
  max-width: 100% !important;
  max-height: none !important;
  flex: 1 1 auto !important;
  align-self: stretch !important;
  aspect-ratio: auto !important;
}

/* The board: a left gutter holds the control rail, the blackboard fills the rest. */
html.maalam-phone .chat-shell .board-wrap {
  box-sizing: border-box !important;
  display: flex !important;
  flex-direction: column !important;
  width: 100% !important;
  max-width: none !important;
  height: 100% !important;
  min-height: 0 !important;
  max-height: none !important;
  margin: 0 !important;
  gap: 0 !important;
  padding:
    calc(0.4rem + env(safe-area-inset-top))
    calc(0.4rem + env(safe-area-inset-right))
    calc(0.4rem + env(safe-area-inset-bottom))
    var(--maalam-rail-gutter) !important;
}

html.maalam-phone .chat-shell .board-wrap .board-frame {
  width: 100% !important;
  max-width: none !important;
  height: auto !important;
  min-height: 0 !important;
  max-height: none !important;
  flex: 1 1 auto !important;
  aspect-ratio: auto !important;
}

html.maalam-phone .chat-shell [data-maalam-board-root] canvas,
html.maalam-phone .chat-shell [data-maalam-board-root] svg,
html.maalam-phone .chat-shell [data-maalam-board-root] img {
  max-width: 100% !important;
}

/* ---- Chat: transcript sheet sits directly above the composer ---- */
html.maalam-phone .chat-shell [data-maalam-chat-region] {
  position: absolute !important;
  z-index: 20 !important;
  inset-inline: 0 !important;
  inset-block-end: 0 !important;
  display: block !important;
  width: 100% !important;
  height: 0 !important;
  min-height: 0 !important;
  max-height: 0 !important;
  overflow: hidden !important;
  border-radius: 1.25rem 1.25rem 0 0 !important;
  background: rgba(10, 13, 14, 0.97) !important;
  box-shadow: 0 -18px 50px rgba(0, 0, 0, 0.45) !important;
  -webkit-backdrop-filter: blur(18px);
  backdrop-filter: blur(18px);
  transform: translateY(100%) !important;
  transition: transform 260ms cubic-bezier(0.22, 1, 0.36, 1) !important;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
}

html.maalam-phone .chat-shell[data-mobile-view="chat"] [data-maalam-chat-region] {
  inset-block-end: var(--maalam-composer-h, 0px) !important;
  height: min(52%, calc(var(--maalam-viewport-height, 100dvh) - var(--maalam-composer-h, 0px) - 3.5rem)) !important;
  max-height: min(52%, calc(var(--maalam-viewport-height, 100dvh) - var(--maalam-composer-h, 0px) - 3.5rem)) !important;
  overflow-y: auto !important;
  overflow-x: hidden !important;
  transform: translateY(0) !important;
}

html.maalam-phone.maalam-keyboard-open .chat-shell[data-mobile-view="chat"] [data-maalam-chat-region] {
  height: calc(var(--maalam-viewport-height, 100dvh) - var(--maalam-composer-h, 0px)) !important;
  max-height: calc(var(--maalam-viewport-height, 100dvh) - var(--maalam-composer-h, 0px)) !important;
  border-radius: 0 !important;
}

/* Sticky top strip of the chat sheet: drag down or tap the X to close. */
.maalam-chat-drag {
  position: sticky;
  z-index: 3;
  top: 0;
  display: grid;
  width: 100%;
  height: 2.2rem;
  place-items: center;
  background: rgba(10, 13, 14, 0.96);
  touch-action: none;
  cursor: grab;
  -webkit-tap-highlight-color: transparent;
}

.maalam-chat-drag:active {
  cursor: grabbing;
}

.maalam-chat-drag__grip {
  width: 2.6rem;
  height: 4px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.24);
}

.maalam-chat-close {
  position: absolute;
  top: 50%;
  left: 0.45rem;
  display: grid;
  width: 2.2rem;
  height: 2.2rem;
  place-items: center;
  transform: translateY(-50%);
  border: 0;
  border-radius: 0.7rem;
  background: rgba(255, 255, 255, 0.06);
  color: #c9d3cf;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}

.maalam-chat-close svg {
  width: 1rem;
  height: 1rem;
}

.maalam-chat-history {
  position: absolute;
  top: 50%;
  right: 0.45rem;
  display: grid;
  width: 2.2rem;
  height: 2.2rem;
  place-items: center;
  transform: translateY(-50%);
  border: 0;
  border-radius: 0.7rem;
  background: rgba(255, 255, 255, 0.06);
  color: #c9d3cf;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}

.maalam-chat-history svg {
  width: 1.05rem;
  height: 1.05rem;
}

/* Composer (input, chips, document panel). Hidden unless chat is open.
   Kept at z-index 30 (not negative) so overlays rendered inside it can still appear. */
html.maalam-phone .chat-shell .composer-area {
  position: absolute !important;
  z-index: 30 !important;
  inset-inline: 0 !important;
  inset-block-end: 0 !important;
  width: 100% !important;
  height: 0 !important;
  min-height: 0 !important;
  max-height: 0 !important;
  margin: 0 !important;
  padding: 0 !important;
  overflow: visible !important;
  visibility: hidden !important;
  pointer-events: none !important;
}

html.maalam-phone .chat-shell[data-mobile-view="chat"] .composer-area {
  display: block !important;
  width: 100% !important;
  height: auto !important;
  min-height: 0 !important;
  max-height: 46% !important;
  margin: 0 !important;
  padding-inline: max(0.55rem, env(safe-area-inset-left)) max(0.55rem, env(safe-area-inset-right)) !important;
  padding-top: 0.5rem !important;
  padding-bottom: max(0.45rem, env(safe-area-inset-bottom)) !important;
  overflow-x: hidden !important;
  overflow-y: auto !important;
  border-top: 1px solid rgba(255, 255, 255, 0.06) !important;
  background: rgba(10, 13, 14, 0.98) !important;
  visibility: visible !important;
  pointer-events: auto !important;
}

html.maalam-phone .chat-shell[data-mobile-view="chat"] .composer-area .composer-wrap {
  min-height: 3rem !important;
}

/* The app's own dialogs/pickers must never be able to trap the page invisibly. */
html.maalam-phone .teaching-dialog[open] {
  z-index: 10000 !important;
  visibility: visible !important;
  pointer-events: auto !important;
}

html.maalam-phone .teaching-dialog {
  box-sizing: border-box;
  width: min(34rem, calc(100vw - 1rem)) !important;
  max-width: 34rem !important;
  max-height: calc(var(--maalam-viewport-height, 100dvh) - env(safe-area-inset-top) - env(safe-area-inset-bottom) - 1rem) !important;
  margin: auto !important;
  overflow-y: auto !important;
  border-radius: 1.25rem !important;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
}

html.maalam-phone .media-picker-backdrop {
  position: fixed !important;
  inset: 0 !important;
  z-index: 10001 !important;
  visibility: visible !important;
  pointer-events: auto !important;
}

html.maalam-phone .media-picker {
  max-height: calc(var(--maalam-viewport-height, 100dvh) - 1rem) !important;
  overflow-y: auto !important;
}

/* While the rail hands a file to the app, the app's picker stays invisible. */
html.maalam-attach-busy .media-picker-backdrop {
  visibility: hidden !important;
  opacity: 0 !important;
  pointer-events: none !important;
}

html.maalam-phone .chat-shell :where(button, a, input, select, textarea) {
  scroll-margin-block: 1rem;
}

html.maalam-phone .chat-shell :where(img, video, canvas, svg) {
  max-width: 100%;
}

html.maalam-phone .chat-shell :where(input, select, textarea) {
  font-size: max(16px, 1em) !important;
}

.maalam-file-input {
  position: fixed;
  top: 0;
  left: -9999px;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}

/* ==== Left control rail (the only app UI on top of the board) ==== */
.maalam-rail {
  position: fixed;
  z-index: 9998;
  left: calc(0.25rem + env(safe-area-inset-left));
  bottom: calc(var(--maalam-viewport-height, 100dvh) * 0.26);
  --maalam-rail-panel-max: calc(var(--maalam-viewport-height, 100dvh) * 0.74 - 9.5rem - env(safe-area-inset-top));
  display: none;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.45rem;
  direction: ltr;
  font-family: "IBM Plex Sans Arabic", "Segoe UI", Tahoma, sans-serif;
  pointer-events: none;
}

html.maalam-phone .maalam-rail {
  display: flex;
}

/* While chatting / editing settings, the rail steps aside. */
html.maalam-phone .maalam-rail[data-view="chat"],
html.maalam-phone .maalam-rail[data-view="settings"],
html.maalam-phone.maalam-keyboard-open .maalam-rail,
html.maalam-phone:has(.media-picker-backdrop) .maalam-rail {
  display: none !important;
}

/* Rounded squares (not circles) for the two floating buttons. */
.maalam-rail__fab {
  position: relative;
  display: grid;
  width: var(--maalam-rail-size);
  height: var(--maalam-rail-size);
  flex: none;
  place-items: center;
  border: 1px solid rgba(127, 227, 196, 0.3);
  border-radius: 0.95rem;
  background: rgba(13, 20, 20, 0.82);
  color: #7fe3c4;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.42);
  -webkit-backdrop-filter: blur(14px);
  backdrop-filter: blur(14px);
  pointer-events: auto;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
  transition: transform 160ms ease, background 160ms ease, opacity 160ms ease;
}

.maalam-rail__fab:active {
  transform: scale(0.93);
}

.maalam-rail__fab svg {
  width: 1.3rem;
  height: 1.3rem;
  flex: none;
}

/* Toggle: dots when closed, X when open. */
.maalam-rail__toggle .rail-icon-close {
  display: none;
}

.maalam-rail[data-open="true"] .maalam-rail__toggle .rail-icon-open {
  display: none;
}

.maalam-rail[data-open="true"] .maalam-rail__toggle .rail-icon-close {
  display: block;
}

.maalam-rail[data-open="true"] .maalam-rail__toggle {
  background: rgba(52, 214, 164, 0.2);
  border-color: rgba(127, 227, 196, 0.55);
}

/* Connection status dot on the toggle. */
.maalam-rail__status {
  position: absolute;
  top: -0.18rem;
  right: -0.18rem;
  width: 0.66rem;
  height: 0.66rem;
  border: 2px solid #0d1414;
  border-radius: 999px;
  background: #52525b;
  pointer-events: none;
}

.maalam-rail__status[data-state="connected"] {
  background: #34d6a4;
  box-shadow: 0 0 8px rgba(52, 214, 164, 0.65);
}

.maalam-rail__status[data-state="connecting"] {
  background: #fbbf24;
}

/* Continue button (always visible on the left of the board). */
.maalam-rail__continue .fab-erase {
  display: none;
}

.maalam-rail__continue.is-erase .fab-forward {
  display: none;
}

.maalam-rail__continue.is-erase .fab-erase {
  display: block;
}

.maalam-rail__continue.is-erase {
  border-color: rgba(251, 191, 36, 0.6);
  color: #fbbf24;
  animation: maalam-rail-pulse 1.7s ease-in-out infinite;
}

.maalam-rail__continue.is-disabled {
  opacity: 0.32;
  pointer-events: none;
  animation: none;
}

.maalam-rail__continue[hidden] {
  display: none;
}

/* History button (always visible on the left of the board, above the toggle). */
.maalam-rail__history[hidden] {
  display: none;
}

.maalam-rail__badge {
  position: absolute;
  top: -0.42rem;
  left: -0.42rem;
  display: grid;
  min-width: 1.2rem;
  height: 1.2rem;
  place-items: center;
  padding-inline: 0.28rem;
  border-radius: 999px;
  background: linear-gradient(135deg, #43e3b1, #1fb88a);
  color: #06231b;
  font-size: 0.62rem;
  font-weight: 800;
  line-height: 1;
  pointer-events: none;
  box-shadow: 0 4px 12px rgba(31, 184, 138, 0.35);
}

.maalam-rail__badge[hidden] {
  display: none;
}

/* ================= Ask overlay: answer box / quiz over the example zone ================= */
.maalam-ask {
  position: fixed;
  z-index: 60;
  display: none;
  box-sizing: border-box;
  border: 1px solid rgba(127, 227, 196, 0.35);
  border-radius: 1rem;
  background: rgba(9, 14, 15, 0.95);
  box-shadow: 0 16px 44px rgba(0, 0, 0, 0.55), 0 0 0 3px rgba(52, 214, 164, 0.07);
  -webkit-backdrop-filter: blur(14px);
  backdrop-filter: blur(14px);
  padding: 0.55rem;
  direction: rtl;
  font-family: "IBM Plex Sans Arabic", "Segoe UI", Tahoma, sans-serif;
  animation: maalam-ask-in 200ms ease;
}

.maalam-ask[data-visible="true"] {
  display: block;
}

.maalam-ask__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0 0.15rem 0.45rem;
  cursor: grab;
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
}

.maalam-ask__head:active {
  cursor: grabbing;
}

.maalam-ask__title {
  color: #7fe3c4;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.maalam-ask__x {
  display: grid;
  width: 1.8rem;
  height: 1.8rem;
  flex: none;
  place-items: center;
  border: 0;
  border-radius: 0.55rem;
  background: rgba(255, 255, 255, 0.06);
  color: #93a09b;
  touch-action: manipulation;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}

.maalam-ask__x svg {
  width: 0.95rem;
  height: 0.95rem;
}

.maalam-ask__form {
  display: flex;
  align-items: flex-end;
  gap: 0.4rem;
}

/* Auto-growing textarea: one line by default, grows as the text wraps. */
.maalam-ask__input {
  box-sizing: border-box;
  flex: 1 1 auto;
  min-width: 0;
  min-height: 2.75rem;
  max-height: 8.25rem;
  resize: none;
  overflow-y: auto;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 0.8rem;
  background: rgba(0, 0, 0, 0.38);
  padding: 0.62rem 0.85rem;
  color: #eef2f0;
  font: inherit;
  font-size: 0.92rem;
  line-height: 1.45;
  outline: none;
  -webkit-text-size-adjust: 100%;
  scrollbar-width: none;
}

.maalam-ask__input::-webkit-scrollbar {
  display: none;
}

/* QCM clone: the app's own quiz panel, rendered exactly as in the chat box. */
.maalam-ask__clone {
  width: 100%;
  max-height: min(24rem, calc(var(--maalam-viewport-height, 100dvh) - 9rem));
  overflow-y: auto;
  overflow-x: hidden;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  background: transparent;
}

.maalam-ask__clone::-webkit-scrollbar {
  display: none;
}

.maalam-ask__clone input,
.maalam-ask__clone textarea,
.maalam-ask__clone select {
  font-size: max(16px, 1em);
}

/* Taps on the copied quiz must register on touch screens, and a choice that
   can't be answered yet (the tutor is still speaking) must look that way. */
.maalam-ask__clone button {
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
  cursor: pointer;
}

.maalam-ask__clone button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

/* Send button: unclickable until there is text AND the app is able to send it. */
.maalam-ask__send:disabled {
  background: rgba(255, 255, 255, 0.07);
  box-shadow: none;
  color: #5b6a65;
  cursor: not-allowed;
  opacity: 0.8;
}

.maalam-ask__input::placeholder {
  color: #6b7a75;
}

.maalam-ask__input:focus {
  border-color: rgba(127, 227, 196, 0.65);
}

.maalam-ask__send {
  display: grid;
  width: 2.75rem;
  height: 2.75rem;
  flex: none;
  place-items: center;
  border: 0;
  border-radius: 0.8rem;
  background: linear-gradient(135deg, #43e3b1, #1fb88a);
  color: #06231b;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}

.maalam-ask__send svg {
  width: 1.1rem;
  height: 1.1rem;
}

.maalam-ask__opts {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  max-height: min(16rem, calc(var(--maalam-viewport-height, 100dvh) * 0.55));
  overflow-y: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}

.maalam-ask__opts::-webkit-scrollbar {
  display: none;
}

.maalam-ask__opt {
  width: 100%;
  min-height: 2.75rem;
  padding: 0.55rem 0.75rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 0.8rem;
  background: rgba(255, 255, 255, 0.045);
  color: #dfe6e3;
  font: inherit;
  font-size: 0.84rem;
  font-weight: 600;
  line-height: 1.5;
  text-align: start;
  white-space: normal;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
  unicode-bidi: plaintext;
  transition: background 140ms ease, border-color 140ms ease;
}

.maalam-ask__opt:active {
  background: rgba(52, 214, 164, 0.16);
  border-color: rgba(127, 227, 196, 0.55);
}

@keyframes maalam-ask-in {
  from {
    opacity: 0;
    transform: translateY(-0.4rem);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .maalam-ask {
    animation: none;
  }
}

/* Beta reminder at the bottom of the tools menu. */
.maalam-rail__beta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.4rem;
  padding: 0.6rem 0.75rem 0.4rem;
  border-top: 1px solid rgba(255, 255, 255, 0.07);
  color: #9aa89f;
  font-size: 0.68rem;
  line-height: 1.4;
}

.maalam-rail__beta b {
  padding: 0.08rem 0.45rem;
  border-radius: 999px;
  background: #ffe066;
  color: #2b2300;
  font-size: 0.56rem;
  font-weight: 800;
  letter-spacing: 0.06em;
}

/* Status pill used while a saved conversation is being resumed. */
.maalam-toast {
  position: fixed;
  z-index: 10010;
  top: calc(0.9rem + env(safe-area-inset-top));
  left: 50%;
  max-width: min(22rem, calc(100vw - 2rem));
  padding: 0.65rem 1.1rem;
  border: 1px solid rgba(127, 227, 196, 0.3);
  border-radius: 999px;
  background: rgba(10, 16, 16, 0.95);
  box-shadow: 0 14px 40px rgba(0, 0, 0, 0.5);
  color: #dff7ee;
  font-family: "IBM Plex Sans Arabic", "Segoe UI", Tahoma, sans-serif;
  font-size: 0.82rem;
  font-weight: 600;
  line-height: 1.5;
  text-align: center;
  opacity: 0;
  pointer-events: none;
  transform: translate(-50%, -0.6rem);
  transition: opacity 200ms ease, transform 240ms cubic-bezier(0.22, 1, 0.36, 1);
}

.maalam-toast[data-show="true"] {
  opacity: 1;
  transform: translate(-50%, 0);
}

/* Blocking "turn your phone" overlay: landscape is obligatory on the board. */
.maalam-rotate {
  position: fixed;
  inset: 0;
  z-index: 10060;
  display: none;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
  background:
    radial-gradient(30rem 22rem at 50% -8%, rgba(52, 214, 164, 0.12), transparent 72%),
    #07090a;
  font-family: "IBM Plex Sans Arabic", "Segoe UI", Tahoma, sans-serif;
}

.maalam-rotate[data-show="true"] {
  display: flex;
}

.maalam-rotate__card {
  display: flex;
  flex-direction: column;
  align-items: center;
  max-width: 21rem;
  text-align: center;
}

.maalam-rotate__phone {
  position: relative;
  width: 3.4rem;
  height: 5.6rem;
  border: 3px solid #7fe3c4;
  border-radius: 0.9rem;
  box-shadow: 0 0 34px rgba(52, 214, 164, 0.25);
  animation: maalam-rotate-turn 1.8s ease-in-out infinite alternate;
}

.maalam-rotate__phone span {
  position: absolute;
  bottom: 0.55rem;
  left: 50%;
  width: 1.1rem;
  height: 3px;
  border-radius: 999px;
  background: rgba(127, 227, 196, 0.7);
  transform: translateX(-50%);
}

.maalam-rotate__title {
  margin: 1.2rem 0 0.5rem;
  color: #eef2f0;
  font-size: 1.25rem;
  font-weight: 700;
  line-height: 1.4;
}

.maalam-rotate__text {
  margin: 0;
  color: #93a09b;
  font-size: 0.9rem;
  line-height: 1.8;
}

@keyframes maalam-rotate-turn {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(90deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .maalam-rotate__phone {
    animation: none;
    transform: rotate(90deg);
  }
}

@keyframes maalam-rail-pulse {
  0%,
  100% {
    box-shadow: 0 0 0 0 rgba(251, 191, 36, 0.35);
  }
  50% {
    box-shadow: 0 0 0 10px rgba(251, 191, 36, 0);
  }
}

/* Expandable panel that lists every control, grouped. */
.maalam-rail__panel {
  display: flex;
  width: max-content;
  min-width: 11.5rem;
  max-width: min(15.5rem, calc(100vw - 4.5rem));
  max-height: 0;
  flex-direction: column;
  padding: 0;
  overflow: hidden;
  border: 1px solid transparent;
  border-radius: 1.1rem;
  background: rgba(13, 20, 20, 0.96);
  box-shadow: 0 14px 44px rgba(0, 0, 0, 0.5);
  -webkit-backdrop-filter: blur(20px);
  backdrop-filter: blur(20px);
  opacity: 0;
  visibility: hidden;
  transform: translateX(-0.5rem) scale(0.96);
  transform-origin: bottom left;
  transition:
    max-height 240ms cubic-bezier(0.22, 1, 0.36, 1),
    opacity 180ms ease,
    transform 240ms cubic-bezier(0.22, 1, 0.36, 1),
    padding 240ms ease,
    visibility 0s linear 240ms;
  pointer-events: none;
}

.maalam-rail[data-open="true"] .maalam-rail__panel {
  max-height: var(--maalam-rail-panel-max);
  padding: 0.3rem;
  overflow-y: auto;
  border-color: rgba(127, 227, 196, 0.22);
  opacity: 1;
  visibility: visible;
  transform: none;
  transition-delay: 0s;
  pointer-events: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
}

.maalam-rail__group {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.maalam-rail__group:empty {
  display: none;
}

.maalam-rail__group[data-sep="true"] {
  margin-top: 0.3rem;
  padding-top: 0.3rem;
  border-top: 1px solid rgba(255, 255, 255, 0.07);
}

.maalam-rail__item {
  display: flex;
  min-height: 2.65rem;
  flex: none;
  align-items: center;
  gap: 0.65rem;
  padding: 0 0.8rem 0 0.6rem;
  border: 0;
  border-radius: 0.8rem;
  background: transparent;
  color: #cfd9d5;
  font: inherit;
  font-size: 0.82rem;
  font-weight: 600;
  line-height: 1.2;
  text-align: start;
  white-space: nowrap;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
  transition: background 140ms ease, color 140ms ease;
}

.maalam-rail__item svg {
  width: 1.2rem;
  height: 1.2rem;
  flex: none;
}

.maalam-rail__item:active {
  background: rgba(52, 214, 164, 0.18);
}

.maalam-rail__item[aria-pressed="true"] {
  background: rgba(52, 214, 164, 0.14);
  color: #7fe3c4;
}

.maalam-rail__item:disabled {
  opacity: 0.32;
  pointer-events: none;
}

.maalam-rail__label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  unicode-bidi: plaintext;
}

/* Short screens (landscape phones): anchor the rail to the bottom-left corner. */
@media (max-height: 520px) {
  .maalam-rail {
    bottom: calc(0.5rem + env(safe-area-inset-bottom));
    --maalam-rail-panel-max: calc(var(--maalam-viewport-height, 100dvh) - 8.6rem - env(safe-area-inset-top) - env(safe-area-inset-bottom));
  }
}

/* ==== Phone settings sheet (replaces the app's modal dialog) ==== */
.maalam-sheet-backdrop {
  position: fixed;
  inset: 0;
  z-index: 10002;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: rgba(0, 0, 0, 0);
  transition: background 220ms ease;
  direction: rtl;
  font-family: "IBM Plex Sans Arabic", "Segoe UI", Tahoma, sans-serif;
}

.maalam-sheet-backdrop.is-in {
  background: rgba(0, 0, 0, 0.58);
}

.maalam-sheet {
  box-sizing: border-box;
  display: flex;
  width: 100%;
  max-width: 34rem;
  max-height: calc(var(--maalam-viewport-height, 100dvh) - 1.25rem - env(safe-area-inset-top));
  flex-direction: column;
  border: 1px solid rgba(127, 227, 196, 0.2);
  border-bottom: 0;
  border-radius: 1.4rem 1.4rem 0 0;
  background: #11171a;
  color: #f3f6f4;
  box-shadow: 0 -20px 60px rgba(0, 0, 0, 0.55);
  transform: translateY(100%);
  transition: transform 280ms cubic-bezier(0.22, 1, 0.36, 1);
}

.maalam-sheet-backdrop.is-in .maalam-sheet {
  transform: none;
}

.maalam-sheet__head {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 1rem 1rem 0.6rem;
}

.maalam-sheet__title {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 700;
}

.maalam-sheet__close {
  display: grid;
  width: 2.5rem;
  height: 2.5rem;
  flex: none;
  place-items: center;
  border: 0;
  border-radius: 0.8rem;
  background: rgba(255, 255, 255, 0.07);
  color: #c9d3cf;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}

.maalam-sheet__close svg {
  width: 1.05rem;
  height: 1.05rem;
}

.maalam-sheet__body {
  display: flex;
  min-height: 0;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 1.15rem;
  padding: 0.25rem 1rem 1rem;
  overflow-y: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
}

.maalam-sheet__legend {
  margin: 0 0 0.5rem;
  color: #93a09b;
  font-size: 0.8rem;
  font-weight: 600;
}

.maalam-sheet__options {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.maalam-opt {
  display: flex;
  width: 100%;
  min-height: 3.1rem;
  align-items: center;
  gap: 0.75rem;
  padding: 0.7rem 0.9rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 0.95rem;
  background: rgba(255, 255, 255, 0.03);
  color: inherit;
  font: inherit;
  text-align: start;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
  transition: border-color 140ms ease, background 140ms ease;
}

.maalam-opt[aria-checked="true"] {
  border-color: rgba(127, 227, 196, 0.6);
  background: rgba(52, 214, 164, 0.12);
}

.maalam-opt__box {
  position: relative;
  display: grid;
  width: 1.3rem;
  height: 1.3rem;
  flex: none;
  place-items: center;
  border: 2px solid rgba(255, 255, 255, 0.25);
  border-radius: 0.45rem;
  color: transparent;
}

.maalam-opt__box svg {
  width: 0.85rem;
  height: 0.85rem;
}

.maalam-opt[aria-checked="true"] .maalam-opt__box {
  border-color: #34d6a4;
  background: #34d6a4;
  color: #06231b;
}

.maalam-opt__text {
  min-width: 0;
  flex: 1 1 auto;
}

.maalam-opt__text strong {
  display: block;
  font-size: 0.9rem;
  font-weight: 650;
  line-height: 1.5;
}

.maalam-opt__text small {
  display: block;
  color: #93a09b;
  font-size: 0.74rem;
  line-height: 1.55;
}

.maalam-sheet__foot {
  flex: none;
  padding: 0.75rem 1rem calc(1rem + env(safe-area-inset-bottom));
  border-top: 1px solid rgba(255, 255, 255, 0.07);
}

.maalam-sheet__save {
  display: flex;
  width: 100%;
  min-height: 3.2rem;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  border: 0;
  border-radius: 1rem;
  background: linear-gradient(135deg, #43e3b1, #1fb88a);
  color: #06231b;
  font: inherit;
  font-size: 0.95rem;
  font-weight: 700;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}

.maalam-sheet__save svg {
  width: 1.1rem;
  height: 1.1rem;
}

.maalam-sheet__save:active {
  transform: scale(0.985);
}

@media (max-height: 520px) {
  .maalam-sheet {
    max-height: calc(var(--maalam-viewport-height, 100dvh) - 0.5rem);
  }
}

/* Home screen + bottom navigation styles live in home.ts. */

@media (max-width: 380px) {
  html.maalam-phone {
    --maalam-rail-size: 2.7rem;
    --maalam-rail-gutter: calc(3.15rem + env(safe-area-inset-left));
  }
}

@media (max-height: 720px) {
  html.maalam-phone .chat-shell[data-mobile-view="chat"] [data-maalam-chat-region] {
    height: min(60%, calc(var(--maalam-viewport-height, 100dvh) - var(--maalam-composer-h, 0px) - 2.5rem)) !important;
    max-height: min(60%, calc(var(--maalam-viewport-height, 100dvh) - var(--maalam-composer-h, 0px) - 2.5rem)) !important;
  }
}

@media (prefers-reduced-motion: reduce) {
  html.maalam-phone .chat-shell [data-maalam-chat-region],
  .maalam-rail__panel,
  .maalam-rail__fab,
  .maalam-rail__item,
  .maalam-sheet,
  .maalam-sheet-backdrop {
    transition: none;
    animation: none;
  }

  .maalam-rail__continue.is-erase {
    animation: none;
  }
}
`;

function classNames(element: Element): string {
  return `${element.getAttribute("class") ?? ""} ${element.getAttribute("data-testid") ?? ""} ${element.getAttribute("aria-label") ?? ""}`;
}

function visible(element: HTMLElement): boolean {
  const style = window.getComputedStyle(element);
  const rect = element.getBoundingClientRect();
  return style.display !== "none" && style.visibility !== "hidden" && rect.width > 40 && rect.height > 30;
}

function addStyles(): void {
  if (document.getElementById("maalam-phone-styles")) return;
  const style = document.createElement("style");
  style.id = "maalam-phone-styles";
  style.textContent = PHONE_CSS;
  document.head.appendChild(style);
}

function icon(name: IconName): string {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON_PATHS[name]}</svg>`;
}

/** Strips Arabic diacritics so label matching survives spelling variants. */
function plain(value: string): string {
  return value.replace(/[\u064B-\u065F\u0670\u0640]/g, "");
}

function textOf(element: Element | null | undefined): string {
  return (element?.textContent ?? "").replace(/\s+/g, " ").trim();
}

function labelOf(button: HTMLElement): string {
  return (button.getAttribute("aria-label") || button.getAttribute("title") || button.textContent || "")
    .replace(/\s+/g, " ")
    .trim();
}

let toastEl: HTMLElement | null = null;
let toastTimer = 0;

/** A small status pill at the top of the screen. `ms = 0` keeps it until hidden. */
function showToast(text: string, ms = 0): void {
  if (!toastEl || !toastEl.isConnected) {
    toastEl = document.createElement("div");
    toastEl.className = "maalam-toast";
    toastEl.setAttribute("role", "status");
    toastEl.setAttribute("aria-live", "polite");
    document.body.appendChild(toastEl);
  }
  toastEl.textContent = text;
  toastEl.dir = uiDir();
  void toastEl.offsetWidth; // let the entry transition run from the hidden state
  toastEl.dataset.show = "true";
  window.clearTimeout(toastTimer);
  if (ms > 0) toastTimer = window.setTimeout(hideToast, ms);
}

function hideToast(): void {
  window.clearTimeout(toastTimer);
  if (toastEl) toastEl.dataset.show = "false";
}

/* ================= Landscape enforcement (phones) =================
   Pressing Start rotates the phone to landscape automatically (fullscreen +
   orientation lock on Android). While the board exists and the phone is still
   in portrait, a full-screen prompt blocks the app until it is turned. */

let rotateEl: HTMLElement | null = null;
let landscapeHeld = false;

function isLandscapeNow(): boolean {
  const type = screen.orientation?.type ?? "";
  if (type.startsWith("landscape")) return true;
  if (type.startsWith("portrait")) return false;
  return window.innerWidth >= window.innerHeight;
}

function enforceLandscapeLock(): void {
  void (async () => {
    try {
      if (!document.fullscreenElement && typeof document.documentElement.requestFullscreen === "function") {
        await document.documentElement.requestFullscreen({ navigationUI: "hide" }).catch(() => undefined);
      }
    } catch {
      /* Fullscreen unsupported (e.g. iPhone Safari): the user rotates manually. */
    }
    try {
      const orientation = screen.orientation as (ScreenOrientation & { lock?: (value: string) => Promise<void> }) | undefined;
      if (orientation && typeof orientation.lock === "function") {
        await orientation.lock("landscape");
      }
    } catch {
      /* Lock unsupported or refused: the overlay instructs a manual rotation. */
    }
  })();
}

function releaseLandscapeLock(): void {
  try {
    screen.orientation?.unlock();
  } catch {
    /* ignore */
  }
  try {
    if (document.fullscreenElement && typeof document.exitFullscreen === "function") {
      void document.exitFullscreen().catch(() => undefined);
    }
  } catch {
    /* ignore */
  }
}

function renderRotateOverlay(): void {
  if (!rotateEl) return;
  rotateEl.dir = uiDir();
  const title = rotateEl.querySelector(".maalam-rotate__title");
  const text = rotateEl.querySelector(".maalam-rotate__text");
  if (title) title.textContent = t("rotateTitle");
  if (text) text.textContent = t("rotateText");
}

function ensureRotateOverlay(): HTMLElement {
  if (rotateEl && rotateEl.isConnected) return rotateEl;
  const overlay = document.createElement("div");
  overlay.className = "maalam-rotate";
  overlay.dataset.show = "false";
  overlay.setAttribute("role", "alertdialog");
  overlay.innerHTML = `
    <div class="maalam-rotate__card">
      <div class="maalam-rotate__phone" aria-hidden="true"><span></span></div>
      <h2 class="maalam-rotate__title"></h2>
      <p class="maalam-rotate__text"></p>
    </div>`;
  document.body.appendChild(overlay);
  rotateEl = overlay;
  // Tapping while blocked retries the automatic rotation (Android).
  overlay.addEventListener("pointerdown", () => {
    if (overlay.dataset.show === "true") enforceLandscapeLock();
  });
  renderRotateOverlay();
  return overlay;
}

function syncRotateOverlay(blocked: boolean): void {
  const overlay = ensureRotateOverlay();
  const next = blocked ? "true" : "false";
  if (overlay.dataset.show === next) return;
  if (blocked) renderRotateOverlay();
  overlay.dataset.show = next;
}

// Start (connect) press on a phone → switch to landscape automatically.
document.addEventListener(
  "click",
  (event) => {
    const start = (event.target as HTMLElement).closest?.(".setup-screen .connect-button");
    if (!start || !window.matchMedia(PHONE_QUERY).matches) return;
    landscapeHeld = true;
    enforceLandscapeLock();
  },
  true,
);

/** Clicks a real app button even while its container is hidden. */
function activate(button: HTMLButtonElement | null | undefined): void {
  if (!button || button.disabled) return;
  button.click();
}

/** Fills a real input/textarea the way typing would, so React's state updates too. */
function setNativeValue(input: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  const prototype =
    input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  if (setter) setter.call(input, value);
  else input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function waitFor<T>(find: () => T | null, timeoutMs: number): Promise<T | null> {
  return new Promise((resolve) => {
    const start = performance.now();
    const tick = () => {
      const found = find();
      if (found) {
        resolve(found);
        return;
      }
      if (performance.now() - start > timeoutMs) {
        resolve(null);
        return;
      }
      window.requestAnimationFrame(tick);
    };
    tick();
  });
}

type BoardButtons = {
  erase?: HTMLButtonElement;
  focus?: HTMLButtonElement;
  collapse?: HTMLButtonElement;
};

/**
 * Classifies the board's own (hidden) top-bar buttons by their label.
 * Matching by label — not by position — keeps this stable when the app
 * shows/hides buttons.
 */
function readBoardButtons(shell: HTMLElement): BoardButtons {
  const result: BoardButtons = {};
  const buttons = Array.from(shell.querySelectorAll<HTMLButtonElement>(".board-topbar-actions .board-mini-button"));
  for (const button of buttons) {
    const label = plain(labelOf(button));
    if (/^(?:امسح|مسح)/.test(label) || button.classList.contains("is-erase-request")) result.erase ??= button;
    else if (label.includes("كبر") || label.includes("صغر")) result.focus ??= button;
    else if (label.includes("خبي") || label.includes("وري")) result.collapse ??= button;
  }
  return result;
}

type Rail = {
  root: HTMLElement;
  groups: Record<ItemGroup, HTMLElement>;
  continueButton: HTMLButtonElement;
  historyButton: HTMLButtonElement;
  relabel: () => void;
  status: HTMLElement;
  setOpen: (open: boolean) => void;
  isOpen: () => boolean;
  destroy: () => void;
};

function createRail(onContinue: () => void, onHistory: () => void): Rail {
  const root = document.createElement("div");
  root.className = "maalam-rail";
  root.dataset.open = "false";
  root.dataset.view = "board";
  root.innerHTML = `
    <div class="maalam-rail__panel" id="maalam-rail-panel" role="menu" aria-label="${t("toolsMenu")}">
      <div class="maalam-rail__group" data-group="attach"></div>
      <div class="maalam-rail__group" data-group="main"></div>
      <div class="maalam-rail__group" data-group="board"></div>
      <div class="maalam-rail__group" data-group="session"></div>
      <div class="maalam-rail__beta"><b>${t("betaChip")}</b><span>${t("betaShort")}</span></div>
    </div>
    <button class="maalam-rail__fab maalam-rail__history" type="button" aria-label="${t("history")}">
      ${icon("history")}
      <span class="maalam-rail__badge" hidden aria-hidden="true"></span>
    </button>
    <button class="maalam-rail__fab maalam-rail__toggle" type="button" aria-expanded="false" aria-controls="maalam-rail-panel" aria-label="${t("toolsMenu")}">
      <span class="rail-icon-open">${icon("dots")}</span>
      <span class="rail-icon-close">${icon("close")}</span>
      <span class="maalam-rail__status" data-state="disconnected" aria-hidden="true"></span>
    </button>
    <button class="maalam-rail__fab maalam-rail__continue is-disabled" type="button" aria-label="${t("continueLesson")}">
      <span class="fab-forward">${icon("forward")}</span>
      <span class="fab-erase">${icon("eraser")}</span>
    </button>
  `;

  const toggle = root.querySelector<HTMLButtonElement>(".maalam-rail__toggle")!;
  const continueButton = root.querySelector<HTMLButtonElement>(".maalam-rail__continue")!;
  const historyButton = root.querySelector<HTMLButtonElement>(".maalam-rail__history")!;
  const status = root.querySelector<HTMLElement>(".maalam-rail__status")!;

  const isOpen = () => root.dataset.open === "true";
  const setOpen = (open: boolean) => {
    root.dataset.open = String(open);
    toggle.setAttribute("aria-expanded", String(open));
  };

  toggle.addEventListener("click", () => setOpen(!isOpen()));
  continueButton.addEventListener("click", onContinue);
  historyButton.addEventListener("click", onHistory);

  /** Refreshes the static labels when the interface language changes. */
  const relabel = () => {
    root.querySelector(".maalam-rail__panel")?.setAttribute("aria-label", t("toolsMenu"));
    toggle.setAttribute("aria-label", t("toolsMenu"));
    historyButton.setAttribute("aria-label", t("history"));
    const chip = root.querySelector(".maalam-rail__beta b");
    const note = root.querySelector(".maalam-rail__beta span");
    if (chip) chip.textContent = t("betaChip");
    if (note) note.textContent = t("betaShort");
  };

  const onOutside = (event: PointerEvent) => {
    if (isOpen() && !root.contains(event.target as Node)) setOpen(false);
  };
  const onKey = (event: KeyboardEvent) => {
    if (event.key === "Escape" && isOpen()) setOpen(false);
  };
  document.addEventListener("pointerdown", onOutside, true);
  document.addEventListener("keydown", onKey);

  return {
    root,
    groups: {
      attach: root.querySelector<HTMLElement>('[data-group="attach"]')!,
      main: root.querySelector<HTMLElement>('[data-group="main"]')!,
      board: root.querySelector<HTMLElement>('[data-group="board"]')!,
      session: root.querySelector<HTMLElement>('[data-group="session"]')!,
    },
    continueButton,
    historyButton,
    relabel,
    status,
    setOpen,
    isOpen,
    destroy: () => {
      document.removeEventListener("pointerdown", onOutside, true);
      document.removeEventListener("keydown", onKey);
      root.remove();
    },
  };
}

/** Adds a sticky strip (drag handle + history + close buttons) to the top of the chat sheet. */
function bindChatSheet(region: HTMLElement, close: () => void, onHistory: () => void): void {
  if (region.dataset.maalamChatDragBound === "true") return;
  region.dataset.maalamChatDragBound = "true";

  const strip = document.createElement("div");
  strip.className = "maalam-chat-drag";
  strip.innerHTML = `<span class="maalam-chat-drag__grip" aria-hidden="true"></span>
    <button class="maalam-chat-close" type="button" aria-label="${t("closeChat")}">${icon("close")}</button>
    <button class="maalam-chat-history" type="button" aria-label="${t("history")}">${icon("history")}</button>`;
  region.prepend(strip);

  strip.querySelector<HTMLButtonElement>(".maalam-chat-close")?.addEventListener("click", close);
  strip.querySelector<HTMLButtonElement>(".maalam-chat-history")?.addEventListener("click", onHistory);

  let startY = 0;
  let dragY = 0;
  let active = false;

  strip.addEventListener("pointerdown", (event) => {
    if ((event.target as HTMLElement).closest("button")) return;
    if (region.getBoundingClientRect().height <= 0) return;
    active = true;
    startY = event.clientY;
    dragY = 0;
    strip.setPointerCapture(event.pointerId);
  });

  strip.addEventListener("pointermove", (event) => {
    if (!active) return;
    dragY = Math.max(0, event.clientY - startY);
    region.style.transition = "none";
    region.style.transform = `translateY(${dragY}px)`;
  });

  const end = () => {
    if (!active) return;
    active = false;
    region.style.transition = "";
    region.style.transform = "";
    if (dragY > 90) close();
  };

  strip.addEventListener("pointerup", end);
  strip.addEventListener("pointercancel", end);
}

/* ==================================================================== */
/* Settings sheet: mirrors the app's teaching-settings form, no modal.   */
/* ==================================================================== */

type SheetField =
  | { kind: "radio"; legend: string; options: { input: HTMLInputElement; title: string; desc: string }[] }
  | { kind: "select"; label: string; select: HTMLSelectElement; options: { value: string; text: string }[] };

type SettingsForm = { form: HTMLFormElement; fields: SheetField[] };

/** Reads the controls out of the app's (closed) teaching dialog. */
function readSettingsForm(shell: HTMLElement): SettingsForm | null {
  const form = shell.querySelector<HTMLFormElement>(".teaching-dialog form");
  if (!form) return null;
  const fields: SheetField[] = [];

  form.querySelectorAll<HTMLFieldSetElement>("fieldset").forEach((fieldset) => {
    const radios = Array.from(fieldset.querySelectorAll<HTMLInputElement>('input[type="radio"]'));
    if (!radios.length) return;
    fields.push({
      kind: "radio",
      legend: textOf(fieldset.querySelector("legend")),
      options: radios.map((input) => {
        const label = input.closest("label");
        return {
          input,
          title: textOf(label?.querySelector("strong")) || textOf(label),
          desc: textOf(label?.querySelector("small")),
        };
      }),
    });
  });

  form.querySelectorAll<HTMLSelectElement>("select").forEach((select) => {
    const label = select.id ? form.querySelector<HTMLLabelElement>(`label[for="${CSS.escape(select.id)}"]`) : null;
    fields.push({
      kind: "select",
      label: textOf(label),
      select,
      options: Array.from(select.options).map((option) => ({ value: option.value, text: textOf(option) })),
    });
  });

  return fields.length ? { form, fields } : null;
}

function setNativeSelectValue(select: HTMLSelectElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
  if (setter) setter.call(select, value);
  else select.value = value;
  select.dispatchEvent(new Event("change", { bubbles: true }));
}

/** Opens the phone settings sheet. Changes are applied to the real form only on Save. */
function openSettingsSheet(data: SettingsForm, onClosed: () => void): () => void {
  // Current choice per field: option index for radios, value for selects.
  const choice: (number | string)[] = data.fields.map((field) =>
    field.kind === "radio"
      ? Math.max(0, field.options.findIndex((option) => option.input.checked))
      : field.select.value,
  );

  const backdrop = document.createElement("div");
  backdrop.className = "maalam-sheet-backdrop";

  const sheet = document.createElement("section");
  sheet.className = "maalam-sheet";
  sheet.setAttribute("role", "dialog");
  sheet.setAttribute("aria-modal", "true");
  sheet.setAttribute("aria-labelledby", "maalam-sheet-title");
  sheet.dir = uiDir();

  const head = document.createElement("header");
  head.className = "maalam-sheet__head";
  head.innerHTML = `<h2 class="maalam-sheet__title" id="maalam-sheet-title">${t("settings")}</h2>
    <button class="maalam-sheet__close" type="button" aria-label="${t("close")}">${icon("close")}</button>`;

  const body = document.createElement("div");
  body.className = "maalam-sheet__body";

  const foot = document.createElement("footer");
  foot.className = "maalam-sheet__foot";
  foot.innerHTML = `<button class="maalam-sheet__save" type="button">${icon("check")}<span>${t("saveSettings")}</span></button>`;

  const optionButtons: HTMLButtonElement[][] = [];

  const paint = () => {
    data.fields.forEach((field, fieldIndex) => {
      optionButtons[fieldIndex].forEach((button, optionIndex) => {
        const selected =
          field.kind === "radio" ? choice[fieldIndex] === optionIndex : choice[fieldIndex] === field.options[optionIndex].value;
        button.setAttribute("aria-checked", String(selected));
      });
    });
  };

  data.fields.forEach((field, fieldIndex) => {
    const wrap = document.createElement("div");
    const legend = document.createElement("p");
    legend.className = "maalam-sheet__legend";
    legend.textContent = field.kind === "radio" ? field.legend : field.label;
    const list = document.createElement("div");
    list.className = "maalam-sheet__options";
    list.setAttribute("role", "radiogroup");
    wrap.append(legend, list);
    body.appendChild(wrap);

    optionButtons[fieldIndex] = [];
    field.options.forEach((option, optionIndex) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "maalam-opt";
      button.setAttribute("role", "radio");
      const title = "title" in option ? option.title : option.text;
      const desc = "desc" in option ? option.desc : "";
      button.innerHTML = `<span class="maalam-opt__box">${icon("check")}</span><span class="maalam-opt__text"><strong></strong>${desc ? "<small></small>" : ""}</span>`;
      const strong = button.querySelector("strong");
      const small = button.querySelector("small");
      if (strong) strong.textContent = title;
      if (small) small.textContent = desc;
      button.addEventListener("click", () => {
        choice[fieldIndex] = field.kind === "radio" ? optionIndex : field.options[optionIndex].value;
        paint();
      });
      list.appendChild(button);
      optionButtons[fieldIndex].push(button);
    });
  });

  sheet.append(head, body, foot);
  backdrop.appendChild(sheet);
  document.body.appendChild(backdrop);
  paint();
  window.requestAnimationFrame(() => backdrop.classList.add("is-in"));

  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    document.removeEventListener("keydown", onKey);
    backdrop.classList.remove("is-in");
    window.setTimeout(() => backdrop.remove(), 260);
    onClosed();
  };
  const onKey = (event: KeyboardEvent) => {
    if (event.key === "Escape") close();
  };
  document.addEventListener("keydown", onKey);

  backdrop.addEventListener("pointerdown", (event) => {
    if (event.target === backdrop) close();
  });
  head.querySelector<HTMLButtonElement>(".maalam-sheet__close")?.addEventListener("click", close);

  foot.querySelector<HTMLButtonElement>(".maalam-sheet__save")?.addEventListener("click", () => {
    // 1) Drive the real controls so the app's own state updates.
    data.fields.forEach((field, fieldIndex) => {
      if (field.kind === "radio") {
        const target = field.options[choice[fieldIndex] as number]?.input;
        if (target && !target.checked) target.click();
      } else if (field.select.value !== choice[fieldIndex]) {
        setNativeSelectValue(field.select, String(choice[fieldIndex]));
      }
    });
    // 2) Submit the real form once React has applied those changes.
    window.setTimeout(() => {
      const submit = data.form.querySelector<HTMLButtonElement>('button[type="submit"]');
      if (typeof data.form.requestSubmit === "function") data.form.requestSubmit(submit ?? undefined);
      else submit?.click();
    }, 90);
    close();
  });

  return close;
}

function findBoardRoot(shell: HTMLElement): HTMLElement | null {
  const known = shell.querySelector<HTMLElement>(".board-wrap");
  if (known) return known;

  const candidates = Array.from(shell.querySelectorAll<HTMLElement>(BOARD_SELECTOR));
  let best: HTMLElement | null = null;
  let bestScore = -Infinity;

  for (const element of candidates) {
    if (element.closest(".chat-header, .composer-area, .teaching-dialog, .maalam-rail")) continue;
    if (["BUTTON", "INPUT", "TEXTAREA", "SELECT", "SVG", "PATH"].includes(element.tagName)) continue;
    if (!visible(element)) continue;

    const text = classNames(element).toLowerCase();
    const rect = element.getBoundingClientRect();
    let score = Math.log2(Math.max(1, rect.width * rect.height));
    if (/blackboard|chalkboard/.test(text)) score += 80;
    else if (/board[-_ ]?(stage|surface|canvas|viewport|frame|shell|area|container|host|root)/.test(text)) score += 60;
    else if (/board/.test(text)) score += 25;
    if (element.querySelector("svg, canvas")) score += 3;
    if (rect.width / Math.max(rect.height, 1) > 1.25) score += 4;
    if (/toolbar|tool|action|button|controls?/.test(text)) score -= 30;
    if (score > bestScore) {
      best = element;
      bestScore = score;
    }
  }

  return best;
}

function findChatRegion(shell: HTMLElement, boardRoot: HTMLElement | null): HTMLElement | null {
  const isBoardRelated = (element: HTMLElement) =>
    Boolean(boardRoot && (element === boardRoot || element.contains(boardRoot) || boardRoot.contains(element)));

  const message = shell.querySelector<HTMLElement>(".message-enter");
  if (message) {
    let node: HTMLElement | null = message;
    let best: HTMLElement | null = null;
    while (node && node !== shell) {
      const style = window.getComputedStyle(node);
      const hasScroll = /auto|scroll/.test(`${style.overflowY} ${style.overflow}`);
      if ((node.tagName === "SECTION" || hasScroll) && !isBoardRelated(node)) best = node;
      node = node.parentElement;
    }
    if (best) return best;
  }

  const scrollable = Array.from(shell.querySelectorAll<HTMLElement>("section, main, div"))
    .filter((element) => {
      if (element.closest("footer, .composer-area, .chat-header, .teaching-dialog") || isBoardRelated(element)) return false;
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return visible(element) && rect.width > 160 && rect.height > 100 && /auto|scroll/.test(`${style.overflowY} ${style.overflow}`);
    })
    .sort((a, b) => b.clientHeight * b.clientWidth - a.clientHeight * a.clientWidth);
  if (scrollable[0]) return scrollable[0];

  const sections = Array.from(shell.querySelectorAll<HTMLElement>("section, [class*='max-w-3xl']"))
    .filter((element) => !element.closest("footer, .composer-area, .chat-header, .teaching-dialog") && !isBoardRelated(element))
    .filter(
      (element) =>
        element.matches("[class*='max-w-3xl']") ||
        boardRoot !== null ||
        Boolean(element.querySelector(".message-enter, .thinking-bars, [aria-live='polite']")),
    )
    .filter(visible)
    .sort((a, b) => b.clientHeight * b.clientWidth - a.clientHeight * a.clientWidth);
  if (sections[0]) return sections[0];

  const composer = shell.querySelector<HTMLElement>(".composer-area");
  let sibling = composer?.closest("footer")?.previousElementSibling as HTMLElement | null;
  for (let depth = 0; sibling && depth < 5; depth += 1) {
    if (!isBoardRelated(sibling) && !sibling.closest(".chat-header")) return sibling;
    sibling = sibling.previousElementSibling as HTMLElement | null;
  }
  return null;
}

function markLayout(shell: HTMLElement): void {
  const boardRoot = findBoardRoot(shell);
  const cachedChat = shell.querySelector<HTMLElement>("[data-maalam-chat-region]");
  const hasMessages = Boolean(shell.querySelector(".message-enter"));
  const chatRegion = !hasMessages && cachedChat ? cachedChat : findChatRegion(shell, boardRoot);
  const composer = shell.querySelector<HTMLElement>(".composer-area");

  if (boardRoot) {
    boardRoot.dataset.maalamBoardRoot = "true";
    let area: HTMLElement = boardRoot;
    let parent = area.parentElement;
    while (
      parent &&
      parent !== shell &&
      !parent.contains(chatRegion) &&
      !parent.contains(composer) &&
      !parent.querySelector(".chat-header")
    ) {
      area = parent;
      parent = area.parentElement;
    }
    area.dataset.maalamBoardArea = "true";
    let ancestor = area.parentElement;
    let depth = 0;
    while (ancestor && ancestor !== shell && depth < 6) {
      ancestor.dataset.maalamBoardWrap = "true";
      ancestor = ancestor.parentElement;
      depth += 1;
    }
  }

  if (chatRegion && chatRegion !== shell) {
    if (cachedChat && cachedChat !== chatRegion) cachedChat.removeAttribute("data-maalam-chat-region");
    chatRegion.dataset.maalamChatRegion = "true";
  }
  if (composer) composer.dataset.maalamComposer = "true";
}

export function installPhoneExperience(): void {
  addStyles();
  addHomeStyles();
  addHistoryStyles();

  const media = window.matchMedia(PHONE_QUERY);
  const root = document.documentElement;

  // The remote app marks the API-key field autofocus. Shield only that one
  // automatic focus during its first paint, so a returning user opens at the
  // home screen instead of being dumped at the bottom with the keyboard up.
  const focusPrototype = HTMLElement.prototype;
  const nativeFocus = focusPrototype.focus;
  const focusShieldUntil = performance.now() + 1400;
  let humanFocusIntentUntil = 0;
  const markHumanFocusIntent = () => {
    humanFocusIntentUntil = performance.now() + 1800;
  };
  const focusGuard = function (this: HTMLElement, options?: FocusOptions): void {
    if (
      performance.now() < focusShieldUntil &&
      performance.now() > humanFocusIntentUntil &&
      this.matches(".setup-screen .key-field input")
    ) {
      return;
    }
    nativeFocus.call(this, options);
  };
  focusPrototype.focus = focusGuard;
  document.addEventListener("pointerdown", markHumanFocusIntent, true);
  document.addEventListener("keydown", markHumanFocusIntent, true);
  window.setTimeout(() => {
    document.removeEventListener("pointerdown", markHumanFocusIntent, true);
    document.removeEventListener("keydown", markHumanFocusIntent, true);
    if (focusPrototype.focus === focusGuard) focusPrototype.focus = nativeFocus;
  }, 1700);

  let activeShell: HTMLElement | null = null;
  let currentView: MobileView = "board";
  let rail: Rail | null = null;
  let homeNav: HomeNav | null = null;
  let attrObserver: MutationObserver | null = null;
  let closeSheet: (() => void) | null = null;
  let closeHistory: (() => void) | null = null;
  let restoreDone = false;
  let historyTouched = false;
  let observedComposer: HTMLElement | null = null;
  let composerHeight = "";
  let itemSignature = "";
  let lastExpandAt = 0;

  /* Ask overlay state: the temporary answer box / quiz shown over the example zone. */
  let askOverlay: HTMLElement | null = null;
  let askSignature = "";
  /** Each QCM / teacher question is tracked on its own: shown until answered or dismissed. */
  const askSeen = new Map<string, { users: number; dismissed: boolean }>();
  /** HTML of the app's quiz panel the overlay copy was built from (to keep the copy in sync). */
  let askCloneHtml = "";
  /** True while a finger is on the copied quiz, so it is never swapped out mid-tap. */
  let askCloneTouching = false;
  /** Text currently mirrored into the app's real (hidden) composer. */
  let askMirror = "";
  let askPositionKey: string | null = null;
  let askPosition: { left: number; top: number } | null = null;
  /** Chat box opened from the "الدردشة" control: lives in the example zone. */
  let chatBoxOpen = false;
  let focusChatBox = false;
  let pendingFrame = 0;
  let viewportBaseline = window.visualViewport?.height ?? window.innerHeight;

  const composerObserver = new ResizeObserver(() => scheduleReconcile());

  /* ---- Interface language ---- */
  let closeLang: (() => void) | null = null;

  const openLanguage = () => {
    // Tapping the entry again dismisses the sheet.
    if (closeLang) {
      closeLang();
      return;
    }
    rail?.setOpen(false);
    closeLang = openLanguageSheet(() => {
      closeLang = null;
      itemSignature = "";
      scheduleReconcile();
    });
  };

  // Everything built from translated strings is refreshed in place, so the
  // board, the open chat box and any sheet keep their state.
  onLangChange(() => {
    rail?.relabel();
    itemSignature = "";
    askSignature = "";
    document
      .querySelectorAll<HTMLElement>(".maalam-chat-close")
      .forEach((node) => node.setAttribute("aria-label", t("closeChat")));
    document
      .querySelectorAll<HTMLElement>(".maalam-chat-history")
      .forEach((node) => node.setAttribute("aria-label", t("history")));
    scheduleReconcile();
  });

  const syncViewport = () => {
    const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
    if (viewportHeight > 0) {
      root.style.setProperty("--maalam-viewport-height", `${Math.round(viewportHeight)}px`);
    }

    const focusedEditor =
      document.activeElement instanceof HTMLElement &&
      Boolean(document.activeElement.closest("input, textarea, select, [contenteditable='true']"));
    if (!focusedEditor) viewportBaseline = viewportHeight;
    root.classList.toggle("maalam-keyboard-open", media.matches && focusedEditor && viewportBaseline - viewportHeight > 110);
  };

  const setView = (view: MobileView) => {
    currentView = view;
    if (activeShell) activeShell.dataset.mobileView = view;
    if (rail) {
      rail.setOpen(false);
      rail.root.dataset.view = view;
    }
  };

  /** "الدردشة" opens the chat box in the board's example zone (not the sheet). */
  const openChat = () => {
    if (!activeShell) return;
    if (closeSheet) {
      closeSheet();
      closeSheet = null;
    }
    closeHistorySheet();
    if (currentView === "chat") {
      setView("board");
      return;
    }
    if (chatBoxOpen) {
      // Second tap closes it.
      chatBoxOpen = false;
      focusChatBox = false;
      hideAsk();
      return;
    }
    chatBoxOpen = true;
    focusChatBox = true;
    if (activeShell) syncAsk(activeShell);
  };

  /** Safety net: a modal dialog that opened but is not actually visible would freeze the page. */
  const closeInvisibleModals = (shell: HTMLElement) => {
    shell.querySelectorAll<HTMLDialogElement>("dialog[open]").forEach((dialog) => {
      const rect = dialog.getBoundingClientRect();
      const hidden = window.getComputedStyle(dialog).visibility === "hidden";
      if (hidden || rect.width < 2 || rect.height < 2) dialog.close();
    });
  };

  const closeHistorySheet = () => {
    closeHistory?.();
    closeHistory = null;
  };

  const openHistory = (initialId: string | null, manual: boolean) => {
    // Tapping the button again dismisses the sheet.
    if (closeHistory) {
      closeHistorySheet();
      return;
    }
    if (manual) historyTouched = true;
    if (closeSheet) {
      closeSheet();
      closeSheet = null;
      if (currentView === "settings") setView("board");
    }
    rail?.setOpen(false);
    closeHistory = openHistorySheet({
      initialId,
      onContinue: (conv: SavedConversation) => {
        historyTouched = true;
        // Stay on the board: the saved transcript is never shown again. Once the
        // lesson has resumed, only the small chat box appears (in the example zone).
        setView("board");
        chatBoxOpen = false;
        hideAsk();
        showToast(t("resuming"));
        void resumeConversation(conv.id).then((sent) => {
          if (!sent) {
            showToast(t("resumeFailed"), 3600);
            return;
          }
          hideToast();
          if (!activeShell) return;
          chatBoxOpen = true;
          focusChatBox = false; // don't pop the keyboard over the board unprompted
          syncAsk(activeShell);
        });
      },
      onNewChat: () => {
        historyTouched = true;
        triggerNewChat();
        setView("board");
      },
      onClose: () => {
        closeHistory = null;
      },
    });
  };

  const openSettings = () => {
    const shell = activeShell;
    if (!shell) return;
    closeHistorySheet();

    if (closeSheet) {
      closeSheet();
      return;
    }

    const data = readSettingsForm(shell);
    if (data) {
      setView("settings");
      closeSheet = openSettingsSheet(data, () => {
        closeSheet = null;
        if (currentView === "settings") setView("board");
      });
      return;
    }

    // Fallback: the app's own dialog, guarded so it can never trap the page.
    const trigger = shell.querySelector<HTMLButtonElement>(".teaching-trigger");
    if (!trigger) return;
    const dialog = shell.querySelector<HTMLDialogElement>(".teaching-dialog");
    if (dialog && dialog.dataset.phoneCloseHandler !== "true") {
      dialog.dataset.phoneCloseHandler = "true";
      dialog.addEventListener("close", () => {
        if (currentView === "settings") setView("board");
      });
    }
    setView("settings");
    trigger.click();
    window.setTimeout(() => {
      closeInvisibleModals(shell);
      if (!shell.querySelector("dialog[open]") && currentView === "settings") setView("board");
    }, 160);
  };

  const triggerContinue = () => activate(activeShell?.querySelector<HTMLButtonElement>(".continue-button"));

  /**
   * Hands a file picked from the rail to the app's own attachment flow:
   * open its (invisible) picker, then drop the file into its matching input.
   */
  const deliverFile = async (file: File) => {
    const shell = activeShell;
    const attach = shell?.querySelector<HTMLButtonElement>(".attach-button");
    if (!shell || !attach || attach.disabled) return;

    root.classList.add("maalam-attach-busy");
    const release = () => root.classList.remove("maalam-attach-busy");
    const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);

    attach.click();
    const input = await waitFor(() => {
      const inputs = Array.from(document.querySelectorAll<HTMLInputElement>('.media-picker input[type="file"]'));
      return (
        inputs.find((candidate) =>
          isPdf ? /pdf/i.test(candidate.accept) : !candidate.hasAttribute("capture") && /image/i.test(candidate.accept),
        ) ?? null
      );
    }, 2500);

    if (!input) {
      document.querySelector<HTMLButtonElement>(".media-picker-close")?.click();
      release();
      return;
    }

    try {
      const transfer = new DataTransfer();
      transfer.items.add(file);
      input.files = transfer.files;
      input.dispatchEvent(new Event("change", { bubbles: true }));
      window.setTimeout(release, 700);
      // Show the chat so the upload progress / document actions are visible.
      window.setTimeout(() => {
        if (!activeShell) return;
        markLayout(activeShell);
        setView("chat");
      }, 260);
    } catch {
      // Could not hand the file over: let the user use the app's own picker.
      release();
    }
  };

  const makeFileInput = (accept: string, capture?: string): HTMLInputElement => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    if (capture) input.setAttribute("capture", capture);
    input.className = "maalam-file-input";
    input.tabIndex = -1;
    input.setAttribute("aria-hidden", "true");
    input.addEventListener("change", () => {
      const file = input.files?.[0];
      input.value = "";
      if (file) void deliverFile(file);
    });
    document.body.appendChild(input);
    return input;
  };

  const uploadInput = makeFileInput("image/*,application/pdf,.pdf,.heic,.heif");
  const cameraInput = makeFileInput("image/*", "environment");

  const removePhoneUI = () => {
    closeSheet?.();
    closeSheet = null;
    closeHistorySheet();
    rail?.destroy();
    rail = null;
    attrObserver?.disconnect();
    attrObserver = null;
    if (observedComposer) composerObserver.unobserve(observedComposer);
    observedComposer = null;
    composerHeight = "";
    root.style.removeProperty("--maalam-composer-h");
    activeShell?.removeAttribute("data-mobile-view");
    activeShell = null;
    itemSignature = "";
    askOverlay?.remove();
    askOverlay = null;
    askSignature = "";
    askSeen.clear();
    askCloneHtml = "";
    askCloneTouching = false;
    askMirror = "";
    askPositionKey = null;
    askPosition = null;
    chatBoxOpen = false;
    focusChatBox = false;
  };

  const removeHomeNavigation = () => {
    homeNav?.destroy();
    homeNav = null;
  };

  const ensureHomeNavigation = (setup: HTMLElement) => {
    // Rebuild if React replaced the home screen, so the nav never points at a stale element.
    if (homeNav && homeNav.setup === setup && homeNav.root.isConnected) return;
    removeHomeNavigation();
    homeNav = createHomeNavigation(setup);
    document.body.appendChild(homeNav.root);
  };

  /** Keeps the floating continue button in sync with the app's real one. */
  const syncContinue = (shell: HTMLElement) => {
    if (!rail) return;
    const target = shell.querySelector<HTMLButtonElement>(".continue-button");
    rail.continueButton.hidden = !target;
    if (!target) return;
    const erase = target.classList.contains("is-erase-request");
    rail.continueButton.classList.toggle("is-erase", erase);
    rail.continueButton.classList.toggle("is-disabled", target.disabled && !erase);
    rail.continueButton.setAttribute("aria-label", erase ? t("eraseAndContinueFull") : t("continueLesson"));
  };

  const syncStatus = (shell: HTMLElement) => {
    if (!rail) return;
    const state = shell.querySelector<HTMLElement>(".status-pill")?.dataset.state;
    rail.status.dataset.state = state === "connected" ? "connected" : state === "disconnected" ? "disconnected" : "connecting";
  };

  /** Saved-conversation count on the history button; hidden when there are none. */
  const syncHistoryBadge = () => {
    if (!rail) return;
    const badge = rail.historyButton.querySelector<HTMLElement>(".maalam-rail__badge");
    if (!badge) return;
    const count = historyCount();
    badge.hidden = count === 0;
    const label = count > 99 ? "99+" : String(count);
    if (badge.textContent !== label) badge.textContent = label;
  };

  /** The chat transcript sits right above the composer, whatever its height is. */
  const syncComposerHeight = (shell: HTMLElement) => {
    const composer = shell.querySelector<HTMLElement>(".composer-area");
    if (composer !== observedComposer) {
      if (observedComposer) composerObserver.unobserve(observedComposer);
      observedComposer = composer;
      if (composer) composerObserver.observe(composer);
    }
    const height = currentView === "chat" && composer ? Math.ceil(composer.getBoundingClientRect().height) : 0;
    const value = `${height}px`;
    if (value !== composerHeight) {
      composerHeight = value;
      root.style.setProperty("--maalam-composer-h", value);
    }
  };

  /**
   * Builds the full, ordered control list. Every entry keeps a direct reference
   * to the real button, so clicks never go to the wrong control when the app
   * adds or removes buttons between renders.
   */
  const collectItems = (shell: HTMLElement): RailItem[] => {
    const items: RailItem[] = [];
    const board = readBoardButtons(shell);

    // 1) Attach: camera + upload (moved here from the chat composer)
    const attach = shell.querySelector<HTMLButtonElement>(".attach-button");
    const attachDisabled = !attach || attach.disabled;
    items.push({
      id: "camera",
      label: t("camera"),
      svg: icon("camera"),
      disabled: attachDisabled,
      pressed: null,
      group: "attach",
      run: () => cameraInput.click(),
    });
    items.push({
      id: "upload",
      label: t("upload"),
      svg: icon("upload"),
      disabled: attachDisabled,
      pressed: null,
      group: "attach",
      run: () => uploadInput.click(),
    });

    // 2) Main
    items.push({
      id: "chat",
      label: chatBoxOpen || currentView === "chat" ? t("chatHide") : t("chat"),
      svg: icon("chat"),
      disabled: false,
      pressed: chatBoxOpen || currentView === "chat",
      group: "main",
      run: openChat,
    });
    items.push({
      id: "settings",
      label: t("settings"),
      svg: icon("settings"),
      disabled: false,
      pressed: currentView === "settings",
      group: "main",
      run: openSettings,
    });
    items.push({
      id: "language",
      label: `${t("language")} · ${getLang().toUpperCase()}`,
      svg: icon("globe"),
      disabled: false,
      pressed: closeLang !== null,
      group: "main",
      run: openLanguage,
    });

    // 3) Board
    if (board.erase) {
      const full = board.erase.classList.contains("is-erase-request");
      items.push({
        id: "erase",
        label: full ? t("eraseContinue") : t("erase"),
        svg: icon("eraser"),
        disabled: board.erase.disabled,
        pressed: null,
        group: "board",
        run: () => activate(board.erase),
      });
    }

    // 4) Session controls mirrored from the hidden app header.
    //    Skip duplicates, the board collapse/enlarge toggles, and copy/PDF (removed on phones).
    const headerButtons = Array.from(shell.querySelectorAll<HTMLButtonElement>(".chat-header button"));
    const seen = new Set<string>();
    headerButtons.forEach((button, index) => {
      const label = labelOf(button);
      if (!label) return;
      const normalized = plain(label);
      if (/خبي السبورة|وري السبورة|كبر|صغر|pdf|نسخ/i.test(normalized)) return;
      if (seen.has(label)) return;
      seen.add(label);
      items.push({
        id: `header-${index}-${label}`,
        label: tr(label),
        svg: button.querySelector("svg")?.outerHTML ?? icon("spark"),
        disabled: button.disabled,
        pressed: button.hasAttribute("aria-pressed") ? button.getAttribute("aria-pressed") === "true" : null,
        group: "session",
        run: () => activate(button),
      });
    });

    return items;
  };

  /** Renders the panel only when something actually changed. */
  const syncItems = (shell: HTMLElement) => {
    if (!rail) return;
    const items = collectItems(shell);
    const signature = JSON.stringify(items.map((i) => [i.id, i.label, i.disabled, i.pressed, i.group]));
    if (signature === itemSignature) return;
    itemSignature = signature;

    let seenAny = false;
    (["attach", "main", "board", "session"] as const).forEach((group) => {
      const target = rail!.groups[group];
      const groupItems = items.filter((item) => item.group === group);
      target.dataset.sep = String(groupItems.length > 0 && seenAny);
      if (groupItems.length > 0) seenAny = true;
      target.replaceChildren(
        ...groupItems.map((item) => {
          const button = document.createElement("button");
          button.type = "button";
          button.className = "maalam-rail__item";
          button.setAttribute("role", "menuitem");
          button.disabled = item.disabled;
          if (item.pressed !== null) button.setAttribute("aria-pressed", String(item.pressed));
          button.innerHTML = item.svg;
          const label = document.createElement("span");
          label.className = "maalam-rail__label";
          label.textContent = item.label;
          button.appendChild(label);
          button.addEventListener("click", () => {
            rail?.setOpen(false);
            item.run();
          });
          return button;
        }),
      );
    });
  };

  /* ================= Ask overlay =================
     When the teacher asks a question, a temporary send box floats over the
     board's example zone. When a QCM is posted, its full choices appear there.
     It disappears as soon as the student answers (in any place). */

  const hideAsk = () => {
    if (askOverlay) askOverlay.dataset.visible = "false";
  };

  const ensureAskOverlay = (): HTMLElement => {
    if (askOverlay && askOverlay.isConnected) return askOverlay;
    const overlay = document.createElement("div");
    overlay.className = "maalam-ask";
    overlay.dataset.visible = "false";
    overlay.dir = "rtl";
    document.body.appendChild(overlay);
    askOverlay = overlay;
    return overlay;
  };

  const liveComposer = (shell: HTMLElement) => ({
    field: shell.querySelector<HTMLTextAreaElement>(".composer-area textarea"),
    send: shell.querySelector<HTMLButtonElement>(".composer-area .send-button"),
  });

  /**
   * Typing in the overlay is mirrored into the app's real (hidden) composer, so
   * the app itself decides whether sending is possible (connected, not busy,
   * has text). Sending then just presses the app's own send button.
   */
  const mirrorToComposer = (shell: HTMLElement, value: string) => {
    const { field } = liveComposer(shell);
    if (!field) return;
    if (field.value !== value) setNativeValue(field, value);
    askMirror = value;
  };

  /** Removes our mirrored text from the real composer (only if it is still ours). */
  const clearMirror = (shell: HTMLElement | null) => {
    if (!askMirror) return;
    const field = shell ? liveComposer(shell).field : null;
    if (field && field.value === askMirror) setNativeValue(field, "");
    askMirror = "";
  };

  /** The overlay's send button is clickable only when there is text AND the app can send it now. */
  const refreshAskSend = (shell: HTMLElement) => {
    if (!askOverlay) return;
    const button = askOverlay.querySelector<HTMLButtonElement>(".maalam-ask__send");
    const textarea = askOverlay.querySelector<HTMLTextAreaElement>(".maalam-ask__input");
    if (!button || !textarea) return;
    const { send } = liveComposer(shell);
    const canSend = textarea.value.trim().length > 0 && Boolean(send) && !send!.disabled;
    if (button.disabled === canSend) button.disabled = !canSend;
    button.setAttribute("aria-disabled", String(!canSend));
  };

  /** A stable identity for the current QCM: its prompt and options, ignoring selection / order state. */
  const quizIdentity = (panel: HTMLElement): string => {
    const prompt = panel.querySelector(".quiz-prompt")?.textContent ?? "";
    const items = Array.from(panel.querySelectorAll(".quiz-choice-text, .quiz-order-text, .quiz-choice"))
      .map((node) => (node.textContent ?? "").replace(/[✓✗]/g, "").trim())
      .sort();
    return `${panel.querySelector(".quiz-kind")?.textContent ?? ""}|${prompt}|${items.join("¦")}`;
  };

  /**
   * Keeps the overlay's copy of the quiz identical to the app's real panel.
   * The real panel disables every choice while the tutor is still speaking and
   * re-renders on every selection, so the copy must follow those changes —
   * otherwise its buttons would stay disabled (or stale) forever.
   */
  const syncQuizClone = (original: HTMLElement) => {
    const host = askOverlay?.querySelector<HTMLElement>(".maalam-ask__clone");
    if (!host || askCloneTouching) return;
    const html = original.outerHTML;
    if (html === askCloneHtml && host.firstElementChild) return;
    askCloneHtml = html;
    const clone = original.cloneNode(true) as HTMLElement;
    clone.querySelectorAll("[id], [name], [for], [autofocus]").forEach((node) => {
      node.removeAttribute("id");
      node.removeAttribute("name");
      node.removeAttribute("for");
      node.removeAttribute("autofocus");
    });
    host.replaceChildren(clone);
  };

  const syncAsk = (shell: HTMLElement) => {
    const frame = shell.querySelector<HTMLElement>(".board-frame");
    // Typing in the overlay's own input opens the keyboard too — don't hide then.
    const typingInAsk = Boolean(askOverlay && askOverlay.contains(document.activeElement));
    if (
      !frame ||
      currentView !== "board" ||
      (root.classList.contains("maalam-keyboard-open") && !typingInAsk)
    ) {
      hideAsk();
      return;
    }

    const userCount = shell.querySelectorAll("article.message-enter.justify-end").length;
    const quizPanel = shell.querySelector<HTMLElement>('.composer-area [class*="quiz" i]');

    // The teacher's question block (the last block on the board, if it is a question).
    const blocks = frame.querySelectorAll<HTMLElement>(".board-block");
    const last = blocks[blocks.length - 1];
    const questionBlock = last?.querySelector(".board-question") ? last : null;

    const quizId = quizPanel ? `z:${quizIdentity(quizPanel)}` : null;
    const questionId = questionBlock ? `q:${questionBlock.dataset.blockId ?? "question"}` : null;

    // A QCM that has left the screen is forgotten, so the same QCM asked again later counts as new.
    if (!quizPanel) {
      for (const id of Array.from(askSeen.keys())) if (id.startsWith("z:")) askSeen.delete(id);
    }

    // First sight of a question remembers how many answers existed; it stays open
    // until the student sends one more (from anywhere) or dismisses it.
    const track = (id: string | null) => {
      if (!id) return null;
      let entry = askSeen.get(id);
      if (!entry) {
        entry = { users: userCount, dismissed: false };
        askSeen.set(id, entry);
      }
      return entry;
    };
    const quizEntry = track(quizId);
    const questionEntry = track(questionId);
    const stillOpen = (entry: { users: number; dismissed: boolean } | null) =>
      Boolean(entry) && !entry!.dismissed && userCount <= entry!.users;

    /* Priority: QCM > teacher question > the chat box the student opened.
       The QCM and the question are temporary; the chat box stays until closed. */
    const mode: "quiz" | "question" | "chat" | null = stillOpen(quizEntry)
      ? "quiz"
      : stillOpen(questionEntry)
        ? "question"
        : chatBoxOpen
          ? "chat"
          : null;
    if (!mode) {
      hideAsk();
      return;
    }
    const key = mode === "quiz" ? quizId! : mode === "question" ? questionId! : "chat";

    const overlay = ensureAskOverlay();
    overlay.dir = uiDir();

    // Place it at the top of the example zone (right zone), clamped to the board.
    const zone = frame.querySelector<HTMLElement>(".board-zone-right") ?? frame;
    const fr = frame.getBoundingClientRect();
    const zr = zone.getBoundingClientRect();
    const width = Math.round(Math.min(Math.max(zr.width, 10.5 * 16), Math.min(15 * 16, fr.width - 10)));
    const defaultLeft = Math.round(Math.max(6, zr.right - width - 8));
    const defaultTop = Math.round(Math.max(6, zr.top + 8));
    const positionKey = mode === "chat" ? "chat" : `${mode}:${key}`;
    if (positionKey !== askPositionKey) {
      askPositionKey = positionKey;
      askPosition = null;
      askSignature = "";
    }
    overlay.style.width = `${width}px`;
    const currentHeight = overlay.offsetHeight || 160;
    const minLeft = Math.max(6, Math.round(fr.left + 4));
    const maxLeft = Math.max(minLeft, Math.round(Math.min(fr.right - width - 4, window.innerWidth - width - 6)));
    const minTop = Math.max(6, Math.round(fr.top + 4));
    const maxTop = Math.max(minTop, Math.round(Math.min(fr.bottom - currentHeight - 4, window.innerHeight - currentHeight - 6)));
    const position = askPosition ?? { left: defaultLeft, top: defaultTop };
    position.left = Math.min(maxLeft, Math.max(minLeft, position.left));
    position.top = Math.min(maxTop, Math.max(minTop, position.top));
    if (askPosition) askPosition = position;
    overlay.style.left = `${position.left}px`;
    overlay.style.top = `${position.top}px`;

    // A growing textarea: one line at rest, expands as the text wraps.
    const autosize = (textarea: HTMLTextAreaElement) => {
      textarea.style.height = "auto";
      const max = Math.round(Math.min(132, window.innerHeight * 0.2));
      textarea.style.height = `${Math.min(textarea.scrollHeight, max)}px`;
      textarea.style.overflowY = textarea.scrollHeight > max ? "auto" : "hidden";
    };

    let title: string;
    let bodyHtml: string;
    let signature: string;
    const isQuiz = mode === "quiz";

    if (isQuiz) {
      // Same panel as in the chat box: a live clone of the app's own quiz UI.
      title = t("askQuiz");
      bodyHtml = `<div class="maalam-ask__clone"></div>`;
      signature = `quiz|${key}`;
    } else if (mode === "chat") {
      title = t("askChat");
      bodyHtml = `<form class="maalam-ask__form">
        <textarea class="maalam-ask__input" rows="1" enterkeyhint="send" placeholder="${t("phChat")}" autocomplete="off" dir="auto"></textarea>
        <button class="maalam-ask__send" type="submit" aria-label="${t("send")}" disabled aria-disabled="true">${icon("arrow")}</button>
      </form>`;
      signature = "chat";
    } else {
      title = t("askQuestion");
      bodyHtml = `<form class="maalam-ask__form">
        <textarea class="maalam-ask__input" rows="1" enterkeyhint="send" placeholder="${t("phAnswer")}" autocomplete="off" dir="auto"></textarea>
        <button class="maalam-ask__send" type="submit" aria-label="${t("sendAnswer")}" disabled aria-disabled="true">${icon("arrow")}</button>
      </form>`;
      signature = `question|${key}`;
    }

    // A language change must rebuild the box (its labels are baked into the markup).
    signature = `${getLang()}|${signature}`;
    if (signature !== askSignature) {
      askSignature = signature;
      // A different box replaces the old one: drop any text we mirrored for it.
      clearMirror(shell);
      askCloneHtml = "";
      askCloneTouching = false;
      overlay.innerHTML = `
        <div class="maalam-ask__head">
          ${title ? `<span class="maalam-ask__title">${title}</span>` : "<span></span>"}
          <button type="button" class="maalam-ask__x" aria-label="${mode === "chat" ? t("closeChat") : t("hideQuestion")}">${icon("close")}</button>
        </div>
        ${bodyHtml}`;

      overlay.querySelector(".maalam-ask__x")?.addEventListener("click", () => {
        clearMirror(shell);
        if (mode === "chat") {
          chatBoxOpen = false;
          focusChatBox = false;
        } else {
          const entry = askSeen.get(key);
          if (entry) entry.dismissed = true;
        }
        hideAsk();
      });

      if (isQuiz) {
        // The overlay shows a live copy of the app's own quiz panel (identical look).
        // Copied nodes lose React's listeners, so every tap is forwarded to the
        // matching button of the REAL panel, looked up at tap time.
        const host = overlay.querySelector<HTMLElement>(".maalam-ask__clone");
        if (host) {
          // Never swap the copy while a finger is on it: the tap would be lost.
          const release = () => {
            if (!askCloneTouching) return;
            askCloneTouching = false;
            scheduleReconcile();
          };
          host.addEventListener(
            "pointerdown",
            () => {
              askCloneTouching = true;
              window.addEventListener("pointerup", release, { once: true });
              window.addEventListener("pointercancel", release, { once: true });
            },
            { passive: true },
          );

          host.addEventListener("click", (event) => {
            const hit = (event.target as HTMLElement).closest("button");
            if (!hit || !host.contains(hit)) return;
            const live = shell.querySelector<HTMLElement>('.composer-area [class*="quiz" i]');
            if (!live) return;
            const copies = Array.from(host.querySelectorAll("button"));
            const originals = Array.from(live.querySelectorAll("button"));
            // Out of step (the real panel just changed): refresh the copy, ignore this tap.
            if (copies.length !== originals.length) {
              askCloneHtml = "";
              scheduleReconcile();
              return;
            }
            const target = originals[copies.indexOf(hit)];
            // Choices are disabled while the tutor is still speaking; the copy mirrors that.
            if (!target || target.disabled) return;
            target.click();
            // Selecting (multi / order) keeps the box open; answering makes it disappear
            // by itself, because the panel closes and the student's answer is sent.
            scheduleReconcile();
          });
        }
      } else {
        const textarea = overlay.querySelector<HTMLTextAreaElement>(".maalam-ask__input");
        const form = overlay.querySelector<HTMLFormElement>(".maalam-ask__form");
        if (textarea) {
          autosize(textarea);
          textarea.addEventListener("input", () => {
            autosize(textarea);
            // The app's own composer decides if sending is possible right now.
            mirrorToComposer(shell, textarea.value);
            refreshAskSend(shell);
            window.requestAnimationFrame(() => refreshAskSend(shell));
          });
          textarea.addEventListener("keydown", (event) => {
            if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
              event.preventDefault();
              form?.requestSubmit();
            }
          });
          if (focusChatBox || mode === "chat") {
            window.requestAnimationFrame(() => textarea.focus({ preventScroll: true }));
            focusChatBox = false;
          }
        }
        form?.addEventListener("submit", (event) => {
          event.preventDefault();
          if (!textarea) return;
          const value = textarea.value;
          if (!value.trim()) return;
          // Not sendable yet (empty, offline, or the tutor is still talking): do nothing.
          const { field, send } = liveComposer(shell);
          if (!field || !send || send.disabled || field.value !== value) return;
          send.click();
          askMirror = "";
          textarea.value = "";
          autosize(textarea);
          refreshAskSend(shell);
          if (mode === "question") {
            // A teacher's question is temporary: answered → gone.
            const entry = askSeen.get(key);
            if (entry) entry.dismissed = true;
            hideAsk();
          } else {
            // The chat box stays open for the next line of conversation.
            window.requestAnimationFrame(() => textarea.focus({ preventScroll: true }));
          }
        });
      }
    }

    // Every pass: keep the quiz copy identical to the real panel, and the send button honest.
    if (isQuiz && quizPanel) syncQuizClone(quizPanel);
    else refreshAskSend(shell);

    const dragHandle = overlay.querySelector<HTMLElement>(".maalam-ask__head");
    if (dragHandle && dragHandle.dataset.dragBound !== "true") {
      dragHandle.dataset.dragBound = "true";
      let pointerId: number | null = null;
      let startX = 0;
      let startY = 0;
      let startLeft = 0;
      let startTop = 0;
      let moved = false;

      dragHandle.addEventListener("pointerdown", (event) => {
        if ((event.target as HTMLElement).closest("button")) return;
        if (event.pointerType === "mouse" && event.button !== 0) return;
        const rect = overlay.getBoundingClientRect();
        pointerId = event.pointerId;
        startX = event.clientX;
        startY = event.clientY;
        startLeft = rect.left;
        startTop = rect.top;
        moved = false;
        dragHandle.setPointerCapture(event.pointerId);
        event.preventDefault();
      });

      dragHandle.addEventListener("pointermove", (event) => {
        if (pointerId !== event.pointerId) return;
        const dx = event.clientX - startX;
        const dy = event.clientY - startY;
        if (Math.abs(dx) + Math.abs(dy) > 3) moved = true;

        const liveFrame = shell.querySelector<HTMLElement>(".board-frame");
        const board = liveFrame?.getBoundingClientRect();
        const box = overlay.getBoundingClientRect();
        const minX = Math.max(6, board ? board.left + 4 : 6);
        const minY = Math.max(6, board ? board.top + 4 : 6);
        const maxX = Math.max(minX, Math.min(window.innerWidth - box.width - 6, board ? board.right - box.width - 4 : window.innerWidth - box.width - 6));
        const maxY = Math.max(minY, Math.min(window.innerHeight - box.height - 6, board ? board.bottom - box.height - 4 : window.innerHeight - box.height - 6));
        const next = {
          left: Math.min(maxX, Math.max(minX, startLeft + dx)),
          top: Math.min(maxY, Math.max(minY, startTop + dy)),
        };
        askPosition = next;
        overlay.style.left = `${Math.round(next.left)}px`;
        overlay.style.top = `${Math.round(next.top)}px`;
      });

      const finishDrag = (event: PointerEvent) => {
        if (pointerId !== event.pointerId) return;
        if (dragHandle.hasPointerCapture(event.pointerId)) dragHandle.releasePointerCapture(event.pointerId);
        pointerId = null;
        if (moved) event.preventDefault();
      };
      dragHandle.addEventListener("pointerup", finishDrag);
      dragHandle.addEventListener("pointercancel", finishDrag);
    }

    overlay.dataset.visible = "true";
  };

  /** With the top bar hidden, the board must never stay collapsed. */
  const ensureBoardVisible = (shell: HTMLElement) => {
    const wrap = shell.querySelector<HTMLElement>(".board-wrap");
    if (!wrap || wrap.querySelector(".board-frame")) return;
    const now = Date.now();
    if (now - lastExpandAt < 1500) return;
    const collapse = readBoardButtons(shell).collapse;
    if (collapse) {
      lastExpandAt = now;
      collapse.click();
    }
  };

  function reconcile() {
    root.classList.toggle("maalam-phone", media.matches);
    const shell = document.querySelector<HTMLElement>(".chat-shell");
    const setup = document.querySelector<HTMLElement>(".setup-screen");

    // Landscape is obligatory on phones once the board exists: block portrait
    // with a full-screen prompt until the phone is turned sideways.
    if (media.matches && shell) {
      syncRotateOverlay(!isLandscapeNow());
    } else {
      if (landscapeHeld && setup) {
        landscapeHeld = false;
        releaseLandscapeLock();
      }
      syncRotateOverlay(false);
    }

    if (!media.matches) {
      removePhoneUI();
      removeHomeNavigation();
      return;
    }

    // The bottom nav belongs only to the home screen. It is removed before the
    // board is initialized, so it can never cover the blackboard.
    if (!shell && setup) {
      removePhoneUI();
      ensureHomeNavigation(setup);
      // Saved key restore + autofocus fix + auto-start for returning users.
      syncSetupScreen(setup);
      return;
    }

    if (!shell) {
      removePhoneUI();
      removeHomeNavigation();
      return;
    }

    removeHomeNavigation();

    if (activeShell !== shell) {
      removePhoneUI();
      activeShell = shell;
      currentView = "board";
      activeShell.dataset.mobileView = currentView;
      rail = createRail(triggerContinue, () => openHistory(null, true));
      document.body.appendChild(rail.root);

      // Returning users who were auto-signed-in get their last conversation back.
      if (!restoreDone && didAutoStart()) {
        restoreDone = true;
        const target = getRestorableConversation();
        if (target) {
          window.setTimeout(() => {
            if (historyTouched || closeHistory || !activeShell || currentView !== "board") return;
            openHistory(target.id, false);
          }, 1500);
        }
      }

      // Button state changes (disabled / pressed / connection / dialogs) are attribute-only updates.
      attrObserver = new MutationObserver(scheduleReconcile);
      attrObserver.observe(shell, {
        subtree: true,
        attributes: true,
        attributeFilter: ["disabled", "data-state", "aria-pressed", "class", "open"],
      });
    }

    markLayout(shell);
    ensureBoardVisible(shell);
    closeInvisibleModals(shell);
    syncComposerHeight(shell);
    syncContinue(shell);
    syncStatus(shell);
    syncItems(shell);
    syncHistoryFromDom(shell);
    syncHistoryBadge();
    syncAsk(shell);
    if (rail) rail.root.dataset.view = currentView;

    if (currentView === "chat") {
      const region = shell.querySelector<HTMLElement>("[data-maalam-chat-region]");
      if (region) bindChatSheet(region, () => setView("board"), () => openHistory(null, true));
    }
  }

  function scheduleReconcile() {
    if (pendingFrame) return;
    pendingFrame = window.requestAnimationFrame(() => {
      pendingFrame = 0;
      reconcile();
    });
  }

  const observer = new MutationObserver(scheduleReconcile);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  media.addEventListener("change", scheduleReconcile);
  window.addEventListener("resize", scheduleReconcile, { passive: true });
  window.visualViewport?.addEventListener("resize", syncViewport, { passive: true });
  window.visualViewport?.addEventListener("scroll", syncViewport, { passive: true });
  window.addEventListener("focusin", syncViewport);
  window.addEventListener("focusout", syncViewport);
  window.addEventListener("orientationchange", () => {
    window.setTimeout(() => {
      viewportBaseline = window.visualViewport?.height ?? window.innerHeight;
      syncViewport();
      scheduleReconcile();
    }, 120);
  });
  window.addEventListener("pageshow", syncViewport);
  syncViewport();
  scheduleReconcile();
}
