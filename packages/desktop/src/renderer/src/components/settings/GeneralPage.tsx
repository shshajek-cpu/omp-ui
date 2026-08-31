import { useEffect } from "react";
import { cn } from "../../lib/cn";
import {
  SCALE_STEPS,
  setTranscriptScale,
  useTranscriptScale,
} from "../../lib/text-scale";
import { useStore, type CompactionMethodsLoad } from "../../store";
import { ChoiceCapsule, Switch } from "../ui";
import { FIELD, Row } from "./rows";

const DEFAULT_SESSION_MODE_OPTIONS = [
  { value: "rpc-ui", label: "네이티브" },
  { value: "pty", label: "터미널" },
] as const;
const DEFAULT_AGENT_MODE_OPTIONS = [
  { value: "plan", label: "계획" },
  { value: "build", label: "빌드" },
] as const;
const PLAN_FORMAT_OPTIONS = [
  { value: "html", label: "HTML" },
  { value: "md", label: "마크다운" },
] as const;
const STALL_ABORT_OPTIONS = [
  { value: 0, label: "사용 안 함" },
  { value: 120, label: "2분" },
  { value: 180, label: "3분" },
  { value: 300, label: "5분" },
  { value: 600, label: "10분" },
] as const;
const HIBERNATE_IDLE_OPTIONS = [
  { value: 0, label: "사용 안 함" },
  { value: 15, label: "15분" },
  { value: 30, label: "30분" },
  { value: 60, label: "1시간" },
  { value: 240, label: "4시간" },
] as const;

/**
 * Display metadata for compaction methods, keyed by the method id omp
 * publishes in `compaction.methodOrder`. Labels and descriptions are
 * verbatim from the `compaction.methodOrder` schema options embedded in
 * the omp 18.0.3 binary - re-verify this table when the omp binary is
 * upgraded. Unknown ids fall back to the raw id with no description;
 * never invent text for a method omp does not document.
 */
const COMPACTION_METHOD_META: Record<string, { label: string; description: string }> = {
  remote: {
    label: "OpenAI 서버 압축",
    description:
      "현재 경로가 지원할 때 공급자 고유의 OpenAI 호환 서버 압축을 사용합니다.",
  },
  snapcompact: {
    label: "Snapcompact",
    description:
      "기록을 현재 비전 모델이 다시 읽는 고밀도 비트맵 이미지로 보관합니다. LLM 호출은 없습니다.",
  },
  handoff: {
    label: "인계",
    description: "인계 문서를 만들고 이를 압축 요약으로 사용해 계속 진행합니다.",
  },
  soft: {
    label: "소프트 압축",
    description: "서버 압축 없이 압축 모델로 현재 기록을 요약합니다.",
  },
  shake: {
    label: "Shake",
    description: "LLM 호출 없이 복구 가능한 무거운 내용을 현재 기록에서 제거합니다.",
  },
};

/** Verbatim from the installed omp's `compaction.methodOrder` setting description. */
const COMPACTION_DEFAULT_DESCRIPTION =
  "자동 컨텍스트 관리를 위한 기본 대체 순서입니다. 사용할 수 없거나 실패한 방식은 다음 방식으로 넘어갑니다.";

/**
 * One visible row per compaction method, so every method's description is
 * readable without opening a dropdown. Follows the ChoiceCapsule a11y
 * pattern: a labelled group of aria-pressed buttons.
 */
