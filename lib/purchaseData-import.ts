export const PURCHASES_MAX_BYTES = 32 * 1024 * 1024;
export const PURCHASES_MAX_ROWS = 100_000;
export function purchaseDataTable(text: string): string[][] {
  const source = text.replace(/^\uFEFF/, '');
  const header = source.split(/\r?\n/, 25).find(line => /Cd Fournisseur/i.test(line)) ?? source.split(/\r?\n/, 1)[0];
  const sep = header.includes('\t') ? '\t' : header.includes(';') ? ';' : ',';
  const rows:string[][]=[];let row:string[]=[],parts:string[]=[],start=0,quoted=false;
  function cell(end:number){const tail=source.slice(start,end);row.push((parts.length?parts.join('')+tail:tail).trim());parts=[];start=end+1;}
  for(let i=0;i<source.length;i++){
    const c=source[i];
    if(c==='"'&&(quoted||!source.slice(start,i).trim())){
      parts.push(source.slice(start,i));
      if(quoted&&source[i+1]==='"'){parts.push('"');i++;start=i+1;}else{quoted=!quoted;start=i+1;}
    }else if(c===sep&&!quoted)cell(i);
    else if((c==='\n'||c==='\r')&&!quoted){cell(i);if(c==='\r'&&source[i+1]==='\n'){i++;start=i+1;}if(row.some(Boolean))rows.push(row);row=[];}
  }
  if(quoted)throw Error('Guillemet non fermé dans le tableau. Vérifie le CSV ou recopie le tableau complet.');
  cell(source.length);if(row.some(Boolean))rows.push(row);return rows;
}

export function decodePURCHASESFile(bytes: Uint8Array): string {
  if (bytes[0] === 255 && bytes[1] === 254) return new TextDecoder('utf-16le').decode(bytes);
  if (bytes[0] === 254 && bytes[1] === 255) return new TextDecoder('utf-16be').decode(bytes);
  try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { return new TextDecoder('windows-1252').decode(bytes); }
}
