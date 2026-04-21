export type RealtimeLabsConfig = {
  enabled: boolean;
  localOnly: boolean;
  path: string;
  reason: string;
  requiredEnv: string[];
};

const REALTIME_LABS_PATH = "/labs/realtime";
const REQUIRED_ENV = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"] as const;

function hasRequiredEnv() {
  return REQUIRED_ENV.every((key) => {
    const value = process.env[key];
    return typeof value === "string" && value.length > 0;
  });
}

export function getRealtimeLabsConfig(): RealtimeLabsConfig {
  const requested = process.env.NEXT_PUBLIC_ENABLE_REALTIME_LABS === "1";
  const localOnly = process.env.NODE_ENV !== "production";
  const envReady = hasRequiredEnv();

  if (!requested) {
    return {
      enabled: false,
      localOnly,
      path: REALTIME_LABS_PATH,
      reason: "NEXT_PUBLIC_ENABLE_REALTIME_LABS=1 이 설정되지 않아 비활성 상태입니다.",
      requiredEnv: [...REQUIRED_ENV]
    };
  }

  if (!localOnly) {
    return {
      enabled: false,
      localOnly,
      path: REALTIME_LABS_PATH,
      reason: "realtime/presence 실험은 production primary flow에서 허용되지 않습니다.",
      requiredEnv: [...REQUIRED_ENV]
    };
  }

  if (!envReady) {
    return {
      enabled: false,
      localOnly,
      path: REALTIME_LABS_PATH,
      reason: "Supabase public env가 없어 local-only lab 세션을 열 수 없습니다.",
      requiredEnv: [...REQUIRED_ENV]
    };
  }

  return {
    enabled: true,
    localOnly,
    path: REALTIME_LABS_PATH,
    reason: "local-only realtime lab이 활성화되었습니다.",
    requiredEnv: [...REQUIRED_ENV]
  };
}
