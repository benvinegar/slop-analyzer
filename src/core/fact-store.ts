import type { FactStoreReader } from "./types";

type FactsRecord = Record<string, unknown>;

function createFactsRecord(): FactsRecord {
  return Object.create(null) as FactsRecord;
}

export class FactStore implements FactStoreReader {
  private readonly repoFacts = createFactsRecord();
  private readonly directoryFacts = new Map<string, FactsRecord>();
  private readonly fileFacts = new Map<string, FactsRecord>();

  getRepoFact<T>(factId: string): T | undefined {
    return this.repoFacts[factId] as T | undefined;
  }

  setRepoFact(factId: string, value: unknown): void {
    this.repoFacts[factId] = value;
  }

  hasRepoFact(factId: string): boolean {
    return Object.hasOwn(this.repoFacts, factId);
  }

  getDirectoryFact<T>(directoryPath: string, factId: string): T | undefined {
    return this.directoryFacts.get(directoryPath)?.[factId] as T | undefined;
  }

  setDirectoryFact(directoryPath: string, factId: string, value: unknown): void {
    let facts = this.directoryFacts.get(directoryPath);
    if (!facts) {
      facts = createFactsRecord();
      this.directoryFacts.set(directoryPath, facts);
    }

    facts[factId] = value;
  }

  hasDirectoryFact(directoryPath: string, factId: string): boolean {
    const facts = this.directoryFacts.get(directoryPath);
    return facts ? Object.hasOwn(facts, factId) : false;
  }

  getFileFact<T>(filePath: string, factId: string): T | undefined {
    return this.fileFacts.get(filePath)?.[factId] as T | undefined;
  }

  setFileFact(filePath: string, factId: string, value: unknown): void {
    let facts = this.fileFacts.get(filePath);
    if (!facts) {
      facts = createFactsRecord();
      this.fileFacts.set(filePath, facts);
    }

    facts[factId] = value;
  }

  hasFileFact(filePath: string, factId: string): boolean {
    const facts = this.fileFacts.get(filePath);
    return facts ? Object.hasOwn(facts, factId) : false;
  }

  retainFileFacts(filePath: string, factIds: Iterable<string>): void {
    const facts = this.fileFacts.get(filePath);
    if (!facts) {
      return;
    }

    const keep = factIds instanceof Set ? factIds : new Set(factIds);
    let hasFacts = false;
    for (const factId in facts) {
      if (keep.has(factId)) {
        hasFacts = true;
        continue;
      }

      delete facts[factId];
    }

    if (!hasFacts) {
      this.fileFacts.delete(filePath);
    }
  }

  listFilePathsWithFact(factId: string): string[] {
    return [...this.fileFacts.entries()]
      .filter(([, facts]) => Object.hasOwn(facts, factId))
      .map(([filePath]) => filePath)
      .sort((left, right) => left.localeCompare(right));
  }
}
