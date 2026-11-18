(function(){
"use strict";
/* ---------- helpers ---------- */
const $=(s,r=document)=>r.querySelector(s);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const RES={G:"Gold",E:"Elixir",D:"Dark Elixir",BG:"Builder Gold",BE:"Builder Elixir",SO:"Shiny Ore",GO:"Glowy Ore",SR:"Starry Ore",GEM:"Gems"};
function fmtNum(n){n=Math.round(n||0);const a=Math.abs(n);if(a>=1e9)return(n/1e9).toFixed(2).replace(/\.?0+$/,"")+"B";if(a>=1e6)return(n/1e6).toFixed(2).replace(/\.?0+$/,"")+"M";if(a>=1e4)return(n/1e3).toFixed(1).replace(/\.0$/,"")+"K";return n.toLocaleString();}
function fmtDur(s){s=Math.max(0,Math.round(s||0));if(s===0)return"0m";const d=Math.floor(s/86400),h=Math.floor(s%86400/3600),m=Math.floor(s%3600/60);if(d>=10)return d+"d "+h+"h";if(d)return d+"d "+h+"h "+(m?m+"m":"");if(h)return h+"h "+m+"m";if(m)return m+"m";return s+"s";}
function fmtCd(s){if(s<=0)return"Done";const d=Math.floor(s/86400),h=Math.floor(s%86400/3600),m=Math.floor(s%3600/60),x=Math.floor(s%60);return(d?d+"d ":"")+String(h).padStart(2,"0")+":"+String(m).padStart(2,"0")+":"+String(x).padStart(2,"0");}
const pct=x=>(Math.round((x||0)*1000)/10).toFixed(1)+"%";
const dateStr=ms=>new Date(ms).toLocaleString(undefined,{month:"short",day:"numeric",hour:"numeric",minute:"2-digit",hour12:true});
const dayStr=ms=>new Date(ms).toLocaleDateString(undefined,{year:"numeric",month:"short",day:"numeric"});
const isoDay=d=>{const x=new Date(d);return x.getFullYear()+"-"+String(x.getMonth()+1).padStart(2,"0")+"-"+String(x.getDate()).padStart(2,"0")};
const parseDay=s=>{const [y,m,d]=s.split("-").map(Number);return new Date(y,m-1,d).getTime()};
const seasonKey=ms=>{const d=new Date(ms);return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")};
function resHTML(obj,keys){keys=keys||Object.keys(obj);const parts=keys.filter(k=>obj[k]>0).map(k=>`<span class="res" title="${esc(RES[k]||k)}"><i class="dot d-${esc(k)}"></i>${fmtNum(obj[k])}</span>`);return parts.length?parts.join(" "):'<span class="muted">—</span>';}
function toast(t){const el=document.createElement("div");el.className="toast";el.textContent=t;document.body.appendChild(el);setTimeout(()=>el.remove(),2400);}
/* every error is kept here and listed on the Overview, alongside problems found in the export */
const ERRS=[];
function logErr(src,e){const msg=String((e&&e.message)||e||"Unknown error");console.error(src,e);const hit=ERRS.find(x=>x.src===src&&x.msg===msg);if(hit){hit.n++;hit.at=Date.now();}else ERRS.push({src,msg,at:Date.now(),n:1});if(ERRS.length>50)ERRS.shift();refreshErrs();}
window.addEventListener("error",ev=>logErr("Script",ev.error||ev.message));
window.addEventListener("unhandledrejection",ev=>logErr("Script",ev.reason));
const sum=a=>a.reduce((x,y)=>x+y,0);
function addRes(t,c,r,mult){mult=mult??1;if(c==null)return;if(typeof c==="object"){for(const k in c){if(c[k])t[k]=(t[k]||0)+c[k]*mult;}return;}if(!c)return;const k=RES[r]?r:(String(r).startsWith("Builder Gold")?"BG":(r||"G"));t[k]=(t[k]||0)+c*mult;}

/* ---------- game data index ---------- */
const BY_ID={};for(const it of GAME.items)BY_ID[it.id]=it;
/* items named through the Clash of Clans API sync, kept per browser until the bundled game data catches up */
const LEARNED_KEY="coc-ledger-learned";
function loadLearned(){try{return JSON.parse(localStorage.getItem(LEARNED_KEY)||"[]")}catch(e){return[]}}
function addLearned(items){for(const it of items)if(!BY_ID[it.id]){GAME.items.push(it);BY_ID[it.id]=it;}}
addLearned(loadLearned());
/* Town Hall 19 equipment from the NotAmti/Clash-of-Clans-Datamine report of 16 Nov 2026, newer than js/game-data.js.
   IDs are inferred from the order of the update's new rows, so names learned from the API sync above take precedence.
   Shield Brooch uses the shared epic upgrade table; Legendary costs aren't public yet, so Blizzard Axe isn't counted.
   Squad Barracks has one level per Town Hall from 8 to 19 (wiki table), so it is counted like the other barracks. */
const DATAMINE_SRC="Clash of Clans Datamine, 16 Nov 2026";
{const epic=equipTemplate(27);
 addLearned([
  epic&&{id:90000062,n:"Shield Brooch",b:"h",k:"equipment",lv:JSON.parse(JSON.stringify(epic.lv)),x:{hero:"royal-champion",rarity:"epic",datamine:DATAMINE_SRC}},
  {id:90000063,n:"Blizzard Axe",b:"h",k:"equipment",lv:[[1,{SO:0,GO:0,SR:0},"",0,null,{blacksmith:1}]],x:{hero:"barbarian-king",rarity:"legendary",datamine:DATAMINE_SRC,levelsUnknown:true}},
  // ID inferred: seen being built in a TH11 export, and the only new Home Village building a TH11 can build.
  // Levels from the Clash of Clans Wiki (fandom) Squad Barracks page, 18 Nov 2026; level 1 matches the datamine's 1.7M build cost
  {id:1000106,n:"Squad Barracks",b:"h",k:"army",lv:[[1,1700000,"E",172800,8],[2,3000000,"E",259200,9],[3,3800000,"E",432000,10],[4,6000000,"E",518400,11],[5,7500000,"E",604800,12],[6,10000000,"E",648000,13],[7,12500000,"E",691200,14],[8,15000000,"E",820800,15],[9,16000000,"E",864000,16],[10,20000000,"E",950400,17],[11,26000000,"E",1166400,18],[12,32000000,"E",1382400,19]],cnt:{"1":0,"2":0,"3":0,"4":0,"5":0,"6":0,"7":0,"8":1,"9":1,"10":1,"11":1,"12":1,"13":1,"14":1,"15":1,"16":1,"17":1,"18":1,"19":1},x:{datamine:DATAMINE_SRC+" + Clash of Clans Wiki"}},
 ].filter(Boolean));}
const ID={TH:1000001,BH:1000034,LAB:1000007,HH:1000071,BS:1000070,PH:1000068,SL:1000046,HUT:1000015,OTTO:1000078,BOB_HUT:1000064,BOB_CTRL:1000065};
function bldMaxAt(id,th){const it=BY_ID[id];if(!it)return 0;let m=0;for(const L of it.lv){if(L[4]==null||L[4]<=th)m=Math.max(m,L[0]);}return m;}
function reqCaps(base,th){return base==="h"?{lab:bldMaxAt(ID.LAB,th),herohall:bldMaxAt(ID.HH,th),blacksmith:bldMaxAt(ID.BS,th),pethouse:bldMaxAt(ID.PH,th)}:{starlab:bldMaxAt(ID.SL,th)};}
function levelOK(L,th,caps){if(L[4]!=null&&L[4]>th)return false;const rq=L[5];if(rq){for(const k in rq){if(caps[k]!=null&&rq[k]>caps[k])return false;}}return true;}
function maxLevelAt(it,th,caps){let m=0;for(const L of it.lv){if(levelOK(L,th,caps))m=Math.max(m,L[0]);}return m;}
function minLevel(it){return it.lv.length?Math.min(...it.lv.map(L=>L[0])):1;}
function lvRow(it,l){return it.lv.find(L=>L[0]===l);}
function costW(c){if(c==null)return 0;if(typeof c==="object")return sum(Object.values(c));return c;}

/* ---------- village computation ---------- */
const HOME_GROUPS=[
  {key:"defense",label:"Defenses",cats:["defense","guardian"],q:"builder",w:"time"},
  {key:"army",label:"Army",cats:["army","other"],q:"builder",w:"time"},
  {key:"resource",label:"Resources",cats:["resource"],q:"builder",w:"time"},
  {key:"trap",label:"Traps",cats:["trap"],q:"builder",w:"time"},
  {key:"hero",label:"Heroes",cats:["hero"],q:"builder",w:"time",src:"heroes"},
  {key:"troop",label:"Troops",cats:["troop"],q:"lab",w:"time",src:"units"},
  {key:"spell",label:"Spells",cats:["spell"],q:"lab",w:"time",src:"spells"},
  {key:"siege",label:"Siege machines",cats:["siege"],q:"lab",w:"time",src:"siege_machines"},
  {key:"pet",label:"Pets",cats:["pet"],q:"pet",w:"time",src:"pets"},
  {key:"wall",label:"Walls",cats:["wall"],q:"wall",w:"cost"},
  {key:"equipment",label:"Hero equipment",cats:["equipment"],q:"ore",w:"cost",src:"equipment",ownedOnly:true}
];
const BB_GROUPS=[
  {key:"defense",label:"Defenses",cats:["defense"],q:"builder",w:"time"},
  {key:"army",label:"Army",cats:["army","other"],q:"builder",w:"time"},
  {key:"resource",label:"Resources",cats:["resource"],q:"builder",w:"time"},
  {key:"trap",label:"Traps",cats:["trap"],q:"builder",w:"time"},
  {key:"hero",label:"Heroes",cats:["hero"],q:"builder",w:"time",src:"heroes2"},
  {key:"troop",label:"Troops",cats:["troop"],q:"lab",w:"time",src:"units2"},
  {key:"wall",label:"Walls",cats:["wall"],q:"wall",w:"cost"}
];
/* Builder's Apprentice (93000000) and Lab Assistant (93000001): once a day a helper works for one hour on the upgrade
   marked helper_recurrent, adding its level in extra hours (L1 = double speed). helper_cooldown counts 23 hours from
   when it started, so it is working while more than 22 hours are left. Recurring helpers are assumed to start again
   as soon as they're ready. Returns the upgrade's remaining seconds with that help counted. */
const HELP_CD=23*3600,HELP_WORK=3600;
const helperFor=e=>(e.data>=4000000&&e.data<5000000)||(e.data>=26000000&&e.data<27000000)?93000001:93000000;
const HELPER_NAME={93000000:"Builder's Apprentice",93000001:"Lab Assistant"};
function helperPlan(exp,e){
  if(!e||!e.timer||!e.helper_recurrent||!exp)return null;
  const h=(exp.helpers||[]).find(x=>x.data===helperFor(e));if(!h||!h.lvl)return null;
  const rate=h.lvl+1,wins=[];let pos=0,left=e.timer,s=h.helper_cooldown?h.helper_cooldown-HELP_CD:0;
  for(let i=0;i<400&&left>0;i++,s+=HELP_CD){const we=s+HELP_WORK;if(we<=pos)continue;const ws=Math.max(pos,s);
    if(left<=ws-pos){pos+=left;left=0;break;}left-=ws-pos;pos=ws;wins.push([s,we]);
    if(left<=(we-pos)*rate){pos+=left/rate;left=0;break;}left-=(we-pos)*rate;pos=we;}
  return{name:HELPER_NAME[h.data]||"Helper",lvl:h.lvl,timer:e.timer,wins,end:Math.round(pos+left)};}
function helpedTimer(exp,e){const p=helperPlan(exp,e);return p?p.end:(e&&e.timer||0);}
/* the in-game timer at a moment: it runs at helper speed inside a working window and at normal speed outside */
function helpLeft(hp,ts,now){const t=(now-ts)/1000;let extra=0;for(const [a,b] of hp.w)extra+=Math.max(0,Math.min(b,t)-Math.max(a,0));return Math.max(0,hp.t-t-hp.l*extra);}
function helpStatus(hp,ts,now){const t=(now-ts)/1000;const L=fmtDur(hp.l*HELP_WORK);
  const cur=hp.w.find(([a,b])=>t>=a&&t<b),next=hp.w.find(([a])=>a>t);
  if(helpLeft(hp,ts,now)<=0)return`${hp.n} L${hp.l} helped`;
  if(cur)return`⚡ ${hp.n} L${hp.l} at ${hp.l+1}× speed · ${fmtDur(t-cur[0])} used, ${fmtDur(cur[1]-t)} left`;
  if(next)return`${hp.n} L${hp.l} next helps ${dateStr(ts+next[0]*1000)} · cuts ${L}`;
  return hp.w.some(([,b])=>b<=t)?`${hp.n} L${hp.l} finished its hour (${fmtDur(hp.l*hp.w.reduce((x,[a,b])=>x+Math.max(0,Math.min(b,t)-Math.max(a,0)),0))} cut since the snapshot) · normal speed now`:`${hp.n} L${hp.l} · cuts up to ${L} a day`;}
const helpAttr=t=>t.help?` data-help="${esc(JSON.stringify(t.help))}" data-ts="${t.ts}"`:"";
const helpLine=t=>t.help?`<span class="small help">${esc(helpStatus(t.help,t.ts,Date.now()))}</span>`:"";
const helpWorking=(hp,ts,now)=>{const t=(now-ts)/1000;return hp.w.some(([a,b])=>t>=a&&t<b)&&helpLeft(hp,ts,now)>0;};
const helpIcon=t=>t.help?`<span class="help-ic" role="img" title="${esc(t.help.n)} working" aria-label="${esc(t.help.n)} working"${helpWorking(t.help,t.ts,Date.now())?"":" hidden"}>⚡</span>`:"";
const cdLeft=(t,now)=>t.help?helpLeft(t.help,t.ts,now):(t.end-now)/1000;
function collectOwned(list,exp){const m={};for(const e of list||[]){const n=e.cnt??1;(m[e.data]=m[e.data]||[]);for(let i=0;i<n;i++)m[e.data].push({lvl:e.lvl??0,timer:i===0&&e.timer?helpedTimer(exp,e):0,gear:!!e.gear_up,helper:!!e.helper_recurrent});}return m;}

function computeVillage(exp,base){
  const H=base==="h";
  const bKey=H?"buildings":"buildings2", tKey=H?"traps":"traps2";
  const owned=Object.assign({},collectOwned(exp[bKey],exp),collectOwned(exp[tKey],exp));
  const ownedSrc={};
  for(const g of (H?HOME_GROUPS:BB_GROUPS))if(g.src)Object.assign(ownedSrc,collectOwned(exp[g.src],exp));
  const hallId=H?ID.TH:ID.BH;
  const hall=(owned[hallId]||[{lvl:0}])[0];
  const th=hall.lvl||0;
  if(!th)return null;
  const caps=reqCaps(base,th), prevCaps=reqCaps(base,th-1);
  const cur={lab:(owned[ID.LAB]||[{lvl:0}])[0].lvl,herohall:(owned[ID.HH]||[{lvl:0}])[0].lvl,blacksmith:(owned[ID.BS]||[{lvl:0}])[0].lvl,pethouse:(owned[ID.PH]||[{lvl:0}])[0].lvl,starlab:(owned[ID.SL]||[{lvl:0}])[0].lvl};
  const groups=[];const unknown=[];const seen=new Set();
  for(const g of (H?HOME_GROUPS:BB_GROUPS)){
    const G={key:g.key,label:g.label,q:g.q,w:g.w,base,rows:[],done:0,rem:0,remTime:0,lock:0,remCost:{},doneLv:0,totLv:0};
    const items=GAME.items.filter(it=>it.b===base&&g.cats.includes(it.k));
    for(const it of items){
      if(it.x&&it.x.levelsUnknown)continue;
      const src=g.src?ownedSrc:owned;
      const have=(src[it.id]||[]).slice();seen.add(it.id);
      const maxL=maxLevelAt(it,th,caps);const prevMax=th>1?maxLevelAt(it,th-1,prevCaps):0;
      if(g.ownedOnly&&!have.length)continue;
      if(!maxL&&!have.length)continue;
      let maxCount;
      if(g.src)maxCount=maxL>0?1:have.length;
      else if(it.id===ID.HUT)maxCount=Math.max(have.length,1);
      else if(it.cnt)maxCount=it.cnt[th]??0;
      else maxCount=maxL>0?1:0;
      if(!maxCount&&!have.length)continue;
      const minL=minLevel(it);
      while(have.length<maxCount)have.push({lvl:minL-1,timer:0,missing:true});
      const row={id:it.id,name:it.n,k:it.k,x:it.x,copies:have,maxL,prevMax,maxCount,remTime:0,lock:0,remCost:{},done:0,rem:0,upgrading:0,missing:0,rushed:0,locked:0,next:[]};
      for(const c of have){
        const b0={done:row.done,rem:row.rem,t:row.remTime,l:row.lock,cost:Object.assign({},row.remCost)};
        if(c.missing)row.missing++;
        if(c.timer)row.upgrading++;
        if(c.lvl<prevMax&&!c.missing)row.rushed++;
        const startL=c.timer?c.lvl+2:c.lvl+1;
        if(c.timer){
          // in-progress level: progress keeps the level the upgrade started from (L1→L2 counts as L1);
          // the whole level stays in the remaining work, while "time left" shows only the timer that's left
          const U=lvRow(it,c.lvl+1);const full=U?(U[3]||0):c.timer;const left=Math.min(c.timer,full||c.timer);
          row.remTime+=left;row.lock+=left;
          row.rem+=g.w==="time"?Math.max(full,left):(U?costW(U[1]):0);
          row.inprog=(row.inprog||0)+(full?Math.max(0,full-left)/full:0);
        }
        for(let l=startL;l<=maxL;l++){const L=lvRow(it,l);if(!L)continue;row.remTime+=L[3]||0;addRes(row.remCost,L[1],L[2]);row.rem+=g.w==="time"?(L[3]||0):costW(L[1]);}
        for(let l=minL;l<=Math.min(c.lvl,maxL);l++){const L=lvRow(it,l);if(!L)continue;row.done+=g.w==="time"?(L[3]||0):costW(L[1]);}
        if(!c.timer&&c.lvl<maxL){const L=lvRow(it,c.lvl+1);if(L){
          const q=L[5]||{};let blocked=null;for(const k in q){if(cur[k]!=null&&q[k]>cur[k])blocked=k;}
          row.next.push({from:c.lvl,to:c.lvl+1,s:L[3]||0,c:L[1],r:L[2],blocked,missing:!!c.missing});
          if(blocked)row.locked++;
        }}
        G.doneLv+=Math.max(0,Math.min(c.lvl,maxL)-(minL-1));G.totLv+=Math.max(0,maxL-(minL-1));
        c.done=row.done-b0.done;c.rem=row.rem-b0.rem;c.remTime=row.remTime-b0.t;c.lock=row.lock-b0.l;c.remCost={};for(const k in row.remCost){const d=row.remCost[k]-(b0.cost[k]||0);if(d>0)c.remCost[k]=d;}
      }
      G.rows.push(row);G.done+=row.done;G.rem+=row.rem;G.remTime+=row.remTime;G.lock+=row.lock;for(const k in row.remCost)G.remCost[k]=(G.remCost[k]||0)+row.remCost[k];
    }
    G.pct=G.done+G.rem>0?G.done/(G.done+G.rem):1;
    groups.push(G);
  }
  // unknown ids
  for(const k of [bKey,tKey,...(H?["units","spells","siege_machines","heroes","pets","equipment"]:["units2","heroes2"])])for(const e of exp[k]||[]){if(!BY_ID[e.data]&&!unknown.includes(e.data))unknown.push(e.data);}
  const by=k=>groups.find(g=>g.key===k);
  const sumQ=q=>sum(groups.filter(g=>g.q===q).map(g=>g.remTime));
  const lockQ=q=>sum(groups.filter(g=>g.q===q).map(g=>g.lock));
  const timed=groups.filter(g=>g.w==="time"&&g.q!=="pet");
  const done=sum(timed.map(g=>g.done)),rem=sum(timed.map(g=>g.rem));
  const builderCost={},labCost={},wallCost={},ore={};
  for(const g of groups){const t=g.q==="builder"?builderCost:g.q==="lab"||g.q==="pet"?labCost:g.q==="wall"?wallCost:ore;for(const k in g.remCost)t[k]=(t[k]||0)+g.remCost[k];}
  const otto=H?0:Math.max(0,...(owned[ID.OTTO]||[]).map(c=>c.lvl));
  const huts=H?(owned[ID.HUT]||[]).length+((owned[ID.BOB_HUT]||[]).some(c=>c.lvl>0)?1:0):1+(otto>0?1:0);
  return {base,th,hallUp:hall.timer?(exp.timestamp+hall.timer)*1000:0,caps,cur,groups,by,unknown,overall:done+rem>0?done/(done+rem):1,builderTime:sumQ("builder"),labTime:sumQ("lab"),petTime:sumQ("pet"),builderLock:lockQ("builder"),labLock:lockQ("lab"),petLock:lockQ("pet"),builderCost,labCost,wallCost,ore,huts,otto,gearUps:sum(Object.values(owned).flat().map(c=>c.gear?1:0))};
}

function timersOf(exp){
  const ts=(exp.timestamp||0)*1000;const out=[];
  const add=(list,base,q)=>{for(const e of list||[]){if(!e.timer)continue;const it=BY_ID[e.data];const U=it?lvRow(it,(e.lvl||0)+1):null;const hp=helperPlan(exp,e);const left=hp?hp.end:e.timer;out.push({name:it?it.n:"Unknown "+e.data,to:(e.lvl||0)+1,end:ts+left*1000,full:Math.max(U?(U[3]||0):0,e.timer||0),q,base,ts,help:hp?{n:hp.name,l:hp.lvl,t:hp.timer,w:hp.wins}:null});}};
  add(exp.buildings,"Home","Builder");add(exp.traps,"Home","Builder");add(exp.heroes,"Home","Builder (hero)");
  add(exp.units,"Home","Laboratory");add(exp.spells,"Home","Laboratory");add(exp.siege_machines,"Home","Laboratory");add(exp.pets,"Home","Pet House");
  add(exp.buildings2,"Builder Base","Builder");add(exp.traps2,"Builder Base","Builder");add(exp.heroes2,"Builder Base","Builder (hero)");add(exp.units2,"Builder Base","Star Laboratory");
  for(const h of exp.helpers||[]){if(h.helper_cooldown){const it=BY_ID[h.data];const nm=it?it.n:h.data===93000000?"Builder's Apprentice":h.data===93000001?"Lab Assistant":"Helper";const wk=h.helper_cooldown>HELP_CD-HELP_WORK;out.push({name:nm+" L"+h.lvl,to:null,end:ts+(wk?h.helper_cooldown-(HELP_CD-HELP_WORK):h.helper_cooldown)*1000,q:wk?"Working · ends":"Helper ready",base:"Home"});}}
  if(exp.boosts&&exp.boosts.clocktower_cooldown)out.push({name:"Clock Tower boost",to:null,end:ts+exp.boosts.clocktower_cooldown*1000,q:"Ready again",base:"Builder Base"});
  return out.sort((a,b)=>a.end-b.end);
}

/* ---------- storage ---------- */
const LSKEY="coc-ledger-v1";
const Store={db:null,mode:"loading",cache:{accounts:[],snapshots:[],seasons:[],itemlog:[],events:[],meta:[]},
  async init(){
    let db=null;
    this.db=db;this.mode=db?"db":"local";
    for(const c of Object.keys(this.cache)){try{this.cache[c]=await this.list(c);}catch(e){logErr("Loading saved "+c,e);this.cache[c]=[];}}
  },
  local(){try{return JSON.parse(localStorage.getItem(LSKEY)||"{}")}catch(e){return{}}},
  saveLocal(o){try{localStorage.setItem(LSKEY,JSON.stringify(o))}catch(e){}},
  norm(r){const arr=Array.isArray(r)?r:(r&&(r.docs||r.items||r.results||r.documents))||[];return arr.map(d=>{let data=typeof d.data==="function"?d.data():(d.data!==undefined?d.data:d);const id=d.id??d.key??(d.path?String(d.path).split("/").pop():data&&data._id);return Object.assign({},data,{_id:id});}).filter(x=>x._id);},
  async list(coll){
    if(this.mode!=="db"){const o=this.local();return Object.entries(o[coll]||{}).map(([k,v])=>Object.assign({},v,{_id:k}));}
    const c=this.db.collection(coll);let r;
    if(typeof c.get==="function")r=await c.get();
    else r=await new Promise((res,rej)=>{let un;un=c.onSnapshot(s=>{res(s);try{un&&un()}catch(e){}},rej);});
    return this.norm(r);
  },
  ref(coll,id){return typeof this.db.doc==="function"?this.db.doc(coll+"/"+id):this.db.collection(coll).doc(id);},
  async put(coll,id,data){
    const clean=Object.assign({},data);delete clean._id;
    if(this.mode==="db")await this.ref(coll,id).set(clean);
    else{const o=this.local();(o[coll]=o[coll]||{})[id]=clean;this.saveLocal(o);}
    const arr=this.cache[coll];const i=arr.findIndex(x=>x._id===id);const v=Object.assign({},clean,{_id:id});if(i>=0)arr[i]=v;else arr.push(v);
  },
  async del(coll,id){
    if(this.mode==="db")await this.ref(coll,id).delete();
    else{const o=this.local();if(o[coll])delete o[coll][id];this.saveLocal(o);}
    this.cache[coll]=this.cache[coll].filter(x=>x._id!==id);
  }
};
const tagKey=t=>String(t||"").replace(/[^A-Z0-9]/gi,"").toUpperCase();

/* ---------- state ---------- */
const S={acct:null,tab:"overview",view:{},compA:null,compB:null,open:new Set()};
try{S.acct=localStorage.getItem("coc-ledger-acct");S.tab=localStorage.getItem("coc-ledger-tab")||"overview";}catch(e){}
const TABS=[["overview","Overview"],["home","Home Village"],["heroes","Heroes & Gear"],["lab","Lab"],["builder","Builder Base"],["builders","Builders"],["events","Events & Effects"],["planner","Planner"]];
if(!TABS.some(t=>t[0]===S.tab))S.tab="overview"; // a saved tab that no longer exists
const memo=new Map();let CUR=null;
function snapsFor(k){return Store.cache.snapshots.filter(s=>s.tag===k).sort((a,b)=>a.ts-b.ts);}
function parsed(s){if(memo.has(s._id))return memo.get(s._id);let exp;try{exp=typeof s.raw==="string"?JSON.parse(s.raw):s.raw;}catch(e){exp=null;logErr("Snapshot",new Error("The snapshot from "+dateStr((s.ts||0)*1000)+" isn't valid JSON: "+e.message));}let home=null,bb=null;if(exp){try{home=computeVillage(exp,"h");bb=computeVillage(exp,"b");}catch(e){logErr("Reading the export",e);}}const v={exp,home,bb};memo.set(s._id,v);return v;}
function latest(){const a=snapsFor(S.acct);return a.length?a[a.length-1]:null;}
function account(k){return Store.cache.accounts.find(a=>a._id===k);}

/* ---------- events & effects ---------- */
function allEvents(){
  const custom=Store.cache.events;const out=[];
  GAME.events.forEach((e,i)=>{const id="b-"+(e.name+"-"+e.start).replace(/[^a-z0-9]+/gi,"-").toLowerCase();const o=custom.find(c=>c._id===id);if(o&&o.hidden)return;out.push(Object.assign({},e,o||{},{_id:id,builtin:true}));});
  for(const c of custom){if(c._id.startsWith("b-")||c.hidden)continue;out.push(Object.assign({},c,{builtin:false}));}
  return out.sort((a,b)=>a.start<b.start?-1:a.start>b.start?1:0);
}
function eventDiscount(e){let cost=0,time=0,target="all";for(const f of e.effects||[]){if(f.costPct)cost=f.costPct;if(f.timePct)time=f.timePct;if(f.target)target=f.target;}return{cost,time,target};}
function activeOn(e,ms){return parseDay(e.start)<=ms&&ms<parseDay(e.end)+86400000;}
function seasonDoc(k,season){return Store.cache.seasons.find(s=>s._id===k+"_"+season);}
function goldPassPct(){const gp=(GAME.goldPass.perks||[]);const b=gp.find(p=>/builder boost/i.test(p.name)),r=gp.find(p=>/research boost/i.test(p.name));return{builder:b?parseFloat(b.value)/100:-0.2,lab:r?parseFloat(r.value)/100:-0.2};}
function evKey(e){return String(e.name||"")+"|"+String(e.start||"");}
function evOnFor(sd,e){return!!(sd&&sd.evOn&&sd.evOn[evKey(e)]);}
function effectsNow(k){
  const now=Date.now();const sd=seasonDoc(k,seasonKey(now));const gp=sd&&sd.goldPass;const g=goldPassPct();
  const evs=allEvents().filter(e=>e.type==="discount"&&activeOn(e,now)&&evOnFor(sd,e));
  let bT=1,bC=1,lT=1,lC=1;const labels=[];
  if(gp){bT*=1+g.builder;bC*=1+g.builder;lT*=1+g.lab;lC*=1+g.lab;labels.push("Gold Pass");}
  for(const e of evs){const d=eventDiscount(e);if(d.target==="all"||d.target==="builder"||d.target==="hero"){bT*=1+d.time/100;bC*=1+d.cost/100;}if(d.target==="all"||d.target==="lab"){lT*=1+d.time/100;lC*=1+d.cost/100;}labels.push(e.name+" (until "+dayStr(parseDay(e.end))+")");}
  // in-game calibration overrides the computed multipliers while it is valid
  const cal=(sd&&sd.calib)||{};const calLabels=[];
  if(cal.builder&&cal.builder.until>now){bT=cal.builder.t;if(cal.builder.c!=null)bC=cal.builder.c;calLabels.push("builder ×"+bT.toFixed(2));}
  if(cal.lab&&cal.lab.until>now){lT=cal.lab.t;if(cal.lab.c!=null)lC=cal.lab.c;calLabels.push("lab ×"+lT.toFixed(2));}
  if(calLabels.length)labels.push("matched to in-game times ("+calLabels.join(", ")+")");
  return{gp:!!gp,evs,bT,bC,lT,lC,labels,cal};
}
function parseDur(s){s=String(s||"").toLowerCase();let t=0,ok=false;for(const [re,m] of [[/(\d+(?:\.\d+)?)\s*d/,86400],[/(\d+(?:\.\d+)?)\s*h/,3600],[/(\d+(?:\.\d+)?)\s*m(?!s)/,60],[/(\d+(?:\.\d+)?)\s*s/,1]]){const x=s.match(re);if(x){t+=parseFloat(x[1])*m;ok=true;}}return ok?t:NaN;}
function parseAmt(s){s=String(s||"").trim().toLowerCase().replace(/,/g,"");if(!s)return NaN;const x=s.match(/^(\d+(?:\.\d+)?)\s*([kmb]?)$/);if(!x)return NaN;return parseFloat(x[1])*({"":1,k:1e3,m:1e6,b:1e9}[x[2]]);}
function calibPanel(){
  const snap=latest();if(!snap)return"";const P=parsed(snap);if(!P.home)return"";
  const sd=seasonDoc(S.acct,seasonKey(Date.now()))||{};const cal=sd.calib||{};const now=Date.now();
  const cands=upgradeCandidates({P}).filter(c=>c.s>0&&(c.q==="Builder"||c.q==="Lab")).slice(0,60);
  const cur=k=>cal[k]&&cal[k].until>now?`<span class="chip sky">${k==="builder"?"Builders":"Lab"}: time ×${cal[k].t.toFixed(3)}${cal[k].c!=null?", cost ×"+cal[k].c.toFixed(3):""} · from ${esc(cal[k].from)} · until ${dayStr(cal[k].until)} <button class="btn ghost sm" type="button" data-act="clearcal" data-q="${k}" aria-label="Clear">×</button></span>`:"";
  return`<div style="border-top:1px solid var(--line);padding-top:12px"><h3 style="margin-bottom:4px">Match in-game numbers</h3>
   <p class="small muted" style="margin:0 0 8px">If the game shows a different time or cost than the tracker, pick that upgrade and type what the game shows. All estimates for that queue use the same ratio until the current discount ends (or the season ends).</p>
   <div class="chips" style="margin-bottom:8px">${cur("builder")}${cur("lab")}</div>
   <form class="form-row" id="calForm">
    <label class="f" style="flex:2;min-width:220px">Upgrade<select id="calItem">${cands.map((c,i)=>{const co={};addRes(co,c.c,c.r);const k=Object.keys(co)[0];return`<option value="${i}">${esc(c.q)} · ${esc(c.name)} L${c.from}→L${c.to} · normally ${fmtDur(c.s)}${k?" · "+fmtNum(co[k])+" "+k:""}</option>`;}).join("")}</select></label>
    <label class="f">In-game time<input type="text" id="calTime" placeholder="1h 40m" style="width:110px" required></label>
    <label class="f">In-game cost (optional)<input type="text" id="calCost" placeholder="400K" style="width:110px"></label>
    <button class="btn sm" type="submit">Match</button>
   </form><div id="calErr" class="small" style="color:var(--bad)"></div></div>`;
}
/* live-effect adjusted display (Home Village only; walls, equipment and Builder Base stay at normal values) */
let FX=null;
function mult(q,base){if(!FX||base!=="h")return{t:1,c:1};if(q==="builder")return{t:FX.bT,c:FX.bC};if(q==="lab"||q==="pet")return{t:FX.lT,c:FX.lC};return{t:1,c:1};}
const tAdj=(rem,lock,m)=>(lock||0)+(rem-(lock||0))*m.t;
function timeCell(rem,lock,m){if(!rem)return"—";const a=tAdj(rem,lock,m);return Math.round(a)!==Math.round(rem)?`<b>${fmtDur(a)}</b> <s class="muted small">${fmtDur(rem)}</s>`:fmtDur(rem);}
function costCell(obj,keys,m){if(m.c===1)return resHTML(obj,keys);const ks=(keys||Object.keys(obj)).filter(k=>obj[k]>0);if(!ks.length)return resHTML(obj,keys);return resHTML(scaleRes(obj,m.c),keys)+` <s class="muted small">${ks.map(k=>fmtNum(obj[k])).join(" · ")}</s>`;}
function fxBanner(){return FX&&FX.labels.length?`<div class="banner info">Showing discounted time and cost for: ${FX.labels.map(esc).join(", ")}. Struck-through numbers are the normal values. Upgrades already running keep their timers, and walls, equipment and the Builder Base aren't discounted.</div>`:"";}
function helperLevels(exp){const o={apprentice:0,assistant:0};for(const h of exp.helpers||[]){if(h.data===93000000)o.apprentice=h.lvl;if(h.data===93000001)o.assistant=h.lvl;}return o;}
function scaleRes(o,m){const r={};for(const k in o)r[k]=o[k]*m;return r;}

/* ---------- rendering ---------- */
const main=$("#main");
function renderTabs(){$("#tabs").innerHTML=TABS.map(([k,l])=>`<button class="tab" role="tab" type="button" data-tab="${k}" aria-selected="${S.tab===k}">${l}</button>`).join("");}
function renderAcctSel(){
  const sel=$("#acctSel");const acc=Store.cache.accounts.slice().sort((a,b)=>(a.name||a.tag).localeCompare(b.name||b.tag));
  if(!acc.length){sel.innerHTML='<option value="">No accounts yet</option>';sel.disabled=true;return;}
  sel.disabled=false;
  if(!S.acct||!account(S.acct))S.acct=acc[0]._id;
  sel.innerHTML=acc.map(a=>`<option value="${esc(a._id)}" ${a._id===S.acct?"selected":""}>${esc(a.name?a.name+" · "+a.tag:a.tag)}</option>`).join("");
}
// one solid colour per bar, picked from red (0%) → amber (50%) → green (100%)
function progColor(p){const stops=[[229,72,77],[245,166,35],[63,185,80]];p=Math.max(0,Math.min(1,p||0));const i=p<.5?0:1,f=p<.5?p/.5:(p-.5)/.5;const a=stops[i],b=stops[i+1];return`rgb(${a.map((v,k)=>Math.round(v+(b[k]-v)*f)).join(",")})`;}
function bar(p,cls){const w=Math.max(0,Math.min(100,(p||0)*100));
  return`<div class="bar-track"><div class="bar-fill ${cls||""}" style="width:${w.toFixed(1)}%;background:${progColor(p)}"></div></div>`;}
function storageBanner(){return"";}

/* ---------- Clash of Clans API sync ----------
   The export has IDs but no names; the API (through worker.js) has names but no IDs. New equipment is
   matched by pairing the export's unknown equipment IDs, in ID order, with the API's equipment names the
   game data doesn't know, preferring equal levels. Costs come from an existing piece with the same max level:
   every epic shares one upgrade table, and commons nearly do. */
function equipTemplate(maxLevel){
  const eq=GAME.items.filter(i=>i.k==="equipment"&&!i.learned&&i.lv.length===maxLevel);
  const key=i=>JSON.stringify(i.lv.map(L=>[L[1],L[5]]));const n={};for(const i of eq)n[key(i)]=(n[key(i)]||0)+1;
  return eq.sort((a,b)=>n[key(b)]-n[key(a)])[0];
}
function matchEquipment(exp,api){
  const known=new Set(GAME.items.filter(i=>i.k==="equipment").map(i=>i.n.toLowerCase()));
  const ids=(exp.equipment||[]).filter(e=>!BY_ID[e.data]).sort((a,b)=>a.data-b.data);
  const fresh=(api.heroEquipment||[]).filter(e=>e.village==="home"&&!known.has(e.name.toLowerCase()));
  const out=[],skipped=[];
  for(const e of ids){
    const i=fresh.findIndex(f=>f.level===e.lvl);const f=fresh.splice(i>=0?i:0,1)[0];
    const tpl=f&&equipTemplate(f.maxLevel);
    if(!f||!tpl){skipped.push(e.data);continue;}
    const owner=(api.heroes||[]).find(h=>(h.equipment||[]).includes(f.name));
    out.push({id:e.data,n:f.name,b:"h",k:"equipment",lv:JSON.parse(JSON.stringify(tpl.lv)),
      x:{hero:owner?owner.name.toLowerCase().replace(/[^a-z0-9]+/g,"-"):"",rarity:f.maxLevel>=27?"epic":"common"},learned:true});
  }
  return{out,skipped};
}
async function syncNames(btn){
  const exp=CUR&&CUR.P.exp;if(!exp)return;
  btn.disabled=true;btn.textContent="Fetching…";
  try{
    let res,api;
    try{res=await fetch("/api/player?tag="+encodeURIComponent(exp.tag));api=await res.json();}
    catch(e){throw new Error("Sync needs the Cloudflare Worker, which isn't running on this copy of the site.");}
    if(!res.ok)throw new Error(api.error||("Sync failed ("+res.status+")"));
    const {out,skipped}=matchEquipment(exp,api);
    if(out.length){addLearned(out);try{localStorage.setItem(LEARNED_KEY,JSON.stringify(loadLearned().concat(out)));}catch(e){}memo.clear();}
    const other=[...(CUR.P.home.unknown||[]),...((CUR.P.bb&&CUR.P.bb.unknown)||[])].filter(id=>!BY_ID[id]&&!skipped.includes(id));
    toast(out.length?`Named ${out.map(i=>i.n).join(", ")}`+(skipped.length+other.length?` · ${skipped.length+other.length} still unknown`:""):"No new names matched. Only equipment can be named so far.");
    render();
  }catch(e){logErr("API sync",e);toast(e.message);btn.disabled=false;btn.textContent="Fetch names from Clash of Clans API";}
}

function render(){
  renderTabs();renderAcctSel();
  try{localStorage.setItem("coc-ledger-tab",S.tab);if(S.acct)localStorage.setItem("coc-ledger-acct",S.acct);}catch(e){}
  if(Store.mode==="loading"){main.innerHTML='<section class="panel empty"><h2>Opening your dashboard…</h2><p class="muted" style="margin:0">Loading saved accounts and snapshots.</p></section>';return;}
  if(S.tab==="events"){main.innerHTML=storageBanner()+viewEvents();return;}
  const snap=latest();
  if(!snap){main.innerHTML=storageBanner()+`<section class="panel empty"><h2>No village yet</h2><p class="muted" style="max-width:52ch;margin:0">Paste the JSON from Settings → More Settings → Data Export. The tracker reads your Town Hall, buildings, heroes, equipment, lab and Builder Base, and keeps every import as a dated snapshot.</p><button class="btn gold" type="button" data-act="import">Import your first export</button></section>`;return;}
  const P=parsed(snap);
  if(!P.exp||!P.home){CUR=null;main.innerHTML=`<div class="banner">This snapshot could not be read. Try importing the export again.</div>`+errPanel();return;}
  const V={snap,P,acc:account(S.acct),fx:effectsNow(S.acct)};FX=V.fx;CUR=V;{const de=document.documentElement;const th=P.home.th||0;if(th){de.dataset.th=String(Math.min(th,18));if(th>18)de.dataset.thMax="";else delete de.dataset.thMax;}}
  const views={overview:viewOverview,home:viewHome,heroes:viewHeroes,lab:viewLab,builder:viewBuilder,builders:builderPanel,planner:viewPlanner};
  try{main.innerHTML=storageBanner()+(["overview","home","heroes","lab","planner"].includes(S.tab)?fxBanner():"")+(views[S.tab]||viewOverview)(V);}
  catch(e){logErr("Showing the "+(TABS.find(x=>x[0]===S.tab)||[,S.tab])[1]+" tab",e);main.innerHTML=errPanel();return;}
  applySorts();
  if(S.tab==="overview")tick();
}

function catBars(v,keys){return`<div class="cats">${v.groups.filter(g=>!keys||keys.includes(g.key)).filter(g=>g.rows.length).map(g=>`<div class="cat-row"><span class="small" style="font-weight:800">${esc(g.label)}</span>${bar(g.pct,g.q==="lab"?"elix":g.q==="wall"||g.q==="ore"?"gold":"")}<span class="pct">${pct(g.pct)}</span></div>`).join("")}</div>`;}

function viewOverview(V){
  const h=V.P.home,b=V.P.bb,exp=V.P.exp,fx=V.fx;const hl=helperLevels(exp);const acc=V.acc||{};
  const vb=S.ovBase==="b"?"b":"h";
  const tmsFor=base=>timersOf(exp).filter(t=>t.base===base);
  const nextPanel=(base,tab)=>{const all=tmsFor(base);const up=all.filter(t=>t.to!=null);const cd=all.filter(t=>t.to==null);const tms=up;return`<section class="panel"><div class="panel-h"><h3>Finishing next · ${base==="Home"?"TH"+h.th:"BH"+(b?b.th:"")}</h3><span class="small muted"><span data-ups="${up.map(t=>t.end).join(",")}">${up.length} upgrade${up.length===1?"":"s"} running</span> · from the snapshot taken ${dateStr(V.snap.ts*1000)}; boosts or potions used since then aren't reflected</span></div>
    ${timerGroups(all,base,base==="Home"?(acc.builders||h.huts||1):(b?b.huts:1),base==="Home"?h.cur.lab:(b?b.cur.starlab:0))}</section>`;};
  const seg=`<div class="seg" role="group" aria-label="Village">${[["h","Home Village"],["b","Builder Base"]].map(([v,l])=>`<button type="button" data-act="ovbase" data-v="${v}" aria-pressed="${vb===v}">${l}</button>`).join("")}</div>`;
  const head=`<section class="panel"><div class="panel-h" style="margin:0"><h2>${esc(acc.name||exp.tag)} <span class="muted small" style="font-family:var(--body)">${esc(exp.tag)}</span></h2><span class="small muted">Snapshot ${dateStr(V.snap.ts*1000)}</span></div><div style="margin-top:12px">${seg}</div></section>`;
  const banner=errPanel();
  const dayTxt=(adj,base)=>Math.abs(adj-base)>0.05?`<b>≈ ${adj.toFixed(1)} days</b> <s>${base.toFixed(1)}</s>`:`≈ ${base.toFixed(1)} days`;

  if(vb==="h"){
    const builders=acc.builders||h.huts||1;
    const perDayB=builders*86400+hl.apprentice*3600, perDayL=86400+hl.assistant*3600;
    const mB=mult("builder","h"),mL=mult("lab","h"),mP=mult("pet","h");
    const bDays=h.builderTime/perDayB, lDays=h.labTime/perDayL;
    const fxB=tAdj(h.builderTime,h.builderLock,mB)/perDayB, fxL=tAdj(h.labTime,h.labLock,mL)/perDayL;
    return banner+head+`
  <section class="panel"><div class="hero-row">
    <div class="thart" role="img" aria-label="Town Hall ${h.th}" title="Town Hall ${h.th}">${TH_IMG[h.th]?`<img src="${TH_IMG[h.th]}" alt="" class="thart-img">`:thArt(h.th)}<span class="thart-lv">TH${h.th}</span></div>
    <div style="display:flex;flex-direction:column;gap:8px;min-width:0">
      <div class="panel-h" style="margin:0"><h2>Home Village</h2><button class="btn ghost sm" type="button" data-tab="home">Details</button></div>
      <div style="display:flex;align-items:baseline;gap:12px;flex-wrap:wrap"><span class="bigpct">${pct(h.overall)}</span><span class="muted">of TH${h.th} builder &amp; lab work done</span></div>
      ${bar(h.overall,"gold")}
      <div class="chips">${h.hallUp?`<span class="chip sky">Upgrading to TH${h.th+1} · done ${dateStr(h.hallUp)}</span>`:""}${fx.labels.length?fx.labels.map(l=>`<span class="chip gold">${esc(l)}</span>`).join(""):'<span class="chip">No active boosts</span>'}${h.gearUps?`<span class="chip sky">${h.gearUps} geared up</span>`:""}${hl.assistant?`<span class="chip">Lab Assistant L${hl.assistant}</span>`:""}${hl.apprentice?`<span class="chip">Builder's Apprentice L${hl.apprentice}</span>`:""}</div>
    </div></div></section>
  <section class="grid g3">
    <div class="panel stat"><span class="k">Builder time left</span><span class="v">${fmtDur(tAdj(h.builderTime,h.builderLock,mB))}</span><span class="s">${mB.t!==1?`normally ${fmtDur(h.builderTime)} · `:""}${dayTxt(fxB,bDays)} with ${builders} builder${builders>1?"s":""}${hl.apprentice?" + apprentice":""}</span></div>
    <div class="panel stat"><span class="k">Lab time left</span><span class="v">${fmtDur(tAdj(h.labTime,h.labLock,mL))}</span><span class="s">${mL.t!==1?`normally ${fmtDur(h.labTime)} · `:""}${dayTxt(fxL,lDays)}${hl.assistant?" with Lab Assistant":""}${h.petTime?` · pets ${fmtDur(tAdj(h.petTime,h.petLock,mP))}`:""}</span></div>
    <div class="panel stat"><span class="k">Resources to max TH${h.th}</span><span class="v" style="font-size:1.15rem;font-family:var(--body);font-weight:800;display:flex;flex-wrap:wrap;gap:4px 12px">${resHTML(addAll(scaleRes(h.builderCost,mB.c),scaleRes(h.labCost,mL.c)),["G","E","D"])}</span>${mB.c!==1||mL.c!==1?`<span class="s">normally ${resHTML(addAll(h.builderCost,h.labCost),["G","E","D"])}</span>`:""}<span class="s">Walls ${resHTML(h.wallCost,["G"])} · Ore ${resHTML(h.ore,["SO","GO","SR"])}</span></div>
  </section>
  <section class="panel"><div class="panel-h"><h3>Progress by category · TH${h.th}</h3><button class="btn ghost sm" type="button" data-tab="home">Details</button></div>${catBars(h)}</section>
  `+nextPanel("Home","home");
  }

  if(!b)return banner+head+`<section class="panel empty"><h2>Builder Base not unlocked</h2><p class="muted">This export has no Builder Hall yet.</p></section>`;
  const bbClock=exp.boosts&&exp.boosts.clocktower_cooldown;
  return banner+head+`
  <section class="panel"><div class="hero-row">
    ${bhArt(b.th)}
    <div style="display:flex;flex-direction:column;gap:8px;min-width:0">
      <div class="panel-h" style="margin:0"><h2>Builder Base</h2><button class="btn ghost sm" type="button" data-tab="builder">Details</button></div>
      <div style="display:flex;align-items:baseline;gap:12px;flex-wrap:wrap"><span class="bigpct">${pct(b.overall)}</span><span class="muted">of BH${b.th} builder &amp; Star Lab work done</span></div>
      ${bar(b.overall,"gold")}
      <div class="chips">${b.hallUp?`<span class="chip sky">Upgrading to BH${b.th+1} · done ${dateStr(b.hallUp)}</span>`:""}${ottoChips(b,exp)}${bbClock?`<span class="chip">Clock Tower ready ${dateStr(exp.timestamp*1000+bbClock*1000)}</span>`:""}<span class="chip">Home Village boosts don't apply here</span></div>
    </div></div></section>
  <section class="grid g3">
    <div class="panel stat"><span class="k">Builder time left</span><span class="v">${fmtDur(b.builderTime)}</span><span class="s">≈ ${(b.builderTime/(b.huts*86400)).toFixed(1)} days with ${b.huts} builder${b.huts>1?"s":""} · buildings, traps &amp; heroes to max BH${b.th} (walls not included)</span></div>
    <div class="panel stat"><span class="k">Star Lab time left</span><span class="v">${fmtDur(b.labTime)}</span><span class="s">Troop research to max BH${b.th}</span></div>
    <div class="panel stat"><span class="k">Resources to max BH${b.th}</span><span class="v" style="font-size:1.15rem;font-family:var(--body);font-weight:800;display:flex;flex-wrap:wrap;gap:4px 12px">${resHTML(addAll(b.builderCost,b.labCost),["BG","BE"])}</span><span class="s">Walls ${resHTML(b.wallCost,["BG"])}</span></div>
  </section>
  <section class="panel"><div class="panel-h"><h3>Progress by category · BH${b.th}</h3><button class="btn ghost sm" type="button" data-tab="builder">Details</button></div>${catBars(b)}</section>
  `+nextPanel("Builder Base","builder");
}
function addAll(...os){const r={};for(const o of os)for(const k in o)r[k]=(r[k]||0)+o[k];return r;}
function timerCard(t){const dn=t.end<=Date.now();return`<div class="timer${dn?" done":""}" data-end="${t.end}"${helpAttr(t)}><div><b>${esc(t.name)}</b> ${helpIcon(t)}${t.to?` <span class="muted">→ L${t.to}</span>`:""}<div class="small muted">${esc(t.base)} · ${esc(t.q)} · <span class="when">${dn?"Finished ":""}${dateStr(t.end)}</span></div>${helpLine(t)}</div><div class="cd tnum">${fmtCd(cdLeft(t,Date.now()))}</div></div>`;}
function tStart(t){return t.full?t.end-t.full*1000:0;}
function tPct(st,end,now){return st&&end>st?Math.max(0,Math.min(1,(now-st)/(end-st))):null;}
function timerCardA(t){const now=Date.now(),dn=t.end<=now,st=t.to!=null?tStart(t):0,p=tPct(st,t.end,now);
  return`<div class="tA${dn?" done":""}" data-end="${t.end}"${st?` data-start="${st}"`:""}${t.help?` data-full="${t.full}"`:""}${helpAttr(t)}><div class="tA-h"><b>${esc(t.name)} ${helpIcon(t)}</b>${t.to?`<span class="tA-lv">L${t.to-1} → L${t.to}</span>`:""}</div>${st?`<div class="tA-trk"><div class="tA-fl" style="width:${dn?100:Math.round(p*100)}%"></div></div>`:""}<div class="tA-f"><span class="small muted"><span class="pc">${!dn&&p!=null?Math.round(p*100)+"% · ":""}</span>${esc(t.q)} · <span class="when">${dn?"Finished ":""}${dateStr(t.end)}</span></span><span class="cd tnum">${fmtCd(cdLeft(t,now))}</span></div>${helpLine(t)}</div>`;}
/* Builder unlocks: Builder's Huts 2–5 cost gems (the first is free); the 6th builder, B.O.B, comes from the Builder Base.
   B.O.B Control (Builder Hall 9) gains a level for each task done, and at level 5 it becomes B.O.B's Hut in the Home Village.
   Tasks from Supercell's Builder Base 2.0 announcement (2023). */
const HUT_GEMS=[0,250,500,1000,2000];
const GEM_IC='<img src="assets/icons/gem.png" alt="gems" class="gem-ic">';
const HUT_IC='<img src="assets/icons/builder-hut.png" alt="" class="hut-ic">';
const BOTO_IC='<img src="assets/icons/boto-shack.png" alt="" class="hut-ic">';
const BOB_IC=BOTO_IC;
const HELPER_IC='<img src="assets/icons/helper-hut.png" alt="" class="hut-ic">';
const LAB_IMG={"1": "assets/labs/lab1.png", "2": "assets/labs/lab2.png", "3": "assets/labs/lab3.png", "4": "assets/labs/lab4.png", "5": "assets/labs/lab5.png", "6": "assets/labs/lab6.png", "7": "assets/labs/lab7.png", "8": "assets/labs/lab8.png", "9": "assets/labs/lab9.png", "10": "assets/labs/lab10.png", "11": "assets/labs/lab11.png", "12": "assets/labs/lab12.png", "13": "assets/labs/lab13.png", "14": "assets/labs/lab14.png", "15": "assets/labs/lab15.png", "16": "assets/labs/lab16.png", "17": "assets/labs/lab17.png"};
// Star Laboratory by level; 0 is the ruin before it's rebuilt
const STARLAB_IMG={"0": "assets/starlabs/starlab0.png", "1": "assets/starlabs/starlab1.png", "2": "assets/starlabs/starlab2.png", "3": "assets/starlabs/starlab3.png", "4": "assets/starlabs/starlab4.png", "5": "assets/starlabs/starlab5.png", "6": "assets/starlabs/starlab6.png", "7": "assets/starlabs/starlab7.png", "8": "assets/starlabs/starlab8.png", "9": "assets/starlabs/starlab9.png", "10": "assets/starlabs/starlab10.png"};
const starLabIc=l=>STARLAB_IMG[l]?`<img src="${STARLAB_IMG[l]}" alt="" class="hut-ic lab-ic" title="${l?"Star Laboratory L"+l:"Star Laboratory ruin"}">`:"⚗️";
const labIc=l=>LAB_IMG[l]?`<img src="${LAB_IMG[l]}" alt="" class="hut-ic lab-ic" title="Laboratory L${l}">`:"⚗️";
function builderPanel(V){
  const exp=V.P.exp,b=V.P.bb;
  const cnt=id=>(exp.buildings||[]).filter(e=>e.data===id).reduce((n,e)=>n+(e.cnt||1),0);
  const huts=Math.min(5,cnt(ID.HUT)),bobHut=(exp.buildings||[]).some(e=>e.data===ID.BOB_HUT&&e.lvl>0);
  const ctrl=Math.max(0,...(exp.buildings2||[]).filter(e=>e.data===ID.BOB_CTRL).map(e=>e.lvl||0));
  const gemsAll=sum(HUT_GEMS),gemsSpent=sum(HUT_GEMS.slice(0,huts)),gemsLeft=gemsAll-gemsSpent;
  const bbTroop=Math.max(0,...(exp.units2||[]).map(e=>e.lvl||0));
  const bbDef=Math.max(0,...(exp.buildings2||[]).filter(e=>{const it=BY_ID[e.data];return it&&it.k==="defense"&&e.data!==ID.OTTO;}).map(e=>e.lvl||0));
  const bbHeroes=sum((exp.heroes2||[]).map(e=>e.lvl||0));
  const gear=(exp.buildings||[]).filter(e=>e.gear_up).reduce((n,e)=>n+(e.cnt||1),0);
  const bh=b?b.th:0;
  const tasks=[
    {ic:"🏰",label:"Builder Hall",note:"then build B.O.B Control",sub:"Reach Builder Hall 9, then build B.O.B Control",cur:bh,goal:9,unit:"BH"},
    {ic:"⚙️",label:"Gear Ups",note:"in the Home Village",sub:"Gear Up 3 Home Village buildings",cur:gear,goal:3,unit:""},
    {ic:"⚔️",label:"Troop level",note:"Builder Base, highest troop",sub:"Upgrade a Builder Base troop to level 18",cur:bbTroop,goal:18,unit:"L"},
    {ic:"🛡️",label:"Defence level",note:"Builder Base, highest defence",sub:"Upgrade a Builder Base defence to level 9",cur:bbDef,goal:9,unit:"L"},
    {ic:"🦸",label:"Hero levels",note:"Battle Machine + Battle Copter",sub:"Battle Machine and Battle Copter at a combined level of 45",cur:bbHeroes,goal:45,unit:"L"},
  ].map(t=>Object.assign(t,{p:Math.min(1,t.cur/t.goal),done:t.cur>=t.goal}));
  const nDone=tasks.filter(t=>t.done).length;
  const bobP=bobHut?1:sum(tasks.map(t=>t.p))/tasks.length;
  const total=huts+(bobHut?1:0);
  // 6 slots: five huts and B.O.B, the last one filled as far as his tasks are
  const slots=[...Array(6)].map((_,i)=>{const bob=i===5,on=bob?bobHut:i<huts,p=bob?bobP:(on?1:0);
    return`<div class="bslot${on?" on":""}${bob?" bob":""}" title="${bob?"B.O.B":"Builder "+(i+1)}"><div class="bslot-fill" style="height:${Math.round(p*100)}%"></div><span class="bslot-ic" aria-hidden="true">${bob?BOB_IC:HUT_IC}</span><span class="bslot-n">${bob?"B.O.B":i+1}</span>${bob&&!on?`<span class="bslot-p">${Math.round(p*100)}%</span>`:""}</div>`;}).join("");
  const hutCards=HUT_GEMS.map((g,i)=>{const on=i<huts;return`<div class="hutc${on?" on":""}" title="${g?fmtNum(g)+" gems":"free"}"><span class="hutc-n">${on?"✓":"○"} Builder ${i+1}</span><span class="hutc-v small">${g?fmtNum(g)+" "+GEM_IC:"free"}</span></div>`;}).join("");
  const steps=[1,2,3,4,5].map(l=>`<div class="bstep${(bobHut||ctrl>=l)?" on":""}${!bobHut&&l===ctrl+1?" next":""}"><span class="bstep-dot">${(bobHut||ctrl>=l)?"✓":l}</span><span class="bstep-l small">${l===5?"Hut":"L"+l}</span></div>`).join("");
  const canUp=!bobHut&&nDone>ctrl&&ctrl>0?`<p class="banner info" style="margin:12px 0 0">B.O.B Control can go to L${Math.min(5,nDone)}</p>`:"";
  const taskCards=tasks.map(t=>`<li class="btask${t.done?" done":""}" title="${esc(t.sub)}"><span class="btask-ic" aria-hidden="true">${t.done?"✅":t.ic}</span><span class="btask-l"><b>${t.label}</b><span class="btask-n small muted">${t.note}</span></span><span class="btask-v tnum">${Math.min(t.cur,t.goal)}<span class="muted">/${t.goal}</span></span>${bar(t.p,t.done?"":"gold")}<span class="pct">${Math.round(t.p*100)}%</span></li>`).join("");
  return`<section class="panel"><div class="hero-row" style="align-items:center">
      <div><div class="bigpct" style="font-size:1.9rem">${total}<span class="muted" style="font-size:.55em"> / 6</span></div><div class="small muted">Home Village</div></div>
      <div class="bslots" role="img" aria-label="${total} of 6 builders unlocked">${slots}</div></div></section>
    <section class="panel"><div class="panel-h"><h3>${HUT_IC} Builder's Huts</h3><span class="small muted">${huts}/5${gemsLeft?" · "+fmtNum(gemsLeft)+" "+GEM_IC+" to go":""}</span></div>
      <div class="cats" style="margin-bottom:12px"><div class="cat-row"><span class="small" style="font-weight:800">${GEM_IC} Gems</span>${bar(gemsSpent/gemsAll)}<span class="pct">${pct(gemsSpent/gemsAll)}</span></div></div>
      <div class="hutcs">${hutCards}</div></section>
    <section class="panel"><div class="panel-h"><h3>${BOB_IC} 6th builder: B.O.B</h3><span class="small muted">${bobHut?"✓ working":""}</span></div>
      <div class="bsteps" title="B.O.B Control: each finished task unlocks one level; at level 5 it becomes B.O.B's Hut. B.O.B can't be bought with gems. Tasks from Supercell's Builder Base 2.0 announcement.">${steps}</div>
      ${bobHut?"":`<ul class="btasks">${taskCards}<li class="btask btask-tot"><span class="btask-ic" aria-hidden="true">${BOB_IC}</span><span class="btask-l"><b>Overall</b></span><span class="btask-v tnum">${nDone}<span class="muted">/5</span></span>${bar(bobP,"gold")}<span class="pct">${Math.round(bobP*100)}%</span></li></ul>`}${canUp}</section>`+bbBuilderPanel(V);}
/* Builder Base builders: the Master Builder; O.T.T.O, from O.T.T.O's Outpost at Builder Hall 6; and B.O.T.O,
   from B.O.T.O's Shack, bought for 1,000 gems once the Builder Hall is level 2 and all 5 Builder's Huts are unlocked.
   B.O.T.O's Shack isn't in any data source yet, so it can't be detected in an export. */
const BOTO_GEMS=1000;
function bbBuilderPanel(V){
  const exp=V.P.exp,b=V.P.bb,bh=b?b.th:0,otto=b?b.otto>0:false;
  const huts=Math.min(5,(exp.buildings||[]).filter(e=>e.data===ID.HUT).reduce((n,e)=>n+(e.cnt||1),0));
  const have=1+(otto?1:0);
  const slots=[["Master",b?1:0,HUT_IC],["O.T.T.O",otto?1:Math.min(1,bh/6),BOTO_IC],["B.O.T.O",0,BOTO_IC]].map(([n,p,ic])=>`<div class="bslot${p>=1?" on":""}${p<1?" bob":""}" title="${n}"><div class="bslot-fill" style="height:${Math.round(p*100)}%"></div><span class="bslot-ic" aria-hidden="true">${ic}</span><span class="bslot-n">${n}</span>${p<1&&p>0?`<span class="bslot-p">${Math.round(p*100)}%</span>`:""}</div>`).join("");
  const row=(ic,label,note,cur,goal,tip)=>{const p=goal?Math.min(1,cur/goal):1,done=cur>=goal;return`<li class="btask${done?" done":""}" title="${esc(tip)}"><span class="btask-ic" aria-hidden="true">${done?"✅":ic}</span><span class="btask-l"><b>${label}</b><span class="btask-n small muted">${note}</span></span><span class="btask-v tnum">${Math.min(cur,goal)}<span class="muted">/${goal}</span></span>${bar(p,done?"":"gold")}<span class="pct">${Math.round(p*100)}%</span></li>`;};
  return`<section class="panel"><div class="hero-row" style="align-items:center">
      <div><div class="bigpct" style="font-size:1.9rem">${have}<span class="muted" style="font-size:.55em"> / 3</span></div><div class="small muted">Builder Base</div></div>
      <div class="bslots" style="max-width:190px;grid-template-columns:repeat(3,minmax(0,1fr))">${slots}</div></div></section>
    <section class="panel"><div class="panel-h"><h3>${BOTO_IC} O.T.T.O</h3><span class="small muted">${otto?"✓ working":"unlocks at BH6"}</span></div>
      <ul class="btasks">${row("🏰","Builder Hall","build O.T.T.O's Outpost at BH6",bh,6,"Reach Builder Hall 6 to build O.T.T.O's Outpost; O.T.T.O works from it")}</ul></section>
    <section class="panel"><div class="panel-h"><h3>${BOTO_IC} B.O.T.O</h3><span class="small muted">${fmtNum(BOTO_GEMS)} ${GEM_IC}</span></div>
      <ul class="btasks">${row("🏰","Builder Hall","Builder Base, BH2",bh,2,"B.O.T.O's Shack needs Builder Hall 2")}${row(HUT_IC,"Builder's Huts","all 5 in the Home Village",huts,5,"B.O.T.O's Shack needs all 5 Home Village Builder's Huts")}<li class="btask"><span class="btask-ic" aria-hidden="true">${GEM_IC}</span><span class="btask-l"><b>Gems</b><span class="btask-n small muted">buy B.O.T.O's Shack</span></span><span class="btask-v tnum">${fmtNum(BOTO_GEMS)}</span><span></span><span></span></li></ul>
      <p class="small muted" style="margin:10px 0 0">B.O.T.O's Shack isn't in the game data yet, so the dashboard can't tell whether you've built it. Send an export after building it to add it.</p></section>`;}
/* Overview timers split by who is working: builders, the lab (Star Lab on the Builder Base), the Pet House, and helpers and boosts */
const T_GROUPS=[
  {key:"bld",ic:HUT_IC,label:"Builders",test:t=>t.to!=null&&/^Builder/.test(t.q)},
  {key:"lab",ic:o=>o.H?(o.lab?labIc(o.lab):"⚗️"):starLabIc(o.lab||0),label:"Laboratory",test:t=>t.to!=null&&/Lab/.test(t.q)},
  {key:"pet",ic:"🐾",label:"Pet House",test:t=>t.to!=null&&/Pet/.test(t.q)},
  {key:"cool",ic:HELPER_IC,label:"Helpers & boosts",test:t=>t.to==null},
];
function timerGroups(all,base,builders,lab){
  if(!all.length)return'<p class="muted">Nothing upgrading in this village.</p>';
  const H=base==="Home";const used=new Set();
  return T_GROUPS.map(g=>{const l=all.filter(t=>!used.has(t)&&g.test(t));l.forEach(t=>used.add(t));
    const label=g.key==="lab"&&!H?"Star Laboratory":g.label;
    const busy=g.key==="bld"?`${l.length} of ${builders} busy`:g.key==="lab"||g.key==="pet"?(l.length?"busy":"idle"):`${l.length}`;
    if(!l.length&&g.key!=="bld"&&!(g.key==="lab"))return"";
    return`<div class="tgrp"><h4 class="tgrp-h"><span aria-hidden="true">${typeof g.ic==="function"?g.ic({H,lab}):g.ic}</span> ${label} <span class="small muted">· ${busy}</span></h4>${l.length?`<div class="timers">${l.map(timerTileC).join("")}</div>`:`<p class="small muted" style="margin:0">Nothing running. ${g.key==="bld"?"Every builder is free.":"The lab is free."}</p>`}</div>`;}).join("");}
function timerTileC(t){const now=Date.now(),dn=t.end<=now;const lab=/Lab/.test(t.q),pet=/Pet/.test(t.q),cool=t.to==null;const cls=cool?"cool":pet?"pet":lab?"lab":"bld";const ic=cool?"⏱️":pet?"🐾":lab?"⚗️":"🔨";const lbl=cool?t.q:lab?t.q:pet?"Pet House":/hero/.test(t.q)?"Builder · hero":"Builder";
  return`<div class="tC ${cls}${dn?" done":""}" data-end="${t.end}" data-wp="Ends "${helpAttr(t)}><div class="tC-top"><div class="tC-n"><b>${esc(t.name)}</b>${t.to?` <span class="small muted">→ L${t.to}</span>`:""}</div><span class="tC-ics">${helpIcon(t)}<span class="tC-ic" role="img" title="${esc(lbl)}" aria-label="${esc(lbl)}">${ic}</span></span></div><div class="cd tnum">${fmtCd(cdLeft(t,now))}</div><span class="small muted when">${dn?"Finished ":"Ends "}${dateStr(t.end)}</span>${helpLine(t)}</div>`;}
function timerRowB(t){const now=Date.now(),dn=t.end<=now;const lab=/Lab/.test(t.q),cool=t.to==null;const cls=lab?"lab":cool?"cool":"bld";const ic=lab?"⚗️":cool?"⏱️":"🔨";
  return`<div class="tB ${cls}${dn?" done":""}" data-end="${t.end}" data-wp="Ends "${helpAttr(t)}><span class="tB-ic" aria-hidden="true">${ic}</span>${helpIcon(t)}<div class="tB-m"><b>${esc(t.name)}</b> <span class="small muted">${t.to?`L${t.to-1} → L${t.to} · `:""}<span class="when">${dn?"Finished ":"Ends "}${dateStr(t.end)}</span></span>${helpLine(t)}</div><span class="tB-pill cd tnum">${fmtCd(cdLeft(t,now))}</span></div>`;}
let tickH=null;function tick(){clearInterval(tickH);const run=()=>{const now=Date.now();document.querySelectorAll("[data-end]").forEach(el=>{const end=+el.dataset.end;let s=(end-now)/1000;let hp=null;if(el.dataset.help){try{hp=JSON.parse(el.dataset.help);}catch(e){}}const gs=hp?helpLeft(hp,+el.dataset.ts,now):s;if(hp)s=Math.min(s,gs);const c=el.querySelector(".cd");if(c)c.textContent=fmtCd(gs);if(hp){const hl=el.querySelector(".help");if(hl)hl.textContent=helpStatus(hp,+el.dataset.ts,now);const hi=el.querySelector(".help-ic");if(hi)hi.hidden=!helpWorking(hp,+el.dataset.ts,now);}el.classList.toggle("done",s<=0);const w=el.querySelector(".when");if(w)w.textContent=(s<=0?"Finished ":(el.dataset.wp||""))+dateStr(end);const st=+el.dataset.start;if(st){const full=+el.dataset.full;const p=s<=0?1:hp&&full?Math.max(0,Math.min(1,1-gs/full)):tPct(st,end,now);const f=el.querySelector(".tA-fl");if(f)f.style.width=Math.round(p*100)+"%";const pc=el.querySelector(".pc");if(pc)pc.textContent=s<=0?"":Math.round(p*100)+"% · ";}});document.querySelectorAll("[data-ups]").forEach(el=>{const e=el.dataset.ups?el.dataset.ups.split(",").map(Number):[];const d=e.filter(x=>x<=now).length,r=e.length-d;el.textContent=`${r} upgrade${r===1?"":"s"} running${d?` · ${d} done`:""}`;});};run();tickH=setInterval(run,1000);}

function copiesStr(r){const m={};for(const c of r.copies){const k=c.missing?"–":c.lvl+(c.timer?"↑":"");m[k]=(m[k]||0)+1;}return Object.entries(m).sort((a,b)=>parseInt(a[0])-parseInt(b[0])).map(([l,n])=>`<span class="lvl">${n>1?n+"×":""}${l==="–"?'<span style="color:var(--bad)">new</span>':"L"+l}</span>`).join(" ");}
function statusChips(r){const c=[];const maxed=r.copies.every(x=>x.lvl>=r.maxL);if(maxed)c.push('<span class="chip good">Maxed</span>');else if(r.copies.every(x=>x.lvl>=r.maxL||(x.timer&&x.lvl+1>=r.maxL)))c.push('<span class="chip good">Maxed when done</span>');if(r.upgrading)c.push(`<span class="chip sky">Upgrading ${r.upgrading>1?r.upgrading:""}</span>`);if(r.missing)c.push(`<span class="chip bad">${r.missing} to build</span>`);if(r.rushed)c.push(`<span class="chip warn">${r.rushed} rushed</span>`);if(r.locked)c.push(`<span class="chip">needs ${esc(r.next.find(n=>n.blocked).blocked)} upgrade</span>`);if(r.copies.some(x=>x.gear))c.push('<span class="chip sky">Geared up</span>');if(r.copies.some(x=>x.helper))c.push(`<span class="chip">${HELPER_NAME[helperFor({data:r.id})]}</span>`);return c.join(" ");}
function groupTable(g,opts){
  opts=opts||{};const resKeys=g.q==="ore"?["SO","GO","SR"]:null;const m=mult(g.q,g.base);
  const pctLbl=v=>v!==1?` <span class="chip gold">${Math.round((v-1)*100)}%</span>`:"";
  const rows=g.rows.slice().sort((a,b)=>(b.rem-a.rem)||a.name.localeCompare(b.name));
  return`<section class="panel"><div class="panel-h"><h3>${esc(g.label)}</h3><span class="small muted">${pct(g.pct)} · ${g.w==="time"?timeCell(g.remTime,g.lock,m)+" left · ":""}${costCell(g.remCost,resKeys,m)}</span></div>${bar(g.pct,g.q==="lab"?"elix":g.q==="wall"||g.q==="ore"?"gold":"")}
  <div class="tbl-wrap" style="margin-top:12px"><table><thead><tr><th>Item</th><th>Current</th><th class="r">Max</th><th>Progress</th>${g.w==="time"?`<th class="r">Time left${pctLbl(m.t)}</th>`:""}<th class="r">Cost left${pctLbl(m.c)}</th><th>Status</th></tr></thead><tbody>
  ${rows.map(r=>{const lvSum=sum(r.copies.map(c=>Math.max(0,Math.min(c.lvl,r.maxL))));const tot=r.copies.length*r.maxL||1;const p=r.done+r.rem>0?r.done/(r.done+r.rem):lvSum/tot;
    const ex=r.copies.length>1&&g.q!=="wall";const rk=g.base+"-"+g.key+"-"+r.id;const op=ex&&S.open.has(rk);
    return`<tr${ex?' class="has-copies"':""}><td>${ex?`<button class="xp" type="button" data-act="copies" data-k="${esc(rk)}" aria-expanded="${op}" aria-label="Show each ${esc(r.name)}">▸</button>`:""}<b>${esc(r.name)}</b>${r.x&&r.x.hero?`<div class="small muted">${esc(heroName(r.x.hero))} · ${esc(r.x.rarity||"")}</div>`:""}</td><td>${copiesStr(r)}</td><td class="r lvl">${r.maxL||"—"}</td><td>${(()=>{const pv=r.copies.every(x=>x.lvl>=r.maxL)?1:p;return`<div style="display:flex;align-items:center;gap:8px"><div class="mini">${bar(pv,g.q==="lab"?"elix":"")}</div><span class="small tnum" style="font-weight:800;min-width:44px;text-align:right">${pct(pv)}</span></div>`;})()}</td>${g.w==="time"?`<td class="r tnum">${timeCell(r.remTime,r.lock,m)}</td>`:""}<td class="r small">${costCell(r.remCost,resKeys,m)}</td><td>${statusChips(r)}</td></tr>${ex?copyRows(g,r,rk,op,m,resKeys):""}`;}).join("")}
  </tbody></table></div></section>`;
}
function copyRows(g,r,rk,op,m,resKeys){
  const cs=r.copies.map((c,i)=>({c,i})).sort((a,b)=>((a.c.missing?1:0)-(b.c.missing?1:0))||(b.c.lvl-a.c.lvl)||(a.i-b.i));
  return cs.map(({c},n)=>{const tot=(c.done||0)+(c.rem||0);const pv=c.missing?0:c.lvl>=r.maxL?1:tot>0?c.done/tot:0;
    const ch=[];if(c.missing)ch.push('<span class="chip bad">To build</span>');else if(c.lvl>=r.maxL)ch.push('<span class="chip good">Maxed</span>');else if(c.timer&&c.lvl+1>=r.maxL)ch.push('<span class="chip good">Maxed when done</span>');
    if(c.timer)ch.push('<span class="chip sky">Upgrading</span>');if(!c.missing&&c.lvl<r.prevMax)ch.push('<span class="chip warn">Rushed</span>');if(c.gear)ch.push('<span class="chip sky">Geared up</span>');
    return`<tr class="copy-row" data-p="${esc(rk)}"${op?"":" hidden"}><td><span class="copy-n">${esc(r.name)} #${n+1}</span></td><td><span class="lvl">${c.missing?'<span style="color:var(--bad)">new</span>':"L"+c.lvl+(c.timer?"↑":"")}</span></td><td class="r lvl">${r.maxL||"—"}</td><td><div style="display:flex;align-items:center;gap:8px"><div class="mini">${bar(pv,g.q==="lab"?"elix":"")}</div><span class="small tnum" style="font-weight:800;min-width:44px;text-align:right">${pct(pv)}</span></div></td>${g.w==="time"?`<td class="r tnum">${timeCell(c.remTime||0,c.lock||0,m)}</td>`:""}<td class="r small">${costCell(c.remCost||{},resKeys,m)}</td><td>${ch.join(" ")}</td></tr>`;}).join("");
}
/* Town Hall pictures supplied by the user, one per level */
const TH_IMG={"1": "assets/townhalls/th1.webp", "2": "assets/townhalls/th2.webp", "3": "assets/townhalls/th3.webp", "4": "assets/townhalls/th4.webp", "5": "assets/townhalls/th5.webp", "6": "assets/townhalls/th6.webp", "7": "assets/townhalls/th7.webp", "8": "assets/townhalls/th8.webp", "9": "assets/townhalls/th9.webp", "10": "assets/townhalls/th10.webp", "11": "assets/townhalls/th11.webp", "12": "assets/townhalls/th12.webp", "13": "assets/townhalls/th13.webp", "14": "assets/townhalls/th14.webp", "15": "assets/townhalls/th15.webp", "16": "assets/townhalls/th16.webp", "17": "assets/townhalls/th17.webp", "18": "assets/townhalls/th18.webp"};
const BH_IMG={"3": "assets/builderhalls/bh3.png", "4": "assets/builderhalls/bh4.png", "5": "assets/builderhalls/bh5.png", "6": "assets/builderhalls/bh6.png", "7": "assets/builderhalls/bh7.png", "8": "assets/builderhalls/bh8.png", "9": "assets/builderhalls/bh9.png", "10": "assets/builderhalls/bh10.png"};
function ottoChips(b,exp){if(!b.otto)return"";const r=b.groups.flatMap(g=>g.rows).find(r=>r.id===ID.OTTO),c=r.copies[0];return`<span class="chip">O.T.T.O's Outpost L${b.otto} of ${r.maxL} · 2nd builder</span>`+(c.timer?`<span class="chip sky">Outpost → L${b.otto+1} · done ${dateStr((exp.timestamp+c.timer)*1000)}</span>`:"");}
function bhArt(bh){return BH_IMG[bh]?`<div class="thart bh" role="img" aria-label="Builder Hall ${bh}" title="Builder Hall ${bh}"><img src="${BH_IMG[bh]}" alt="" class="thart-img"><span class="thart-lv">BH${bh}</span></div>`:`<div class="thbadge bh"><div><b>${bh}</b><span>Builder Hall</span></div></div>`;}
function thArt(th){th=+th||1;const two=th>=5,spires=th>=10,crown=th>=13,banner=th>=7;
  const cren=(x,y,w,n)=>{let s="";const cw=w/(n*2-1);for(let i=0;i<n;i++)s+=`<rect x="${(x+i*2*cw).toFixed(1)}" y="${y-5}" width="${cw.toFixed(1)}" height="5" class="ta-st"/>`;return s;};
  const tower=x=>`<rect x="${x}" y="36" width="18" height="46" class="ta-st2"/>${spires?`<path d="M${x-2} 36 L${x+9} 18 L${x+20} 36Z" class="ta-rf"/>`:cren(x,36,18,3)}<rect x="${x+6}" y="48" width="6" height="9" rx="3" class="ta-gl"/>`;
  return`<svg viewBox="0 0 100 100" aria-hidden="true"><ellipse cx="50" cy="86" rx="44" ry="7" class="ta-gr"/>${two?tower(8)+tower(74):""}<rect x="24" y="40" width="52" height="44" class="ta-st"/><path d="M24 52H76M24 64H76M24 76H76M38 40V52M62 40V52M50 52V64M36 64V76M64 64V76" class="ta-ln"/><path d="M20 41 L50 ${crown?14:20} L80 41Z" class="ta-rf"/>${crown?`<path d="M46 16 L50 4 L54 16Z" class="ta-rf"/>`:""}${banner?`<path d="M50 ${crown?6:20} V${crown?-2:8}" class="ta-ln" style="stroke-width:1.5"/><path d="M50 ${crown?-2:8} h12 l-4 4 l4 4 h-12Z" class="ta-fl"/>`:""}<path d="M42 84 V72 a8 8 0 0 1 16 0 V84Z" class="ta-dr"/><rect x="30" y="55" width="7" height="7" rx="1" class="ta-gl"/><rect x="63" y="55" width="7" height="7" rx="1" class="ta-gl"/>${th>=9?`<circle cx="50" cy="32" r="4" class="ta-gl"/>`:""}</svg>`;}
/* ===== Click a column header to sort: ascending → descending → original order ===== */
const SORTS={};
function sortKeyFor(tbl){const all=[...document.querySelectorAll("main table")];return S.tab+":"+(S.tab==="overview"?(S.ovBase||"h"):"")+":"+all.indexOf(tbl)+":"+[...tbl.tHead.rows[0].cells].map(c=>c.textContent.trim()).join("|");}
function cellVal(td){if(!td)return null;if(td.dataset.sv!=null)return +td.dataset.sv;const s=td.textContent.replace(/\s+/g," ").trim();if(!s||s==="—"||s==="-"||s==="–")return null;
  if(/^\d+\s*[dhms](\s+\d+\s*[dhms])*\b/.test(s)){let t=0;s.replace(/(\d+)\s*([dhms])\b/g,(_,n,u)=>{t+=n*{d:86400,h:3600,m:60,s:1}[u];});return t;}
  if(/^new\b/i.test(s))return 0;
  const m=s.replace(/,/g,"").match(/^[^\d\-]{0,3}(-?\d+(?:\.\d+)?)\s*([KMB])?/i);if(m){const k={k:1e3,m:1e6,b:1e9}[(m[2]||"").toLowerCase()]||1;return parseFloat(m[1])*k;}
  return s.toLowerCase();}
function groupsOf(tb){const g=[];[...tb.rows].forEach(r=>{if(r.classList.contains("copy-row")&&g.length)g[g.length-1].push(r);else g.push([r]);});g.forEach((x,i)=>{if(x[0].dataset.oi==null)x[0].dataset.oi=i;});return g;}
function sortTable(tbl,col,dir){const tb=tbl.tBodies[0];if(!tb)return;const g=groupsOf(tb);
  const cmp=(a,b)=>{if(!dir)return a[0].dataset.oi-b[0].dataset.oi;const va=cellVal(a[0].cells[col]),vb=cellVal(b[0].cells[col]);if(va===null&&vb===null)return a[0].dataset.oi-b[0].dataset.oi;if(va===null)return 1;if(vb===null)return-1;const na=typeof va==="number",nb=typeof vb==="number";let r=na&&nb?va-vb:na?-1:nb?1:String(va).localeCompare(String(vb),undefined,{numeric:true});if(!r)r=a[0].dataset.oi-b[0].dataset.oi;return dir==="asc"?r:(na&&nb||!na&&!nb?-r:r);};
  g.sort(cmp).forEach(x=>x.forEach(r=>tb.appendChild(r)));
  [...tbl.tHead.rows[0].cells].forEach((c,i)=>{c.classList.toggle("sort-asc",i===col&&dir==="asc");c.classList.toggle("sort-desc",i===col&&dir==="desc");c.setAttribute("aria-sort",i===col&&dir?(dir==="asc"?"ascending":"descending"):"none");});}
function applySorts(){document.querySelectorAll("main table").forEach(tbl=>{if(!tbl.tHead||!tbl.tBodies[0])return;[...tbl.tHead.rows[0].cells].forEach(c=>{c.classList.add("sortable");c.tabIndex=0;if(!c.hasAttribute("aria-sort"))c.setAttribute("aria-sort","none");});const s=SORTS[sortKeyFor(tbl)];if(s)sortTable(tbl,s.col,s.dir);});}
function onSortHead(th){const tbl=th.closest("table");if(!tbl||!tbl.tHead||!tbl.tHead.contains(th))return;const k=sortKeyFor(tbl),col=th.cellIndex,cur=SORTS[k];
  const dir=!cur||cur.col!==col?"asc":cur.dir==="asc"?"desc":null;if(dir)SORTS[k]={col,dir};else delete SORTS[k];sortTable(tbl,col,dir);}
document.addEventListener("click",ev=>{const th=ev.target.closest&&ev.target.closest("main thead th");if(th)onSortHead(th);});
document.addEventListener("keydown",ev=>{if((ev.key==="Enter"||ev.key===" ")&&ev.target.matches&&ev.target.matches("main thead th")){ev.preventDefault();onSortHead(ev.target);}});
const isEquipId=id=>id>=90000000&&id<91000000;
const ID_KIND=[[1000000,"building"],[4000000,"troop"],[12000000,"trap"],[26000000,"spell"],[28000000,"hero"],[73000000,"pet"],[90000000,"equipment"]];
const idKind=id=>(ID_KIND.find(([b])=>id>=b&&id<b+1000000)||[,"item"])[1];
function errPanel(){
  const rows=[];const P=CUR&&CUR.P;let unkEquip=false;
  if(P&&P.exp){const lvl=id=>{for(const k in P.exp){const l=P.exp[k];if(Array.isArray(l)){const e=l.find(x=>x&&x.data===id);if(e)return e.lvl;}}};
    for(const [v,name] of [[P.home,"Home Village"],[P.bb,"Builder Base"]]){const u=v?v.unknown.filter(id=>!BY_ID[id]):[];if(!u.length)continue;if(u.some(isEquipId))unkEquip=true;
      rows.push(`<li><b>${name}:</b> ${u.length} unknown ID${u.length>1?"s":""}, not counted: ${u.map(id=>`${idKind(id)} <code>${id}</code>${lvl(id)?" (L"+lvl(id)+")":""}`).join(", ")}. The game data is older than your game version.</li>`);}}
  for(const e of ERRS)rows.push(`<li><b>${esc(e.src)}:</b> ${esc(e.msg)} <span class="muted small">${dateStr(e.at)}${e.n>1?" · ×"+e.n:""}</span></li>`);
  if(!rows.length)return'<div id="ovErrs" hidden></div>';
  return`<section class="panel errs" id="ovErrs" role="alert"><div class="panel-h"><h3>Errors (${rows.length})</h3><span>${unkEquip?'<button class="btn ghost sm" type="button" data-act="syncnames">Fetch names from Clash of Clans API</button> ':""}${ERRS.length?'<button class="btn ghost sm" type="button" data-act="clearerrs">Clear</button>':""}</span></div><ul>${rows.join("")}</ul></section>`;}
function refreshErrs(){const el=document.getElementById("ovErrs");if(el)el.outerHTML=errPanel();}
function heroName(slug){if(!slug)return"Unknown hero";return String(slug).split("-").map(w=>w[0].toUpperCase()+w.slice(1)).join(" ");}
function viewHome(V){const h=V.P.home;return`<section class="panel"><div class="panel-h"><h2>Home Village · Town Hall ${h.th}</h2><span class="muted small">Max levels are for TH${h.th}. "Rushed" means below the TH${h.th-1} max.</span></div>${catBars(h,["defense","army","resource","trap","wall"])}</section>`+["defense","army","resource","trap","wall"].map(k=>h.by(k)).filter(g=>g&&g.rows.length).map(g=>groupTable(g)).join("");}
function viewHeroes(V){const h=V.P.home;const exp=V.P.exp;
  const notOwned=GAME.items.filter(i=>i.b==="h"&&i.k==="equipment"&&!(exp.equipment||[]).some(e=>e.data===i.id));
  return`<section class="panel"><div class="panel-h"><h2>Heroes, pets &amp; equipment</h2><span class="muted small">Hero Hall L${h.cur.herohall} (max ${h.caps.herohall}) · Blacksmith L${h.cur.blacksmith} (max ${h.caps.blacksmith}) · Pet House ${h.caps.pethouse?"L"+h.cur.pethouse+" (max "+h.caps.pethouse+")":"unlocks at TH14"}</span></div>${catBars(h,["hero","pet","equipment"])}</section>`
  +["hero","pet","equipment"].map(k=>h.by(k)).filter(g=>g&&g.rows.length).map(g=>groupTable(g)).join("")
  +(()=>{const dm=(exp.equipment||[]).map(e=>({e,it:BY_ID[e.data]})).filter(o=>o.it&&o.it.x&&o.it.x.datamine);return dm.length?`<section class="panel"><p class="small muted" style="margin:0">New Town Hall 19 equipment, named from the ${esc(DATAMINE_SRC)} report: ${dm.map(o=>`${esc(o.it.n)} (${esc(heroName(o.it.x.hero))}, ${esc(o.it.x.rarity)}, L${o.e.lvl}, ID ${o.e.data})`).join(", ")}. The IDs are matched by the order the update added them, not yet confirmed. ${dm.some(o=>o.it.x.levelsUnknown)?"Legendary upgrade costs aren't public yet, so Blizzard Axe isn't counted in progress.":""}</p></section>`:"";})()
  +(()=>{const nu=(exp.equipment||[]).filter(e=>!BY_ID[e.data]);return nu.length?`<section class="panel"><p class="small muted" style="margin:0">${nu.length} equipment piece${nu.length>1?"s":""} in your export ${nu.length>1?"aren't":"isn't"} in the game data yet, so ${nu.length>1?"they're":"it's"} not counted: ${nu.map(e=>`ID ${e.data} (L${e.lvl})`).join(", ")}. They're newer than every public equipment list. <button class="btn ghost sm" type="button" data-act="syncnames">Fetch names from Clash of Clans API</button></p></section>`:"";})()
  +(notOwned.length?`<section class="panel"><details><summary>${notOwned.length} equipment pieces not unlocked yet</summary><p class="small muted">${notOwned.map(i=>esc(i.n)+" ("+esc(heroName(i.x&&i.x.hero||""))+")").join(", ")}</p></details></section>`:"");}
function viewLab(V){const h=V.P.home;return`<section class="panel"><div class="panel-h"><h2>${h.cur.lab?labIc(h.cur.lab)+" ":""}Laboratory</h2><span class="muted small">Lab L${h.cur.lab} of ${h.caps.lab} at TH${h.th} · ${fmtDur(h.labTime)} of research left</span></div>${catBars(h,["troop","spell","siege"])}</section>`+["troop","spell","siege"].map(k=>h.by(k)).filter(g=>g&&g.rows.length).map(g=>groupTable(g)).join("");}
function viewBuilder(V){const b=V.P.bb;if(!b)return'<section class="panel empty"><h2>Builder Base not unlocked</h2></section>';
  return`<section class="panel"><div class="hero-row">${bhArt(b.th)}<div style="display:flex;flex-direction:column;gap:8px"><div style="display:flex;gap:12px;align-items:baseline;flex-wrap:wrap"><span class="bigpct">${pct(b.overall)}</span><span class="muted">of BH${b.th} work done</span></div>${bar(b.overall,"gold")}<span class="small muted">${fmtDur(b.builderTime)} builder time (≈ ${(b.builderTime/(b.huts*86400)).toFixed(1)} days with ${b.huts} builder${b.huts>1?"s":""}${b.otto?`, O.T.T.O's Outpost L${b.otto}`:""}) · ${fmtDur(b.labTime)} Star Lab · ${resHTML(addAll(b.builderCost,b.labCost),["BG","BE"])} · walls ${resHTML(b.wallCost,["BG"])}. Hammer Jam and Gold Pass boosts don't usually apply here.</span></div></div></section>`+b.groups.filter(g=>g.rows.length).map(g=>groupTable(g)).join("");}
function viewTimers(V){const t=timersOf(V.P.exp);const up=t.filter(x=>x.to!=null),other=t.filter(x=>x.to==null);
  return`<section class="panel"><div class="panel-h"><h2>Live upgrade timers</h2><span class="small muted">From the snapshot taken ${dateStr(V.snap.ts*1000)}. Boosts and potions used since then aren't reflected, so import a fresh export after using them.</span></div>${up.length?`<div class="timers">${up.map(timerCard).join("")}</div>`:'<p class="muted">Nothing upgrading.</p>'}</section>
  <section class="panel"><h3 style="margin-bottom:10px">Helpers &amp; boosts</h3>${other.length?`<div class="timers">${other.map(timerCard).join("")}</div>`:'<p class="muted">No cooldowns in this export.</p>'}</section>`;}

/* events & effects */
function viewEvents(){
  const now=Date.now();const k=S.acct;const sk=seasonKey(now);const sd=(k&&seasonDoc(k,sk))||{};
  const evs=allEvents();const active=evs.filter(e=>activeOn(e,now)),upcoming=evs.filter(e=>parseDay(e.start)>now),past=evs.filter(e=>parseDay(e.end)+86400000<=now).reverse();
  const gp=GAME.goldPass;
  const challenges=sd.challenges||[];
  const evRow=e=>{const d=eventDiscount(e);return`<div class="ev stripe ${esc(e.type)}"><div class="when">${dayStr(parseDay(e.start))}<br><span class="muted">to ${dayStr(parseDay(e.end))}</span></div><div><b>${esc(e.name)}</b> ${e.estimated?'<span class="chip warn">estimated</span>':""} ${!e.builtin?(e.synced?'<span class="chip good">synced</span>':'<span class="chip sky">custom</span>'):""}${d.cost||d.time?`<div class="small"><span class="chip gold">${d.cost?d.cost+"% cost":""}${d.cost&&d.time?" · ":""}${d.time?d.time+"% time":""}</span> <span class="muted">${esc(d.target==="all"?"Home builders & lab":d.target)}</span></div>`:""}${(e.effects||[]).map(f=>f.notes).filter(Boolean).map(n=>`<div class="small muted">${esc(n)}</div>`).join("")}${e.notes?`<div class="small muted">${esc(e.notes)}</div>`:""}</div><div><button class="btn ghost sm" type="button" data-act="editev" data-id="${esc(e._id)}">Edit</button></div></div>`;};
  return`<section class="grid g2">
   <div class="panel"><div class="panel-h"><h2>This season · ${new Date(now).toLocaleDateString(undefined,{month:"long",year:"numeric"})}</h2></div>
    ${k?`<div style="display:flex;flex-direction:column;gap:12px">
      <label class="toggle"><input type="checkbox" id="gpToggle" ${sd.goldPass?"checked":""}> I have the Gold Pass this season</label>
      <p class="small muted" style="margin:0">Applies ${pct(-goldPassPct().builder)} off builder and ${pct(-goldPassPct().lab)} off research cost and time in estimates once the perks are unlocked on the track. Saved per account and month.</p>
      ${(()=>{const me=new Date(now);const monthEnd=new Date(me.getFullYear(),me.getMonth()+1,1).getTime();const ds=evs.filter(e=>{const d=eventDiscount(e);return e.type==="discount"&&(d.time||d.cost)&&(activeOn(e,now)||(parseDay(e.start)>now&&parseDay(e.start)<monthEnd));});return`<div><h3 style="margin-bottom:6px">Discount events</h3>${ds.length?ds.map(e=>{const d=eventDiscount(e);const act=activeOn(e,now);return`<label class="toggle" style="display:flex;margin-bottom:6px;align-items:flex-start"><input type="checkbox" data-evk="${esc(evKey(e))}" ${evOnFor(sd,e)?"checked":""}> <span>Apply ${esc(e.name)} <span class="small muted">· ${dayStr(parseDay(e.start))} to ${dayStr(parseDay(e.end))}${d.time?" · "+d.time+"% time":""}${d.cost?" · "+d.cost+"% cost":""}${act?"":" · starts later"}</span></span></label>`;}).join("")+`<p class="small muted" style="margin:0">Off by default. Tick an event to include its discount in time and cost estimates while it runs. Saved per account and month.</p>`:`<p class="small muted" style="margin:0">No time or cost discount events this month.</p>`}</div>`;})()}
      <div class="form-row"><label class="f">Season points<input type="number" id="spPoints" min="0" step="10" value="${esc(sd.points||"")}" style="width:120px"></label><label class="f" style="flex:1;min-width:180px">Notes<input type="text" id="spNotes" value="${esc(sd.notes||"")}" placeholder="e.g. bought on the 5th"></label><button class="btn sm" type="button" data-act="saveseason">Save</button></div>
      <div><h3 style="margin-bottom:6px">Season challenges</h3>
        ${challenges.length?challenges.map((c,i)=>`<label class="toggle small" style="display:flex;margin-bottom:4px"><input type="checkbox" data-act="chk" data-i="${i}" ${c.done?"checked":""}> <span style="${c.done?"text-decoration:line-through;opacity:.7":""}">${esc(c.text)}</span> <button class="btn ghost sm" type="button" data-act="delchk" data-i="${i}" aria-label="Remove">×</button></label>`).join(""):'<p class="small muted" style="margin:0 0 6px">Track the milestones you care about, like Gold Pass reward tiers or event goals.</p>'}
        <div class="form-row"><input type="text" id="chkText" placeholder="Add a milestone" style="flex:1;min-width:160px"><button class="btn ghost sm" type="button" data-act="addchk">Add</button></div></div>
      ${calibPanel()}
    </div>`:'<p class="muted">Import an account first to track its Gold Pass and challenges.</p>'}
   </div>
   <div class="panel"><div class="panel-h"><h3>Gold Pass perks</h3></div><div class="tbl-wrap"><table><tbody>${(gp.perks||[]).map(p=>`<tr><td><b>${esc(p.name)}</b><div class="small muted">${esc(p.notes||"")}</div></td><td class="r lvl">${esc(p.value)}</td></tr>`).join("")}</tbody></table></div><p class="small muted">${esc(gp.tiers||"")}</p></div>
  </section>
  <section class="panel"><div class="panel-h"><h2>Event calendar</h2><span style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn gold sm" type="button" data-act="newev">+ Add event</button></span></div>
   <h3 style="margin:4px 0">Active now</h3>${active.length?active.map(evRow).join(""):'<p class="muted">No events today.</p>'}
   <h3 style="margin:14px 0 4px">Coming up</h3>${upcoming.length?upcoming.map(evRow).join(""):'<p class="muted">Nothing scheduled. Add events as Supercell announces them.</p>'}
   <details style="margin-top:14px"><summary>Past events (${past.length})</summary>${past.map(evRow).join("")}</details></section>
  <section class="panel"><h3 style="margin-bottom:8px">Recurring schedule</h3>${(GAME.recurring||[]).map(r=>`<div class="ev" style="grid-template-columns:200px 1fr"><b>${esc(r.name)}</b><div class="small">${esc(r.rule)}<div class="muted">${esc(r.notes||"")}</div></div></div>`).join("")}</section>`;
}

/* planner */
function upgradeCandidates(V){
  const h=V.P.home;const out=[];
  for(const g of h.groups){if(!["builder","lab","pet"].includes(g.q))continue;for(const r of g.rows)for(const n of r.next){if(n.blocked)continue;out.push({name:r.name,from:n.from,to:n.to,s:n.s,c:n.c,r:n.r,q:g.q==="builder"?"Builder":g.q==="lab"?"Lab":"Pet House",missing:n.missing});}}
  const uniq={};for(const o of out){const key=o.name+o.from+o.q;if(!uniq[key])uniq[key]=Object.assign({n:0},o);uniq[key].n++;}
  return Object.values(uniq).sort((a,b)=>b.s-a.s);
}
function viewPlanner(V){
  const now=Date.now();const ev=allEvents().filter(e=>e.type==="discount"&&parseDay(e.end)+86400000>now);const nextEv=ev[0];
  const cands=upgradeCandidates(V);const fx=V.fx;
  let head;
  if(nextEv){const d=eventDiscount(nextEv);const act=activeOn(nextEv,now);const endMs=parseDay(nextEv.end)+86400000;const startMs=parseDay(nextEv.start);
    head=act?`<div class="banner info">${esc(nextEv.name)} is on until ${dayStr(parseDay(nextEv.end))} (${fmtDur((endMs-now)/1000)} left): ${d.cost}% cost, ${d.time}% time. Start the longest and most expensive upgrades below before it ends. The discount locks in when you start the upgrade.</div>`
      :`<div class="banner info">Next discount: ${esc(nextEv.name)} starts ${dayStr(startMs)} (${fmtDur((startMs-now)/1000)} away). Save the big upgrades below for it, and fill builders now with upgrades that finish before it starts.</div>`;}
  else head='<div class="banner info">No discount event on the calendar. Add one in Events &amp; Effects when it is announced.</div>';
  const d=nextEv?eventDiscount(nextEv):{cost:0,time:0};const gap=nextEv&&!activeOn(nextEv,now)?(parseDay(nextEv.start)-now)/1000:0;
  const save=cands.slice(0,14);
  const fill=gap?cands.filter(c=>c.s>0&&c.s<=gap).sort((a,b)=>b.s-a.s).slice(0,8):[];
  const live=nextEv&&activeOn(nextEv,now);
  const table=(list,showSave)=>`<div class="tbl-wrap"><table><thead><tr><th>Upgrade</th><th>Queue</th><th class="r">Time</th><th class="r">Cost</th>${showSave?`<th class="r">${live?"You save (all copies)":"Event would save"}</th>`:""}</tr></thead><tbody>${list.map(c=>{const cost={};addRes(cost,c.c,c.r);const m=mult(c.q==="Builder"?"builder":"lab","h");
    const sv=live?{t:c.s*(1-m.t)*c.n,c:scaleRes(cost,(1-m.c)*c.n)}:{t:c.s*-d.time/100*c.n,c:scaleRes(cost,-d.cost/100*c.n)};
    return`<tr><td><b>${esc(c.name)}</b> <span class="muted">${c.missing?"build new":"L"+c.from+" → L"+c.to}</span>${c.n>1?` <span class="chip">${c.n} copies</span>`:""}</td><td class="small">${c.q}</td><td class="r tnum">${timeCell(c.s,0,m)}</td><td class="r small">${costCell(cost,null,m)}</td>${showSave?`<td class="r small">${fmtDur(sv.t)} · ${resHTML(sv.c)}</td>`:""}</tr>`;}).join("")}</tbody></table></div>`;
  return head+`<section class="panel"><div class="panel-h"><h2>${nextEv?"Best upgrades for "+esc(nextEv.name):"Longest upgrades available now"}</h2><span class="small muted">Ready to start now with your current Lab, Hero Hall and Town Hall</span></div>${save.length?table(save,!!nextEv):'<p class="muted">Everything available is maxed or already upgrading.</p>'}</section>`
   +(fill.length?`<section class="panel"><div class="panel-h"><h3>Fill builders until the event</h3><span class="small muted">Finishes within ${fmtDur(gap)}</span></div>${table(fill,false)}</section>`:"")
   +`<section class="panel"><h3>Current effects in estimates</h3><p class="small muted" style="margin:6px 0 0">${fx.labels.length?fx.labels.map(esc).join(" · ")+`. Builder time ×${fx.bT.toFixed(2)}, cost ×${fx.bC.toFixed(2)}; lab time ×${fx.lT.toFixed(2)}, cost ×${fx.lC.toFixed(2)}.`:"None active. Toggle the Gold Pass in Events & Effects."}</p></section>`;
}

/* item log */
/* ---------- actions ---------- */
async function importExport(text,name){
  let exp;try{exp=JSON.parse(text.trim());}catch(e){throw new Error("That isn't valid JSON. Copy the whole export from the game and paste it again.");}
  if(!exp||!exp.tag||!exp.timestamp)throw new Error("This JSON has no tag or timestamp. Use the in-game Data Export.");
  if(!computeVillage(exp,"h"))throw new Error("No Town Hall found in this export.");
  const k=tagKey(exp.tag);const id=k+"_"+exp.timestamp;
  const acc=account(k);
  if(!acc)await Store.put("accounts",k,{tag:exp.tag,name:name||"",created:Date.now()});
  else if(name&&name!==acc.name)await Store.put("accounts",k,Object.assign({},acc,{name}));
  await Store.put("snapshots",id,{tag:k,ts:exp.timestamp,raw:JSON.stringify(exp),added:Date.now()});
  memo.delete(id);S.acct=k;return id;
}
async function saveSeason(patch){const k=S.acct;if(!k)return;const sk=seasonKey(Date.now());const cur=seasonDoc(k,sk)||{tag:k,season:sk};await Store.put("seasons",k+"_"+sk,Object.assign({},cur,patch,{tag:k,season:sk}));}
let editingEv=null;
function openEvent(id){
  editingEv=id;const e=id?allEvents().find(x=>x._id===id):null;const d=e?eventDiscount(e):{cost:0,time:0,target:"all"};
  $("#eventDlgTitle").textContent=e?"Edit event":"Add event";$("#evName").value=e?e.name:"";$("#evType").value=e?e.type:"discount";
  $("#evStart").value=e?e.start:isoDay(Date.now());$("#evEnd").value=e?e.end:isoDay(Date.now()+7*86400000);$("#evCost").value=d.cost;$("#evTime").value=d.time;$("#evTarget").value=d.target||"all";$("#evNotes").value=e&&e.notes||"";
  $("#evDelete").hidden=!e;$("#eventDlg").showModal();
}
document.addEventListener("click",async ev=>{
  const t=ev.target.closest("[data-tab],[data-act],[data-close]");if(!t)return;
  if(t.hasAttribute("data-close")){t.closest("dialog").close();return;}
  if(t.dataset.tab){S.tab=t.dataset.tab;render();window.scrollTo({top:0});return;}
  const a=t.dataset.act;
  try{
    if(a==="import"){openImport();}
    else if(a==="ovbase"){S.ovBase=t.dataset.v;render();}
    else if(a==="syncnames"){await syncNames(t);}
    else if(a==="clearerrs"){ERRS.length=0;refreshErrs();}
    else if(a==="copies"){const k=t.dataset.k;const op=!S.open.has(k);if(op)S.open.add(k);else S.open.delete(k);t.setAttribute("aria-expanded",String(op));document.querySelectorAll("tr.copy-row").forEach(tr=>{if(tr.dataset.p===k)tr.hidden=!op;});}
    else if(a==="delsnap"){if(t.dataset.confirm!=="1"){t.dataset.confirm="1";t.textContent="Confirm delete";return;}await Store.del("snapshots",t.dataset.id);memo.delete(t.dataset.id);toast("Snapshot deleted");render();}
    else if(a==="saveseason"){await saveSeason({points:Number($("#spPoints").value)||0,notes:$("#spNotes").value});toast("Season saved");render();}
    else if(a==="addchk"){const v=$("#chkText").value.trim();if(!v)return;const sd=seasonDoc(S.acct,seasonKey(Date.now()))||{};await saveSeason({challenges:(sd.challenges||[]).concat([{text:v,done:false}])});render();}
    else if(a==="delchk"){ev.preventDefault();const sd=seasonDoc(S.acct,seasonKey(Date.now()))||{};const c=(sd.challenges||[]).slice();c.splice(+t.dataset.i,1);await saveSeason({challenges:c});render();}
    else if(a==="clearcal"){const sd=seasonDoc(S.acct,seasonKey(Date.now()))||{};const c=Object.assign({},sd.calib||{});delete c[t.dataset.q];await saveSeason({calib:c});toast("Using calculated discounts again");render();}
    else if(a==="newev"){openEvent(null);}
    else if(a==="editev"){openEvent(t.dataset.id);}
  }catch(e){logErr("Saving",e);toast("Couldn't save: "+(e&&e.message||e));}
});
document.addEventListener("change",async ev=>{
  const t=ev.target;
  try{
    if(t.id==="acctSel"){S.acct=t.value;render();}
    else if(t.dataset&&t.dataset.evk!=null){const sd0=seasonDoc(S.acct,seasonKey(Date.now()))||{};const on=Object.assign({},sd0.evOn||{});if(t.checked)on[t.dataset.evk]=true;else delete on[t.dataset.evk];await saveSeason({evOn:on});toast(t.checked?"Event discount applied":"Event discount off");render();}
    else if(t.id==="gpToggle"){await saveSeason({goldPass:t.checked});toast(t.checked?"Gold Pass on for this season":"Gold Pass off");render();}
    else if(t.dataset&&t.dataset.act==="chk"){const sd=seasonDoc(S.acct,seasonKey(Date.now()))||{};const c=(sd.challenges||[]).map((x,i)=>i===+t.dataset.i?Object.assign({},x,{done:t.checked}):x);await saveSeason({challenges:c});render();}
    else if(t.id==="compA"){S.compA=t.value;render();}
    else if(t.id==="compB"){S.compB=t.value;render();}
    else if(t.id==="importFile"&&t.files[0]){$("#importText").value=await t.files[0].text();}
  }catch(e){logErr("Saving",e);toast("Couldn't save: "+(e&&e.message||e));}
});
function openImport(){$("#importErr").textContent="";$("#importText").value="";$("#importFile").value="";$("#importName").value="";$("#importDlg").showModal();}
$("#importBtn").addEventListener("click",openImport);
$("#importForm").addEventListener("submit",async ev=>{ev.preventDefault();const btn=ev.submitter;if(btn)btn.disabled=true;
  try{await importExport($("#importText").value,$("#importName").value.trim());$("#importDlg").close();toast("Snapshot saved");S.tab="overview";render();}
  catch(e){logErr("Import",e);$("#importErr").textContent=e.message||String(e);}finally{if(btn)btn.disabled=false;}});
$("#eventForm").addEventListener("submit",async ev=>{ev.preventDefault();
  const data={name:$("#evName").value.trim(),type:$("#evType").value,start:$("#evStart").value,end:$("#evEnd").value,notes:$("#evNotes").value.trim(),estimated:false,
    effects:[{target:$("#evTarget").value,costPct:Number($("#evCost").value)||0,timePct:Number($("#evTime").value)||0}]};
  if(data.end<data.start){toast("End date is before the start date");return;}
  const id=editingEv||("c-"+Date.now().toString(36));
  try{await Store.put("events",id,data);$("#eventDlg").close();toast("Event saved");render();}catch(e){logErr("Saving",e);toast("Couldn't save: "+(e.message||e));}});
$("#evDelete").addEventListener("click",async()=>{if(!editingEv)return;try{if(editingEv.startsWith("b-"))await Store.put("events",editingEv,{hidden:true});else await Store.del("events",editingEv);$("#eventDlg").close();toast("Event hidden");render();}catch(e){logErr("Saving",e);toast("Couldn't save: "+(e.message||e));}});
document.addEventListener("submit",async ev=>{if(ev.target.id!=="calForm")return;ev.preventDefault();
  const err=$("#calErr");err.textContent="";
  const P=parsed(latest());const cands=upgradeCandidates({P}).filter(c=>c.s>0&&(c.q==="Builder"||c.q==="Lab")).slice(0,60);
  const c=cands[+$("#calItem").value];const t=parseDur($("#calTime").value);
  if(!c){err.textContent="Pick an upgrade first.";return;}
  if(!(t>0)){err.textContent="Enter the time as shown in the game, like 1h 40m or 2d 6h.";return;}
  const co={};addRes(co,c.c,c.r);const base=Object.values(co)[0]||0;const amt=parseAmt($("#calCost").value);
  if($("#calCost").value.trim()&&!(amt>0)){err.textContent="Enter the cost like 400000, 400K or 1.2M, or leave it empty.";return;}
  const now=Date.now();const evs=allEvents().filter(e=>e.type==="discount"&&activeOn(e,now));
  const until=evs.length?Math.min(...evs.map(e=>parseDay(e.end)+86400000)):(()=>{const d=new Date(now);return new Date(d.getFullYear(),d.getMonth()+1,1).getTime();})();
  const q=c.q==="Builder"?"builder":"lab";
  const entry={t:t/c.s,c:amt>0&&base>0?amt/base:null,from:c.name+" L"+c.from+"→L"+c.to+" ("+fmtDur(t)+" vs "+fmtDur(c.s)+")",until,set:now};
  const sd=seasonDoc(S.acct,seasonKey(now))||{};
  try{await saveSeason({calib:Object.assign({},sd.calib||{},{[q]:entry})});toast("Matched: "+(q==="builder"?"builder":"lab")+" times ×"+entry.t.toFixed(2));render();}catch(e){logErr("Saving",e);err.textContent="Couldn't save: "+(e.message||e);}
});


/* style switcher (remembered per browser) */
const SKINS=["analytics","townhall"];
function applySkin(s){if(!SKINS.includes(s))s="analytics";document.documentElement.dataset.skin=s;$("#skinSel").value=s;}
let skin="analytics";try{skin=localStorage.getItem("coc-ledger-skin")||"analytics";}catch(e){}
applySkin(skin);
$("#skinSel").addEventListener("change",e=>{applySkin(e.target.value);try{localStorage.setItem("coc-ledger-skin",e.target.value);}catch(err){}toast("Style: "+e.target.selectedOptions[0].textContent);});

/* boot */
window.__ledger={computeVillage,timersOf,GAME,BY_ID};
render();
Store.init().then(render).catch(e=>{logErr("Opening saved data",e);Store.mode="local";render();});
})();
