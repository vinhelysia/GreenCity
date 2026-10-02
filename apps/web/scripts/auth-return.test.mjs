import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

// Compile the pure helper with the installed compiler; works on CI's Node 20.
const source = readFileSync(new URL("../src/lib/auth-return.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
const exports = {};
new Function("exports", compiled)(exports);
const { getAuthReturnPath } = exports;

for (const path of ["/ban-phe-lieu", "/dong-gop", "/cho-online", "/diem-thuong", "/tai-khoan", "/admin/bao-gia", "/admin/dong-gop", "/admin/giao-dich", "/", "/thung-rac", "/dich-vu"]) {
  assert.equal(getAuthReturnPath(path), path);
}
for (const value of [undefined, null, "", ["/dong-gop"], "https://evil.test", "//evil.test", "/\\evil.test", "/%2f%2fevil.test", "javascript:alert(1)", "/dong-gop?next=//evil.test", "/dang-nhap", "/dang-ky", "/unknown", "/en/community-cleanup", "constructor", "__proto__"]) {
  assert.equal(getAuthReturnPath(value), "/tai-khoan");
}
console.log("auth return checks OK: internal destinations preserved; unsafe/unknown/auth destinations rejected");
