"use strict";
const fs=require("node:fs"),path=require("node:path"),{readVersion}=require("./read-version.cjs");
function planVersion(root,target,notes){
 root=path.resolve(root);
 if(!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(target))throw new Error("目标版本必须为数字语义版本，例如2.30.1");
 const previous=readVersion(root);if(target===previous)throw new Error("目标版本与当前版本相同");
 const patch="patch-notes/v"+target+".txt";if(fs.existsSync(path.join(root,patch)))throw new Error("目标版本说明已经存在，拒绝覆盖");
 const changes=[],read=f=>fs.readFileSync(path.join(root,f),"utf8"),add=(file,after)=>{const full=path.resolve(root,file);if(!full.startsWith(root+path.sep))throw new Error("版本更新路径越界");const before=fs.existsSync(full)?fs.readFileSync(full,"utf8"):null;if(before!==after)changes.push({file,before,after});};
 const data=read("src/data.js"),token='version: "'+previous+'"';if(!data.includes(token))throw new Error("产品版本定义格式与计划不匹配");
 add("src/data.js",data.replace(token,'version: "'+target+'"'));
 // Only the current release cohort changes. Older per-module cache identifiers,
 // storage versions, rulesVersion, schemaVersion and historical notes stay intact.
 add("index.html",read("index.html").replaceAll(previous,target));
 const body=notes?.trim()||"TODO: 补充本版本变更与验证结果";
 const readme=read("README.md"),a=readme.indexOf("<!-- CURRENT_VERSION_START -->"),b=readme.indexOf("<!-- CURRENT_VERSION_END -->");
 if(a<0||b<a)throw new Error("README缺少当前版本边界标记");
 const summary=body.split(/\r?\n/).filter(Boolean).slice(0,3).join("\n");
 add("README.md",readme.slice(0,a)+"<!-- CURRENT_VERSION_START -->\n**v"+target+"**\n"+summary+"\n<!-- CURRENT_VERSION_END -->"+readme.slice(b+"<!-- CURRENT_VERSION_END -->".length));
 const log=read("CHANGELOG.md"),heading=/^# [^\r\n]+/m.exec(log);if(!heading)throw new Error("CHANGELOG缺少标题");
 add("CHANGELOG.md",log.slice(0,heading.index+heading[0].length)+"\n\n## v"+target+"\n\n"+body+"\n"+log.slice(heading.index+heading[0].length));
 add(patch,"v"+target+"\n\n"+body+"\n");
 for(const f of [".github/workflows/release-check.yml","tests/release-regression.js"]){
  const s=read(f).replaceAll(previous,target).replaceAll(previous.replaceAll(".","\\."),target.replaceAll(".","\\."));
  add(f,s);
 }
 if(fs.existsSync(path.join(root,"docs/README.md"))){const oldMinor="v"+previous.split(".").slice(0,2).join("."),newMinor="v"+target.split(".").slice(0,2).join(".");add("docs/README.md",read("docs/README.md").replace("当前版本 "+oldMinor,"当前版本 "+newMinor));}
 return {previous,target,changes};
}
function applyPlan(root,plan){
 const written=[];
 try{for(const change of plan.changes){written.push(change);fs.writeFileSync(path.join(root,change.file),change.after);}}
 catch(error){const rollback=[];for(const change of written.reverse())try{const p=path.join(root,change.file);if(change.before===null){if(fs.existsSync(p))fs.unlinkSync(p);}else fs.writeFileSync(p,change.before);}catch(e){rollback.push(change.file+": "+e.message);}
  if(rollback.length)error.message+="；部分回滚失败："+rollback.join("；");throw error;
 }
}
function main(argv){
 let root=path.resolve(__dirname,".."),dry=false,notesFile,target;
 for(let i=0;i<argv.length;i++){const v=argv[i];if(v==="--root"){if(!argv[i+1])throw new Error("--root缺少路径");root=path.resolve(argv[++i]);}else if(v==="--dry-run")dry=true;else if(v==="--notes-file"){if(!argv[i+1])throw new Error("--notes-file缺少路径");notesFile=path.resolve(argv[++i]);}else if(v.startsWith("-"))throw new Error("未知参数："+v);else if(!target)target=v;else throw new Error("只能指定一个目标版本");}
 if(!target)throw new Error("用法：node scripts/bump-version.cjs 2.30.1 [--notes-file 文件] [--dry-run]");
 const plan=planVersion(root,target,notesFile?fs.readFileSync(notesFile,"utf8"):null);
 if(!dry)applyPlan(root,plan);
 console.log(JSON.stringify({previous:plan.previous,target:plan.target,dryRun:dry,files:plan.changes.map(c=>c.file),rulesAndStorageVersionsUnchanged:true},null,2));
}
module.exports={planVersion,applyPlan,main};
if(require.main===module)try{main(process.argv.slice(2));}catch(error){console.error(error.message);process.exitCode=1;}
