"use strict";
const fs = require("node:fs"), path = require("node:path"), assert = require("node:assert/strict"), crypto = require("node:crypto");
const [baselineFile,candidateFile,output] = process.argv.slice(2);
assert.ok(baselineFile && candidateFile && output, "usage: node scripts/diplomatic-ending-audit.cjs baseline.json candidate.json output.json");
const old = JSON.parse(fs.readFileSync(baselineFile)), next = JSON.parse(fs.readFileSync(candidateFile));
assert.deepEqual(old.sourceBefore,old.sourceAfter); assert.deepEqual(next.sourceBefore,next.sourceAfter);
const root = path.resolve(__dirname,"..");
for (const [file,hash] of Object.entries(next.sourceAfter)) assert.equal(crypto.createHash("sha256").update(fs.readFileSync(path.join(root,file))).digest("hex"),hash,`final sampled source: ${file}`);
assert.equal(old.rows.length,45); assert.equal(next.rows.length,45);
const key = r => `${r.scenario}/${r.seed}/${r.policy}`;
const metrics = ["turn","deadline","early","actions","spent","stats","hidden","proposals","accepted","refused","restrained","autonomousOrders","courtOrders","facts","captures","roadBattles","trustPenalties"];
const paired = [];
for (const row of next.rows) {
  const previous = old.rows.find(r => key(r) === key(row)); assert.ok(previous,key(row));
  const differences = metrics.filter(m => JSON.stringify(row[m]) !== JSON.stringify(previous[m]));
  assert.equal(row.version,"2.29.0"); assert.equal(previous.version,"2.28.0");
  assert.ok(row.diplomaticOutcome?.version === 1);
  if (row.diplomaticOutcome.counts.unresolvedCourtBreaches) assert.ok(!["诸侯共奉","天下共奉","帝国调停者"].includes(row.ending),key(row));
  if (["诸侯共奉","天下共奉"].includes(row.ending)) assert.equal(row.diplomaticOutcome.eligibility.confederation.eligible,true,key(row));
  paired.push({key:key(row),before:previous.ending,after:row.ending,metricDifferences:differences,counts:row.diplomaticOutcome.counts,route:row.diplomaticOutcome.confederationRoute});
}
const groups = [old,next].flatMap(data => ["observe","cooperate","betray"].map(policy => {
  const rows = data.rows.filter(r => r.policy === policy), endingCounts = {};
  for (const row of rows) endingCounts[row.ending] = (endingCounts[row.ending] || 0) + 1;
  return {version:rows[0].version,policy,runs:rows.length,deadline:rows.filter(r=>!r.early).length,endings:endingCounts,
    actions:rows.reduce((n,r)=>n+r.actions,0),spent:rows.reduce((n,r)=>n+r.spent,0),captures:rows.reduce((n,r)=>n+r.captures,0),
    fulfilled:rows.every(r=>r.diplomaticOutcome)?rows.reduce((n,r)=>n+r.diplomaticOutcome.counts.fulfilledAlliances,0):null,
    jointVictories:rows.every(r=>r.diplomaticOutcome)?rows.reduce((n,r)=>n+r.diplomaticOutcome.counts.jointVictories,0):null,
    unresolvedCourtBreaches:rows.every(r=>r.diplomaticOutcome)?rows.reduce((n,r)=>n+r.diplomaticOutcome.counts.unresolvedCourtBreaches,0):null};
}));
const result = {runs:90,pairs:45,pairedMetrics:metrics,identicalMetricPairs:paired.filter(r=>!r.metricDifferences.length).length,
  sourceFiles:Object.keys(next.sourceAfter).length,sourceBefore:next.sourceBefore,sourceAfter:next.sourceAfter,groups,paired};
fs.writeFileSync(output,JSON.stringify(result,null,2));
console.log(JSON.stringify({runs:90,pairs:45,identicalMetricPairs:result.identicalMetricPairs,groups},null,2));