function CompactionMethodPicker({
  value,
  load,
  onSelect,
}: {
  value: string | null;
  load: CompactionMethodsLoad;
  onSelect: (method: string | null) => void;
}) {
  type Option = {
    id: string | null;
    label: string;
    description?: string;
    disabled?: boolean;
  };
  const options: Option[] = [
    { id: null, label: "omp 설정 기본값", description: COMPACTION_DEFAULT_DESCRIPTION },
  ];
  if (load.status === "loaded") {
    // A persisted method the installed omp no longer publishes: show it,
    // pressed but inert, exactly as the previous select did.
    if (value !== null && !load.methods.includes(value)) {
      const meta = COMPACTION_METHOD_META[value];
      options.push({
        id: value,
        label: `${meta?.label ?? value} (사용할 수 없음)`,
        description: meta?.description,
        disabled: true,
      });
    }
    for (const method of load.methods) {
      const meta = COMPACTION_METHOD_META[method];
      options.push({
        id: method,
        label: meta?.label ?? method,
        description: meta?.description,
      });
    }
  }
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div
        role="group"
        aria-label="기본 압축 방식"
        className="divide-y divide-line-soft rounded-md border border-line bg-raised"
      >
        {options.map((option) => {
          const selected = option.id === value;
          return (
            <button
              key={option.id ?? "default"}
              type="button"
              aria-pressed={selected}
              disabled={option.disabled}
              onClick={() => {
                if (option.id !== value) onSelect(option.id);
              }}
              className={cn(
                "flex w-full items-start gap-2 px-2.5 py-1.5 text-left transition-colors duration-150",
                option.disabled
                  ? "cursor-not-allowed opacity-45"
                  : selected
                    ? "bg-hover text-ink"
                    : "text-ink-mid hover:bg-hover/50 focus-visible:bg-hover/50 focus-visible:outline-none",
              )}
            >
              <span className={cn("w-40 shrink-0 text-xs", selected && "font-medium")}>
                {option.label}
              </span>
              {option.description !== undefined && (
                <span className="min-w-0 flex-1 text-[11px] leading-snug text-ink-faint">
                  {option.description}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {load.status === "failed" && (
        <p className="text-[10px] text-ink-faint">
          방식을 불러올 수 없습니다: {load.message}
        </p>
      )}
    </div>
  );
}

export function GeneralPage() {
  const state = useStore((s) => s.state);
  const setDefaultMode = useStore((s) => s.setDefaultMode);
  const setDefaultAgentMode = useStore((s) => s.setDefaultAgentMode);
  const setPlanFormat = useStore((s) => s.setPlanFormat);
  const compactionMethods = useStore((s) => s.compactionMethods);
  const ensureCompactionMethods = useStore((s) => s.ensureCompactionMethods);
  const setDefaultCompactionMethod = useStore((s) => s.setDefaultCompactionMethod);
  const setHibernateIdleMinutes = useStore((s) => s.setHibernateIdleMinutes);
  const setStreamStallAbortSeconds = useStore(
    (s) => s.setStreamStallAbortSeconds,
  );
  const setSkipDeleteConfirmation = useStore(
    (s) => s.setSkipDeleteConfirmation,
  );
  const setAdvisorAutoReply = useStore((s) => s.setAdvisorAutoReply);
  const setStallAutoContinue = useStore((s) => s.setStallAutoContinue);
  const setDesktopNotifications = useStore((s) => s.setDesktopNotifications);
  const setDefaultAdvisor = useStore((s) => s.setDefaultAdvisor);
  const scale = useTranscriptScale();
  const mode = state?.defaultMode ?? "pty";
  const agentMode = state?.defaultAgentMode ?? "plan";
  const planFormat = state?.planFormat ?? "html";
  const defaultCompactionMethod = state?.defaultCompactionMethod ?? null;
  useEffect(() => {
    void ensureCompactionMethods();
  }, [ensureCompactionMethods]);

  return (
    <div className="divide-y divide-line-soft px-4">
      <Row
        title="기본 세션 모드"
        hint="새 세션을 내장 터미널 또는 네이티브 기록 중 어떤 화면으로 열지 선택합니다."
      >
        <ChoiceCapsule
          label="기본 세션 모드"
          value={mode}
          options={DEFAULT_SESSION_MODE_OPTIONS}
          onChange={(value) => void setDefaultMode(value)}
          optionClassName="px-2 text-[11px]"
        />
      </Row>
      <Row
        title="기본 에이전트 모드"
        hint="새 네이티브 세션을 읽기 전용 계획 모드 또는 쓰기 가능한 빌드 모드로 시작합니다."
      >
        <ChoiceCapsule
          label="기본 에이전트 모드"
          value={agentMode}
          options={DEFAULT_AGENT_MODE_OPTIONS}
          onChange={(value) => void setDefaultAgentMode(value)}
          optionClassName="px-2 text-[11px]"
        />
      </Row>
      <Row
        title="기본 압축 방식"
        hint="새 네이티브 세션에 저장됩니다. omp 설정 기본값을 고르면 별도 지정을 제거합니다."
        stacked
      >
        <CompactionMethodPicker
          value={defaultCompactionMethod}
          load={compactionMethods}
          onSelect={(method) => void setDefaultCompactionMethod(method)}
        />
      </Row>
      <Row
        title="계획 형식"
        hint="검토할 계획을 자체 포함 HTML 문서 또는 마크다운 중 어떤 형식으로 작성할지 선택합니다."
      >
        <ChoiceCapsule
          label="계획 형식"
          value={planFormat}
          options={PLAN_FORMAT_OPTIONS}
          onChange={(value) => void setPlanFormat(value)}
          optionClassName="px-2 text-[11px]"
        />
      </Row>
      <Row
        title="유휴 세션 최대 절전"
        hint="네이티브 세션이 이 시간 동안 조용하면 에이전트 프로세스를 종료합니다. 보고 있는 탭, 각 프로젝트의 최근 세션, 터미널 탭은 종료하지 않습니다. 기록은 디스크에 남고 다시 열면 이어집니다."
      >
        <ChoiceCapsule
          label="유휴 세션 최대 절전"
          value={state?.hibernateIdleMinutes ?? 30}
          options={HIBERNATE_IDLE_OPTIONS}
          onChange={(value) => void setHibernateIdleMinutes(value)}
          optionClassName="px-2 text-[11px]"
        />
      </Row>
      <Row
        title="스트림 멈춤 감시"
        hint="모델 응답 스트림이 이 시간 동안 멈추면 실행 중인 턴을 중단합니다. 로컬 도구가 실행되는 동안에는 시간을 세지 않으며, 도구 완료·압축·재시도·사용자 응답 때마다 시간을 다시 셉니다."
      >
        <ChoiceCapsule
          label="스트림 멈춤 감시"
          value={state?.streamStallAbortSeconds ?? 180}
          options={STALL_ABORT_OPTIONS}
          onChange={(value) => void setStreamStallAbortSeconds(value)}
          optionClassName="px-2 text-[11px]"
        />
      </Row>
      <Row
        title="멈춤 자동 계속"
        hint="모델 스트림 멈춤으로 턴이 중단되면 제한된 계속 프롬프트를 보내 세션을 재개합니다. 연속 최대 2회이며 터미널 탭에는 적용되지 않습니다."
      >
        <Switch
          on={state?.stallAutoContinue ?? true}
          onChange={(next) => void setStallAutoContinue(next)}
          label="멈춤 자동 계속"
        />
      </Row>
      <Row
        title="데스크톱 알림"
        hint="백그라운드 네이티브 세션의 턴이 끝나거나 계획 검토에 응답이 필요할 때 운영체제 알림을 표시합니다."
      >
        <Switch
          on={state?.desktopNotifications ?? true}
          onChange={(next) => void setDesktopNotifications(next)}
          label="데스크톱 알림"
        />
      </Row>
      <Row
        title="어드바이저 자동 응답"
        hint="턴이 끝난 뒤 도착한 어드바이저 의견에 자동으로 답합니다. 끄면 의견만 기록에 남습니다."
      >
        <Switch
          on={state?.advisorAutoReply ?? true}
          onChange={(next) => void setAdvisorAutoReply(next)}
          label="어드바이저 자동 응답"
        />
      </Row>
      <Row
        title="기본 어드바이저"
        hint="새 세션을 어드바이저와 함께 시작합니다. 프로젝트에 저장된 최근 설정이 있으면 그 설정을 우선합니다."
      >
        <Switch
          on={state?.defaultAdvisor === true}
          onChange={(next) => void setDefaultAdvisor(next)}
          label="기본 어드바이저"
        />
      </Row>
      <Row
        title="삭제 확인 생략"
        hint="세션 삭제는 전체 계보 폴더를 지웁니다. 이 옵션을 켜면 경고 없이 삭제합니다."
      >
        <Switch
          on={state?.skipDeleteConfirmation === true}
          onChange={(next) => void setSkipDeleteConfirmation(next)}
          label="삭제 확인 생략"
        />
      </Row>
      <Row
        title="기록 글자 크기"
        hint="네이티브 기록에만 적용합니다."
      >
        <select
          aria-label="기록 글자 크기"
          value={String(scale)}
          onChange={(e) => setTranscriptScale(Number(e.target.value))}
          className={FIELD}
        >
          {SCALE_STEPS.map((step) => (
            <option key={step} value={String(step)}>
              {Math.round(step * 100)}%
            </option>
          ))}
        </select>
      </Row>
    </div>
  );
}

export function GeneralFooter() {
  return (
    <p>
      기본 세션·에이전트 모드는 새 세션부터 적용되며, 나머지 설정은 즉시 적용됩니다.
    </p>
  );
}
