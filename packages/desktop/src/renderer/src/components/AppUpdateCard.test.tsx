// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AppUpdateState, OmpUpdateState } from "@omp-ui/core/types";

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const idleOmpUpdate: OmpUpdateState = {
  status: "idle",
  installPath: null,
  installedVersion: null,
  latestVersion: null,
  progress: null,
  error: null,
};

// store.ts captures the preload bridge at module load, so install the mock
// before dynamically importing either the store or AppUpdateCard.
const backendMock = {
  getState: vi.fn(),
  addProject: vi.fn(),
  browseDirectories: vi.fn(),
  removeProject: vi.fn(),
  moveProject: vi.fn(async () => {}),
  setDefaultMode: vi.fn(),
  spawnSession: vi.fn(),
  terminateSession: vi.fn(),
  switchMode: vi.fn(),
  deleteSession: vi.fn(async (tabId: string) => ({ deleted: [tabId], failed: [] })),
  deleteSessionPreview: vi.fn(async () => ({ descendants: [] })),
  forkSession: vi.fn(),
  setSessionAdvisor: vi.fn(),
  getAdvisorDefaults: vi.fn(),
  setProjectDefaultModel: vi.fn(async () => {}),
  setProjectDefaultAdvisorModel: vi.fn(async () => {}),
  setSessionModel: vi.fn(),
  generateTitle: vi.fn(),
  readPlanFile: vi.fn(),
  getBranchDiff: vi.fn(),
  ptyPasteImage: vi.fn(),
  ptyWrite: vi.fn(),
  ptyResize: vi.fn(),
  rpcSend: vi.fn(),
  onPtyData: vi.fn(),
  onPtyExit: vi.fn(),
  onRpcFrame: vi.fn(),
  onStateChanged: vi.fn(),
  toggleFavorite: vi.fn(),
  getOmpUpdateState: vi.fn(async () => idleOmpUpdate),
  checkOmpUpdate: vi.fn(),
  downloadOmpUpdate: vi.fn(),
  dismissOmpUpdate: vi.fn(),
  onOmpUpdateState: vi.fn(),
  getAppUpdateState: vi.fn(),
  checkAppUpdate: vi.fn(),
  downloadAppUpdate: vi.fn(),
  openAppUpdateReleaseNotes: vi.fn(),
  showAppUpdateDownload: vi.fn(),
  restartForAppUpdate: vi.fn(),
  setAppUpdateInstallOnQuit: vi.fn(),
  dismissAppUpdate: vi.fn(),
  onAppUpdateState: vi.fn(),
};
Object.assign(window, { ompBackend: backendMock });

const { useStore } = await import("../store");
const { AppUpdateCard } = await import("./AppUpdateCard");

function appUpdateState(patch: Partial<AppUpdateState>): AppUpdateState {
  return {
    status: "idle",
    currentVersion: "1.0.0",
    latestVersion: null,
    releaseUrl: "https://github.com/LankfordAI/omp-ui/releases/tag/v1.2.0",
    releaseName: null,
    format: "deb",
    progress: null,
    downloadedPath: null,
    installOnQuit: false,
    error: null,
    ...patch,
  };
}

let root: Root | null = null;

function renderCard(): void {
  const host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root!.render(<AppUpdateCard />));
}

function buttonWithText(text: string): HTMLButtonElement {
  const found = [...document.body.querySelectorAll<HTMLButtonElement>("button")].find(
    (candidate) => candidate.textContent === text,
  );
  if (found === undefined) throw new Error(`button not found: ${text}`);
  return found;
}

function buttonWithTextOrNull(text: string): HTMLButtonElement | null {
  return (
    [...document.body.querySelectorAll<HTMLButtonElement>("button")].find(
      (candidate) => candidate.textContent === text,
    ) ?? null
  );
}

