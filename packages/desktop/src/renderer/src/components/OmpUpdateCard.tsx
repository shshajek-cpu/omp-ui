import type { ReactNode } from "react";
import { useStore } from "../store";
import { Button, UpdateCard } from "./ui";

/**
 * The omp binary install/update card (issue #19): a small non-modal card
 * announcing a newer omp release — or, when no omp is installed at all, an
 * install offer. Same corner-stack pattern as the app update card (App.tsx
 * owns the positioning); renders nothing for idle/checking so background
 * failures stay silent by design. No `signal` tokens: ADR-0004 reserves
 * signal for agent liveness.
 */
export function OmpUpdateCard() {
  const ompUpdate = useStore((s) => s.ompUpdate);
  const downloadOmpUpdate = useStore((s) => s.downloadOmpUpdate);
  const dismissOmpUpdate = useStore((s) => s.dismissOmpUpdate);

  const { status, installedVersion, latestVersion, progress, error } = ompUpdate;
  const version = latestVersion ?? "";
  const dismissOfferedVersion = () => void dismissOmpUpdate(version, true);

  if (status === "idle" || status === "checking") return null;

  let body: ReactNode;
  if (status === "available") {
    body = (
      <>
        <p className="text-sm font-medium text-ink">omp {version} 사용 가능</p>
        <p className="mt-0.5 text-xs text-ink-dim">설치 버전: {installedVersion}</p>
        <p className="mt-0.5 text-xs text-ink-dim">
          새 세션부터 적용되며 실행 중인 세션은 현재 버전을 유지합니다.
        </p>
        <div className="mt-3 flex items-center gap-2">
          <Button variant="solid" onClick={() => void downloadOmpUpdate()}>
            지금 업데이트
          </Button>
          <Button variant="ghost" onClick={dismissOfferedVersion}>
            나중에
          </Button>
        </div>
      </>
    );
  } else if (status === "missing") {
    // An install offer, not an update — never the word "update" here.
    body = (
      <>
        <p className="text-sm font-medium text-ink">omp가 설치되지 않았습니다</p>
        <p className="mt-0.5 text-xs text-ink-dim">
          omp-ui가 관리 사본을 설치하기 전에는 새 세션을 실행할 수 없습니다.
        </p>
        <div className="mt-3 flex items-center gap-2">
          <Button variant="solid" onClick={() => void downloadOmpUpdate()}>
            설치
          </Button>
          <Button variant="ghost" onClick={dismissOfferedVersion}>
            나중에
          </Button>
        </div>
      </>
    );
  } else if (status === "downloading") {
    body = (
      <>
        <p className="text-sm font-medium text-ink">omp {version} 설치 중…</p>
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
  } else if (status === "installed") {
    body = (
      <>
        <p className="text-sm font-medium text-ink">omp {version} 설치 완료</p>
        <p className="mt-0.5 text-xs text-ink-dim">
          새 세션부터 적용되며 실행 중인 세션에는 영향이 없습니다.
        </p>
        <div className="mt-3 flex items-center gap-2">
          <Button variant="ghost" onClick={() => void dismissOmpUpdate(version, false)}>
            닫기
          </Button>
        </div>
      </>
    );
  } else {
    // The shared shell auto-dismisses up-to-date; errors stay sticky.
    const title =
      status === "up-to-date"
        ? `omp가 최신 버전입니다 (${installedVersion})`
        : error === "could not reach the omp release registry"
          ? "업데이트 확인 실패"
          : "설치 실패";
    body = (
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink">{title}</p>
        {status === "error" && error !== null && (
          <p className="mt-0.5 break-words text-xs text-ink-dim">{error}</p>
        )}
      </div>
    );
  }

  const offered = status === "available" || status === "missing";
  const transient = status === "up-to-date";
  const onDismiss = offered
    ? dismissOfferedVersion
    : transient || status === "error"
      ? () => void dismissOmpUpdate("", false)
      : undefined;

  return (
    <UpdateCard
      dismissLabel={offered ? `omp ${version} 알림 닫기` : onDismiss ? "닫기" : undefined}
      onDismiss={onDismiss}
      autoDismissMs={transient ? 5000 : undefined}
    >
      {body}
    </UpdateCard>
  );
}
