import { useEffect, useRef, useState } from "react";
import type { RemoteState } from "@omp-ui/core/types";
import QRCode from "qrcode";
import { cn } from "../../lib/cn";
import { useStore } from "../../store";
import {
  Button,
  ChoiceCapsule,
  CopyButton,
  Dot,
  Label,
  Panel,
  Switch,
} from "../ui";
import { CommitField, FIELD, Row } from "./rows";

function remoteStatusLine(r: RemoteState): string {
  switch (r.status) {
    case "starting":
      return "시작 중…";
    case "listening":
      return `${r.port} 포트에서 대기 중`;
    case "error":
      return r.error ?? "서버를 시작하지 못했습니다";
    default:
      return "중지됨";
  }
}

function remoteStatusTone(
  status: RemoteState["status"],
): "signal" | "copper" | "rose" | "neutral" {
  if (status === "listening") return "signal";
  if (status === "starting") return "copper";
  if (status === "error") return "rose";
  return "neutral";
}

/**
 * The QR of the pairing URL. Rendered as an SVG string rather than a canvas: qrcode's `browser`
 * field remaps its entry and stubs `fs`, so `toString(..., { type: "svg" })` is the one route that
 * needs no polyfill in either the renderer or the web bundle.
 */
function PairingQr({ url, hasPassword }: { url: string; hasPassword: boolean }) {
  const [svg, setSvg] = useState("");

  useEffect(() => {
    let live = true;
    setSvg("");
    void QRCode.toString(url, {
      type: "svg",
      margin: 1,
      // Deliberately NOT theme tokens: a scannable QR needs true black on true white, and a
      // camera does not care about the app's palette.
      color: { dark: "#000000", light: "#ffffff" },
    }).then(
      (out) => {
        if (live) setSvg(out);
      },
      () => {
        // A QR that will not render must not take the page down — the URL above still copies.
      },
    );
    return () => {
      live = false;
    };
  }, [url]);

  if (svg === "") return null;
  return (
    <Panel className="flex items-center gap-3 px-4 py-3">
      <div
        className="size-32 shrink-0 rounded-md bg-white p-1.5"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      <div className="min-w-0">
        <Label>QR 코드로 연결</Label>
        <p className="mt-1 text-[11px] leading-relaxed text-ink-faint">
          {hasPassword
            ? "휴대전화 브라우저에서 omp-ui를 열고 비밀번호를 요청합니다."
            : "접속 토큰을 포함해 휴대전화 브라우저에서 omp-ui를 엽니다."}
        </p>
      </div>
    </Panel>
  );
}

/**
 * The remote sign-in password row. Mirrors ProviderRow: self-managed editing/draft state, the
 * input never pre-filled (only a hash exists server-side, nothing to reveal), Enter saves,
 * Escape cancels without closing the modal.
 */
function PasswordRow() {
  const hasPassword = useStore((s) => s.remote.hasPassword);
  const setRemotePassword = useStore((s) => s.setRemotePassword);
  const clearRemotePassword = useStore((s) => s.clearRemotePassword);
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
    void setRemotePassword(value); // policy rejections surface via alertRemoteError
  };

  const cancel = (): void => {
    setDraft("");
    setEditing(false);
  };

  return (
    <div className="py-2.5">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-ink">비밀번호</p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-ink-faint">
            원격 기기의 기본 로그인 수단입니다. 솔트 해시로 저장되므로 확인할 수 없고
            변경하거나 지울 수만 있습니다.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {!editing && !hasPassword && (
            <Button size="xs" onClick={() => setEditing(true)}>
              비밀번호 설정
            </Button>
          )}
          {!editing && hasPassword && (
            <>
              <span className="text-[11px] text-ink-mid">비밀번호 설정됨</span>
              <Button size="xs" variant="ghost" onClick={() => setEditing(true)}>
                변경
              </Button>
              <Button size="xs" onClick={() => void clearRemotePassword()}>
                지우기
              </Button>
            </>
          )}
        </div>
      </div>
      {editing && (
        <div className="mt-2 flex items-center gap-1.5">
          <input
            ref={input}
            type="password"
            value={draft}
            aria-label="원격 접속 비밀번호"
            placeholder="8자 이상"
            spellCheck={false}
            autoComplete="new-password"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                save();
              } else if (e.key === "Escape") {
                // Stopped so Escape cancels the row, not the whole modal.
                e.preventDefault();
                e.stopPropagation();
                cancel();
              }
            }}
            className={cn(FIELD, "flex-1")}
          />
          <Button size="xs" disabled={draft.trim() === ""} onClick={save}>
            저장
          </Button>
          <Button size="xs" variant="ghost" onClick={cancel}>
            취소
          </Button>
        </div>
      )}
    </div>
  );
}

const REMOTE_BIND_OPTIONS = [
  { value: "localhost", label: "이 컴퓨터만" },
  { value: "lan", label: "로컬 네트워크" },
] as const;

