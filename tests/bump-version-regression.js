"use strict";
const fs=require("node:fs"),os=require("node:os"),path=require("node:path"),cp=require("node:child_process"),assert=require("node:assert/strict");
const root=path.resolve(__dirname,".."),{readVersion}=require("../scripts/read-version.cjs"),{planVersion,applyPlan}=require("../scripts/bump-version.cjs"),version=readVersion(root),parts=version.split(".").map(Number),target=[parts[0],parts[1],parts[2]+1].join(".");
const temporary=fs.mkdtempSync(path.join(os.tmpdir(),"xian-version-test-"));
try{
 for(const p of ["src","tests/release-regression.js","scripts/read-version.cjs",".github/workflows","docs","patch-notes","README.md","CHANGELOG.md","index.html","styles.css"]){const destination=path.join(temporary,p);fs.mkdirSync(path.dirname(destination),{recursive:true});fs.cpSync(path.join(root,p),destination,{recursive:true});}
 fs.symlinkSync(path.join(root,"assets"),path.join(temporary,"assets"),"junction");
 const before=fs.readFileSync(path.join(temporary,"src/game.js")),history=fs.readFileSync(path.join(temporary,"CHANGELOG.md"),"utf8");
 const plan=planVersion(temporary,target,"测试发布说明，不涉及玩法");
 assert.equal(readVersion(temporary),version,"planning has no writes");assert.ok(plan.changes.some(c=>c.file==="index.html"));assert.ok(plan.changes.some(c=>c.file==="patch-notes/v"+target+".txt"));
 assert.throws(()=>planVersion(temporary,"../../unsafe",null));assert.throws(()=>planVersion(temporary,version,null));assert.equal(readVersion(temporary),version);
 const originalWrite=fs.writeFileSync;let failOnce=true;fs.writeFileSync=function(file,...args){if(failOnce&&String(file).endsWith("release-check.yml")){failOnce=false;throw new Error("模拟版本写入中断");}return originalWrite.call(this,file,...args);};
 try{assert.throws(()=>applyPlan(temporary,plan),/模拟版本写入中断/);}finally{fs.writeFileSync=originalWrite;}
 assert.equal(readVersion(temporary),version);assert.equal(fs.existsSync(path.join(temporary,"patch-notes/v"+target+".txt")),false,"failed transaction removes its new patch note");
 applyPlan(temporary,plan);
 assert.equal(readVersion(temporary),target);assert.deepEqual(fs.readFileSync(path.join(temporary,"src/game.js")),before,"rules, keys and schema are unchanged");
 assert.ok(fs.readFileSync(path.join(temporary,"CHANGELOG.md"),"utf8").includes(history.slice(history.indexOf("\n"))),"historical changelog retained");
 assert.ok(fs.readFileSync(path.join(temporary,"index.html"),"utf8").includes("?v="+target));assert.ok(fs.readFileSync(path.join(temporary,"index.html"),"utf8").includes("?v=1.5.1"),"older cache cohort preserved");
 assert.ok(fs.readFileSync(path.join(temporary,"README.md"),"utf8").split("\n").length<=150);assert.throws(()=>planVersion(temporary,version,null),/已经存在/);
 const env={...process.env};delete env.EXPECTED_VERSION;
 cp.execFileSync(process.execPath,["tests/release-regression.js"],{cwd:temporary,env,stdio:"pipe"});
 console.log("版本同步回归通过：只读计划、非法目标、历史保留、规则/键/schema不变、临时目录发布回归。");
}finally{
 const safe=path.resolve(temporary),parent=path.resolve(os.tmpdir());assert.equal(path.dirname(safe),parent);assert.ok(path.basename(safe).startsWith("xian-version-test-"));
 const assetLink=path.join(safe,"assets");assert.ok(fs.lstatSync(assetLink).isSymbolicLink());fs.unlinkSync(assetLink);
 assert.equal(path.dirname(fs.realpathSync(safe)),fs.realpathSync(parent));fs.rmSync(safe,{recursive:true,force:true});
}
