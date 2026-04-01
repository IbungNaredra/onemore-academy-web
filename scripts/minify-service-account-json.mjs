#!/usr/bin/env node
/**
 * Reads a Google service account JSON file and prints one minified line for .env
 * (paste into GOOGLE_SERVICE_ACCOUNT_JSON=...).
 *
 * Usage (from project root):
 *   node scripts/minify-service-account-json.mjs google-service-account.json
 *   node scripts/minify-service-account-json.mjs path/to/key.json
 */
import { readFileSync } from "node:fs";

const path = process.argv[2] ?? "google-service-account.json";
const raw = readFileSync(path, "utf8");
const obj = JSON.parse(raw);
const line = JSON.stringify(obj);
console.log("");
console.log("--- Copy the line below into .env.local as:");
console.log("GOOGLE_SERVICE_ACCOUNT_JSON=" + line);
console.log("");
console.log("Or use a file instead (recommended):");
console.log("GOOGLE_SERVICE_ACCOUNT_JSON_FILE=./" + path.replace(/\\/g, "/").split("/").pop());
console.log("");
