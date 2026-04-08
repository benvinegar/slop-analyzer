#!/usr/bin/env node
import { run } from "../dist/node-entry.js";

const exitCode = await run(process.argv.slice(2));
process.exit(exitCode);
