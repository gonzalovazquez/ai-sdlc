"use client";

import { useEffect, useState } from "react";

interface SettingToggleProps {
  label: string;
  /** Settings endpoint exposing GET/PUT, e.g. "/api/settings/provider". */
  endpoint: string;
  /** JSON field holding the value in requests and responses. */
  field: string;
  options: { value: string; label: string }[];
}

export function SettingToggle({ label, endpoint, field, options }: SettingToggleProps) {
  const [value, setValue] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(endpoint)
      .then((res) => res.json())
      .then((data) => setValue(data[field]))
      .catch(() => setValue(null));
  }, [endpoint, field]);

  const handleSelect = async (next: string) => {
    if (value === null || next === value || saving) return;
    setSaving(true);
    const previous = value;
    setValue(next);
    try {
      const res = await fetch(endpoint, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: next }),
      });
      if (!res.ok) setValue(previous);
    } catch {
      setValue(previous);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-zinc-400 mb-1.5">
        {label}
      </div>
      <div className="flex rounded-lg bg-zinc-200/60 dark:bg-zinc-800 p-0.5">
        {options.map((option) => (
          <button
            key={option.value}
            onClick={() => handleSelect(option.value)}
            className={`flex-1 px-2 py-1 text-xs font-medium rounded-md transition-colors ${
              value === option.value
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
