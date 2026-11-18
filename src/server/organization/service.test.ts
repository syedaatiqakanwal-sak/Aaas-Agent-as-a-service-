/* eslint-disable @typescript-eslint/no-floating-promises -- node:test registers the returned promise */
import assert from "node:assert/strict";
import test from "node:test";

import { OrganizationError } from "./errors";
import { MemoryOrganizationStore } from "./memory-store";
import { createOrganizationService } from "./service";

const now = new Date("2026-11-12T00:00:00.000Z");

function harness() {
  const store = new MemoryOrganizationStore();
  store.registerUser({
    id: "owner",
    email: "owner@example.com",
    canonicalEmail: "owner@example.com",
    name: "Owner",
    image: null,
  });
  store.registerUser({
    id: "admin",
    email: "admin@example.com",
    canonicalEmail: "admin@example.com",
    name: "Admin",
    image: null,
  });
  store.registerUser({
    id: "stranger",
    email: "stranger@example.com",
    canonicalEmail: "stranger@example.com",
    name: "Stranger",
    image: null,
  });
  store.systemAgents.set("agent-support", {
    id: "agent-support",
    name: "Support assistant",
    description: "Answers support questions.",
    model: "test-model",
  });
  const events: Array<{ event: string; userId: string }> = [];
  const service = createOrganizationService(store, {
    now: () => now,
    createToken: () => "token-token-token-token-token-token",
    events: {
      async emit(event, payload) {
        events.push({ event, userId: payload.userId });
      },
    },
  });
  return { store, service, events };
}

test("creating a workspace makes the caller the owner", async () => {
  const { service, events, store } = harness();
  const membership = await service.createOrganization("owner", "Acme Labs!");
  assert.equal(membership.role, "OWNER");
  assert.equal(membership.organization.slug, "acme-labs");
  assert.equal(events[0]?.event, "organization:created");
  assert.equal(store.audits[0]?.action, "organization.created");

  const duplicate = await service.createOrganization("stranger", "Acme Labs");
  assert.equal(duplicate.organization.slug, "acme-labs-2");
  const isolated = await service.overview("owner");
  assert.equal(isolated.organization?.id, membership.organization.id);
  await assert.rejects(
    () => service.switchOrganization("owner", duplicate.organization.id),
    (error: unknown) => error instanceof OrganizationError && error.code === "NOT_FOUND",
  );
});

test("members cannot invite and the last owner cannot be removed", async () => {
  const { service } = harness();
  await service.createOrganization("owner", "Acme");
  const invitation = await service.invite("owner", "admin@example.com", "ADMIN");
  const joined = await service.acceptInvitation("admin", invitation.acceptPath.split("/").pop() ?? "");
  assert.equal(joined.role, "ADMIN");

  await assert.rejects(
    () => service.invite("admin", "person@example.com", "OWNER"),
    (error: unknown) => error instanceof OrganizationError && error.code === "FORBIDDEN",
  );
  await service.switchOrganization("owner", joined.organizationId);
  const ownerPage = await service.listTeam("owner");
  const ownerMember = ownerPage.members.find((member) => member.userId === "owner");
  assert.ok(ownerMember);
  await assert.rejects(
    () => service.updateMemberRole("owner", ownerMember.id, "MEMBER"),
    (error: unknown) => error instanceof OrganizationError && error.code === "CONFLICT",
  );
  await assert.rejects(
    () => service.updateMemberRole("admin", ownerMember.id, "MEMBER"),
    (error: unknown) => error instanceof OrganizationError && error.code === "FORBIDDEN",
  );
});

test("an invitation can only be accepted by the invited email", async () => {
  const { service } = harness();
  await service.createOrganization("owner", "Acme");
  const invitation = await service.invite("owner", "Admin@Example.com", "DEVELOPER");
  const token = invitation.acceptPath.split("/").pop() ?? "";
  await assert.rejects(
    () => service.acceptInvitation("stranger", token),
    (error: unknown) => error instanceof OrganizationError && error.code === "FORBIDDEN",
  );
  const developer = await service.acceptInvitation("admin", token);
  assert.equal(developer.role, "DEVELOPER");
  await assert.rejects(
    () => service.invite("admin", "other@example.com", "MEMBER"),
    (error: unknown) => error instanceof OrganizationError && error.code === "FORBIDDEN",
  );
  const strangerOverview = await service.overview("stranger");
  assert.equal(strangerOverview.organization, null);
});

test("a suspended workspace rejects new invitations", async () => {
  const { service } = harness();
  const membership = await service.createOrganization("owner", "Acme");
  await service.setStatus({
    actorIsPlatformAdmin: true,
    organizationId: membership.organization.id,
    status: "SUSPENDED",
  });
  await assert.rejects(
    () => service.invite("owner", "admin@example.com", "MEMBER"),
    (error: unknown) => error instanceof OrganizationError && error.code === "SUSPENDED",
  );
  await assert.rejects(
    () =>
      service.setStatus({
        actorIsPlatformAdmin: false,
        organizationId: membership.organization.id,
        status: "ACTIVE",
      }),
    (error: unknown) => error instanceof OrganizationError && error.code === "FORBIDDEN",
  );
});

test("onboarding installs only real system agents", async () => {
  const { service, store } = harness();
  await service.createOrganization("owner", "Acme");
  await service.saveIndustry("owner", "customer-support");
  await service.saveObjectives("owner", ["support-customers"]);
  await assert.rejects(
    () => service.selectAgents("owner", ["missing-agent"]),
    (error: unknown) => error instanceof OrganizationError && error.code === "VALIDATION",
  );
  assert.equal(store.installed.get("owner"), undefined);
  await service.selectAgents("owner", ["agent-support"]);
  const completed = await service.completeOnboarding("owner");
  assert.equal(completed.onboardingStep, 6);
  assert.ok(completed.onboardingCompletedAt);
  const overview = await service.overview("owner");
  assert.equal(overview.stats.installedAgents, 1);
  assert.equal(overview.agents[0]?.name, "Support assistant");
});
