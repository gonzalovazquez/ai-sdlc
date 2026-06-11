"use client";

import { createContext, useContext, useEffect, useState } from "react";

export type FlowMode = "simplified" | "full";

interface FlowModeContextValue {
  flow: FlowMode;
  setFlow: (flow: FlowMode) => void;
}

const FlowModeContext = createContext<FlowModeContextValue>({
  flow: "simplified",
  setFlow: () => {},
});

export function FlowModeProvider({ children }: { children: React.ReactNode }) {
  const [flow, setFlow] = useState<FlowMode>("simplified");

  useEffect(() => {
    fetch("/api/settings/flow")
      .then((res) => res.json())
      .then((data) => {
        if (data.flow === "simplified" || data.flow === "full") {
          setFlow(data.flow);
        }
      })
      .catch(() => {});
  }, []);

  return (
    <FlowModeContext.Provider value={{ flow, setFlow }}>
      {children}
    </FlowModeContext.Provider>
  );
}

export function useFlowMode() {
  return useContext(FlowModeContext);
}
