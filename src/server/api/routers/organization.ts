import { TRPCError } from "@trpc/server";
import type { PrismaClient } from "@prisma/client";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

import { env } from "@/env";
import { INDUSTRIES, OBJECTIVES } from "@/lib/organization-catalog";
import { createLogger } from "@/lib/logger";
import {
  adminProcedure,
  createTRPCRouter,
  protectedProcedure,
  rateLimitedProcedure,
} from "@/server/api/trpc";
import { OrganizationError } from "@/server/organization/errors";
import { sendEmail } from "@/server/email";
import { appEvents } from "@/server/events/bus";
import { createPrismaOrganizationStore } from "@/server/organization/prisma-store";
import { createOrganizationService } from "@/server/organization/service";
import { INVITE_ROLES, ORGANIZATION_ROLES } from "@/server/organization/types";

const logger = createLogger("organization");

type Database = PrismaClient;

function serviceFor(database: Database) {
  return createOrganizationService(createPrismaOrganizationStore(database), {
    events: {
      async emit(event, payload) {
        if (event === "organization:created") {
          await appEvents.emit(event, {
            organizationId: payload.organizationId,
            userId: payload.userId,
          });
          return;
        }
        await appEvents.emit(event, {
          organizationId: payload.organizationId,
          userId: payload.userId,
          role: payload.role ?? "MEMBER",
        });
      },
    },
  });
}

