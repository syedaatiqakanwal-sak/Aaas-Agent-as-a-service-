"use client";

import { TeamManager } from "@/components/agenthub/team-manager";
import { WorkspaceFrame } from "@/components/agenthub/workspace-frame";

export default function TeamPage() {
  return (
    <WorkspaceFrame active="team">
      <TeamManager />
    </WorkspaceFrame>
  );
}
