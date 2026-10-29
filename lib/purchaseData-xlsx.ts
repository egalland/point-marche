/** Read an XLSX locally, without executing formulas or loading macros. */
import { PURCHASES_MAX_BYTES, PURCHASES_MAX_ROWS } from "./purchaseData-import";
const MAX_XML_BYTES = 96 * 1024 * 1024;
export async function readBoundedXlsxBytes(stream: ReadableStream<Uint8Array>, limit = MAX_XML_BYTES) {
 const reader = stream.getReader(), chunks: Uint8Array[] = []; let size = 0;
 try { while (true) { const next = await reader.read(); if (next.done) break; size += next.value.byteLength;
  if (size > limit) { await reader.cancel(); throw Error('Onglet décompressé trop volumineux (96 Mio maximum).'); }
  chunks.push(next.value);
 } } finally { reader.releaseLock(); }
 const bytes = new Uint8Array(size); let at = 0; for (const chunk of chunks) { bytes.set(chunk,at); at += chunk.byteLength; } return bytes;
}
type Entry={method:number;offset:number;size:number;uncompressed:number};
const decoder=new TextDecoder();
export const xmlText=(s:string)=>s.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos);/gi,(_,v:string)=>v[0]==='#'?String.fromCodePoint(v[1].toLowerCase()==='x'?parseInt(v.slice(2),16):parseInt(v.slice(1),10)):({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"}[v]??''));
const attributes=(s:string)=>Object.fromEntries([...s.matchAll(/([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)].map(m=>[m[1],xmlText(m[2]??m[3])]));
const tags=(s:string,name:string)=>[...s.matchAll(new RegExp(`<(?:[\\w]+:)?${name}\\b([^>]*?)(?:\\/>|>([\\s\\S]*?)<\\/(?:[\\w]+:)?${name}>)`,'g'))];
const texts=(s:string)=>tags(s,'t').map(m=>xmlText(m[2]??'')).join('');
export async function openPURCHASESWorkbook(bytes:Uint8Array){
 if(bytes.length>PURCHASES_MAX_BYTES)throw Error('Classeur trop volumineux (32 Mio maximum).');
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),entries=new Map<string,Entry>();let eocd=-1;
 for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--)if(view.getUint32(i,true)===0x06054b50){eocd=i;break;}
 if(eocd<0)throw Error('Classeur XLSX invalide ou chiffré. Utilise un XLSX non protégé ou un CSV.');
 const count=view.getUint16(eocd+10,true);let at=view.getUint32(eocd+16,true);
 for(let i=0;i<count;i++){
 if(at+46>bytes.length||view.getUint32(at,true)!==0x02014b50)throw Error('Archive Excel invalide.');
 const method=view.getUint16(at+10,true),size=view.getUint32(at+20,true),uncompressed=view.getUint32(at+24,true),len=view.getUint16(at+28,true),extra=view.getUint16(at+30,true),comment=view.getUint16(at+32,true),offset=view.getUint32(at+42,true),name=decoder.decode(bytes.subarray(at+46,at+46+len));
 if(at+46+len+extra+comment>eocd||offset+30>bytes.length||entries.has(name)||view.getUint32(offset,true)!==0x04034b50)throw Error('Archive Excel invalide.');
 entries.set(name,{method,size,uncompressed,offset});at+=46+len+extra+comment;
 }
 async function read(path:string){const e=entries.get(path);if(!e)return '';if(e.uncompressed>MAX_XML_BYTES)throw Error('Onglet décompressé trop volumineux (96 Mio maximum).');const start=e.offset+30+view.getUint16(e.offset+26,true)+view.getUint16(e.offset+28,true);if(start+e.size>view.getUint32(eocd+16,true))throw Error('Archive Excel tronquée.');const data=bytes.slice(start,start+e.size);if(e.method===0){if(data.length!==e.uncompressed)throw Error('Taille de fichier Excel incohérente.');return decoder.decode(data);}if(e.method!==8)throw Error('Compression Excel non prise en charge.');let expanded:Uint8Array;try{const stream=new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));expanded=await readBoundedXlsxBytes(stream);}catch(error){if(error instanceof Error&&/volumineux/.test(error.message))throw error;throw Error('Décompression Excel impossible. Essaie Edge/Chrome à jour ou un export CSV.');}if(expanded.length!==e.uncompressed)throw Error('Taille de fichier Excel incohérente.');return decoder.decode(expanded);}
 const workbook=await read('xl/workbook.xml'),rels=await read('xl/_rels/workbook.xml.rels');if(!workbook||!rels)throw Error('Structure XLSX introuvable.');
 const targets=new Map(tags(rels,'Relationship').map(m=>{const a=attributes(m[1]);return [a.Id,a.Target];}));
 const sheets=tags(workbook,'sheet').map(m=>{const a=attributes(m[1]),target=targets.get(a['r:id']);return {name:a.name,path:target?.startsWith('/')?target.slice(1):`xl/${target??''}`};});
 let shared:string[]|null=null;const date1904=/date1904=["'](?:1|true)["']/.test(workbook);
 return {sheets: sheets.map(s=>s.name),async text(name:string){const sheet=sheets.find(s=>s.name===name);if(!sheet)throw Error('Onglet introuvable.');if(shared===null){const xml=await read('xl/sharedStrings.xml');shared=tags(xml,'si').map(m=>texts(m[2]??''));}const xml=await read(sheet.path);if(!xml)throw Error('Cet onglet est vide ou non lisible.');const rows:string[][]=[];
 for(const row of tags(xml,'row')){if(rows.length>=PURCHASES_MAX_ROWS+25)throw Error('Cet onglet dépasse la limite de 100 000 lignes.');const values:string[]=[];for(const cell of tags(row[2]??'','c')){const a=attributes(cell[1]),letters=a.r?.match(/^[A-Z]+/)?.[0]??'';let index=0;for(const c of letters)index=index*26+c.charCodeAt(0)-64;index=Math.max(0,index-1);if(index>=16384)throw Error('Adresse de cellule Excel invalide.');const v=tags(cell[2]??'','v')[0]?.[2]??'';values[index]=a.t==='s'?shared[Number(v)]??'':a.t==='inlineStr'?texts(cell[2]??''):xmlText(v);}rows.push(values);}
 const h=rows.findIndex(r=>r.includes('Cd Fournisseur'));if(h>=0&&date1904){const dates=rows[h].map((v,i)=>/^(Extrait le|Date facture|Date CdA|Date échéance)$/.test(v)?i:-1).filter(i=>i>=0);for(let i=h+1;i<rows.length;i++)for(const col of dates)if(/^\d+(?:\.\d+)?$/.test(rows[i][col]??''))rows[i][col]=String(Number(rows[i][col])+1462);}
 return rows.map(r=>Array.from({length:r.length},(_,i)=>{const v=r[i]??'';return /["\t\r\n]/.test(v)?`"${v.replaceAll('"','""')}"`:v;}).join('\t')).join('\n');}};
}
