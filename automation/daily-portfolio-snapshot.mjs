import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const DASHBOARD_ID = process.env.TARGET_DASHBOARD_ID || "tqqq-qqq200-main";
const FIREBASE_SERVICE_ACCOUNT = process.env.FIREBASE_SERVICE_ACCOUNT || "";
const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY || "";
const FORCE = String(process.env.FORCE || "").toLowerCase() === "true";
const RUN_MODE = String(process.env.RUN_MODE || "normal_snapshot").toLowerCase();
const FX_ENDPOINT = "https://open.er-api.com/v6/latest/USD";
const QQQI_DISTRIBUTION_URL = "https://neosfunds.com/qqqi/";
const QUOTE_ATTEMPTS = 3;

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

function parseServiceAccount(raw) {
  if (!raw) throw new Error("缺少 FIREBASE_SERVICE_ACCOUNT GitHub Secret");
  const candidates = [raw];
  try { candidates.push(Buffer.from(raw, "base64").toString("utf8")); } catch (_) {}
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed?.private_key && parsed?.client_email && parsed?.project_id) {
        parsed.private_key = String(parsed.private_key).replace(/\\n/g, "\n");
        return parsed;
      }
    } catch (_) {}
  }
  throw new Error("FIREBASE_SERVICE_ACCOUNT 不是有效的服務帳戶 JSON 或 Base64 JSON");
}

const number = value => {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : 0;
};
const round2 = value => Math.round(number(value) * 100) / 100;
const round4 = value => Math.round(number(value) * 10000) / 10000;
const clamp = (value,min,max) => Math.max(min,Math.min(max,number(value)));
const sleep = ms => new Promise(resolve=>setTimeout(resolve,ms));
const ymd = date => `${date.getUTCFullYear()}-${String(date.getUTCMonth()+1).padStart(2,"0")}-${String(date.getUTCDate()).padStart(2,"0")}`;
const dateAtNoon = text => new Date(`${text}T12:00:00Z`);

