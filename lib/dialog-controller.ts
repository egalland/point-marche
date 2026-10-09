type DialogEntry = { panel: HTMLElement; document: Document };
const dialogs: DialogEntry[] = [];
let previousOverflow = "";

export function isTopDialog(panel: HTMLElement | null) {
  return Boolean(panel && dialogs.at(-1)?.panel === panel);
}

function focusableItems(panel: HTMLElement) {
  return Array.from(panel.querySelectorAll<HTMLElement>("button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href], [tabindex]:not([tabindex='-1'])"))
    .filter((element) => element.tabIndex >= 0 && !element.closest("[hidden], [inert]") && element.getClientRects().length > 0);
}

function focusFirst(panel: HTMLElement) {
  const items = focusableItems(panel);
  const target = items.find((element) => element.hasAttribute("data-autofocus")) ?? items[0] ?? panel;
  target.focus({ preventScroll: true });
}

export function activateDialog(panel: HTMLElement, onClose: () => void, isBusy: () => boolean) {
  const document = panel.ownerDocument;
  const window = document.defaultView;
  if (!window) return () => {};
  const previousFocus = document.activeElement as HTMLElement | null;
  if (!dialogs.length) {
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
  const entry = { panel, document };
  dialogs.push(entry);
  const focusTimer = window.setTimeout(() => { if (isTopDialog(panel)) focusFirst(panel); }, 0);
  const onKeyDown = (event: KeyboardEvent) => {
    if (!isTopDialog(panel)) return;
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      if (!isBusy()) onClose();
      return;
    }
    if (event.key !== "Tab") return;
    const items = focusableItems(panel);
    const first = items[0] ?? panel;
    const last = items.at(-1) ?? panel;
    if (!items.length || !panel.contains(document.activeElement) || document.activeElement === panel) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
    } else if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };
  const onFocusIn = (event: FocusEvent) => {
    if (isTopDialog(panel) && !panel.contains(event.target as Node)) focusFirst(panel);
  };
  document.addEventListener("keydown", onKeyDown, true);
  document.addEventListener("focusin", onFocusIn);
  let disposed = false;
  return () => {
    if (disposed) return;
    disposed = true;
    const wasTop = isTopDialog(panel);
    window.clearTimeout(focusTimer);
    document.removeEventListener("keydown", onKeyDown, true);
    document.removeEventListener("focusin", onFocusIn);
    const index = dialogs.indexOf(entry);
    if (index !== -1) dialogs.splice(index, 1);
    if (!dialogs.length) document.body.style.overflow = previousOverflow;
    if (!wasTop) return;
    const remaining = dialogs.at(-1)?.panel;
    if (previousFocus?.isConnected && (!remaining || remaining.contains(previousFocus))) previousFocus.focus({ preventScroll: true });
    else if (remaining) focusFirst(remaining);
  };
}
