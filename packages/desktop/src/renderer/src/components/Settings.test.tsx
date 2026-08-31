// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  AppUpdateState,
  MemoryOverview,
  OmpSettingsSnapshot,
  OmpUpdateState,
  PlanFormat,
  RemoteState,
} from "@omp-ui/core/types";
import { backendState, tabInfo } from "../test/fixtures";
import type { SettingsPage } from "../store";

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const idleOmpUpdate: OmpUpdateState = {
  status: "idle",
  installPath: null,
  installedVersion: null,
  latestVersion: null,
  progress: null,
  error: null,
};

const emptyOmpSettings: OmpSettingsSnapshot = {
  entries: [],
  agentDir: null,
  projectConfigPath: null,
  error: null,
};

const idleRemote: RemoteState = {
  status: "stopped",
  enabled: false,
  bind: "localhost",
  port: 4677,
  token: "t",
  hasPassword: false,
  urls: [],
  tokenUrls: [],
  webBundleMissing: false,
  error: null,
};

// store.ts captures the preload bridge at module load, so install the mock
// before dynamically importing either the store or Settings.
const backendMock = {
  getState: vi.fn(),
  addProject: vi.fn(),
  browseDirectories: vi.fn(),
  removeProject: vi.fn(),
  moveProject: vi.fn(async () => {}),
  setDefaultMode: vi.fn(),
  setDefaultAgentMode: vi.fn(async () => {}),
  listCompactionMethods: vi.fn(async () => ["remote", "soft"]),
  setDefaultCompactionMethod: vi.fn(async () => {}),
  setPlanFormat: vi.fn(async () => {}),
  setHibernateIdleMinutes: vi.fn(async () => {}),
  setStreamStallAbortSeconds: vi.fn(async () => {}),
  setAdvisorAutoReply: vi.fn(async () => {}),
  setStallAutoContinue: vi.fn(async () => {}),
  setDesktopNotifications: vi.fn(async () => {}),
  setDefaultAdvisor: vi.fn(async () => {}),
  setSkipDeleteConfirmation: vi.fn(),
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
  setThemeId: vi.fn(async () => {}),
  setFontFamilyId: vi.fn(async () => {}),
  setAppUpdateCheckOnLaunch: vi.fn(async () => {}),
  setOmpUpdateCheckOnLaunch: vi.fn(async () => {}),
  clearDismissedAppUpdate: vi.fn(async () => {}),
  clearDismissedOmpUpdate: vi.fn(async () => {}),
  setWindowChrome: vi.fn(async () => {}),
  readOmpSettings: vi.fn(async () => emptyOmpSettings),
  readProviderKeys: vi.fn(async () => ({
    providers: [],
    encryptionAvailable: false,
    backend: "none",
  })),
  memoryOverview: vi.fn(),
  writeOmpSetting: vi.fn(async () => {}),
  getRemoteState: vi.fn(async () => idleRemote),
  setRemoteEnabled: vi.fn(async () => {}),
  setRemoteBind: vi.fn(async () => {}),
  setRemotePort: vi.fn(async () => {}),
  regenerateRemoteToken: vi.fn(async () => {}),
  setRemotePassword: vi.fn(async () => {}),
  clearRemotePassword: vi.fn(async () => {}),
  onRemoteState: vi.fn(),
};
Object.assign(window, { ompBackend: backendMock });

// Dynamic imports are required because store.ts captures the mocked preload bridge at module load.
const { useStore } = await import("../store");
const { Settings } = await import("./Settings");

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

/** Async act flushes the mount-time readOmpSettings promise. */
async function renderSettings(): Promise<void> {
  const host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root!.render(<Settings />);
  });
}

function seed(updates: {
  appUpdate?: AppUpdateState;
  ompUpdate?: OmpUpdateState;
}): void {
  useStore.setState({
    settingsPage: "updates",
    state: null,
    tabs: [],
    activeTabId: null,
    appUpdate: updates.appUpdate ?? appUpdateState({}),
    ompUpdate: updates.ompUpdate ?? idleOmpUpdate,
  });
}

