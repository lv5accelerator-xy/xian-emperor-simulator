"use strict";
const fs=require("node:fs"),path=require("node:path"),assert=require("node:assert/strict"),crypto=require("node:crypto");
const {resume,CORE}=require("../tests/lord-command-chain-regression");
const [baseline,candidate,output]=process.argv.slice(2);
assert.ok(baseline&&candidate&&output,"usage: node scripts/diplomatic-archive-audit.cjs baseline-directory candidate-directory output.json");
const normalize=value=>JSON.parse(JSON.stringify(value,(k,v)=>["updatedAt","exportedAt"].includes(k)?"<time>":v));
const results=[];
for(const dir of [baseline,candidate]){
 const data=JSON.parse(fs.readFileSync(path.join(dir,"balance.json")));assert.equal(data.rows.length,45);
 for(const row of data.rows){
  const file=path.join(dir,row.finalSave),bytes=fs.readFileSync(file),bundle=JSON.parse(bytes),original=bundle.stores[CORE];
  assert.equal(bundle.format,"xian-emperor-full-save");assert.equal(bundle.version,row.version);assert.equal(original.ended,true);
  assert.deepEqual(original.stats,row.stats);assert.deepEqual(original.hidden,row.hidden);assert.equal(original.ending.title,row.ending);
  assert.equal(original.rulesVersion,row.version==="2.29.0"?229:228);
  const h=resume(bundle),after=h.api.getState();assert.equal(after.ending.title,original.ending.title);assert.equal(after.ending.text,original.ending.text);
  assert.deepEqual(after.stats,original.stats);assert.deepEqual(after.hidden,original.hidden);assert.deepEqual(after.random,original.random);
  assert.deepEqual(normalize(after.diplomaticOutcome||null),normalize(original.diplomaticOutcome||null),"legacy conclusions stay historical; new evidence stays frozen");
  const before=normalize(h.api.captureFullSave().stores);for(let n=0;n<3;n++)h.api.commit("archived-natural-campaign");
  assert.deepEqual(normalize(h.api.captureFullSave().stores),before,`${row.version}/${row.policy}/${row.scenario}/${row.seed}: all stores idempotent after restore`);
  results.push({version:row.version,scenario:row.scenario,seed:row.seed,policy:row.policy,file:`${path.basename(dir)}/${row.finalSave}`,bytes:bytes.length,
   sha256:crypto.createHash("sha256").update(bytes).digest("hex"),storeKeys:Object.keys(bundle.stores).length,restored:true,frozenEnding:true,nationalStatePreserved:true,randomStatePreserved:true,completeStoreIdempotent:true});
 }
 console.log(`PASS ${path.basename(dir)}: 45 complete archives restored, national/random states preserved, three repeated commits.`);
}
fs.mkdirSync(path.dirname(path.resolve(output)),{recursive:true});
fs.writeFileSync(output,JSON.stringify({runs:90,restored:90,legacyPreserved:45,frozenNewOutcomes:45,nationalStatePreserved:90,randomStatePreserved:90,completeStoreIdempotent:90,results},null,2));
console.log("PASS 90 complete archives and 270 repeated commits.");
