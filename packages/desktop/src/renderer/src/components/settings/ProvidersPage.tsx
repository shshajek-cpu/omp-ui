import { useEffect, useRef, useState, type ReactNode } from "react";
import type {
  ProviderKeysSnapshot,
  ProviderKeyStatus,
} from "@omp-ui/core/types";
import { displayMessage } from "../../backend";
import { cn } from "../../lib/cn";
import { useStore } from "../../store";
import { Button, Chip, Dot, Empty, Label, Panel } from "../ui";
import { FIELD } from "./rows";
import type { FooterContext } from "./types";

type ProviderLoad =
  | { status: "loading" }
  | { status: "loaded"; snapshot: ProviderKeysSnapshot }
  | { status: "error"; message: string };

/** How the row labels each source, and how loudly. */
function sourceChip(row: ProviderKeyStatus): ReactNode {
  if (row.source === "stored") return <Chip tone="signal">앱에 저장됨</Chip>;
  if (row.source === "environment") return <Chip>환경 변수</Chip>;
  if (row.source === "login-shell")
    return <Chip tone="iris">셸 프로필</Chip>;
  if (row.source === "dotenv") return <Chip tone="copper">프로젝트 .env</Chip>;
  return null;
}

/**
 * One provider row: masked status plus an input that appears on demand. The
 * input is never pre-filled — the renderer has no key material to fill it with,
 * only a masked tail — so typing always means "replace this credential".
 */
function ProviderRow({
  row,
  busy,
  onSave,
  onClear,
}: {
  row: ProviderKeyStatus;
  busy: boolean;
  onSave: (value: string) => void;
  onClear: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) input.current?.focus();
  }, [editing]);

  const save = (): void => {
    const value = draft.trim();
    if (value === "") return;
    setDraft("");
    setEditing(false);
    onSave(value);
  };

  const cancel = (): void => {
    setDraft("");
    setEditing(false);
  };

  return (
    <div className="py-2.5">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-ink">{row.label}</span>
            {sourceChip(row)}
          </div>
          <p className="mt-0.5 font-mono text-[10px] text-ink-faint">
            {row.activeEnv}
            {row.masked !== null && (
              <span className="ml-2 text-ink-dim">{row.masked}</span>
            )}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {!editing && (
            <Button size="xs" disabled={busy} onClick={() => setEditing(true)}>
              {row.source === "stored" ? "교체" : "키 추가"}
            </Button>
          )}
          {!editing && row.source === "stored" && (
            <Button size="xs" variant="ghost" disabled={busy} onClick={onClear}>
              제거
            </Button>
          )}
        </div>
      </div>

      {editing && (
        <div className="mt-2 flex items-center gap-1.5">
          <input
            ref={input}
            // `password` so the value is not readable over a shoulder or in a
            // screen share, and so no password manager offers to autofill it.
            type="password"
            value={draft}
            aria-label={`${row.label} 키`}
            placeholder={row.hint ?? row.env}
            spellCheck={false}
            autoComplete="off"
            disabled={busy}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                save();
              } else if (e.key === "Escape") {
                // Stopped so Escape closes the editor, not the whole modal.
                e.preventDefault();
                e.stopPropagation();
                cancel();
              }
            }}
            className={cn(FIELD, "flex-1")}
          />
          <Button
            size="xs"
            disabled={busy || draft.trim() === ""}
            onClick={save}
          >
            저장
          </Button>
          <Button size="xs" variant="ghost" disabled={busy} onClick={cancel}>
            취소
          </Button>
        </div>
      )}

      {row.shadowsEnvironment && !editing && (
        <p className="mt-1 text-[11px] leading-relaxed text-ink-faint">
          환경에 이미 설정된 <span className="font-mono">{row.activeEnv}</span> 값을
          이 키로 덮어씁니다.
        </p>
      )}
    </div>
  );
}

