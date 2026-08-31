import { useState, type ReactNode } from "react";
import { useStore } from "../store";
import { Button, ConfirmDialog, UpdateCard } from "./ui";

/**
 * The update card (issue #18): a small non-modal card in the lower-right
 * corner announcing an omp-ui release — versions, the package-appropriate
 * update action, release notes, Later. Lower-right because the top-right
 * belongs to the native title-bar overlay controls; z-40 sits between the
 * modal (z-30) and context menus (z-50).
 *
 * Renders nothing for idle/checking — background failures stay silent by
 * design. No `signal` tokens: ADR-0004 reserves signal for agent liveness.
 */
/** Shared restart action used by both update surfaces. */
export function AppUpdateRestartAction({ size }: { size?: "xs" }) {
  const restartForAppUpdate = useStore((s) => s.restartForAppUpdate);
  const [confirming, setConfirming] = useState(false);

  const restart = async (confirmed = false): Promise<void> => {
    const result = await restartForAppUpdate(confirmed);
    setConfirming(result === "confirmation-required");
  };

  return (
    <>
      <Button size={size} variant="solid" onClick={() => void restart()}>
        지금 다시 시작
      </Button>
      {confirming && (
        <ConfirmDialog
          kicker="실행 중인 세션"
          title="지금 omp-ui를 다시 시작할까요?"
          tone="copper"
          onClose={() => setConfirming(false)}
          width="w-[28rem]"
          actions={
            <>
              <Button variant="ghost" onClick={() => setConfirming(false)}>
                취소
              </Button>
              <Button variant="solid" tone="copper" onClick={() => void restart(true)}>
                세션을 중단하고 다시 시작
              </Button>
            </>
          }
        >
          <p className="text-sm leading-relaxed text-ink-dim">
            하나 이상의 세션이 실행 중입니다. 다시 시작하면 에이전트를 중단하고 업데이트를 적용합니다.
          </p>
        </ConfirmDialog>
      )}
    </>
  );
}

