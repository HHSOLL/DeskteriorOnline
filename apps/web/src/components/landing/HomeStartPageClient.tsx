"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthPopup } from "../overlay/AuthPopup";
import { useAuthStore } from "../../lib/stores/useAuthStore";

type StartCardProps = {
  badge: string;
  imageSrc: string;
  title: string;
  buttonLabel: string;
  onClick: () => void;
};

function StartCard({ badge, imageSrc, title, buttonLabel, onClick }: StartCardProps) {
  return (
    <article className="overflow-hidden rounded-[28px] border border-[#ece8e2] bg-white shadow-[0_20px_50px_rgba(35,24,14,0.06)]">
      <div className="relative aspect-[1.45/0.8] bg-[#d9d9d7]">
        <Image src={imageSrc} alt={title} fill priority sizes="(max-width: 1024px) 100vw, 50vw" className="object-cover" />
        <div className="absolute left-5 top-5 rounded-[9px] border border-[#a6a29b] bg-white px-5 py-2.5 text-sm font-semibold text-[#3e3e3e] sm:left-6 sm:top-6">
          {badge}
        </div>
      </div>
      <div className="space-y-6 px-6 py-7 sm:px-7 sm:py-8">
        <h2 className="max-w-[560px] text-[28px] font-semibold leading-[1.2] tracking-[-0.05em] text-[#1d1d1d] sm:text-[32px]">
          {title}
        </h2>
        <button
          type="button"
          onClick={onClick}
          className="rounded-full border border-[#262626] px-8 py-3.5 text-base font-semibold tracking-[-0.02em] text-[#1f1f1f] transition hover:bg-[#111111] hover:text-white"
        >
          {buttonLabel}
        </button>
      </div>
    </article>
  );
}

export function HomeStartPageClient() {
  const router = useRouter();
  const { session } = useAuthStore();
  const isAuthenticated = Boolean(session?.user);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authNextPath, setAuthNextPath] = useState<string | undefined>(undefined);

  const requireAuth = (nextPath: string) => {
    if (isAuthenticated) {
      router.push(nextPath);
      return;
    }
    setAuthNextPath(nextPath);
    setIsAuthOpen(true);
  };

  return (
    <>
      <div className="min-h-screen bg-white px-5 pb-24 pt-28 text-[#181818] sm:px-8 sm:pt-32 lg:px-12">
        <div className="mx-auto max-w-[1820px]">
          <h1 className="text-[44px] font-semibold tracking-[-0.06em] text-[#181818] sm:text-[56px]">시작하는 방법</h1>

          <section className="mt-10 grid gap-6 lg:grid-cols-2">
            <StartCard
              badge="퀵 스타트"
              imageSrc="/home/img7.jpg"
              title="비어 있거나 가구가 있는 공간에서 아이디어를 테스트해보세요"
              buttonLabel="공간 선택"
              onClick={() => requireAuth("/studio/select?mode=empty")}
            />
            <StartCard
              badge="맞춤형"
              imageSrc="/home/img3.jpg"
              title="집안 레이아웃에 맞는 공간 만들기"
              buttonLabel="공간 만들기"
              onClick={() => requireAuth("/studio/builder?intent=custom")}
            />
          </section>
        </div>
      </div>

      <AuthPopup isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} nextPath={authNextPath} />
    </>
  );
}
