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
 for(const id of ids){const span=widths[id]==='quarter'?1:widths[id]==='half'?2:widths[id]==='three-quarters'||widths[id]==='two-thirds'?3:4;const width=span*300;if(x+width>1200){x=0;y+=rowHeight+24;rowHeight=0;}const height=id==='jira'?520:id==='dossiers'?600:480;result[id]=normalizeRect({x,y,width:width-(span===4?0:12),height});x+=width;rowHeight=Math.max(rowHeight,height);}
 return result;
}

export function orderedBlockIds(ids:string[], order:string[]=[]){const allowed=new Set(ids);return [...new Set([...order.filter(id=>allowed.has(id)),...ids])];}
export function reorderBlock(ids:string[],id:string,before:string|null){if(id===before||!ids.includes(id))return ids;const rest=ids.filter(v=>v!==id);const at=before?rest.indexOf(before):-1;rest.splice(at<0?rest.length:at,0,id);return rest;}
export function placeMissingBlocks(ids:string[], widths:Record<string,string>, saved:Record<string,BlockRect>){const defaults=initialRects(ids,widths);const result={...saved};let bottom=Math.max(0,...ids.filter(id=>result[id]).map(id=>result[id].y+result[id].height+24));for(const id of ids)if(!result[id]){result[id]=normalizeRect({...defaults[id],...(Object.keys(saved).length?{x:0,y:bottom}:{})});if(Object.keys(saved).length)bottom=result[id].y+result[id].height+24;}return result;}

// Only actual overlap is a collision: touching edges and user-chosen gaps are valid.
// Keep the manipulated block under the pointer; move intersecting neighbours below it.
export function arrangePresentationBlocks(ids:string[], blocks:Record<string,BlockRect>, anchor?:string):Record<string,BlockRect>{
 const result={...blocks},placed:BlockRect[]=[];
 const order=ids.filter(id=>blocks[id]).sort((a,b)=>blocks[a].y-blocks[b].y||blocks[a].x-blocks[b].x||ids.indexOf(a)-ids.indexOf(b));
 if(anchor&&order.includes(anchor)){order.splice(order.indexOf(anchor),1);order.unshift(anchor);}
 for(const id of order){const r={...blocks[id]};let hits:BlockRect[];
  while((hits=placed.filter(p=>r.x<p.x+p.width&&r.x+r.width>p.x&&r.y<p.y+p.height&&r.y+r.height>p.y)).length)r.y=Math.max(...hits.map(p=>p.y+p.height));
  result[id]=r;placed.push(r);
 }
 return result;
}

export type ResizeEdge='n'|'s'|'e'|'w'|'ne'|'nw'|'se'|'sw';
export function resizeFromEdge(rect:BlockRect,dx:number,dy:number,edge:ResizeEdge):BlockRect{
 const right=rect.x+rect.width,bottom=rect.y+rect.height;
 const x=edge.includes('w')?Math.max(0,Math.min(right-240,rect.x+dx)):rect.x;
 const y=edge.includes('n')?Math.max(0,Math.min(bottom-144,rect.y+dy)):rect.y;
 const width=edge.includes('w')?right-x:edge.includes('e')?Math.max(240,Math.min(CANVAS_WIDTH-x,rect.width+dx)):rect.width;
 const height=edge.includes('n')?bottom-y:edge.includes('s')?Math.max(144,Math.min(10000,rect.height+dy)):rect.height;
 return normalizeRect({x,y,width,height});
}
export function alignPresentationRect(raw:BlockRect,neighbours:BlockRect[],edge:ResizeEdge|null,snap:boolean,threshold=10){
 let rect={...raw};const guides:{x?:number;y?:number}={};
 if(!snap)return {rect,guides};
 for(const axis of ['x','y'] as const){
  const size=axis==='x'?'width':'height',start=edge?.includes(axis==='x'?'w':'n'),end=edge?.includes(axis==='x'?'e':'s');
  if(edge&&!start&&!end)continue;
  const offsets=edge?[start?0:rect[size]]:[0,rect[size]/2,rect[size]];
  const targets=[...(axis==='x'?[0,CANVAS_WIDTH/2,CANVAS_WIDTH]:[0]),...neighbours.flatMap(p=>[p[axis],p[axis]+p[size]/2,p[axis]+p[size]])];
  let best:{delta:number;target:number}|null=null;
  // Prefer docking to the opposing edge of a nearby block over centre/grid alignment.
  const other=axis==='x'?'y':'x',otherSize=axis==='x'?'height':'width';
  for(const p of neighbours){
   if(rect[other]>=p[other]+p[otherSize]||rect[other]+rect[otherSize]<=p[other])continue;
   const contacts=edge?(start?[{offset:0,target:p[axis]+p[size]}]:[{offset:rect[size],target:p[axis]}]):[{offset:0,target:p[axis]+p[size]},{offset:rect[size],target:p[axis]}];
   for(const {offset,target} of contacts){const delta=target-(rect[axis]+offset);if(Math.abs(delta)<=threshold&&(!best||Math.abs(delta)<Math.abs(best.delta)))best={delta,target};}
  }
  if(!best)for(const offset of offsets)for(const target of targets){const delta=target-(rect[axis]+offset);if(Math.abs(delta)<=threshold&&(!best||Math.abs(delta)<Math.abs(best.delta)))best={delta,target};}
  const delta=best?best.delta:Math.round((rect[axis]+(edge&&end?rect[size]:0))/GRID_STEP)*GRID_STEP-(rect[axis]+(edge&&end?rect[size]:0));
  const proposed=edge?resizeFromEdge(rect,axis==='x'?delta:0,axis==='y'?delta:0,edge):normalizeRect({...rect,[axis]:rect[axis]+delta});
  const movedEdge=proposed[axis]+(edge&&end?proposed[size]:0),rawEdge=rect[axis]+(edge&&end?rect[size]:0);
  rect=proposed;if(best&&Math.abs(movedEdge-rawEdge-best.delta)<0.01)guides[axis]=best.target;
 }
 return {rect,guides};
}

