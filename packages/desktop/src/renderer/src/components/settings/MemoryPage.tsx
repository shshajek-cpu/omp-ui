import { useEffect, useRef, useState } from "react";
import type {
  MemoryOverview,
  OmpSettingEntry,
  OmpSettingValue,
} from "@omp-ui/core/types";
import { MEMORY_SETTING_GROUP } from "@omp-ui/core/omp-settings-keys";
import { backend, displayMessage } from "../../backend";
import { useStore } from "../../store";
import { Button, Chip, Empty, Label, Panel } from "../ui";
import { Row, SettingControl, layerBadge } from "./rows";
import { OMP_MISSING, type FooterContext, type Load } from "./types";

type OverviewLoad =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "loaded"; overview: MemoryOverview }
  | { status: "error"; message: string };

function MemoryBankPath({
  label,
  path,
  exists,
}: {
  label: string;
  path: string;
  exists: boolean;
}) {
  return (
    <div className="grid grid-cols-[4.5rem_minmax(0,1fr)_auto] items-baseline gap-2">
      <span className="text-[10px] uppercase tracking-wide text-ink-faint">
        {label}
      </span>
      <span className="truncate font-mono text-[10px] text-ink-mid" title={path}>
        {path}
      </span>
      <Chip tone={exists ? undefined : "copper"}>
        {exists ? "있음" : "아직 없음"}
      </Chip>
    </div>
  );
}

function MemoryOverviewPanel({
  load,
  projectCwd,
  retry,
}: {
  load: OverviewLoad;
  projectCwd: string | null;
  retry: () => void;
}) {
  if (projectCwd === null) {
    return (
      <Panel className="px-3 py-2.5">
        <Label>확인된 메모리</Label>
        <p className="mt-1 text-[11px] leading-relaxed text-ink-faint">
          세션 탭을 선택하면 적용 중인 백엔드와 뱅크 위치를 확인할 수 있습니다.
        </p>
      </Panel>
    );
  }
  if (load.status === "idle" || load.status === "loading") {
    return (
      <Panel className="px-3 py-2.5">
        <Label>확인된 메모리</Label>
        <p className="mt-1 text-[11px] text-ink-faint">메모리 뱅크 확인 중…</p>
      </Panel>
    );
  }
  if (load.status === "error") {
    return (
      <Panel className="px-3 py-2.5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] leading-relaxed text-rose">{load.message}</p>
          <Button size="xs" onClick={retry}>다시 시도</Button>
        </div>
      </Panel>
    );
  }

  const { overview } = load;
  return (
    <Panel className="space-y-2 px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <Label className="mr-auto">확인된 메모리</Label>
        <Chip mono>{overview.backend}</Chip>
        <Chip mono>{overview.scoping}</Chip>
      </div>
      {overview.error !== null && (
        <div className="flex items-center justify-between gap-3 rounded border border-rose-dim/50 bg-rose-wash px-2 py-1.5">
          <p className="text-[11px] leading-relaxed text-rose">{overview.error}</p>
          <Button size="xs" onClick={retry}>다시 시도</Button>
        </div>
      )}
      <div className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-baseline gap-2">
        <span className="text-[10px] uppercase tracking-wide text-ink-faint">base</span>
        <span className="truncate font-mono text-[10px] text-ink-mid" title={overview.baseDir}>
          {overview.baseDir}
        </span>
      </div>
      <MemoryBankPath
        label="global"
        path={overview.global.dbPath}
        exists={overview.global.exists}
      />
      {overview.project !== null ? (
        <MemoryBankPath
          label="project"
          path={overview.project.dbPath}
          exists={overview.project.exists}
        />
      ) : (
        <p className="text-[10px] leading-relaxed text-ink-faint">
          {overview.scoping === "global"
            ? "이 프로젝트는 전역 뱅크를 사용합니다."
            : "아직 프로젝트 뱅크를 찾지 못했습니다."}
        </p>
      )}
    </Panel>
  );
}

