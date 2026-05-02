"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { AgentMessage } from "../hooks/use-agent-stream";

const NODE_LABELS: Record<string, { label: string; color: string }> = {
  user: { label: "You", color: "bg-blue-600" },
  pm_agent: { label: "PM Agent", color: "bg-purple-600" },
  architect_agent: { label: "Architect", color: "bg-orange-600" },
  design_agent: { label: "Design", color: "bg-pink-600" },
  infra_agent: { label: "Infra", color: "bg-teal-600" },
  code_agent: { label: "Code", color: "bg-green-600" },
  qa_agent: { label: "QA", color: "bg-yellow-600" },
  release_agent: { label: "Release", color: "bg-indigo-600" },
  monitor_agent: { label: "Monitor", color: "bg-red-600" },
  human_review: { label: "Review Gate", color: "bg-amber-600" },
};

interface ChatMessageProps {
  message: AgentMessage;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const nodeInfo = NODE_LABELS[message.node] || {
    label: message.node,
    color: "bg-zinc-600",
  };
  const isUser = message.node === "user";

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      <div
        className={`
          shrink-0 w-8 h-8 rounded-full flex items-center justify-center
          text-white text-xs font-bold ${nodeInfo.color}
        `}
      >
        {nodeInfo.label[0]}
      </div>
      <div
        className={`
          max-w-[80%] rounded-2xl px-4 py-3
          ${
            isUser
              ? "bg-blue-600 text-white"
              : "bg-zinc-100 dark:bg-zinc-800 text-foreground"
          }
        `}
      >
        {!isUser && (
          <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1">
            {nodeInfo.label}
          </div>
        )}
        {isUser ? (
          <div className="text-sm whitespace-pre-wrap break-words leading-relaxed">
            {message.content}
          </div>
        ) : (
          <div className="prose prose-sm dark:prose-invert max-w-none break-words">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                a: ({ children, href, ...props }) => (
                  <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
                    {children}
                  </a>
                ),
              }}
            >
              {message.content}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}