/** Remove vertical gaps without changing columns, dimensions or the order within a column. */
export function compactPresentationBlocks(ids:string[],blocks:Record<string,BlockRect>):Record<string,BlockRect>{
 const result={...blocks},placed:BlockRect[]=[];
 const order=ids.filter(id=>blocks[id]).sort((a,b)=>blocks[a].y-blocks[b].y||blocks[a].x-blocks[b].x||ids.indexOf(a)-ids.indexOf(b));
 for(const id of order){const original=blocks[id];const above=placed.filter(p=>original.x<p.x+p.width&&original.x+original.width>p.x);const rect={...original,y:Math.max(0,...above.map(p=>p.y+p.height))};result[id]=rect;placed.push(rect);}return result;
}

export type BlockSplit = 'columns' | 'rows' | 'wide-left';
/** Dock a chosen pair without discarding other block coordinates or content. */
export function splitBlockPair(blocks:Record<string,BlockRect>,first:string,second:string,kind:BlockSplit='columns',reverse=false):Record<string,BlockRect>{
 if(first===second||!blocks[first]||!blocks[second])return {...blocks};
 const a=blocks[first],b=blocks[second],gap=16,y=Math.min(a.y,b.y),height=Math.max(a.height,b.height);
 let left:BlockRect,right:BlockRect;
 if(kind==='rows'){
  const h=Math.max(144,Math.round((Math.max(a.y+a.height,b.y+b.height)-y-gap)/2));
  left=normalizeRect({x:0,y,width:CANVAS_WIDTH,height:h});right=normalizeRect({x:0,y:y+h+gap,width:CANVAS_WIDTH,height:h});
 }else{
  const width=kind==='wide-left'?Math.round((CANVAS_WIDTH-gap)*2/3):(CANVAS_WIDTH-gap)/2;
  left=normalizeRect({x:0,y,width,height});right=normalizeRect({x:width+gap,y,width:CANVAS_WIDTH-gap-width,height});
 }
 return {...blocks,[first]:reverse?right:left,[second]:reverse?left:right};
}

/** Market points now share one window layout; old flow preferences remain readable as windows. */
export function normalizePointWindowLayout(value:unknown):FreeLayout{return {...normalizeFreeLayout(value),mode:'windows',flow:false};}

export type DockZone = { id:string; label:string; x:number; width:number };
export const pointDockZones:DockZone[] = [
 {id:'full',label:'Pleine largeur',x:0,width:1200},
 {id:'half-left',label:'Moitié gauche',x:0,width:592},
 {id:'half-right',label:'Moitié droite',x:608,width:592},
 {id:'third-left',label:'Tiers gauche',x:0,width:389},
 {id:'third-middle',label:'Tiers central',x:405,width:390},
 {id:'third-right',label:'Tiers droit',x:811,width:389},
];
/** A slight crossing cannot displace a neighbour. Deliberate depth or a hold commits on release. */
export function resistedDrop(initial:BlockRect,candidate:BlockRect,neighbours:BlockRect[],heldMs:number):BlockRect{
 const hits=neighbours.filter(p=>candidate.x<p.x+p.width&&candidate.x+candidate.width>p.x&&candidate.y<p.y+p.height&&candidate.y+candidate.height>p.y);
 const deliberate=hits.every(p=>Math.min(candidate.x+candidate.width-p.x,p.x+p.width-candidate.x,candidate.y+candidate.height-p.y,p.y+p.height-candidate.y)>=36);
 return hits.length&&!deliberate&&heldMs<450?initial:candidate;
}
