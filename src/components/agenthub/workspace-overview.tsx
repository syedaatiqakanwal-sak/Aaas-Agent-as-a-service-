"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api } from "@/trpc/react";

import { AdminModuleStatus } from "./workspace-frame";
import { useWorkspace } from "./use-workspace";

export function WorkspaceOverview() {
  const t = useTranslations("agenthub");
  const { overview } = useWorkspace();
  const subscription = api.membership.getSubscriptionStatus.useQuery(undefined, {
    enabled: Boolean(overview.data?.organization),
    retry: false,
  });
  const data = overview.data;
  if (!data?.organization) return null;

  const plan = subscription.data?.planType
    ? t(`plans.${subscription.data.planType}`)
    : null;
  const status = subscription.data?.status
    ? t(`subscriptionStatus.${subscription.data.status}`)
    : null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("welcome", { name: data.organization.name })}
        </h1>
        <p className="text-muted-foreground mt-2 max-w-2xl text-sm">{t("welcomeBody")}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label={t("metrics.members")} value={String(data.stats.members)} />
        <Metric label={t("metrics.agents")} value={String(data.stats.installedAgents)} />
        <Metric label={t("metrics.conversations")} value={String(data.stats.conversations)} />
        <Metric
          label={t("metrics.subscription")}
          value={
            subscription.isLoading
              ? t("loading")
              : subscription.isError
                ? t("subscriptionUnavailable")
                : status ?? t("noSubscription")
          }
          detail={plan ?? undefined}
        />
      </div>

      <p className="text-muted-foreground text-sm">{t("metricsNote")}</p>

      <section id="agents" className="scroll-mt-28">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">{t("installedAgents")}</h2>
          <Button asChild variant="outline" size="sm">
            <Link href="/chat">{t("openChat")}</Link>
          </Button>
        </div>
        {data.agents.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t("noInstalledAgents")}</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {data.agents.map((agent) => (
              <li key={agent.id} className="bg-card rounded-xl border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-medium">{agent.name}</h3>
                    <p className="text-muted-foreground mt-1 text-xs">{agent.model}</p>
                  </div>
                  <Badge variant={agent.enabled ? "secondary" : "outline"}>
                    {agent.enabled ? t("enabled") : t("paused")}
                  </Badge>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">{t("recentConversations")}</h2>
        {data.conversations.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t("noConversations")}</p>
        ) : (
          <ul className="divide-border divide-y rounded-xl border">
            {data.conversations.map((conversation) => (
              <li key={conversation.id}>
                <Link
                  href={`/chat/${conversation.id}`}
                  className="hover:bg-accent flex items-center justify-between gap-3 px-4 py-3 text-sm"
                >
                  <span>{conversation.title ?? t("untitledConversation")}</span>
                  <span className="text-muted-foreground text-xs">
                    {new Date(conversation.updatedAt).toLocaleString()}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <AdminModuleStatus />
    </div>
  );
}

function Metric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="bg-card rounded-xl border p-4">
      <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
      {detail && <p className="text-muted-foreground mt-1 text-xs">{detail}</p>}
    </div>
  );
}
