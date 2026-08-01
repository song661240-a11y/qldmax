import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const DASHBOARD_ID = process.env.TARGET_DASHBOARD_ID || "tqqq-qqq200-main";
const FIREBASE_SERVICE_ACCOUNT = process.env.FIREBASE_SERVICE_ACCOUNT || "";
const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY || "d4q36b9r01qha6q0jclgd4q36b9r01qha6q0jcm0";
const FORCE = String(process.env.FORCE || "").toLowerCase() === "true";
const RUN_MODE = String(process.env.RUN_MODE || "normal_snapshot").toLowerCase();
const FX_ENDPOINT = "https://open.er-api.com/v6/latest/USD";

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
const round4 = value => Math.round(number(value) * 10000) / 10000;
const ymd = date => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
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

async function fetchJson(url, timeoutMs=15000) {
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try {
    const response=await fetch(url,{cache:"no-store",signal:controller.signal,headers:{"User-Agent":"stock-assets-daily-snapshot/1.0"}});
    if(!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally { clearTimeout(timer); }
}

const quoteCache=new Map();
async function quote(symbol) {
  const clean=String(symbol||"").toUpperCase().replace(/[^A-Z0-9.\-]/g,"").slice(0,12);
  if(!clean) return null;
  if(quoteCache.has(clean)) return quoteCache.get(clean);
  const promise=(async()=>{
    const body=await fetchJson(`https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(clean)}&token=${encodeURIComponent(FINNHUB_API_KEY)}`);
    const price=number(body?.c);
    if(price<=0) throw new Error(`${clean} 無有效收盤價`);
    return {symbol:clean,price:Math.round(price*100)/100};
  })();
  quoteCache.set(clean,promise);
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
  const sub=String(data.subSymbol||"").toUpperCase();
  if(sub && number(data.subShares)>0) symbols.add(sub);
  return [...symbols];
}

async function resolvePrices(data) {
  const symbols=heldSymbols(data);
  const settled=await Promise.allSettled(symbols.map(symbol=>quote(symbol)));
  const prices={
    SPY:number(data.spy), QQQ:number(data.qqq), TQQQ:number(data.tqqq),
    SPYI:number(data.spyi), QQQI:number(data.qqqi)
  };
  const stale=[];
  settled.forEach((result,index)=>{
    const symbol=symbols[index];
    if(result.status==="fulfilled" && result.value?.price>0) prices[symbol]=result.value.price;
    else stale.push(symbol);
  });
  return {prices,stale};
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

async function processTestDashboard(db, ref, targetDate, fx) {
  const snap=await ref.get();
  if(!snap.exists) return {status:"missing",path:ref.path};
  const data=snap.data()||{};
  const resolved=await resolvePrices(data);
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
  const payload={
    createdAt:nowIso, marketDate:targetDate, strategyUsd, totalTwd, rate,
    ftUsd, subUsd:sub.value, twStockTwd, otherTotalTwd,
    staleSymbols:[...new Set(resolved.stale||[])], source:"github-actions-safe-test",
    status:"success"
  };
  await ref.collection("automationTests").doc(testId).set(payload,{merge:true});
  await ref.set({
    autoSnapshotTestAt:nowIso,
    autoSnapshotTestStatus:"安全測試已成功寫入 Firebase；正式歷史未修改",
    autoSnapshotTestMarketDate:targetDate,
    autoSnapshotTestTotalTwd:totalTwd,
    autoSnapshotSource:"GitHub Actions",
    autoSnapshotServerUpdatedAt:FieldValue.serverTimestamp()
  },{merge:true});
  return {status:"test_written",path:ref.path,date:targetDate,totalTwd,rate,stale:payload.staleSymbols};
}

async function processDashboard(db, ref, targetDate, fx) {
  const initial=await ref.get();
  if(!initial.exists) return {status:"missing",path:ref.path};
  const initialData=initial.data()||{};
  const resolved=await resolvePrices(initialData);
  const nowIso=new Date().toISOString();
  let outcome={status:"unknown",path:ref.path};

  await db.runTransaction(async tx=>{
    const currentSnap=await tx.get(ref);
    if(!currentSnap.exists){outcome={status:"missing",path:ref.path};return;}
    const data=currentSnap.data()||{};
    const history=Array.isArray(data.portfolioHistory)?data.portfolioHistory.filter(Boolean):[];
    const existing=history.find(x=>String(x?.date||"").slice(0,10)===targetDate);
    if(existing && isManualSnapshot(existing) && !FORCE){
      outcome={status:"manual_kept",path:ref.path,date:targetDate};
      return;
    }

    const prices={...resolved.prices};
    const rate=fx?.rate>0?fx.rate:(number(data.usdtwd)||32);
    const sub=subValue(data,prices);
    const strategyUsd=strategyValue(data,prices);
    const ftUsd=Math.max(0,number(data.ftUsd));
    const twStockTwd=Math.max(0,number(data.twStockTwd));
    const otherTotalTwd=Math.max(0,number(data.otherTotalTwd));
    const totalTwd=(strategyUsd+ftUsd+sub.value)*rate+twStockTwd+otherTotalTwd;
    const stale=[...new Set(resolved.stale.filter(symbol=>number(prices[symbol])<=0 || symbol===String(data.subSymbol||"").toUpperCase()))];
    const snapshot={
      date:targetDate, createdAt:nowIso, strategyUsd, totalTwd, rate,
      rateUpdatedDate:targetDate, rateProvider:"ExchangeRate-API",
      ftUsd, ftUpdatedAt:String(data.ftUpdatedAt||""),
      subUsd:sub.value, subSymbol:String(data.subSymbol||"").toUpperCase(),
      subShares:Math.max(0,number(data.subShares)), subCashUsd:Math.max(0,number(data.subCashUsd)),
      subPriceUsd:sub.price, twStockTwd, otherTotalTwd,
      reason:"auto_market_close", auto:true, source:"github-actions", staleSymbols:stale
    };
    const nextHistory=history.filter(x=>String(x?.date||"").slice(0,10)!==targetDate);
    nextHistory.push(snapshot);
    nextHistory.sort((a,b)=>String(a.date||"").localeCompare(String(b.date||"")));

    const priceSources={...(data.priceSources||{})};
    for(const symbol of ["SPY","QQQ","TQQQ","SPYI","QQQI"]){
      if(number(prices[symbol])>0) priceSources[symbol]="Finnhub｜盤後自動";
    }
    const patch={
      spy:number(prices.SPY)||number(data.spy), qqq:number(prices.QQQ)||number(data.qqq),
      tqqq:number(prices.TQQQ)||number(data.tqqq), spyi:number(prices.SPYI)||number(data.spyi),
      qqqi:number(prices.QQQI)||number(data.qqqi),
      marketDate:targetDate, marketCloseDate:targetDate, priceUpdatedAt:nowIso, priceSources,
      subUsd:sub.value, subPriceUsd:sub.price||number(data.subPriceUsd),
      subPriceUpdatedAt:sub.price>0?nowIso:String(data.subPriceUpdatedAt||""),
      usdtwd:rate, exchangeRateUpdatedDate:targetDate, exchangeRateUpdatedAt:nowIso,
      exchangeRateSourceUpdatedAt:fx?.sourceUpdatedAt||String(data.exchangeRateSourceUpdatedAt||""),
      exchangeRateNextUpdateAt:fx?.nextUpdateAt||String(data.exchangeRateNextUpdateAt||""),
      exchangeRateLastAttemptDate:targetDate, exchangeRateLastError:"", exchangeRateProvider:"ExchangeRate-API",
      portfolioHistory:nextHistory.slice(-1200),
      autoSnapshotMarketDate:targetDate, autoSnapshotUpdatedAt:nowIso,
      autoSnapshotLastError:stale.length?`部分報價沿用既有值：${stale.join("、")}`:"",
      autoSnapshotSource:"GitHub Actions",
      autoSnapshotServerUpdatedAt:FieldValue.serverTimestamp()
    };
    tx.set(ref,patch,{merge:true});
    outcome={status:"updated",path:ref.path,date:targetDate,strategyUsd,totalTwd,rate,stale};
  });
  return outcome;
}

async function main() {
  const serviceAccount=parseServiceAccount(FIREBASE_SERVICE_ACCOUNT);
  initializeApp({credential:cert(serviceAccount)});
  const db=getFirestore();
  const targetDate=latestCompletedTradingDay();
  console.log(`目標美股交易日：${targetDate}`);

  let fx=null;
  try { fx=await fxRate(); console.log(`USD/TWD：${fx.rate}`); }
  catch(error){ console.warn(`匯率更新失敗，將沿用各帳戶現有匯率：${error.message}`); }

  const group=await db.collectionGroup("strategyDashboards").get();
  const refs=group.docs.filter(doc=>doc.id===DASHBOARD_ID).map(doc=>doc.ref);
  if(!refs.length){ console.log(`找不到 dashboard id=${DASHBOARD_ID}；請至少用 Google 登入 App 並同步一次。`); return; }

  const results=[];
  const safeTest=RUN_MODE==="safe_test";
  console.log(`執行模式：${safeTest?"安全測試寫入（不修改正式歷史）":"正式盤後快照"}`);
  for(const ref of refs){
    try { results.push(safeTest?await processTestDashboard(db,ref,targetDate,fx):await processDashboard(db,ref,targetDate,fx)); }
    catch(error){
      console.error(`${ref.path} 更新失敗：${error.stack||error.message}`);
      try { await ref.set({autoSnapshotLastError:String(error.message||error).slice(0,240),autoSnapshotUpdatedAt:new Date().toISOString(),autoSnapshotSource:"GitHub Actions"},{merge:true}); } catch(_) {}
      results.push({status:"error",path:ref.path,error:error.message});
    }
  }
  console.log(JSON.stringify(results,null,2));
  if(results.some(x=>x.status==="error")) process.exitCode=1;
}

main().catch(error=>fail(error.stack||error.message||String(error)));
