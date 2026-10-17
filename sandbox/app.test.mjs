import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import test from "node:test";

const source = readFileSync(new URL("./app.js", import.meta.url), "utf8");

async function browser() {
  const nodes = new Map();
  const storage = new Map([["contextweave-demo-session-v03", "old-session"]]);
  const calls = [];
  const messages = [];
  let responder = async () => ({ ok: true, json: async () => ({ memories: [] }) });
  const node = (name) => {
    if (!nodes.has(name)) nodes.set(name, {
      value: "", textContent: "", innerHTML: "", disabled: false, hidden: false,
      classList: { toggle() {} }, addEventListener() {}, focus() {},
      querySelector(selector) { return node(name + " " + selector); },
      appendChild(message) { messages.push(message.innerHTML); },
    });
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
    nodes, calls, messages, context,
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
  assert.ok(app.messages.some((message) => message.includes("频繁")));
  assert.ok(app.messages.every((message) => !message.includes("已添加")));
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
  assert.ok(app.messages.some((message) => message.includes("过期")));
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
  assert.ok(app.messages.every((message) => !message.includes("咖啡")));
});