const KOREAN_SETTINGS_TEXT: Record<string, string> = {
  html: "HTML",
  markdown: "마크다운",
  "30 min": "30분",
  "1 hour": "1시간",
  off: "사용 안 함",
  "3 min": "3분",
  "5 min": "5분",
  plan: "계획",
  build: "빌드",
  Memory: "메모리",
  "Set password": "비밀번호 설정",
  Clear: "지우기",
};

function buttonWithText(text: string): HTMLButtonElement | null {
  const visibleText = KOREAN_SETTINGS_TEXT[text] ?? text;
  const matches = [...document.body.querySelectorAll<HTMLButtonElement>("button")].filter(
    (candidate) => candidate.textContent === visibleText,
  );
  const action = matches.find((candidate) => !candidate.hasAttribute("aria-current"));
  return visibleText === "업데이트" ? action ?? null : action ?? matches[0] ?? null;
}

function click(el: HTMLElement): void {
  act(() => {
    el.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true }),
    );
  });
}

afterEach(() => {
  vi.clearAllMocks();
  if (root !== null) {
    act(() => root!.unmount());
    root = null;
  }
  document.body.replaceChildren();
});

describe("Settings Updates page (issue #89)", () => {
  it("offers only the checks when no update is on the table", async () => {
    seed({});
    await renderSettings();
    expect(buttonWithText("다운로드")).toBeNull();
    expect(buttonWithText("업데이트")).toBeNull();
    expect(buttonWithText("릴리스 보기")).toBeNull();
    expect(buttonWithText("지금 다시 시작")).toBeNull();
    expect(buttonWithText("폴더에서 보기")).toBeNull();
    expect(buttonWithText("지금 업데이트")).toBeNull();
  });

  it("starts a deb/rpm/flatpak update download from the omp-ui panel", async () => {
    seed({
      appUpdate: appUpdateState({
        status: "available",
        latestVersion: "1.2.0",
        format: "deb",
      }),
    });
    await renderSettings();
    click(buttonWithText("다운로드")!);
    expect(backendMock.downloadAppUpdate).toHaveBeenCalledTimes(1);
  });

  it.each(["appimage", "maczip"] as const)(
    "labels the omp-ui action Update on %s",
    async (format) => {
      seed({
        appUpdate: appUpdateState({
          status: "available",
          latestVersion: "1.2.0",
          format,
        }),
      });
      await renderSettings();
      expect(buttonWithText("다운로드")).toBeNull();
      click(buttonWithText("업데이트")!);
      expect(backendMock.downloadAppUpdate).toHaveBeenCalledTimes(1);
    },
  );

  it("falls back to View release when the package format is unknown", async () => {
    seed({
      appUpdate: appUpdateState({
        status: "available",
        latestVersion: "1.2.0",
        format: "unknown",
      }),
    });
    await renderSettings();
    click(buttonWithText("릴리스 보기")!);
    expect(backendMock.openAppUpdateReleaseNotes).toHaveBeenCalledTimes(1);
    expect(backendMock.downloadAppUpdate).not.toHaveBeenCalled();
  });

  it("offers Restart now once an AppImage update is downloaded", async () => {
    seed({
      appUpdate: appUpdateState({
        status: "downloaded",
        latestVersion: "1.2.0",
        format: "appimage",
      }),
    });
    await renderSettings();
    click(buttonWithText("지금 다시 시작")!);
    expect(backendMock.restartForAppUpdate).toHaveBeenCalledTimes(1);
  });

  it("offers Restart now once a macOS zip update is downloaded", async () => {
    seed({
      appUpdate: appUpdateState({
        status: "downloaded",
        latestVersion: "1.2.0",
        format: "maczip",
      }),
    });
    await renderSettings();
    click(buttonWithText("지금 다시 시작")!);
    expect(backendMock.restartForAppUpdate).toHaveBeenCalledTimes(1);
  });

  it("shows an applying macOS update without actions and disables checks", async () => {
    seed({
      appUpdate: appUpdateState({
        status: "installing",
        latestVersion: "1.2.0",
        format: "maczip",
      }),
    });
    await renderSettings();

    expect(document.body.textContent).toContain("1.2.0 적용 중…");
    expect(buttonWithText("지금 다시 시작")).toBeNull();
    expect(buttonWithText("종료할 때 설치")).toBeNull();
    expect(buttonWithText("지금 확인")?.disabled).toBe(true);
  });

  it("offers Show in folder once an installer download finishes", async () => {
    seed({
      appUpdate: appUpdateState({
        status: "downloaded",
        latestVersion: "1.2.0",
        format: "deb",
        downloadedPath: "/downloads/omp-ui_1.2.0_amd64.deb",
      }),
    });
    await renderSettings();
    expect(buttonWithText("지금 다시 시작")).toBeNull();
    click(buttonWithText("폴더에서 보기")!);
    expect(backendMock.showAppUpdateDownload).toHaveBeenCalledTimes(1);
  });

  it("offers Update now for an available omp update", async () => {
    seed({
      ompUpdate: {
        ...idleOmpUpdate,
        status: "available",
        installPath: "/managed/omp",
        installedVersion: "1.0.0",
        latestVersion: "1.2.0",
      },
    });
    await renderSettings();
    click(buttonWithText("지금 업데이트")!);
    expect(backendMock.downloadOmpUpdate).toHaveBeenCalledTimes(1);
  });
});

