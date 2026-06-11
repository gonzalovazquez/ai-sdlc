"use client";

import { useEffect, useState } from "react";

type Provider = "ollama" | "anthropic";

const OPTIONS: { value: Provider; label: string }[] = [
  { value: "ollama", label: "Local" },
  { value: "anthropic", label: "Anthropic" },
];

export function ProviderToggle() {
  const [provider, setProvider] = useState<Provider | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/settings/provider")
      .then((res) => res.json())
      .then((data) => setProvider(data.provider))
      .catch(() => setProvider(null));
  }, []);

  const handleSelect = async (next: Provider) => {
    if (provider === null || next === provider || saving) return;
    setSaving(true);
    const previous = provider;
    setProvider(next);
    try {
      const res = await fetch("/api/settings/provider", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: next }),
      });
      if (!res.ok) setProvider(previous);
    } catch {
      setProvider(previous);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="px-3 py-2 border-t border-zinc-200 dark:border-zinc-800">
      <div className="text-[10px] uppercase tracking-wide text-zinc-400 mb-1.5">
        LLM Provider
      </div>
      <div className="flex rounded-lg bg-zinc-200/60 dark:bg-zinc-800 p-0.5">
        {OPTIONS.map((option) => (
          <button
            key={option.value}
            onClick={() => handleSelect(option.value)}
            className={`flex-1 px-2 py-1 text-xs font-medium rounded-md transition-colors ${
              provider === option.value
                ? "bg-white dark:bg-zinc-600 text-zinc-900 dark:text-zinc-100 shadow-sm"
                : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
