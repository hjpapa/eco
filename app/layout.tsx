import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://eco-game2026.vercel.app"),
  title: "드래곤마운틴 시티 — 초등학생 회사 경영 & 경제 게임",
  description:
    "초등학생을 위한 회사 경영·경제 교육 게임. 회사를 키우고 다양한 자산에 투자하며 순자산 1위에 도전하세요. 제작: hjpapa",
  applicationName: "드래곤마운틴 시티",
  authors: [{ name: "hjpapa" }],
  creator: "hjpapa",
  publisher: "hjpapa",
  openGraph: {
    type: "website",
    locale: "ko_KR",
    siteName: "드래곤마운틴 시티",
    title: "드래곤마운틴 시티 — 초등학생 회사 경영 & 경제 게임",
    description: "회사를 키우며 경제를 배우는 초등학생용 경영 게임. 제작: hjpapa",
    images: [
      {
        url: "/assets/splash-dragon.png",
        width: 1672,
        height: 941,
        alt: "드래곤마운틴 시티",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "드래곤마운틴 시티 — 초등학생 회사 경영 & 경제 게임",
    description: "회사를 키우며 경제를 배우는 초등학생용 경영 게임. 제작: hjpapa",
    images: [{ url: "/assets/splash-dragon.png", alt: "드래곤마운틴 시티" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
