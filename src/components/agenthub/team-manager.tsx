"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/trpc/react";
import { INVITE_ROLES, type OrganizationRole } from "@/server/organization/types";

import { useWorkspace } from "./use-workspace";

export function TeamManager() {
  const t = useTranslations("agenthub");
  const utils = api.useUtils();
  const { overview, session } = useWorkspace();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<(typeof INVITE_ROLES)[number]>("MEMBER");
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [previousCursors, setPreviousCursors] = useState<Array<string | undefined>>([]);
  const team = api.organization.listTeam.useQuery({
    limit: 20,
    ...(cursor ? { cursor } : {}),
  });

  const refresh = async () => {
    await utils.organization.invalidate();
  };
  const invite = api.organization.invite.useMutation({
    onSuccess: async (result) => {
      setEmail("");
      await refresh();
      if (result.emailSent) toast.success(t("inviteSent"));
      else toast.message(t("inviteSaved"));
    },
    onError: (error) => toast.error(error.message),
  });
  const revoke = api.organization.revokeInvitation.useMutation({
    onSuccess: () => void refresh(),
    onError: (error) => toast.error(error.message),
  });
  const updateRole = api.organization.updateMemberRole.useMutation({
    onSuccess: () => void refresh(),
    onError: (error) => toast.error(error.message),
  });
  const remove = api.organization.removeMember.useMutation({
    onSuccess: () => void refresh(),
    onError: (error) => toast.error(error.message),
  });

  if (!overview.data?.organization) {
    return <p className="text-muted-foreground text-sm">{t("createFirst")}</p>;
  }

  const canManage = overview.data.capabilities.manageTeam;
  const actorIsOwner = overview.data.role === "OWNER";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("teamTitle")}</h1>
        <p className="text-muted-foreground mt-2 text-sm">{t("teamBody")}</p>
      </div>

      {canManage && (
        <form
          className="bg-card grid gap-3 rounded-xl border p-4 md:grid-cols-[1fr_160px_auto]"
          onSubmit={(event) => {
            event.preventDefault();
            invite.mutate({ email, role });
          }}
        >
          <Input
            type="email"
            required
            value={email}
            placeholder={t("emailPlaceholder")}
            onChange={(event) => setEmail(event.target.value)}
          />
          <select
            className="border-input bg-background h-9 rounded-md border px-2 text-sm"
            value={role}
            onChange={(event) => setRole(event.target.value as (typeof INVITE_ROLES)[number])}
          >
            {INVITE_ROLES.map((item) => (
              <option key={item} value={item}>
                {t(`roles.${item}`)}
              </option>
            ))}
          </select>
          <Button type="submit" disabled={invite.isPending}>
            {invite.isPending ? t("saving") : t("invite")}
          </Button>
        </form>
      )}

      <section>
        <h2 className="mb-3 text-lg font-semibold">{t("members")}</h2>
        {team.isLoading && <p className="text-muted-foreground text-sm">{t("loading")}</p>}
        {team.isError && <p className="text-destructive text-sm">{team.error.message}</p>}
        <ul className="divide-border divide-y rounded-xl border">
          {team.data?.members.map((member) => {
            const isSelf = member.userId === session.data?.user.id;
            const roleChoices: OrganizationRole[] = actorIsOwner
              ? ["OWNER", "ADMIN", "MEMBER", "DEVELOPER"]
              : ["ADMIN", "MEMBER", "DEVELOPER"];
            return (
              <li key={member.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{member.user.name ?? member.user.email}</p>
                  <p className="text-muted-foreground truncate text-xs">{member.user.email}</p>
                </div>
                {canManage && !isSelf ? (
                  <select
                    className="border-input bg-background h-9 rounded-md border px-2 text-sm"
                    value={member.role}
                    disabled={updateRole.isPending || (!actorIsOwner && member.role === "OWNER")}
                    onChange={(event) =>
                      updateRole.mutate({
                        memberId: member.id,
                        role: event.target.value as OrganizationRole,
                      })
                    }
                  >
                    {roleChoices.map((item) => (
                      <option key={item} value={item}>
                        {t(`roles.${item}`)}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="text-sm">{t(`roles.${member.role}`)}</span>
                )}
                {canManage && !isSelf && (actorIsOwner || member.role === "MEMBER" || member.role === "DEVELOPER") && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={remove.isPending}
                    onClick={() => {
                      if (window.confirm(t("removeConfirm"))) remove.mutate({ memberId: member.id });
                    }}
                  >
                    {t("remove")}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
        <div className="mt-3 flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={previousCursors.length === 0}
            onClick={() => {
              const history = [...previousCursors];
              const previous = history.pop();
              setPreviousCursors(history);
              setCursor(previous);
            }}
          >
            {t("previousPage")}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!team.data?.nextCursor}
            onClick={() => {
              if (!team.data?.nextCursor) return;
              setPreviousCursors((current) => [...current, cursor]);
              setCursor(team.data.nextCursor);
            }}
          >
            {t("nextPage")}
          </Button>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">{t("invitations")}</h2>
        {team.data?.invitations.length === 0 && (
          <p className="text-muted-foreground text-sm">{t("noInvitations")}</p>
        )}
        <ul className="grid gap-3">
          {team.data?.invitations.map((invitation) => (
            <li key={invitation.id} className="bg-card rounded-xl border p-4 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium">{invitation.email}</p>
                  <p className="text-muted-foreground text-xs">
                    {t(`roles.${invitation.role}`)} · {new Date(invitation.expiresAt).toLocaleString()}
                  </p>
                </div>
                {canManage && (
                  <div className="flex gap-2">
                    {invitation.acceptPath && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const link = `${window.location.origin}${invitation.acceptPath}`;
                          void navigator.clipboard.writeText(link).then(
                            () => toast.success(t("linkCopied")),
                            () => toast.error(t("linkCopyFailed")),
                          );
                        }}
                      >
                        {t("copyLink")}
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={revoke.isPending}
                      onClick={() => revoke.mutate({ invitationId: invitation.id })}
                    >
                      {t("revoke")}
                    </Button>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
