import path from "node:path";
import { analyzeRepository } from "./core/engine";
import { createDefaultRegistry } from "./default-registry";
import { loadConfig } from "./config";

export function formatHelp(): string {
  return [
    "slop-analyzer",
    "",
    "Usage:",
    "  slop-analyzer scan [path] [--json]",
    "  slop-analyzer --help",
    "",
    "Development:",
    "  bun run src/cli.ts scan [path] [--json]",
    "",
    "Implemented in this phase:",
    "  - pluggable registry",
    "  - dependency-aware fact provider scheduler",
    "  - repository discovery",
    "  - text and JSON reporters",
  ].join("\n");
}

export async function run(argv: string[]): Promise<number> {
  if (argv.includes("--help") || argv.includes("-h") || argv.length === 0) {
    console.log(formatHelp());
    return 0;
  }

  const [command, targetArg = "."] = argv;

  if (command !== "scan") {
    console.error(`Unknown command: ${command}`);
    console.error("Run with --help to see supported commands.");
    return 1;
  }

  const rootDir = path.resolve(targetArg);
  const config = await loadConfig(rootDir);
  const registry = createDefaultRegistry();
  const result = await analyzeRepository(rootDir, config, registry);
  const reporter = registry.getReporter(argv.includes("--json") ? "json" : "text");

  console.log(await reporter.render(result));
  return 0;
}

if (import.meta.main) {
  const exitCode = await run(process.argv.slice(2));
  process.exit(exitCode);
}
