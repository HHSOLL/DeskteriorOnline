import { Suspense } from "react";
import { Activity, FlaskConical, RadioTower, ShieldAlert } from "lucide-react";
import { getRealtimeLabsConfig } from "../../../lib/experiments/realtime-labs";
import { RealtimeLabClient } from "../../../components/labs/RealtimeLabClient";

const LAB_CHECKLIST = [
  "primary editor/shared/gallery/community에는 진입 링크를 두지 않는다.",
  "presence cursor, room occupancy, broadcast state는 local-only evaluation에서만 다룬다.",
  "sceneDocument 저장 계약과 publish/share read-only 흐름을 실험 중에도 변경하지 않는다.",
  "production에서는 env를 켜더라도 이 lab을 활성화하지 않는다."
] as const;

export default function RealtimeLabsPage() {
  const config = getRealtimeLabsConfig();

  return (
    <div className="min-h-screen bg-[#f6f5f1] px-4 pb-20 pt-12 text-[#171411] sm:px-6 lg:px-10">
      <div className="mx-auto max-w-5xl">
        <header className="rounded-[28px] border border-black/10 bg-white/82 p-7 shadow-[0_18px_46px_rgba(68,52,34,0.07)]">
          <div className="flex items-center gap-3 text-[10px] font-semibold tracking-[0.24em] text-[#8a8177]">
            <FlaskConical className="h-4 w-4" />
            <span>LABS / REALTIME</span>
          </div>
          <h1 className="mt-3 text-[32px] font-semibold tracking-tight text-[#171411] sm:text-[40px]">
            presence / realtime 실험 전용 분리 영역
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-[#625a51]">
            이 페이지는 primary product flow와 분리된 local-only 실험 게이트다. 메인 에디터, shared viewer,
            gallery, community에는 연결되지 않으며 운영 경로를 바꾸지 않는다.
          </p>
          <div
            className={`mt-6 inline-flex rounded-full px-4 py-2 text-[10px] font-bold uppercase tracking-[0.16em] ${
              config.enabled
                ? "border border-emerald-500/25 bg-emerald-50 text-emerald-800"
                : "border border-amber-500/25 bg-amber-50 text-[#7a4d17]"
            }`}
          >
            {config.enabled ? "local-only lab enabled" : "lab disabled"}
          </div>
          <p className="mt-3 text-sm leading-6 text-[#625a51]">{config.reason}</p>
        </header>

        <section className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_320px]">
          <div className="rounded-[24px] border border-black/10 bg-white/78 p-6 shadow-[0_18px_46px_rgba(68,52,34,0.07)]">
            <div className="flex items-center gap-2 text-[10px] font-semibold tracking-[0.22em] text-[#8a8177]">
              <RadioTower className="h-4 w-4" />
              <span>실험 가드레일</span>
            </div>
            <div className="mt-5 space-y-3">
              {LAB_CHECKLIST.map((item) => (
                <div key={item} className="rounded-[18px] border border-black/8 bg-[#faf7f1] p-4 text-sm leading-6 text-[#52483f]">
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-5">
            <div className="rounded-[24px] border border-black/10 bg-[#191512] p-5 text-[#f9f4ec] shadow-[0_18px_46px_rgba(0,0,0,0.18)]">
              <div className="flex items-center gap-2 text-[10px] font-semibold tracking-[0.2em] text-[#ccb59b]">
                <ShieldAlert className="h-4 w-4" />
                <span>운영 제한</span>
              </div>
              <p className="mt-4 text-sm leading-6 text-[#e1d7cd]">
                production에서는 `NEXT_PUBLIC_ENABLE_REALTIME_LABS=1`이 있어도 이 실험을 켜지 않는다. 목적은
                운영 기능 추가가 아니라 분리 평가다.
              </p>
            </div>

            <div className="rounded-[24px] border border-black/10 bg-white/82 p-5 shadow-[0_18px_46px_rgba(68,52,34,0.07)]">
              <div className="flex items-center gap-2 text-[10px] font-semibold tracking-[0.2em] text-[#8a8177]">
                <Activity className="h-4 w-4" />
                <span>필수 env</span>
              </div>
              <ul className="mt-4 space-y-2 text-sm leading-6 text-[#52483f]">
                {config.requiredEnv.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <Suspense fallback={null}>
          <RealtimeLabClient config={config} />
        </Suspense>
      </div>
    </div>
  );
}
