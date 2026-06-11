import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ProjectsProvider } from "./context/projects-context";
import { FlowModeProvider } from "./context/flow-mode-context";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SDLC AI — Agentic Development Environment",
  description: "AI-native software development lifecycle with LangGraph orchestration",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <FlowModeProvider>
          <ProjectsProvider>{children}</ProjectsProvider>
        </FlowModeProvider>
      </body>
    </html>
  );
}
