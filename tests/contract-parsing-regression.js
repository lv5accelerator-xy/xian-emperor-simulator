"use strict";
const assert=require("node:assert/strict");
const {harness}=require("./helpers/game-harness");
const h=harness();
for(const verb of ["进贡","朝贡","输贡","纳贡","援军","救援","救应","勤王"]){
 const text=`请袁绍在邺城${verb}。`;
 assert.ok(h.window.XianEdictRules.analyze(text).effectiveText.includes(verb),`${verb} must reach the actual contract handler`);
 assert.equal(h.window.XianEdictRules.analyze(`不得${text}`).effectiveText,"","negated contract cannot execute");
}
console.log("PASS contract aliases are shared by preview and execution, negation stays effective");
