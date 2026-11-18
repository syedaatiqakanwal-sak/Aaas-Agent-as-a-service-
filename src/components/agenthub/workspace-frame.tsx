"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { IntegrationModuleStatusPanel } from "@/components/dashboard/integration-module-status-panel";
import { Background } from "@/components/layout/background";
import { Header } from "@/components/layout/header";
import { useAuthStore } from "@/components/auth/store/auth-store";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api } from "@/trpc/react";
import { cn } from "@/lib/utils";

import { useWorkspace } from "./use-workspace";

const links = [
  { href: "/dashboard", key: "overview", active: "overview" },
  { href: "/dashboard#agents", key: "agents", active: "overview" },
  { href: "/chat", key: "conversations", active: "conversations" },
  { href: "/dashboard/team", key: "team", active: "team" },
  { href: "/account/billing", key: "billing", active: "billing" },
  { href: "/account/profile", key: "profile", active: "profile" },
  { href: "/account/settings", key: "settings", active: "settings" },
] as const;

const planned = [
  "marketplace",
  "builder",
  "knowledge",
  "integrations",
  "executions",
  "analytics",
  "apiKeys",
] as const;

export function WorkspaceFrame({
  active,
  children,
}: {
  active: "overview" | "team" | "conversations" | "billing" | "profile" | "settings";
  children: React.ReactNode;
}) {
  const t = useTranslations("agenthub");
  const { session, overview } = useWorkspace();
  const { setLoginModalOpen } = useAuthStore();
  const utils = api.useUtils();
  const switchWorkspace = api.organization.switch.useMutation({
    onSuccess: async () => {
      await utils.organization.invalidate();
    },
  });
  const [switchError, setSwitchError] = useState<string | null>(null);

  if (session.status === "loading" || (session.status === "authenticated" && overview.isLoading)) {
    return (
      <div className="bg-background flex min-h-dvh items-center justify-center">
        <div className="border-primary h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" />
      </div>
    );
  }

  if (session.status !== "authenticated" || !session.data?.user) {
    return (
      <div className="bg-background relative min-h-dvh">
        <Background />
        <Header />
        <main className="relative z-10 mx-auto flex min-h-dvh max-w-lg flex-col items-start justify-center px-6">
          <h1 className="text-3xl font-semibold tracking-tight">{t("signInTitle")}</h1>
          <p className="text-muted-foreground mt-3 text-sm">{t("signInBody")}</p>
          <Button className="mt-6" onClick={() => setLoginModalOpen(true)}>
            {t("signInAction")}
          </Button>
        </main>
      </div>
    );
  }

  if (overview.isError || !overview.data) {
    return (
      <div className="bg-background relative min-h-dvh">
        <Background />
        <Header />
        <main className="relative z-10 mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-6">
          <h1 className="text-2xl font-semibold">{t("loadErrorTitle")}</h1>
          <p className="text-muted-foreground mt-2 text-sm">{overview.error?.message ?? t("loadErrorBody")}</p>
          <Button className="mt-6 w-fit" onClick={() => void overview.refetch()}>
            {t("retry")}
          </Button>
        </main>
      </div>
    );
  }

  const data = overview.data;
  const isAdmin = session.data.user.isAdmin;

  return (
    <div className="bg-background text-foreground relative min-h-dvh">
      <Background />
      <Header />
      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pt-24 pb-16 md:flex-row md:px-6">
        <aside className="md:w-56 md:shrink-0">
          <div className="mb-4">
            <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              {t("workspaceLabel")}
            </p>
            <p className="mt-1 truncate text-sm font-semibold">
              {data.organization?.name ?? t("noWorkspace")}
            </p>
            {data.workspaces.length > 1 && (
              <label className="mt-3 block text-xs">
                <span className="text-muted-foreground">{t("switchWorkspace")}</span>
                <select
                  className="border-input bg-background mt-1 h-9 w-full rounded-md border px-2 text-sm"
                  value={data.organization?.id ?? ""}
                  onChange={(event) => {
                    setSwitchError(null);
                    switchWorkspace.mutate(
                      { organizationId: event.target.value },
                      {
                        onError: (error) => setSwitchError(error.message),
                      },
                    );
                  }}
                >
                  {data.workspaces.map((workspace) => (
                    <option key={workspace.id} value={workspace.id}>
                      {workspace.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {switchError && <p className="text-destructive mt-2 text-xs">{switchError}</p>}
          </div>
          <nav className="flex gap-2 overflow-x-auto pb-1 md:flex-col md:overflow-visible">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                aria-current={link.active === active ? "page" : undefined}
                className={cn(
                  "rounded-md px-3 py-2 text-sm whitespace-nowrap",
                  link.active === active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                {t(`nav.${link.key}`)}
              </Link>
            ))}
            {isAdmin && (
              <Link
                href="/admin"
                className="text-muted-foreground hover:bg-accent hover:text-foreground rounded-md px-3 py-2 text-sm whitespace-nowrap"
              >
                {t("nav.admin")}
              </Link>
            )}
            <p className="text-muted-foreground hidden px-3 pt-4 text-xs font-medium tracking-wide uppercase md:block">
              {t("plannedLabel")}
            </p>
            {planned.map((key) => (
              <div
                key={key}
                className="text-muted-foreground flex items-center justify-between gap-2 rounded-md px-3 py-2 text-sm whitespace-nowrap md:whitespace-normal"
                aria-disabled="true"
              >
                <span>{t(`nav.${key}`)}</span>
                <Badge variant="outline">{t("planned")}</Badge>
              </div>
            ))}
          </nav>
        </aside>
        <main className="min-w-0 flex-1">
          {data.organization?.status === "SUSPENDED" && (
            <div className="border-destructive/30 bg-destructive/10 text-destructive mb-4 rounded-lg border px-4 py-3 text-sm">
              {t("suspended")}
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}

export function AdminModuleStatus() {
  const { data } = useSession();
  if (!data?.user.isAdmin) return null;
  return (
    <div className="mt-10">
      <IntegrationModuleStatusPanel />
    </div>
  );
}
