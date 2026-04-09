import type { AnalyzerConfig } from "./config";
import type { RulePlugin } from "./core/types";

export const PLUGIN_API_VERSION = 1;

export interface SlopScanPlugin {
  meta: {
    name: string;
    version?: string;
    namespace?: string;
    apiVersion: typeof PLUGIN_API_VERSION;
  };
  rules?: Record<string, RulePlugin>;
  configs?: Record<string, Partial<AnalyzerConfig>>;
}

export type PluginReference = SlopScanPlugin | string;

export interface LoadedPlugin {
  namespace: string;
  plugin: SlopScanPlugin;
  source: string;
}

export interface ConfigFile extends Partial<AnalyzerConfig> {
  extends?: string[];
  plugins?: Record<string, PluginReference>;
}

/** Preserves type inference for plugin definitions. */
export function definePlugin<T extends SlopScanPlugin>(plugin: T): T {
  return plugin;
}

/** Preserves type inference for config definitions. */
export function defineConfig<T extends ConfigFile>(config: T): T {
  return config;
}
