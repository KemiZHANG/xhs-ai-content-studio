import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "XHS AI Content Studio",
  description: "Local Xiaohongshu AI workflow console"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <head>
        <meta charSet="utf-8" />
      </head>
      <body>{children}</body>
    </html>
  );
}
