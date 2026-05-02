"use client";

import { useState } from "react";

interface ApprovalPanelProps {
  onApprove: (approved: boolean, feedback?: string) => void;
}

export function ApprovalPanel({ onApprove }: ApprovalPanelProps) {
  const [feedback, setFeedback] = useState("");

  return (
    <div className="border border-amber-300 dark:border-amber-700 rounded-xl p-4 bg-amber-50 dark:bg-amber-950/30">
      <h3 className="font-semibold text-amber-800 dark:text-amber-300 mb-2">
        Human Review Required
      </h3>
      <p className="text-sm text-amber-700 dark:text-amber-400 mb-3">
        Review the architecture and design above. Approve to proceed with code
        generation, or provide feedback to revise.
      </p>
      <textarea
        value={feedback}
        onChange={(e) => setFeedback(e.target.value)}
        placeholder="Optional feedback..."
        className="w-full rounded-lg border border-amber-200 dark:border-amber-800 bg-white dark:bg-zinc-900 px-3 py-2 text-sm mb-3 resize-none"
        rows={3}
      />
      <div className="flex gap-2">
        <button
          onClick={() => onApprove(true, feedback || undefined)}
          className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
        >
          Approve & Continue
        </button>
        <button
          onClick={() =>
            onApprove(false, feedback || "Please revise based on my comments.")
          }
          className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
        >
          Request Revision
        </button>
      </div>
    </div>
  );
}
