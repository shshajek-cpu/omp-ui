import type { AppUpdateState, OmpUpdateState } from "@omp-ui/core/types";
import { useStore } from "../../store";
import { AppUpdateRestartAction } from "../AppUpdateCard";
import { Button, Panel, Switch } from "../ui";

function appStatusLine(u: AppUpdateState): string {
  switch (u.status) {
    case "available":
      return `${u.latestVersion ?? "새 버전"} 사용 가능`;
    case "downloading":
      return `${u.latestVersion ?? ""} 다운로드 중…`;
    case "downloaded":
      return `${u.latestVersion ?? "업데이트"} 다운로드 완료${u.installOnQuit ? " — 종료할 때 설치" : ""}`;
    case "installing":
      return `${u.latestVersion ?? "업데이트"} 적용 중…`;
    case "up-to-date":
      return "최신 버전";
    case "checking":
      return "확인 중…";
    case "disabled":
      return "이 빌드에서는 omp-ui 업데이트 확인을 지원하지 않습니다. omp 바이너리 업데이트는 별도입니다.";
    case "error":
      return u.error ?? "업데이트 확인 실패";
    default:
      return "아직 확인하지 않음";
  }
}

function ompStatusLine(u: OmpUpdateState): string {
  switch (u.status) {
    case "missing":
      return "설치되지 않음";
    case "available":
      return `${u.latestVersion ?? "새 버전"} 사용 가능`;
    case "downloading":
      return `${u.latestVersion ?? ""} 설치 중…`;
    case "installed":
      return `${u.latestVersion ?? "업데이트"} 설치 완료 — 새 세션부터 사용`;
    case "up-to-date":
      return "최신 버전";
    case "checking":
      return "확인 중…";
    case "error":
      return u.error ?? "업데이트 확인 실패";
    default:
      return "아직 확인하지 않음";
  }
}

