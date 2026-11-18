"use client";

import { Building2, CreditCard, MessagesSquare, Route } from "lucide-react";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

const features = [
  { icon: Building2, title: "workspacesTitle", body: "workspacesBody", color: "text-blue-500" },
  { icon: MessagesSquare, title: "chatTitle", body: "chatBody", color: "text-purple-500" },
  { icon: CreditCard, title: "billingTitle", body: "billingBody", color: "text-emerald-500" },
  { icon: Route, title: "roadmapTitle", body: "roadmapBody", color: "text-orange-500" },
] as const;

export function Features() {
  const t = useTranslations("landing.features");

  return (
    <section className="bg-background relative w-full overflow-hidden px-6 py-32">
      <div className="pointer-events-none absolute top-0 right-0 h-[500px] w-[500px] rounded-full bg-blue-500/5 blur-[100px]" />
      <div className="pointer-events-none absolute bottom-0 left-0 h-[500px] w-[500px] rounded-full bg-purple-500/5 blur-[100px]" />

      <div className="mx-auto max-w-[1400px]">
        <div className="mb-24 flex flex-col justify-between gap-8 md:flex-row md:items-end">
          <div className="max-w-2xl">
            <h2 className="mb-6 text-sm font-medium tracking-widest text-blue-500 uppercase">
              {t("eyebrow")}
            </h2>
            <h3 className="text-4xl leading-[1.1] font-medium tracking-tight md:text-6xl">
              {t("title")}
              <br />
              <span className="text-muted-foreground">{t("titleMuted")}</span>
            </h3>
          </div>
          <p className="text-muted-foreground max-w-sm text-lg leading-relaxed font-light">
            {t("summary")}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-x-8 gap-y-16 md:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => (
            <div key={feature.title} className="group flex flex-col items-start">
              <div className="bg-border/50 relative mb-8 h-px w-full overflow-hidden">
                <div
                  className={cn(
                    "bg-foreground absolute inset-0 h-full w-full -translate-x-full transition-transform duration-700 ease-out group-hover:translate-x-0",
                  )}
                />
              </div>
              <div
                className={cn(
                  "group-hover:bg-accent/50 mb-6 -ml-3 rounded-full p-3 transition-colors duration-300",
                  feature.color,
                )}
              >
                <feature.icon className="h-6 w-6" strokeWidth={1.5} />
              </div>
              <h4 className="mb-3 text-xl font-medium tracking-tight transition-transform duration-300 group-hover:translate-x-1">
                {t(feature.title)}
              </h4>
              <p className="text-muted-foreground text-base leading-relaxed font-light">
                {t(feature.body)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
