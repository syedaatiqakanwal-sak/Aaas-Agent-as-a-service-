"use client";

import { OnboardingWizard } from "@/components/agenthub/onboarding-wizard";
import { WorkspaceFrame } from "@/components/agenthub/workspace-frame";
import { WorkspaceOverview } from "@/components/agenthub/workspace-overview";
import { useWorkspace } from "@/components/agenthub/use-workspace";

export default function DashboardPage() {
  const { overview } = useWorkspace();
  const completed = Boolean(overview.data?.organization?.onboardingCompletedAt);

  return (
    <WorkspaceFrame active="overview">
      {overview.data && !completed ? <OnboardingWizard /> : <WorkspaceOverview />}
    </WorkspaceFrame>
  );
}