function click(el: HTMLElement): void {
  act(() => {
    el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  if (root !== null) {
    act(() => root!.unmount());
    root = null;
  }
  document.body.replaceChildren();
  useStore.setState({ appUpdate: appUpdateState({}) });
});

describe("AppUpdateCard", () => {
  it("renders nothing while idle", () => {
    useStore.setState({ appUpdate: appUpdateState({ status: "idle" }) });
    renderCard();
    expect(document.body.textContent).toBe("");
  });

  it("announces an available update with versions and the three actions", () => {
    useStore.setState({
      appUpdate: appUpdateState({ status: "available", latestVersion: "1.2.0" }),
    });
    renderCard();
    expect(document.body.textContent).toContain("omp-ui 1.2.0 사용 가능");
    expect(document.body.textContent).toContain("설치 버전: 1.0.0");
    buttonWithText("다운로드");
    buttonWithText("릴리스 노트");
    click(buttonWithText("나중에"));
    expect(backendMock.dismissAppUpdate).toHaveBeenCalledWith("1.2.0", true);

    click(document.body.querySelector<HTMLButtonElement>('[aria-label="omp-ui 1.2.0 업데이트 닫기"]')!);
    expect(backendMock.dismissAppUpdate).toHaveBeenLastCalledWith("1.2.0", true);
  });

  it.each(["appimage", "nsis", "maczip"] as const)("labels %s available action Update", (format) => {
    useStore.setState({
      appUpdate: appUpdateState({ status: "available", latestVersion: "1.2.0", format }),
    });
    renderCard();
    buttonWithText("업데이트");
  });

  it.each(["appimage", "nsis", "maczip"] as const)(
    "shows %s staging progress",
    (format) => {
      useStore.setState({
        appUpdate: appUpdateState({
          status: "downloading",
          latestVersion: "1.2.0",
          format,
          progress: 42,
        }),
      });
      renderCard();
      expect(document.body.textContent).toContain("omp-ui 1.2.0 다운로드 중");
      expect(document.body.textContent).toContain("42%");
    },
  );

  it("shows an indeterminate macOS applying state without update actions", () => {
    useStore.setState({
      appUpdate: appUpdateState({
        status: "installing",
        latestVersion: "1.2.0",
        format: "maczip",
      }),
    });
    renderCard();

    expect(document.body.textContent).toContain("omp-ui 1.2.0 적용 중");
    expect(document.body.textContent).toContain("몇 분 걸릴 수 있습니다");
    expect(document.body.querySelector(".animate-pulse")).not.toBeNull();
    expect(buttonWithTextOrNull("지금 다시 시작")).toBeNull();
    expect(buttonWithTextOrNull("종료할 때 설치")).toBeNull();
    expect(buttonWithTextOrNull("나중에")).toBeNull();
  });

  it.each(["appimage", "nsis", "maczip"] as const)(
    "restarts, arms install-on-quit, and dismisses a staged %s update",
    (format) => {
      useStore.setState({
        appUpdate: appUpdateState({
          status: "downloaded",
          latestVersion: "1.2.0",
          format,
        }),
      });
      renderCard();
      expect(document.body.textContent).toContain("omp-ui 1.2.0 준비 완료");

      click(buttonWithText("지금 다시 시작"));
      expect(backendMock.restartForAppUpdate).toHaveBeenCalled();

      click(buttonWithText("종료할 때 설치"));
      expect(backendMock.setAppUpdateInstallOnQuit).toHaveBeenCalledWith(true);

      click(buttonWithText("나중에"));
      expect(backendMock.dismissAppUpdate).toHaveBeenCalledWith("1.2.0", false);
    },
  );

  it("confirms a restart with live sessions in the initiating renderer", async () => {
    backendMock.restartForAppUpdate
      .mockResolvedValueOnce("confirmation-required")
      .mockResolvedValueOnce("restarting");
    useStore.setState({
      appUpdate: appUpdateState({
        status: "downloaded",
        latestVersion: "1.2.0",
        format: "appimage",
      }),
    });
    renderCard();

    await act(async () => buttonWithText("지금 다시 시작").click());
    expect(document.body.querySelector('[role="alertdialog"]')?.textContent).toContain(
      "하나 이상의 세션이 실행 중입니다",
    );
    await act(async () => buttonWithText("세션을 중단하고 다시 시작").click());
    expect(backendMock.restartForAppUpdate).toHaveBeenNthCalledWith(1, false);
    expect(backendMock.restartForAppUpdate).toHaveBeenNthCalledWith(2, true);
  });

  it.each(["appimage", "nsis", "maczip"] as const)(
    "shows and disarms a %s install-on-quit choice",
    (format) => {
      useStore.setState({
        appUpdate: appUpdateState({
          status: "downloaded",
          latestVersion: "1.2.0",
          format,
          installOnQuit: true,
        }),
      });
      renderCard();
      expect(document.body.textContent).toContain("종료할 때 설치합니다");
      click(buttonWithText("취소"));
      expect(backendMock.setAppUpdateInstallOnQuit).toHaveBeenCalledWith(false);
    },
  );

  it("reveals a downloaded deb in its folder", () => {
    useStore.setState({
      appUpdate: appUpdateState({
        status: "downloaded",
        latestVersion: "1.2.0",
        downloadedPath: "/home/u/Downloads/omp-ui_1.2.0_amd64.deb",
      }),
    });
    renderCard();
    expect(document.body.textContent).toContain("omp-ui 1.2.0 다운로드 완료");
    click(buttonWithText("폴더에서 보기"));
    expect(backendMock.showAppUpdateDownload).toHaveBeenCalled();
  });

  it("auto-dismisses the up-to-date answer after five seconds", () => {
    vi.useFakeTimers();
    try {
      useStore.setState({ appUpdate: appUpdateState({ status: "up-to-date" }) });
      renderCard();
      expect(document.body.textContent).toContain("omp-ui가 최신 버전입니다 (1.0.0)");
      act(() => {
        vi.advanceTimersByTime(5000);
      });
      expect(backendMock.dismissAppUpdate).toHaveBeenCalledWith("", false);
    } finally {
      vi.useRealTimers();
    }
  });

  it("uses a generic title for apply failures", () => {
    useStore.setState({
      appUpdate: appUpdateState({
        status: "error",
        error: "could not apply update: native preparation failed",
      }),
    });
    renderCard();
    expect(document.body.textContent).toContain("업데이트 실패");
    expect(document.body.textContent).not.toContain("다운로드 실패");
  });
});
