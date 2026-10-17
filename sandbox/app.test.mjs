import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import test from "node:test";

const source = readFileSync(new URL("./app.js", import.meta.url), "utf8");

async function browser() {
  const nodes = new Map();
  const storage = new Map([["contextweave-demo-session-v03", "old-session"]]);
  const calls = [];
  const notices = [];
  let responder = async () => ({ ok: true, json: async () => ({ memories: [] }) });
  const node = (name) => {
    if (!nodes.has(name)) {
      let text = "";
      nodes.set(name, {
        value: "", innerHTML: "", disabled: false, hidden: false,
        get textContent() { return text; },
        set textContent(value) { text = value; if (name === "#chat") notices.push(value); },
        classList: { toggle() {} }, addEventListener() {}, focus() {},
        querySelector(selector) { return node(name + " " + selector); },
      });
    }
    return nodes.get(name);
  };
  const context = vm.createContext({
    window: {}, AbortSignal, CSS: { escape: (value) => value },
    document: { querySelector: node, querySelectorAll: () => [], createElement: () => ({}) },
    sessionStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
    },
    fetch: async (url, options = {}) => {
      calls.push({ url, ...options });
      return responder(url, options);
    },
  });
  vm.runInContext(source, context);
  await new Promise((resolve) => setImmediate(resolve));
  return {
    nodes, calls, notices, context,
    respond(callback) { responder = callback; },
    run(code) { return vm.runInContext(code, context); },
  };
}

test("failed saves preserve the input without a local record or a success receipt", async () => {
  const app = await browser();
  app.nodes.get("#memory-input").value = "北欧是个不错的地方";
  app.respond(async () => ({ ok: false, status: 429 }));
  await app.run("runAction(saveMemory)");
  assert.equal(app.nodes.get("#memory-input").value, "北欧是个不错的地方");
  assert.equal(app.run("memories.length"), 0);
  assert.ok(app.notices.some((message) => message.includes("频繁")));
  assert.ok(app.notices.every((message) => !message.includes("已添加")));
  assert.equal(app.calls.at(-1).method, "POST");
});

test("expired sessions renew once and repeat the recall with the new token", async () => {
  const app = await browser();
  let recalls = 0;
  app.respond(async (url, options) => {
    if (url.endsWith("/session")) return { ok: true, json: async () => ({ session_id: "new-session" }) };
    if (url.includes("/memories?")) return { ok: true, json: async () => ({ memories: [] }) };
    if (++recalls === 1) return { ok: false, status: 410 };
    assert.equal(JSON.parse(options.body).session_id, "new-session");
    return { ok: true, json: async () => ({ answer: "真实结果", memories: [], route: "NO_RECALL", trace_id: "server" }) };
  });
  await app.run("runAction(() => runPrompt('去哪里旅行'))");
  assert.equal(recalls, 2);
  assert.equal(app.nodes.get("#trace-id").textContent, "server");
  assert.equal(app.nodes.get("#current-query").textContent, "这次的问题：去哪里旅行");
  assert.ok(app.notices.some((message) => message.includes("过期")));
});

test("recall errors clear stale traces, and overlapping actions are not submitted twice", async () => {
  const app = await browser();
  let rejectRequest;
  app.respond(() => new Promise((resolve, reject) => { rejectRequest = reject; }));
  const pending = app.run("runAction(() => runPrompt('下午喝什么'))");
  await app.run("runAction(() => runPrompt('去哪里旅行'))");
  assert.equal(app.calls.filter((call) => call.url.endsWith("/recall")).length, 1);
  rejectRequest(new Error("offline"));
  await pending;
  assert.equal(app.nodes.get("#trace-id").textContent, "—");
  assert.equal(app.nodes.get("#trace-state").textContent, "召回未完成，请重试");
  assert.equal(app.nodes.get("#engine-mode").textContent, "服务暂不可用 · 可重试");
  assert.ok(app.notices.every((message) => !message.includes("咖啡")));
});

test("all returned tiers are visible as cards and the legacy answer is not displayed", async () => {
  const app = await browser();
  app.respond(async () => ({ ok: true, json: async () => ({
    answer: "旧版只复述第一条的固定回答",
    route: "RECALL", trace_id: "three-results",
    memories: [
      { public_id: "one", tier: "T0", excerpt: "旅行节奏", score: 15 },
      { public_id: "two", tier: "T1", excerpt: "京都清晨", score: 12 },
      { public_id: "three", tier: "T2", excerpt: "北欧<script>unsafe</script>", score: 13,
        recall_path: ["query", "旅行意向", "地理地点", "北欧"] },
    ],
  }) }));
  await app.run("runAction(() => runPrompt('去哪里旅行'))");
  const html = app.nodes.get("#trace-list").innerHTML;
  assert.equal((html.match(/<article /g) || []).length, 3);
  assert.ok(html.indexOf("旅行节奏") < html.indexOf("京都清晨"));
  assert.ok(html.indexOf("京都清晨") < html.indexOf("北欧"));
  assert.match(html, /北欧&lt;script&gt;unsafe&lt;\/script&gt;/);
  assert.equal((html.match(/<details class="recall-evidence">/g) || []).length, 3);
  assert.ok(html.indexOf("北欧") < html.lastIndexOf("<details"));
  assert.doesNotMatch(html, /<script>|旧版只复述/);
  assert.ok(app.notices.every((message) => !message.includes("固定回答")));
  assert.equal(app.nodes.get("#trace-state").textContent, "找到 3 条");
  assert.equal(app.nodes.get("#current-query").textContent, "这次的问题：去哪里旅行");
});

test("version history appears beside its memory without replacing recall results", async () => {
  const app = await browser();
  app.nodes.get("#trace-list").innerHTML = "原来的召回结果";
  app.respond(async () => ({ ok: true, json: async () => ({
    versions: [{ version: 2, status: "active", content: "奶茶" }, { version: 1, status: "superseded", content: "咖啡" }],
  }) }));
  await app.run("runAction(() => showHistory('drink'))");
  const history = app.nodes.get('#memory-list [data-history-for="drink"]');
  assert.equal(history.hidden, false);
  assert.match(history.textContent, /v2（当前）：奶茶/);
  assert.match(history.textContent, /v1（历史）：咖啡/);
  assert.equal(app.nodes.get("#trace-list").innerHTML, "原来的召回结果");
});
