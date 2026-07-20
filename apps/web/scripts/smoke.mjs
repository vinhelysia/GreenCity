/**
 * Frontend foundation smoke checks — no Playwright required.
 * Exit 0 only if structure and anti-fake-API guards pass.
 */
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const srcRoot = join(webRoot, "src");

const REQUIRED_ROUTES = [
  "app/page.tsx",
  "app/thung-rac/page.tsx",
  "app/dich-vu/page.tsx",
  "app/dong-gop/page.tsx",
  "app/cho-online/page.tsx",
  "app/dang-nhap/page.tsx",
  "app/dang-ky/page.tsx",
  "app/ban-phe-lieu/page.tsx",
  "app/admin/bao-gia/page.tsx",
  "app/loading.tsx",
  "app/error.tsx",
  "app/not-found.tsx",
  "app/layout.tsx",
];

const REQUIRED_COMPONENTS = [
  "components/site-header.tsx",
  "components/site-footer.tsx",
  "components/site-nav.tsx",
  "components/nav-links.ts",
  "components/login-form.tsx",
  "components/register-form.tsx",
  "components/header-login-link.tsx",
  "components/auth-provider.tsx",
  "components/empty-state.tsx",
  "components/feature-unavailable.tsx",
  "components/page-header.tsx",
  "components/skip-link.tsx",
  "components/sell-scrap-view.tsx",
  "components/admin-quote-queue.tsx",
  "components/marketplace-listings.tsx",
  "lib/api.ts",
  "lib/format.ts",
];

const FORBIDDEN_SOURCE_PATTERNS = [
  { re: /localhost:3001/, msg: "hard-coded API host localhost:3001" },
  { re: /NEXT_PUBLIC_API_URL/, msg: "NEXT_PUBLIC_API_URL in client-facing source" },
  { re: /fetch\s*\(\s*['"`]https?:\/\//, msg: "absolute URL fetch in source" },
];

const failures = [];

function mustExist(rel) {
  const full = join(srcRoot, rel);
  if (!existsSync(full)) failures.push(`missing: src/${rel}`);
}

for (const rel of REQUIRED_ROUTES) mustExist(rel);
for (const rel of REQUIRED_COMPONENTS) mustExist(rel);

function walk(dir, files = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, files);
    else if (/\.(tsx?|jsx?|mjs|css)$/.test(name)) files.push(full);
  }
  return files;
}

const sourceFiles = walk(srcRoot);
for (const file of sourceFiles) {
  const text = readFileSync(file, "utf8");
  const rel = relative(webRoot, file).replace(/\\/g, "/");
  for (const { re, msg } of FORBIDDEN_SOURCE_PATTERNS) {
    if (re.test(text)) failures.push(`${rel}: ${msg}`);
  }
}

// Nav labels and active helper present
const navLinks = readFileSync(join(srcRoot, "components/nav-links.ts"), "utf8");
for (const label of [
  "Trang chủ",
  "Thùng rác",
  "Dịch vụ",
  "Đóng góp",
  "Chợ online",
]) {
  if (!navLinks.includes(label)) {
    failures.push(`nav-links.ts missing label: ${label}`);
  }
}

const home = readFileSync(join(srcRoot, "app/page.tsx"), "utf8");
for (const section of ["Quảng cáo", "Tin tức", "Thế giới", "Dự án"]) {
  if (!home.includes(section)) {
    failures.push(`homepage missing section: ${section}`);
  }
}

// Real auth: login form submits via same-origin /api (fetch lives in lib/api.ts).
const login = readFileSync(join(srcRoot, "components/login-form.tsx"), "utf8");
const apiLib = readFileSync(join(srcRoot, "lib/api.ts"), "utf8");
const register = readFileSync(
  join(srcRoot, "components/register-form.tsx"),
  "utf8",
);

if (!login.includes("preventDefault")) {
  failures.push("login-form must preventDefault on submit");
}
if (!/fetch\s*\(/.test(apiLib) && !/fetch\s*\(/.test(login)) {
  failures.push("login-form path must call fetch");
}
if (
  !/['"`]\/api\/auth\/login['"`]/.test(apiLib) &&
  !/['"`]\/api\/auth\/login['"`]/.test(login)
) {
  failures.push("login must call same-origin /api/auth/login");
}
if (
  !/['"`]\/api\/auth\/register['"`]/.test(apiLib) &&
  !/['"`]\/api\/auth\/register['"`]/.test(register)
) {
  failures.push("register must call same-origin /api/auth/register");
}
if (!login.includes("useAuth") && !/fetch\s*\(/.test(login)) {
  failures.push("login-form must invoke auth login (useAuth or fetch)");
}

// Marketplace: every fetch path must be same-origin /api/* (never a direct
// API host). FORBIDDEN_SOURCE_PATTERNS above already bans localhost:3001,
// NEXT_PUBLIC_API_URL and absolute-URL fetch() across all source files; this
// additionally checks the agreed marketplace paths are actually present.
const MARKETPLACE_API_PATHS = [
  "/api/scrap-categories",
  "/api/marketplace/listings",
  "/api/marketplace/listings/${",
  "/api/scrap-requests",
  "/api/subscriptions/me",
  "/api/media/upload",
  "/api/admin/scrap-requests",
];
for (const path of MARKETPLACE_API_PATHS) {
  if (!apiLib.includes(path)) {
    failures.push(`lib/api.ts missing same-origin marketplace path: ${path}`);
  }
}

const browserVerify = readFileSync(
  join(webRoot, "scripts/browser-verify.mjs"),
  "utf8",
);
if (/require\(["']playwright["']\)/.test(browserVerify)) {
  failures.push("browser-verify must use repository-owned @playwright/test only");
}
if (!/require\(["']@playwright\/test["']\)/.test(browserVerify)) {
  failures.push("browser-verify must require @playwright/test");
}

const pkg = JSON.parse(readFileSync(join(webRoot, "package.json"), "utf8"));
if (!pkg.devDependencies?.["@playwright/test"]) {
  failures.push("package.json must declare @playwright/test as a devDependency");
}

const verifyReport = readFileSync(
  join(webRoot, "screenshots/VERIFY_REPORT.txt"),
  "utf8",
);
if (/^screenshots=(?:[A-Za-z]:[\\/]|\/)/m.test(verifyReport)) {
  failures.push("VERIFY_REPORT must not contain an absolute machine-local path");
}
if (/C:\\\\Stuff\\\\|C:\\Stuff\\/i.test(verifyReport)) {
  failures.push("VERIFY_REPORT contains machine-local absolute path");
}
if (!existsSync(join(webRoot, "playwright.config.ts"))) {
  failures.push("missing playwright.config.ts");
}
if (!existsSync(join(webRoot, "e2e"))) {
  failures.push("missing e2e/ test directory");
}

if (failures.length) {
  console.error("web smoke FAILED:");
  for (const f of failures) console.error(" -", f);
  process.exit(1);
}

console.log("web smoke OK:");
console.log(` - ${REQUIRED_ROUTES.length} routes/boundaries`);
console.log(` - ${REQUIRED_COMPONENTS.length} components`);
console.log(` - scanned ${sourceFiles.length} source files (no hard-coded API hosts)`);
console.log(" - homepage hierarchy + real auth same-origin /api guards");
