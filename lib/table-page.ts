export function tablePage(total: number, requestedPage: number, requestedSize = 100) {
  const size = Number.isFinite(requestedSize) ? Math.max(1, Math.floor(requestedSize)) : 100;
  const count = Number.isFinite(total) ? Math.max(0, Math.floor(total)) : 0;
  const pages = Math.max(1, Math.ceil(count / size));
  const page = Number.isFinite(requestedPage) ? Math.min(pages, Math.max(1, Math.floor(requestedPage))) : 1;
  const start = (page - 1) * size;
  return { page, pages, start, end: Math.min(count, start + size), total: count };
}
