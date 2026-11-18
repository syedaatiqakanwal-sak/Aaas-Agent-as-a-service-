import type { OrganizationRole } from "./types";

export function canManageTeam(role: OrganizationRole): boolean {
  return role === "OWNER" || role === "ADMIN";
}

export function canUpdateWorkspace(role: OrganizationRole): boolean {
  return role === "OWNER" || role === "ADMIN";
}

export function canAssignRole(
  actor: OrganizationRole,
  next: OrganizationRole,
): boolean {
  if (actor === "OWNER") return true;
  if (actor === "ADMIN") {
    return next === "ADMIN" || next === "MEMBER" || next === "DEVELOPER";
  }
  return false;
}

export function canRemoveMember(
  actor: OrganizationRole,
  target: OrganizationRole,
): boolean {
  if (actor === "OWNER") return true;
  if (actor === "ADMIN") return target === "MEMBER" || target === "DEVELOPER";
  return false;
}
