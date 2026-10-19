export type BlockRect = { x: number; y: number; width: number; height: number };
export type FreeLayout = { mode?: "windows" | "flow"; flow?: boolean; order?: string[]; enabled: boolean; snap: boolean; showGrid: boolean; blocks: Record<string, BlockRect>; titles: Record<string,string>; copies: { id: string; title: string; html: string }[] };
export const CANVAS_WIDTH = 1200;
export const GRID_STEP = 24;
export function normalizeRect(value: Partial<BlockRect>): BlockRect {
  const finite = (v: unknown, fallback: number) => typeof v === 'number' && Number.isFinite(v) ? v : fallback;
  const width = Math.max(240, Math.min(CANVAS_WIDTH, finite(value.width, 576)));
  return { x: Math.max(0, Math.min(CANVAS_WIDTH-width, finite(value.x, 0))), y: Math.max(0, Math.min(50000, finite(value.y, 0))), width, height: Math.max(144, Math.min(10000, finite(value.height, 480))) };
}
export function normalizeFreeLayout(value: unknown): FreeLayout {
  const v = value && typeof value === 'object' ? value as Partial<FreeLayout> : {};
  return { mode: v.mode === "flow" ? "flow" : "windows", flow: v.mode === "flow", order: Array.isArray(v.order) ? [...new Set(v.order.filter(id=>typeof id==='string'))] : [], enabled: v.enabled !== false, snap: v.snap !== false, showGrid: v.showGrid !== false,
    blocks: Object.fromEntries(Object.entries(v.blocks ?? {}).filter(([,r])=>r && typeof r==='object').map(([id,r])=>[id,normalizeRect(r)])),
    titles: Object.fromEntries(Object.entries(v.titles ?? {}).filter(([,t])=>typeof t==='string').map(([id,t])=>[id,t.slice(0,120)])),
    copies: Array.isArray(v.copies) ? v.copies.filter(c=>c && typeof c.id==='string' && typeof c.html==='string').slice(0,40).map(c=>({id:c.id,title:String(c.title||'Copie').slice(0,120),html:c.html})) : [] };
}
export function changeRect(rect: BlockRect, dx: number, dy: number, resize: boolean, snap: boolean): BlockRect {
  const round = (n:number)=>snap ? Math.round(n/GRID_STEP)*GRID_STEP : Math.round(n);
  return normalizeRect(resize ? {...rect,width:round(rect.width+dx),height:round(rect.height+dy)} : {...rect,x:round(rect.x+dx),y:round(rect.y+dy)});
}
export function initialRects(ids: string[], widths: Record<string,string>): Record<string,BlockRect> {
 const result:Record<string,BlockRect>={};let x=0,y=0,rowHeight=0;
 for(const id of ids){const span=widths[id]==='quarter'?1:widths[id]==='half'?2:widths[id]==='three-quarters'||widths[id]==='two-thirds'?3:4;const width=span*300;if(x+width>1200){x=0;y+=rowHeight+24;rowHeight=0;}const height=id==='jira'?840:id==='dossiers'?600:480;result[id]=normalizeRect({x,y,width:width-(span===4?0:12),height});x+=width;rowHeight=Math.max(rowHeight,height);}
 return result;
}

export function orderedBlockIds(ids:string[], order:string[]=[]){const allowed=new Set(ids);return [...new Set([...order.filter(id=>allowed.has(id)),...ids])];}
export function reorderBlock(ids:string[],id:string,before:string|null){if(id===before||!ids.includes(id))return ids;const rest=ids.filter(v=>v!==id);const at=before?rest.indexOf(before):-1;rest.splice(at<0?rest.length:at,0,id);return rest;}
export function placeMissingBlocks(ids:string[], widths:Record<string,string>, saved:Record<string,BlockRect>){const defaults=initialRects(ids,widths);const result={...saved};let bottom=Math.max(0,...ids.filter(id=>result[id]).map(id=>result[id].y+result[id].height+24));for(const id of ids)if(!result[id]){result[id]=normalizeRect({...defaults[id],...(Object.keys(saved).length?{x:0,y:bottom}:{})});if(Object.keys(saved).length)bottom=result[id].y+result[id].height+24;}return result;}
