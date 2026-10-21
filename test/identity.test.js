import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  escapeDshInterpolation,
  overlayOfficialIdentity,
  rewritePromptAssembly,
} from "../lib/identity.js";

test("bundle does not configure the removed cwd variable", () => {
  const patch = fs.readFileSync(
    new URL("../cordis.patch.yml", import.meta.url), "utf8",
  );
  assert.match(patch, /^\s+personaSuffix: (?:""|'')\s*$/m);
});

test("assembly does not invent a persona suffix", () => {
  assert.deepEqual(overlayOfficialIdentity([]), []);
});

for (const name of ["deployment:persona-suffix", "persona-suffix"]) {
  for (const text of [
    "",
    "Your working directory is {{cwd}}.",
    "Working directory: {{cwd}}.",
    "Working directory: {{cwd}}",
  ]) {
    test(`${name} clears obsolete directory text: ${text}`, () => {
      const section = { name, text, order: 10200 };
      assert.deepEqual(overlayOfficialIdentity([section]), [
        { ...section, text: "" },
      ]);
      assert.equal(section.text, text);
    });
  }
}

test("legacy directory clause is removed without losing custom suffix text", () => {
  const section = {
    name: "deployment:persona-suffix",
    text: "Model: {{model}}. Your working directory is {{cwd}}. Reply in Chinese.",
    order: 10200,
  };
  assert.deepEqual(overlayOfficialIdentity([section]), [{
    ...section,
    text: "Model: {{model}}. Reply in Chinese.",
  }]);
});

test("unrelated suffix text and literal templates are preserved", () => {
  for (const section of [
    { name: "persona-suffix", text: "Route: {{provider}} / {{model}}." },
    {
      name: "persona-suffix",
      text: "Document this template: Your working directory is {{cwd}}.",
      interpolate: false,
    },
  ]) {
    assert.deepEqual(overlayOfficialIdentity([section]), [section]);
  }
});

test("prompt rewriting keeps runtime directory context and input unchanged", () => {
  const assembly = {
    sections: [{
      name: "deployment:persona-suffix",
      text: "Your working directory is {{cwd}}.",
      order: 10200,
    }],
    contexts: [{
      name: "working-directory",
      text: "Current working directory: /workspace/{{literal}}",
      interpolate: false,
      required: true,
    }],
    tools: [{ name: "read" }],
    variables: { provider: "test-provider", model: "test-model" },
  };
  const original = structuredClone(assembly);
  const rewritten = rewritePromptAssembly(assembly, {
    capabilityProtocol: false,
  });

  assert.ok(rewritten.sections.every((section) => (
    !section.text.includes("{{cwd}}")
  )));
  assert.deepEqual(rewritten.contexts, original.contexts);
  assert.deepEqual(rewritten.tools, original.tools);
  assert.deepEqual(rewritten.variables, original.variables);
  assert.deepEqual(assembly, original);
});

test("interpolation escaping only allows the current built-in variables", () => {
  assert.equal(
    escapeDshInterpolation("{{provider}} / {{model}} / {{cwd}} / {{custom}}"),
    "{{provider}} / {{model}} / { {cwd}} / { {custom}}",
  );
});