export function MemoryPage({
  load,
  projectCwd,
  pendingKey,
  writeError,
  commit,
  retry,
  overviewRevision,
}: {
  load: Load;
  projectCwd: string | null;
  pendingKey: string | null;
  writeError: string | null;
  commit: (key: string, value: OmpSettingValue) => void;
  retry: () => void;
  overviewRevision: number;
}) {
  const openSettings = useStore((state) => state.openSettings);
  const [overviewLoad, setOverviewLoad] = useState<OverviewLoad>({ status: "idle" });
  const [overviewRetry, setOverviewRetry] = useState(0);
  const overviewGeneration = useRef(0);

  useEffect(() => {
    const generation = ++overviewGeneration.current;
    if (projectCwd === null) {
      setOverviewLoad({ status: "idle" });
      return;
    }

    let stale = false;
    setOverviewLoad({ status: "loading" });
    backend.memoryOverview(projectCwd).then(
      (overview) => {
        if (!stale && generation === overviewGeneration.current) {
          setOverviewLoad({ status: "loaded", overview });
        }
      },
      (error: unknown) => {
        if (!stale && generation === overviewGeneration.current) {
          setOverviewLoad({ status: "error", message: displayMessage(error) });
        }
      },
    );
    return () => {
      stale = true;
    };
  }, [projectCwd, overviewRevision, overviewRetry]);

  const overviewPanel = (
    <MemoryOverviewPanel
      load={overviewLoad}
      projectCwd={projectCwd}
      retry={() => setOverviewRetry((revision) => revision + 1)}
    />
  );

  if (load.status === "loading") {
    return (
      <div className="space-y-3 px-4 py-3">
        {overviewPanel}
        <Empty title="메모리 설정을 읽는 중…" />
      </div>
    );
  }
  const failure =
    load.status === "error"
      ? load.message
      : load.snapshot.error !== null
        ? load.snapshot.error
        : null;
  if (failure !== null || load.status !== "loaded") {
    const missing = failure === OMP_MISSING;
    return (
      <div className="space-y-3 px-4 py-3">
        {overviewPanel}
        <Empty
          title="메모리 설정을 읽지 못했습니다"
          hint={missing ? "omp가 설치되지 않아 아직 설정할 항목이 없습니다." : (failure ?? undefined)}
          action={
            <div className="flex items-center gap-2">
              <Button size="xs" onClick={retry}>다시 시도</Button>
              {missing && (
                <Button size="xs" variant="ghost" onClick={() => openSettings("updates")}>
                  업데이트 화면에서 omp 설치
                </Button>
              )}
            </div>
          }
        />
      </div>
    );
  }

  const byKey = new Map(load.snapshot.entries.map((entry) => [entry.key, entry]));
  const entries = MEMORY_SETTING_GROUP.keys
    .map((key) => byKey.get(key))
    .filter((entry): entry is OmpSettingEntry => entry !== undefined);

  return (
    <div className="space-y-3 px-4 py-3">
      <div>
        <p className="text-xs font-medium text-ink">지속형 메모리 설정</p>
        <p className="mt-0.5 text-[11px] leading-relaxed text-ink-faint">
          이후 세션이 보관하고 회상할 내용을 설정하고, 선택한 프로젝트에 적용되는 메모리 뱅크를 확인합니다.
        </p>
      </div>
      {overviewPanel}
      {writeError !== null && (
        <p className="rounded-md border border-rose-dim/50 bg-rose-wash px-3 py-2 text-xs text-rose">
          {writeError}
        </p>
      )}
      {entries.length > 0 && (
        <section>
          <div className="flex items-center gap-2">
            <Label>{MEMORY_SETTING_GROUP.title}</Label>
          </div>
          {MEMORY_SETTING_GROUP.description !== undefined && (
            <p className="mt-0.5 text-[11px] leading-relaxed text-ink-faint">
              {MEMORY_SETTING_GROUP.description}
            </p>
          )}
          <div className="mt-1 divide-y divide-line-soft">
            {entries.map((entry) => (
              <Row
                key={entry.key}
                title={entry.key}
                hint={entry.description}
                badge={layerBadge(entry.layer)}
              >
                <SettingControl entry={entry} pendingKey={pendingKey} commit={commit} />
              </Row>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export function MemoryFooter({ agentDir }: FooterContext) {
  return (
    <p>
      변경 내용은 omp 전역 설정(
      <span className="font-mono">{agentDir ?? "…"}/config.yml</span>)에 기록됩니다.
      프로젝트의 <span className="font-mono">.omp/config.yml</span>이 우선할 수 있으며
      이 경우 <span className="font-mono">project</span>로 표시됩니다.
      메모리 설정은 변경 후 시작한 세션부터 적용됩니다.
    </p>
  );
}
