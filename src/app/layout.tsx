import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { ToastContainer } from "@/components/ui/Toast";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "跳不跳",
  description: "跳不跳 — AI 驱动的职业决策平台",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}
      >
        <NotificationProvider>{children}</NotificationProvider>
        <ToastContainer />
      </body>
    </html>
  );
}