export function RemotePage() {
  const remote = useStore((s) => s.remote);
  const setRemoteEnabled = useStore((s) => s.setRemoteEnabled);
  const setRemoteBind = useStore((s) => s.setRemoteBind);
  const setRemotePort = useStore((s) => s.setRemotePort);
  const regenerateRemoteToken = useStore((s) => s.regenerateRemoteToken);
  const [revealed, setRevealed] = useState(false);

  const primaryUrl = remote.urls[0] ?? null;

  return (
    <div className="space-y-3 px-4 py-3">
      <Panel className="px-4 py-3">
        <div className="flex items-center gap-2">
          <Dot
            tone={remoteStatusTone(remote.status)}
            pulse={remote.status === "starting"}
          />
          <p className="text-xs font-medium text-ink">
            {remoteStatusLine(remote)}
          </p>
        </div>
        {remote.webBundleMissing && (
          <p className="mt-1.5 text-[11px] leading-relaxed text-copper">
            브라우저 번들이 없습니다 —{" "}
            <span className="font-mono">npm run build:web</span>을 실행하세요
          </p>
        )}
      </Panel>

      <div className="divide-y divide-line-soft">
        <Row
          title="원격 접속 사용"
          hint="기본적으로 꺼져 있습니다. 연결된 사용자는 파일 편집과 명령 실행을 포함해 이 앱의 모든 기능을 사용할 수 있습니다."
        >
          <Switch
            on={remote.enabled}
            onChange={(next) => void setRemoteEnabled(next)}
            label="원격 접속 사용"
          />
        </Row>
        <div>
          <Row
            title="접속 범위"
            hint="서버가 연결을 받을 네트워크 범위를 선택합니다."
          >
            <ChoiceCapsule
              label="접속 범위"
              value={remote.bind}
              options={REMOTE_BIND_OPTIONS}
              onChange={(value) => void setRemoteBind(value)}
              optionClassName="px-2 text-[11px]"
            />
          </Row>
          {remote.bind === "lan" && (
            <p className="pb-2.5 text-[11px] leading-relaxed text-rose">
              같은 네트워크에서 비밀번호나 토큰 링크를 아는 사람은 에이전트를 조작할 수 있습니다.
              일반 HTTP 연결이므로 암호화되지 않습니다.
            </p>
          )}
        </div>
        <Row title="포트" hint="1024부터 65535 사이의 정수를 입력하세요.">
          <CommitField
            current={String(remote.port)}
            kind="number"
            label="원격 접속 포트"
            disabled={false}
            className="w-24"
            onCommit={(raw) => void setRemotePort(Number(raw))}
          />
        </Row>
        <PasswordRow />
        <Row
          title="접속 토큰(예비)"
          hint="비밀번호가 설정되어 있어도 사용할 수 있습니다. 토큰을 새로 만들면 기존 토큰으로 연결된 모든 기기가 끊깁니다."
        >
          <div className="flex items-center gap-1.5">
            <span
              data-selectable
              className="max-w-48 truncate font-mono text-[11px] text-ink-mid"
              title={revealed ? remote.token : undefined}
            >
              {revealed ? remote.token : "••••••••••••"}
            </span>
            <Button
              size="xs"
              variant="ghost"
              onClick={() => setRevealed((v) => !v)}
            >
              {revealed ? "숨기기" : "보기"}
            </Button>
            <CopyButton text={remote.token} />
            <Button size="xs" onClick={() => void regenerateRemoteToken()}>
              새로 만들기
            </Button>
          </div>
        </Row>
        <Row
          title="접속 주소"
          hint={
            remote.hasPassword
              ? "다른 기기에서 이 주소를 열고 비밀번호로 로그인하세요."
              : "다른 기기에서 이 주소를 여세요. 토큰이 주소에 포함됩니다."
          }
        >
          <div className="flex items-center gap-1.5">
            <span
              data-selectable
              className="max-w-64 truncate font-mono text-[11px] text-ink-mid"
              title={primaryUrl ?? undefined}
            >
              {primaryUrl ?? "—"}
            </span>
            {primaryUrl !== null && <CopyButton text={primaryUrl} />}
          </div>
        </Row>
        {remote.hasPassword && (
          <Row
            title="토큰 링크(예비)"
            hint="비밀번호를 입력하기 어려운 기기에서 사용할 수 있는 전체 권한 주소입니다."
          >
            <div className="flex items-center gap-1.5">
              <span
                data-selectable
                className="max-w-64 truncate font-mono text-[11px] text-ink-mid"
                title={remote.tokenUrls[0] ?? undefined}
              >
                {remote.tokenUrls[0] ?? "—"}
              </span>
              {remote.tokenUrls[0] !== undefined && (
                <CopyButton text={remote.tokenUrls[0]} />
              )}
            </div>
          </Row>
        )}
      </div>

      {remote.urls.length > 1 && (
        <div className="space-y-0.5">
          <Label>추가 접속 주소</Label>
          {remote.urls.slice(1).map((url) => (
            <p
              key={url}
              data-selectable
              className="truncate font-mono text-[11px] text-ink-faint"
            >
              {url}
            </p>
          ))}
        </div>
      )}

      {remote.status === "listening" && primaryUrl !== null && (
        <PairingQr url={primaryUrl} hasPassword={remote.hasPassword} />
      )}
    </div>
  );
}

export function RemoteFooter() {
  return (
    <p>
      localhost에서는 완전한 브라우저 앱으로 동작합니다. 로컬 네트워크에서는
      반응형 웹 앱으로 사용할 수 있지만, 설치와 오프라인 기능은 HTTPS 같은
      보안 연결에서만 제공됩니다. 여기의 설정을 바꾸면 서버만 다시 시작하며
      세션은 계속 실행됩니다.
    </p>
  );
}