describe("Settings General page plan format (issue #109)", () => {
  const seedGeneral = (planFormat: PlanFormat): void => {
    useStore.setState({
      settingsPage: "general",
      state: backendState({ planFormat }),
      tabs: [],
      activeTabId: null,
      appUpdate: appUpdateState({}),
      ompUpdate: idleOmpUpdate,
    });
  };

  it("shows the configured format and persists a switch to markdown", async () => {
    seedGeneral("html");
    await renderSettings();
    expect(document.body.textContent).toContain("계획 형식");
    expect(buttonWithText("html")!.getAttribute("aria-pressed")).toBe("true");
    expect(buttonWithText("markdown")!.getAttribute("aria-pressed")).toBe(
      "false",
    );

    click(buttonWithText("markdown")!);
    expect(backendMock.setPlanFormat).toHaveBeenCalledWith("md");
  });

  it("reflects a persisted markdown setting", async () => {
    seedGeneral("md");
    await renderSettings();
    expect(buttonWithText("markdown")!.getAttribute("aria-pressed")).toBe(
      "true",
    );
    expect(buttonWithText("html")!.getAttribute("aria-pressed")).toBe("false");
  });
});

describe("Settings General page hibernate idle sessions (issue #246)", () => {
  const seedGeneral = (hibernateIdleMinutes: number): void => {
    useStore.setState({
      settingsPage: "general",
      state: backendState({ hibernateIdleMinutes }),
      tabs: [],
      activeTabId: null,
      appUpdate: appUpdateState({}),
      ompUpdate: idleOmpUpdate,
    });
  };

  it("shows the persisted window and persists a change", async () => {
    seedGeneral(30);
    await renderSettings();
    expect(document.body.textContent).toContain("유휴 세션 최대 절전");
    expect(document.body.textContent).toContain("각 프로젝트의 최근 세션");
    expect(buttonWithText("30 min")!.getAttribute("aria-pressed")).toBe("true");
    expect(buttonWithText("1 hour")!.getAttribute("aria-pressed")).toBe("false");

    click(buttonWithText("1 hour")!);
    expect(backendMock.setHibernateIdleMinutes).toHaveBeenCalledWith(60);
  });

  it("reflects a persisted off setting", async () => {
    seedGeneral(0);
    await renderSettings();
    expect(buttonWithText("off")!.getAttribute("aria-pressed")).toBe("true");
  });
});

describe("Settings General page stream-stall watchdog (issue #248)", () => {
  const seedGeneral = (streamStallAbortSeconds: number): void => {
    useStore.setState({
      settingsPage: "general",
      state: backendState({ streamStallAbortSeconds }),
      tabs: [],
      activeTabId: null,
      appUpdate: appUpdateState({}),
      ompUpdate: idleOmpUpdate,
    });
  };

  it("shows the persisted window and persists a change", async () => {
    seedGeneral(180);
    await renderSettings();
    expect(document.body.textContent).toContain("스트림 멈춤 감시");
    expect(buttonWithText("3 min")!.getAttribute("aria-pressed")).toBe("true");
    expect(buttonWithText("5 min")!.getAttribute("aria-pressed")).toBe("false");

    click(buttonWithText("5 min")!);
    expect(backendMock.setStreamStallAbortSeconds).toHaveBeenCalledWith(300);
  });

  it("reflects a persisted off setting", async () => {
    seedGeneral(0);
    await renderSettings();
    // Both this row and "Hibernate idle sessions" offer "off" — scope to the watchdog's group.
    const pressed = [
      ...document.querySelectorAll('[aria-label="스트림 멈춤 감시"] [aria-pressed]'),
    ].find((b) => b.textContent === "사용 안 함");
    expect(pressed?.getAttribute("aria-pressed")).toBe("true");
  });
});