export function AppUpdateCard() {
  const appUpdate = useStore((s) => s.appUpdate);
  const downloadAppUpdate = useStore((s) => s.downloadAppUpdate);
  const openAppUpdateReleaseNotes = useStore((s) => s.openAppUpdateReleaseNotes);
  const showAppUpdateDownload = useStore((s) => s.showAppUpdateDownload);
  const setAppUpdateInstallOnQuit = useStore((s) => s.setAppUpdateInstallOnQuit);
  const dismissAppUpdate = useStore((s) => s.dismissAppUpdate);

  const { status, currentVersion, latestVersion, format, progress, installOnQuit, error } =
    appUpdate;
  const version = latestVersion ?? "";

  if (status === "idle" || status === "checking") return null;

  let body: ReactNode;
  if (status === "available") {
    const primary =
      format === "unknown"
        ? { label: "릴리스 보기", run: () => void openAppUpdateReleaseNotes() }
        : {
            label: format === "appimage" || format === "nsis" || format === "maczip" ? "업데이트" : "다운로드",
            run: () => void downloadAppUpdate(),
          };
    body = (
      <>
        <p className="text-sm font-medium text-ink">omp-ui {version} 사용 가능</p>
        <p className="mt-0.5 text-xs text-ink-dim">설치 버전: {currentVersion}</p>
        <div className="mt-3 flex items-center gap-2">
          <Button variant="solid" onClick={primary.run}>
            {primary.label}
          </Button>
          <Button variant="ghost" onClick={() => void openAppUpdateReleaseNotes()}>
            릴리스 노트
          </Button>
          <Button variant="ghost" onClick={() => void dismissAppUpdate(version, true)}>
            나중에
          </Button>
        </div>
      </>
    );
  } else if (status === "downloading") {
    body = (
      <>
        <p className="text-sm font-medium text-ink">omp-ui {version} 다운로드 중…</p>
        <div className="mt-2.5 h-1 rounded bg-raised">
          {progress === null ? (
            <div className="h-1 w-full animate-pulse rounded bg-iris" />
          ) : (
            <div className="h-1 rounded bg-iris" style={{ width: `${progress}%` }} />
          )}
        </div>
        {progress !== null && (
          <p className="mt-1.5 text-[11px] tabular-nums text-ink-dim">{progress}%</p>
        )}
      </>
    );
  } else if (status === "installing") {
    body = (
      <>
        <p className="text-sm font-medium text-ink">omp-ui {version} 적용 중…</p>
        <div className="mt-2.5 h-1 rounded bg-raised">
          <div className="h-1 w-full animate-pulse rounded bg-iris" />
        </div>
        <p className="mt-2 text-xs text-ink-dim">
          {format === "maczip"
            ? "macOS가 업데이트를 준비하고 있습니다. omp-ui가 자동으로 다시 시작되며 몇 분 걸릴 수 있습니다."
            : "omp-ui가 자동으로 다시 시작됩니다."}
        </p>
      </>
    );
  } else if (status === "downloaded" && (format === "appimage" || format === "nsis" || format === "maczip")) {
    body = (
      <>
        <p className="text-sm font-medium text-ink">omp-ui {version} 준비 완료</p>
        <p className="mt-0.5 text-xs text-ink-dim">
          {installOnQuit
            ? "종료할 때 설치합니다. 지금 다시 시작하면 즉시 적용됩니다."
            : "다시 시작하면 적용됩니다. 그때까지 세션은 계속 실행됩니다."}
        </p>
        <div className="mt-3 flex items-center gap-2">
          <AppUpdateRestartAction />
          <Button
            variant="ghost"
            onClick={() => void setAppUpdateInstallOnQuit(!installOnQuit)}
          >
            {installOnQuit ? "취소" : "종료할 때 설치"}
          </Button>
          <Button variant="ghost" onClick={() => void dismissAppUpdate(version, false)}>
            나중에
          </Button>
        </div>
      </>
    );
  } else if (status === "downloaded") {
    body = (
      <>
        <p className="text-sm font-medium text-ink">omp-ui {version} 다운로드 완료</p>
        <p className="mt-0.5 text-xs text-ink-dim">
          설치 프로그램이 열렸습니다. 해당 창에서 설치를 마치세요.
        </p>
        <div className="mt-3 flex items-center gap-2">
          <Button variant="solid" onClick={() => void showAppUpdateDownload()}>
            폴더에서 보기
          </Button>
          <Button variant="ghost" onClick={() => void openAppUpdateReleaseNotes()}>
            릴리스 노트
          </Button>
          <Button variant="ghost" onClick={() => void dismissAppUpdate(version, false)}>
            닫기
          </Button>
        </div>
      </>
    );
  } else {
    // The shared shell auto-dismisses up-to-date/disabled; errors stay sticky.
    const title =
      status === "up-to-date"
        ? `omp-ui가 최신 버전입니다 (${currentVersion})`
        : status === "disabled"
          ? "이 빌드에서는 omp-ui 업데이트 확인을 사용할 수 없습니다"
          : error === "could not reach GitHub"
            ? "업데이트 확인 실패"
            : "업데이트 실패";
    body = (
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink">{title}</p>
        {status === "error" && error !== null && (
          <p className="mt-0.5 break-words text-xs text-ink-dim">{error}</p>
        )}
      </div>
    );
  }

  const offered = status === "available";
  const transient = status === "up-to-date" || status === "disabled";
  const onDismiss = offered
    ? () => void dismissAppUpdate(version, true)
    : transient || status === "error"
      ? () => void dismissAppUpdate("", false)
      : undefined;

  return (
    <UpdateCard
      dismissLabel={offered ? `omp-ui ${version} 업데이트 닫기` : onDismiss ? "닫기" : undefined}
      onDismiss={onDismiss}
      autoDismissMs={transient ? 5000 : undefined}
    >
      {body}
    </UpdateCard>
  );
}
