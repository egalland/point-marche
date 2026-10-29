/** Raster images are resized and re-encoded locally; no executable SVG is embedded. */
export async function inlinePointImage(file: File): Promise<string> {
  if (!/^image\/(png|jpeg|webp|gif)$/.test(file.type)) throw new Error("En local, choisis une image PNG, JPEG, WebP ou GIF.");
  if (file.size > 10 * 1024 * 1024) throw new Error("Cette image dépasse 10 Mo.");
  const bitmap = await createImageBitmap(file);
  try {
    const ratio = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * ratio)); canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
    const context = canvas.getContext("2d"); if (!context) throw new Error("Lecture de l’image indisponible.");
    context.fillStyle = "#ffffff"; context.fillRect(0, 0, canvas.width, canvas.height); context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.85, 0.7, 0.5, 0.3]) { const url = canvas.toDataURL("image/jpeg", quality); if (url.length <= 200_000) return url; }
    throw new Error("Image trop détaillée. Choisis une version plus petite.");
  } finally { bitmap.close(); }
}
