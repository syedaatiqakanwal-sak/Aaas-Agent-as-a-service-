import { Menu, Plus, Sparkles } from "lucide-react";
import { useState } from "react";
import type { ReactNode } from "react";
import { NavLink, useNavigate } from "react-router-dom";

import { useAgents } from "@/components/agents-context";
import { NewAgentDialog } from "@/components/new-agent-dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

export function AppShell({
  children,
  onSignOut,
}: {
  children: ReactNode;
  onSignOut: () => void;
}) {
  const { agents, refresh } = useAgents();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  function sidebar() {
    return (
      <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
        <div className="flex items-center gap-2 px-4 py-4">
          <Sparkles className="size-4 text-sidebar-primary" />
          <div>
            <p className="text-sm font-semibold">Agent as a Service</p>
            <p className="text-xs text-muted-foreground">Gemini agents</p>
          </div>
        </div>
        <div className="px-3">
          <Button className="w-full" onClick={() => setDialogOpen(true)}>
            <Plus />
            New Agent
          </Button>
        </div>
        <ScrollArea className="mt-3 min-h-0 flex-1 px-2">
          <nav className="space-y-1 pb-4">
            <NavLink
              to="/"
              end
              onClick={() => setMenuOpen(false)}
              className={({ isActive }) =>
                `block rounded-lg px-3 py-2 text-sm ${isActive ? "bg-sidebar-accent" : "hover:bg-sidebar-accent/70"}`
              }
            >
              All agents
            </NavLink>
            {agents.map((agent) => (
              <NavLink
                key={agent.id}
                to={`/agents/${agent.slug}`}
                onClick={() => setMenuOpen(false)}
                className={({ isActive }) =>
                  `block truncate rounded-lg px-3 py-2 text-sm ${isActive ? "bg-sidebar-accent" : "hover:bg-sidebar-accent/70"}`
                }
              >
                {agent.name}
              </NavLink>
            ))}
          </nav>
        </ScrollArea>
        <div className="border-t border-sidebar-border p-3">
          <Button variant="ghost" className="w-full" onClick={onSignOut}>
            Sign out
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-svh bg-background text-foreground">
      <aside className="hidden w-72 shrink-0 border-r border-sidebar-border md:block">{sidebar()}</aside>
      {menuOpen ? (
        <div className="fixed inset-0 z-30 md:hidden">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-black/50"
            onClick={() => setMenuOpen(false)}
          />
          <aside className="relative h-full w-72 border-r border-sidebar-border">{sidebar()}</aside>
        </div>
      ) : null}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2 border-b border-border px-3 py-2 md:hidden">
          <Button variant="ghost" size="icon" aria-label="Open menu" onClick={() => setMenuOpen(true)}>
            <Menu />
          </Button>
          <span className="text-sm font-medium">Agents</span>
        </div>
        <div className="min-h-0 flex-1">{children}</div>
      </div>
      <NewAgentDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={(agent) => {
          void refresh().then(() => navigate(`/agents/${agent.slug}`));
        }}
      />
    </div>
  );
}
