/* eslint-disable @typescript-eslint/no-floating-promises -- node:test registers the returned promise */
import assert from "node:assert/strict";
import test from "node:test";

import {
  canAssignRole,
  canManageTeam,
  canRemoveMember,
  canUpdateWorkspace,
} from "./policy";

test("owners and admins can manage the team", () => {
  assert.equal(canManageTeam("OWNER"), true);
  assert.equal(canManageTeam("ADMIN"), true);
  assert.equal(canManageTeam("DEVELOPER"), false);
  assert.equal(canManageTeam("MEMBER"), false);
});

test("admins cannot assign or remove owners", () => {
  assert.equal(canAssignRole("ADMIN", "OWNER"), false);
  assert.equal(canAssignRole("ADMIN", "DEVELOPER"), true);
  assert.equal(canAssignRole("OWNER", "OWNER"), true);
  assert.equal(canRemoveMember("ADMIN", "OWNER"), false);
  assert.equal(canRemoveMember("ADMIN", "MEMBER"), true);
  assert.equal(canUpdateWorkspace("DEVELOPER"), false);
});
