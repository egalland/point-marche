import { appFetch } from "./app-transport";
import type { PointAttachment } from "./point-rich-content";
export async function uploadPointAsset(file: File): Promise<PointAttachment> {
  if (file.size > 10 * 1024 * 1024) throw new Error("Ce fichier dépasse 10 Mo. Ajoute une version plus légère.");
  const form = new FormData(); form.append("file", file);
  const response = await appFetch("/api/point-assets", { method: "POST", body: form });
  const payload = await response.json();
  if (!response.ok || !payload.asset) throw new Error(payload.error || "Le fichier n’a pas pu être enregistré.");
  return payload.asset;
}
