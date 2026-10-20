import assert from "node:assert/strict";
import test from "node:test";
import { moduleUrl } from "./helpers/module-url.mjs";
const { chartImageSvg, chartPngBlob } = await import(moduleUrl("../../lib/chart-image-export.ts"));

test("mail image has a white background, complete dimensions and escaped filter labels", () => {
  const result = chartImageSvg('<svg viewBox="0 0 1180 340"><rect class="supplier-chart-bar weighted"/></svg>', 1180, 340, { title: "Variation moyenne", subtitle: 'Menuiserie & bois <test> "A"', global: true, weighted: true });
  assert.equal(result.width,1180); assert(result.height>340);
  assert.match(result.svg,/fill="#ffffff"/);
  assert.match(result.svg,/Menuiserie &amp; bois &lt;test&gt; &quot;A&quot;/);
  assert.match(result.svg,/#087fa0/); assert.match(result.svg,/#b35c0c/);
  assert.match(result.svg,/Variation pondérée/);
  const global = chartImageSvg("<svg/>",680,340,{title:"Titre",subtitle:"",global:true,weighted:false});
  assert.doesNotMatch(global.svg,/Variation pondérée/);
});

test("PNG conversion uses double resolution and releases its object URL on success or failure", async () => {
  const saved = Object.fromEntries(["Image","XMLSerializer","document"].map(k=>[k,globalThis[k]]));
  const originalCreate=URL.createObjectURL,originalRevoke=URL.revokeObjectURL;
  const released=[];let canvas;let fail=false;
  try {
    URL.createObjectURL=()=>"blob:chart";URL.revokeObjectURL=url=>released.push(url);
    globalThis.XMLSerializer=class{serializeToString(){return '<svg viewBox="0 0 680 340"/>';}};
    globalThis.Image=class{set src(value){queueMicrotask(()=>fail?this.onerror():this.onload());}};
    globalThis.document={createElement:()=>canvas={width:0,height:0,getContext:()=>({drawImage(){}}),toBlob:fn=>fn(new Blob(["png"],{type:"image/png"}))}};
    const element={viewBox:{baseVal:{width:680,height:340}},cloneNode:()=>({setAttribute(){},removeAttribute(){}})};
    const info={title:"Titre",subtitle:"Période",global:true,weighted:true};
    const blob=await chartPngBlob(element,info);assert.equal(blob.type,"image/png");assert.equal(canvas.width,1360);assert(canvas.height>680);assert.equal(released.length,1);
    fail=true;await assert.rejects(chartPngBlob(element,info),/convertir/);assert.equal(released.length,2);
  } finally {
    for(const [key,value] of Object.entries(saved)) {if(value===undefined)delete globalThis[key];else globalThis[key]=value;}
    URL.createObjectURL=originalCreate;URL.revokeObjectURL=originalRevoke;
  }
});
