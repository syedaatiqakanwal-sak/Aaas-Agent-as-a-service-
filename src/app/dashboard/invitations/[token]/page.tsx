"use client";

import { useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";

import { useAuthStore } from "@/components/auth/store/auth-store";
import { Background } from "@/components/layout/background";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { api } from "@/trpc/react";

export function InvitationAccept({ token }: { token: string }) {
  const t = useTranslations("agenthub");
  const router = useRouter();
  const { status } = useSession();
  const { setLoginModalOpen } = useAuthStore();
  const started = useRef(false);
  const accept = api.organization.acceptInvitation.useMutation({
    onSuccess: () => router.push("/dashboard"),
  });

  useEffect(() => {
    if (status !== "authenticated" || started.current || token.length < 20) return;
    started.current = true;
    accept.mutate({ token });
  }, [accept, status, token]);

  return (
    <div className="bg-background relative min-h-dvh">
      <Background />
      <Header />
      <main className="relative z-10 mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-6">
        <h1 className="text-3xl font-semibold tracking-tight">{t("acceptTitle")}</h1>
        {token.length < 20 && <p className="text-destructive mt-3 text-sm">{t("acceptInvalid")}</p>}
        {status === "unauthenticated" && (
          <>
            <p className="text-muted-foreground mt-3 text-sm">{t("acceptSignIn")}</p>
            <Button className="mt-6 w-fit" onClick={() => setLoginModalOpen(true)}>
              {t("signInAction")}
            </Button>
          </>
        )}
        {status === "authenticated" && accept.isPending && (
          <p className="text-muted-foreground mt-3 text-sm">{t("accepting")}</p>
        )}
        {accept.isError && <p className="text-destructive mt-3 text-sm">{accept.error.message}</p>}
      </main>
    </div>
  );
}

export default function InvitationPage() {
  const params = useParams();
  const token = typeof params.token === "string" ? params.token : "";
  return <InvitationAccept token={token} />;
}
