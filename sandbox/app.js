const API_BASE = window.CONTEXTWEAVE_API_BASE || "https://archive.wingfindsmoss.com";
const SESSION_KEY = "contextweave-demo-session-v03";
const $ = (selector) => document.querySelector(selector);
const memoryList = $("#memory-list");
const memoryInput = $("#memory-input");
const memoryForm = $("#memory-form");
const chat = $("#chat");
const prompt = $("#prompt");
const traceList = $("#trace-list");
let sessionId = sessionStorage.getItem(SESSION_KEY) || "";
let memories = [];
let editing = null;
let lastQuery = "";
let busy = false;

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);
}

function setConnection(label, connected) {
  $("#engine-mode").textContent = label;
  $("#engine-dot").classList.toggle("live", connected);
}

function addMessage(text, who = "assistant") {
  const message = document.createElement("div");
  message.className = "message " + who;
  const avatar = who === "assistant" ? '<span class="avatar">CW</span>' : "";
  const label = who === "assistant" ? "ContextWeave 演示代理" : "本次访客";
  message.innerHTML = avatar + "<div><p>" + esc(text) + "</p><small>" + label + "</small></div>";
  chat.appendChild(message);
  chat.scrollTop = chat.scrollHeight;
}

function renderMemories() {
  memoryList.innerHTML = memories.map((memory) =>
    '<div class="memory-item ' + (memory.sample ? "sample" : "") + '">' +
    '<div class="memory-meta"><span>' + esc(memory.memory_type) + "</span><small>" +
    (memory.sample ? "样板" : "本次访客") + " · v" + esc(memory.version || 1) + "</small></div>" +
    "<p>" + esc(memory.content) + "</p>" +
    '<div class="memory-actions"><button type="button" data-edit="' + esc(memory.id) + '">更新这条</button>' +
    '<button type="button" data-history="' + esc(memory.id) + '">查看版本</button></div></div>'
  ).join("");
  $("#memory-count").textContent = memories.length + " / 20";
}

function cancelEdit() {
  editing = null;
  $("#memory-label").textContent = "先告诉我一件以后可能用得上的事";
  memoryForm.querySelector('[type="submit"]').textContent = "记住";
  $("#cancel-edit").hidden = true;
}

function beginEdit(id) {
  editing = memories.find((memory) => memory.id === id);
  if (!editing) return;
  memoryInput.value = editing.content;
  $("#memory-label").textContent = "更新这条记忆，旧版本会留在历史里";
  memoryForm.querySelector('[type="submit"]').textContent = "保存更新";
  $("#cancel-edit").hidden = false;
  memoryInput.focus();
}

async function api(path, options = {}) {
  const response = await fetch(API_BASE + path, {
    ...options,
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(60000),
  });
  if (!response.ok) {
    throw Object.assign(new Error("API " + response.status), { status: response.status });
  }
  const data = await response.json();
  setConnection("ContextWeave Public Sandbox · Live", true);
  return data;
}

async function createSession() {
  const data = await api("/v1/demo/session", { method: "POST", body: "{}" });
  sessionId = data.session_id;
  sessionStorage.setItem(SESSION_KEY, sessionId);
}

async function sessionRequest(path, payload = {}, { method = "POST", renew = true } = {}) {
  if (!sessionId) await createSession();
  const send = () => method === "GET"
    ? api(path + "?session_id=" + encodeURIComponent(sessionId))
    : api(path, { method, body: JSON.stringify({ ...payload, session_id: sessionId }) });
  try {
    return await send();
  } catch (error) {
    if (![401, 410].includes(error.status)) throw error;
    await createSession();
    await refreshMemories();
    clearTrace("上次临时会话已过期");
    addMessage("上次临时会话已过期，已开启新会话。旧会话的数据不会带入。");
    if (!renew) throw Object.assign(new Error("expired-edit"), { status: 410 });
    return send();
  }
}

async function refreshMemories() {
  const data = await sessionRequest("/v1/demo/memories", {}, { method: "GET" });
  memories = data.memories;
  renderMemories();
}

function clearTrace(message) {
  $("#trace-state").textContent = message;
  $("#trace-state").className = "pill neutral";
  $("#recall-level").textContent = "—";
  $("#used-memory").textContent = "0";
  $("#trace-id").textContent = "—";
  traceList.className = "trace-list empty";
  traceList.innerHTML = "<p>" + esc(message) + "</p>";
}

function renderTrace(data) {
  const items = data.memories || [];
  $("#trace-state").textContent = items.length ? "已召回" : "未命中";
  $("#trace-state").className = items.length ? "pill" : "pill neutral";
  $("#recall-level").textContent = data.route;
  $("#used-memory").textContent = String(items.length);
  $("#trace-id").textContent = data.trace_id;
  traceList.className = items.length ? "trace-list" : "trace-list empty";
  traceList.innerHTML = items.length ? items.map((memory) => {
    const path = (memory.recall_path || []).join(" → ");
    return '<div class="trace-item" data-public-id="' + esc(memory.public_id) + '">' +
      '<div class="trace-top"><strong>' + esc(memory.tier + " · " + memory.role) +
      '</strong><span class="score">score ' + esc(memory.score) + "</span></div><p>" +
      esc(memory.excerpt || memory.sanitized_summary) + '</p><div class="why">' +
      esc(memory.match_reason) + " · " + esc((memory.source_channels || []).join(" + ")) + "</div>" +
      (path ? '<div class="recall-path">' + esc(path) + "</div>" : "") +
      (memory.expandable ? '<button class="expand-btn" data-expand="' + esc(memory.public_id) + '">展开</button>' : "") +
      '<div class="expanded-memory" hidden></div></div>';
  }).join("") : "<p>本次没有找到足够相关的记忆。</p>";
}

