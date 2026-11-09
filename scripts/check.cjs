"use strict";
const fs=require("node:fs"),path=require("node:path"),{spawn}=require("node:child_process");
const root=path.resolve(__dirname,".."), logDir=path.resolve(process.env.VALIDATION_OUTPUT||path.resolve(root,"../validation"));fs.mkdirSync(logDir,{recursive:true});
const syntax=process.argv.includes("--regression-only")?[]:fs.readdirSync(path.join(root,"src"),{recursive:true}).filter(x=>x.endsWith(".js")).sort().map(x=>["--check",`src/${x}`]);
const regressions=fs.readdirSync(path.join(root,"tests")).filter(x=>x.endsWith("-regression.js")).sort().map(x=>[`tests/${x}`]);
const syntaxCount=syntax.length,regressionCount=regressions.length,jobs=[...syntax,...regressions];
const failures=[];let done=0;
async function worker(){while(jobs.length){const args=jobs.shift(), name=path.basename(args.at(-1));await new Promise(resolve=>{const p=spawn(process.execPath,args,{cwd:root,windowsHide:true,env:{...process.env,EXPECTED_VERSION:process.env.EXPECTED_VERSION||"2.27.0"}});let output="";p.stdout.on("data",x=>output+=x);p.stderr.on("data",x=>output+=x);p.on("exit",code=>{fs.writeFileSync(path.join(logDir,`${name}${args.length>1?".syntax":""}.log`),output);if(code){failures.push({name,code});process.stderr.write(output);}done++;console.log(`${code?"FAIL":"PASS"} ${args.join(" ")}`);resolve();});});}}
Promise.all(Array.from({length:4},worker)).then(()=>{const result={syntax:syntaxCount,regressions:regressionCount,checks:done,failures};fs.writeFileSync(path.join(logDir,"summary.json"),JSON.stringify(result,null,2));console.log(JSON.stringify(result));process.exitCode=failures.length?1:0;});
