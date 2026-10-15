import assert from "node:assert/strict";
import test from "node:test";
import { moduleUrl } from "./helpers/module-url.mjs";
const {chartExcelParts,chartExcelBytes,chartExcelFilename}=await import(moduleUrl("../../lib/chart-excel-export.ts"));
const points=[
 {supplierKey:"A1941",supplierLabel:"ISOVER",supplierCode:"A1941",period:"2025-11",globalVariation:2,weightedVariation:5},
 {supplierKey:"A1941",supplierLabel:"ISOVER",supplierCode:"A1941",period:"2026-01",globalVariation:0,weightedVariation:null},
 {supplierKey:"A1941",supplierLabel:"ISOVER",supplierCode:"A1941",period:"2026-02",globalVariation:null,weightedVariation:-1},
];
const info={title:"Variations",subtitle:"Historique & filtres",global:false,weighted:false,exportedAt:new Date("2026-10-15T22:30:00Z")};

test("annual means are formulas per view, linked from presentation, with separate years and blank guards",()=>{
 const p=chartExcelParts(points,info),sheet=p["xl/worksheets/sheet2.xml"],cover=p["xl/worksheets/sheet1.xml"];
 assert.match(sheet,/Moyennes par année/);
 assert.match(sheet,/<x:c r="A36" s="1"><x:v>2025<\/x:v>/);
 assert.match(sheet,/<x:c r="A37" s="1"><x:v>2026<\/x:v>/);
 assert.match(sheet,/COUNTIFS\(\$D\$29:\$D\$32,\$A36,\$B\$29:\$B\$32,&quot;&lt;&gt;&quot;\)/);
 assert.match(sheet,/SUMIFS\(\$B\$29:\$B\$32,\$D\$29:\$D\$32,\$A37\)/);
 assert.match(cover,/IF\(ISNUMBER\(&apos;GLOBAL &amp; pondérée - mois&apos;!B36\)/);
 assert.match(cover,/IF\(ISNUMBER\(&apos;GLOBAL &amp; pondérée - mois&apos;!B37\)/);
 assert.match(p["xl/worksheets/sheet4.xml"],/SUMIFS\(\$B\$29:\$B\$30/);
 assert.match(p["xl/worksheets/sheet6.xml"],/SUMIFS\(\$B\$29:\$B\$30/);
 const readCell=(source,address)=>source.match(new RegExp(`<x:c r="${address}"[^>]*>[\\s\\S]*?<\\/x:c>`))[0];
 assert.match(readCell(sheet,"B36"),/<x:v>0.02<\/x:v>/);
 assert.match(readCell(sheet,"B37"),/<x:v>0<\/x:v>/);
 assert.match(readCell(sheet,"C37"),/<x:v>-0.01<\/x:v>/);
 const missing=chartExcelParts(points.map(x=>({...x,weightedVariation:null})),info);
 assert.match(missing["xl/worksheets/sheet6.xml"],/<x:c r="B33" s="8" t="str"><x:f>IF\(COUNTIFS/);
});

test("every export contains presentation, five views, editable charts and navigation",()=>{
 const parts=chartExcelParts(points,info),cover=parts["xl/worksheets/sheet1.xml"];
 assert.equal((parts["xl/workbook.xml"].match(/<x:sheet /g)||[]).length,6);
 assert.equal(Object.keys(parts).filter(p=>/^xl\/drawings\/charts\/chart/.test(p)).length,5);
 assert.match(cover,/ISOVER/);assert.match(cover,/A1941/);assert.match(cover,/<x:c r="B5" s="4"><x:v>46311\.020833/);
 assert.equal((cover.match(/<x:hyperlink /g)||[]).length,5);
 for(let i=1;i<=5;i++){
  const chart=parts[`xl/drawings/charts/chart${i}.xml`],sheet=parts[`xl/worksheets/sheet${i+1}.xml`];
  assert.match(chart,/<c:barDir val="col"\/>/);assert.match(chart,/grouping val="clustered"/);assert.match(chart,/dispBlanksAs val="gap"/);
  assert.match(sheet,/location="&apos;Présentation&apos;!A1"/);
  assert.match(sheet,/COUNT\(B29:B\d+\)=0/);assert.match(sheet,/AVERAGE\(B29:B\d+\)/);
 }
 assert.match(parts["xl/workbook.xml"],/calcMode="auto"/);
});

test("all-month views preserve missing calendar months and genuine zero, variations views filter per series",()=>{
 const p=chartExcelParts(points,info);
 const full=p["xl/worksheets/sheet2.xml"];
 assert.match(full,/<x:c r="B29" s="8"><x:v>0.02/);
 assert.match(full,/<x:c r="B30" s="8"\/>/); // December gap
 assert.match(full,/<x:c r="B31" s="8"><x:v>0<\/x:v>/);
 assert.match(p["xl/tables/table1.xml"],/ref="A28:D32"/);
 assert.match(p["xl/tables/table2.xml"],/ref="A28:C32"/);
 assert.match(p["xl/tables/table3.xml"],/ref="A28:C30"/);
 assert.match(p["xl/worksheets/sheet4.xml"],/janv 2026/);assert.doesNotMatch(p["xl/worksheets/sheet4.xml"],/févr 2026/);
 assert.match(p["xl/worksheets/sheet6.xml"],/févr 2026/);assert.doesNotMatch(p["xl/worksheets/sheet6.xml"],/janv 2026/);
 assert.equal((p["xl/drawings/charts/chart1.xml"].match(/<c:ser>/g)||[]).length,2);
 assert.match(p["xl/drawings/charts/chart1.xml"],/087FA0/);assert.match(p["xl/drawings/charts/chart1.xml"],/B35C0C/);
 assert.match(p["xl/drawings/charts/chart2.xml"],/087FA0/);assert.match(p["xl/drawings/charts/chart4.xml"],/B35C0C/);
 assert.match(p["xl/worksheets/sheet1.xml"],/IF\(&apos;GLOBAL - variations&apos;!B5=/);
});

test("revision rule selects latest integration before exporting all views",()=>{
 const p=chartExcelParts([...points,{...points[0],globalVariation:10,weightedVariation:8,integratedAt:"2026-10-15"}],info);
 assert.match(p["xl/worksheets/sheet2.xml"],/<x:c r="B29" s="8"><x:v>0.1/);
 assert.doesNotMatch(p["xl/worksheets/sheet2.xml"],/<x:v>0.02<\/x:v>/);
});

test("missing entire series still exports blank averages and a blank editable table, never zero",()=>{
 const p=chartExcelParts(points.map(x=>({...x,weightedVariation:null})),info);
 const sheet=p["xl/worksheets/sheet6.xml"];
 assert.match(sheet,/<x:c r="B5" s="8" t="str"><x:f>IF\(COUNT\(B29:B29/);
 assert.match(p["xl/tables/table5.xml"],/ref="A28:C29"/);
 assert.doesNotMatch(sheet,/<x:v>0<\/x:v>/);
 assert.throws(()=>chartExcelParts([],info),/Aucune donnée/);
});

test("filename uses supplier, Code and Paris export date with safe characters",()=>{
 assert.equal(chartExcelFilename(points,info),"Point-marche_ISOVER_Code-A1941_2026-10-16_00-30.xlsx");
 assert.equal(chartExcelFilename(points,{...info,supplierLabel:"Établissements / Bois",supplierCode:"B7795"}),"Point-marche_Etablissements-Bois_Code-B7795_2026-10-16_00-30.xlsx");
});

test("labels are escaped literal text and the ZIP contains all workbook parts",()=>{
 const p=chartExcelParts(points,{...info,supplierLabel:"=HYPERLINK(\"bad\") <test>"});
 assert.match(p["xl/worksheets/sheet1.xml"],/&lt;test&gt;/);assert.doesNotMatch(p["xl/worksheets/sheet1.xml"],/<x:f>HYPERLINK/);
 const bytes=chartExcelBytes(points,info),view=new DataView(bytes.buffer);let offset=0;const names=[];
 while(view.getUint32(offset,true)===0x04034b50){
  const length=view.getUint32(offset+18,true),nameLength=view.getUint16(offset+26,true),extraLength=view.getUint16(offset+28,true);
  names.push(new TextDecoder().decode(bytes.slice(offset+30,offset+30+nameLength)));offset+=30+nameLength+extraLength+length;
 }
 assert.equal(view.getUint32(offset,true),0x02014b50);assert(names.includes("xl/worksheets/sheet6.xml"));assert(names.includes("xl/drawings/charts/chart5.xml"));
 assert.equal(view.getUint16(bytes.length-12,true),names.length);
});
