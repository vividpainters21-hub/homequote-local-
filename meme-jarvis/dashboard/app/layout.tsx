import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";

export const metadata: Metadata = {
  title: "Meme Jarvis",
  description: "Live meme-coin intelligence, smart-wallet tracking, and paper-trading dashboard.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="flex min-h-screen bg-bg text-gray-200">
        <Sidebar />
        <main className="flex-1 p-6 max-w-[1400px]">{children}</main>
      </body>
    </html>
  );
}
