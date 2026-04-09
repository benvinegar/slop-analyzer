let moduleLoadCounter = 0;
import { access, readFile, rm, stat, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { ModuleKind, ScriptTarget, transpileModule } from "typescript";
import { PLUGIN_API_VERSION } from "./plugin";
import type { ConfigFile, LoadedPlugin, PluginReference, SlopScanPlugin } from "./plugin";

export interface RuleConfig {
  enabled?: boolean;
  weight?: number;
  options?: unknown;
}

export interface ResolvedRuleConfig {
  enabled: boolean;
  weight: number;
  options?: unknown;
}

export interface ConfigOverride {
  files: string[];
  rules: Record<string, RuleConfig>;
}

export interface AnalyzerConfig {
  ignores: string[];
  rules: Record<string, RuleConfig>;
  thresholds: Record<string, number>;
  overrides: ConfigOverride[];
}

export interface LoadedConfigFile {
  path: string | null;
  format: "json" | "module" | "none";
  config: AnalyzerConfig;
  plugins: LoadedPlugin[];
}

const CONFIG_FILENAMES = [
  "slop-scan.config.ts",
  "slop-scan.config.js",
  "slop-scan.config.mjs",
  "slop-scan.config.cjs",
  "slop-scan.config.json",
  "repo-slop.config.ts",
  "repo-slop.config.js",
  "repo-slop.config.mjs",
  "repo-slop.config.cjs",
  "repo-slop.config.json",
] as const;

export const DEFAULT_CONFIG: AnalyzerConfig = {
  ignores: [
    "**/node_modules/**",
    "**/.git/**",
    "**/dist/**",
    "**/.next/**",
    "**/coverage/**",
    "**/*.generated.*",
  ],
  rules: {},
  thresholds: {},
  overrides: [],
};

const EMPTY_CONFIG: AnalyzerConfig = {
  ignores: [],
  rules: {},
  thresholds: {},
  overrides: [],
};

const moduleResolverCache = new Map<string, ReturnType<typeof createRequire>>();
const configModuleCache = new Map<string, { mtimeNs: bigint; moduleNamespace: unknown }>();
const pluginModuleCache = new Map<string, { mtimeMs: number; moduleNamespace: unknown }>();
const configPathCache = new Map<string, { directoryMtimeMs: number; configPath: string | null }>();

/** Creates unique suffixes for temp module loads. */
function nextModuleLoadToken(): number {
  moduleLoadCounter += 1;
  return moduleLoadCounter;
}

/** Checks whether a value can be treated like a config object. */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Deep-clones nested rule options. */
function cloneOptionValue<T>(value: T): T {
  if (Array.isArray(value)) {
    const cloned: unknown[] = [];
    cloned.length = value.length;
    for (let index = 0; index < value.length; index += 1) {
      cloned[index] = cloneOptionValue(value[index]);
    }
    return cloned as T;
  }

  if (isPlainObject(value)) {
    const cloned: Record<string, unknown> = {};
    for (const key of Object.keys(value)) {
      cloned[key] = cloneOptionValue(value[key]);
    }
    return cloned as T;
  }

  return value;
}

/** Clones a single rule config. */
function cloneRuleConfig(config: RuleConfig): RuleConfig {
  return {
    enabled: config.enabled,
    weight: config.weight,
    options: cloneOptionValue(config.options),
  };
}

/** Clones a map of rule configs. */
function cloneRuleConfigMap(rules: Record<string, RuleConfig>): Record<string, RuleConfig> {
  const ruleIds = Object.keys(rules);
  if (ruleIds.length === 0) {
    return {};
  }

  const cloned: Record<string, RuleConfig> = {};
  for (const ruleId of ruleIds) {
    cloned[ruleId] = cloneRuleConfig(rules[ruleId] as RuleConfig);
  }
  return cloned;
}

/** Clones a resolved analyzer config. */
function cloneConfig(config: AnalyzerConfig): AnalyzerConfig {
  const overrides: ConfigOverride[] = [];
  overrides.length = config.overrides.length;
  for (let index = 0; index < config.overrides.length; index += 1) {
    const override = config.overrides[index];
    overrides[index] = {
      files: [...override.files],
      rules: cloneRuleConfigMap(override.rules),
    };
  }

  return {
    ignores: [...config.ignores],
    rules: cloneRuleConfigMap(config.rules),
    thresholds: { ...config.thresholds },
    overrides,
  };
}

/** Merges rule overrides onto a cloned rule map. */
function mergeRuleConfigs(
  base: Record<string, RuleConfig>,
  next: Record<string, RuleConfig>,
): Record<string, RuleConfig> {
  const nextRuleIds = Object.keys(next);
  if (nextRuleIds.length === 0) {
    return cloneRuleConfigMap(base);
  }

  const merged = cloneRuleConfigMap(base);

  for (const ruleId of nextRuleIds) {
    const nextConfig = cloneRuleConfig(next[ruleId] as RuleConfig);
    if (!Object.hasOwn(merged, ruleId)) {
      merged[ruleId] = nextConfig;
      continue;
    }

    const mergedConfig = cloneRuleConfig(merged[ruleId] as RuleConfig);
    mergedConfig.enabled = nextConfig.enabled;
    mergedConfig.weight = nextConfig.weight;
    mergedConfig.options = nextConfig.options;
    merged[ruleId] = mergedConfig;
  }

  return merged;
}

/** Merges defaults, presets, and user config into one detached object. */
function mergeAnalyzerConfig(
  base: AnalyzerConfig,
  next: Partial<AnalyzerConfig>,
  options: { replaceIgnores?: boolean } = {},
): AnalyzerConfig {
  const replaceIgnores = options.replaceIgnores ?? false;
  const ignores = next.ignores
    ? replaceIgnores
      ? [...next.ignores]
      : [...base.ignores, ...next.ignores]
    : [...base.ignores];

  const overrides: ConfigOverride[] = [];
  overrides.length = base.overrides.length + (next.overrides?.length ?? 0);
  for (let index = 0; index < base.overrides.length; index += 1) {
    const override = base.overrides[index];
    overrides[index] = {
      files: [...override.files],
      rules: cloneRuleConfigMap(override.rules),
    };
  }
  if (next.overrides) {
    for (let index = 0; index < next.overrides.length; index += 1) {
      const override = next.overrides[index];
      overrides[base.overrides.length + index] = {
        files: [...override.files],
        rules: cloneRuleConfigMap(override.rules),
      };
    }
  }

  return {
    ignores,
    rules: mergeRuleConfigs(base.rules, next.rules ?? {}),
    thresholds: { ...base.thresholds, ...next.thresholds },
    overrides,
  };
}

/** Applies top-level config fields after preset resolution. */
function toResolvedAnalyzerConfig(
  configFile: ConfigFile,
  extendedConfig: AnalyzerConfig,
): AnalyzerConfig {
  const topLevelConfig: Partial<AnalyzerConfig> = {
    ignores: configFile.ignores,
    rules: configFile.rules,
    thresholds: configFile.thresholds,
    overrides: configFile.overrides,
  };

  return mergeAnalyzerConfig(extendedConfig, topLevelConfig, {
    replaceIgnores: topLevelConfig.ignores !== undefined,
  });
}

/** Finds the active config file for a repo root. */
async function findConfigPath(rootDir: string): Promise<string | null> {
  const directoryStat = await stat(rootDir).catch(() => null);
  if (!directoryStat) {
    return null;
  }

  const cached = configPathCache.get(rootDir);
  if (cached && cached.directoryMtimeMs === directoryStat.mtimeMs) {
    return cached.configPath;
  }

  for (const filename of CONFIG_FILENAMES) {
    const configPath = path.join(rootDir, filename);
    try {
      await access(configPath);
      configPathCache.set(rootDir, { directoryMtimeMs: directoryStat.mtimeMs, configPath });
      return configPath;
    } catch {
      continue;
    }
  }

  configPathCache.set(rootDir, { directoryMtimeMs: directoryStat.mtimeMs, configPath: null });
  return null;
}

/** Accepts either default exports or plain object exports. */
function unwrapModuleDefault<T>(moduleNamespace: T): T {
  if (isPlainObject(moduleNamespace) && "default" in moduleNamespace) {
    return moduleNamespace.default as T;
  }

  return moduleNamespace;
}

/** Reuses a module resolver for one config directory. */
function createModuleResolver(baseDir: string) {
  const cached = moduleResolverCache.get(baseDir);
  if (cached) {
    return cached;
  }

  const resolver = createRequire(path.join(baseDir, "__slop-scan__.js"));
  moduleResolverCache.set(baseDir, resolver);
  return resolver;
}

/** Resolves a string plugin reference from a config directory. */
function resolveModulePath(specifier: string, baseDir: string): string {
  const resolver = createModuleResolver(baseDir);
  return resolver.resolve(specifier);
}

/** Loads a TypeScript module through a temporary transpiled file. */
async function importTranspiledTypeScriptModule(modulePath: string): Promise<unknown> {
  const source = await readFile(modulePath, "utf8");
  const transpiled = transpileModule(source, {
    compilerOptions: {
      module: ModuleKind.ES2022,
      target: ScriptTarget.ES2022,
      esModuleInterop: true,
      allowSyntheticDefaultImports: true,
    },
    fileName: modulePath,
  });
  const tempPath = path.join(
    path.dirname(modulePath),
    `.slop-scan-${path.basename(modulePath)}-${process.pid}-${nextModuleLoadToken()}.mjs`,
  );

  await writeFile(tempPath, transpiled.outputText, "utf8");

  try {
    return await import(`${pathToFileURL(tempPath).href}?cacheBust=${nextModuleLoadToken()}`);
  } finally {
    await rm(tempPath, { force: true });
  }
}

/** Imports a module with cache busting so edits are picked up. */
async function importResolvedModule(modulePath: string): Promise<unknown> {
  const extension = path.extname(modulePath).toLowerCase();
  const moduleUrl = `${pathToFileURL(modulePath).href}?cacheBust=${nextModuleLoadToken()}`;

  if (extension === ".ts" || extension === ".mts" || extension === ".cts") {
    if (typeof Bun !== "undefined") {
      return import(moduleUrl);
    }

    return importTranspiledTypeScriptModule(modulePath);
  }

  return import(moduleUrl);
}

/** Validates that a loaded config export is object-shaped. */
function normalizeConfigFile(rawConfig: unknown): ConfigFile {
  const config = unwrapModuleDefault(rawConfig);

  if (!isPlainObject(config)) {
    throw new Error("Config file must export an object.");
  }

  return config as ConfigFile;
}

/** Validates that a loaded plugin export is object-shaped. */
function normalizePlugin(rawPlugin: unknown): SlopScanPlugin {
  const plugin = unwrapModuleDefault(rawPlugin);

  if (!isPlainObject(plugin)) {
    throw new Error("Plugin module must export an object.");
  }

  return plugin as SlopScanPlugin;
}

/** Checks plugin metadata and rule ids before use. */
function assertValidPlugin(namespace: string, plugin: SlopScanPlugin, source: string): void {
  if (!plugin.meta || typeof plugin.meta.name !== "string" || plugin.meta.name.length === 0) {
    throw new Error(`Plugin "${namespace}" from ${source} must define meta.name.`);
  }

  if (plugin.meta.apiVersion !== PLUGIN_API_VERSION) {
    throw new Error(
      `Plugin "${namespace}" from ${source} uses apiVersion ${plugin.meta.apiVersion}; expected ${PLUGIN_API_VERSION}.`,
    );
  }

  if (plugin.meta.namespace && plugin.meta.namespace !== namespace) {
    throw new Error(
      `Plugin "${namespace}" from ${source} declares namespace "${plugin.meta.namespace}".`,
    );
  }

  for (const [ruleName, rule] of Object.entries(plugin.rules ?? {})) {
    const expectedRuleId = `${namespace}/${ruleName}`;

    if (rule.id !== expectedRuleId) {
      throw new Error(`Plugin "${namespace}" rule "${ruleName}" must use id "${expectedRuleId}".`);
    }
  }
}

/** Reuses an unchanged config module by mtime. */
async function importCachedConfigModule(modulePath: string): Promise<unknown> {
  const nextMtimeNs = (await stat(modulePath, { bigint: true })).mtimeNs;
  const cached = configModuleCache.get(modulePath);

  if (cached && cached.mtimeNs === nextMtimeNs) {
    return cached.moduleNamespace;
  }

  const extension = path.extname(modulePath).toLowerCase();
  const moduleNamespace =
    extension === ".ts" || extension === ".mts" || extension === ".cts"
      ? await importTranspiledTypeScriptModule(modulePath)
      : await importResolvedModule(modulePath);
  configModuleCache.set(modulePath, { mtimeNs: nextMtimeNs, moduleNamespace });
  return moduleNamespace;
}

/** Reuses an unchanged plugin module by mtime. */
async function importCachedPluginModule(modulePath: string): Promise<unknown> {
  const nextMtimeMs = (await stat(modulePath)).mtimeMs;
  const cached = pluginModuleCache.get(modulePath);

  if (cached && cached.mtimeMs === nextMtimeMs) {
    return cached.moduleNamespace;
  }

  const moduleNamespace = await importResolvedModule(modulePath);
  pluginModuleCache.set(modulePath, { mtimeMs: nextMtimeMs, moduleNamespace });
  return moduleNamespace;
}

/** Normalizes one plugin reference into a loaded plugin record. */
async function loadPluginReference(
  namespace: string,
  reference: PluginReference,
  baseDir: string,
): Promise<LoadedPlugin> {
  if (typeof reference !== "string") {
    assertValidPlugin(namespace, reference, "inline config");
    return { namespace, plugin: reference, source: "inline config" };
  }

  const resolvedPath = resolveModulePath(reference, baseDir);
  const plugin = normalizePlugin(await importCachedPluginModule(resolvedPath));
  assertValidPlugin(namespace, plugin, reference);
  return { namespace, plugin, source: reference };
}

/** Loads and validates the configured plugins. */
async function loadPlugins(
  pluginReferences: Record<string, PluginReference> | undefined,
  baseDir: string,
): Promise<LoadedPlugin[]> {
  if (!pluginReferences) {
    return [];
  }

  return Promise.all(
    Object.entries(pluginReferences).map(([namespace, reference]) =>
      loadPluginReference(namespace, reference, baseDir),
    ),
  );
}

/** Applies plugin preset configs from extends entries. */
function resolvePluginExtends(
  extendsRefs: string[] | undefined,
  plugins: LoadedPlugin[],
): AnalyzerConfig {
  if (!extendsRefs || extendsRefs.length === 0) {
    return cloneConfig(EMPTY_CONFIG);
  }

  let resolved = cloneConfig(EMPTY_CONFIG);

  for (const extendsRef of extendsRefs) {
    const match = /^plugin:([^/]+)\/(.+)$/.exec(extendsRef);

    if (!match) {
      throw new Error(`Unsupported extends target: ${extendsRef}`);
    }

    const [, namespace, configName] = match;
    const plugin = plugins.find((candidate) => candidate.namespace === namespace);

    if (!plugin) {
      throw new Error(
        `Cannot resolve plugin config ${extendsRef}: plugin "${namespace}" is not loaded.`,
      );
    }

    const pluginConfig = plugin.plugin.configs?.[configName];

    if (!pluginConfig) {
      throw new Error(
        `Cannot resolve plugin config ${extendsRef}: config "${configName}" was not found.`,
      );
    }

    resolved = mergeAnalyzerConfig(resolved, pluginConfig, { replaceIgnores: false });
  }

  return resolved;
}

/** Loads a config file in JSON or module form. */
async function loadRawConfigFile(configPath: string): Promise<ConfigFile> {
  if (configPath.endsWith(".json")) {
    const raw = await readFile(configPath, "utf8");
    return normalizeConfigFile(JSON.parse(raw) as ConfigFile);
  }

  return normalizeConfigFile(await importCachedConfigModule(configPath));
}

const DEFAULT_RESOLVED_RULE_CONFIG: ResolvedRuleConfig = {
  enabled: true,
  weight: 1,
};

/** Expands sparse rule config into the runtime shape. */
export function resolveRuleConfigDefaults(ruleConfig?: RuleConfig): ResolvedRuleConfig {
  if (!ruleConfig) {
    return DEFAULT_RESOLVED_RULE_CONFIG;
  }

  const enabled = ruleConfig.enabled ?? true;
  const weight = ruleConfig.weight ?? 1;

  if (ruleConfig.options === undefined) {
    if (
      enabled === DEFAULT_RESOLVED_RULE_CONFIG.enabled &&
      weight === DEFAULT_RESOLVED_RULE_CONFIG.weight
    ) {
      return DEFAULT_RESOLVED_RULE_CONFIG;
    }

    return { enabled, weight };
  }

  return {
    enabled,
    weight,
    options: cloneOptionValue(ruleConfig.options),
  };
}

/** Loads the resolved config and plugin list for a scan. */
export async function loadConfigFile(rootDir: string): Promise<LoadedConfigFile> {
  const configPath = await findConfigPath(rootDir);

  if (!configPath) {
    return {
      path: null,
      format: "none",
      config: cloneConfig(DEFAULT_CONFIG),
      plugins: [],
    };
  }

  const configFile = await loadRawConfigFile(configPath);
  const configDir = path.dirname(configPath);
  const plugins = await loadPlugins(configFile.plugins, configDir);
  const extendedConfig = mergeAnalyzerConfig(
    DEFAULT_CONFIG,
    resolvePluginExtends(configFile.extends, plugins),
    { replaceIgnores: false },
  );

  return {
    path: configPath,
    format: configPath.endsWith(".json") ? "json" : "module",
    config: toResolvedAnalyzerConfig(configFile, extendedConfig),
    plugins,
  };
}

/** Loads only the resolved analyzer config. */
export async function loadConfig(rootDir: string): Promise<AnalyzerConfig> {
  return (await loadConfigFile(rootDir)).config;
}
