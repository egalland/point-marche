import assert from "node:assert/strict";
import test from "node:test";
import { moduleUrl } from "./helpers/module-url.mjs";
const {chartExcelParts,chartExcelBytes}=await import(moduleUrl("../../lib/chart-excel-export.ts"));
const points=[
 {period:"2025-11",globalVariation:.9,weightedVariation:1.52},
 {period:"2025-12",globalVariation:null,weightedVariation:-2},
 {period:"2026-01",globalVariation:0,weightedVariation:null},
];
const info={title:"Variation moyenne",subtitle:"Novembre — janvier · Menuiserie & bois",global:true,weighted:true};

test("Excel has typed percentages, genuine blanks, filter context and linked native columns",()=>{
 const parts=chartExcelParts(points,info),sheet=parts['xl/worksheets/sheet1.xml'],chart=parts['xl/drawings/charts/chart1.xml'];
 assert.match(sheet,/Menuiserie &amp; bois/);assert.match(sheet,/<x:c r="B27" s="4"><x:v>0.009/);
 assert.match(sheet,/<x:c r="B28" s="4"\/>/);assert.match(sheet,/<x:c r="B29" s="4"><x:v>0<\/x:v>/);
 assert.match(chart,/<c:barDir val="col"\/>/);assert.match(chart,/grouping val="clustered"/);
 assert.equal((chart.match(/<c:ser>/g)||[]).length,2);
 assert.match(chart,/'Variations'!\$B\$27:\$B\$29/);assert.match(chart,/'Variations'!\$C\$27:\$C\$29/);
 assert.match(chart,/<c:dispBlanksAs val="gap"/);assert.match(chart,/087FA0/);assert.match(chart,/B35C0C/);
 assert.match(parts['xl/tables/table1.xml'],/ref="A26:C29"/);
});

test("Excel respects visible series and uses the entire selected period",()=>{
 const parts=chartExcelParts(points,{...info,global:false});const chart=parts['xl/drawings/charts/chart1.xml'];
 assert.equal((chart.match(/<c:ser>/g)||[]).length,1);assert.doesNotMatch(chart,/Variation GLOBAL/);
 assert.match(chart,/'Variations'!\$B\$27:\$B\$29/);assert.match(parts['xl/tables/table1.xml'],/ref="A26:B29"/);
 assert.match(parts['xl/worksheets/sheet1.xml'],/1.52|0.0152/);
 const annual=chartExcelParts(Array.from({length:12},(_,i)=>({...points[0],period:`2026-${String(i+1).padStart(2,'0')}`})),info);
 assert.match(annual['xl/tables/table1.xml'],/ref="A26:C38"/);assert.match(annual['xl/drawings/charts/chart1.xml'],/\$B\$38/);
});

test("Excel packages the template and dynamic data in a complete UTF-8 ZIP",()=>{
 const bytes=chartExcelBytes(points,info),view=new DataView(bytes.buffer);let offset=0;const names=[];
 while(view.getUint32(offset,true)===0x04034b50){
  const length=view.getUint32(offset+18,true),nameLength=view.getUint16(offset+26,true),extraLength=view.getUint16(offset+28,true);
  names.push(new TextDecoder().decode(bytes.slice(offset+30,offset+30+nameLength)));
  offset+=30+nameLength+extraLength+length;
 }
 assert.equal(view.getUint32(offset,true),0x02014b50);assert(names.includes('[Content_Types].xml'));assert(names.includes('xl/drawings/charts/chart1.xml'));
 assert.equal(view.getUint32(bytes.length-22,true),0x06054b50);assert.equal(view.getUint16(bytes.length-12,true),names.length);
});

test("empty exports are rejected and labels are never written as formulas",()=>{
 assert.throws(()=>chartExcelParts([],info),/Aucune donnée/);
 assert.throws(()=>chartExcelParts(points,{...info,global:false,weighted:false}),/Aucune donnée/);
 const parts=chartExcelParts(points,{...info,title:'=HYPERLINK("bad") <test>'});
 const sheet=parts['xl/worksheets/sheet1.xml'];assert.doesNotMatch(sheet,/<x:f>/);assert.match(sheet,/&lt;test&gt;/);assert.match(sheet,/t="inlineStr"/);
});
