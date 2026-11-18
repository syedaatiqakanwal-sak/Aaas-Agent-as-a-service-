"use client";

import { useSession } from "next-auth/react";

import { api } from "@/trpc/react";

export function useWorkspace() {
  const session = useSession();
  const overview = api.organization.overview.useQuery(undefined, {
    enabled: session.status === "authenticated",
  });
  return { session, overview };
}
