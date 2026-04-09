# Plugins

`slop-scan` can load third-party rule plugins from config files.

## What plugins can add

Plugins can currently contribute:

- rules
- shared preset configs referenced with `extends`
- rule-specific options through `rules.<id>.options`

Config loading does not currently register:

- language plugins
- fact providers
- reporters

## Load a plugin from JSON config

Use a package name or relative path string under `plugins.<namespace>`.

```json
{
  "plugins": {
    "acme": "slop-scan-plugin-acme"
  },
  "extends": ["plugin:acme/recommended"],
  "rules": {
    "acme/no-generated-wrapper": {
      "enabled": true,
      "options": { "threshold": 3 }
    }
  }
}
```

`extends` entries use the form `plugin:<namespace>/<config>`.

## Load a local plugin from a module config

Module configs can import plugin objects directly.

```ts
import { defineConfig } from "slop-scan";
import localPlugin from "./plugins/contains-word-plugin.mjs";

export default defineConfig({
  plugins: {
    local: localPlugin,
  },
  extends: ["plugin:local/recommended"],
  rules: {
    "local/contains-word": {
      options: { word: "danger" },
    },
  },
});
```

## Plugin module shape

A plugin module exports an object with:

- `meta.name`
- `meta.apiVersion`
- optional `meta.version`
- optional `meta.namespace`
- `rules`
- optional `configs`

Use `PLUGIN_API_VERSION` when authoring a plugin in TypeScript.

```ts
import { definePlugin, PLUGIN_API_VERSION } from "slop-scan";

export default definePlugin({
  meta: {
    name: "slop-scan-plugin-acme",
    namespace: "acme",
    apiVersion: PLUGIN_API_VERSION,
  },
  rules: {
    "contains-word": {
      id: "acme/contains-word",
      family: "acme",
      severity: "weak",
      scope: "file",
      requires: ["file.text"],
      supports(context) {
        return context.scope === "file" && Boolean(context.file);
      },
      evaluate(context) {
        const text = context.runtime.store.getFileFact(context.file.path, "file.text") ?? "";
        return text.includes("danger")
          ? [
              {
                ruleId: "acme/contains-word",
                family: "acme",
                severity: "weak",
                scope: "file",
                path: context.file.path,
                message: "Found danger in file text",
                evidence: ["danger"],
                score: 1,
                locations: [{ path: context.file.path, line: 1 }],
              },
            ]
          : [];
      },
    },
  },
  configs: {
    recommended: {
      rules: {
        "acme/contains-word": {
          enabled: true,
        },
      },
    },
  },
});
```

## Naming rules

Plugin rules must use namespaced IDs in the form `namespace/rule-name`.

If a plugin declares `meta.namespace`, it must match the namespace used in config.

## Examples in this repo

- plugin module: [`../examples/local-plugin/contains-word-plugin.mjs`](../examples/local-plugin/contains-word-plugin.mjs)
- module config: [`../examples/local-plugin/slop-scan.config.ts`](../examples/local-plugin/slop-scan.config.ts)
- public plugin types: [`../src/plugin.ts`](../src/plugin.ts)