export function ProvidersPage({ projectCwd }: { projectCwd: string | null }) {
  const readProviderKeys = useStore((s) => s.readProviderKeys);
  const setProviderKey = useStore((s) => s.setProviderKey);
  const clearProviderKey = useStore((s) => s.clearProviderKey);

  const [load, setLoad] = useState<ProviderLoad>({ status: "loading" });
  /** env name of the row with a write in flight; its controls stay disabled. */
  const [pendingEnv, setPendingEnv] = useState<string | null>(null);
  const [writeError, setWriteError] = useState<string | null>(null);
  const gen = useRef(0);

  useEffect(() => {
    const g = ++gen.current;
    setLoad({ status: "loading" });
    readProviderKeys(projectCwd).then(
      (snapshot) => {
        if (g === gen.current) setLoad({ status: "loaded", snapshot });
      },
      (err: unknown) => {
        if (g === gen.current)
          setLoad({ status: "error", message: displayMessage(err) });
      },
    );
  }, [readProviderKeys, projectCwd]);

  /** Every write answers with the refreshed snapshot, so no re-read is needed. */
  const run = (envName: string, op: Promise<ProviderKeysSnapshot>): void => {
    setPendingEnv(envName);
    op.then(
      (snapshot) => {
        setWriteError(null);
        setLoad({ status: "loaded", snapshot });
      },
      (err: unknown) => setWriteError(displayMessage(err)),
    ).finally(() => setPendingEnv(null));
  };

  if (load.status === "loading") {
    return <Empty title="제공자 정보를 읽는 중…" />;
  }
  if (load.status === "error") {
    return <Empty title="제공자 키를 읽지 못했습니다" hint={load.message} />;
  }

  const { providers, encryptionAvailable, backend } = load.snapshot;
  const configured = providers.filter((p) => p.source !== "none");
  const groups: ReadonlyArray<{
    id: ProviderKeyStatus["group"];
    label: string;
  }> = [
    { id: "models", label: "모델 제공자" },
    { id: "search", label: "웹 검색" },
  ];

  return (
    <div className="space-y-3 px-4 py-3">
      <Panel className="px-4 py-3">
        <div className="flex items-center gap-2">
          <Dot tone={configured.length > 0 ? "signal" : "copper"} />
          <p className="text-xs font-medium text-ink">
            {configured.length === 0
              ? "제공자 인증정보가 없습니다 — 키가 필요 없는 모델만 사용할 수 있습니다"
              : `제공자 ${providers.length}곳 중 ${configured.length}곳에 인증정보가 있습니다`}
          </p>
        </div>
        {encryptionAvailable ? (
          <p className="mt-1.5 text-[11px] leading-relaxed text-ink-faint">
            추가한 키는 운영체제 인증 저장소(
            <span className="font-mono">{backend}</span>)로 암호화됩니다.
          </p>
        ) : (
          <p className="mt-1.5 text-[11px] leading-relaxed text-copper">
            사용할 수 있는 운영체제 인증 저장소가 없어 키를 안전하게 저장할 수 없습니다.
            셸 프로필에서 환경 변수로 내보내세요.
          </p>
        )}
      </Panel>

      {writeError !== null && (
        <p className="text-[11px] leading-relaxed text-rose">{writeError}</p>
      )}

      {groups.map(({ id, label }) => {
        const rows = providers.filter((p) => p.group === id);
        if (rows.length === 0) return null;
        return (
          <div key={id} className="space-y-0.5">
            <Label>{label}</Label>
            <div className="divide-y divide-line-soft">
              {rows.map((row) => (
                <ProviderRow
                  key={row.id}
                  row={row}
                  busy={pendingEnv !== null}
                  onSave={(value) =>
                    run(row.env, setProviderKey(row.env, value))
                  }
                  onClear={() => run(row.env, clearProviderKey(row.activeEnv))}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function ProvidersFooter({ anyLive }: FooterContext) {
  return (
    <p>
      omp는 환경 변수에서 인증정보를 읽으므로 omp-ui가 실행하는 모든 세션에
      이 값을 전달합니다. 여기서 추가한 키는 다음 세션부터 적용됩니다.
      {anyLive && " 지금 적용하려면 세션의 MCP 화면에서 다시 시작하세요."}
      셸 프로필의 키와 프로젝트 <span className="font-mono">.env</span>는
      omp가 자동으로 읽으므로 다시 입력할 필요가 없습니다.
    </p>
  );
}
