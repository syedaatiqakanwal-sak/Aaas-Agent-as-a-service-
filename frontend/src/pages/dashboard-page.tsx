import { Link } from "react-router-dom";

import { useAgents } from "@/components/agents-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function DashboardPage() {
  const { agents, loading, error } = useAgents();

  return (
    <div className="h-full overflow-y-auto px-4 py-6 md:px-8">
      <div className="mx-auto max-w-5xl">
        <h1 className="text-2xl font-semibold tracking-tight">Agents</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose an agent to chat, or create one from the sidebar.
        </p>
        {loading ? <p className="mt-8 text-sm text-muted-foreground">Loading agents...</p> : null}
        {error ? <p className="mt-8 text-sm text-destructive">{error}</p> : null}
        {!loading && !error && agents.length === 0 ? (
          <p className="mt-8 text-sm text-muted-foreground">No active agents yet.</p>
        ) : null}
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {agents.map((agent) => (
            <Link key={agent.id} to={`/agents/${agent.slug}`} className="block">
              <Card className="h-full transition-colors hover:bg-muted/40">
                <CardHeader>
                  <CardTitle>{agent.name}</CardTitle>
                  <CardDescription>{agent.model}</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="line-clamp-3 text-sm text-muted-foreground">{agent.system_prompt}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
