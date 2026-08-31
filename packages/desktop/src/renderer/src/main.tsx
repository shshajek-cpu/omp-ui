import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import "./style.css";

/**
 * The last-resort surface when the app shell itself throws — per-row damage is
 * absorbed by the transcript's own boundaries and never reaches this. Plain
 * markup on the void background: it must not depend on anything that can fail.
 */
function AppCrash({ error }: { error: Error }) {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-3 bg-void px-8 font-sans text-ink">
      <h1 className="font-display text-base font-semibold">omp-ui 화면을 표시하지 못했습니다</h1>
      <p className="max-w-lg text-center text-sm text-ink-mid">
        세션에는 영향이 없습니다. omp는 백그라운드에서 계속 실행 중입니다.
        새로고침하면 다시 연결합니다.
      </p>
      <pre
        data-selectable
        className="max-h-48 max-w-2xl overflow-auto whitespace-pre-wrap break-words rounded border border-line bg-sunken px-3 py-2 font-mono text-[11px] leading-snug text-rose"
      >
        {error.stack ?? error.message}
      </pre>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="rounded border border-line-strong bg-overlay px-3 py-1 text-sm text-ink transition-colors hover:bg-hover"
      >
        새로고침
      </button>
    </div>
  );
}

createRoot(document.getElementById("root")!, {
  // Boundaries above catch render errors; these catch what they can't —
  // errors in effects, event handlers rethrown by React, and anything the
  // boundaries themselves throw. Logging beats React's default silent unmount.
  onUncaughtError: (error, info) => {
    console.error("uncaught render error:", error, info.componentStack);
  },
  onCaughtError: (error, info) => {
    console.error("render error (caught by boundary):", error, info.componentStack);
  },
}).render(
  <StrictMode>
    <ErrorBoundary fallback={(error) => <AppCrash error={error} />}>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
