/** Raster images are resized and re-encoded locally; no executable SVG is embedded. */
export async function inlinePointImage(file: File): Promise<string> {
  if (!/^image\/(png|jpeg|webp|gif)$/.test(file.type)) throw new Error("Choisis une image PNG, JPEG, WebP ou GIF.");
  if (file.size > 10 * 1024 * 1024) throw new Error("Cette image dépasse 10 Mo.");
  const url = await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error("Lecture du fichier impossible."));reader.readAsDataURL(file);});
  const bitmap = await new Promise<HTMLImageElement>((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error("Cette image ne peut pas être lue. Essaie une version PNG ou JPEG."));img.src=url;});
  try {
    const ratio = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * ratio)); canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
    const context = canvas.getContext("2d"); if (!context) throw new Error("Lecture de l’image indisponible.");
    context.fillStyle = "#ffffff"; context.fillRect(0, 0, canvas.width, canvas.height); context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.85, 0.7, 0.5, 0.3]) { const url = canvas.toDataURL("image/jpeg", quality); if (url.length <= 200_000) return url; }
    throw new Error("Image trop détaillée. Choisis une version plus petite.");
  } finally { bitmap.src=""; }
}
