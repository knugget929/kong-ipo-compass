import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(HERE, "..");

export function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), "utf8"));
}

export function assertIso(value, label) {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
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
  assertIso(source.observedAt, `${label}.observedAt`);
  assertIso(source.effectiveAt, `${label}.effectiveAt`);
  assertEnum(source.tier, [1, 2, 3, 4, 5, 6, 7], `${label}.tier`);
}