describe("Settings General page default agent mode (issue #143)", () => {
  it("shows Plan by default and persists Build", async () => {
    useStore.setState({
      settingsPage: "general",
      state: backendState(),
      tabs: [],
      activeTabId: null,
      appUpdate: appUpdateState({}),
      ompUpdate: idleOmpUpdate,
    });
    await renderSettings();

    expect(buttonWithText("plan")!.getAttribute("aria-pressed")).toBe("true");
    click(buttonWithText("build")!);
    expect(backendMock.setDefaultAgentMode).toHaveBeenCalledWith("build");
  });
});

describe("Settings General page default compaction method (issue #275)", () => {
  const pickerButtons = (): HTMLButtonElement[] => [
    ...document.querySelectorAll<HTMLButtonElement>(
      '[role="group"][aria-label="기본 압축 방식"] button',
    ),
  ];
  const labelOf = (button: HTMLButtonElement): string =>
    (button.children[0] as HTMLElement).textContent ?? "";

  it("lists every installed method with its description and persists selection and clear", async () => {
    backendMock.listCompactionMethods.mockResolvedValueOnce(["soft", "remote", "future"]);
    useStore.setState({
      settingsPage: "general",
      state: backendState({ defaultCompactionMethod: "soft" }),
      compactionMethods: { status: "unloaded" },
      tabs: [],
      activeTabId: null,
      appUpdate: appUpdateState({}),
      ompUpdate: idleOmpUpdate,
    });
    await renderSettings();
    expect(pickerButtons().map(labelOf)).toEqual([
      "omp 설정 기본값",
      "소프트 압축",
      "OpenAI 서버 압축",
      "future",
    ]);
    // The persisted method is pressed; the unknown id "future" got the raw
    // label and no invented description (one child instead of two).
    expect(pickerButtons()[1].getAttribute("aria-pressed")).toBe("true");
    expect(pickerButtons()[3].children).toHaveLength(1);
    expect(document.body.textContent).toContain(
      "서버 압축 없이 압축 모델로 현재 기록을 요약합니다.",
    );
    expect(document.body.textContent).toContain(
      "현재 경로가 지원할 때 공급자 고유의 OpenAI 호환 서버 압축을 사용합니다.",
    );
    click(pickerButtons()[0]);
    expect(backendMock.setDefaultCompactionMethod).toHaveBeenCalledWith(null);
    // Mirror what the real backend round-trip does, then pick another method.
    useStore.setState((s) => ({ state: { ...s.state!, defaultCompactionMethod: null } }));
    click(pickerButtons()[2]);
    expect(backendMock.setDefaultCompactionMethod).toHaveBeenCalledWith("remote");
  });

  it("shows an unavailable persisted value as a disabled, pressed row", async () => {
    useStore.setState({
      settingsPage: "general",
      state: backendState({ defaultCompactionMethod: "removed" }),
      compactionMethods: { status: "loaded", methods: ["remote"] },
      tabs: [],
      activeTabId: null,
      appUpdate: appUpdateState({}),
      ompUpdate: idleOmpUpdate,
    });
    await renderSettings();
    const unavailable = pickerButtons().find((button) =>
      labelOf(button).includes("removed (사용할 수 없음)"),
    )!;
    expect(unavailable.disabled).toBe(true);
    expect(unavailable.getAttribute("aria-pressed")).toBe("true");
  });

  it("keeps the omp configured default selectable when the method read fails", async () => {
    backendMock.listCompactionMethods.mockRejectedValueOnce(new Error("omp binary not found"));
    useStore.setState({
      settingsPage: "general",
      state: backendState({ defaultCompactionMethod: "soft" }),
      compactionMethods: { status: "unloaded" },
      tabs: [],
      activeTabId: null,
      appUpdate: appUpdateState({}),
      ompUpdate: idleOmpUpdate,
    });
    await renderSettings();
    expect(pickerButtons()).toHaveLength(1);
    expect(labelOf(pickerButtons()[0])).toBe("omp 설정 기본값");
    expect(document.body.textContent).toContain("방식을 불러올 수 없습니다: omp binary not found");
    click(pickerButtons()[0]);
    expect(backendMock.setDefaultCompactionMethod).toHaveBeenCalledWith(null);
  });
});

