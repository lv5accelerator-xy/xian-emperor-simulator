/* Bilateral political memory. Proposals require a paid receipt and two consents. */
(() => {
  "use strict";
  const copy=v=>JSON.parse(JSON.stringify(v)), cap=n=>Math.max(0,Math.min(100,n));
  const uniq=a=>[...new Set(a)].sort(), key=(a,b)=>[a,b].sort().join("~");
  const name=(id,core)=>window.XianCharacterAvailability?.faction?.(id,core)?.name||id;
  const same=(s,c)=>Boolean(s&&c&&s.gameCreatedAt===c.createdAt);
  const defaultPair=(a,b)=>({id:key(a,b),parties:[a,b].sort(),trust:50,grievance:0,resentment:{},weariness:{},lastHostileTurn:0});
  function ledger(s,c){
    if(!same(s,c)||c.ended)return null;
    if(s.diplomaticRelations?.schemaVersion===1){const d=s.diplomaticRelations;for(const field of ["requests","treaties","periods","breaches","repairs","hostilities","events","processed"])if(!Array.isArray(d[field]))d[field]=[];d.pairs||={};if(!Array.isArray(d.orderRoots))d.orderRoots=Object.entries(d.orderRoots||{}).map(([orderId,root])=>({orderId,root}));return d;}
    return s.diplomaticRelations={schemaVersion:1,entryTurn:c.turn,legacyCutoffTurn:c.ruleMigration?.turn||c.turn,legacyRules:c.ruleMigration?.from||null,legacyChecked:false,
      pairs:{},orderRoots:[],requests:[],treaties:[],periods:[],breaches:[],repairs:[],hostilities:[],events:[],processed:[]};
  }
  function pair(s,a,b){const p=s?.diplomaticRelations?.pairs?.[key(a,b)];return copy({...defaultPair(a,b),...p,resentment:p?.resentment||{},weariness:p?.weariness||{}});}
  function mutable(d,a,b){return d.pairs[key(a,b)]||=(defaultPair(a,b));}
  function event(d,p,id,turn,kind,trust=0,grievance=0,details={}){
    if(d.processed.includes(id))return false;
    d.processed.push(id);const before={trust:p.trust,grievance:p.grievance};
    p.trust=cap(p.trust+trust);p.grievance=cap(p.grievance+grievance);
    d.events.push({id,pairId:p.id,turn,kind,trustDelta:p.trust-before.trust,grievanceDelta:p.grievance-before.grievance,...details});return true;
  }
  const active=t=>Boolean(t&&Array.isArray(t.parties)&&uniq(t.parties).length===2&&Number.isInteger(t.createdTurn)&&Number.isInteger(t.deadlineTurn)&&["active","fulfilled","unverified"].includes(t.status)&&t.paymentConfirmed&&t.consents?.length===2&&t.consents.every(r=>r.status==="accepted"));
  function atPeace(a,b,s){return a!==b&&(s?.diplomaticRelations?.treaties||[]).some(t=>active(t)&&t.parties.includes(a)&&t.parties.includes(b));}
  function protectedTreaties(s){return (s?.diplomaticRelations?.treaties||[]).filter(active).map(t=>({id:t.id,type:"postwar_peace",label:"战后和约",status:"active",createdTurn:t.createdTurn,deadlineTurn:Number.MAX_SAFE_INTEGER,contract:{parties:[...t.parties]}}));}
  function unresolved(s,a,b){const d=s?.diplomaticRelations;return (d?.breaches||[]).filter(x=>x.pairId===key(a,b)&&!(d.repairs||[]).some(r=>r.breachId===x.sourceId&&r.victim===x.victim));}
  function allianceReason(a,b,s,c){
    const p=pair(s,a,b),debt=unresolved(s,a,b),d=s.diplomaticRelations;
    if(!debt.length)return p.grievance>45||p.trust<30?"双方旧怨较深，尚需议和与修好":null;
    const last=debt.sort((x,y)=>y.turn-x.turn||x.id.localeCompare(y.id))[0];
    const ack=d.requests.some(r=>r.kind==="repair"&&r.accepted&&r.pairId===p.id&&r.epoch===last.id);
    const peace=d.periods.some(t=>t.kind==="peace"&&t.pairId===p.id&&t.startTurn>last.turn);
    return !ack||!peace||p.trust<40||p.grievance>25?"背盟旧怨未平：须承接修好、完成议和观察并恢复双方互信":null;
  }
  function policy(a,b,s,c,world={}){
    const p=pair(s,a,b),lord=world.lords?.[a]||{},trust=Number(s?.strategies?.[a]?.trust??50);
    const expansion=Number(lord.expansion??50),caution=Number(lord.caution??50);
    const peace=(s?.diplomaticRelations?.treaties||[]).find(t=>active(t)&&t.parties.includes(a)&&t.parties.includes(b));
    const mayBreak=Boolean(peace&&c.turn>=peace.createdTurn+2&&trust<30&&expansion-caution>=25&&p.grievance>=25);
    return {avoidAttack:Boolean(peace&&!mayBreak||p.trust>=65&&p.grievance<=15&&expansion-caution<40),
      revenge:Number(p.resentment[a]||0),peaceId:mayBreak?peace.id:null,
      reason:peace&&!mayBreak?"双方议和仍获承接，维持和平":p.trust>=65&&p.grievance<=15?"长期守约与协战积累互信，优先维持盟好":Number(p.resentment[a]||0)>=25?"记取本镇受损与背盟旧怨，优先防范对方":""};
  }
  function preview(kind,parties,s,armies,c,world={}){
    parties=uniq(parties||[]);const d=s?.diplomaticRelations,p=parties.length===2?pair(s,...parties):null;
    const invalid=!["peace","repair"].includes(kind)?"未知交涉方式":parties.length!==2||parties.some(id=>!s?.strategies?.[id])?"须选择两个不同且仍有势力的诸侯":!same(s,c)||!same(armies,c)?"当前局的外交与军籍尚未齐备":c.ended?"本局已经结束":null;
    if(invalid)return {ok:false,message:invalid};
    const debt=unresolved(s,...parties).sort((x,y)=>y.turn-x.turn||x.id.localeCompare(y.id)),last=debt[0];
    const treaty=(d?.treaties||[]).find(t=>active(t)&&t.parties.every(id=>parties.includes(id)));
    let reason;
    if(kind==="peace")reason=treaty?"双方已有仍在履行的和约，无须重复议和":!p.lastHostileTurn&&!debt.length?"双方没有可核验的战事或背盟冲突，无须议和":null;
    else reason=!last?"双方没有尚待修复的背盟责任":!treaty?"先取得双方议和同意，再遣使修好":(treaty.observedTurns?.length||0)<2?"议和须经过至少两个月实际军事观察":d.requests.filter(r=>r.kind==="repair"&&r.accepted&&r.epoch===last.id).length>=2?"本轮修好使节已完成两次承接，继续以守约重建信誉":d.requests.some(r=>r.kind==="repair"&&r.accepted&&r.epoch===last.id&&r.turn===c.turn)?"同月修好已经承接，请等待下一月":null;
    if(reason)return {ok:false,message:reason};
    const consents=parties.map(actor=>{
      const other=parties.find(id=>id!==actor),lord=world.lords?.[actor]||window.XIAN_STRATEGY_DATA?.lords.find(l=>l.id===actor)||{};
      const trust=Number(s.strategies[actor]?.trust||0),weariness=Number(p.weariness[actor]||0),caution=Number(lord.caution??50),expansion=Number(lord.expansion??50);
      const score=Math.round(kind==="peace"?40+caution*.35-expansion*.2+weariness+(trust-50)*.15-p.grievance*.25:45+(trust-30)*.3+(treaty.observedTurns.length)*3-p.grievance*.3+p.trust*.1-expansion*.05);
      const accepted=trust>=20&&score>=50;
      return {actor,actorName:name(actor,c),status:accepted?"accepted":"refused",score,trust,weariness,caution,expansion,
        reason:accepted?kind==="peace"?"本镇同意停攻撤围，按和约观察":"本镇愿承接修好，仍须长期履约修复责任":trust<20?"对朝廷信任不足20，不愿接受斡旋":kind==="peace"?"厌战与谨慎尚不足以压过扩张及旧怨":"旧怨仍深，尚未愿意承接修好"};
    });
    return {ok:true,kind,parties,pairId:p.id,epoch:last?.id||null,consents,accepted:consents.every(r=>r.status==="accepted"),actionCost:1,treasuryCost:2,
      message:`${kind==="peace"?"提议战后议和":"遣使修复盟好"}；${consents.filter(r=>r.status==="accepted").length}/2镇愿承接。消耗1次行动、国库2；拒绝交涉也消耗行动。`};
  }
  function resolveRequests(s,armies,c,world,onlyId){
    const d=ledger(s,c);if(!d||!same(armies,c))return;
    const pending=d.requests.filter(r=>!r.resolved&&(!onlyId||r.id===onlyId)&&c.appliedReceipts?.includes(r.id)).sort((a,b)=>c.appliedReceipts.indexOf(a.id)-c.appliedReceipts.indexOf(b.id));
    for(const r of pending){const view=r.gameCreatedAt===c.createdAt&&r.offer?.kind===r.kind&&r.offer?.pairId===r.pairId?r.offer:preview(r.kind,r.parties,s,armies,c,world);r.resolved=true;r.paymentConfirmed=true;r.accepted=Boolean(view.ok&&view.accepted);r.consents=copy(view.consents||[]);r.reason=view.message;
      if(!r.accepted)continue;
      const p=mutable(d,...r.parties);
      if(r.kind==="peace"){
        d.treaties.push({id:`peace:${r.id}`,requestId:r.id,paymentConfirmed:true,parties:[...r.parties],consents:copy(r.consents),createdTurn:r.turn,deadlineTurn:r.turn+3,
          status:"active",observedTurns:[],initialFactIds:r.initialFactIds|| (armies.militaryFacts||[]).map(f=>f.id),sourceConflictIds:r.sourceConflictIds||d.hostilities.filter(f=>key(f.attackerOwner,f.defenderOwner)===p.id).map(f=>f.id)});
      }else{
        const debt=d.breaches.find(b=>b.id===view.epoch)||unresolved(s,...r.parties).sort((a,b)=>b.turn-a.turn||a.id.localeCompare(b.id))[0];if(!debt){r.accepted=false;continue;}r.epoch=debt.id;
        if(event(d,p,`repair:${r.id}`,c.turn,"reconciliation",8,-10,{actor:debt.actor,victim:debt.victim,requestId:r.id})){
          const trust=s.strategies[debt.victim];if(trust)trust.trust=cap(trust.trust+2);
          s.allianceDiplomacy.reputations[debt.actor]=cap(Number(s.allianceDiplomacy.reputations[debt.actor]??50)+4);
        }
      }
    }
  }
  function actionRoot(f,s,armies){
    const roots=s.diplomaticRelations?.orderRoots,remembered=Array.isArray(roots)?roots.find(r=>r.orderId===f.sourceOrderId)?.root:roots?.[f.sourceOrderId];if(remembered)return remembered;
    const response=(armies.commandResponses||[]).find(r=>r.orderId===f.sourceOrderId),order=(armies.orders||[]).find(o=>o.id===f.sourceOrderId)||response?.order;
    const requestId=order?.sourceRequestId||response?.id?.replace(/^response:/,"");
    const conflict=(armies.commandConflicts||[]).find(x=>x.id===`command-conflict:replacement:${requestId}`);
    const previous=(armies.orders||[]).find(o=>o.id===conflict?.previousOrderId),pact=(s.promises||[]).find(p=>p.id===previous?.sourceAllianceId);
    if(conflict&&previous&&(previous.arrivedTurn==null||conflict.unfulfilledCoalition)&&window.XianAllianceDiplomacy.formal(pact)
      &&conflict.turn>=pact.createdTurn&&conflict.turn<=pact.deadlineTurn&&!pact.contract.initialConflictIds.includes(conflict.id)&&!s.allianceDiplomacy.ignoredConflictIds.includes(conflict.id))return conflict.id;
    return f.sourceOrderId||f.id;
  }
  function sharedBreach(s,c,f,peaceId,root){
    const d=s.allianceDiplomacy,id=`alliance-breach:${f.attackerOwner}:${root}`;
    let b=d.consequences.find(x=>x.id===id);
    if(!b){const before=Number(d.reputations[f.attackerOwner]??50);d.reputations[f.attackerOwner]=cap(before-13);
      b={id,turn:f.turn,actor:f.attackerOwner,actorName:name(f.attackerOwner,c),kind:peaceId?"peace-breach":f.kind,root,sourceFactId:f.id,sourceOrderId:f.sourceOrderId||null,
        pactIds:[],peaceIds:[],victimOwners:[],trustChanges:[],responsibility:f.authority==="court"?"court":"lord",reputationBefore:before,reputationAfter:d.reputations[f.attackerOwner],reputationDelta:d.reputations[f.attackerOwner]-before};d.consequences.push(b);}
    if(peaceId&&!b.peaceIds?.includes(peaceId)){b.peaceIds||=[];b.peaceIds.push(peaceId);}
    if(!b.victimOwners.includes(f.defenderOwner)){b.victimOwners.push(f.defenderOwner);const trust=s.strategies[f.defenderOwner],before=Number(trust?.trust||0);if(trust&&b.responsibility==="court")trust.trust=cap(before-5);
      b.trustChanges.push({actor:f.defenderOwner,requested:b.responsibility==="court"?-5:0,actual:Number(trust?.trust||0)-before});}
    return b;
  }
  function period(d,p,source,kind,start,end,parties){
    const id=`${kind}:${source}:${p.id}`;if(d.periods.some(t=>t.id===id))return;
    d.periods.push({id,sourceId:source,kind,pairId:p.id,parties:[...parties],startTurn:start,deadlineTurn:end});
    event(d,p,`period:${id}`,end,kind==="peace"?"peace-observed":"alliance-observed",kind==="peace"?14:6,kind==="peace"?-14:-6,{sourceId:source});
  }
  function reconcile(s,armies,c){
    const d=ledger(s,c);if(!d||!same(armies,c)||!s.allianceDiplomacy)return;
    const facts=[...(armies.militaryFacts||[])].sort((a,b)=>a.turn-b.turn||a.id.localeCompare(b.id));
    for(const f of facts){
      if(!f.attackerOwner||!f.defenderOwner||f.attackerOwner===f.defenderOwner)continue;
      const root=actionRoot(f,s,armies);if(f.sourceOrderId&&!d.orderRoots.some(r=>r.orderId===f.sourceOrderId))d.orderRoots.push({orderId:f.sourceOrderId,root});
      for(const t of d.treaties.filter(t=>active(t)&&t.createdTurn<=f.turn&&!t.initialFactIds.includes(f.id)&&t.parties.includes(f.attackerOwner)&&t.parties.includes(f.defenderOwner))){
        t.status="broken";t.brokenTurn=f.turn;t.breachFactId=f.id;sharedBreach(s,c,f,t.id,root);
      }
    }
    for(const b of [...s.allianceDiplomacy.consequences].sort((a,b)=>a.turn-b.turn||a.id.localeCompare(b.id)))for(const victim of uniq(b.victimOwners||[])){
      if(!victim||victim===b.actor)continue;const p=mutable(d,b.actor,victim),id=`${b.id}:${victim}`;
      if(!d.breaches.some(x=>x.id===id))d.breaches.push({id,sourceId:b.id,pairId:p.id,turn:b.turn,actor:b.actor,victim,responsibility:b.responsibility,root:b.root});
      if(event(d,p,`breach:${id}`,b.turn,"betrayal",-24,36,{actor:b.actor,victim,sourceId:b.id}))p.resentment[victim]=cap(Number(p.resentment[victim]||0)+36);
    }
    for(const f of facts){
      if(!f.attackerOwner||!f.defenderOwner||f.attackerOwner===f.defenderOwner||d.hostilities.some(x=>x.id===f.id))continue;
      const p=mutable(d,f.attackerOwner,f.defenderOwner),root=actionRoot(f,s,armies);
      const victor=f.victor||(armies.battleReports||[]).find(r=>r.id===f.source&&r.turn===f.turn)?.victor||null;
      d.hostilities.push({id:f.id,kind:f.kind,turn:f.turn,attackerOwner:f.attackerOwner,defenderOwner:f.defenderOwner,victor,root});p.lastHostileTurn=Math.max(p.lastHostileTurn,f.turn);
      const breach=s.allianceDiplomacy.consequences.some(b=>b.actor===f.attackerOwner&&b.root===root);
      const witnessed=f.allianceWitnesses?.length&&!s.allianceDiplomacy.ignoredFactIds.includes(f.id);
      if(!breach&&!witnessed&&event(d,p,`hostility:${p.id}:${f.attackerOwner}:${root}`,f.turn,"hostility",-4,8,{actor:f.attackerOwner,victim:f.defenderOwner}))p.resentment[f.defenderOwner]=cap(Number(p.resentment[f.defenderOwner]||0)+8);
      for(const actor of p.parties){const winner=f.kind==="occupation"?f.attackerOwner:victor;
        const fatigue=f.kind==="battle"||f.kind==="occupation"?winner?(actor===winner?4:12):8:f.kind==="siege-progress"?(actor===f.attackerOwner?3:5):f.kind==="siege-start"?2:0;
        if(fatigue)p.weariness[actor]=cap(Number(p.weariness[actor]||0)+fatigue);
      }
    }
    const armyTurn=Math.min(c.turn,Number(armies.lastProcessedTurn||0)-1);
    for(const t of d.treaties.filter(active).sort((a,b)=>a.createdTurn-b.createdTurn||a.id.localeCompare(b.id))){
      const p=mutable(d,...t.parties);
      if(t.status!=="fulfilled"&&Number(armies.militaryFactsStartTurn||Infinity)>t.createdTurn){t.status="unverified";continue;}
      const response=(armies.diplomaticPeaceResponses||[]).find(r=>r.treatyId===t.id);
      if(!response?.accepted)continue;
      t.stoppedArmies=response.stoppedArmyIds.length;t.militaryResponseId=response.id;
      for(let turn=Math.max(t.createdTurn,Number(armies.militaryFactsStartTurn||c.turn));turn<=armyTurn;turn++){
        if(t.observedTurns.includes(turn))continue;t.observedTurns.push(turn);
        if(event(d,p,`quiet:${p.id}:${turn}`,turn,"peace-kept",2,-2,{sourceId:t.id}))for(const actor of p.parties)p.weariness[actor]=cap(Number(p.weariness[actor]||0)-2);
        if(turn>t.deadlineTurn&&(turn-t.deadlineTurn)%4===0)for(const actor of p.parties){const id=`long-peace:${actor}:${Math.floor(turn/4)}`;
          if(!d.processed.includes(id)){d.processed.push(id);s.allianceDiplomacy.reputations[actor]=cap(Number(s.allianceDiplomacy.reputations[actor]??50)+2);}}
      }
      if(t.status==="active"&&armyTurn>=t.deadlineTurn){
        t.status="fulfilled";period(d,p,t.id,"peace",t.createdTurn,t.deadlineTurn,t.parties);
        for(const actor of t.parties){const id=`alliance-peace:${actor}:${t.deadlineTurn}`;if(s.allianceDiplomacy.peaceRewards.includes(id))continue;
          s.allianceDiplomacy.peaceRewards.push(id);s.allianceDiplomacy.reputations[actor]=cap(Number(s.allianceDiplomacy.reputations[actor]??50)+3);if(s.strategies[actor])s.strategies[actor].trust=cap(s.strategies[actor].trust+4);}
      }
    }
    for(const t of s.promises||[])if(window.XianAllianceDiplomacy.formal(t)&&t.status==="fulfilled"&&!t.contract.missingHistoricalObservation&&t.contract.receipts.some(r=>r.kind==="peace-observed")){
      const ids=uniq(t.contract.parties);for(let i=0;i<ids.length;i++)for(let j=i+1;j<ids.length;j++)period(d,mutable(d,ids[i],ids[j]),t.id,"alliance",t.createdTurn,t.deadlineTurn,[ids[i],ids[j]]);
    }
    for(const op of s.allianceDiplomacy.outcomeEvidence?.operations||[]){const ids=uniq(op.owners);for(let i=0;i<ids.length;i++)for(let j=i+1;j<ids.length;j++)event(d,mutable(d,ids[i],ids[j]),`joint:${op.id}:${key(ids[i],ids[j])}`,op.turn,"joint-success",4,-2,{sourceId:op.id});}
    for(const b of d.breaches){
      if(d.repairs.some(r=>r.breachId===b.sourceId&&r.victim===b.victim))continue;
      const terms=d.periods.filter(t=>t.pairId===b.pairId&&t.startTurn>b.turn),windows=uniq(terms.map(t=>t.deadlineTurn));
      const missions=d.requests.filter(r=>r.kind==="repair"&&r.accepted&&r.pairId===b.pairId&&r.turn>b.turn);
      const legacy=!d.legacyChecked&&d.legacyRules===229&&uniq(terms.filter(t=>t.deadlineTurn<(d.legacyCutoffTurn||d.entryTurn)&&t.kind==="alliance").map(t=>t.deadlineTurn)).length>=2;
      if(windows.length>=2&&(missions.length||legacy)&&Number(s.strategies[b.victim]?.trust||0)>=60&&Number(s.allianceDiplomacy.reputations[b.actor]??50)>=40){
        d.repairs.push({id:`repaired:${b.id}`,breachId:b.sourceId,victim:b.victim,actor:b.actor,pairId:b.pairId,turn:c.turn,sourceTerms:terms.map(t=>t.id),sourceMissions:missions.map(r=>r.id),legacyQualified:Boolean(legacy)});
      }
    }
    d.legacyChecked=true;
  }
  function summary(s,c){
    const d=s?.diplomaticRelations;if(d?.schemaVersion!==1||!same(s,c))return null;
    const credible=d.treaties.filter(t=>t.status==="fulfilled"&&active(t)&&t.parties.every(id=>Number(s.strategies[id]?.trust||0)>=50));
    return {version:1,peaceSettlements:uniq(d.periods.filter(t=>t.kind==="peace").map(t=>t.sourceId)).length,currentPeaceSettlements:credible.length,brokenPeaceSettlements:d.treaties.filter(t=>t.status==="broken").length,
      reconciliationMissions:d.requests.filter(r=>r.kind==="repair"&&r.accepted).length,repairedResponsibilities:d.repairs.length,
      partners:uniq(credible.flatMap(t=>t.parties)).map(id=>({id,name:name(id,c)})),
      pairs:Object.values(d.pairs).sort((a,b)=>a.id.localeCompare(b.id)).map(p=>({id:p.id,parties:p.parties,names:p.parties.map(id=>name(id,c)),trust:p.trust,grievance:p.grievance})),
      peaceIds:credible.map(t=>t.id),reconciliationIds:d.requests.filter(r=>r.kind==="repair"&&r.accepted).map(r=>r.id),repairIds:d.repairs.map(r=>r.id)};
  }
  window.XianDiplomaticRelations=Object.freeze({ledger,pair,active,atPeace,protectedTreaties,unresolved,allianceReason,policy,preview,resolveRequests,reconcile,summary,actionRoot,name});
})();
