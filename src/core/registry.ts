import { PLUGIN_API_VERSION } from "../plugin";
import type { SlopScanPlugin } from "../plugin";
import type { FactProvider, LanguagePlugin, ReporterPlugin, RulePlugin } from "./types";

export class Registry {
  private readonly languages: LanguagePlugin[] = [];
  private readonly factProviders: FactProvider[] = [];
  private readonly rules: RulePlugin[] = [];
  private readonly reporters = new Map<string, ReporterPlugin>();

  registerLanguage(plugin: LanguagePlugin): void {
    if (this.languages.some((existing) => existing.id === plugin.id)) {
      throw new Error(`Duplicate language plugin id: ${plugin.id}`);
    }

    this.languages.push(plugin);
  }

  registerFactProvider(plugin: FactProvider): void {
    if (this.factProviders.some((existing) => existing.id === plugin.id)) {
      throw new Error(`Duplicate fact provider id: ${plugin.id}`);
    }

    this.factProviders.push(plugin);
  }

  registerRule(plugin: RulePlugin): void {
    if (this.rules.some((existing) => existing.id === plugin.id)) {
      throw new Error(`Duplicate rule id: ${plugin.id}`);
    }

    this.rules.push(plugin);
  }

  registerReporter(plugin: ReporterPlugin): void {
    if (this.reporters.has(plugin.id)) {
      throw new Error(`Duplicate reporter id: ${plugin.id}`);
    }

    this.reporters.set(plugin.id, plugin);
  }

  /** Validates and registers rules from an external plugin. */
  registerPlugin(namespace: string, plugin: SlopScanPlugin): void {
    if (!plugin.meta || typeof plugin.meta.name !== "string" || plugin.meta.name.length === 0) {
      throw new Error(`Plugin "${namespace}" must define meta.name.`);
    }

    if (plugin.meta.apiVersion !== PLUGIN_API_VERSION) {
      throw new Error(
        `Plugin "${namespace}" uses apiVersion ${plugin.meta.apiVersion}; expected ${PLUGIN_API_VERSION}.`,
      );
    }

    if (plugin.meta.namespace && plugin.meta.namespace !== namespace) {
      throw new Error(`Plugin "${namespace}" declares namespace "${plugin.meta.namespace}".`);
    }

    for (const [ruleName, rule] of Object.entries(plugin.rules ?? {})) {
      const expectedRuleId = `${namespace}/${ruleName}`;

      if (rule.id !== expectedRuleId) {
        throw new Error(
          `Plugin "${namespace}" rule "${ruleName}" must use id "${expectedRuleId}".`,
        );
      }

      this.registerRule(rule);
    }
  }

  getLanguages(): LanguagePlugin[] {
    return [...this.languages];
  }

  getFactProviders(): FactProvider[] {
    return [...this.factProviders];
  }

  getRules(): RulePlugin[] {
    return [...this.rules];
  }

  getReporter(id: string): ReporterPlugin {
    const reporter = this.reporters.get(id);

    if (!reporter) {
      throw new Error(`Unknown reporter: ${id}`);
    }

    return reporter;
  }

  detectLanguage(filePath: string): LanguagePlugin | null {
    return this.languages.find((plugin) => plugin.supports(filePath)) ?? null;
  }
}
