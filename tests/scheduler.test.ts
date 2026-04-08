import { describe, expect, test } from "bun:test";
import { orderFactProviders, validateRuleRequirements } from "../src/core/scheduler";
import type { FactProvider } from "../src/core/types";

const baseProvider = (input: Partial<FactProvider>): FactProvider => ({
  id: input.id ?? "provider",
  scope: input.scope ?? "file",
  requires: input.requires ?? [],
  provides: input.provides ?? [],
  supports: input.supports ?? (() => true),
  run: input.run ?? (() => ({})),
});

describe("fact provider scheduler", () => {
  test("orders providers by declared fact dependencies", () => {
    const ordered = orderFactProviders(
      [
        baseProvider({ id: "derived", requires: ["ast"], provides: ["metrics"] }),
        baseProvider({ id: "ast", requires: ["file.text"], provides: ["ast"] }),
      ],
      ["file.text"],
    );

    expect(ordered.map((provider) => provider.id)).toEqual(["ast", "derived"]);
  });

  test("throws when dependencies cannot be resolved", () => {
    expect(() =>
      orderFactProviders(
        [baseProvider({ id: "broken", requires: ["missing"], provides: ["ast"] })],
        ["file.text"],
      ),
    ).toThrow("Unresolved fact provider dependencies");
  });

  test("validates rule requirements against available facts", () => {
    expect(() =>
      validateRuleRequirements(
        [{ id: "rule.ok", requires: ["file.text", "ast"] }],
        ["file.text", "ast"],
      ),
    ).not.toThrow();

    expect(() =>
      validateRuleRequirements([{ id: "rule.broken", requires: ["missing"] }], ["file.text"]),
    ).toThrow("Unresolved rule dependencies");
  });
});