async function runAction(action) {
  if (busy) return;
  busy = true;
  const controls = () => document.querySelectorAll("button, input");
  controls().forEach((control) => { control.disabled = true; });
  try {
    await action();
  } catch (error) {
    const messages = {
      400: "内容没有保存，请检查是否为空或超过 240 字。",
      404: "没有找到这条记忆，或后端尚未更新。请刷新后重试。",
      409: "记录已变化或临时记忆已满，请刷新列表后重试。输入内容仍然保留。",
      410: "这次更新未保存。输入内容仍然保留，请在新会话中重新选择记忆。",
      429: "操作有些频繁，这次请求未完成，请稍后再试。",
    };
    if (!error.status || error.status >= 500) {
      setConnection("服务暂不可用 · 可重试", false);
    }
    addMessage(messages[error.status] || "请求未能确认完成。输入内容仍然保留，请稍后重试。");
  } finally {
    busy = false;
    controls().forEach((control) => { control.disabled = false; });
  }
}

async function saveMemory() {
  const content = memoryInput.value.trim();
  if (!content) return;
  const updating = Boolean(editing);
  const data = await sessionRequest(
    updating ? "/v1/demo/memories/revise" : "/v1/demo/memories",
    { content, ...(editing ? { public_id: editing.id, revision: editing.revision } : {}) },
    { renew: !updating }
  );
  memories = data.memories;
  memoryInput.value = "";
  cancelEdit();
  renderMemories();
  clearTrace("记忆已变化，请重新提问");
  addMessage(updating
    ? "已保存更新，旧版本保留在「查看版本」里。"
    : "已添加到本次临时记忆。更正已有偏好时，请点击对应记忆的「更新这条」。");
}

async function runPrompt(query) {
  if (!query.trim()) return;
  lastQuery = query.trim();
  addMessage(lastQuery, "user");
  clearTrace("正在召回…");
  try {
    const data = await sessionRequest("/v1/demo/recall", { query: lastQuery });
    prompt.value = "";
    addMessage(data.answer);
    renderTrace(data);
    const state = data.retrieval;
    if (state && (!state.vector_enabled || state.vector_degraded || state.association_degraded ||
        state.index_pending || state.index_sync_failed)) {
      setConnection("Live · 检索能力暂不完整", false);
      addMessage("本次检索能力暂不完整：向量或联想不可用，或部分索引尚未完成。结果可能有遗漏。");
    }
  } catch (error) {
    clearTrace("召回未完成，请重试");
    throw error;
  }
}

async function showHistory(id) {
  const data = await sessionRequest("/v1/demo/memories/history", { public_id: id }, { renew: false });
  addMessage(data.versions.map((version) =>
    "v" + version.version + (version.status === "active" ? "（当前）" : "（历史）") + "：" + version.content
  ).join("\n"));
}

async function expandMemory(id) {
  const data = await sessionRequest("/v1/demo/expand", {
    public_id: id, query: lastQuery || "展开这条记忆", detail: "relevant_chunk",
  }, { renew: false });
  const target = traceList.querySelector(
    '[data-public-id="' + CSS.escape(id) + '"] .expanded-memory'
  );
  if (target) {
    target.hidden = false;
    target.textContent = data.expansion.excerpt || "没有更多可展示内容。";
  }
}

memoryForm.addEventListener("submit", (event) => {
  event.preventDefault();
  runAction(saveMemory);
});
$("#prompt-form").addEventListener("submit", (event) => {
  event.preventDefault();
  runAction(() => runPrompt(prompt.value));
});
$("#cancel-edit").addEventListener("click", () => {
  cancelEdit();
  memoryInput.value = "";
});
$("#clear-custom").addEventListener("click", () => runAction(async () => {
  if (!window.confirm("清空本次添加和更新的临时记忆及其所有版本，并恢复样板？")) return;
  const data = await sessionRequest("/v1/demo/memories/custom", {}, { method: "DELETE" });
  memories = data.memories;
  cancelEdit();
  renderMemories();
  clearTrace("临时改动已清空，请重新提问");
}));
$("#reset-demo").addEventListener("click", () => runAction(async () => {
  await createSession();
  await refreshMemories();
  cancelEdit();
  clearTrace("已开启新会话");
  addMessage("已重新开始。上次会话的数据会按临时保存期限清理。");
}));
memoryList.addEventListener("click", (event) => {
  const edit = event.target.closest("[data-edit]");
  const history = event.target.closest("[data-history]");
  if (edit && !busy) beginEdit(edit.dataset.edit);
  if (history) runAction(() => showHistory(history.dataset.history));
});
traceList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-expand]");
  if (button) runAction(() => expandMemory(button.dataset.expand));
});
document.querySelectorAll(".suggestions button").forEach((button) => {
  button.addEventListener("click", () => runAction(() => runPrompt(button.dataset.prompt)));
});
runAction(refreshMemories);
