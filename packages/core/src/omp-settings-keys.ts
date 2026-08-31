// The omp settings allowlist. Pure — zero imports — because the renderer
// imports it directly via the @omp-ui/core/omp-settings-keys subpath, exactly
// like plan.ts and advisor-stats.ts. The reading and writing half lives in
// omp-settings.ts (node:child_process, main process only) and consumes these
// same constants, so the page's grouping and the write allowlist can never
// drift.

export interface OmpSettingGroup {
  title: string;
  description?: string;
  keys: readonly string[];
}

/** Memory settings live on their own settings page but share the core allowlist. */
export const MEMORY_SETTING_GROUP: OmpSettingGroup = {
  title: "메모리",
  description:
    "Mnemopi는 세션에 지속형 메모리를 제공합니다. per-project-tagged는 프로젝트별로 기록하고 " +
    "프로젝트와 전역 내용을 함께 불러옵니다. 백엔드 변경은 이후 시작한 세션부터 적용됩니다.",
  keys: [
    "memory.backend",
    "mnemopi.scoping",
    "mnemopi.autoRecall",
    "mnemopi.autoRetain",
    "mnemopi.noEmbeddings",
    "autolearn.enabled",
  ],
};

/** The omp settings the settings surface exposes, grouped for the omp page. */
export const OMP_SETTING_GROUPS: ReadonlyArray<OmpSettingGroup> = [
  {
    title: "어드바이저",
    keys: [
      "advisor.enabled",
      "advisor.subagents",
      "advisor.syncBacklog",
      "advisor.immuneTurns",
    ],
  },
  {
    title: "컨텍스트",
    keys: [
      "compaction.enabled",
      "compaction.idleEnabled",
      "autoResume",
      "compaction.thresholdPercent",
      "compaction.thresholdTokens",
      "compaction.reserveTokens",
    ],
  },
  {
    title: "제공자",
    description:
      "OpenRouter의 nitro 변형은 처리량을 우선합니다. 감시 시간을 늘리면 긴 무응답 추론을 허용하지만 멈춘 스트림의 복구가 늦어지며, 0은 감시를 끕니다.",
    keys: [
      "providers.openrouterVariant",
      "providers.streamFirstEventTimeoutSeconds",
      "providers.streamIdleTimeoutSeconds",
    ],
  },
  {
    title: "표시",
    keys: [
      "display.showTokenUsage",
      "hideThinkingBlock",
      "git.enabled",
      "colorBlindMode",
    ],
  },
];
export const OMP_SETTING_KEYS: readonly string[] = [
  ...OMP_SETTING_GROUPS.flatMap((group) => group.keys),
  ...MEMORY_SETTING_GROUP.keys,
];
/** modelRoles is a record edited per-role, so it is handled apart from the scalar list. */
export const OMP_MODEL_ROLES_KEY = "modelRoles";
/** omp's built-in roles, in omp's own order (v17.2.7 config/model-roles.ts MODEL_ROLE_IDS). */
export const OMP_MODEL_ROLE_IDS = [
  "default",
  "smol",
  "slow",
  "vision",
  "plan",
  "designer",
  "commit",
  "tiny",
  "task",
  "advisor",
] as const;
