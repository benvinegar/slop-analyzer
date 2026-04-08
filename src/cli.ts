import path from "node:path";
import { parseArgs } from "node:util";
import { analyzeRepository } from "./core/engine";
import { createDefaultRegistry } from "./default-registry";
import { loadConfig } from "./config";

export function formatHelp(): string {
  return [
    "slop-scan",
    "",
    "Usage:",
    "  slop-scan scan [path] [options]",
    "  slop-scan --help",
    "",
    "Options:",
    "  --json              Output results as JSON",
    "  --lint              Output results in lint format",
    "  --ignore <pattern>  Glob pattern to ignore (repeatable)",
    "",
    "Examples:",
    '  slop-scan scan ./my-project --ignore "tests/**" --ignore "*.generated.*"',
    "",
    "Development:",
    "  bun run src/cli.ts scan [path] [--json|--lint]",
    "",
    "Implemented in this phase:",
    "  - pluggable registry",
    "  - dependency-aware fact provider scheduler",
    "  - repository discovery",
    "  - text, lint, and JSON reporters",
  ].join("\n");
}

export interface CliArgs {
  help: boolean;
  json: boolean;
  lint: boolean;
  ignore: string[];
  command: string | undefined;
  target: string;
}

export function parseCliArgs(argv: string[]): CliArgs {
  const { values, positionals } = parseArgs({
    args: argv,
    options: {
      help: { type: "boolean", short: "h", default: false },
      json: { type: "boolean", default: false },
      lint: { type: "boolean", default: false },
      ignore: { type: "string", multiple: true, default: [] },
    },
    allowPositionals: true,
    strict: false,
  });

  const [command, target = "."] = positionals;

  return {
    help: values.help,
    json: values.json,
    lint: values.lint,
    ignore: values.ignore,
    command: command,
    target: target,
  };
}

export async function run(argv: string[]): Promise<number> {
  const args = parseCliArgs(argv);

  if (args.help || argv.length === 0) {
    console.log(formatHelp());
    return 0;
  }

  if (args.command !== "scan") {
    console.error(`Unknown command: ${args.command}`);
    console.error("Run with --help to see supported commands.");
    return 1;
  }

  if (args.json && args.lint) {
    console.error("--json and --lint cannot be used together.");
    return 1;
  }

  const rootDir = path.resolve(args.target);
  const config = await loadConfig(rootDir);

  if (args.ignore.length > 0) {
    config.ignores = [...config.ignores, ...args.ignore];
  }

  const registry = createDefaultRegistry();
  const result = await analyzeRepository(rootDir, config, registry);
  const reporter = registry.getReporter(args.json ? "json" : args.lint ? "lint" : "text");
  const output = await reporter.render(result);

  if (output.length > 0) {
    console.log(output);
  }
  return 0;
}

if (import.meta.main) {
  const exitCode = await run(process.argv.slice(2));
  process.exit(exitCode);
}
