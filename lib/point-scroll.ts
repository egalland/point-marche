/** Relay vertical wheel input only when a fixed point viewport has reached its edge. */
export function relayPointWheel(event: WheelEvent) {
  if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.shiftKey || !event.deltaY || Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return false;
  const target = event.target as Element | null;
  if (!target?.closest || target.closest('input,select')) return false;
  const viewport = target.closest<HTMLElement>('.v51-content');
  if (!viewport || viewport.hidden) return false;
  const doc = viewport.ownerDocument, view = doc.defaultView;
  if (!view || !['auto', 'scroll'].includes(view.getComputedStyle(viewport).overflowY) || viewport.scrollHeight <= viewport.clientHeight) return false;
  const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? viewport.clientHeight : 1);
  const canScroll = (node: HTMLElement) => delta > 0 ? node.scrollTop + node.clientHeight < node.scrollHeight - 1 : node.scrollTop > 1;
  // Preserve scrolling inside text areas and horizontally scrollable tables.
  for (let node = target as HTMLElement; node; node = node.parentElement!) {
    if (['auto', 'scroll'].includes(view.getComputedStyle(node).overflowY) && canScroll(node)) return false;
    if (node === viewport) break;
  }
  for (let node = viewport.parentElement; node; node = node.parentElement) {
    if (node === doc.body || node === doc.documentElement) break;
    if (['auto', 'scroll'].includes(view.getComputedStyle(node).overflowY) && canScroll(node)) {
      event.preventDefault(); node.scrollBy({ top: delta, behavior: 'instant' }); return true;
    }
  }
  const page = doc.scrollingElement as HTMLElement | null;
  if (!page || !canScroll(page)) return false;
  event.preventDefault(); page.scrollBy({ top: delta, behavior: 'instant' }); return true;
}
