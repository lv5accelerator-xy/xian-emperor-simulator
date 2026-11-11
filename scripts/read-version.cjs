"use strict";
const fs=require("node:fs"),path=require("node:path");
function readVersion(root=path.resolve(__dirname,"..")){
 const source=fs.readFileSync(path.join(root,"src/data.js"),"utf8");
 const match=source.match(/window\.GAME_DATA\s*=\s*\{\s*version:\s*["']((?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*))["']/);
 if(!match)throw new Error("无法读取src/data.js中的产品版本");
 return match[1];
}
module.exports={readVersion};
if(require.main===module)console.log(readVersion(process.argv[2]));
