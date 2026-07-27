import { describe, it } from "node:test";
import assert from "node:assert/strict";
import vi from "../../messages/vi.json";
import en from "../../messages/en.json";

function getKeys(obj: Record<string, any>, prefix = ""): string[] {
  let keys: string[] = [];
  for (const key of Object.keys(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof obj[key] === "object" && obj[key] !== null && !Array.isArray(obj[key])) {
      keys = keys.concat(getKeys(obj[key], fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys.sort();
}

describe("i18n Dictionary Parity", () => {
  it("vi.json and en.json have identical translation key structures", () => {
    const viKeys = getKeys(vi);
    const enKeys = getKeys(en);

    const missingInEn = viKeys.filter((k) => !enKeys.includes(k));
    const missingInVi = enKeys.filter((k) => !viKeys.includes(k));

    assert.deepStrictEqual(missingInEn, []);
    assert.deepStrictEqual(missingInVi, []);
    assert.deepStrictEqual(viKeys, enKeys);
  });
});
