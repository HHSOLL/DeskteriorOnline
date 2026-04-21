import test from "node:test";
import assert from "node:assert/strict";

type EnvModule = typeof import("./env");

let envModule: EnvModule;

test.before(async () => {
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_ANON_KEY = "anon-key";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
  process.env.CORS_ORIGINS =
    "http://localhost:3100,https://deskterioronline.vercel.app,https://deskterioronline-web-*.vercel.app,https://deskterioronline-*.vercel.app";

  envModule = await import(`./env.ts?test=${Date.now()}`);
});

test("normalizeOriginValue trims trailing slashes", () => {
  assert.equal(envModule.normalizeOriginValue("https://deskterioronline.vercel.app///"), "https://deskterioronline.vercel.app");
});

test("buildCorsOriginRule keeps exact origins exact", () => {
  const rule = envModule.buildCorsOriginRule("https://deskterioronline.vercel.app");
  assert.equal(rule.raw, "https://deskterioronline.vercel.app");
  assert.equal(rule.regex, undefined);
});

test("buildCorsOriginRule supports preview wildcards", () => {
  const [previewRule] = envModule.parseCorsOriginRules("https://deskterioronline-web-*.vercel.app");
  assert.equal(Boolean(previewRule?.regex?.test("https://deskterioronline-web-git-main-sols-projects.vercel.app")), true);
  assert.equal(Boolean(previewRule?.regex?.test("https://deskterioronline.vercel.app")), false);
});

test("isCorsOriginAllowed accepts exact and wildcard matches", () => {
  const rules = envModule.parseCorsOriginRules(
    "http://localhost:3100,https://deskterioronline.vercel.app,https://deskterioronline-web-*.vercel.app,https://deskterioronline-*.vercel.app"
  );

  assert.equal(envModule.isCorsOriginAllowed(undefined, rules), true);
  assert.equal(envModule.isCorsOriginAllowed("http://localhost:3100", rules), true);
  assert.equal(envModule.isCorsOriginAllowed("https://deskterioronline.vercel.app/", rules), true);
  assert.equal(envModule.isCorsOriginAllowed("https://deskterioronline-web-git-main-sols-projects-7e25d3b5.vercel.app", rules), true);
  assert.equal(envModule.isCorsOriginAllowed("https://deskterioronline-42wR8yvFd-sols-projects-7e25d3b5.vercel.app", rules), true);
  assert.equal(envModule.isCorsOriginAllowed("https://evil.example.com", rules), false);
});

test("env exposes numeric API_PORT", () => {
  assert.equal(typeof envModule.env.API_PORT, "number");
  assert.equal(Number.isFinite(envModule.env.API_PORT), true);
});
