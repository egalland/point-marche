import assert from "node:assert/strict";
import test from "node:test";
import { moduleUrl } from "./helpers/module-url.mjs";

const { activateDialog, isTopDialog } = await import(moduleUrl("../../lib/dialog-controller.ts"));

function environment() {
  const listeners = new Map();
  const timers = new Map();
  const document = {
    activeElement: null,
    body: { style: { overflow: "auto" } },
    defaultView: { setTimeout(callback) { const key = Symbol(); timers.set(key, callback); return key; }, clearTimeout(key) { timers.delete(key); } },
    addEventListener(type, listener) { const list = listeners.get(type) ?? new Set(); list.add(listener); listeners.set(type, list); },
    removeEventListener(type, listener) { listeners.get(type)?.delete(listener); },
  };
  const dispatch = (type, properties = {}) => {
    const event = { prevented: false, preventDefault() { this.prevented = true; }, stopPropagation() {}, ...properties };
    for (const listener of [...(listeners.get(type) ?? [])]) listener(event);
    return event;
  };
  const element = (options = {}) => ({
    ownerDocument: document, isConnected: true, children: [], tabIndex: 0, ...options,
    focus() { document.activeElement = this; dispatch("focusin", { target: this }); },
    contains(target) { return this === target || this.children.some((child) => child.contains(target)); },
    hasAttribute(name) { return name === "data-autofocus" && Boolean(this.autofocus); },
    closest() { return this.hidden ? this : null; },
    getClientRects() { return this.hidden ? [] : [{}]; },
    querySelectorAll() { return this.children; },
  });
  return { document, element, dispatch, flush() { const pending = [...timers.values()]; timers.clear(); pending.forEach((callback) => callback()); } };
}

test("nested dialogs retain scroll lock and Escape closes only the topmost window", (t) => {
  const env = environment();
  const trigger = env.element(); trigger.focus();
  const first = env.element({ children: [env.element({ autofocus: true })] });
  const second = env.element({ children: [env.element()] });
  let firstClosed = 0; let secondClosed = 0;
  const cleanupFirst = activateDialog(first, () => firstClosed++, () => false);
  t.after(cleanupFirst);
  env.flush();
  assert.equal(env.document.activeElement, first.children[0]);
  const cleanupSecond = activateDialog(second, () => secondClosed++, () => false);
  t.after(cleanupSecond);
  env.flush();
  assert.equal(env.document.activeElement, second.children[0]);
  assert.equal(env.document.body.style.overflow, "hidden");
  env.dispatch("keydown", { key: "Escape" });
  assert.equal(firstClosed, 0);
  assert.equal(secondClosed, 1);
  cleanupSecond();
  assert.equal(env.document.body.style.overflow, "hidden");
  assert.equal(env.document.activeElement, first.children[0]);
  assert.equal(isTopDialog(first), true);
  cleanupFirst();
  assert.equal(env.document.body.style.overflow, "auto");
  assert.equal(env.document.activeElement, trigger);
});

test("focus remains inside the window and Tab skips hidden controls", (t) => {
  const env = environment();
  const hidden = env.element({ hidden: true });
  const first = env.element(); const last = env.element();
  const panel = env.element({ children: [hidden, first, last] });
  const cleanup = activateDialog(panel, () => {}, () => false);
  t.after(cleanup);
  env.flush();
  assert.equal(env.document.activeElement, first);
  assert.equal(env.dispatch("keydown", { key: "Tab", shiftKey: true }).prevented, true);
  assert.equal(env.document.activeElement, last);
  env.dispatch("keydown", { key: "Tab", shiftKey: false });
  assert.equal(env.document.activeElement, first);
  env.element().focus();
  assert.equal(env.document.activeElement, first);
});

test("an empty dialog has a focus fallback and a busy action cannot close with Escape", (t) => {
  const env = environment();
  const panel = env.element();
  let closed = false;
  const cleanup = activateDialog(panel, () => { closed = true; }, () => true);
  t.after(cleanup);
  env.flush();
  assert.equal(env.document.activeElement, panel);
  assert.equal(env.dispatch("keydown", { key: "Tab" }).prevented, true);
  env.dispatch("keydown", { key: "Escape" });
  assert.equal(closed, false);
  cleanup(); cleanup();
  assert.equal(env.document.body.style.overflow, "auto");
});
