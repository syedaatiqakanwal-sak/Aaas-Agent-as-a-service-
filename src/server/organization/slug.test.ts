/* eslint-disable @typescript-eslint/no-floating-promises -- node:test registers the returned promise */
import assert from "node:assert/strict";
import test from "node:test";

import { slugify } from "./slug";

test("slugify keeps letters and digits", () => {
  assert.equal(slugify("Acme Labs!"), "acme-labs");
  assert.equal(slugify("   "), "workspace");
});