describe("Settings General page advisor auto-reply (issue #111)", () => {
  const seedAutoReply = (advisorAutoReply: boolean): void => {
    useStore.setState({
      settingsPage: "general",
      state: backendState({ advisorAutoReply }),
      tabs: [],
      activeTabId: null,
      appUpdate: appUpdateState({}),
      ompUpdate: idleOmpUpdate,
    });
  };

  const autoReplySwitch = (): HTMLElement =>
    document.querySelector(
      '[role="switch"][aria-label="어드바이저 자동 응답"]',
    ) as HTMLElement;

  it("shows the setting on and persists switching it off", async () => {
    seedAutoReply(true);
    await renderSettings();
    expect(autoReplySwitch().getAttribute("aria-checked")).toBe("true");
    click(autoReplySwitch());
    expect(backendMock.setAdvisorAutoReply).toHaveBeenCalledWith(false);
  });

  it("reflects a persisted off setting", async () => {
    seedAutoReply(false);
    await renderSettings();
    expect(autoReplySwitch().getAttribute("aria-checked")).toBe("false");
  });
});

describe("Settings General page stall auto-continue (issue #251)", () => {
  const seedAutoContinue = (stallAutoContinue: boolean): void => {
    useStore.setState({
      settingsPage: "general",
      state: backendState({ stallAutoContinue }),
      tabs: [],
      activeTabId: null,
      appUpdate: appUpdateState({}),
      ompUpdate: idleOmpUpdate,
    });
  };

  const autoContinueSwitch = (): HTMLElement =>
    document.querySelector(
      '[role="switch"][aria-label="멈춤 자동 계속"]',
    ) as HTMLElement;

  it("shows the setting on and persists switching it off", async () => {
    seedAutoContinue(true);
    await renderSettings();
    expect(autoContinueSwitch().getAttribute("aria-checked")).toBe("true");
    click(autoContinueSwitch());
    expect(backendMock.setStallAutoContinue).toHaveBeenCalledWith(false);
  });

  it("reflects a persisted off setting", async () => {
    seedAutoContinue(false);
    await renderSettings();
    expect(autoContinueSwitch().getAttribute("aria-checked")).toBe("false");
  });
});

describe("Settings General page desktop notifications (issue #271)", () => {
  const seedNotifications = (desktopNotifications: boolean): void => {
    useStore.setState({
      settingsPage: "general",
      state: backendState({ desktopNotifications }),
      tabs: [],
      activeTabId: null,
      appUpdate: appUpdateState({}),
      ompUpdate: idleOmpUpdate,
    });
  };

  const notificationsSwitch = (): HTMLElement =>
    document.querySelector(
      '[role="switch"][aria-label="데스크톱 알림"]',
    ) as HTMLElement;

  it("shows the setting on and persists switching it off", async () => {
    seedNotifications(true);
    await renderSettings();
    expect(notificationsSwitch().getAttribute("aria-checked")).toBe("true");
    click(notificationsSwitch());
    expect(backendMock.setDesktopNotifications).toHaveBeenCalledWith(false);
  });

  it("reflects a persisted off setting", async () => {
    seedNotifications(false);
    await renderSettings();
    expect(notificationsSwitch().getAttribute("aria-checked")).toBe("false");
  });
});