function rethrow(error: unknown): never {
  if (error instanceof OrganizationError) {
    const code =
      error.code === "NOT_FOUND"
        ? "NOT_FOUND"
        : error.code === "CONFLICT"
          ? "CONFLICT"
          : error.code === "VALIDATION"
            ? "BAD_REQUEST"
            : "FORBIDDEN";
    throw new TRPCError({ code, message: error.message });
  }
  throw error;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function deliverInvitation(input: {
  email: string;
  organizationName: string;
  acceptPath: string;
}) {
  const origin = env.APP_URL ?? env.AUTH_URL ?? env.NEXTAUTH_URL;
  if (!origin) {
    return { emailSent: false as const, emailStatus: "not-configured" as const };
  }
  const url = `${origin}${input.acceptPath}`;
  try {
    let subject = `Join ${input.organizationName} on AgentHub AI`;
    let text = `You have been invited to ${input.organizationName}. Open ${url} to accept.`;
    try {
      const t = await getTranslations("agenthub.email");
      subject = t("subject", { organization: input.organizationName });
      text = t("text", { organization: input.organizationName, url });
    } catch (error) {
      logger.warn({ error }, "Invitation copy fell back to English");
    }
    await sendEmail({
      to: input.email,
      subject,
      text,
      html: `<p>${escapeHtml(text)}</p><p><a href="${escapeHtml(url)}">${escapeHtml(url)}</a></p>`,
    });
    return { emailSent: true as const, emailStatus: "sent" as const };
  } catch (error) {
    logger.warn({ error }, "Invitation email was not sent");
    return { emailSent: false as const, emailStatus: "not-sent" as const };
  }
}

const pageInput = z
  .object({
    cursor: z.string().min(1).max(200).optional(),
    limit: z.number().int().min(1).max(50).optional(),
  })
  .optional();

export const organizationRouter = createTRPCRouter({
  overview: protectedProcedure.query(async ({ ctx }) => {
    try {
      return await serviceFor(ctx.db).overview(ctx.session.user.id);
    } catch (error) {
      rethrow(error);
    }
  }),

  listSystemAgents: protectedProcedure.query(async ({ ctx }) => {
    try {
      return await serviceFor(ctx.db).listSystemAgents();
    } catch (error) {
      rethrow(error);
    }
  }),

  listTeam: protectedProcedure.input(pageInput).query(async ({ ctx, input }) => {
    try {
      return await serviceFor(ctx.db).listTeam(ctx.session.user.id, input ?? {});
    } catch (error) {
      rethrow(error);
    }
  }),

  create: rateLimitedProcedure
    .input(z.object({ name: z.string().trim().min(2).max(80) }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await serviceFor(ctx.db).createOrganization(
          ctx.session.user.id,
          input.name,
        );
      } catch (error) {
        rethrow(error);
      }
    }),

  rename: rateLimitedProcedure
    .input(z.object({ name: z.string().trim().min(2).max(80) }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await serviceFor(ctx.db).renameOrganization(
          ctx.session.user.id,
          input.name,
        );
      } catch (error) {
        rethrow(error);
      }
    }),

  saveIndustry: rateLimitedProcedure
    .input(z.object({ industry: z.enum(INDUSTRIES) }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await serviceFor(ctx.db).saveIndustry(
          ctx.session.user.id,
          input.industry,
        );
      } catch (error) {
        rethrow(error);
      }
    }),

  saveObjectives: rateLimitedProcedure
    .input(
      z.object({
        objectives: z.array(z.enum(OBJECTIVES)).min(1).max(OBJECTIVES.length),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await serviceFor(ctx.db).saveObjectives(
          ctx.session.user.id,
          input.objectives,
        );
      } catch (error) {
        rethrow(error);
      }
    }),

  selectAgents: rateLimitedProcedure
    .input(z.object({ agentIds: z.array(z.string().min(1).max(64)).max(10) }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await serviceFor(ctx.db).selectAgents(
          ctx.session.user.id,
          input.agentIds,
        );
      } catch (error) {
        rethrow(error);
      }
    }),

  completeOnboarding: rateLimitedProcedure.mutation(async ({ ctx }) => {
    try {
      return await serviceFor(ctx.db).completeOnboarding(ctx.session.user.id);
    } catch (error) {
      rethrow(error);
    }
  }),

  switch: rateLimitedProcedure
    .input(z.object({ organizationId: z.string().min(1).max(64) }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await serviceFor(ctx.db).switchOrganization(
          ctx.session.user.id,
          input.organizationId,
        );
      } catch (error) {
        rethrow(error);
      }
    }),

  invite: rateLimitedProcedure
    .input(
      z.object({
        email: z.string().trim().email().max(320),
        role: z.enum(INVITE_ROLES),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const invitation = await serviceFor(ctx.db).invite(
          ctx.session.user.id,
          input.email,
          input.role,
        );
        const delivery = await deliverInvitation({
          email: invitation.email,
          organizationName: invitation.organizationName,
          acceptPath: invitation.acceptPath,
        });
        return { ...invitation, ...delivery };
      } catch (error) {
        rethrow(error);
      }
    }),

  revokeInvitation: rateLimitedProcedure
    .input(z.object({ invitationId: z.string().min(1).max(64) }))
    .mutation(async ({ ctx, input }) => {
      try {
        await serviceFor(ctx.db).revokeInvitation(
          ctx.session.user.id,
          input.invitationId,
        );
        return { revoked: true };
      } catch (error) {
        rethrow(error);
      }
    }),

  acceptInvitation: rateLimitedProcedure
    .input(z.object({ token: z.string().min(20).max(200) }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await serviceFor(ctx.db).acceptInvitation(
          ctx.session.user.id,
          input.token,
        );
      } catch (error) {
        rethrow(error);
      }
    }),

  updateMemberRole: rateLimitedProcedure
    .input(
      z.object({
        memberId: z.string().min(1).max(64),
        role: z.enum(ORGANIZATION_ROLES),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await serviceFor(ctx.db).updateMemberRole(
          ctx.session.user.id,
          input.memberId,
          input.role,
        );
      } catch (error) {
        rethrow(error);
      }
    }),

  removeMember: rateLimitedProcedure
    .input(z.object({ memberId: z.string().min(1).max(64) }))
    .mutation(async ({ ctx, input }) => {
      try {
        await serviceFor(ctx.db).removeMember(ctx.session.user.id, input.memberId);
        return { removed: true };
      } catch (error) {
        rethrow(error);
      }
    }),

  setStatus: adminProcedure
    .input(
      z.object({
        organizationId: z.string().min(1).max(64),
        status: z.enum(["ACTIVE", "SUSPENDED"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await serviceFor(ctx.db).setStatus({
          actorIsPlatformAdmin: true,
          organizationId: input.organizationId,
          status: input.status,
        });
      } catch (error) {
        rethrow(error);
      }
    }),
});
