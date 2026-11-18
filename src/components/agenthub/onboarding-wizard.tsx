"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { INDUSTRIES, OBJECTIVES, isIndustry, isObjective, type Industry, type Objective } from "@/lib/organization-catalog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/trpc/react";

import { useWorkspace } from "./use-workspace";

function serverStep(step: number | undefined, hasOrganization: boolean): number {
  if (!hasOrganization) return 1;
  if (!step || step < 2) return 2;
  if (step < 3) return 3;
  if (step < 4) return 4;
  return 5;
}

export function OnboardingWizard() {
  const t = useTranslations("agenthub");
  const utils = api.useUtils();
  const { overview } = useWorkspace();
  const organization = overview.data?.organization;
  const canUpdate = overview.data?.capabilities.updateWorkspace ?? true;
  const derived = serverStep(organization?.onboardingStep, Boolean(organization));
  const [step, setStep] = useState(derived);
  const [name, setName] = useState(organization?.name ?? "");
  const [industry, setIndustry] = useState<Industry>(
    organization?.industry && isIndustry(organization.industry)
      ? organization.industry
      : INDUSTRIES[0],
  );
  const [objectives, setObjectives] = useState<Objective[]>(
    (organization?.objectives ?? []).filter(isObjective),
  );
  const [agentIds, setAgentIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setStep(derived);
  }, [derived, organization?.id]);

  const refresh = async () => {
    setError(null);
    await utils.organization.invalidate();
  };

  const create = api.organization.create.useMutation({
    onSuccess: () => void refresh(),
    onError: (mutationError) => setError(mutationError.message),
  });
  const saveIndustry = api.organization.saveIndustry.useMutation({
    onSuccess: () => void refresh(),
    onError: (mutationError) => setError(mutationError.message),
  });
  const saveObjectives = api.organization.saveObjectives.useMutation({
    onSuccess: () => void refresh(),
    onError: (mutationError) => setError(mutationError.message),
  });
  const selectAgents = api.organization.selectAgents.useMutation({
    onSuccess: () => void refresh(),
    onError: (mutationError) => setError(mutationError.message),
  });
  const rename = api.organization.rename.useMutation({
    onError: (mutationError) => setError(mutationError.message),
  });
  const complete = api.organization.completeOnboarding.useMutation({
    onSuccess: () => void refresh(),
    onError: (mutationError) => setError(mutationError.message),
  });
  const agents = api.organization.listSystemAgents.useQuery(undefined, {
    enabled: step === 4,
  });

  const pending =
    create.isPending ||
    saveIndustry.isPending ||
    saveObjectives.isPending ||
    selectAgents.isPending ||
    rename.isPending ||
    complete.isPending;

  if (organization && !canUpdate && !organization.onboardingCompletedAt) {
    return (
      <section className="max-w-xl">
        <h1 className="text-2xl font-semibold tracking-tight">{t("setupPendingTitle")}</h1>
        <p className="text-muted-foreground mt-2 text-sm">{t("setupPendingBody")}</p>
      </section>
    );
  }

  return (
    <section className="max-w-xl">
      <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
        {t("stepLabel", { current: step, total: 5 })}
      </p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">{t(`steps.${step}.title`)}</h1>
      <p className="text-muted-foreground mt-2 text-sm">{t(`steps.${step}.body`)}</p>

      <form
        className="mt-6 space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          if (step === 1) create.mutate({ name });
          if (step === 2 && industry) saveIndustry.mutate({ industry });
          if (step === 3) saveObjectives.mutate({ objectives });
          if (step === 4) selectAgents.mutate({ agentIds });
          if (step === 5) {
            const finish = () => complete.mutate();
            if (name.trim() && name.trim() !== organization?.name) {
              rename.mutate({ name }, { onSuccess: finish });
              return;
            }
            finish();
          }
        }}
      >
        {step === 1 && (
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={t("workspaceName")}
            minLength={2}
            maxLength={80}
            required
          />
        )}
        {step === 2 && (
          <select
            className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm"
            value={industry}
            onChange={(event) => {
              if (isIndustry(event.target.value)) setIndustry(event.target.value);
            }}
          >
            {INDUSTRIES.map((item) => (
              <option key={item} value={item}>
                {t(`industries.${item}`)}
              </option>
            ))}
          </select>
        )}
        {step === 3 && (
          <div className="grid gap-2">
            {OBJECTIVES.map((objective) => {
              const selected = objectives.includes(objective);
              return (
                <button
                  key={objective}
                  type="button"
                  aria-pressed={selected}
                  className={`rounded-lg border px-3 py-2 text-left text-sm ${selected ? "border-primary bg-primary/10" : "border-border"}`}
                  onClick={() =>
                    setObjectives((current) =>
                      current.includes(objective)
                        ? current.filter((item) => item !== objective)
                        : [...current, objective],
                    )
                  }
                >
                  {t(`objectives.${objective}`)}
                </button>
              );
            })}
          </div>
        )}
        {step === 4 && (
          <div className="grid gap-2">
            {agents.isLoading && <p className="text-muted-foreground text-sm">{t("loading")}</p>}
            {agents.data?.length === 0 && (
              <p className="text-muted-foreground text-sm">{t("noSystemAgents")}</p>
            )}
            {agents.data?.map((agent) => {
              const selected = agentIds.includes(agent.id);
              return (
                <button
                  key={agent.id}
                  type="button"
                  aria-pressed={selected}
                  className={`rounded-lg border px-3 py-3 text-left ${selected ? "border-primary bg-primary/10" : "border-border"}`}
                  onClick={() =>
                    setAgentIds((current) =>
                      current.includes(agent.id)
                        ? current.filter((id) => id !== agent.id)
                        : [...current, agent.id],
                    )
                  }
                >
                  <span className="block text-sm font-medium">{agent.name}</span>
                  <span className="text-muted-foreground mt-1 block text-xs">
                    {agent.description ?? agent.model}
                  </span>
                </button>
              );
            })}
          </div>
        )}
        {step === 5 && (
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            minLength={2}
            maxLength={80}
            required
          />
        )}
        {error && <p className="text-destructive text-sm">{error}</p>}
        <div className="flex gap-2">
          {step > 1 && (
            <Button type="button" variant="outline" onClick={() => setStep((current) => Math.max(1, current - 1))}>
              {t("back")}
            </Button>
          )}
          <Button type="submit" disabled={pending || (step === 3 && objectives.length === 0)}>
            {pending ? t("saving") : step === 5 ? t("finish") : t("continue")}
          </Button>
        </div>
      </form>
    </section>
  );
}
