import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CreatorAI Studio — AI Image, Video & 3D Generation",
  description: "Generate images, videos, 3D textures, train custom models — all in one AI creative suite.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
