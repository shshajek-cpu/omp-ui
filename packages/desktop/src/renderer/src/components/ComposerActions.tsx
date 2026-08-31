import type { PromptRoute } from "../lib/rpc-types";
import { Button, IconButton, Label } from "./ui";

/**
 * The composer's running/idle send cluster, one component across all three
 * surfaces (issue #299): the desktop action row, the compact row, and the
 * compact options sheet. The route verbs are pure fire-and-forget triggers —
 * the parent's submit owns the ordered worktree-conversion and
 * mention-resolution awaits, which this component never touches.
 */
export type ComposerActionsLayout = "desktop" | "compact" | "sheet";

/** Arrow-up send glyph for the compact primary control. */
function IconSend() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className="size-4">
      <path d="M8 13V3M3.5 7.5 8 3l4.5 4.5" />
    </svg>
  );
}

export function ComposerActions({
  layout,
  running,
  isSlash,
  canSend,
  onSubmit,
  onAbort,
}: {
  layout: ComposerActionsLayout;
  running: boolean;
  /**
   * A slash draft is a command, not a prompt: every route verb reads "run".
   * The sheet layout ignores this — its labels are fixed (Queue,
   * Interrupt-and-send); callers pass false there.
   */
  isSlash: boolean;
  canSend: boolean;
  onSubmit: (route: PromptRoute | "interrupt") => void;
  onAbort: () => void;
}) {
  const label = (verb: "send" | "steer") => {
    if (isSlash) return "실행";
    return verb === "send" ? "보내기" : "개입";
  };

  if (layout === "sheet") {
    if (!running) return null;
    return (
      <section className="rounded-xl border border-line bg-raised/60 p-3">
        <Label>실행 중 동작</Label>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Button disabled={!canSend} onClick={() => onSubmit("follow_up")} className="min-h-11 justify-center">대기열에 추가</Button>
          <Button disabled={!canSend} onClick={() => onSubmit("interrupt")} className="min-h-11 min-w-0 justify-center px-2">중단 후 보내기</Button>
        </div>
      </section>
    );
  }

  if (layout === "compact") {
    return running ? (
      <>
        <Button tone="copper" variant="solid" disabled={!canSend} onClick={() => onSubmit("steer")} className="h-11 rounded-lg px-4">{label("steer")}</Button>
        <Button tone="rose" variant="outline" onClick={onAbort} className="h-11 rounded-lg px-3">중단</Button>
      </>
    ) : (
      <Button variant="solid" disabled={!canSend} onClick={() => onSubmit("prompt")} className="h-11 gap-1.5 rounded-lg px-4">
        <IconSend />
        {label("send")}
      </Button>
    );
  }

  return running ? (
    <>
      <Button
        size="xs"
        variant="ghost"
        disabled={!canSend}
        title="현재 턴을 중단하고 새 프롬프트로 보내기 (mod+shift+enter)"
        onClick={() => onSubmit("interrupt")}
        className="min-w-0 shrink"
      >
        <span className="min-w-0 truncate">중단 후 보내기</span>
      </Button>
      <Button
        size="xs"
        disabled={!canSend}
        title="현재 턴이 끝난 뒤 실행하도록 대기열에 추가 (mod+enter)"
        onClick={() => onSubmit("follow_up")}
      >
        대기열
      </Button>
      <Button
        size="xs"
        tone="copper"
        disabled={!canSend}
        title="실행 중인 턴에 내용 삽입 (enter)"
        onClick={() => onSubmit("steer")}
      >
        {label("steer")}
      </Button>
      <IconButton
        label="에이전트 중단 (esc)"
        tone="rose"
        onClick={onAbort}
        // The one destructive control here: readable before hover.
        className="text-rose-dim"
      >
        <svg viewBox="0 0 16 16" fill="none" strokeWidth={1.4} className="size-4">
          <rect
            x="4.75"
            y="4.75"
            width="6.5"
            height="6.5"
            rx="1.25"
            fill="currentColor"
            stroke="currentColor"
          />
        </svg>
      </IconButton>
    </>
  ) : (
    <Button
      size="xs"
      variant="solid"
      disabled={!canSend}
      title={isSlash ? "명령 실행 (enter)" : "보내기 (enter) · 줄바꿈은 shift+enter"}
      onClick={() => onSubmit("prompt")}
    >
      {label("send")}
    </Button>
  );
}