describe("Settings General page default advisor (issue #174)", () => {
  const seedDefaultAdvisor = (defaultAdvisor: boolean): void => {
    useStore.setState({
      settingsPage: "general",
      state: backendState({ defaultAdvisor }),
      tabs: [],
      activeTabId: null,
      appUpdate: appUpdateState({}),
      ompUpdate: idleOmpUpdate,
    });
  };

  const defaultAdvisorSwitch = (): HTMLElement =>
    document.querySelector(
      '[role="switch"][aria-label="기본 어드바이저"]',
    ) as HTMLElement;

  it("shows the setting off and persists switching it on", async () => {
    seedDefaultAdvisor(false);
    await renderSettings();
    expect(defaultAdvisorSwitch().getAttribute("aria-checked")).toBe("false");
    click(defaultAdvisorSwitch());
    expect(backendMock.setDefaultAdvisor).toHaveBeenCalledWith(true);
  });

  it("reflects a persisted on setting", async () => {
    seedDefaultAdvisor(true);
    await renderSettings();
    expect(defaultAdvisorSwitch().getAttribute("aria-checked")).toBe("true");
  });
});

describe("Settings omp Providers group (issues #178 and #179)", () => {
  const timeouts = [
    {
      key: "providers.streamFirstEventTimeoutSeconds",
      type: "number" as const,
      description: "First event timeout",
      value: -1,
      options: null,
      layer: "default" as const,
    },
    {
      key: "providers.streamIdleTimeoutSeconds",
      type: "number" as const,
      description: "Idle timeout",
      value: -1,
      options: null,
      layer: "default" as const,
    },
  ];

  function seedOmp(snapshot: OmpSettingsSnapshot): void {
    backendMock.readOmpSettings.mockResolvedValue(snapshot);
    useStore.setState({
      settingsPage: "omp",
      state: backendState(),
      tabs: [],
      activeTabId: null,
      appUpdate: appUpdateState({}),
      ompUpdate: idleOmpUpdate,
    });
  }

  it("renders guidance and omp's options, then writes nitro", async () => {
    seedOmp({
      ...emptyOmpSettings,
      entries: [
        {
          key: "providers.openrouterVariant",
          type: "enum",
          description: "OpenRouter routing variant",
          value: "auto",
          options: ["auto", "nitro", "floor"],
          layer: "global",
        },
        ...timeouts,
      ],
    });
    await renderSettings();

    expect(document.body.textContent).toContain(
      "nitro 변형은 처리량을 우선합니다",
    );
    const select = document.querySelector<HTMLSelectElement>(
      'select[aria-label="providers.openrouterVariant"]',
    )!;
    expect([...select.options].map((option) => option.value)).toEqual([
      "auto",
      "nitro",
      "floor",
    ]);
    await act(async () => {
      select.value = "nitro";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(backendMock.writeOmpSetting).toHaveBeenCalledWith(
      "providers.openrouterVariant",
      "nitro",
    );
  });

  it("omits the routing row when omp does not publish the key", async () => {
    seedOmp({ ...emptyOmpSettings, entries: timeouts });
    await renderSettings();
    expect(
      document.querySelector(
        'select[aria-label="providers.openrouterVariant"]',
      ),
    ).toBeNull();
    expect(document.body.textContent).not.toContain(
      "providers.openrouterVariant",
    );
  });

  it("offers the global MCP manager without a focused session", async () => {
    seedOmp(emptyOmpSettings);
    await renderSettings();
    const globalBtn = buttonWithText("전역 MCP 서버…");
    const projectBtn = buttonWithText("MCP 서버…");
    expect(globalBtn).not.toBeNull();
    expect(globalBtn!.disabled).toBe(false);
    expect(projectBtn!.disabled).toBe(true);

    click(globalBtn!);
    expect(useStore.getState().mcpManager).toEqual({ scopeCwd: null });
    expect(useStore.getState().settingsPage).toBeNull();
  });
});

describe("Settings Memory page (issue #213)", () => {
  const memoryEntries: OmpSettingsSnapshot["entries"] = [
    {
      key: "memory.backend",
      type: "enum",
      description: "Memory backend",
      value: "mnemopi",
      options: ["off", "mnemopi"],
      layer: "global",
    },
    {
      key: "mnemopi.scoping",
      type: "enum",
      description: "Bank scoping",
      value: "per-project-tagged",
      options: ["global", "per-project", "per-project-tagged"],
      layer: "project",
    },
    {
      key: "mnemopi.autoRecall",
      type: "boolean",
      description: "Recall automatically",
      value: true,
      options: null,
      layer: "global",
    },
    {
      key: "mnemopi.autoRetain",
      type: "boolean",
      description: "Retain automatically",
      value: true,
      options: null,
      layer: "project",
    },
    {
      key: "mnemopi.noEmbeddings",
      type: "boolean",
      description: "Disable embeddings",
      value: false,
      options: null,
      layer: "global",
    },
    {
      key: "autolearn.enabled",
      type: "boolean",
      description: "Auto-learn skills",
      value: true,
      options: null,
      layer: "project",
    },
  ];

  const overview: MemoryOverview = {
    backend: "mnemopi",
    scoping: "per-project-tagged",
    baseDir: "/home/a/.omp/memory",
    global: {
      bank: "global",
      dbPath: "/home/a/.omp/memory/global/db.sqlite",
      exists: true,
      sizeBytes: 1024,
      workingCount: 2,
      episodicCount: 3,
      lastWrite: null,
    },
    project: {
      bank: "project-abc",
      dbPath: "/home/a/.omp/memory/project-abc/db.sqlite",
      exists: false,
      sizeBytes: 0,
      workingCount: 0,
      episodicCount: 0,
      lastWrite: null,
    },
    error: null,
  };

  function seedMemory(focused = true): void {
    backendMock.readOmpSettings.mockResolvedValue({
      ...emptyOmpSettings,
      agentDir: "/home/a/.omp",
      entries: memoryEntries,
    });
    backendMock.memoryOverview.mockResolvedValue(overview);
    const tab = tabInfo();
    useStore.setState({
      settingsPage: "memory",
      state: backendState(),
      tabs: focused ? [tab] : [],
      activeTabId: focused ? tab.tabId : null,
      appUpdate: appUpdateState({}),
      ompUpdate: idleOmpUpdate,
    });
  }

  it("relocates all six controls from omp and preserves layer badges", async () => {
    seedMemory();
    await renderSettings();

    expect(buttonWithText("Memory")?.getAttribute("aria-current")).toBe("page");
    for (const entry of memoryEntries) {
      expect(document.querySelector(`[aria-label="${entry.key}"]`)).not.toBeNull();
    }
    expect(document.body.textContent).toContain("global");
    expect(document.body.textContent).toContain("project");

    click(buttonWithText("omp")!);
    for (const entry of memoryEntries) {
      expect(document.querySelector(`[aria-label="${entry.key}"]`)).toBeNull();
    }
  });

  it("shows the focused project's resolved bank paths and states", async () => {
    seedMemory();
    await renderSettings();

    expect(backendMock.memoryOverview).toHaveBeenCalledWith("/project");
    expect(document.body.textContent).toContain("mnemopi");
    expect(document.body.textContent).toContain("per-project-tagged");
    expect(document.body.textContent).toContain("/home/a/.omp/memory");
    expect(document.body.textContent).toContain("/home/a/.omp/memory/global/db.sqlite");
    expect(document.body.textContent).toContain("/home/a/.omp/memory/project-abc/db.sqlite");
    expect(document.body.textContent).toContain("있음");
    expect(document.body.textContent).toContain("아직 없음");
  });

  it("writes through the existing path, then refreshes settings and overview", async () => {
    seedMemory();
    await renderSettings();
    const toggle = document.querySelector<HTMLElement>(
      '[role="switch"][aria-label="mnemopi.autoRecall"]',
    )!;

    await act(async () => click(toggle));

    expect(backendMock.writeOmpSetting).toHaveBeenCalledWith(
      "mnemopi.autoRecall",
      false,
    );
    expect(backendMock.readOmpSettings).toHaveBeenCalledTimes(2);
    expect(backendMock.memoryOverview).toHaveBeenCalledTimes(2);
  });

  it("keeps controls usable without a focused tab and skips overview IPC", async () => {
    seedMemory(false);
    await renderSettings();

    expect(backendMock.memoryOverview).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain(
      "세션 탭을 선택하면 적용 중인 백엔드와 뱅크 위치를 확인할 수 있습니다.",
    );
    expect(
      document.querySelector('[role="switch"][aria-label="mnemopi.autoRecall"]'),
    ).not.toBeNull();
  });
});

describe("Settings Remote page password row", () => {
  function seedRemote(patch: Partial<RemoteState>): void {
    useStore.setState({
      settingsPage: "remote",
      state: null,
      tabs: [],
      activeTabId: null,
      remote: {
        ...idleRemote,
        enabled: true,
        status: "listening",
        urls: ["http://127.0.0.1:4677/"],
        tokenUrls: ["http://127.0.0.1:4677/?t=t"],
        port: 4677,
        ...patch,
      },
    });
  }

  function passwordInput(): HTMLInputElement {
    const input = document.body.querySelector<HTMLInputElement>(
      'input[aria-label="원격 접속 비밀번호"]',
    );
    expect(input).not.toBeNull();
    return input!;
  }

  async function typeInto(input: HTMLInputElement, value: string): Promise<void> {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    await act(async () => {
      setter.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
  }

  it("saves a typed password with Enter", async () => {
    seedRemote({ hasPassword: false });
    await renderSettings();

    click(buttonWithText("Set password")!);
    await typeInto(passwordInput(), "correct-horse-battery");
    await act(async () => {
      passwordInput().dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }),
      );
    });

    expect(backendMock.setRemotePassword).toHaveBeenCalledTimes(1);
    expect(backendMock.setRemotePassword).toHaveBeenCalledWith("correct-horse-battery");
  });

  it("clears the password when asked", async () => {
    seedRemote({ hasPassword: true });
    await renderSettings();

    expect(document.body.textContent).toContain("비밀번호 설정됨");
    click(buttonWithText("Clear")!);
    await act(async () => {});

    expect(backendMock.clearRemotePassword).toHaveBeenCalledTimes(1);
  });
});
describe("Settings page footer dispatch (issue #300)", () => {
  const cases: ReadonlyArray<{ page: SettingsPage; marker: string | null }> = [
    { page: "general", marker: "기본 세션·에이전트 모드는 새 세션부터 적용" },
    { page: "appearance", marker: null },
    { page: "updates", marker: "다운로드와 설치는 항상 사용자가 눌러야 시작됩니다." },
    { page: "remote", marker: "여기의 설정을 바꾸면 서버만 다시 시작" },
    { page: "providers", marker: "omp는 환경 변수에서 인증정보를 읽으므로" },
    { page: "memory", marker: "메모리 설정은 변경 후 시작한 세션부터 적용됩니다." },
    { page: "omp", marker: "omp는 프로세스 시작 시 모델 역할과 어드바이저 설정을 불러오므로" },
    { page: "about", marker: null },
  ];
  for (const { page, marker } of cases) {
    it(`${page} renders its own footer`, async () => {
      useStore.setState({
        settingsPage: page,
        state: backendState(),
        tabs: [],
        activeTabId: null,
      });
      await renderSettings();
      const footer = document.body.querySelector("footer");
      if (marker === null) expect(footer).toBeNull();
      else expect(footer?.textContent).toContain(marker);
    });
  }
});

describe("Settings Appearance page font family (issue #315)", () => {
  const seedAppearance = (fontFamilyId: string): void => {
    useStore.setState({
      settingsPage: "appearance",
      state: backendState({ fontFamilyId }),
      tabs: [],
      activeTabId: null,
      appUpdate: appUpdateState({}),
      ompUpdate: idleOmpUpdate,
    });
  };

  const fontCard = (id: string): HTMLButtonElement =>
    document.querySelector<HTMLButtonElement>(
      `button[aria-label="${id} 글꼴"]`,
    )!;

  it("shows the persisted family and persists a switch to Ubuntu", async () => {
    seedAppearance("default");
    await renderSettings();
    expect(document.body.textContent).toContain("글꼴");
    expect(fontCard("Default").getAttribute("aria-pressed")).toBe("true");
    expect(fontCard("Ubuntu").getAttribute("aria-pressed")).toBe("false");

    click(fontCard("Ubuntu"));
    expect(backendMock.setFontFamilyId).toHaveBeenCalledWith("ubuntu");
    expect(document.documentElement.style.getPropertyValue("--font-sans")).toContain("Ubuntu");
    expect(document.documentElement.style.getPropertyValue("--font-mono")).toContain("Ubuntu Mono");
  });

  it("reflects a persisted ubuntu setting", async () => {
    seedAppearance("ubuntu");
    await renderSettings();
    expect(fontCard("Ubuntu").getAttribute("aria-pressed")).toBe("true");
    expect(fontCard("Default").getAttribute("aria-pressed")).toBe("false");
  });
});