export function UpdatesPage() {
  const state = useStore((s) => s.state);
  const appUpdate = useStore((s) => s.appUpdate);
  const ompUpdate = useStore((s) => s.ompUpdate);
  const setAppUpdateCheckOnLaunch = useStore(
    (s) => s.setAppUpdateCheckOnLaunch,
  );
  const setOmpUpdateCheckOnLaunch = useStore(
    (s) => s.setOmpUpdateCheckOnLaunch,
  );
  const clearDismissedAppUpdate = useStore((s) => s.clearDismissedAppUpdate);
  const clearDismissedOmpUpdate = useStore((s) => s.clearDismissedOmpUpdate);
  const checkAppUpdate = useStore((s) => s.checkAppUpdate);
  const checkOmpUpdate = useStore((s) => s.checkOmpUpdate);
  const downloadOmpUpdate = useStore((s) => s.downloadOmpUpdate);
  const downloadAppUpdate = useStore((s) => s.downloadAppUpdate);

  const setAppUpdateInstallOnQuit = useStore(
    (s) => s.setAppUpdateInstallOnQuit,
  );
  const showAppUpdateDownload = useStore((s) => s.showAppUpdateDownload);
  const openAppUpdateReleaseNotes = useStore(
    (s) => s.openAppUpdateReleaseNotes,
  );

  // Clear THEN check, so the card reappears immediately if an offer stands.
  const reofferApp = (): void => {
    void clearDismissedAppUpdate().then(() => checkAppUpdate());
  };
  const reofferOmp = (): void => {
    void clearDismissedOmpUpdate().then(() => checkOmpUpdate());
  };

  return (
    <div className="space-y-3 px-4 py-3">
      <Panel className="px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium text-ink">omp-ui</p>
            <p className="mt-0.5 font-mono text-[11px] text-ink-mid tabular-nums">
              {appUpdate.currentVersion ?? "버전 정보 없는 빌드"}
            </p>
            <p className="mt-0.5 text-[11px] text-ink-dim">
              {appStatusLine(appUpdate)}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {/* The update card's primary action mirrored (issue #89): a check
                that answers "available" here must not require closing
                Settings to reach the corner card — and the downloaded
                follow-through finishes the install without leaving either. */}
            {appUpdate.status === "available" &&
              (appUpdate.format === "unknown" ? (
                <Button
                  size="xs"
                  variant="solid"
                  onClick={() => void openAppUpdateReleaseNotes()}
                >
                  릴리스 보기
                </Button>
              ) : (
                <Button
                  size="xs"
                  variant="solid"
                  onClick={() => void downloadAppUpdate()}
                >
                  {appUpdate.format === "appimage" ||
                  appUpdate.format === "nsis" ||
                  appUpdate.format === "maczip"
                    ? "업데이트"
                    : "다운로드"}
                </Button>
              ))}
            {appUpdate.status === "downloaded" &&
              (appUpdate.format === "appimage" ||
              appUpdate.format === "nsis" ||
              appUpdate.format === "maczip" ? (
                <>
                  <AppUpdateRestartAction size="xs" />
                  <Button
                    size="xs"
                    variant="ghost"
                    onClick={() =>
                      void setAppUpdateInstallOnQuit(!appUpdate.installOnQuit)
                    }
                  >
                    {appUpdate.installOnQuit
                      ? "종료 시 설치 취소"
                      : "종료할 때 설치"}
                  </Button>
                </>
              ) : (
                <Button
                  size="xs"
                  variant="solid"
                  onClick={() => void showAppUpdateDownload()}
                >
                  폴더에서 보기
                </Button>
              ))}
            <Button
              size="xs"
              disabled={appUpdate.status === "installing"}
              onClick={() => void checkAppUpdate()}
            >
              지금 확인
            </Button>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="text-xs text-ink-mid">시작할 때 확인</span>
          <Switch
            on={state?.appUpdateCheckOnLaunch ?? true}
            onChange={(next) => void setAppUpdateCheckOnLaunch(next)}
            label="시작할 때 omp-ui 업데이트 확인"
          />
        </div>
        {typeof state?.dismissedAppUpdateVersion === "string" && (
          <div className="mt-2 flex items-center justify-between gap-3">
            <span className="text-xs text-ink-mid">
              숨김: {state.dismissedAppUpdateVersion}
            </span>
            <Button size="xs" variant="ghost" onClick={reofferApp}>
              다시 표시
            </Button>
          </div>
        )}
      </Panel>

      <Panel className="px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium text-ink">omp 바이너리</p>
            <p className="mt-0.5 font-mono text-[11px] text-ink-mid tabular-nums">
              {ompUpdate.installedVersion ?? "설치되지 않음"}
            </p>
            <p className="mt-0.5 text-[11px] text-ink-dim">
              {ompStatusLine(ompUpdate)}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {/* The same install OmpUpdateCard.tsx offers — reachable here
                because a user whose omp is missing has no card to click once
                they dismiss it. The available-update action joins it for the
                same reason (issue #89). */}
            {ompUpdate.status === "available" && (
              <Button
                size="xs"
                variant="solid"
                onClick={() => void downloadOmpUpdate()}
              >
                지금 업데이트
              </Button>
            )}
            {ompUpdate.status === "missing" && (
              <Button
                size="xs"
                variant="solid"
                onClick={() => void downloadOmpUpdate()}
              >
                설치
              </Button>
            )}
            <Button size="xs" onClick={() => void checkOmpUpdate()}>
              지금 확인
            </Button>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="text-xs text-ink-mid">시작할 때 확인</span>
          <Switch
            on={state?.ompUpdateCheckOnLaunch ?? true}
            onChange={(next) => void setOmpUpdateCheckOnLaunch(next)}
            label="시작할 때 omp 업데이트 확인"
          />
        </div>
        {typeof state?.dismissedOmpUpdateVersion === "string" && (
          <div className="mt-2 flex items-center justify-between gap-3">
            <span className="text-xs text-ink-mid">
              숨김: {state.dismissedOmpUpdateVersion}
            </span>
            <Button size="xs" variant="ghost" onClick={reofferOmp}>
              다시 표시
            </Button>
          </div>
        )}
      </Panel>
    </div>
  );
}

export function UpdatesFooter() {
  return <p>다운로드와 설치는 항상 사용자가 눌러야 시작됩니다.</p>;
}
