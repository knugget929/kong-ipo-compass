import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(HERE, "..");

export function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), "utf8"));
}

export function assertIso(value, label) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value) || Number.isNaN(Date.parse(value)) || new Date(value.slice(0, 10)).toISOString().slice(0, 10) !== value.slice(0, 10)) {
    throw new Error(`${label} must be an ISO timestamp; received ${value}`);
  }
}

export function assertEnum(value, allowed, label) {
  if (!allowed.includes(value)) {
    throw new Error(`${label} must be one of ${allowed.join(", ")}; received ${value}`);
  }
}

export function assertSource(source, label) {
  if (!source || typeof source !== "object") {
    throw new Error(`${label} must be an object`);
  }
  for (const key of ["id", "name", "url", "tier", "observedAt", "effectiveAt"]) {
    if (source[key] === undefined || source[key] === null || source[key] === "") {
      throw new Error(`${label}.${key} is required`);
    }
  }
  const url = new URL(source.url);
  if (url.protocol !== "https:" || url.username || url.password) throw new Error(`${label}.url must be public HTTPS`);
  assertIso(source.observedAt, `${label}.observedAt`);
  assertIso(source.effectiveAt, `${label}.effectiveAt`);
  assertEnum(source.tier, [1, 2, 3, 4, 5, 6, 7], `${label}.tier`);
}

