"use client";

import { useCallback, useEffect, useState } from "react";

interface EnvKeyStatus {
  key: string;
  label: string;
  hint: string;
  source: "runtime" | "env" | null;
  preview: string | null;
  custom: boolean;
}

interface EnvKeysDialogProps {
  open: boolean;
  onClose: () => void;
}

function SourceBadge({ source }: { source: EnvKeyStatus["source"] }) {
  if (source === "runtime") {
    return (
      <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400">
        runtime
      </span>
    );
  }
  if (source === "env") {
    return (
      <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400">
        .env
      </span>
    );
  }
  return (
    <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
      not set
    </span>
  );
}

function KeyRow({
  status,
  onSave,
  onClear,
}: {
  status: EnvKeyStatus;
  onSave: (key: string, value: string) => Promise<boolean>;
  onClear: (key: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  const handleSave = async () => {
    if (!draft.trim() || busy) return;
    setBusy(true);
    const ok = await onSave(status.key, draft);
    if (ok) setDraft("");
    setBusy(false);
  };

  return (
    <div className="py-2.5 border-b border-zinc-100 dark:border-zinc-800 last:border-b-0">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-sm font-medium">{status.label}</span>
        <SourceBadge source={status.source} />
        {status.preview && (
          <span className="text-xs font-mono text-zinc-400">
            {status.preview}
          </span>
        )}
      </div>
      <div className="text-xs text-zinc-400 mb-1.5 font-mono">
        {status.key}
        {!status.custom && (
          <span className="font-sans"> — {status.hint}</span>
        )}
      </div>
      <div className="flex gap-2">
        <input
          type="password"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleSave();
            }
          }}
          placeholder={status.source ? "Replace value..." : "Enter value..."}
          autoComplete="off"
          className="flex-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-1.5 text-sm"
        />
        <button
          type="button"
          onClick={handleSave}
          disabled={!draft.trim() || busy}
          className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          Save
        </button>
        {status.source === "runtime" && (
          <button
            type="button"
            onClick={() => onClear(status.key)}
            disabled={busy}
            className="px-3 py-1.5 rounded-lg text-xs text-zinc-500 hover:text-red-600 dark:hover:text-red-400 transition-colors"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
}

export function EnvKeysDialog({ open, onClose }: EnvKeysDialogProps) {
  const [keys, setKeys] = useState<EnvKeyStatus[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [customKey, setCustomKey] = useState("");
  const [customValue, setCustomValue] = useState("");

  useEffect(() => {
    if (!open) return;
    fetch("/api/settings/env")
      .then((res) => res.json())
      .then((data) => setKeys(data.keys ?? []))
      .catch(() => setError("Failed to load environment keys"));
  }, [open]);

  const handleSave = useCallback(
    async (key: string, value: string): Promise<boolean> => {
      setError(null);
      try {
        const res = await fetch("/api/settings/env", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key, value }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "Failed to save key");
          return false;
        }
        setKeys(data.keys ?? []);
        return true;
      } catch {
        setError("Failed to save key");
        return false;
      }
    },
    []
  );

  const handleClear = useCallback(async (key: string) => {
    setError(null);
    try {
      const res = await fetch("/api/settings/env", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
      });
      const data = await res.json();
      if (res.ok) setKeys(data.keys ?? []);
      else setError(data.error ?? "Failed to clear key");
    } catch {
      setError("Failed to clear key");
    }
  }, []);

  const handleAddCustom = async () => {
    const key = customKey.trim().toUpperCase();
    if (!key || !customValue.trim()) return;
    if (await handleSave(key, customValue)) {
      setCustomKey("");
      setCustomValue("");
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl w-full max-w-lg p-6 max-h-[85vh] flex flex-col">
        <h2 className="text-lg font-semibold mb-1">Environment Keys</h2>
        <p className="text-xs text-zinc-400 mb-3">
          Bring your own tokens. Keys are held in server memory only — they
          are never written to disk and reset when the server restarts.
        </p>

        {error && (
          <div className="mb-3 rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 px-3 py-2 text-xs text-red-700 dark:text-red-400">
            {error}
          </div>
        )}

        <div className="flex-1 overflow-y-auto -mx-1 px-1">
          {keys.map((status) => (
            <KeyRow
              key={status.key}
              status={status}
              onSave={handleSave}
              onClear={handleClear}
            />
          ))}

          <div className="py-2.5">
            <div className="text-sm font-medium mb-1.5">Add custom key</div>
            <div className="flex gap-2">
              <input
                type="text"
                value={customKey}
                onChange={(e) => setCustomKey(e.target.value)}
                placeholder="MY_API_KEY"
                autoComplete="off"
                className="w-40 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-1.5 text-sm font-mono"
              />
              <input
                type="password"
                value={customValue}
                onChange={(e) => setCustomValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddCustom();
                  }
                }}
                placeholder="Value..."
                autoComplete="off"
                className="flex-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-1.5 text-sm"
              />
              <button
                type="button"
                onClick={handleAddCustom}
                disabled={!customKey.trim() || !customValue.trim()}
                className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                Add
              </button>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
