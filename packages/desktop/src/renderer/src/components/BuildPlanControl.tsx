import { cn } from "../lib/cn";
import { useStore } from "../store";
import { ChoiceCapsule } from "./ui";

const BUILD_TITLE = "빌드 모드 — 작업 트리 쓰기와 상태 변경 명령을 허용합니다.";
const PLAN_TITLE =
  "계획 모드 — 읽기 전용으로 조사하며, 요청할 때만 계획을 작성하고 검토합니다.";

export function BuildPlanControl({
  tabId,
  layout = "inline",
  disabled = false,
  onSelected,
  className,
}: {
  tabId: string;
  layout?: "inline" | "sheet";
  disabled?: boolean;
  onSelected?: () => void;
  className?: string;
}) {
  const plan = useStore((s) => s.rpc[tabId]?.plan);
  const setPlanMode = useStore((s) => s.setPlanMode);
  const defaultAgentMode = useStore((s) => s.state?.defaultAgentMode ?? "plan");
  const planEnabled = plan?.enabled ?? false;
  const unavailable = plan?.unavailable;
  const sheet = layout === "sheet";

  const select = (target: boolean) => {
    if (target !== planEnabled) void setPlanMode(tabId, target);
    onSelected?.();
  };

  const modes = [defaultAgentMode, defaultAgentMode === "plan" ? "build" : "plan"] as const;

  return (
    <ChoiceCapsule
      label="세션 모드"
      value={planEnabled ? "plan" : "build"}
      options={modes.map((mode) => {
        const target = mode === "plan";
        const alternate = mode !== defaultAgentMode;
        return {
          value: mode,
          label: mode === "plan" ? "계획" : "빌드",
          disabled: disabled || (target && unavailable !== undefined),
          title: target
            ? unavailable === undefined
              ? PLAN_TITLE
              : `계획 모드를 사용할 수 없습니다: ${unavailable}`
            : BUILD_TITLE,
          className: sheet ? "flex-1 justify-center" : "text-[11px]",
          selectedClassName: alternate ? "bg-iris-wash text-iris" : "bg-hover text-ink",
          unselectedClassName: "text-ink-mid",
        };
      })}
      onChange={(mode) => select(mode === "plan")}
      className={cn(sheet ? "h-11 w-full" : undefined, className)}
    />
  );
}