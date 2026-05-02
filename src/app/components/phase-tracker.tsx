"use client";

const PHASES = [
  { id: "intake", label: "Intake", icon: "📋" },
  { id: "requirements", label: "Requirements", icon: "📝" },
  { id: "architecture", label: "Architecture", icon: "🏗" },
  { id: "design", label: "Design", icon: "🎨" },
  { id: "infrastructure", label: "Infrastructure", icon: "☁" },
  { id: "review", label: "Review", icon: "👁" },
  { id: "implementation", label: "Implementation", icon: "⚙" },
  { id: "qa", label: "QA", icon: "✓" },
  { id: "release", label: "Release", icon: "🚀" },
  { id: "monitoring", label: "Monitoring", icon: "📊" },
];

interface PhaseTrackerProps {
  currentPhase: string;
}

export function PhaseTracker({ currentPhase }: PhaseTrackerProps) {
  const currentIdx = PHASES.findIndex((p) => p.id === currentPhase);

  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-2">
      {PHASES.map((phase, idx) => {
        const isActive = phase.id === currentPhase;
        const isComplete = idx < currentIdx;

        return (
          <div key={phase.id} className="flex items-center">
            <div
              className={`
                flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium
                transition-all duration-200 whitespace-nowrap
                ${isActive ? "bg-blue-600 text-white shadow-md" : ""}
                ${isComplete ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" : ""}
                ${!isActive && !isComplete ? "bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500" : ""}
              `}
            >
              <span>{phase.icon}</span>
              <span>{phase.label}</span>
            </div>
            {idx < PHASES.length - 1 && (
              <div
                className={`w-4 h-px mx-0.5 ${
                  idx < currentIdx
                    ? "bg-green-400"
                    : "bg-zinc-200 dark:bg-zinc-700"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
