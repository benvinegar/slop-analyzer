import type { FactProvider } from "./types";

export function orderFactProviders(
  providers: FactProvider[],
  initialFacts: string[] = [],
): FactProvider[] {
  const ordered: FactProvider[] = [];
  const pending = [...providers];
  const availableFacts = new Set(initialFacts);

  while (pending.length > 0) {
    const readyIndex = pending.findIndex((provider) =>
      provider.requires.every((fact) => availableFacts.has(fact)),
    );

    if (readyIndex === -1) {
      const missing = pending.map((provider) => ({
        id: provider.id,
        missing: provider.requires.filter((fact) => !availableFacts.has(fact)),
      }));

      throw new Error(`Unresolved fact provider dependencies: ${JSON.stringify(missing)}`);
    }

    const [provider] = pending.splice(readyIndex, 1);
    ordered.push(provider);
    provider.provides.forEach((fact) => availableFacts.add(fact));
  }

  return ordered;
}

export function validateRuleRequirements(
  ruleRequirements: Array<{ id: string; requires: string[] }>,
  availableFacts: string[],
): void {
  const facts = new Set(availableFacts);
  const unresolved = ruleRequirements
    .map((rule) => ({
      id: rule.id,
      missing: rule.requires.filter((fact) => !facts.has(fact)),
    }))
    .filter((rule) => rule.missing.length > 0);

  if (unresolved.length > 0) {
    throw new Error(`Unresolved rule dependencies: ${JSON.stringify(unresolved)}`);
  }
}