function nthWeekdayOfMonth(year, monthIndex, weekday, nth) {
  const d = new Date(Date.UTC(year, monthIndex, 1, 12));
  const shift = (weekday - d.getUTCDay() + 7) % 7;
  d.setUTCDate(1 + shift + (nth - 1) * 7);
  return d;
}
function lastWeekdayOfMonth(year, monthIndex, weekday) {
  const d = new Date(Date.UTC(year, monthIndex + 1, 0, 12));
  const shift = (d.getUTCDay() - weekday + 7) % 7;
  d.setUTCDate(d.getUTCDate() - shift);
  return d;
}
function easterSunday(year) {
  const a=year%19,b=Math.floor(year/100),c=year%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451),month=Math.floor((h+l-7*m+114)/31)-1,day=((h+l-7*m+114)%31)+1;
  return new Date(Date.UTC(year,month,day,12));
}
function observedFixedHoliday(year, monthIndex, day) {
  const d=new Date(Date.UTC(year,monthIndex,day,12));
  const w=d.getUTCDay();
  if(w===6)d.setUTCDate(d.getUTCDate()-1);
  else if(w===0)d.setUTCDate(d.getUTCDate()+1);
  return d;
}
function holidaySet(year) {
  const set=new Set(), add=d=>set.add(ymd(d));
  add(observedFixedHoliday(year,0,1));
  add(nthWeekdayOfMonth(year,0,1,3));
  add(nthWeekdayOfMonth(year,1,1,3));
  const goodFriday=easterSunday(year); goodFriday.setUTCDate(goodFriday.getUTCDate()-2); add(goodFriday);
  add(lastWeekdayOfMonth(year,4,1));
  if(year>=2022)add(observedFixedHoliday(year,5,19));
  add(observedFixedHoliday(year,6,4));
  add(nthWeekdayOfMonth(year,8,1,1));
  add(nthWeekdayOfMonth(year,10,4,4));
  add(observedFixedHoliday(year,11,25));
  return set;
}
function isTradingDay(text) {
  const d=dateAtNoon(text), w=d.getUTCDay();
  return w!==0 && w!==6 && !holidaySet(d.getUTCFullYear()).has(text);
}
function nyDateTime(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone:"America/New_York", year:"numeric", month:"2-digit", day:"2-digit",
    hour:"2-digit", minute:"2-digit", hour12:false
  }).formatToParts(now);
  const get=t=>parts.find(x=>x.type===t)?.value||"";
  return { date:`${get("year")}-${get("month")}-${get("day")}`, hour:Number(get("hour")), minute:Number(get("minute")) };
}
function nyDateFromUnix(ts) {
  if(!Number.isFinite(Number(ts)) || Number(ts)<=0) return "";
  const parts=new Intl.DateTimeFormat("en-CA",{timeZone:"America/New_York",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date(Number(ts)*1000));
  const get=t=>parts.find(x=>x.type===t)?.value||"";
  return `${get("year")}-${get("month")}-${get("day")}`;
}
function previousTradingDay(text) {
  const d=dateAtNoon(text);
  do { d.setUTCDate(d.getUTCDate()-1); } while(!isTradingDay(ymd(d)));
  return ymd(d);
}
function latestCompletedTradingDay(now = new Date()) {
  const ny=nyDateTime(now);
  if(!isTradingDay(ny.date)) return previousTradingDay(ny.date);
  if(ny.hour < 16 || (ny.hour===16 && ny.minute < 15)) return previousTradingDay(ny.date);
  return ny.date;
}
function calendarAgeDays(iso) {
  const d=Date.parse(String(iso||""));
  if(!Number.isFinite(d)) return Infinity;
  return Math.max(0,Math.floor((Date.now()-d)/86400000));
}

async function fetchJson(url, timeoutMs=15000) {
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try {
    const response=await fetch(url,{cache:"no-store",signal:controller.signal,headers:{"User-Agent":"stock-assets-daily-snapshot/1.1"}});
    if(!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally { clearTimeout(timer); }
}
async function fetchText(url, timeoutMs=20000) {
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try {
    const response=await fetch(url,{cache:"no-store",signal:controller.signal,headers:{"User-Agent":"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/126 Safari/537.36","Accept":"text/html,application/xhtml+xml"}});
    if(!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.text();
  } finally { clearTimeout(timer); }
}
async function retry(label, fn, attempts=QUOTE_ATTEMPTS) {
  let lastError=null;
  for(let i=1;i<=attempts;i++){
    try { return {...await fn(i),attempts:i}; }
    catch(error){
      lastError=error;
      if(i<attempts) await sleep(i===1?8000:16000);
    }
  }
  throw new Error(`${label} 連續 ${attempts} 次失敗：${lastError?.message||lastError}`);
}

const quoteCache=new Map();
async function quote(symbol, targetDate) {
  const clean=String(symbol||"").toUpperCase().replace(/[^A-Z0-9.\-]/g,"").slice(0,12);
  if(!clean) return null;
  const cacheKey=`${clean}|${targetDate}`;
  if(quoteCache.has(cacheKey)) return quoteCache.get(cacheKey);
  const promise=retry(clean,async()=>{
    const body=await fetchJson(`https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(clean)}&token=${encodeURIComponent(FINNHUB_API_KEY)}`);
    const price=number(body?.c), timestamp=number(body?.t), priceDate=nyDateFromUnix(timestamp);
    if(price<=0) throw new Error(`${clean} 無有效收盤價`);
    if(priceDate && priceDate < targetDate) throw new Error(`${clean} 最新報價日期 ${priceDate}，目標交易日 ${targetDate}`);
    return {symbol:clean,price:round2(price),timestamp,priceDate:priceDate||targetDate};
  });
  quoteCache.set(cacheKey,promise);
  return promise;
}

async function fxRate() {
  const body=await fetchJson(FX_ENDPOINT);
  const rate=number(body?.rates?.TWD);
  if(body?.result!=="success" || rate<10 || rate>100) throw new Error("USD/TWD 匯率資料異常");
  return {rate:round4(rate),sourceUpdatedAt:body?.time_last_update_utc||"",nextUpdateAt:body?.time_next_update_utc||""};
}

function heldSymbols(data) {
  const pairs=[
    ["TQQQ",data.sharesTqqq],["QQQ",data.sharesQqq],["SPY",data.sharesSpy],
    ["SPYI",data.sharesSpyi],["QQQI",data.sharesQqqi]
  ];
  const symbols=new Set(["SPY","QQQ","TQQQ"]);
  for(const [symbol,shares] of pairs) if(number(shares)>0) symbols.add(symbol);
  const hot=String(data.hotAsset||"").toUpperCase();
  if(["SPYI","QQQI"].includes(hot)) symbols.add(hot);
  const intro=String(data.introAsset||"QQQI").toUpperCase();
  if(["QQQI"].includes(intro)) symbols.add(intro);
  const sub=String(data.subSymbol||"").toUpperCase();
  if(sub && number(data.subShares)>0) symbols.add(sub);
  return [...symbols];
}

async function resolvePrices(data, targetDate) {
  const symbols=heldSymbols(data);
  const settled=await Promise.allSettled(symbols.map(symbol=>quote(symbol,targetDate)));
  const prices={
    SPY:number(data.spy), QQQ:number(data.qqq), TQQQ:number(data.tqqq),
    SPYI:number(data.spyi), QQQI:number(data.qqqi)
  };
  const stale=[], priceMeta={};
  settled.forEach((result,index)=>{
    const symbol=symbols[index];
    if(result.status==="fulfilled" && result.value?.price>0){
      prices[symbol]=result.value.price;
      priceMeta[symbol]={source:"Finnhub",date:result.value.priceDate||targetDate,attempts:result.value.attempts||1,fresh:true};
    } else {
      stale.push(symbol);
      priceMeta[symbol]={source:"fallback",date:"",attempts:QUOTE_ATTEMPTS,fresh:false,error:String(result.reason?.message||"失敗").slice(0,160)};
    }
  });
  return {prices,stale:[...new Set(stale)],priceMeta,expectedCount:symbols.length,freshCount:symbols.length-new Set(stale).size};
}

function strategyValue(data, prices) {
  return number(data.sharesTqqq)*number(prices.TQQQ)
    + number(data.sharesQqq)*number(prices.QQQ)
    + number(data.sharesSpy)*number(prices.SPY)
    + number(data.sharesSpyi)*number(prices.SPYI)
    + number(data.sharesQqqi)*number(prices.QQQI)
    + number(data.cashUsd)
    + number(data.otherUsd);
}

function subValue(data, prices) {
  const symbol=String(data.subSymbol||"").toUpperCase();
  const shares=Math.max(0,number(data.subShares));
  const cash=Math.max(0,number(data.subCashUsd));
  const price=Math.max(0,number(prices[symbol] ?? data.subPriceUsd));
  if(symbol && price>0) return {value:shares*price+cash,price};
  return {value:Math.max(0,number(data.subUsd)),price:number(data.subPriceUsd)};
}

function isManualSnapshot(snapshot) {
  if(!snapshot) return false;
  return String(snapshot.reason||"") !== "auto_market_close" && snapshot.auto !== true;
}

function parseUsDate(text) {
  const m=String(text||"").match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/);
  if(!m) return "";
  return `${m[3]}-${String(m[1]).padStart(2,"0")}-${String(m[2]).padStart(2,"0")}`;
}
function decodeHtmlText(text) {
  return String(text||"")
    .replace(/&nbsp;|&#160;/gi," ")
    .replace(/&amp;/gi,"&")
    .replace(/&quot;/gi,'"')
    .replace(/&#39;|&apos;/gi,"'")
    .replace(/&lt;/gi,"<")
    .replace(/&gt;/gi,">")
    .replace(/&#(\d+);/g,(_,n)=>String.fromCharCode(Number(n)||32));
}
function cellText(html) {
  return decodeHtmlText(String(html||"")
    .replace(/<script[\s\S]*?<\/script>/gi," ")
    .replace(/<style[\s\S]*?<\/style>/gi," ")
    .replace(/<[^>]+>/g," "))
    .replace(/\s+/g," ").trim();
}
function parseQqqiDistributions(html) {
  const rows=[];
  const trMatches=String(html||"").match(/<tr\b[\s\S]*?<\/tr>/gi)||[];
  for(const tr of trMatches){
    const cells=[...tr.matchAll(/<(?:td|th)\b[^>]*>([\s\S]*?)<\/(?:td|th)>/gi)].map(m=>cellText(m[1]));
    if(cells.length<5) continue;
    const declarationDate=parseUsDate(cells[0]), exDate=parseUsDate(cells[1]), recordDate=parseUsDate(cells[2]), payableDate=parseUsDate(cells[3]);
    const amountMatch=String(cells[4]||"").replace(/,/g,"").match(/\$?\s*([0-9]+(?:\.[0-9]+)?)/);
    const amountPerShare=amountMatch?number(amountMatch[1]):0;
    if(declarationDate&&exDate&&recordDate&&payableDate&&amountPerShare>0){
      rows.push({symbol:"QQQI",declarationDate,exDate,recordDate,payableDate,amountPerShare:round4(amountPerShare),source:QQQI_DISTRIBUTION_URL});
    }
  }
  const byId=new Map();
  rows.forEach(row=>byId.set(`QQQI-${row.payableDate}`,row));
  return [...byId.values()].sort((a,b)=>a.payableDate.localeCompare(b.payableDate));
}
async function fetchQqqiDistributions() {
  const result=await retry("QQQI 官方配息資料",async()=>({html:await fetchText(QQQI_DISTRIBUTION_URL)}),2);
  const rows=parseQqqiDistributions(result.html);
  if(!rows.length) throw new Error("NEOS QQQI 頁面未解析到已公布配息金額");
  return rows;
}

function holdingsState(data,cashUsd=number(data.cashUsd)) {
  return {
    TQQQ:number(data.sharesTqqq),QQQ:number(data.sharesQqq),SPY:number(data.sharesSpy),SPYI:number(data.sharesSpyi),QQQI:number(data.sharesQqqi),
    cashUsd:number(cashUsd),otherUsd:number(data.otherUsd)
  };
}
function eligibleQqqiShares(history, data, exDate) {
  const entitlementDate=previousTradingDay(exDate);
  const candidates=(Array.isArray(history)?history:[])
    .filter(x=>String(x?.date||"").slice(0,10)<=entitlementDate && Object.prototype.hasOwnProperty.call(x||{},"sharesQqqi"))
    .sort((a,b)=>String(b.date||"").localeCompare(String(a.date||"")));
  const exact=candidates.find(x=>String(x.date||"").slice(0,10)===entitlementDate);
  const chosen=exact||candidates[0];
  if(chosen) return {shares:Math.max(0,number(chosen.sharesQqqi)),sourceDate:String(chosen.date||"").slice(0,10),source:exact?"前一交易日快照":"最近可用快照",estimated:!exact,entitlementDate};
  return {shares:Math.max(0,number(data.sharesQqqi)),sourceDate:"",source:"目前持股估算",estimated:true,entitlementDate};
}
function planQqqiDividends(data,history,distributions,targetDate) {
  const enabled=data.qqqiDividendAutomationEnabled!==false;
  const taxRate=clamp(data.qqqiDividendTaxRate===undefined?30:data.qqqiDividendTaxRate,0,100);
  const startDate=String(data.qqqiDividendStartDate||targetDate).slice(0,10);
  const ledger=Array.isArray(data.qqqiDividendLedger)?data.qqqiDividendLedger.filter(Boolean):[];
  const seen=new Set(ledger.map(x=>String(x?.id||"")));
  const newEntries=[];
  if(enabled){
    for(const dist of distributions||[]){
      const id=`QQQI-${dist.payableDate}`;
      if(seen.has(id) || dist.payableDate>targetDate || dist.payableDate<startDate || dist.amountPerShare<=0) continue;
      const eligibility=eligibleQqqiShares(history,data,dist.exDate);
      const grossUsd=round4(eligibility.shares*dist.amountPerShare);
      const taxUsd=round4(grossUsd*taxRate/100);
      const netUsd=round4(grossUsd-taxUsd);
      newEntries.push({
        id,symbol:"QQQI",declarationDate:dist.declarationDate,exDate:dist.exDate,recordDate:dist.recordDate,payableDate:dist.payableDate,
        amountPerShare:dist.amountPerShare,eligibleShares:eligibility.shares,shareSource:eligibility.source,shareSourceDate:eligibility.sourceDate,
        entitlementDate:eligibility.entitlementDate,estimatedShares:eligibility.estimated,taxRate,grossUsd,taxUsd,netUsd,actualNetUsd:null,
        postedAt:new Date().toISOString(),source:"NEOS 官方 QQQI 配息歷史",sourceUrl:QQQI_DISTRIBUTION_URL
      });
      seen.add(id);
    }
  }
  const netAdded=round4(newEntries.reduce((sum,x)=>sum+number(x.netUsd),0));
  return {enabled,taxRate,startDate,ledger:[...newEntries,...ledger].slice(0,120),newEntries,netAdded};
}

function qualitySummary({resolved,fxFresh,ftStale}) {
  const stale=[...new Set(resolved?.stale||[])];
  const criticalMissing=stale.some(symbol=>number(resolved?.prices?.[symbol])<=0);
  const estimated=stale.length>0 || !fxFresh || ftStale;
  const quality=criticalMissing?"incomplete":estimated?"estimated":"complete";
  const parts=[];
  if(stale.length) parts.push(`舊價：${stale.join("、")}`);
  if(!fxFresh) parts.push("匯率沿用既有值");
  if(ftStale) parts.push("FT 淨值超過 7 天未更新");
  return {quality,note:parts.join("；")||"全部必要資料為本次更新值"};
}

async function patchRootWithRevision(db, ref, patch, source="github-actions") {
  let nextRevision=0;
  const writeAt=new Date().toISOString();
  const writeId=`${source}-${writeAt.replace(/[^0-9]/g,"").slice(0,14)}-${Math.random().toString(36).slice(2,8)}`;
  await db.runTransaction(async tx=>{
    const snap=await tx.get(ref);
    if(!snap.exists) throw new Error("dashboard 不存在");
    const current=snap.data()||{};
    nextRevision=Math.max(0,Math.floor(number(current.dataRevision)))+1;
    tx.set(ref,{...patch,dataRevision:nextRevision,lastWriteId:writeId,lastWriteSource:source,lastWriteAt:writeAt,clientAppVersion:"股票資產 PWA v6.1｜SPY／QQQ 200SMA 參考切換",autoSnapshotServerUpdatedAt:FieldValue.serverTimestamp()},{merge:true});
  });
  return {revision:nextRevision,writeId,writeAt};
}

async function processQqqiE2eDashboard(db, ref, targetDate) {
  const snap=await ref.get();
  if(!snap.exists) return {status:"missing"};
  const entitlementDate=previousTradingDay(targetDate);
  const fixtureData={
    ...(snap.data()||{}),
    cashUsd:2000,
    sharesQqqi:1000,
    qqqiDividendAutomationEnabled:true,
    qqqiDividendTaxRate:30,
    qqqiDividendStartDate:"2000-01-01",
    qqqiDividendLedger:[]
  };
  const history=[{date:entitlementDate,sharesQqqi:1000}];
  const distribution={symbol:"QQQI",declarationDate:entitlementDate,exDate:targetDate,recordDate:targetDate,payableDate:targetDate,amountPerShare:0.6346,source:"v6.1 isolated fixture"};
  const first=planQqqiDividends(fixtureData,history,[distribution],targetDate);
  const afterCash=round4(number(fixtureData.cashUsd)+first.netAdded);
  const second=planQqqiDividends({...fixtureData,qqqiDividendLedger:first.ledger},history,[distribution],targetDate);
  const expectedNet=444.22;
  const passed=Math.abs(first.netAdded-expectedNet)<0.0001 && Math.abs(afterCash-2444.22)<0.0001 && Math.abs(second.netAdded)<0.0001 && first.newEntries.length===1 && second.newEntries.length===0;
  if(!passed) throw new Error(`QQQI E2E fixture 失敗：first=${first.netAdded}, after=${afterCash}, second=${second.netAdded}`);
  const nowIso=new Date().toISOString();
  const testId=`qqqi-e2e-${targetDate}`;
  const payload={
    testId,createdAt:nowIso,status:"success",mode:"qqqi_e2e_test",isolated:true,
    input:{cashUsd:2000,sharesQqqi:1000,amountPerShare:0.6346,taxRate:30,entitlementDate,payableDate:targetDate},
    firstPass:{grossUsd:first.newEntries[0]?.grossUsd||0,taxUsd:first.newEntries[0]?.taxUsd||0,netUsd:first.netAdded,afterCashUsd:afterCash,ledgerCount:first.ledger.length},
    secondPass:{netUsd:second.netAdded,newEntries:second.newEntries.length},
    checks:{expectedNetUsd:expectedNet,expectedAfterCashUsd:2444.22,idempotent:second.netAdded===0,passed},
    note:"隔離測試文件，不修改正式 IB cashUsd、portfolioHistory 或正式配息 ledger。App 前景同步後會讀到根文件的 E2E 狀態。"
  };
  await ref.collection("automationTests").doc(testId).set(payload,{merge:true});
  const rootPatch={
    qqqiE2eTestAt:nowIso,
    qqqiE2eTestStatus:"QQQI 隔離 E2E 通過：1000 股 × $0.6346，30% 預扣後 +$444.22；第二次執行 +$0，防重複正常。",
    qqqiE2eTestId:testId,
    qqqiE2eTestBeforeCashUsd:2000,
    qqqiE2eTestNetUsd:first.netAdded,
    qqqiE2eTestAfterCashUsd:afterCash,
    qqqiE2eTestSecondPassNetUsd:second.netAdded,
    autoSnapshotSource:"GitHub Actions"
  };
  const write=await patchRootWithRevision(db,ref,rootPatch,"github-actions-qqqi-e2e");
  return {status:"qqqi_e2e_passed",date:targetDate,testId,revision:write.revision,netUsd:first.netAdded,afterCashUsd:afterCash,secondPassNetUsd:second.netAdded};
}

async function processTestDashboard(db, ref, targetDate, fx, dividendInfo) {
  const snap=await ref.get();
  if(!snap.exists) return {status:"missing"};
  const data=snap.data()||{};
  const resolved=await resolvePrices(data,targetDate);
  const prices={...resolved.prices};
  const rate=fx?.rate>0?fx.rate:(number(data.usdtwd)||32);
  const sub=subValue(data,prices);
  const strategyUsd=strategyValue(data,prices);
  const ftUsd=Math.max(0,number(data.ftUsd));
  const twStockTwd=Math.max(0,number(data.twStockTwd));
  const otherTotalTwd=Math.max(0,number(data.otherTotalTwd));
  const totalTwd=(strategyUsd+ftUsd+sub.value)*rate+twStockTwd+otherTotalTwd;
  const nowIso=new Date().toISOString();
  const testId=`test-${nowIso.replace(/[^0-9]/g,"").slice(0,14)}`;
  const ftAge=ftUsd>0?calendarAgeDays(data.ftUpdatedAt):0;
  const quality=qualitySummary({resolved,fxFresh:Boolean(fx?.rate),ftStale:ftUsd>0&&ftAge>7});
  const pendingDividend=dividendInfo?.rows?planQqqiDividends(data,data.portfolioHistory||[],dividendInfo.rows,targetDate):{newEntries:[]};
  const payload={
    createdAt:nowIso, marketDate:targetDate, strategyUsd, totalTwd, rate,
    ftUsd, subUsd:sub.value, twStockTwd, otherTotalTwd,
    staleSymbols:resolved.stale, quality:quality.quality, qualityNote:quality.note,
    pendingQqqiDividendIds:pendingDividend.newEntries.map(x=>x.id), source:"github-actions-safe-test", status:"success"
  };
  await ref.collection("automationTests").doc(testId).set(payload,{merge:true});
  const write=await patchRootWithRevision(db,ref,{
    autoSnapshotTestAt:nowIso,
    autoSnapshotTestStatus:"安全測試已成功寫入 Firebase；正式歷史與配息現金未修改",
    autoSnapshotTestMarketDate:targetDate,
    autoSnapshotTestTotalTwd:totalTwd,
    autoSnapshotSource:"GitHub Actions"
  },"github-actions-safe-test");
  return {status:"test_written",date:targetDate,quality:quality.quality,stale:payload.staleSymbols,revision:write.revision};
}

async function processDashboard(db, ref, targetDate, fx, dividendInfo) {
  const initial=await ref.get();
  if(!initial.exists) return {status:"missing"};
  const initialData=initial.data()||{};
  const resolved=await resolvePrices(initialData,targetDate);
  const nowIso=new Date().toISOString();
  let outcome={status:"unknown"};

  await db.runTransaction(async tx=>{
    const currentSnap=await tx.get(ref);
    if(!currentSnap.exists){outcome={status:"missing"};return;}
    const data=currentSnap.data()||{};
    const currentRevision=Math.max(0,Math.floor(number(data.dataRevision)));
    const history=Array.isArray(data.portfolioHistory)?data.portfolioHistory.filter(Boolean):[];
    const existing=history.find(x=>String(x?.date||"").slice(0,10)===targetDate);
    const keepManual=Boolean(existing && isManualSnapshot(existing) && !FORCE);

    const dividendPlan=dividendInfo?.rows
      ? planQqqiDividends(data,history,dividendInfo.rows,targetDate)
      : {enabled:data.qqqiDividendAutomationEnabled!==false,taxRate:clamp(data.qqqiDividendTaxRate===undefined?30:data.qqqiDividendTaxRate,0,100),startDate:String(data.qqqiDividendStartDate||targetDate).slice(0,10),ledger:Array.isArray(data.qqqiDividendLedger)?data.qqqiDividendLedger:[],newEntries:[],netAdded:0};
    const cashBefore=number(data.cashUsd);
    const cashAfter=round4(cashBefore+dividendPlan.netAdded);
    const valuationData={...data,cashUsd:cashAfter};
    const prices={...resolved.prices};
    const rate=fx?.rate>0?fx.rate:(number(data.usdtwd)||32);
    const sub=subValue(valuationData,prices);
    const strategyUsd=strategyValue(valuationData,prices);
    const ftUsd=Math.max(0,number(data.ftUsd));
    const twStockTwd=Math.max(0,number(data.twStockTwd));
    const otherTotalTwd=Math.max(0,number(data.otherTotalTwd));
    const totalTwd=(strategyUsd+ftUsd+sub.value)*rate+twStockTwd+otherTotalTwd;
    const ftAge=ftUsd>0?calendarAgeDays(data.ftUpdatedAt):0;
    const ftStale=ftUsd>0&&ftAge>7;
    const quality=qualitySummary({resolved,fxFresh:Boolean(fx?.rate),ftStale});
    const snapshot={
      date:targetDate, createdAt:nowIso, strategyUsd, totalTwd, rate,
      rateUpdatedDate:targetDate, rateProvider:fx?.rate>0?"ExchangeRate-API":"沿用既有匯率",
      ftUsd, ftUpdatedAt:String(data.ftUpdatedAt||""), ftAgeDays:Number.isFinite(ftAge)?ftAge:null, ftStale,
      subUsd:sub.value, subSymbol:String(data.subSymbol||"").toUpperCase(),
      subShares:Math.max(0,number(data.subShares)), subCashUsd:Math.max(0,number(data.subCashUsd)),
      subPriceUsd:sub.price, twStockTwd, otherTotalTwd,
      sharesTqqq:number(data.sharesTqqq),sharesQqq:number(data.sharesQqq),sharesSpy:number(data.sharesSpy),sharesSpyi:number(data.sharesSpyi),sharesQqqi:number(data.sharesQqqi),cashUsd:cashAfter,otherUsd:number(data.otherUsd),
      reason:"auto_market_close", auto:true, source:"github-actions", staleSymbols:resolved.stale,
      quality:quality.quality,qualityNote:quality.note,expectedPriceCount:resolved.expectedCount,freshPriceCount:resolved.freshCount,priceMeta:resolved.priceMeta,
      fxFresh:Boolean(fx?.rate),dividendNetAddedUsd:dividendPlan.netAdded,dividendIds:dividendPlan.newEntries.map(x=>x.id)
    };
    const nextHistory=keepManual
      ? [...history]
      : history.filter(x=>String(x?.date||"").slice(0,10)!==targetDate);
    if(!keepManual) nextHistory.push(snapshot);
    nextHistory.sort((a,b)=>String(a.date||"").localeCompare(String(b.date||"")));

    const priceSources={...(data.priceSources||{})};
    for(const [symbol,meta] of Object.entries(resolved.priceMeta||{})){
      if(meta?.fresh) priceSources[symbol]="Finnhub｜盤後自動";
    }
    const dividendError=dividendInfo?.error||"";
    const patch={
      spy:number(prices.SPY)||number(data.spy), qqq:number(prices.QQQ)||number(data.qqq),
      tqqq:number(prices.TQQQ)||number(data.tqqq), spyi:number(prices.SPYI)||number(data.spyi),
      qqqi:number(prices.QQQI)||number(data.qqqi), cashUsd:cashAfter,
      marketDate:targetDate, marketCloseDate:targetDate, priceUpdatedAt:nowIso, priceSources,
      subUsd:sub.value, subPriceUsd:sub.price||number(data.subPriceUsd),
      subPriceUpdatedAt:sub.price>0?nowIso:String(data.subPriceUpdatedAt||""),
      usdtwd:rate, exchangeRateUpdatedDate:targetDate, exchangeRateUpdatedAt:nowIso,
      exchangeRateSourceUpdatedAt:fx?.sourceUpdatedAt||String(data.exchangeRateSourceUpdatedAt||""),
      exchangeRateNextUpdateAt:fx?.nextUpdateAt||String(data.exchangeRateNextUpdateAt||""),
      exchangeRateLastAttemptDate:targetDate, exchangeRateLastError:fx?.rate?"":"自動匯率取得失敗，沿用既有值", exchangeRateProvider:"ExchangeRate-API",
      portfolioHistory:nextHistory.slice(-1200),
      autoSnapshotMarketDate:targetDate, autoSnapshotUpdatedAt:nowIso,
      autoSnapshotLastError:quality.quality==="complete"?"":quality.note,
      autoSnapshotQuality:quality.quality,autoSnapshotQualityNote:quality.note,
      autoSnapshotFreshPrices:resolved.freshCount,autoSnapshotExpectedPrices:resolved.expectedCount,
      autoSnapshotStaleSymbols:resolved.stale,autoSnapshotFtAgeDays:Number.isFinite(ftAge)?ftAge:null,
      autoSnapshotSource:"GitHub Actions",
      qqqiDividendAutomationEnabled:dividendPlan.enabled,qqqiDividendTaxRate:dividendPlan.taxRate,qqqiDividendStartDate:dividendPlan.startDate,
      qqqiDividendLedger:dividendPlan.ledger,qqqiDividendLastCheckAt:nowIso,
      qqqiDividendLastError:dividendError,qqqiDividendLastProcessedAt:dividendPlan.newEntries.length?nowIso:String(data.qqqiDividendLastProcessedAt||""),
      dataRevision:currentRevision+1,lastWriteId:`github-actions-${nowIso.replace(/[^0-9]/g,"").slice(0,14)}`,lastWriteSource:"github-actions-snapshot",lastWriteAt:nowIso,
      clientAppVersion:"股票資產 PWA v6.1｜SPY／QQQ 200SMA 參考切換",autoSnapshotServerUpdatedAt:FieldValue.serverTimestamp()
    };
    tx.set(ref,patch,{merge:true});

    let runningCash=cashBefore;
    for(const entry of dividendPlan.newEntries){
      const before=holdingsState(data,runningCash);
      runningCash=round4(runningCash+entry.netUsd);
      const after=holdingsState(data,runningCash);
      const recordId=`dividend-qqqi-${entry.payableDate}`;
      const recordRef=ref.collection("records").doc(recordId);
      tx.set(recordRef,{
        recordSchemaVersion:2,recordId,strategyId:"tqqq-spy200",strategyVersion:"RISKREF-SPY-QQQ-4-3-HOT-19-24-28-INTRO-v1.3",recordType:"dividend",createdAt:nowIso,
        dates:{marketClose:targetDate,signal:entry.exDate,execution:entry.payableDate},
        prices:{SPY:number(prices.SPY),QQQ:number(prices.QQQ),TQQQ:number(prices.TQQQ),SPYI:number(prices.SPYI),QQQI:number(prices.QQQI)},
        indicators:{SPY200:number(data.spySma),QQQ200:number(data.qqqSma)},
        state:{marketState:String(data.marketState||"NEUTRAL"),hotRank:number(data.hotRank),riskBenchmark:["SPY","QQQ"].includes(String(data.riskBenchmark||"SPY").toUpperCase())?String(data.riskBenchmark||"SPY").toUpperCase():"SPY",hotAsset:String(data.hotAsset||"QQQ"),introAsset:String(data.introAsset||"QQQI"),strategyPhase:String(data.strategyPhase||""),dcaActive:data.dcaActive===true,dcaCompleted:number(data.dcaCompleted),riskOffCycleId:String(data.riskOffCycleId||""),riskOnCycleId:String(data.riskOnCycleId||"")},
        holdings:{before,after},valuation:{totalUsd:strategyUsd,totalDisplay:`$${round2(strategyUsd)}`},
        decision:{title:"QQQI 配息入帳",allocation:"IB 現金",immediate:"",formalState:"",todayAction:`稅後配息 +$${round2(entry.netUsd)}`},
        cashflow:{type:"dividend",amountUsd:entry.netUsd,date:entry.payableDate,note:`QQQI ${entry.eligibleShares} 股 × $${entry.amountPerShare}；預扣 ${entry.taxRate}%`},
        dividend:entry,actions:[`QQQI 稅前 $${round2(entry.grossUsd)}，預扣稅 $${round2(entry.taxUsd)}，稅後加入 IB 現金 $${round2(entry.netUsd)}`],
        notes:entry.estimatedShares?`持股基準使用${entry.shareSource}，建議與券商實際入帳核對。`:"依除息日前一交易日持股快照計算。",deletedAt:null
      },{merge:true});
    }
    outcome={status:keepManual?"manual_kept":"updated",date:targetDate,quality:quality.quality,stale:resolved.stale,dividendsAdded:dividendPlan.newEntries.map(x=>x.id),revision:currentRevision+1};
  });
  return outcome;
}

async function main() {
  const qqqiE2eTest=RUN_MODE==="qqqi_e2e_test";
  if (!qqqiE2eTest && !FINNHUB_API_KEY) throw new Error("缺少 FINNHUB_API_KEY GitHub Secret");
  const serviceAccount=parseServiceAccount(FIREBASE_SERVICE_ACCOUNT);
  initializeApp({credential:cert(serviceAccount)});
  const db=getFirestore();
  const targetDate=latestCompletedTradingDay();
  console.log(`目標美股交易日：${targetDate}`);

  const group=await db.collectionGroup("strategyDashboards").get();
  const refs=group.docs.filter(doc=>doc.id===DASHBOARD_ID).map(doc=>doc.ref);
  if(!refs.length){ console.log(`找不到 dashboard id=${DASHBOARD_ID}；請至少用 Google 登入 App 並同步一次。`); return; }

  const results=[];
  if(qqqiE2eTest){
    console.log("執行模式：QQQI 隔離 E2E 測試（不連 Finnhub／NEOS，不修改正式資產資料）");
    for(const ref of refs){
      try { results.push(await processQqqiE2eDashboard(db,ref,targetDate)); }
      catch(error){
        console.error(`QQQI 隔離 E2E 失敗：${String(error.message||error).slice(0,240)}`);
        try { await patchRootWithRevision(db,ref,{qqqiE2eTestAt:new Date().toISOString(),qqqiE2eTestStatus:`QQQI 隔離 E2E 失敗：${String(error.message||error).slice(0,160)}`,autoSnapshotSource:"GitHub Actions"},"github-actions-qqqi-e2e-error"); } catch(_) {}
        results.push({status:"error",error:String(error.message||error).slice(0,160)});
      }
    }
    console.log(JSON.stringify(results,null,2));
    if(results.some(x=>x.status==="error")) process.exitCode=1;
    return;
  }

  let fx=null;
  try { fx=await fxRate(); console.log("USD/TWD 匯率更新成功"); }
  catch(error){ console.warn(`匯率更新失敗，將沿用各帳戶現有匯率：${error.message}`); }

  let dividendInfo={rows:[],error:""};
  try { dividendInfo.rows=await fetchQqqiDistributions(); console.log("QQQI 官方配息資料檢查完成"); }
  catch(error){ dividendInfo.error=String(error.message||error).slice(0,200); console.warn(`QQQI 配息資料暫時無法取得：${dividendInfo.error}`); }

  const safeTest=RUN_MODE==="safe_test";
  console.log(`執行模式：${safeTest?"安全測試寫入（不修改正式歷史與配息現金）":"正式盤後快照"}`);
  for(const ref of refs){
    try {
      results.push(safeTest?await processTestDashboard(db,ref,targetDate,fx,dividendInfo):await processDashboard(db,ref,targetDate,fx,dividendInfo));
    }
    catch(error){
      console.error(`資產快照更新失敗：${String(error.message||error).slice(0,240)}`);
      try { await patchRootWithRevision(db,ref,{autoSnapshotLastError:String(error.message||error).slice(0,240),autoSnapshotUpdatedAt:new Date().toISOString(),autoSnapshotSource:"GitHub Actions"},"github-actions-error"); } catch(_) {}
      results.push({status:"error",error:String(error.message||error).slice(0,160)});
    }
  }
  console.log(JSON.stringify(results,null,2));
  if(results.some(x=>x.status==="error")) process.exitCode=1;
}

main().catch(error=>fail(error.stack||error.message||String(error)));
