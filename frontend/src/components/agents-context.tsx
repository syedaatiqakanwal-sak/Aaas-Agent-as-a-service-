import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";

import { apiErrorMessage, getAgents } from "@/lib/api";
import type { Agent } from "@/lib/api";

type AgentsState = {
  agents: Agent[];
  loading: boolean;
  error: string;
  refresh: () => Promise<void>;
};

const AgentsContext = createContext<AgentsState | null>(null);

export function AgentsProvider({ children }: { children: ReactNode }) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      setAgents(await getAgents());
    } catch (caught) {
      setAgents([]);
      setError(apiErrorMessage(caught));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <AgentsContext.Provider value={{ agents, loading, error, refresh }}>
      {children}
    </AgentsContext.Provider>
  );
}

export function useAgents(): AgentsState {
  const value = useContext(AgentsContext);
  if (!value) {
    throw new Error("useAgents must be used inside AgentsProvider");
  }
  return value;
}
