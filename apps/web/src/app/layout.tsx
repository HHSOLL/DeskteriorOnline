import type { ReactNode } from "react";
import "../lib/server/runtime-polyfills";
import "../styles/globals.css";
import { SonnerToaster } from "../components/sonner-toaster";
import { LoadingOverlay } from "../components/overlay/LoadingOverlay";

export const metadata = {
  title: "DeskteriorOnline | 룸 빌더 · 3D 뷰어",
  description: "빈 방을 만들고 편집한 뒤 공유 가능한 읽기 전용 3D 뷰어로 발행하는 공간 우선 인테리어 스튜디오.",
  icons: {
    icon: "/favicon.png",
    shortcut: "/favicon.png",
    apple: "/favicon.png",
  },
};

import { Providers } from "../components/providers/Providers";
import { AppViewportShell } from "../components/navigation/AppViewportShell";
import { PremiumNavbar } from "../components/navigation/PremiumNavbar";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <body className="bg-[#fdfdfc] text-[#1a1a1a] font-sans antialiased selection:bg-black/5">
        <LoadingOverlay />
        <SonnerToaster />
        <Providers>
          <PremiumNavbar />
          <AppViewportShell>{children}</AppViewportShell>
        </Providers>
      </body>
    </html>
  );
}
