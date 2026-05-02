"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useProjects } from "../context/projects-context";
import { PhaseTracker } from "./phase-tracker";
import { ChatMessage } from "./chat-message";
import { ApprovalPanel } from "./approval-panel";

interface ProjectViewProps {
  onNewProject: () => void;
}

export function ProjectView({ onNewProject }: ProjectViewProps) {
  const {
    projects,
    activeProjectId,
    streamStates,
    sendMessage,
    approve,
  } = useProjects();

  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const project = projects.find((p) => p.id === activeProjectId) ?? null;
  const stream = activeProjectId ? streamStates[activeProjectId] : null;

  const messages = stream?.messages ?? [];
  const currentPhase = stream?.currentPhase ?? "intake";
  const isStreaming = stream?.isStreaming ?? false;
  const awaitingApproval = stream?.awaitingApproval ?? false;
  const error = stream?.error ?? null;

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!input.trim() || !activeProjectId || isStreaming) return;
      sendMessage(activeProjectId, input.trim());
      setInput("");
    },
    [input, activeProjectId, isStreaming, sendMessage]
  );

  const handleApproval = useCallback(
    (approved: boolean, feedback?: string) => {
      if (!activeProjectId) return;
      approve(activeProjectId, approved, feedback);
    },
    [activeProjectId, approve]
  );

  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-6">
        <div className="text-5xl mb-4">🤖</div>
        <h2 className="text-xl font-semibold mb-2">
          Agentic Development Environment
        </h2>
        <p className="text-zinc-500 max-w-md mb-6">
          AI-native SDLC with 8 specialist agents orchestrated by LangGraph.
          Create a project to begin the pipeline.
        </p>
        <button
          onClick={onNewProject}
          className="px-5 py-2.5 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors"
        >
          Create Your First Project
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="shrink-0 border-b border-zinc-200 dark:border-zinc-800 px-6 py-3">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold tracking-tight">SDLC AI</h1>
          <span className="text-sm text-zinc-500">
            / {project.name}{" "}
            <span className="text-xs text-zinc-400">({project.platform})</span>
          </span>
        </div>
        <div className="mt-3">
          <PhaseTracker currentPhase={currentPhase} />
        </div>
      </header>

      {/* Chat messages */}
      <main className="flex-1 overflow-y-auto px-6 py-4">
        <div className="max-w-3xl mx-auto space-y-4">
          {messages.map((msg) => (
            <ChatMessage key={msg.id} message={msg} />
          ))}

          {isStreaming && (
            <div className="flex items-center gap-2 text-sm text-zinc-400">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:0ms]" />
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:150ms]" />
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:300ms]" />
              </div>
              Agents working...
            </div>
          )}

          {awaitingApproval && <ApprovalPanel onApprove={handleApproval} />}

          {error && (
            <div className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 p-4 text-sm text-red-700 dark:text-red-400">
              {error}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Input bar */}
      <footer className="shrink-0 border-t border-zinc-200 dark:border-zinc-800 px-6 py-4">
        <form onSubmit={handleSend} className="max-w-3xl mx-auto flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              awaitingApproval
                ? "Approve or reject the review above..."
                : "Describe your project or provide feedback..."
            }
            disabled={isStreaming || awaitingApproval}
            className="flex-1 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-4 py-2.5 text-sm disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!input.trim() || isStreaming || awaitingApproval}
            className="px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            Send
          </button>
        </form>
      </footer>
    </div>
  );
}
