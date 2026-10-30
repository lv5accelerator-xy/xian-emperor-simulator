"use strict";
// Execute the workflow's exact inline Node checks locally, in isolated scopes.
const fs=require("node:fs"),path=require("node:path");
process.chdir(path.resolve(__dirname,".."));
const yaml=fs.readFileSync(".github/workflows/release-check.yml","utf8");
const blocks=[...yaml.matchAll(/node <<'NODE'\r?\n([\s\S]*?)\r?\n\s+NODE/g)];
for(const [index,match]of blocks.entries()){
 const code=match[1].replace(/^          /gm,"");
 new Function("require",code)(require);
 console.log(`PASS workflow inline Node block ${index+1}`);
}
let files=0,references=0;
for(const line of yaml.split(/\r?\n/)){
 let m=line.match(/^\s+test -f (\S+)$/);if(m){if(!fs.existsSync(m[1]))throw new Error(`Missing workflow file ${m[1]}`);files++;}
 m=line.match(/^\s+grep -q '([^']+)' (\S+)$/);if(m){if(!fs.readFileSync(m[2],"utf8").includes(m[1]))throw new Error(`Missing workflow reference ${m[1]}`);references++;}
}
console.log(JSON.stringify({inlineNodeBlocks:blocks.length,files,references,passed:true}));
