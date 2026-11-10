"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ROOT = path.resolve(__dirname, "..");
const CORE = "xian_emperor_simulator_v01", STRATEGY = "xian_emperor_strategy_network_v040", ARMY = "xian_emperor_armies_v050";
function harness() {
  class Storage { constructor() { this.data = new Map(); } getItem(k) { return this.data.get(k) ?? null; } setItem(k,v) { this.data.set(k,String(v)); } }
  const storage = new Storage(), listeners = new Map(), events = [];
  let core = { createdAt: "military-fixture", turn: 1, maxTurns: 24, stats: { authority: 75, prestige: 70, treasury: 40, officials: 50, security: 60, caoAlert: 40 }, hidden: {}, relations: {}, reports: [], actionPoints: 2, eventResolved: true };
  const document = { readyState:"loading", addEventListener(k,f) { if (!listeners.has(k)) listeners.set(k,[]); listeners.get(k).push(f); }, dispatchEvent(e) { events.push(e); (listeners.get(e.type)||[]).forEach(f=>f(e)); }, getElementById() { return null; }, querySelector() { return null; }, querySelectorAll() { return []; }, body:{classList:{add(){},remove(){}}} };
  const game = { getState:()=>structuredClone(core), getRandomKey:tag=>`fixed:${tag}`, canAffordEffects(effects) { const cost=Math.max(0,-Number(effects?.treasury||0)), shortfall=Math.max(0,cost-core.stats.treasury); return {ok:!core.ended&&!shortfall,cost,shortfall,reason:core.ended?"本局已结束":`国库缺少${shortfall}`}; }, applyExternalPackage(pkg) { core.appliedReceipts ||= []; if(pkg.receiptId) { if(core.appliedReceipts.includes(pkg.receiptId)) return false; core.appliedReceipts.push(pkg.receiptId); } Object.entries(pkg.effects||{}).forEach(([k,v])=>core.stats[k]=Math.max(0,Math.min(100,(core.stats[k]||0)+v))); Object.entries(pkg.hidden||{}).forEach(([k,v])=>core.hidden[k]=(core.hidden[k]||0)+v); storage.setItem(CORE,JSON.stringify(core)); return true; }, performExternalAction(pkg) { if(pkg.receiptId && core.appliedReceipts?.includes(pkg.receiptId))return false; if(!game.canAffordEffects(pkg.effects).ok||!core.actionPoints)return false; core.actionPoints--; return game.applyExternalPackage(pkg); } };
  const window = { setTimeout:()=>1, clearTimeout(){}, XianEmperorGame:game };
  const context = vm.createContext({window,document,localStorage:storage,Storage,console,CustomEvent:class {constructor(type,init){this.type=type;this.detail=init?.detail;}},Date,Math});
  for(const file of ["src/strategy-network-data.js","src/army-data.js","src/alliance-diplomacy.js","src/strategy-network.js","src/army-system.js"]) vm.runInContext(fs.readFileSync(path.join(ROOT,file),"utf8"),context,{filename:file});
  const flush = () => { storage.setItem(CORE,JSON.stringify(core)); window.XianStrategyNetwork.settleMonth(); window.XianArmySystem.settleMonth(); };
  flush();
  return {window,storage,events,game,get core(){return core;},set core(value){core=value;},flush,army:()=>window.XianArmySystem.getState(),strategy:()=>JSON.parse(storage.getItem(STRATEGY)),restoreArmy(value){storage.setItem(ARMY,JSON.stringify(value));window.XianArmySystem.settleMonth();},restoreStrategy(value){storage.setItem(STRATEGY,JSON.stringify(value));window.XianStrategyNetwork.settleMonth();}};
}
function attackFixture(h, defense=33) {
  const a=h.army(), army=Object.values(a.armies).find(x=>x.owner==="court");
  Object.values(a.armies).forEach(x=>{if(x.id!==army.id)x.status="destroyed";});
  Object.assign(army,{cityId:"luoyang",targetCityId:"luoyang",task:"attack",status:"engaged",troops:6000,supply:90});
  h.restoreArmy(a); const s=h.strategy(); Object.assign(s.cities.luoyang,{controller:"fragmented",defense,supply:24});h.restoreStrategy(s);
  return army.id;
}
function testEmptyCity(){const h=harness();const armyId=attackFixture(h);h.core.turn=2;h.flush();assert.equal(h.army().sieges.luoyang?.status,"active","A4: attack without field defenders must start a siege");assert.equal(h.strategy().cities.luoyang.controller,"fragmented","walls require siege completion");
  for(let turn=3;turn<=8;turn++){h.core.turn=turn;h.flush();}
  assert.equal(h.strategy().cities.luoyang.controller,"court");assert.equal(h.army().conquests.length,1);assert.equal(h.army().pendingJudgments.length,1);assert.equal(h.events.filter(e=>e.type==="xian:city-captured").length,1);const saved=h.army();h.restoreArmy(saved);h.flush();assert.equal(h.army().conquests.length,1);assert.equal(h.army().armies[armyId].status,"defending");
  for(const mode of ["destroyed","routing","third-party","friendly","no-walls","field"]){const x=harness();attackFixture(x,mode==="no-walls"?0:33);const a=x.army();const defender=Object.values(a.armies).find(z=>z.owner==="yuan_shao");Object.assign(defender,{cityId:"luoyang",targetCityId:"ye",status:mode==="field"?"defending":mode==="routing"?"routing":"destroyed",routeIds:["xudu_luoyang"],routeIndex:0,supply:90,troops:1000});x.restoreArmy(a);const s=x.strategy();if(mode==="friendly")s.cities.luoyang.controller="cao_cao";if(mode==="third-party")s.cities.luoyang.controller="sun_ce";x.restoreStrategy(s);x.core.turn=2;x.flush();if(mode==="friendly"){assert.equal(x.army().conquests.length,0);assert.equal(Object.values(x.army().armies).find(z=>z.owner==="court").status,"defending");}else if(mode==="no-walls")assert.equal(x.army().conquests.length,1);else if(mode==="field")assert.equal(x.army().battleReports.length,1);else assert.equal(x.army().sieges.luoyang.status,"active",mode);}
}
function testBudget(){for(const treasury of [0,5,6]){const h=harness();const a=h.army();a.pendingJudgments=[{id:"fixture",cityId:"luoyang",newOwner:"yuan_shao",previousOwner:"fragmented",turn:1,status:"pending"}];h.restoreArmy(a);h.core.stats.treasury=treasury;h.flush();h.window.XianArmySystem.getJudgmentDecision("appoint",a.pendingJudgments[0],h.core);const before=JSON.stringify({army:h.army(),strategy:h.strategy(),core:h.core});assert.equal(h.window.XianArmySystem.resolvePostwarJudgment("fixture","appoint"),treasury===6,"A5: appointment budget boundary");if(treasury<6)assert.equal(JSON.stringify({army:h.army(),strategy:h.strategy(),core:h.core}),before,"rejection must preserve all gameplay state");else{assert.equal(h.core.stats.treasury,0);assert.equal(h.strategy().cities.luoyang.controller,"court");assert.equal(h.window.XianArmySystem.resolvePostwarJudgment("fixture","appoint"),false);assert.equal(h.army().judgmentHistory.length,1);}}
  const h=harness(),a=h.army();a.pendingJudgments=[{id:"ended",cityId:"luoyang",turn:1,status:"pending"}];h.restoreArmy(a);h.core.ended=true;assert.equal(h.window.XianArmySystem.resolvePostwarJudgment("ended","pacify"),false);
}
if(require.main===module){const selected=process.argv[2];if(!selected||selected==="A4")testEmptyCity();if(!selected||selected==="A5")testBudget();console.log(`military consistency regression ok: ${selected||"A4, A5"}`);}
module.exports={harness,attackFixture};
