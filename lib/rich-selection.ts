export function formatSelection(root: HTMLElement, selected: Range | null, styles: Record<string, string>) {
  const range = selected && root.contains(selected.commonAncestorContainer) ? selected.cloneRange() : document.createRange();
  if (!selected || !root.contains(range.commonAncestorContainer) || range.collapsed) range.selectNodeContents(root);
  const content = range.extractContents();
  // A previous inner span must not override the newly selected format.
  if (Object.keys(styles).length) {
    content.querySelectorAll<HTMLElement>("[style]").forEach((node) => {
      for (const key of Object.keys(styles)) node.style.removeProperty(key);
      if (!node.style.cssText) node.removeAttribute("style");
    });
    const semantic = [styles["font-weight"] && "b,strong", styles["font-style"] && "i,em", styles["text-decoration"] && "u,s"].filter(Boolean).join(",");
    if (semantic) content.querySelectorAll(semantic).forEach((node) => node.replaceWith(...node.childNodes));
  }
  if (!Object.keys(styles).length) {
    content.querySelectorAll("[style]").forEach((node) => node.removeAttribute("style"));
    content.querySelectorAll("b,strong,i,em,u,s,font").forEach((node) => node.replaceWith(...node.childNodes));
  }
  const span = document.createElement("span");
  for (const [key, value] of Object.entries(styles)) span.style.setProperty(key, value);
  span.append(content);
  if (!span.childNodes.length) span.append(document.createTextNode("\u200B"));
  range.insertNode(span);
  range.selectNodeContents(span);
  const selection = window.getSelection(); selection?.removeAllRanges(); selection?.addRange(range);
  root.focus();
  return range.cloneRange();
}

export function insertSelectionHtml(root: HTMLElement, selected: Range | null, html: string) {
  const range = selected && root.contains(selected.commonAncestorContainer) ? selected.cloneRange() : document.createRange();
  if (!selected || !root.contains(range.commonAncestorContainer)) { range.selectNodeContents(root); range.collapse(false); }
  range.deleteContents();
  const template = document.createElement("template"); template.innerHTML = html;
  const fragment = template.content, last = fragment.lastChild;
  range.insertNode(fragment);
  if (last) range.setStartAfter(last);
  range.collapse(true);
  const selection = window.getSelection(); selection?.removeAllRanges(); selection?.addRange(range);
  root.focus();
  return range.cloneRange();
}
