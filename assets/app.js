window.addEventListener('error', function(e){var root=document.getElementById('root'); if(root && !root.innerHTML){root.innerHTML='<div style="padding:20px;font-family:sans-serif;color:#b91c1c;background:#fff1f2;min-height:100vh"><h2>網頁載入錯誤</h2><p>'+ (e.message||'未知錯誤') +'</p><p>請重新上傳最新版 index.html。</p></div>';}});
const { useCallback, useEffect, useMemo, useRef, useState } = React;
const firebaseConfig = {
    apiKey: "AIzaSyBpax3wlTwHTe6G3niZajtTxpoUWbgvX80",
    authDomain: "qldmax.firebaseapp.com",
    projectId: "qldmax",
    storageBucket: "qldmax.firebasestorage.app",
    messagingSenderId: "752199866954",
    appId: "1:752199866954:web:50d17ae522095c363d64b3"
};
const HAS_FIREBASE = typeof firebase !== "undefined" && firebase.apps;
if (HAS_FIREBASE && !firebase.apps.length)
    firebase.initializeApp(firebaseConfig);
const auth = HAS_FIREBASE ? firebase.auth() : null;
const db = HAS_FIREBASE ? firebase.firestore() : null;
const DOC_PATH = ["strategyDashboards", "tqqq-qqq200-main"];
const APP_VERSION = "股票資產 PWA v4.9｜每日線上匯率版";
const STRATEGY_ID = "tqqq-spy200";
const STRATEGY_VERSION = "SPY200-4-3-HOT-19-24-28";
const RECORD_SCHEMA_VERSION = 2;
const LOCAL_KEY = "tqqqSpy200PermanentV7";
const BACKUP_KEY = LOCAL_KEY + "_backupCardsV1";
const readStoredObject = (suffix = "") => {
    try {
        const raw = localStorage.getItem(LOCAL_KEY + suffix);
        return raw ? JSON.parse(raw) : {};
    } catch (e) { return {}; }
};
const readBackupCards = () => {
    try {
        const raw=localStorage.getItem(BACKUP_KEY);
        const list=raw?JSON.parse(raw):[];
        return Array.isArray(list)?list:[];
    } catch(e){ return []; }
};
const readUiPreferences = () => {
    try { const raw=localStorage.getItem(LOCAL_KEY+"_ui"); return raw?JSON.parse(raw):{}; } catch(e){ return {}; }
};
const writeUiPreference = (key,value) => {
    const next={...readUiPreferences(),[key]:value};
    localStorage.setItem(LOCAL_KEY+"_ui",JSON.stringify(next));
};
const writeBackupCards = list => {
    localStorage.setItem(BACKUP_KEY, JSON.stringify((Array.isArray(list)?list:[]).slice(0,5)));
};
const FINNHUB_KEY = "d4q36b9r01qha6q0jclgd4q36b9r01qha6q0jcm0";
const EXCHANGE_RATE_ENDPOINT = "https://open.er-api.com/v6/latest/USD";
const EXCHANGE_RATE_PROVIDER = "ExchangeRate-API";
const isExchangeRateDue = (source, force = false, date = todayStr()) => force || String(source?.exchangeRateLastAttemptDate || "") !== date;
async function fetchUsdTwdRate() {
    const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timer = setTimeout(() => { try { controller?.abort(); } catch(e) {} }, 12000);
    try {
        const response = await fetch(EXCHANGE_RATE_ENDPOINT, { cache:"no-store", signal:controller?.signal });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const body = await response.json();
        const rate = getNum(body?.rates?.TWD);
        if (body?.result !== "success") throw new Error(body?.["error-type"] || "API 回傳失敗");
        if (!(rate >= 10 && rate <= 100)) throw new Error("TWD 匯率資料異常");
        return {
            rate: Math.round(rate * 10000) / 10000,
            provider: EXCHANGE_RATE_PROVIDER,
            sourceUpdatedAt: body?.time_last_update_utc || "",
            nextUpdateAt: body?.time_next_update_utc || ""
        };
    } catch (error) {
        if (error?.name === "AbortError") throw new Error("連線逾時");
        throw error;
    } finally {
        clearTimeout(timer);
    }
}
const todayStr = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
const getNum = v => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; };
const money = (v, digits = 0) => (Number(v) || 0).toLocaleString("en-US", { maximumFractionDigits: digits, minimumFractionDigits: digits });
const pct = (v, digits = 2) => Number.isFinite(v) ? `${(v * 100).toFixed(digits)}%` : "-";
const round2 = v => Math.round((Number(v) || 0) * 100) / 100;
const sanitize = data => JSON.parse(JSON.stringify(data, (k, v) => v === undefined ? null : v));
const signedPctText = (v, digits = 1) => `${v >= 0 ? "+" : ""}${(Number(v) || 0).toFixed(digits)}%`;
const parseDateLocal = v => { if(!v) return null; const d = new Date(v + 'T12:00:00'); return Number.isNaN(d.getTime()) ? null : d; };
const formatDateLocal = d => { if(!d || Number.isNaN(d.getTime())) return ''; return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
const nthWeekdayOfMonth = (year, monthIndex, weekday, nth) => { const d=new Date(year,monthIndex,1,12); let shift=(weekday-d.getDay()+7)%7; d.setDate(1+shift+(nth-1)*7); return d; };
const lastWeekdayOfMonth = (year, monthIndex, weekday) => { const d=new Date(year,monthIndex+1,0,12); let shift=(d.getDay()-weekday+7)%7; d.setDate(d.getDate()-shift); return d; };
const easterSunday = year => { const a=year%19,b=Math.floor(year/100),c=year%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451),month=Math.floor((h+l-7*m+114)/31)-1,day=((h+l-7*m+114)%31)+1; return new Date(year,month,day,12); };
const observedFixedHoliday = (year, monthIndex, day) => { const d=new Date(year,monthIndex,day,12), w=d.getDay(); if(w===6)d.setDate(d.getDate()-1); else if(w===0)d.setDate(d.getDate()+1); return d; };
const US_MARKET_HOLIDAY_CACHE=new Map();
const usMarketHolidaySet = year => { if(US_MARKET_HOLIDAY_CACHE.has(year)) return US_MARKET_HOLIDAY_CACHE.get(year); const set=new Set(), add=d=>set.add(formatDateLocal(d));
    add(observedFixedHoliday(year,0,1));
    add(nthWeekdayOfMonth(year,0,1,3));
    add(nthWeekdayOfMonth(year,1,1,3));
    const goodFriday=easterSunday(year); goodFriday.setDate(goodFriday.getDate()-2); add(goodFriday);
    add(lastWeekdayOfMonth(year,4,1));
    if(year>=2022) add(observedFixedHoliday(year,5,19));
    add(observedFixedHoliday(year,6,4));
    add(nthWeekdayOfMonth(year,8,1,1));
    add(nthWeekdayOfMonth(year,10,4,4));
    add(observedFixedHoliday(year,11,25));
    US_MARKET_HOLIDAY_CACHE.set(year,set); return set;
};
const isUsTradingDay = dateOrText => { const d=typeof dateOrText==='string'?parseDateLocal(dateOrText):new Date(dateOrText); if(!d||Number.isNaN(d.getTime()))return false; const w=d.getDay(); if(w===0||w===6)return false; return !usMarketHolidaySet(d.getFullYear()).has(formatDateLocal(d)); };
const addTradingDays = (dateText, count=21) => { const d=parseDateLocal(dateText)||new Date(); let left=Math.max(0,Math.floor(count)); while(left>0){ d.setDate(d.getDate()+1); if(isUsTradingDay(d))left--; } return formatDateLocal(d); };
const tradingDayDistance = (fromText, toText=todayStr()) => { const from=parseDateLocal(fromText), to=parseDateLocal(toText); if(!from||!to)return Infinity; if(from>to)return 0; let n=0,d=new Date(from); while(formatDateLocal(d)<formatDateLocal(to)){ d.setDate(d.getDate()+1); if(isUsTradingDay(d))n++; if(n>5000)break; } return n; };
const latestCompletedUsTradingDay = (now=new Date()) => { const d=new Date(now); d.setHours(12,0,0,0); const today=formatDateLocal(d); const nyParts=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',hour:'2-digit',minute:'2-digit',hour12:false}).formatToParts(now); const hh=Number(nyParts.find(x=>x.type==='hour')?.value||0), mm=Number(nyParts.find(x=>x.type==='minute')?.value||0); if(!isUsTradingDay(d) || hh<16 || (hh===16&&mm<15)){ do{d.setDate(d.getDate()-1);}while(!isUsTradingDay(d)); return formatDateLocal(d); } return today; };
const DEFAULT = {
    schemaVersion: 2,
    spy: "", spySma: "", qqq: "", qqqSma: "", tqqq: "", spyi: "", qqqi: "", marketDate: "", marketCloseDate: "", signalDate: "", executionDate: "",
    entryBuffer: 4, exitBuffer: 3, hot1: 19, hot2: 24, hot3: 28, hotAsset: "QQQ",
    // 正式策略狀態：市場、過熱與 DCA 分開保存，避免中間區覆蓋狀態。
    marketState: "NEUTRAL", hotRank: 0, riskOnCycleId: "",
    strategyPhase: "INTRO_QQQ", // INTRO_QQQ → WAIT_REENTRY → ACTIVE
    parametersLocked: true,
    dcaActive: false, dcaCompleted: 0, dcaPoolUsd: 0, dcaLastDate: "", dcaNextDueDate: "", riskOffCycleId: "",
    notes: "",
    sharesTqqq: 0, sharesQqq: 0, sharesSpy: 0, sharesSpyi: 0, sharesQqqi: 0, cashUsd: 0, otherUsd: 0, usdtwd: 32, currency: "USD",
    exchangeRateUpdatedDate: "", exchangeRateUpdatedAt: "", exchangeRateSourceUpdatedAt: "", exchangeRateNextUpdateAt: "", exchangeRateLastAttemptDate: "", exchangeRateLastError: "", exchangeRateProvider: "",
    ftUsd: 0, subUsd: 0, twStockTwd: 0, otherTotalTwd: 0,
    subSymbol: "", subShares: 0, subCashUsd: 0, subAvgCostUsd: 0, subPriceUsd: 0, subPriceUpdatedAt: "",
    externalCashflows: [],
    assetHighUsd: 0, lastExecutedAt: "", lastExecutionSummary: "",
    scenarioSign: -1, scenarioAbsPct: 10,
    priceUpdatedAt: "", smaUpdatedAt: "", lastFetchAttemptAt: "",
    privacyMode: false, coverTheme: "aurora",
    priceSources: {}, portfolioHistory: [], history: []
}
const makeRecordId = () => (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : `rec-${Date.now()}-${Math.random().toString(36).slice(2,10)}`;
const normalizeRecord = raw => {
    const r=(raw&&typeof raw==='object')?raw:{};
    const canonical = r.recordSchemaVersion===RECORD_SCHEMA_VERSION && r.dates && r.prices && r.state && r.holdings && r.decision
        ? r
        : {
            recordSchemaVersion: RECORD_SCHEMA_VERSION,
            recordId: r.recordId || r.id || makeRecordId(),
            strategyId: r.strategyId || STRATEGY_ID,
            strategyVersion: r.strategyVersion || STRATEGY_VERSION,
            recordType: r.recordType || r.kind || 'execution',
            createdAt: r.createdAt || r.time || new Date().toISOString(),
            dates: { marketClose: r.marketCloseDate || r.marketDate || '', signal: r.signalDate || r.marketDate || '', execution: r.executionDate || String(r.time||'').slice(0,10) || '' },
            prices: { SPY:getNum(r.prices?.SPY ?? r.spy), QQQ:getNum(r.prices?.QQQ ?? r.qqq), TQQQ:getNum(r.prices?.TQQQ ?? r.tqqq), SPYI:getNum(r.prices?.SPYI ?? r.spyi), QQQI:getNum(r.prices?.QQQI ?? r.qqqi) },
            indicators: { SPY200:getNum(r.indicators?.SPY200 ?? r.spySma), QQQ200:getNum(r.indicators?.QQQ200 ?? r.qqqSma) },
            state: { marketState:r.state?.marketState || r.marketState || 'NEUTRAL', hotRank:getNum(r.state?.hotRank ?? r.hotRank), hotAsset:['QQQ','SPY','SPYI','QQQI'].includes(String(r.state?.hotAsset||r.hotAsset||'QQQ').toUpperCase())?String(r.state?.hotAsset||r.hotAsset||'QQQ').toUpperCase():'QQQ', strategyPhase:r.state?.strategyPhase || r.strategyPhase || '', dcaActive:Boolean(r.state?.dcaActive ?? r.dcaActive), dcaCompleted:getNum(r.state?.dcaCompleted ?? r.dcaCompleted), riskOffCycleId:r.state?.riskOffCycleId || r.riskOffCycleId || '', riskOnCycleId:r.state?.riskOnCycleId || r.riskOnCycleId || '' },
            holdings: { before:r.holdings?.before || r.beforeShares || r.shares || {}, after:r.holdings?.after || r.afterShares || r.shares || {} },
            valuation: { totalUsd:getNum(r.valuation?.totalUsd ?? r.totalUsd), totalDisplay:r.valuation?.totalDisplay || r.totalDisplay || '' },
            decision: { title:r.decision?.title || r.signal?.title || (typeof r.signal==='string'?r.signal:'') || '', allocation:r.decision?.allocation || r.signal?.allocation || r.allocation || '', immediate:r.decision?.immediate || r.signal?.immediate || r.immediateSignal || '', formalState:r.decision?.formalState || r.signal?.formalState || r.formalStateText || '', todayAction:r.decision?.todayAction || r.signal?.todayAction || r.todayAction || '' },
            cashflow: { type:r.cashflow?.type || r.flowType || '', amountUsd:getNum(r.cashflow?.amountUsd ?? r.amountUsd), date:r.cashflow?.date || r.flowDate || r.executionDate || '', note:r.cashflow?.note || r.notes || '' },
            actions: Array.isArray(r.actions)?r.actions:[], notes:r.notes || '', deletedAt:r.deletedAt || null
        };
    canonical.recordSchemaVersion=RECORD_SCHEMA_VERSION;
    canonical.cashflow=canonical.cashflow||{type:'',amountUsd:0,date:'',note:''};
    const after=canonical.holdings?.after||{};
    const archiveDate=canonical.dates?.execution||canonical.dates?.signal||canonical.dates?.marketClose||String(canonical.createdAt||'').slice(0,10);
    const archiveYear=String(archiveDate||'').slice(0,4)||'0000', archiveMonth=String(archiveDate||'').slice(5,7)||'00';
    return { ...canonical, archiveYear, archiveMonth, archiveYearMonth:`${archiveYear}-${archiveMonth}`,
        time:canonical.createdAt, timeText:new Date(canonical.createdAt).toLocaleString('zh-TW'), kind:canonical.recordType,
        marketDate:canonical.dates?.marketClose||'', marketCloseDate:canonical.dates?.marketClose||'', signalDate:canonical.dates?.signal||'', executionDate:canonical.dates?.execution||'',
        signal:canonical.decision?.title||'', allocation:canonical.decision?.allocation||'', totalUsd:getNum(canonical.valuation?.totalUsd), totalDisplay:canonical.valuation?.totalDisplay||'',
        spy:getNum(canonical.prices?.SPY), spySma:getNum(canonical.indicators?.SPY200), qqq:getNum(canonical.prices?.QQQ), qqqSma:getNum(canonical.indicators?.QQQ200), tqqq:getNum(canonical.prices?.TQQQ), spyi:getNum(canonical.prices?.SPYI), qqqi:getNum(canonical.prices?.QQQI),
        shares:after, beforeShares:canonical.holdings?.before||{}, afterShares:after,
        marketState:canonical.state?.marketState||'', hotRank:getNum(canonical.state?.hotRank), dcaActive:Boolean(canonical.state?.dcaActive), dcaCompleted:getNum(canonical.state?.dcaCompleted),
        immediateSignal:canonical.decision?.immediate||'', formalStateText:canonical.decision?.formalState||'', todayAction:canonical.decision?.todayAction||'',
        cashflowType:canonical.cashflow?.type||'', cashflowAmountUsd:getNum(canonical.cashflow?.amountUsd), cashflowDate:canonical.cashflow?.date||'', cashflowNote:canonical.cashflow?.note||''
    };
};
const REPLACEABLE_DAILY_RECORD_TYPES = new Set(["execution", "snapshot", "manual_hot_cycle"]);
const recordDayText = record => String(record?.dates?.execution || record?.executionDate || record?.dates?.signal || record?.signalDate || record?.createdAt || "").slice(0,10);
const dailyRecordKey = record => {
    const rec=normalizeRecord(record);
    const day=recordDayText(rec);
    return REPLACEABLE_DAILY_RECORD_TYPES.has(rec.recordType) && day ? `${rec.recordType}|${day}` : "";
};
const collapseDailyRecords = records => {
    const normalized=(Array.isArray(records)?records:[]).map(normalizeRecord).filter(r=>!r.deletedAt);
    normalized.sort((a,b)=>String(b.createdAt||"").localeCompare(String(a.createdAt||"")));
    const seen=new Set(), kept=[];
    normalized.forEach(rec=>{
        const key=dailyRecordKey(rec);
        if(key){ if(seen.has(key)) return; seen.add(key); }
        kept.push(rec);
    });
    return kept;
};
const prepareSameDayRecord = (record, history) => {
    const rec=normalizeRecord(record), key=dailyRecordKey(rec);
    if(!key) return rec;
    const same=collapseDailyRecords(history).filter(item=>dailyRecordKey(item)===key);
    const keep=same[0]||null;
    const allSame=(Array.isArray(history)?history:[]).map(normalizeRecord).filter(item=>dailyRecordKey(item)===key);
    const recordId=keep?.recordId || rec.recordId;
    const replacedRecordIds=[...new Set(allSame.map(item=>item.recordId).filter(id=>id&&id!==recordId))];
    return normalizeRecord({...rec,recordId,replacedRecordIds});
};
const replaceSameDayHistory = (history, record) => {
    const rec=normalizeRecord(record), key=dailyRecordKey(rec);
    if(!key) return [rec,...collapseDailyRecords(history).filter(item=>item.recordId!==rec.recordId)];
    return [rec,...collapseDailyRecords(history).filter(item=>dailyRecordKey(item)!==key && item.recordId!==rec.recordId)];
};

const normalizeData = raw => {
    const src=(raw&&typeof raw==='object')?raw:{};
    const clean={...DEFAULT};
    Object.keys(DEFAULT).forEach(key=>{ if(src[key]!==undefined) clean[key]=src[key]; });
    clean.history=collapseDailyRecords(src.history);
    clean.portfolioHistory=(Array.isArray(src.portfolioHistory)?src.portfolioHistory:[]).map(x=>({
        date:String(x?.date||'').slice(0,10),
        createdAt:x?.createdAt||'',
        strategyUsd:getNum(x?.strategyUsd),
        totalTwd:getNum(x?.totalTwd),
        rate:getNum(x?.rate),
        rateUpdatedDate:String(x?.rateUpdatedDate||""),
        rateProvider:String(x?.rateProvider||""),
        ftUsd:getNum(x?.ftUsd),
        subUsd:getNum(x?.subUsd),
        subSymbol:String(x?.subSymbol||''),
        subShares:getNum(x?.subShares),
        subCashUsd:getNum(x?.subCashUsd),
        subPriceUsd:getNum(x?.subPriceUsd),
        twStockTwd:getNum(x?.twStockTwd),
        otherTotalTwd:getNum(x?.otherTotalTwd),
        reason:String(x?.reason||'')
    })).filter(x=>x.date&&x.totalTwd>=0).sort((a,b)=>a.date.localeCompare(b.date)).slice(-1200);
    clean.externalCashflows=(Array.isArray(src.externalCashflows)?src.externalCashflows:[]).map(x=>({
        id:String(x?.id||makeRecordId()),
        account:['FT','SUB'].includes(String(x?.account||'').toUpperCase())?String(x.account).toUpperCase():'FT',
        type:String(x?.type||'deposit').toLowerCase()==='withdrawal'?'withdrawal':'deposit',
        amountUsd:Math.abs(getNum(x?.amountUsd)),
        date:String(x?.date||todayStr()).slice(0,10),
        note:String(x?.note||''),
        createdAt:x?.createdAt||new Date().toISOString()
    })).filter(x=>x.amountUsd>0&&x.date).sort((a,b)=>String(b.date+b.createdAt).localeCompare(String(a.date+a.createdAt))).slice(0,1200);
    clean.subSymbol=String(clean.subSymbol||'').toUpperCase().replace(/[^A-Z0-9.\-]/g,'').slice(0,12);
    clean.subShares=Math.max(0,getNum(clean.subShares));
    clean.subCashUsd=Math.max(0,getNum(clean.subCashUsd));
    clean.subAvgCostUsd=Math.max(0,getNum(clean.subAvgCostUsd));
    clean.subPriceUsd=Math.max(0,getNum(clean.subPriceUsd));
    clean.usdtwd=Math.max(0,getNum(clean.usdtwd)) || 32;
    clean.exchangeRateUpdatedDate=String(clean.exchangeRateUpdatedDate||"").slice(0,10);
    clean.exchangeRateUpdatedAt=String(clean.exchangeRateUpdatedAt||"");
    clean.exchangeRateSourceUpdatedAt=String(clean.exchangeRateSourceUpdatedAt||"");
    clean.exchangeRateNextUpdateAt=String(clean.exchangeRateNextUpdateAt||"");
    clean.exchangeRateLastAttemptDate=String(clean.exchangeRateLastAttemptDate||"").slice(0,10);
    clean.exchangeRateLastError=String(clean.exchangeRateLastError||"").slice(0,240);
    clean.exchangeRateProvider=String(clean.exchangeRateProvider||"").slice(0,80);
    clean.schemaVersion=2;
    clean.hotRank=Math.max(0,Math.min(3,parseInt(clean.hotRank)||0));
    clean.dcaCompleted=Math.max(0,Math.min(6,parseInt(clean.dcaCompleted)||0));
    clean.strategyPhase=['INTRO_QQQ','WAIT_REENTRY','ACTIVE'].includes(String(clean.strategyPhase).toUpperCase())?String(clean.strategyPhase).toUpperCase():'INTRO_QQQ';
    clean.marketState=['NEUTRAL','RISK_ON','RISK_OFF','DCA','INTRO'].includes(String(clean.marketState).toUpperCase())?String(clean.marketState).toUpperCase():'NEUTRAL';
    clean.hotAsset=['QQQ','SPY','SPYI','QQQI'].includes(String(clean.hotAsset||'QQQ').toUpperCase())?String(clean.hotAsset||'QQQ').toUpperCase():'QQQ';
    const uiPrefs=readUiPreferences();
    clean.privacyMode=uiPrefs.privacyMode!==undefined?uiPrefs.privacyMode===true:clean.privacyMode===true;
    const preferredCover=uiPrefs.coverTheme!==undefined?uiPrefs.coverTheme:clean.coverTheme;
    clean.coverTheme=['aurora','mountain','ocean','off'].includes(String(preferredCover||'aurora'))?String(preferredCover||'aurora'):'aurora';
    clean.marketCloseDate=clean.marketCloseDate||clean.marketDate||'';
    return clean;
};
const EXTERNAL_ACCOUNT_FIELDS=["ftUsd","subUsd","subSymbol","subShares","subCashUsd","subAvgCostUsd","subPriceUsd","subPriceUpdatedAt","twStockTwd","otherTotalTwd","externalCashflows"];
const EXTERNAL_ACCOUNT_KEYS=new Set(EXTERNAL_ACCOUNT_FIELDS);
const PERSONAL_KEYS = new Set(["sharesTqqq","sharesQqq","sharesSpy","sharesSpyi","sharesQqqi","cashUsd","otherUsd","usdtwd","currency","exchangeRateUpdatedDate","exchangeRateUpdatedAt","exchangeRateSourceUpdatedAt","exchangeRateNextUpdateAt","exchangeRateLastAttemptDate","exchangeRateLastError","exchangeRateProvider","ftUsd","subUsd","subSymbol","subShares","subCashUsd","subAvgCostUsd","subPriceUsd","subPriceUpdatedAt","twStockTwd","otherTotalTwd","externalCashflows","privacyMode","coverTheme","notes","marketState","hotRank","dcaActive","dcaCompleted","dcaPoolUsd","dcaLastDate","dcaNextDueDate","riskOffCycleId","riskOnCycleId","strategyPhase","parametersLocked","hotAsset"]);
const pickExternalAccountState = source => EXTERNAL_ACCOUNT_FIELDS.reduce((out,key)=>{out[key]=source?.[key];return out;},{});
const computeSubAccountValue = data => {
    const symbol=String(data?.subSymbol||'').toUpperCase();
    const shares=Math.max(0,getNum(data?.subShares));
    const cashUsd=Math.max(0,getNum(data?.subCashUsd));
    const priceUsd=Math.max(0,getNum(data?.subPriceUsd));
    const avgCostUsd=Math.max(0,getNum(data?.subAvgCostUsd));
    const holdingMode=Boolean(symbol)&&priceUsd>0;
    const stockValueUsd=holdingMode?shares*priceUsd:0;
    const valueUsd=holdingMode?stockValueUsd+cashUsd:Math.max(0,getNum(data?.subUsd));
    const costBasisUsd=holdingMode&&avgCostUsd>0?shares*avgCostUsd:0;
    const unrealizedUsd=costBasisUsd>0?stockValueUsd-costBasisUsd:0;
    return {symbol,shares,cashUsd,priceUsd,avgCostUsd,holdingMode,stockValueUsd,valueUsd,costBasisUsd,unrealizedUsd};
};
const computePortfolioSummary = (data, strategyUsdValue) => {
    const rate=getNum(data?.usdtwd)||1;
    const strategyUsd=getNum(strategyUsdValue);
    const ftUsd=getNum(data?.ftUsd), subAccount=computeSubAccountValue(data), subUsd=subAccount.valueUsd;
    const twStockTwd=getNum(data?.twStockTwd), otherTotalTwd=getNum(data?.otherTotalTwd);
    const totalTwd=(strategyUsd+ftUsd+subUsd)*rate+twStockTwd+otherTotalTwd;
    const cards=[
        {key:'ib',label:'IB 策略帳戶',amountText:`US$ ${money(strategyUsd,2)}`,note:'唯一參與 TQQQ 策略',ratio:totalTwd>0?strategyUsd*rate/totalTwd:0},
        {key:'ft',label:'Firstrade',amountText:`US$ ${money(ftUsd,2)}`,note:'只計入總資產',ratio:totalTwd>0?ftUsd*rate/totalTwd:0},
        {key:'sub',label:'複委託',amountText:`US$ ${money(subUsd,2)}`,note:subAccount.holdingMode?`${subAccount.symbol} ${money(subAccount.shares,4)} 股＋現金`:'手動淨值；只計入總資產',ratio:totalTwd>0?subUsd*rate/totalTwd:0},
        {key:'tw',label:'台股',amountText:`NT$ ${money(twStockTwd,0)}`,note:'只計入總資產',ratio:totalTwd>0?twStockTwd/totalTwd:0},
        {key:'other',label:'其他股票資產',amountText:`NT$ ${money(otherTotalTwd,0)}`,note:'其他券商、證券或投資現金',ratio:totalTwd>0?otherTotalTwd/totalTwd:0}
    ];
    const externalTwd=Math.max(0,totalTwd-strategyUsd*rate);
    return {rate,strategyUsd,ftUsd,subUsd,subAccount,twStockTwd,otherTotalTwd,externalTwd,totalTwd,totalDisplay:`NT$ ${money(totalTwd,0)}`,strategyDisplay:`US$ ${money(strategyUsd,2)}`,cards};
};
const withPortfolioSnapshot = (raw, reason='save') => {
    const normalized=normalizeData(raw);
    const strategyUsd=getNum(evaluateStrategy(normalized).totalUsd);
    const summary=computePortfolioSummary(normalized,strategyUsd);
    const date=todayStr();
    const snapshot={date,createdAt:new Date().toISOString(),strategyUsd,totalTwd:summary.totalTwd,rate:summary.rate,rateUpdatedDate:normalized.exchangeRateUpdatedDate||date,rateProvider:normalized.exchangeRateProvider||"手動",ftUsd:summary.ftUsd,subUsd:summary.subUsd,subSymbol:summary.subAccount.symbol,subShares:summary.subAccount.shares,subCashUsd:summary.subAccount.cashUsd,subPriceUsd:summary.subAccount.priceUsd,twStockTwd:summary.twStockTwd,otherTotalTwd:summary.otherTotalTwd,reason};
    const list=(Array.isArray(normalized.portfolioHistory)?normalized.portfolioHistory:[]).filter(x=>x.date!==date);
    list.push(snapshot);
    list.sort((a,b)=>String(a.date).localeCompare(String(b.date)));
    return normalizeData({...normalized,portfolioHistory:list.slice(-1200)});
};
const STRATEGY_TEXT = `TQQQ｜SPY 200SMA +4/-3＋QQQ 三階過熱鎖定策略（正式版 v1.1）

一、首次導入保護
首次啟用本策略時，不立即切換成 100% TQQQ，先以 100% QQQ 作為導入配置。正常情況下需先完整經歷一次 SPY Risk-Off，之後再重新站上 200SMA +4% 才正式啟用。若使用者確認市場已完成降溫，也可在 SPY 已符合 Risk-On 時，按「開啟新一輪 HOT」人工啟用；人工操作會留下歷史紀錄。

二、主風險訊號
使用 SPY 每日收盤價與 SPY 200SMA 判斷，所有交易於下一個交易日執行。
Risk-On：SPY 高於 200SMA +4%。
Risk-Off：SPY 低於 200SMA -3%。
中間區：SPY 位於 -3% 至 +4%，維持上一個正式狀態。

三、Risk-Off 與 DCA
Risk-Off 時，TQQQ 與 QQQ 全部轉現金，建立六期 QQQ DCA 資金池。第一期於 Risk-Off 執行日投入，之後每隔 21 個美股交易日投入一份（排除週末與美股主要休市日）；同一輪 Risk-Off 不重啟資金池。

四、DCA 重新轉強
DCA 尚未完成時，若 SPY 每日收盤重新高於 +4%，優先停止剩餘 DCA，將現有 QQQ 與剩餘現金依當下 QQQ 過熱階級重新配置，並正式啟動新一輪 Risk-On。

五、QQQ 三階過熱
僅在正式啟用且 SPY 為 Risk-On 時生效：
QQQ 高於 QQQ 200SMA +19%：60% TQQQ / 40% 過熱替代標的。
QQQ 高於 +24%：30% TQQQ / 70% 過熱替代標的。
QQQ 高於 +28%：0% TQQQ / 100% 過熱替代標的。
過熱替代標的可在參數頁選擇 QQQ、SPY、SPYI 或 QQQI；只影響 HOT 配置，首次導入與 Risk-Off DCA 仍固定使用 QQQ。

六、過熱鎖定
同一個 Risk-On 週期內，過熱階級只能 0→1→2→3，不能自動反向加回槓桿。QQQ 從 +28% 回落到 +24% 或更低時，仍維持已鎖定配置。SPY 觸發 Risk-Off 後會自動重置；若使用者確認上一輪過熱已結束，也可按「開啟新一輪 HOT」，把正式 HOT 重設為當下即時階級並留下人工操作紀錄。

七、訊號優先順序
1. SPY Risk-Off。
2. DCA 期間，SPY 是否重新 Risk-On。
3. DCA 本期是否到期。
4. Risk-On 期間的 QQQ 過熱階級。
5. SPY 中間區維持上一狀態。

八、參數紀律
正式預設為 Risk-On +4%、Risk-Off -3%、HOT1 +19%、HOT2 +24%、HOT3 +28%。參數平時保持鎖定；確定需要修改時，必須先解鎖並確認警告，修改完成後再重新鎖定。`;
const Card = ({ children, className = "" }) => React.createElement("div", { className: `glass-card rounded-[28px] ${className}` }, children);
const Pill = ({ children, tone = "slate" }) => {
    const cls = { slate: "bg-slate-100 text-slate-700 border-slate-200", blue: "bg-brand-50 text-brand-700 border-brand-100", green: "bg-emerald-50 text-emerald-700 border-emerald-100", red: "bg-red-50 text-red-700 border-red-100", amber: "bg-amber-50 text-amber-700 border-amber-100", purple: "bg-purple-700 text-white border-purple-700", dark: "bg-slate-900 text-white border-slate-800" }[tone];
    return React.createElement("span", { className: `inline-flex items-center px-2.5 py-1 rounded-full border text-[11px] font-black ${cls}` }, children);
};
const TextInput = ({ label, value, onChange, hint = "", placeholder = "", disabled = false, autoCapitalize = "characters" }) => (React.createElement("label", { className: "block bg-slate-50 border border-slate-200 rounded-2xl p-3 focus-within:ring-2 focus-within:ring-brand-100 focus-within:border-brand-400" },
    React.createElement("div", { className: "text-[10px] font-black text-slate-500 mb-1" }, label),
    React.createElement("input", { type:"text", autoComplete:"off", autoCapitalize, spellCheck:false, disabled, value:value??"", placeholder, onChange:e=>onChange(e.target.value), className:`w-full bg-transparent text-center font-black text-lg min-h-[44px] ${disabled?"text-slate-400 cursor-not-allowed":"text-slate-900"}`, style:{fontSize:"16px"} }),
    hint && React.createElement("div", { className:"text-[10px] text-slate-400 mt-1 leading-relaxed" }, hint)));
const NumInput = ({ label, value, onChange, suffix = "", hint = "", disabled = false }) => (React.createElement("label", { className: "block bg-slate-50 border border-slate-200 rounded-2xl p-3 focus-within:ring-2 focus-within:ring-brand-100 focus-within:border-brand-400" },
    React.createElement("div", { className: "text-[10px] font-black text-slate-500 mb-1" }, label),
    React.createElement("div", { className: "flex items-center gap-2" },
        React.createElement("input", { type: "text", inputMode: "decimal", autoComplete: "off", disabled, value: value !== null && value !== void 0 ? value : "", onChange: e => onChange(String(e.target.value).replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1')), className: `w-full bg-transparent text-center font-mono font-black text-lg min-h-[44px] ${disabled ? "text-slate-400 cursor-not-allowed" : "text-slate-900"}`, style: { fontSize: "16px" } }),
        suffix && React.createElement("span", { className: "text-xs font-black text-slate-400" }, suffix)),
    hint && React.createElement("div", { className: "text-[10px] text-slate-400 mt-1 leading-relaxed" }, hint)));
const StableDraftTextInput = ({ label, value, onDraft, hint = "", placeholder = "", autoCapitalize = "characters" }) => {
    const [draft,setDraft]=useState(String(value??""));
    const inputRef=useRef(null);
    useEffect(()=>{ if(document.activeElement!==inputRef.current) setDraft(String(value??"")); },[value]);
    return React.createElement("label", { className:"block bg-slate-50 border border-slate-200 rounded-2xl p-3 focus-within:ring-2 focus-within:ring-brand-100 focus-within:border-brand-400 stable-draft-field" },
        React.createElement("div", { className:"text-[10px] font-black text-slate-500 mb-1" }, label),
        React.createElement("input", { ref:inputRef, type:"text", autoComplete:"off", autoCapitalize, spellCheck:false, value:draft, placeholder, onChange:e=>{const next=e.target.value;setDraft(next);onDraft(next);}, className:"w-full bg-transparent text-center font-black text-lg min-h-[44px] text-slate-900", style:{fontSize:"16px"} }),
        hint && React.createElement("div", { className:"text-[10px] text-slate-400 mt-1 leading-relaxed" }, hint));
};
const StableDraftNumInput = ({ label, value, onDraft, suffix = "", hint = "" }) => {
    const [draft,setDraft]=useState(String(value??""));
    const inputRef=useRef(null);
    useEffect(()=>{ if(document.activeElement!==inputRef.current) setDraft(String(value??"")); },[value]);
    return React.createElement("label", { className:"block bg-slate-50 border border-slate-200 rounded-2xl p-3 focus-within:ring-2 focus-within:ring-brand-100 focus-within:border-brand-400 stable-draft-field" },
        React.createElement("div", { className:"text-[10px] font-black text-slate-500 mb-1" }, label),
        React.createElement("div", { className:"flex items-center gap-2" },
            React.createElement("input", { ref:inputRef, type:"text", inputMode:"decimal", autoComplete:"off", value:draft, onChange:e=>{const next=String(e.target.value).replace(/[^0-9.]/g,"").replace(/(\..*)\./g,"$1");setDraft(next);onDraft(next);}, className:"w-full bg-transparent text-center font-mono font-black text-lg min-h-[44px] text-slate-900", style:{fontSize:"16px"} }),
            suffix && React.createElement("span", { className:"text-xs font-black text-slate-400" }, suffix)),
        hint && React.createElement("div", { className:"text-[10px] text-slate-400 mt-1 leading-relaxed" }, hint));
};
const SectionTitle = ({ title, desc, right }) => React.createElement("div", { className: "flex items-end justify-between gap-3 mb-3" },
    React.createElement("div", null,
        React.createElement("h2", { className: "font-black text-slate-900" }, title),
        desc && React.createElement("p", { className: "text-xs text-slate-500 mt-1 leading-relaxed" }, desc)),
    right);
async function fetchFinnhubQuote(symbol) {
    const r = await fetch(`https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${FINNHUB_KEY}`, { cache: "no-store" });
    if (r.status === 429) throw new Error("Finnhub API 額度暫時用完（HTTP 429）");
    if (!r.ok) throw new Error(`Finnhub HTTP ${r.status}`);
    const d = await r.json();
    const close = getNum(d.c);
    if (close <= 0) throw new Error(symbol + " Finnhub 報價無資料");
    return { symbol, close, date: todayStr(), quoteSource: "Finnhub" };
}
async function fetchSymbol(symbol) {
    return await fetchFinnhubQuote(symbol);
}

function evaluateStrategy(data) {
        const spy=getNum(data.spy), spySma=getNum(data.spySma), qqq=getNum(data.qqq), qqqSma=getNum(data.qqqSma), tqqq=getNum(data.tqqq), spyi=getNum(data.spyi), qqqi=getNum(data.qqqi);
        const hotAsset=['QQQ','SPY','SPYI','QQQI'].includes(String(data.hotAsset||'QQQ').toUpperCase())?String(data.hotAsset||'QQQ').toUpperCase():'QQQ';
        const hotAssetPrice=hotAsset==='QQQ'?qqq:hotAsset==='SPY'?spy:hotAsset==='SPYI'?spyi:qqqi;
        const entry=getNum(data.entryBuffer)/100, exit=getNum(data.exitBuffer)/100;
        const hot1=getNum(data.hot1)/100, hot2=getNum(data.hot2)/100, hot3=getNum(data.hot3)/100;
        const valid=spy>0 && spySma>0 && qqq>0 && qqqSma>0 && tqqq>0 && hotAssetPrice>0;
        const spyDev=valid?spy/spySma-1:NaN, qqqDev=valid?qqq/qqqSma-1:NaN;
        const entryPx=spySma*(1+entry), exitPx=spySma*(1-exit);
        const qHot1=qqqSma*(1+hot1), qHot2=qqqSma*(1+hot2), qHot3=qqqSma*(1+hot3);
        const marketDate=data.marketDate||todayStr();

        const storedMarket=String(data.marketState||'NEUTRAL').toUpperCase();
        const storedHot=Math.max(0,Math.min(3,parseInt(data.hotRank)||0));
        const storedDcaCompleted=Math.max(0,Math.min(6,parseInt(data.dcaCompleted)||0));
        const storedDcaActive=data.dcaActive===true || (getNum(data.dcaPoolUsd)>0 && storedDcaCompleted<6 && storedMarket==='RISK_OFF');
        const strategyPhase=String(data.strategyPhase||'INTRO_QQQ').toUpperCase();
        const introMode=strategyPhase==='INTRO_QQQ';
        const waitingFirstReentry=strategyPhase==='WAIT_REENTRY';
        const strategyActive=strategyPhase==='ACTIVE';
        const paramsLocked=data.parametersLocked!==false;
        const riskOffNow=valid && spy<exitPx;
        const riskOnNow=valid && spy>entryPx;
        const thresholdRank=valid?(qqq>=qHot3?3:qqq>=qHot2?2:qqq>=qHot1?1:0):0;
        const paramErrors=[];
        if(getNum(data.entryBuffer)<=0) paramErrors.push('Risk-On 門檻必須大於 0%');
        if(getNum(data.exitBuffer)<=0) paramErrors.push('Risk-Off 門檻必須大於 0%');
        if(!(getNum(data.hot1)<getNum(data.hot2) && getNum(data.hot2)<getNum(data.hot3))) paramErrors.push('過熱門檻必須依序為第一階 < 第二階 < 第三階');
        if(getNum(data.hot1)<=0) paramErrors.push('過熱門檻必須大於 0%');
        const holdingErrors=[];
        [['TQQQ 股數',data.sharesTqqq],['QQQ 股數',data.sharesQqq],['SPY 股數',data.sharesSpy],['SPYI 股數',data.sharesSpyi],['QQQI 股數',data.sharesQqqi],['現金',data.cashUsd],['其他資產',data.otherUsd]].forEach(([name,v])=>{ if(getNum(v)<0) holdingErrors.push(`${name}不可為負數`); });
        const validationErrors=[...paramErrors,...holdingErrors];

        const rows=[
            {name:'TQQQ',shares:getNum(data.sharesTqqq),price:tqqq},
            {name:'QQQ',shares:getNum(data.sharesQqq),price:qqq},
            {name:'SPY',shares:getNum(data.sharesSpy),price:spy},
            {name:'SPYI',shares:getNum(data.sharesSpyi),price:spyi},
            {name:'QQQI',shares:getNum(data.sharesQqqi),price:qqqi},
            {name:'現金',shares:1,price:getNum(data.cashUsd)},
            {name:'其他資產',shares:1,price:getNum(data.otherUsd)}
        ].map(r=>({...r,value:getNum(r.shares)*getNum(r.price)}));
        const totalUsd=rows.reduce((sum,r)=>sum+r.value,0), rate=getNum(data.usdtwd)||1;
        rows.forEach(r=>r.weight=totalUsd>0?r.value/totalUsd:0);
        const totalDisplay=data.currency==='TWD'?`NT$${money(totalUsd*rate,0)}`:`$${money(totalUsd,2)}`;
        const highFromHistory=Math.max(0,...(Array.isArray(data.history)?data.history:[]).map(h=>getNum(h.totalUsd)));
        const assetHighUsd=Math.max(getNum(data.assetHighUsd),highFromHistory,totalUsd);
        const drawdown=assetHighUsd>0?totalUsd/assetHighUsd-1:0;
        const tqqqValue=rows.find(r=>r.name==='TQQQ')?.value||0, qqqValue=rows.find(r=>r.name==='QQQ')?.value||0, spyValue=rows.find(r=>r.name==='SPY')?.value||0, spyiValue=rows.find(r=>r.name==='SPYI')?.value||0, qqqiValue=rows.find(r=>r.name==='QQQI')?.value||0;
        const investableUsd=Math.max(0,totalUsd-getNum(data.otherUsd));

        const startingNewCycle=riskOffNow && !storedDcaActive && storedMarket!=='RISK_OFF' && !data.riskOffCycleId;
        const dcaActiveBefore=storedDcaActive;
        const dcaPool=startingNewCycle?investableUsd:(getNum(data.dcaPoolUsd)>0?getNum(data.dcaPoolUsd):investableUsd);
        const dcaCompletedBefore=startingNewCycle?0:storedDcaCompleted;
        const nextDue=data.dcaNextDueDate || (data.dcaLastDate?addTradingDays(data.dcaLastDate,21):marketDate);
        const dcaDue=(startingNewCycle || (storedDcaActive && dcaCompletedBefore<6 && (!nextDue || marketDate>=nextDue)));
        const plannedCompleted=Math.min(6,dcaCompletedBefore+(dcaDue?1:0));
        const dcaWillStop=storedDcaActive && riskOnNow;
        const dcaCyclePresent=(startingNewCycle || storedDcaActive) && !dcaWillStop;
        const dcaActiveEffective=dcaCyclePresent && dcaCompletedBefore<6;
        const dcaInstallment=dcaPool/6;
        const dcaBuyUsd=dcaDue?Math.max(0,dcaInstallment):0;
        const dcaBuyShares=qqq>0?dcaBuyUsd/qqq:0;
        const dcaTargetQqq=startingNewCycle?dcaInstallment:(dcaDue?qqqValue+dcaInstallment:qqqValue);
        const dcaTargetCash=startingNewCycle?Math.max(0,dcaPool-dcaInstallment):Math.max(0,getNum(data.cashUsd)-dcaBuyUsd);

        let marketState=storedMarket;
        if(riskOffNow) marketState='RISK_OFF';
        else if(riskOnNow && !introMode) marketState='RISK_ON';
        else if(introMode) marketState='INTRO';
        // SPY 中間區維持上次正式 marketState。

        // 同一 Risk-On 週期只允許單向降槓桿；首次導入期間固定 QQQ。
        let effectiveRank=introMode?0:storedHot;
        const enteringNewRiskOn = riskOnNow && storedMarket !== 'RISK_ON' && !introMode;
        if(riskOffNow){
            effectiveRank=0;
        } else if(enteringNewRiskOn){
            effectiveRank=thresholdRank;
        } else if(riskOnNow && strategyActive && thresholdRank>effectiveRank){
            effectiveRank=thresholdRank;
        }
        const immediateSignal=!valid?'資料不足':riskOffNow?'SPY 已觸發 Risk-Off':introMode?'首次導入保護：維持 100% QQQ':riskOnNow?`SPY Risk-On；QQQ 即時乖離 ${pct(qqqDev,1)}`:`SPY 位於中間區；QQQ 即時乖離 ${pct(qqqDev,1)}`;
        const thresholdRankLabel=thresholdRank===3?'HOT3':thresholdRank===2?'HOT2':thresholdRank===1?'HOT1':'HOT0';
        const storedHotLabel=storedHot===3?'HOT3':storedHot===2?'HOT2':storedHot===1?'HOT1':'HOT0';
        const effectiveHotLabel=effectiveRank===3?'HOT3':effectiveRank===2?'HOT2':effectiveRank===1?'HOT1':'HOT0';
        const hotPullbackLocked=strategyActive && storedMarket==='RISK_ON' && storedHot>thresholdRank && !riskOffNow;
        const hotCompareMessage=!valid?'資料不足，無法比較 HOT 階級。':introMode?'首次導入期間不啟用 HOT 鎖定。':riskOffNow?'Risk-Off 訊號優先；執行後本輪 HOT 才會清零。':hotPullbackLocked?`QQQ 已回落至 ${thresholdRankLabel} 區間，但本輪正式鎖定為 ${storedHotLabel}，維持原配置，不加回 TQQQ。`:effectiveRank>storedHot?`QQQ 已升至 ${effectiveHotLabel}，按「已執行」後才會正式鎖定。`:`即時門檻與本輪鎖定一致，維持 ${effectiveHotLabel}。`;
        const hotAlloc = pctValue => ({TQQQ:100-pctValue,QQQ:hotAsset==='QQQ'?pctValue:0,SPY:hotAsset==='SPY'?pctValue:0,SPYI:hotAsset==='SPYI'?pctValue:0,QQQI:hotAsset==='QQQI'?pctValue:0,label:`${100-pctValue}% TQQQ / ${pctValue}% ${hotAsset}`});
        const formalRankLabel=storedHot===3?`HOT3｜100% ${hotAsset}`:storedHot===2?`HOT2｜30% TQQQ / 70% ${hotAsset}`:storedHot===1?`HOT1｜60% TQQQ / 40% ${hotAsset}`:'HOT0｜100% TQQQ';
        const formalStateText=introMode?'首次導入｜100% QQQ':waitingFirstReentry?'等待首次 Risk-On／DCA':storedMarket==='RISK_OFF'?'Risk-Off／DCA':storedMarket==='RISK_ON'?formalRankLabel:'中間區延續既有狀態';

        let signal='NEUTRAL',tone='amber',title='SPY 中間區：維持原狀',instruction='SPY 位於 -3% 到 +4% 遲滯區，維持上次正式狀態。';
        let alloc={TQQQ:null,QQQ:null,SPY:null,SPYI:null,QQQI:null,label:'維持原配置'};
        if(!valid){signal='DATA';tone='slate';title='資料不足';instruction=`請更新 SPY、QQQ、TQQQ${hotAsset==='SPYI'?'、SPYI':hotAsset==='QQQI'?'、QQQI':''}，並手動輸入 SPY／QQQ 200SMA。`;}
        else if(riskOffNow){signal='OFF';tone='red';title='Risk-Off：全部轉現金並啟動 DCA';instruction=`SPY 已低於 200SMA -${data.exitBuffer}%。退出所有持有 ETF，依六期計畫投入 QQQ。`;alloc={TQQQ:0,QQQ:(plannedCompleted/6)*100,SPY:0,SPYI:0,QQQI:0,label:`DCA ${plannedCompleted}/6`};}
        else if(introMode){signal='INTRO';tone='blue';title='首次導入保護：先持有 100% QQQ';instruction='目前不啟用 TQQQ。必須先完整經歷一次 Risk-Off，之後 SPY 再重新站上 +4%，才正式啟動槓桿策略。';alloc={TQQQ:0,QQQ:100,SPY:0,SPYI:0,QQQI:0,label:'100% QQQ'};}
        else if(storedDcaActive && !riskOnNow){signal='DCA';tone='blue';title='DCA 進行中';instruction=dcaDue?`本期 DCA 已到期，累積目標為資金池 ${plannedCompleted}/6。`:`DCA 尚未到期，下一期預估 ${nextDue||'-'}。`;alloc={TQQQ:0,QQQ:(dcaCompletedBefore/6)*100,SPY:0,SPYI:0,QQQI:0,label:`DCA ${dcaCompletedBefore}/6`};}
        else if(riskOnNow){
            signal=effectiveRank===3?'HOT3':effectiveRank===2?'HOT2':effectiveRank===1?'HOT1':'ON';
            tone=effectiveRank>0?'purple':'green';
            if(effectiveRank===3){title=`過熱三階：100% ${hotAsset}`;alloc=hotAlloc(100);}
            else if(effectiveRank===2){title=`過熱二階：30% TQQQ / 70% ${hotAsset}`;alloc=hotAlloc(70);}
            else if(effectiveRank===1){title=`過熱一階：60% TQQQ / 40% ${hotAsset}`;alloc=hotAlloc(40);}
            else {title='Risk-On：100% TQQQ';alloc={TQQQ:100,QQQ:0,SPY:0,SPYI:0,QQQI:0,label:'100% TQQQ'};}
            instruction=dcaWillStop?`SPY 已重新站上 +${data.entryBuffer}%，停止剩餘 DCA，依 QQQ 乖離配置 ${alloc.label}。`:`SPY 處於 Risk-On；依 QQQ 過熱階級配置 ${alloc.label}。`;
        } else if(marketState==='RISK_ON'){
            signal=effectiveRank===3?'HOT3':effectiveRank===2?'HOT2':effectiveRank===1?'HOT1':'ON';
            tone=effectiveRank>0?'purple':'green';
            alloc=effectiveRank===3?hotAlloc(100):effectiveRank===2?hotAlloc(70):effectiveRank===1?hotAlloc(40):{TQQQ:100,QQQ:0,SPY:0,SPYI:0,QQQI:0,label:'100% TQQQ'};
            title='SPY 中間區：延續 Risk-On 配置'; instruction=`維持上次正式配置 ${alloc.label}。`;
        }

        // 首次導入與實際 DCA 期間固定使用 QQQ；DCA 重新 Risk-On 當天立即切回所選過熱替代標的。
        const positionAsset=(introMode || riskOffNow || (storedDcaActive && !riskOnNow)) ? 'QQQ' : hotAsset;
        // 交易計算必須包含所有目前仍有持倉的 ETF，才能在切換替代標的時列出舊標的賣出指令；
        // 畫面持股區仍只顯示 TQQQ＋目前選定標的。
        const heldSymbols=rows.filter(r=>['TQQQ','QQQ','SPY','SPYI','QQQI'].includes(r.name) && r.value>10).map(r=>r.name);
        const tradeSymbols=['TQQQ',positionAsset,...heldSymbols].filter((v,i,a)=>a.indexOf(v)===i);
        const calculationRows=tradeSymbols.map(sym=>{
            const row=rows.find(r=>r.name===sym)||{value:0,shares:0,price:0};
            let target=null;
            if(signal==='OFF'||signal==='DCA'){
                target=sym==='QQQ'?dcaTargetQqq:0;
            } else if(alloc[sym]!=null) {
                target=investableUsd*alloc[sym]/100;
            } else {
                // 非目前選定的舊替代標的目標為 0，必須清倉。
                target=0;
            }
            const targetShares=target==null||row.price<=0?null:target/row.price;
            const diff=target==null?0:target-row.value;
            return {sym,current:row.value,currentShares:row.shares,price:row.price,target,diff,targetShares,shareDiff:targetShares==null?0:targetShares-row.shares,targetPct:alloc[sym]};
        });
        // 首頁只顯示 TQQQ＋目前策略實際使用的單一標的；舊標的只保留在交易指令中供清倉。
        const visibleSymbols=['TQQQ',positionAsset].filter((v,i,a)=>a.indexOf(v)===i);
        const targetRows=visibleSymbols.map(sym=>calculationRows.find(r=>r.sym===sym)).filter(Boolean);
        const actionLines=[];
        if(!valid) actionLines.push('資料不足，請更新市場資料並輸入兩個 200SMA。');
        else if(signal==='OFF'||signal==='DCA'){
            if(tqqqValue>10) actionLines.push(`賣出全部 TQQQ 約 ${money(getNum(data.sharesTqqq),4)} 股。`);
            if(startingNewCycle && qqqValue>10) actionLines.push(`賣出原有 QQQ 約 ${money(getNum(data.sharesQqq),4)} 股，先建立本輪 DCA 現金池。`);
            if(spyValue>10) actionLines.push(`賣出全部 SPY 約 ${money(getNum(data.sharesSpy),4)} 股。`);
            if(spyiValue>10) actionLines.push(`賣出全部 SPYI 約 ${money(getNum(data.sharesSpyi),4)} 股。`);
            if(qqqiValue>10) actionLines.push(`賣出全部 QQQI 約 ${money(getNum(data.sharesQqqi),4)} 股。`);
            if(dcaDue && dcaBuyUsd>=10) actionLines.push(`買入 QQQ 約 ${money(dcaBuyShares,4)} 股，本期固定投入資金池的 1/6（$${money(dcaBuyUsd,0)}）。`);
            if(!dcaDue && tqqqValue<=10) actionLines.push('本期 DCA 尚未到期，不需交易。');
            actionLines.push(`執行後預估保留現金約 $${money(dcaTargetCash,0)}。`);
        } else if(alloc.TQQQ!=null){
            calculationRows.forEach(r=>{if(r.target!=null&&Math.abs(r.diff)>=10)actionLines.push(`${r.diff>0?'買入':'賣出'} ${r.sym} 約 ${money(Math.abs(r.shareDiff),4)} 股，金額約 $${money(Math.abs(r.diff),0)}。`);});
            if(!actionLines.length)actionLines.push('目前部位與目標接近，不需要交易。');
        } else actionLines.push('SPY 位於中間區，維持原配置，不建立新切換。');
        const todayAction = actionLines.length===1 && actionLines[0].includes('不需要交易')
            ? '不需交易'
            : actionLines.length===1 && actionLines[0].includes('維持原配置')
                ? '維持原狀'
                : actionLines.length===1 && actionLines[0].startsWith('資料不足')
                    ? '先補資料'
                    : '需要執行';

        const distanceItems=valid?[
            {key:'riskOff',label:'SPY Risk-Off',value:((exitPx/spy)-1)*100,price:exitPx,current:spy,hint:`SPY 低於 $${money(exitPx,2)} 觸發`},
            {key:'riskOn',label:'SPY Risk-On',value:((entryPx/spy)-1)*100,price:entryPx,current:spy,hint:`SPY 高於 $${money(entryPx,2)} 觸發`},
            {key:'hot1',label:`QQQ 過熱 +${data.hot1}%`,value:((qHot1/qqq)-1)*100,price:qHot1,current:qqq,hint:'60/40'},
            {key:'hot2',label:`QQQ 過熱 +${data.hot2}%`,value:((qHot2/qqq)-1)*100,price:qHot2,current:qqq,hint:'30/70'},
            {key:'hot3',label:`QQQ 過熱 +${data.hot3}%`,value:((qHot3/qqq)-1)*100,price:qHot3,current:qqq,hint:'0/100'}
        ].map(item=>{
            const abs=Math.abs(item.value);
            return {...item,
                statusTone:abs<=2?'red':abs<=5?'amber':'green',
                statusText:abs<=2?'即將觸發':abs<=5?'接近':'尚有距離',
                valueTone:item.value<=0?'text-red-600':'text-slate-900',
                displayText:signedPctText(item.value)
            };
        }):[];
        const scenarioMove=(getNum(data.scenarioSign)||-1)*Math.abs(getNum(data.scenarioAbsPct));
        const scenarioQqq=qqq>0?qqq*(1+scenarioMove/100):0, scenarioTqqq=tqqq>0?Math.max(0,tqqq*(1+scenarioMove*3/100)):0;
        const scenarioTotalUsd=getNum(data.sharesTqqq)*scenarioTqqq+getNum(data.sharesQqq)*scenarioQqq+getNum(data.sharesSpy)*spy+getNum(data.sharesSpyi)*spyi+getNum(data.sharesQqqi)*qqqi+getNum(data.cashUsd)+getNum(data.otherUsd);
        const scenarioPnlUsd=scenarioTotalUsd-totalUsd, scenarioPnlPct=totalUsd>0?scenarioPnlUsd/totalUsd:0;
        const scenarioFlags=[];
        if(valid){if(scenarioQqq>=qHot3)scenarioFlags.push(`QQQ 過熱三階 +${data.hot3}%`);else if(scenarioQqq>=qHot2)scenarioFlags.push(`QQQ 過熱二階 +${data.hot2}%`);else if(scenarioQqq>=qHot1)scenarioFlags.push(`QQQ 過熱一階 +${data.hot1}%`);if(!scenarioFlags.length)scenarioFlags.push('QQQ 未新增過熱觸發');}else scenarioFlags.push('資料不足');
        const scenario={movePct:scenarioMove,qqq:scenarioQqq,tqqq:scenarioTqqq,totalUsd:scenarioTotalUsd,totalTwd:scenarioTotalUsd*rate,pnlUsd:scenarioPnlUsd,pnlPct:scenarioPnlPct,flags:scenarioFlags};
        return {valid,canExecute:valid && validationErrors.length===0,validationErrors,signal,tone,title,instruction,alloc,spyDev,qqqDev,entryPx,exitPx,qHot1,qHot2,qHot3,rows,totalUsd,totalDisplay,targetRows,assetHighUsd,drawdown,actionLines,distanceItems,scenario,marketState,effectiveRank,storedHot,storedMarket,thresholdRank,thresholdRankLabel,storedHotLabel,effectiveHotLabel,hotPullbackLocked,hotCompareMessage,immediateSignal,formalStateText,todayAction,riskOffNow,riskOnNow,dcaActiveEffective,dcaCyclePresent,dcaActiveBefore,dcaWillStop,dcaDue,dcaPool,dcaInstallment,dcaCompleted:dcaCompletedBefore,plannedCompleted,dcaBuyUsd,dcaBuyShares,dcaTargetQqq,dcaTargetCash,nextDue,startingNewCycle,investableUsd,strategyPhase,introMode,waitingFirstReentry,strategyActive,paramsLocked,positionAsset};

}

function applyExecutionState(data, metrics, item, now=new Date()) {
    const nowText=now.toLocaleString('zh-TW'), execDate=formatDateLocal(now), stamp=now.getTime();
    const next={
        history:[item,...(Array.isArray(data.history)?data.history:[])],
        assetHighUsd:Math.max(getNum(data.assetHighUsd),metrics.totalUsd),
        lastExecutedAt:nowText,
        lastExecutionSummary:metrics.actionLines.join(' '),
        schemaVersion:2, marketCloseDate:data.marketCloseDate||data.marketDate||'', signalDate:data.marketDate||execDate, executionDate:execDate,
        marketState:metrics.marketState,
        hotRank:(metrics.riskOffNow || metrics.introMode) ? 0 : metrics.effectiveRank,
        strategyPhase: metrics.introMode && metrics.riskOffNow ? 'WAIT_REENTRY' : (metrics.waitingFirstReentry && metrics.riskOnNow ? 'ACTIVE' : (data.strategyPhase || 'INTRO_QQQ')),
        parametersLocked:data.parametersLocked!==false
    };
    const signalDate=data.marketDate||execDate;
    if(metrics.startingNewCycle){ next.riskOffCycleId=`RO-${signalDate}-${stamp}`; next.riskOnCycleId=''; }
    else if(metrics.riskOnNow && !metrics.introMode && String(data.marketState||'').toUpperCase()!=='RISK_ON') next.riskOnCycleId=`ON-${signalDate}-${stamp}`;
    if(metrics.dcaCyclePresent){
        next.dcaActive=metrics.plannedCompleted<6; next.dcaCompleted=metrics.plannedCompleted; next.dcaPoolUsd=metrics.dcaPool;
        next.riskOffCycleId=next.riskOffCycleId || data.riskOffCycleId || `RO-${signalDate}-${stamp}`;
        if(metrics.dcaDue){ next.dcaLastDate=signalDate; next.dcaNextDueDate=addTradingDays(next.dcaLastDate,21); }
        else { next.dcaLastDate=data.dcaLastDate||''; next.dcaNextDueDate=metrics.nextDue||data.dcaNextDueDate||''; }
        if(metrics.plannedCompleted>=6) next.dcaActive=false;
    } else if(metrics.dcaWillStop || metrics.riskOnNow){
        next.dcaActive=false; next.dcaCompleted=0; next.dcaPoolUsd=0; next.dcaLastDate=''; next.dcaNextDueDate=''; next.riskOffCycleId='';
    } else {
        next.dcaActive=data.dcaActive===true; next.dcaCompleted=getNum(data.dcaCompleted);
    }
    return normalizeData({...data,...next});
}

function buildPreviewData(data, scenario) {
    if(!scenario || scenario==='LIVE') return data;
    const base=normalizeData({...data});
    const spySma=getNum(base.spySma)>0?getNum(base.spySma):100;
    const qqqSma=getNum(base.qqqSma)>0?getNum(base.qqqSma):100;
    const entry=getNum(base.entryBuffer)/100, exit=getNum(base.exitBuffer)/100;
    const h1=getNum(base.hot1)/100, h2=getNum(base.hot2)/100, h3=getNum(base.hot3)/100;
    const next={...base,spySma,qqqSma,tqqq:getNum(base.tqqq)>0?base.tqqq:50,spyi:getNum(base.spyi)>0?base.spyi:50,qqqi:getNum(base.qqqi)>0?base.qqqi:50,marketDate:todayStr(),marketCloseDate:todayStr(),dcaActive:false,dcaCompleted:0,dcaPoolUsd:0,dcaLastDate:'',dcaNextDueDate:'',riskOffCycleId:'',riskOnCycleId:'PREVIEW'};
    if(scenario==='INTRO') return {...next,strategyPhase:'INTRO_QQQ',marketState:'NEUTRAL',hotRank:0,spy:spySma*(1+entry+0.01),qqq:qqqSma*(1+h1/2)};
    if(scenario==='HOT0') return {...next,strategyPhase:'ACTIVE',marketState:'RISK_ON',hotRank:0,spy:spySma*(1+entry+0.01),qqq:qqqSma*(1+Math.max(0,h1-0.02))};
    if(scenario==='HOT1') return {...next,strategyPhase:'ACTIVE',marketState:'RISK_ON',hotRank:0,spy:spySma*(1+entry+0.01),qqq:qqqSma*(1+h1+0.001)};
    if(scenario==='HOT2') return {...next,strategyPhase:'ACTIVE',marketState:'RISK_ON',hotRank:1,spy:spySma*(1+entry+0.01),qqq:qqqSma*(1+h2+0.001)};
    if(scenario==='HOT3') return {...next,strategyPhase:'ACTIVE',marketState:'RISK_ON',hotRank:2,spy:spySma*(1+entry+0.01),qqq:qqqSma*(1+h3+0.001)};
    if(scenario==='RISK_OFF') return {...next,strategyPhase:'ACTIVE',marketState:'RISK_ON',hotRank:2,spy:spySma*(1-exit-0.01),qqq:qqqSma*(1+h2)};
    if(scenario==='DCA') return {...next,strategyPhase:'ACTIVE',marketState:'RISK_OFF',hotRank:0,spy:spySma,qqq:qqqSma*0.95,dcaActive:true,dcaCompleted:2,dcaPoolUsd:getNum(base.dcaPoolUsd)>0?base.dcaPoolUsd:Math.max(6000,getNum(base.cashUsd)),dcaLastDate:todayStr(),dcaNextDueDate:addTradingDays(todayStr(),21),riskOffCycleId:'PREVIEW-DCA'};
    return base;
}
const App = () => {
    const [data, setData] = useState(() => {
        const stored = readStoredObject("");
        return normalizeData(stored);
    });
    const [user, setUser] = useState(null);
    const [page, setPage] = useState("home");
    const [homeSlide, setHomeSlide] = useState(0);
    const [chartRange, setChartRange] = useState("3M");
    const [chartMode, setChartMode] = useState("IB");
    const [historyCurrency, setHistoryCurrency] = useState(() => {
        const saved=String(readUiPreferences().historyCurrency||"USD").toUpperCase();
        return saved==="TWD"?"TWD":"USD";
    });
    const [settingsView, setSettingsView] = useState("menu");
    const [settingsMotion, setSettingsMotion] = useState("forward");
    const [showAccountSheet, setShowAccountSheet] = useState(false);
    const [showQuickUpdateSheet, setShowQuickUpdateSheet] = useState(false);
    const [quickSaving, setQuickSaving] = useState(false);
    const [calendarMonth, setCalendarMonth] = useState(todayStr().slice(0,7));
    const [selectedCalendarDay, setSelectedCalendarDay] = useState("");
    const [pullDistance, setPullDistance] = useState(0);
    const [pullRefreshing, setPullRefreshing] = useState(false);
    const [backupCards, setBackupCards] = useState(() => readBackupCards());
    const [toast, setToast] = useState("");
    const [updateSuccess, setUpdateSuccess] = useState(false);
    const [syncText, setSyncText] = useState("準備中");
    const [loadingPrice, setLoadingPrice] = useState(false);
    const [loadingFx, setLoadingFx] = useState(false);
    const [initialDataReady, setInitialDataReady] = useState(!auth);
    const [loadingSubPrice, setLoadingSubPrice] = useState(false);
    const [priceError, setPriceError] = useState("");
    const [pendingExecution, setPendingExecution] = useState(false);
    const [executionPreparing, setExecutionPreparing] = useState(false);
    const [previewScenario, setPreviewScenario] = useState("LIVE");
    const homeSliderRef = useRef(null);
    const homeScrollTimerRef = useRef(null);
    const pullStartRef = useRef({x:0,y:0,active:false});
    const [collapsed, setCollapsed] = useState({ marketData: true, holdings: true, scenario: true, marketStatus: true, strategyParams: true, hotCycle: true, previewScenarios: true, strategyText: true, assetAccounts: true, recordData: true, cashFlow: true });
    const [hasDraftChanges, setHasDraftChanges] = useState(false);
    const [logKindFilter, setLogKindFilter] = useState("all");
    const [logSignalFilter, setLogSignalFilter] = useState("all");
    const [logYearFilter, setLogYearFilter] = useState("all");
    const [logMonthFilter, setLogMonthFilter] = useState("all");
    const [logSearch, setLogSearch] = useState("");
    const [openLogGroups, setOpenLogGroups] = useState({});
    const [recordsHasMore, setRecordsHasMore] = useState(false);
    const [recordsCursor, setRecordsCursor] = useState(null);
    const [loadingMoreRecords, setLoadingMoreRecords] = useState(false);
    const [resettingCloud, setResettingCloud] = useState(false);
    const [showMonthSheet, setShowMonthSheet] = useState(false);
    const [cashflowType, setCashflowType] = useState("deposit");
    const [cashflowAmount, setCashflowAmount] = useState("");
    const [cashflowDate, setCashflowDate] = useState(todayStr());
    const [cashflowNote, setCashflowNote] = useState("");
    const [externalFlowAccount, setExternalFlowAccount] = useState("FT");
    const [externalFlowType, setExternalFlowType] = useState("deposit");
    const [externalFlowAmount, setExternalFlowAmount] = useState("");
    const [externalFlowDate, setExternalFlowDate] = useState(todayStr());
    const [externalFlowNote, setExternalFlowNote] = useState("");
    const importInputRef = useRef(null);
    const [committedData, setCommittedData] = useState(() => {
        const committed = readStoredObject("_committed");
        const stored = Object.keys(committed).length ? committed : readStoredObject("");
        return normalizeData(stored);
    });
    const ignoreCloud = useRef(false);
    const editingRef = useRef(false);
    const dataRef = useRef(data);
    const committedDataRef = useRef(committedData);
    const fxLoadingRef = useRef(false);
    const draftChangesRef = useRef(false);
    const externalDraftRef = useRef(pickExternalAccountState(data));
    const updateExternalDraft = useCallback((key,value) => { externalDraftRef.current={...externalDraftRef.current,[key]:value}; }, []);
    const collectExternalDraft = useCallback(() => normalizeData({...data,...externalDraftRef.current}), [data]);
    const toggleCollapse = useCallback(id => setCollapsed(prev => ({ ...prev, [id]: !prev[id] })), []);
    const showToast = useCallback(txt => { setToast(txt); setTimeout(() => setToast(""), 2600); }, []);
    const openSettingsView = useCallback(id => { setSettingsMotion("forward"); setSettingsView(id); }, []);
    const backToSettings = useCallback(() => { setSettingsMotion("back"); setSettingsView("menu"); }, []);
    const flashUpdateSuccess = useCallback(() => { setUpdateSuccess(true); setTimeout(() => setUpdateSuccess(false), 1400); }, []);
    const toggleHistoryCurrency = useCallback(() => {
        setHistoryCurrency(prev => {
            const next=prev==="USD"?"TWD":"USD";
            try{writeUiPreference("historyCurrency",next);}catch(e){}
            return next;
        });
    }, []);
    const openQuickUpdateSheet = useCallback(() => {
        externalDraftRef.current = pickExternalAccountState(data);
        setShowQuickUpdateSheet(true);
    }, [data]);
    const priceFailureText = useCallback(result => {
        if(result?.blocked) return result.message || "更新太頻繁，請稍後再試";
        const failed = Array.isArray(result?.failed) ? result.failed.filter(Boolean) : [];
        if(failed.length) return `更新失敗：${failed.join("；")}`;
        return `更新失敗：${result?.message || "無法取得必要股價"}`;
    }, []);
    const missingMarketDataText = source => {
        const s=source||data, missing=[];
        if(getNum(s.spy)<=0) missing.push("SPY 股價");
        if(getNum(s.spySma)<=0) missing.push("SPY 200SMA");
        if(getNum(s.qqq)<=0) missing.push("QQQ 股價");
        if(getNum(s.qqqSma)<=0) missing.push("QQQ 200SMA");
        if(getNum(s.tqqq)<=0) missing.push("TQQQ 股價");
        const hot=String(s.hotAsset||"QQQ").toUpperCase();
        if(hot==="SPYI"&&getNum(s.spyi)<=0) missing.push("SPYI 股價");
        if(hot==="QQQI"&&getNum(s.qqqi)<=0) missing.push("QQQI 股價");
        return missing.length ? `缺少或無效：${missing.join("、")}` : "市場資料不完整";
    };
    const setUiPreference = useCallback((key,value) => {
        try{writeUiPreference(key,value);}catch(e){}
        setData(prev => {
            const next=normalizeData({...prev,[key]:value});
            try{localStorage.setItem(LOCAL_KEY,JSON.stringify(next));}catch(e){}
            return next;
        });
    }, []);
    const patch = useCallback((key, value) => {
        // 受控輸入本身會保留焦點；不要在每次按鍵後強制 scrollTo / focus，
        // 否則三星瀏覽器可能跳頁、鍵盤閃退或游標位置重設。
        setData(prev => key === "usdtwd" ? ({ ...prev, [key]: value, exchangeRateProvider:"手動", exchangeRateUpdatedDate:todayStr(), exchangeRateUpdatedAt:new Date().toISOString(), exchangeRateLastError:"" }) : ({ ...prev, [key]: value }));
        if (PERSONAL_KEYS.has(key)) { draftChangesRef.current = true; setHasDraftChanges(true); }
    }, []);
    const merge = useCallback((obj, markDraft = false) => {
        setData(prev => ({ ...prev, ...obj }));
        if (markDraft || Object.keys(obj || {}).some(k => PERSONAL_KEYS.has(k))) { draftChangesRef.current = true; setHasDraftChanges(true); }
    }, []);
    const docRef = useCallback(() => (db && user && !user.isAnonymous) ? db.collection("users").doc(user.uid).collection(DOC_PATH[0]).doc(DOC_PATH[1]) : null, [user]);
    const recordsRef = useCallback(() => docRef() ? docRef().collection("records") : null, [docRef]);
    const updateExchangeRate = useCallback(async ({ force=false, silent=false } = {}) => {
        const current=dataRef.current||{};
        const date=todayStr();
        if(fxLoadingRef.current) return {success:false,blocked:true,message:"匯率正在更新"};
        if(!isExchangeRateDue(current,force,date)) return {success:true,skipped:true,rate:getNum(current.usdtwd),date:current.exchangeRateUpdatedDate||""};
        fxLoadingRef.current=true;
        setLoadingFx(true);
        const attemptAt=new Date().toISOString();
        try{
            const result=await fetchUsdTwdRate();
            const patch={
                usdtwd:result.rate,
                exchangeRateUpdatedDate:date,
                exchangeRateUpdatedAt:attemptAt,
                exchangeRateSourceUpdatedAt:result.sourceUpdatedAt,
                exchangeRateNextUpdateAt:result.nextUpdateAt,
                exchangeRateLastAttemptDate:date,
                exchangeRateLastError:"",
                exchangeRateProvider:result.provider
            };
            setData(prev=>{
                const next=normalizeData({...prev,...patch});
                dataRef.current=next;
                try{localStorage.setItem(LOCAL_KEY,JSON.stringify(next));}catch(e){}
                return next;
            });
            setCommittedData(prev=>{
                const next=normalizeData({...prev,...patch});
                committedDataRef.current=next;
                try{localStorage.setItem(LOCAL_KEY+"_committed",JSON.stringify(next));}catch(e){}
                return next;
            });
            if(docRef()){
                try{
                    await docRef().set(sanitize({...patch,updatedAtText:new Date().toLocaleString("zh-TW"),updatedAt:firebase.firestore.FieldValue.serverTimestamp()}),{merge:true});
                }catch(cloudError){ setSyncText("匯率已更新，本次雲端同步失敗："+(cloudError.message||"未知錯誤")); }
            }
            if(!silent){flashUpdateSuccess();showToast(`✓ USD/TWD 已更新為 ${money(result.rate,4)}`);}
            return {success:true,updated:true,rate:result.rate,date};
        }catch(error){
            const message=error?.message||"無法取得線上匯率";
            const patch={exchangeRateLastAttemptDate:date,exchangeRateLastError:message};
            setData(prev=>{
                const next=normalizeData({...prev,...patch});
                dataRef.current=next;
                try{localStorage.setItem(LOCAL_KEY,JSON.stringify(next));}catch(e){}
                return next;
            });
            if(docRef()){
                try{await docRef().set(sanitize(patch),{merge:true});}catch(e){}
            }
            if(!silent)showToast(`匯率更新失敗：${message}；沿用 ${money(getNum(current.usdtwd)||32,4)}`);
            return {success:false,updated:false,message,rate:getNum(current.usdtwd)||32};
        }finally{
            fxLoadingRef.current=false;
            setLoadingFx(false);
        }
    },[docRef,flashUpdateSuccess,showToast]);
    useEffect(() => {
        const onFocusIn = e => { if (e.target && ['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)) editingRef.current = true; };
        const onFocusOut = e => { if (e.target && ['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)) setTimeout(() => { editingRef.current = false; }, 250); };
        document.addEventListener('focusin', onFocusIn);
        document.addEventListener('focusout', onFocusOut);
        return () => { document.removeEventListener('focusin', onFocusIn); document.removeEventListener('focusout', onFocusOut); };
    }, []);
    useEffect(() => {
        if(settingsView==="accounts") externalDraftRef.current=pickExternalAccountState(data);
    }, [settingsView]);
    useEffect(() => {
        if (!auth) {
            setSyncText("Firebase 未載入，僅本機模式");
            return () => { };
        }
        const unsub = auth.onAuthStateChanged((usr) => {
            setUser(usr || null);
            setInitialDataReady(!usr || usr.isAnonymous);
            setSyncText(usr && !usr.isAnonymous ? "Google 雲端同步已連線" : "本機模式；Google 登入後才跨裝置同步");
        });
        return () => unsub();
    }, []);
    useEffect(() => {
        if (!user || user.isAnonymous || !docRef()) return;
        let cancelled = false;
        setSyncText("正在讀取 Google 雲端正式資料…");
        Promise.all([
            docRef().get(),
            recordsRef().orderBy("createdAt", "desc").limit(200).get().catch(()=>null)
        ]).then(([snap,recordSnap]) => {
            if (cancelled) return;
            const cloud = snap && snap.exists ? (snap.data() || {}) : {};
            const embedded=(Array.isArray(cloud.history)?cloud.history:[]).map(normalizeRecord);
            const localCached=(Array.isArray(readStoredObject('_committed').history)?readStoredObject('_committed').history:[]).map(normalizeRecord);
            const permanent=recordSnap ? recordSnap.docs.map(d=>normalizeRecord({...d.data(),recordId:d.id})) : [];
            setRecordsCursor(recordSnap && recordSnap.docs.length ? recordSnap.docs[recordSnap.docs.length-1] : null);
            setRecordsHasMore(Boolean(recordSnap && recordSnap.docs.length===200));
            const byId=new Map(); [...embedded,...localCached,...permanent].forEach(r=>{ if(r.deletedAt) byId.delete(r.recordId); else byId.set(r.recordId,r); });
            const normalized = normalizeData({...cloud,history:[...byId.values()].sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)))});
            setCommittedData(normalized);
            try { localStorage.setItem(LOCAL_KEY + "_committed", JSON.stringify(normalized)); } catch(e) {}
            const draftNow = draftChangesRef.current;
            if (!editingRef.current && !draftNow) setData(normalized);
            setSyncText(draftNow ? "已讀取永久紀錄；目前草稿未覆蓋" : `已讀取 Google 雲端正式資料與 ${normalized.history.length} 筆永久紀錄`);
            setInitialDataReady(true);
        }).catch(err => {
            if (!cancelled) { setSyncText("雲端讀取失敗：" + err.message); setInitialDataReady(true); }
        });
        return () => { cancelled = true; };
    }, [user]);
    useEffect(() => {
        dataRef.current=data;
        try { localStorage.setItem(LOCAL_KEY, JSON.stringify(data)); } catch(e) {}
    }, [data]);
    useEffect(() => { committedDataRef.current=committedData; }, [committedData]);
    useEffect(() => {
        if(!initialDataReady)return;
        const timer=setTimeout(()=>{ if(!editingRef.current) updateExchangeRate({force:false,silent:true}); },900);
        return ()=>clearTimeout(timer);
    },[initialDataReady,data.exchangeRateLastAttemptDate,updateExchangeRate]);
    const saveFormalData = async (payload, successText = "已同步正式資料", recordToAppend = null) => {
        const formal = withPortfolioSnapshot(payload, recordToAppend ? (recordToAppend.recordType||'execution') : 'manual_save');
        try {
            localStorage.setItem(LOCAL_KEY + "_committed", JSON.stringify(formal));
            setCommittedData(formal);
            setData(formal);
            draftChangesRef.current = false;
            setHasDraftChanges(false);
            if (!docRef()) { setSyncText("正式資料已存本機；Google 登入後才跨裝置同步"); return true; }
            ignoreCloud.current = true;
            const { history: _history, ...currentOnly } = formal;
            await docRef().set(sanitize({ ...currentOnly, recordSchemaVersion:RECORD_SCHEMA_VERSION, updatedAtText: new Date().toLocaleString("zh-TW"), updatedAt: firebase.firestore.FieldValue.serverTimestamp() }), { merge: true });
            if(recordsRef() && recordToAppend) {
                const rec=normalizeRecord(recordToAppend);
                await recordsRef().doc(rec.recordId).set(sanitize({...rec,createdAt:rec.createdAt,deletedAt:null}),{merge:true});
                const replaced=[...new Set(Array.isArray(rec.replacedRecordIds)?rec.replacedRecordIds:[])].filter(id=>id&&id!==rec.recordId);
                if(replaced.length){
                    const batch=db.batch();
                    replaced.forEach(id=>batch.set(recordsRef().doc(id),{deletedAt:new Date().toISOString(),updatedAt:firebase.firestore.FieldValue.serverTimestamp()},{merge:true}));
                    await batch.commit();
                }
            }
            setSyncText(successText + " " + new Date().toLocaleTimeString("zh-TW", { hour:"2-digit", minute:"2-digit" }));
            setTimeout(() => ignoreCloud.current = false, 1200);
            return true;
        } catch(e) {
            ignoreCloud.current = false;
            draftChangesRef.current = true;
            setHasDraftChanges(true);
            setSyncText("同步失敗：" + e.message);
            return false;
        }
    };
    const manualSave = async () => {
        const ok = await saveFormalData(data, "已手動同步目前正式狀態");
        showToast(ok ? "已同步目前正式狀態" : "同步失敗");
    };
    const saveExternalAccounts = async (source=data, successText="已儲存其他券商與今日快照") => {
        const prepared=normalizeData({...source,subUsd:computeSubAccountValue(source).valueUsd});
        const externalPatch=pickExternalAccountState(prepared);
        const base=normalizeData({...committedData,...externalPatch,portfolioHistory:prepared.portfolioHistory||committedData.portfolioHistory||[]});
        const formalBase=withPortfolioSnapshot(base,'external_account');
        const formalExternal=pickExternalAccountState(formalBase);
        const mergedCommitted=normalizeData({...committedData,...formalExternal,portfolioHistory:formalBase.portfolioHistory});
        const mergedDraft=normalizeData({...data,...formalExternal,portfolioHistory:formalBase.portfolioHistory});
        try{
            localStorage.setItem(LOCAL_KEY+"_committed",JSON.stringify(mergedCommitted));
            localStorage.setItem(LOCAL_KEY,JSON.stringify(mergedDraft));
            setCommittedData(mergedCommitted);
            setData(mergedDraft);
            externalDraftRef.current=pickExternalAccountState(mergedDraft);
            const remainingStrategyDraft=[...PERSONAL_KEYS].filter(key=>!EXTERNAL_ACCOUNT_KEYS.has(key)).some(key=>JSON.stringify(mergedDraft[key])!==JSON.stringify(mergedCommitted[key]));
            draftChangesRef.current=remainingStrategyDraft;
            setHasDraftChanges(remainingStrategyDraft);
            if(docRef()){
                ignoreCloud.current=true;
                await docRef().set(sanitize({...formalExternal,portfolioHistory:formalBase.portfolioHistory,updatedAtText:new Date().toLocaleString('zh-TW'),updatedAt:firebase.firestore.FieldValue.serverTimestamp()}),{merge:true});
                setTimeout(()=>ignoreCloud.current=false,1200);
            }
            setSyncText((docRef()?successText:"其他券商資料已存本機")+" "+new Date().toLocaleTimeString('zh-TW',{hour:'2-digit',minute:'2-digit'}));
            showToast("✓ "+successText);
            return true;
        }catch(e){
            ignoreCloud.current=false;
            showToast("其他券商儲存失敗："+(e.message||'未知錯誤'));
            return false;
        }
    };
    const fetchSubPrice = async () => {
        if(loadingSubPrice)return;
        const draft={...pickExternalAccountState(data),...externalDraftRef.current};
        const symbol=String(draft.subSymbol||'').toUpperCase().replace(/[^A-Z0-9.\-]/g,'').slice(0,12);
        if(!symbol){showToast('請先輸入複委託股票代號');return;}
        setLoadingSubPrice(true);
        try{
            const q=await fetchSymbol(symbol);
            const next=normalizeData({...data,...draft,subSymbol:symbol,subPriceUsd:round2(q.close),subPriceUpdatedAt:new Date().toISOString()});
            externalDraftRef.current=pickExternalAccountState(next);
            setData(next);
            draftChangesRef.current=true;setHasDraftChanges(true);
            flashUpdateSuccess();
            showToast(`✓ ${symbol} 股價已更新為 US$ ${money(q.close,2)}；儲存後才建立快照`);
        }catch(e){showToast(`${symbol} 更新失敗：${e.message||'無法取得報價'}`);}
        finally{setLoadingSubPrice(false);}
    };
    const addExternalCashflow = async () => {
        const amount=Math.abs(getNum(externalFlowAmount));
        if(amount<=0){showToast('請輸入大於 0 的入金／出金金額');return;}
        if(!externalFlowDate){showToast('請選擇資金流日期');return;}
        const flow={id:makeRecordId(),account:externalFlowAccount,type:externalFlowType,amountUsd:amount,date:externalFlowDate,note:externalFlowNote.trim(),createdAt:new Date().toISOString()};
        const next=normalizeData({...collectExternalDraft(),externalCashflows:[flow,...(Array.isArray(data.externalCashflows)?data.externalCashflows:[])]});
        const ok=await saveExternalAccounts(next,`${externalFlowAccount==='FT'?'Firstrade':'複委託'}${externalFlowType==='withdrawal'?'出金':'入金'}已記錄`);
        if(ok){setExternalFlowAmount('');setExternalFlowNote('');}
    };
    const saveQuickUpdate = async () => {
        if(quickSaving)return;
        setQuickSaving(true);
        try{
            const ok=await saveExternalAccounts(collectExternalDraft(),'FT、複委託與今日快照已儲存');
            if(ok){
                setShowQuickUpdateSheet(false);
                flashUpdateSuccess();
            }
        }finally{
            setQuickSaving(false);
        }
    };
    const openNewHotCycle = async () => {
        if(previewScenario!=="LIVE"){
            showToast('請先回到正式資料再開啟新一輪 HOT');
            return;
        }
        if(!metrics.valid){
            showToast('市場資料不足，無法開啟新一輪 HOT');
            return;
        }
        if(metrics.riskOffNow){
            showToast('目前已觸發 Risk-Off，不能開啟新一輪 HOT');
            return;
        }
        const phase=String(data.strategyPhase||'INTRO_QQQ').toUpperCase();
        const isIntro=phase==='INTRO_QQQ';
        const canResetActive=phase==='ACTIVE' && metrics.storedHot>metrics.thresholdRank;
        if(isIntro && !metrics.riskOnNow){
            showToast(`首次人工開啟 HOT 前，SPY 必須高於 200SMA +${data.entryBuffer}%`);
            return;
        }
        if(!isIntro && !canResetActive){
            showToast('目前不符合開啟新一輪 HOT 的條件');
            return;
        }
        const newHot=Math.max(0,Math.min(3,metrics.thresholdRank));
        const oldHot=Math.max(0,Math.min(3,metrics.storedHot));
        const warning=isIntro
            ? `⚠️ 確定人工開啟正式 HOT 策略嗎？\n\n目前 SPY 已符合 Risk-On，QQQ 即時門檻為 HOT${newHot}。確認後會跳過首次導入等待，正式階段改為 ACTIVE，並依 HOT${newHot} 產生配置建議。\n\n此操作不會自動修改股數，但可能立即出現買入 TQQQ 或替代標的的交易建議。`
            : `⚠️ 確定開啟新一輪 HOT 嗎？\n\n目前本輪正式鎖定 HOT${oldHot}，QQQ 即時門檻已回落至 HOT${newHot}。確認後會把正式 HOT 重設為 HOT${newHot}，建立新的 Risk-On 週期，之後可再次由 HOT${newHot} 向上升階。\n\n這可能產生加回 TQQQ 的交易建議，請確認你認為上一輪過熱已結束。`;
        if(!confirm(warning))return;
        const now=new Date();
        const before={TQQQ:getNum(data.sharesTqqq),QQQ:getNum(data.sharesQqq),SPY:getNum(data.sharesSpy),SPYI:getNum(data.sharesSpyi),QQQI:getNum(data.sharesQqqi),cashUsd:getNum(data.cashUsd),otherUsd:getNum(data.otherUsd)};
        const cycleId=`ON-MANUAL-${data.marketDate||todayStr()}-${Date.now()}`;
        const next=normalizeData({...data,strategyPhase:'ACTIVE',marketState:'RISK_ON',hotRank:newHot,riskOnCycleId:cycleId});
        const nextMetrics=evaluateStrategy(next);
        const recDraft=normalizeRecord({
            recordSchemaVersion:RECORD_SCHEMA_VERSION,recordId:makeRecordId(),strategyId:STRATEGY_ID,strategyVersion:STRATEGY_VERSION,
            recordType:'manual_hot_cycle',createdAt:now.toISOString(),
            dates:{marketClose:data.marketCloseDate||data.marketDate||'',signal:todayStr(),execution:todayStr()},
            prices:{SPY:getNum(data.spy),QQQ:getNum(data.qqq),TQQQ:getNum(data.tqqq),SPYI:getNum(data.spyi),QQQI:getNum(data.qqqi)},
            indicators:{SPY200:getNum(data.spySma),QQQ200:getNum(data.qqqSma)},
            state:{marketState:'RISK_ON',hotRank:newHot,hotAsset:data.hotAsset||'QQQ',strategyPhase:'ACTIVE',dcaActive:false,dcaCompleted:0,riskOffCycleId:data.riskOffCycleId||'',riskOnCycleId:cycleId},
            holdings:{before,after:before},
            valuation:{totalUsd:nextMetrics.totalUsd,totalDisplay:nextMetrics.totalDisplay},
            decision:{title:'人工開啟新一輪 HOT',allocation:nextMetrics.alloc.label,immediate:`HOT${oldHot} → HOT${newHot}`,formalState:`Risk-On｜HOT${newHot}`,todayAction:nextMetrics.todayAction},
            actions:[isIntro?'人工跳過首次導入並開啟正式 HOT':`人工重設本輪 HOT：HOT${oldHot} → HOT${newHot}`,'未自動修改持股；依新狀態產生交易建議'],notes:'使用者人工確認開啟新一輪 HOT',deletedAt:null
        });
        const rec=prepareSameDayRecord(recDraft,data.history);
        const formal=normalizeData({...next,history:replaceSameDayHistory(data.history,rec)});
        setData(formal);
        const ok=await saveFormalData(formal,'已開啟新一輪 HOT',rec);
        showToast(ok?`已開啟 HOT${newHot} 新週期`:'已存本機，但雲端同步失敗');
    };
    const loginGoogle = async () => {
        if (!auth || typeof firebase === "undefined") { showToast("Firebase 未載入，無法 Google 登入"); return; }
        try {
            const provider = new firebase.auth.GoogleAuthProvider();
            await auth.signInWithPopup(provider);
            showToast("Google 同步已啟用");
        } catch (e) { showToast(e.message || "登入失敗"); }
    };
    const logout = async () => {
        if (!auth) { showToast("Firebase 未載入"); return; }
        await auth.signOut();
        setSyncText("本機模式；Google 登入後才跨裝置同步");
        showToast("已切回本機模式");
    };
    const fetchAllCloudRecords = async () => {
        if(!recordsRef()) return (data.history||[]).map(normalizeRecord);
        let cursor=null,all=[];
        for(let pageNo=0;pageNo<100;pageNo++){
            let q=recordsRef().orderBy("createdAt","desc").limit(200); if(cursor)q=q.startAfter(cursor);
            const snap=await q.get(); all.push(...snap.docs.map(d=>normalizeRecord({...d.data(),recordId:d.id})));
            if(snap.docs.length<200)break; cursor=snap.docs[snap.docs.length-1];
        }
        const map=new Map((data.history||[]).map(r=>[r.recordId,normalizeRecord(r)])); all.forEach(r=>{if(r.deletedAt)map.delete(r.recordId);else map.set(r.recordId,r);});
        return [...map.values()].sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));
    };
    const loadAllRecords = async () => {
        if(!recordsRef()){showToast('本機紀錄已全部載入');return;}
        setLoadingMoreRecords(true);
        try{const all=await fetchAllCloudRecords();setData(prev=>({...prev,history:all}));setCommittedData(prev=>({...prev,history:all}));setRecordsHasMore(false);setRecordsCursor(null);showToast(`已載入全部 ${all.length} 筆紀錄`);}catch(e){showToast('載入全部失敗：'+e.message);}finally{setLoadingMoreRecords(false);}
    };
    const loadMoreRecords = async () => {
        if(!recordsRef() || !recordsCursor || loadingMoreRecords || !recordsHasMore) return;
        setLoadingMoreRecords(true);
        try{
            const snap=await recordsRef().orderBy("createdAt","desc").startAfter(recordsCursor).limit(200).get();
            const incoming=snap.docs.map(d=>normalizeRecord({...d.data(),recordId:d.id})).filter(r=>!r.deletedAt);
            setData(prev=>{const map=new Map((prev.history||[]).map(r=>[r.recordId,normalizeRecord(r)]));incoming.forEach(r=>map.set(r.recordId,r));return {...prev,history:[...map.values()].sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)))};});
            setCommittedData(prev=>{const map=new Map((prev.history||[]).map(r=>[r.recordId,normalizeRecord(r)]));incoming.forEach(r=>map.set(r.recordId,r));return {...prev,history:[...map.values()].sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)))};});
            setRecordsCursor(snap.docs.length?snap.docs[snap.docs.length-1]:recordsCursor);
            setRecordsHasMore(snap.docs.length===200);
            showToast(`再載入 ${incoming.length} 筆紀錄`);
        }catch(e){showToast('載入更多失敗：'+e.message);}finally{setLoadingMoreRecords(false);}
    };
    const importRecordsJson = async e => {
        const file=e.target.files&&e.target.files[0]; e.target.value=''; if(!file)return;
        try{
            const parsed=JSON.parse(await file.text());
            const source=Array.isArray(parsed)?parsed:(Array.isArray(parsed.records)?parsed.records:[]);
            if(!source.length) throw new Error('備份內沒有 records 陣列');
            const imported=source.map(normalizeRecord).filter(r=>r.recordId&&!r.deletedAt);
            const existing=new Map((data.history||[]).map(r=>[r.recordId,normalizeRecord(r)]));
            let added=0,updated=0;
            imported.forEach(r=>{const old=existing.get(r.recordId);if(!old){added++;existing.set(r.recordId,r);}else if(String(r.createdAt||'')>=String(old.createdAt||'')){updated++;existing.set(r.recordId,r);}});
            if(!confirm(`解析到 ${imported.length} 筆紀錄。\n新增 ${added} 筆、合併更新 ${updated} 筆。\n確定匯入嗎？`))return;
            const merged=[...existing.values()].sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));
            const restoreCurrent=parsed.currentState && confirm('備份也包含目前持股與策略狀態。是否一併還原？取消則只合併歷史紀錄。');
            const next=normalizeData({...data,...(restoreCurrent?parsed.currentState:{}),history:merged}); setData(next); setCommittedData(next);
            localStorage.setItem(LOCAL_KEY+'_committed',JSON.stringify(next));
            if(recordsRef()){
                for(let i=0;i<imported.length;i+=400){const batch=db.batch();imported.slice(i,i+400).forEach(r=>batch.set(recordsRef().doc(r.recordId),sanitize(r),{merge:true}));await batch.commit();}
            }
            if(restoreCurrent) await saveFormalData(next,'已還原目前狀態');
            showToast(`匯入完成：新增 ${added}、更新 ${updated}${restoreCurrent?'，並還原目前狀態':''}`);
        }catch(err){showToast('JSON 匯入失敗：'+err.message);}
    };
    const addCashflowRecord = async () => {
        const amount=Math.abs(getNum(cashflowAmount)); if(amount<=0){showToast('請輸入大於 0 的金額');return;}
        const sign=cashflowType==='withdrawal'?-1:1;
        const nextCash=getNum(data.cashUsd)+sign*amount;
        if(nextCash<0){showToast('出金金額不可大於目前現金');return;}
        const typeText=cashflowType==='withdrawal'?'出金':'入金';
        if(!confirm(`${typeText} $${money(amount,2)}，並把現金調整為 $${money(nextCash,2)}？`))return;
        const before={TQQQ:getNum(data.sharesTqqq),QQQ:getNum(data.sharesQqq),SPY:getNum(data.sharesSpy),SPYI:getNum(data.sharesSpyi),QQQI:getNum(data.sharesQqqi),cashUsd:getNum(data.cashUsd),otherUsd:getNum(data.otherUsd)};
        const after={...before,cashUsd:nextCash};
        const totalAfter=metrics.totalUsd+sign*amount;
        const rec=normalizeRecord({recordSchemaVersion:RECORD_SCHEMA_VERSION,recordId:makeRecordId(),strategyId:STRATEGY_ID,strategyVersion:STRATEGY_VERSION,recordType:'cashflow',createdAt:new Date().toISOString(),dates:{marketClose:data.marketCloseDate||data.marketDate||'',signal:cashflowDate,execution:cashflowDate},prices:{SPY:getNum(data.spy),QQQ:getNum(data.qqq),TQQQ:getNum(data.tqqq),SPYI:getNum(data.spyi),QQQI:getNum(data.qqqi)},indicators:{SPY200:getNum(data.spySma),QQQ200:getNum(data.qqqSma)},state:{marketState:data.marketState,hotRank:data.hotRank,hotAsset:data.hotAsset||'QQQ',strategyPhase:data.strategyPhase,dcaActive:data.dcaActive,dcaCompleted:data.dcaCompleted,riskOffCycleId:data.riskOffCycleId||'',riskOnCycleId:data.riskOnCycleId||''},holdings:{before,after},valuation:{totalUsd:totalAfter,totalDisplay:data.currency==='TWD'?`NT$${money(totalAfter*(getNum(data.usdtwd)||1),0)}`:`$${money(totalAfter,2)}`},decision:{title:typeText,allocation:'資金流',immediate:'',formalState:'',todayAction:`${typeText} $${money(amount,2)}`},cashflow:{type:cashflowType,amountUsd:amount,date:cashflowDate,note:cashflowNote},actions:[`${typeText} $${money(amount,2)}`],notes:cashflowNote,deletedAt:null});
        const next=normalizeData({...data,cashUsd:nextCash,history:[rec,...(data.history||[])]}); setData(next);
        const ok=await saveFormalData(next,`已記錄${typeText}`,rec); if(ok){setCashflowAmount('');setCashflowNote('');showToast(`${typeText}已記錄`);}
    };
    const previewData = useMemo(() => buildPreviewData(data, previewScenario), [data, previewScenario]);
    const metrics = useMemo(() => evaluateStrategy(previewData), [previewData]);
    const portfolio = useMemo(() => computePortfolioSummary(previewData, metrics.totalUsd), [previewData.ftUsd, previewData.subUsd, previewData.subSymbol, previewData.subShares, previewData.subCashUsd, previewData.subAvgCostUsd, previewData.subPriceUsd, previewData.twStockTwd, previewData.otherTotalTwd, previewData.usdtwd, metrics.totalUsd]);
    const scrollHomeTo = useCallback((idx) => {
        const el = homeSliderRef.current;
        if (!el) return;
        setHomeSlide(idx);
        const step = el.clientWidth + 16;
        el.scrollTo({ left: idx * step, behavior: 'smooth' });
    }, []);
    const handleHomeSliderScroll = useCallback((e) => {
        const el = e.currentTarget;
        if (!el) return;
        if (homeScrollTimerRef.current) clearTimeout(homeScrollTimerRef.current);
        homeScrollTimerRef.current = setTimeout(() => {
            const step = el.clientWidth + 16;
            const idx = Math.max(0, Math.min(2, Math.round(el.scrollLeft / Math.max(1, step))));
            setHomeSlide(prev => prev === idx ? prev : idx);
        }, 110);
    }, []);
    useEffect(() => () => {
        if (homeScrollTimerRef.current) clearTimeout(homeScrollTimerRef.current);
    }, []);
    const previewActive = previewScenario !== "LIVE";
    const fetchPriceUpdates = async ({ force = false } = {}) => {
        const last = Date.parse(data.lastFetchAttemptAt || "");
        if (!force && Number.isFinite(last) && Date.now() - last < 60000) {
            const wait = Math.ceil((60000 - (Date.now() - last)) / 1000);
            return { success:false, blocked:true, message:`請 ${wait} 秒後再更新，避免耗用 API 額度`, updates:null, failed:[] };
        }
        const attemptedAt = new Date().toISOString();
        const syms = ["SPY", "QQQ", "TQQQ", ...(["SPYI","QQQI"].includes(String(data.hotAsset||"QQQ").toUpperCase()) ? [String(data.hotAsset).toUpperCase()] : [])];
        try {
            const results = await Promise.allSettled(syms.map(fetchSymbol));
            const updates = { lastFetchAttemptAt: attemptedAt }, failed = [], priceSources = { ...(data.priceSources || {}) };
            results.forEach((res, idx) => {
                const sym = syms[idx];
                if (res.status !== "fulfilled") { failed.push(`${sym}：${res.reason?.message || '失敗'}`); return; }
                const x = res.value;
                priceSources[sym] = x.quoteSource || "Finnhub";
                if (sym === "SPY") { updates.spy = round2(x.close); updates.marketDate = x.date || todayStr(); updates.marketCloseDate = updates.marketDate; }
                if (sym === "QQQ") { updates.qqq = round2(x.close); if(!updates.marketDate) updates.marketDate = x.date || todayStr(); if(!updates.marketCloseDate) updates.marketCloseDate=updates.marketDate; }
                if (sym === "TQQQ") updates.tqqq = round2(x.close);
                if (sym === "SPYI") updates.spyi = round2(x.close);
                if (sym === "QQQI") updates.qqqi = round2(x.close);
            });
            const requiredFailed = failed.length > 0;
            if (Object.keys(updates).length > 1) {
                updates.priceUpdatedAt = new Date().toISOString();
                updates.priceSources = priceSources;
            }
            return { success:!requiredFailed && Object.keys(updates).length > 1, blocked:false, message:failed.join('；'), updates, failed };
        } catch (e) {
            return { success:false, blocked:false, message:e.message || "自動抓價失敗", updates:{lastFetchAttemptAt:attemptedAt}, failed:[e.message || "自動抓價失敗"] };
        }
    };
    const persistDailySnapshot = async nextData => {
        const snapData=normalizeData(nextData);
        setData(snapData);
        try{localStorage.setItem(LOCAL_KEY,JSON.stringify(snapData));}catch(e){}
        if(docRef()){
            try{
                await docRef().set(sanitize({
                    spy:snapData.spy,qqq:snapData.qqq,tqqq:snapData.tqqq,spyi:snapData.spyi,qqqi:snapData.qqqi,
                    marketDate:snapData.marketDate,marketCloseDate:snapData.marketCloseDate,priceUpdatedAt:snapData.priceUpdatedAt,
                    priceSources:snapData.priceSources,portfolioHistory:snapData.portfolioHistory,
                    updatedAtText:new Date().toLocaleString('zh-TW'),updatedAt:firebase.firestore.FieldValue.serverTimestamp()
                }),{merge:true});
            }catch(e){ setSyncText('每日快照雲端同步失敗：'+e.message); }
        }
        return snapData;
    };
    const fetchPrices = async () => {
        if (loadingPrice || executionPreparing) return false;
        setLoadingPrice(true);
        setPriceError("");
        showToast("正在抓取股價與檢查今日匯率");
        const fxPromise=updateExchangeRate({force:false,silent:true});
        const result = await fetchPriceUpdates({force:false});
        const fxResult = await fxPromise;
        if(result.success && result.updates){
            const latestData=dataRef.current||data;
            const latestCommitted=committedDataRef.current||committedData;
            const marketUpdated=normalizeData({...latestData,...result.updates});
            const snapshotBase=normalizeData({...latestCommitted,...result.updates,portfolioHistory:latestData.portfolioHistory||latestCommitted.portfolioHistory||[]});
            const snapFormal=withPortfolioSnapshot(snapshotBase,'price_update');
            const next=normalizeData({...marketUpdated,portfolioHistory:snapFormal.portfolioHistory});
            await persistDailySnapshot(next);
            flashUpdateSuccess();
            const fxSuffix=fxResult?.updated?`；匯率 ${money(fxResult.rate,4)}`:"";
            showToast((hasDraftChanges?"✓ 股價已更新；快照沿用正式持股":"✓ 股價已更新並保存今日快照")+fxSuffix);
            setLoadingPrice(false);
            return true;
        }
        if(result.updates) merge(result.updates);
        const msg=priceFailureText(result);
        setPriceError(msg);
        showToast(msg);
        setLoadingPrice(false);
        return false;
    };
    const handleHomeTouchStart = e => {
        if(window.scrollY>2 || pullRefreshing || loadingPrice)return;
        const t=e.touches?.[0];if(!t)return;
        pullStartRef.current={x:t.clientX,y:t.clientY,active:true};
    };
    const handleHomeTouchMove = e => {
        const ref=pullStartRef.current;if(!ref.active)return;
        const t=e.touches?.[0];if(!t)return;
        const dx=t.clientX-ref.x,dy=t.clientY-ref.y;
        if(dy<=0 || Math.abs(dx)>Math.abs(dy)){if(dy<0)pullStartRef.current.active=false;return;}
        const distance=Math.min(82,Math.max(0,dy*0.48));
        setPullDistance(distance);
    };
    const handleHomeTouchEnd = async () => {
        const shouldRefresh=pullDistance>=54;
        pullStartRef.current.active=false;
        setPullDistance(0);
        if(!shouldRefresh || pullRefreshing || loadingPrice)return;
        setPullRefreshing(true);
        try{await fetchPrices();}finally{setPullRefreshing(false);}
    };
    const buildLogItem = (kind = 'snapshot') => normalizeRecord({
        recordSchemaVersion:RECORD_SCHEMA_VERSION, recordId:makeRecordId(), strategyId:STRATEGY_ID, strategyVersion:STRATEGY_VERSION,
        recordType:kind, createdAt:new Date().toISOString(),
        dates:{marketClose:data.marketCloseDate||data.marketDate||'',signal:data.signalDate||data.marketDate||'',execution:todayStr()},
        prices:{SPY:getNum(data.spy),QQQ:getNum(data.qqq),TQQQ:getNum(data.tqqq),SPYI:getNum(data.spyi),QQQI:getNum(data.qqqi)},
        indicators:{SPY200:getNum(data.spySma),QQQ200:getNum(data.qqqSma)},
        state:{marketState:metrics.marketState,hotRank:metrics.effectiveRank,hotAsset:data.hotAsset||'QQQ',strategyPhase:data.strategyPhase,dcaActive:metrics.dcaActiveEffective,dcaCompleted:metrics.plannedCompleted,riskOffCycleId:data.riskOffCycleId||'',riskOnCycleId:data.riskOnCycleId||''},
        holdings:{before:{TQQQ:getNum(committedData.sharesTqqq),QQQ:getNum(committedData.sharesQqq),SPY:getNum(committedData.sharesSpy),SPYI:getNum(committedData.sharesSpyi),QQQI:getNum(committedData.sharesQqqi),cashUsd:getNum(committedData.cashUsd),otherUsd:getNum(committedData.otherUsd)},after:{TQQQ:getNum(data.sharesTqqq),QQQ:getNum(data.sharesQqq),SPY:getNum(data.sharesSpy),SPYI:getNum(data.sharesSpyi),QQQI:getNum(data.sharesQqqi),cashUsd:getNum(data.cashUsd),otherUsd:getNum(data.otherUsd)}},
        valuation:{totalUsd:metrics.totalUsd,totalDisplay:metrics.totalDisplay},
        decision:{title:metrics.title,allocation:metrics.alloc.label,immediate:metrics.immediateSignal,formalState:metrics.formalStateText,todayAction:metrics.todayAction},
        actions:metrics.actionLines, notes:data.notes, deletedAt:null
    });
    const deleteLog = async (target) => {
        const logs = Array.isArray(data.history) ? data.history : [];
        const item = typeof target === "number" ? logs[target] : target;
        if (!item) return;
        if(item.recordType==='cashflow'){alert('入金／出金紀錄不可直接刪除。請新增一筆相反方向、相同金額的資金流作為沖銷，才能保留完整稽核軌跡。');return;}
        if (!confirm(`確定隱藏這筆紀錄？\n${item.timeText || ""}\n${item.signal || ""}\n${item.totalDisplay || ("$"+money(item.totalUsd,0))}`)) return;
        const nextHistory=logs.filter(x => x.recordId !== item.recordId);
        setData(prev=>({...prev,history:nextHistory})); setCommittedData(prev=>({...prev,history:nextHistory}));
        try{localStorage.setItem(LOCAL_KEY+'_committed',JSON.stringify({...committedData,history:nextHistory}));}catch(e){}
        if(recordsRef()) { try {
            await recordsRef().doc(item.recordId).set({deletedAt:new Date().toISOString(),updatedAt:firebase.firestore.FieldValue.serverTimestamp()},{merge:true});
            if(docRef()) await docRef().set({history:firebase.firestore.FieldValue.delete()},{merge:true});
        } catch(e){ showToast('本機已隱藏，雲端標記失敗'); return; } }
        showToast('已隱藏紀錄（舊內嵌紀錄也已清理）');
    };
    const nextCheckText = () => "每日美股收盤後檢查，下一交易日執行";
    const confirmExecution = async () => {
        if (previewActive) { showToast("目前是測試預覽，請先切回正式資料"); return; }
        if (executionPreparing || loadingPrice) return;
        setExecutionPreparing(true);
        setPriceError("");
        showToast("執行前正在更新股價…");
        try {
            const result = await fetchPriceUpdates({force:true});
            if(!result.success){
                const detail=priceFailureText(result);
                if(result.updates) merge(result.updates);
                setPriceError(`執行已阻止：${detail}`);
                showToast(`執行已停止｜${detail}`);
                return;
            }
            const freshData=normalizeData({...data,...result.updates});
            const freshMetrics=evaluateStrategy(freshData);
            setData(freshData);
            if (!freshMetrics.canExecute) {
                showToast(freshMetrics.validationErrors?.[0] || `${missingMarketDataText(freshData)}，不能確認執行`);
                return;
            }
            flashUpdateSuccess();
            showToast("✓ 股價已更新，請確認最新交易清單");
            setTimeout(()=>setPendingExecution(true),0);
        } finally {
            setExecutionPreparing(false);
        }
    };
    const performExecution = async () => {
        if (!metrics.canExecute) { showToast(metrics.validationErrors?.[0] || `${missingMarketDataText(data)}，不能確認執行`); setPendingExecution(false); return; }
        const item=prepareSameDayRecord(buildLogItem('execution'),data.history);
        const applied=applyExecutionState(data,metrics,item,new Date());
        const formalData=normalizeData({...applied,history:replaceSameDayHistory(applied.history,item)});
        setData(formalData);
        const ok=await saveFormalData(formalData,"已執行並同步（同日紀錄已覆蓋）",item);
        setPendingExecution(false);
        showToast(ok?"已確認執行；同一天同類紀錄只保留最新一筆":"已寫入本機，但雲端同步失敗");
    };
    const resetAssetHigh = () => { if (confirm('把目前總資產設為新的高點？')) {
        patch('assetHighUsd', metrics.totalUsd);
        showToast('已重設資產高點');
    } };
    const Header = () => React.createElement("div", { className: "sticky top-0 z-30 glass-header" },
        React.createElement("div", { className: "max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-3" },
            React.createElement("div", { className:"mobile-header-title min-w-0" },
                React.createElement("div", { className: "text-[10px] font-black text-brand-600 tracking-[.12em]" }, `SPY 200SMA +4／-3｜${APP_VERSION}`),
                React.createElement("h1", { className: "text-[20px] font-black text-slate-950 leading-tight truncate" }, "TQQQ 策略儀表板")),
            React.createElement("div", { className: "flex items-center gap-2 shrink-0" },
                React.createElement("div", { className:"desktop-status-pill flex gap-2" },
                    React.createElement(Pill, { tone: hasDraftChanges ? "amber" : "green" }, hasDraftChanges ? "草稿未存" : "已儲存"),
                    React.createElement(Pill, { tone: user && !user.isAnonymous ? "green" : "amber" }, user && !user.isAnonymous ? "Google" : "本機")),
                React.createElement("button", { onClick:toggleHistoryCurrency, className:"history-currency-toggle min-w-[52px] h-11 px-2 rounded-2xl bg-white text-slate-800 border border-slate-200 text-[12px] font-black shadow-lg active:scale-95", title:`歷史損益圖目前顯示 ${historyCurrency==="TWD"?"新台幣":"美元"}；點擊切換` }, historyCurrency==="TWD"?"NT$":"US$"),
                React.createElement("button", { onClick:()=>setUiPreference('privacyMode',!data.privacyMode), className:`w-11 h-11 rounded-2xl text-lg font-black shadow-lg active:scale-95 ${data.privacyMode?'bg-brand-600 text-white':'bg-white text-slate-700 border border-slate-200'}`, title:data.privacyMode?"顯示金額":"隱藏金額" }, data.privacyMode ? "◉" : "◎"),
                React.createElement("button", { onClick: fetchPrices, disabled: loadingPrice, className: `w-11 h-11 rounded-2xl text-white text-lg font-black shadow-lg active:scale-95 disabled:opacity-50 ${updateSuccess?"bg-emerald-600 update-success":"bg-slate-950"}`, title:updateSuccess?"更新成功":loadingFx?"正在更新匯率":"更新股價並檢查今日匯率" }, loadingPrice ? "…" : updateSuccess ? "✓" : "↻"))));
    const freshnessInfo = useMemo(() => {
        const expected=latestCompletedUsTradingDay();
        const calc = (iso, fallbackDate) => {
            const dateText=fallbackDate || (iso ? formatDateLocal(new Date(iso)) : '');
            if(!dateText) return { text:'尚未更新', tone:'red', tradingAge:999, expected };
            const age=tradingDayDistance(dateText,expected);
            return { text:age===0?'最新交易日':age<=1?'落後 1 個交易日':age<=3?`落後 ${age} 個交易日`:'已過期', tone:age===0?'green':age<=1?'amber':'red', tradingAge:age, expected };
        };
        return { price:calc(data.priceUpdatedAt, data.marketCloseDate||data.marketDate), sma:calc(data.smaUpdatedAt, data.marketCloseDate||data.marketDate), expected };
    }, [data.priceUpdatedAt, data.smaUpdatedAt, data.marketCloseDate, data.marketDate]);
    const fxStatus = useMemo(() => {
        const online=data.exchangeRateProvider===EXCHANGE_RATE_PROVIDER;
        const attemptedToday=data.exchangeRateLastAttemptDate===todayStr();
        const successDate=data.exchangeRateUpdatedDate||"";
        const tone=data.exchangeRateLastError&&attemptedToday?"amber":online?"green":"slate";
        const text=data.exchangeRateLastError&&attemptedToday?`今日更新失敗，沿用 ${successDate||"既有"} 匯率`:online?`線上匯率 ${successDate||"已更新"}`:"目前使用手動匯率";
        return {online,attemptedToday,tone,text};
    },[data.exchangeRateProvider,data.exchangeRateLastAttemptDate,data.exchangeRateUpdatedDate,data.exchangeRateLastError,data.usdtwd]);
    const FreshnessCard = () => React.createElement(Card, { className:"p-4 mt-4" },
        React.createElement(SectionTitle, { title:"市場資料狀態", desc:`依美股交易日判斷；最近應有資料日期：${freshnessInfo.expected}。匯率每天最多自動連線一次。` }),
        React.createElement("div", { className:"grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2" },
            React.createElement("div", { className:"bg-slate-50 border border-slate-100 rounded-2xl p-3" }, React.createElement("div", { className:"text-[10px] font-black text-slate-500" }, "股價更新"), React.createElement("div", { className:"font-mono text-sm font-black text-slate-900 mt-1" }, data.priceUpdatedAt ? new Date(data.priceUpdatedAt).toLocaleString('zh-TW') : (data.marketCloseDate || data.marketDate || '-')), React.createElement(Pill, { tone:freshnessInfo.price.tone }, freshnessInfo.price.text)),
            React.createElement("div", { className:"bg-slate-50 border border-slate-100 rounded-2xl p-3" }, React.createElement("div", { className:"text-[10px] font-black text-slate-500" }, "200SMA 更新"), React.createElement("div", { className:"font-mono text-sm font-black text-slate-900 mt-1" }, data.smaUpdatedAt ? new Date(data.smaUpdatedAt).toLocaleString('zh-TW') : (data.marketDate || '-')), React.createElement(Pill, { tone:freshnessInfo.sma.tone }, freshnessInfo.sma.text)),
            React.createElement("div", { className:"bg-blue-50 border border-blue-100 rounded-2xl p-3" },
                React.createElement("div", { className:"flex items-center justify-between gap-2" },
                    React.createElement("div", { className:"text-[10px] font-black text-blue-700" }, "USD/TWD 匯率"),
                    React.createElement("button", { onClick:()=>updateExchangeRate({force:true,silent:false}), disabled:loadingFx, className:"px-2.5 py-1.5 rounded-xl bg-blue-700 text-white text-[10px] font-black disabled:opacity-50 active:scale-95" }, loadingFx?"更新中":"立即更新")),
                React.createElement("div", { className:"font-mono text-xl font-black text-slate-950 mt-1 privacy-value" }, money(data.usdtwd,4)),
                React.createElement(Pill, { tone:fxStatus.tone }, fxStatus.text),
                data.exchangeRateLastError&&React.createElement("div", { className:"text-[10px] font-bold text-amber-700 mt-2 leading-relaxed" }, `錯誤：${data.exchangeRateLastError}`),
                React.createElement("div", { className:"text-[10px] font-bold text-slate-500 mt-2 leading-relaxed" }, data.exchangeRateUpdatedAt?`本機更新：${new Date(data.exchangeRateUpdatedAt).toLocaleString('zh-TW')}`:"尚未線上更新"),
                React.createElement("a", { href:"https://www.exchangerate-api.com", target:"_blank", rel:"noreferrer", className:"inline-block text-[10px] font-black text-blue-700 underline mt-2" }, "Rates By Exchange Rate API")),
            React.createElement("div", { className:"bg-slate-50 border border-slate-100 rounded-2xl p-3" }, React.createElement("div", { className:"text-[10px] font-black text-slate-500" }, "正式資料"), React.createElement("div", { className:"font-black text-sm text-slate-900 mt-1" }, hasDraftChanges ? '草稿尚未儲存' : '已正式儲存'), React.createElement(Pill, { tone:hasDraftChanges?'amber':'green' }, hasDraftChanges?'待執行':'正常')),
            React.createElement("div", { className:"bg-slate-50 border border-slate-100 rounded-2xl p-3 sm:col-span-2 lg:col-span-4" }, React.createElement("div", { className:"text-[10px] font-black text-slate-500 mb-1" }, "資料來源"), React.createElement("div", { className:"text-xs font-bold text-slate-700 leading-relaxed" }, `SPY：${data.priceSources?.SPY || '-'}｜QQQ：${data.priceSources?.QQQ || '-'}｜TQQQ：${data.priceSources?.TQQQ || '-'}｜${data.hotAsset||'QQQ'}：${data.priceSources?.[data.hotAsset||'QQQ'] || '-'}`), React.createElement("div", { className:"text-xs font-black text-brand-700 mt-2" }, "SPY／QQQ 200SMA 採手動輸入；匯率更新只影響資產顯示，不參與 IB 策略訊號。"))));
    const renderDraftNumInput = (field, label, suffix="", hint="") => {
        const before = getNum(committedData[field]); const now = getNum(data[field]); const diff = now - before;
        const diffHint = Math.abs(diff) > 1e-9 ? `正式 ${money(before,4)} → 草稿 ${money(now,4)}（${diff>=0?'+':''}${money(diff,4)}）` : hint;
        return React.createElement(NumInput, { key:field, label, value:data[field], onChange:v=>patch(field,v), suffix, hint:diffHint });
    };
    const simpleActionList = () => React.createElement("div", { className:"space-y-2 mt-4" },
        (metrics.actionLines && metrics.actionLines.length ? metrics.actionLines : ['目前沒有需要立即執行的動作。']).slice(0,4).map((line, idx) =>
            React.createElement("div", { key: idx, className:"rounded-[22px] bg-white/75 border border-white/80 px-4 py-3 text-sm font-black text-slate-800 shadow-sm" }, `${idx+1}. ${line}`)));
    const SignalSkin = () => {
        const m = { red: "bg-red-50 text-slate-950 border-red-200", green: "bg-emerald-50 text-slate-950 border-emerald-200", purple: "bg-purple-50 text-slate-950 border-purple-200", amber: "bg-amber-50 text-slate-950 border-amber-200", blue: "bg-brand-50 text-slate-950 border-brand-200", slate: "bg-white text-slate-950 border-slate-200" };
        return m[metrics.tone] || m.slate;
    };
    const Collapsible = ({ id, title, desc, children }) => {
        const iconMap={marketData:'◉',holdings:'◔',assetAccounts:'▦',scenario:'↗',marketStatus:'◷',strategyParams:'◎',hotCycle:'↻',previewScenarios:'◇',strategyText:'≡',recordData:'⇩',cashFlow:'＄'};
        const open=!collapsed[id];
        return React.createElement("div", { className:"mt-3" },
            React.createElement("button", { type:"button", onClick:()=>toggleCollapse(id), className:`settings-row w-full text-left active:scale-[.985] ${open?'settings-row-open':''}` },
                React.createElement("span", { className:"settings-icon text-slate-600" }, iconMap[id]||'•'),
                React.createElement("span", { className:"min-w-0 flex-1" },
                    React.createElement("span", { className:"block text-[17px] font-black text-slate-900" }, title),
                    desc && React.createElement("span", { className:"block text-xs font-bold text-slate-500 mt-1 leading-relaxed" }, desc)),
                React.createElement("span", { className:`text-2xl font-light text-slate-400 transition-transform ${open?'rotate-90':''}` }, '›')),
            open && React.createElement("div", { className:"settings-panel" }, children));
    };
    const StatusWarnings = () => {
        const warnings = [];
        if (!metrics.valid) warnings.push(`${missingMarketDataText(data)}。請更新股價或到設定補齊欄位。`);
        (metrics.validationErrors||[]).forEach(x=>warnings.push(x));
        if (priceError) warnings.push(priceError);
        if (String(syncText || "").includes("失敗")) warnings.push(syncText);
        if (!warnings.length) return null;
        return React.createElement(Card, { className: "p-4 mt-4 border-red-200 bg-red-50" },
            React.createElement("div", { className: "text-sm font-black text-red-700 mb-2" }, "⚠️ 需要確認"),
            warnings.map((w, i) => React.createElement("div", { key: i, className: "text-xs font-bold text-red-700 leading-relaxed" }, "・", w)));
    };
    const ScenarioCard = () => {
        var _a;
        return React.createElement(Card, { className: "p-4 mt-4" },
            React.createElement(SectionTitle, { title: "QQQ \u60C5\u5883\u6A21\u64EC", desc: "\u4E09\u661F\u624B\u6A5F\u53CB\u5584\uFF1A\u4E0D\u7528\u8F38\u5165\u8CA0\u865F\uFF0C\u7528\uFF0B\uFF0F\uFF0D\u5207\u63DB\u65B9\u5411\u3002TQQQ \u4EE5\u7D04 3 \u500D QQQ \u8B8A\u52D5\u7C97\u4F30\u3002" }),
            React.createElement("div", { className: "grid grid-cols-1 lg:grid-cols-2 gap-4" },
                React.createElement("div", { className: "bg-slate-50 border border-slate-100 rounded-2xl p-3" },
                    React.createElement("div", { className: "text-[10px] font-black text-slate-500 mb-2" }, "\u8A2D\u5B9A QQQ \u8B8A\u52D5"),
                    React.createElement("div", { className: "flex items-center gap-2" },
                        React.createElement("button", { onClick: () => patch('scenarioSign', -1), className: `px-4 py-3 rounded-2xl font-black active:scale-95 ${getNum(data.scenarioSign) < 0 ? 'bg-red-600 text-white' : 'bg-white border border-slate-200 text-slate-700'}` }, "\uFF0D"),
                        React.createElement("button", { onClick: () => patch('scenarioSign', 1), className: `px-4 py-3 rounded-2xl font-black active:scale-95 ${getNum(data.scenarioSign) > 0 ? 'bg-emerald-600 text-white' : 'bg-white border border-slate-200 text-slate-700'}` }, "\uFF0B"),
                        React.createElement("input", { type: "number", inputMode: "decimal", value: (_a = data.scenarioAbsPct) !== null && _a !== void 0 ? _a : 10, onChange: e => patch('scenarioAbsPct', e.target.value), className: "w-full bg-white border border-slate-200 rounded-2xl text-center font-mono font-black text-lg min-h-[48px]", style: { fontSize: '16px' } }),
                        React.createElement("span", { className: "font-black text-slate-400" }, "%")),
                    React.createElement("div", { className: "grid grid-cols-4 gap-2 mt-3" }, [-5, -10, -15, -20, -30, 5, 10, 20, 30].map(v => React.createElement("button", { key: v, onClick: () => merge({ scenarioSign: v < 0 ? -1 : 1, scenarioAbsPct: Math.abs(v) }), className: `py-2 rounded-xl text-xs font-black active:scale-95 ${v < 0 ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}` },
                        v > 0 ? '+' : '',
                        v,
                        "%")))),
                React.createElement("div", { className: "bg-slate-950 rounded-2xl p-4 text-white" },
                    React.createElement("div", { className: "text-[10px] font-black text-slate-300" },
                        "\u6A21\u64EC\u7D50\u679C\uFF1AQQQ ",
                        signedPctText(metrics.scenario.movePct)),
                    React.createElement("div", { className: "grid grid-cols-2 gap-2 mt-3" },
                        React.createElement("div", { className: "bg-white/10 rounded-2xl p-3" },
                            React.createElement("div", { className: "text-[10px] font-black text-slate-300" }, "\u9810\u4F30\u7E3D\u8CC7\u7522"),
                            React.createElement("div", { className: "font-mono text-lg font-black" },
                                "$",
                                money(metrics.scenario.totalUsd, 0)),
                            React.createElement("div", { className: "text-[10px] text-slate-400" },
                                "NT$",
                                money(metrics.scenario.totalTwd, 0))),
                        React.createElement("div", { className: "bg-white/10 rounded-2xl p-3" },
                            React.createElement("div", { className: "text-[10px] font-black text-slate-300" }, "\u9810\u4F30\u640D\u76CA"),
                            React.createElement("div", { className: `font-mono text-lg font-black ${metrics.scenario.pnlUsd < 0 ? 'text-red-300' : 'text-emerald-300'}` },
                                metrics.scenario.pnlUsd >= 0 ? '+' : '-',
                                "$",
                                money(Math.abs(metrics.scenario.pnlUsd), 0)),
                            React.createElement("div", { className: "text-[10px] text-slate-400" }, signedPctText(metrics.scenario.pnlPct * 100)))),
                    React.createElement("div", { className: "mt-3 space-y-1" }, metrics.scenario.flags.map((f, i) => React.createElement("div", { key: i, className: "text-xs font-bold text-slate-200" },
                        "\u2611 ",
                        f))))));
    };
    const Home = () => {
        const slideSectionClass = "home-slide snap-center snap-always shrink-0 w-full";
        const closestSignal = (metrics.distanceItems || []).slice().sort((a,b)=>Math.abs(a.value)-Math.abs(b.value))[0] || null;
        const closestSignalText = closestSignal ? `${closestSignal.label}｜$${money(closestSignal.price,2)}｜距離 ${signedPctText(closestSignal.value,1)}` : "資料不足";

        const overviewSlide = React.createElement("section", { className: slideSectionClass },
            React.createElement(Card, { className:"p-4 min-h-[70vh] bg-gradient-to-br from-white/90 to-sky-50/80 flex flex-col justify-between" },
                React.createElement("div", null,
                    React.createElement("div", { className:`cover-hero cover-${data.coverTheme||'aurora'} rounded-[26px] min-h-[170px] p-5 text-white flex flex-col justify-between shadow-lg` },
                        React.createElement("div", { className:"relative z-10 text-xs font-black tracking-[.18em] text-white/70" }, "股票資產總覽"),
                        React.createElement("div", { className:"relative z-10" },
                            React.createElement("div", { className:"text-[11px] font-black text-white/65" }, "全部總資產"),
                            React.createElement("div", { className:"mt-2 text-[2.35rem] leading-none font-black privacy-value" }, portfolio.totalDisplay),
                            React.createElement("div", { className:"mt-2 text-sm font-bold text-white/70 privacy-value" }, `IB 策略帳戶 ${portfolio.strategyDisplay}｜匯率 ${money(portfolio.rate,2)}`))),
                    React.createElement("div", { className:"grid grid-cols-2 gap-3 mt-4" },
                        React.createElement("div", { className:"rounded-[24px] bg-white/75 border border-white/80 p-4" },
                            React.createElement("div", { className:"text-[10px] font-black text-slate-500" }, "正式策略"),
                            React.createElement("div", { className:"text-xl font-black text-slate-950 mt-1 leading-tight" }, metrics.title),
                            React.createElement("div", { className:"text-xs font-bold text-slate-500 mt-2" }, metrics.formalStateText)),
                        React.createElement("div", { className:"rounded-[24px] bg-white/75 border border-white/80 p-4" },
                            React.createElement("div", { className:"text-[10px] font-black text-slate-500" }, "今日動作"),
                            React.createElement("div", { className:"text-xl font-black text-slate-950 mt-1" }, metrics.canExecute ? "需要確認" : "先補資料"),
                            React.createElement("div", { className:"text-xs font-bold text-slate-500 mt-2" }, metrics.actionLines?.[0] || "目前沒有立即動作。"))),
                    StatusWarnings()),
                React.createElement("div", { className:"grid grid-cols-2 gap-3 mt-6" },
                    React.createElement("div", { className:"rounded-[24px] bg-slate-950 text-white p-4" },
                        React.createElement("div", { className:"text-[10px] font-black text-white/60" }, "IB 策略資產"),
                        React.createElement("div", { className:"mt-2 text-lg font-black privacy-value" }, portfolio.strategyDisplay),
                        React.createElement("div", { className:"mt-1 text-[10px] font-bold text-white/60" }, "唯一參與 TQQQ 策略")),
                    React.createElement("button", { onClick:()=>setShowAccountSheet(true), className:"rounded-[24px] bg-white/75 border border-white/90 p-4 text-left active:scale-[.98]" },
                        React.createElement("div", { className:"text-[10px] font-black text-slate-500" }, "其他帳戶合計　›"),
                        React.createElement("div", { className:"mt-2 text-lg font-black text-slate-950 privacy-value" }, `NT$ ${money(portfolio.externalTwd,0)}`),
                        React.createElement("div", { className:"mt-1 text-[10px] font-bold text-slate-500" }, "點開查看 FT、複委託、台股與其他"))),
                    React.createElement("button", { onClick:openQuickUpdateSheet, className:"action-blue-button quick-update-home-button w-full mt-3 py-4 rounded-[22px] bg-blue-600 text-white font-black shadow-lg" }, "↻ 快速更新 FT／複委託資產")));

        const signalSlide = React.createElement("section", { className: slideSectionClass },
            React.createElement(Card, { className:`p-6 min-h-[70vh] flex flex-col justify-between ${SignalSkin()}` },
                React.createElement("div", null,
                    React.createElement("div", { className:"text-xs font-black tracking-[.18em] text-slate-500" }, "策略訊號"),
                    React.createElement("div", { className:"mt-4 text-3xl font-black text-slate-950 leading-tight" }, metrics.title),
                    React.createElement("div", { className:"mt-3 text-sm font-bold text-slate-600 leading-relaxed" }, metrics.instruction),
                    React.createElement("div", { className:"grid grid-cols-2 gap-3 mt-6" },
                        [["SPY 位置", metrics.valid ? signedPctText(metrics.spyDev*100,1) : '資料不足'], ["QQQ 乖離", metrics.valid ? signedPctText(metrics.qqqDev*100,1) : '資料不足'], ["即時 HOT", metrics.valid ? metrics.thresholdRankLabel : '-'], ["本輪鎖定", metrics.introMode ? '未啟用' : metrics.storedHotLabel]].map(([label,val], i) =>
                            React.createElement("div", { key:i, className:"rounded-[24px] bg-white/70 border border-white/80 p-4" },
                                React.createElement("div", { className:"text-[10px] font-black text-slate-500" }, label),
                                React.createElement("div", { className:"mt-2 text-xl font-black text-slate-950" }, val)))),
                    React.createElement("div", { className:`mt-4 rounded-[24px] p-4 border ${metrics.hotPullbackLocked ? 'bg-purple-50 border-purple-200' : 'bg-white/75 border-white/80'}` },
                        React.createElement("div", { className:"text-xs font-black text-slate-900" }, `QQQ 即時 ${metrics.thresholdRankLabel}｜正式 ${metrics.storedHotLabel}`),
                        React.createElement("div", { className:"mt-2 text-sm font-bold leading-relaxed text-slate-600" }, metrics.hotCompareMessage))),
                React.createElement("div", { className:"grid grid-cols-2 gap-3 mt-6" },
                    React.createElement("div", { className:"rounded-[24px] bg-slate-950 text-white p-4" },
                        React.createElement("div", { className:"text-[10px] font-black text-white/60" }, "下一個關鍵價位"),
                        React.createElement("div", { className:"mt-2 text-base font-black" }, closestSignalText),
                        React.createElement("div", { className:"mt-2 text-[10px] font-bold text-white/60" }, nextCheckText().replace('美股收盤後',''))),
                    React.createElement("div", { className:"rounded-[24px] bg-white/75 border border-white/80 p-4" },
                        React.createElement("div", { className:"text-[10px] font-black text-slate-500" }, "資料日期"),
                        React.createElement("div", { className:"mt-2 text-base font-black text-slate-950" }, data.marketDate || '-'),
                        React.createElement("div", { className:"mt-2 text-[10px] font-bold text-slate-500" }, `過熱替代標的：${data.hotAsset||'QQQ'}`)))));

        const tradeSlide = React.createElement("section", { className: slideSectionClass },
            React.createElement(Card, { className:"trade-slide-card p-6 min-h-[70vh] bg-gradient-to-br from-slate-950 to-slate-800 text-white flex flex-col justify-between" },
                React.createElement("div", null,
                    React.createElement("div", { className:"text-xs font-black tracking-[.18em] text-white/60" }, "今日交易"),
                    React.createElement("div", { className:"mt-4 text-3xl font-black leading-tight" }, metrics.alloc.label),
                    React.createElement("div", { className:"mt-3 text-sm font-bold text-white/70 leading-relaxed" }, metrics.formalStateText),
                    simpleActionList()),
                React.createElement("div", { className:"grid grid-cols-2 gap-3 mt-6" },
                    metrics.targetRows.map(row => React.createElement("div", { key:row.sym, className:"rounded-[24px] bg-white/10 border border-white/10 p-4" },
                        React.createElement("div", { className:"text-[10px] font-black text-white/60" }, row.sym),
                        React.createElement("div", { className:"mt-2 text-xl font-black privacy-value" }, money(row.targetShares, 3), " 股"),
                        React.createElement("div", { className:"mt-2 text-[10px] font-bold text-white/60 privacy-value" }, `現有 ${money(row.currentShares,3)}｜差額 ${row.shareDiff>=0?'+':''}${money(row.shareDiff,3)}`))))));


        return React.createElement("main", { className: "home-page max-w-5xl mx-auto px-4 pt-1 content-bottom-space", onTouchStart:handleHomeTouchStart, onTouchMove:handleHomeTouchMove, onTouchEnd:handleHomeTouchEnd, onTouchCancel:()=>{pullStartRef.current.active=false;setPullDistance(0);} },
            React.createElement("div", { className:"pull-indicator", style:{height:`${pullRefreshing?52:pullDistance}px`} }, React.createElement("div",null,pullRefreshing?"正在更新股價…":pullDistance>=54?"放開更新":"下拉更新")),
            React.createElement("div", { className:"home-page-head mb-4 flex items-center justify-between gap-3" },
                React.createElement("div", null,
                    React.createElement("div", { className:"text-[11px] font-black tracking-[.22em] text-brand-700" }, "LIQUID DASH"),
                    React.createElement("div", { className:"text-sm font-bold text-slate-700 mt-1" }, "左右滑動查看總覽、訊號與今日交易")),
                React.createElement("div", { className:"home-slide-dots flex gap-1.5" }, [0,1,2].map(idx => React.createElement("button", { key:idx, onClick:()=>scrollHomeTo(idx), className:`h-2.5 rounded-full transition-all ${homeSlide===idx?'w-8 bg-slate-900':'w-2.5 bg-slate-300'}` })))),
            React.createElement("div", { ref:homeSliderRef, onScroll:handleHomeSliderScroll, className:"home-slider flex gap-4 overflow-x-auto pb-2" }, overviewSlide, signalSlide, tradeSlide),
            React.createElement("div", { className:"home-page-count mt-4 flex justify-center" },
                React.createElement("div", { className:"rounded-full bg-white/70 border border-white/80 px-4 py-2 text-xs font-bold text-slate-500" }, `${homeSlide+1} / 3`))
        );
    };
    const Inputs = () => React.createElement("main", { className: "max-w-5xl mx-auto px-4 pt-5 content-bottom-space" },
        React.createElement(Card, { className:"p-6 mb-4 bg-gradient-to-br from-white/90 to-indigo-50/75" },
            React.createElement("div", { className:"text-[11px] font-black tracking-[.2em] text-brand-600" }, "設定中心"),
            React.createElement("div", { className:"mt-3 text-3xl font-black text-slate-950" }, "簡單管理，細節需要時再開"),
            React.createElement("div", { className:"mt-2 text-sm font-bold text-slate-500 leading-relaxed" }, `IB 策略資產 ${portfolio.strategyDisplay}｜全部總資產 ${portfolio.totalDisplay}`),
            React.createElement("div", { className:"mt-5 grid grid-cols-3 gap-2" },
                React.createElement("div", { className:"rounded-2xl bg-white/75 p-3 text-center" }, React.createElement("div", { className:"text-[10px] font-black text-slate-400" }, "策略階段"), React.createElement("div", { className:"mt-1 text-xs font-black text-slate-900" }, metrics.formalStateText)),
                React.createElement("div", { className:"rounded-2xl bg-white/75 p-3 text-center" }, React.createElement("div", { className:"text-[10px] font-black text-slate-400" }, "過熱替代"), React.createElement("div", { className:"mt-1 text-sm font-black text-slate-900" }, data.hotAsset||'QQQ')),
                React.createElement("div", { className:"rounded-2xl bg-white/75 p-3 text-center" }, React.createElement("div", { className:"text-[10px] font-black text-slate-400" }, "草稿"), React.createElement("div", { className:`mt-1 text-sm font-black ${hasDraftChanges?'text-amber-600':'text-emerald-600'}` }, hasDraftChanges?'未儲存':'已儲存')))),
        Collapsible({ id:"marketData", title:"市場資料", desc:`SPY / QQQ / TQQQ 報價與兩個 200SMA｜資料日 ${data.marketDate||'-'}`, children:
            React.createElement("div", null,
                React.createElement("div", { className:"flex justify-end mb-3" }, React.createElement("button", { onClick:fetchPrices, disabled:loadingPrice, className:"px-4 py-3 rounded-2xl bg-slate-950 text-white text-sm font-black disabled:opacity-50" }, loadingPrice?'更新中…':'自動抓股價')),
                React.createElement("div", { className:"grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3" },
                    React.createElement(NumInput, { label:"SPY 收盤價", value:data.spy, onChange:v=>patch('spy',v) }),
                    React.createElement(NumInput, { label:"SPY 200SMA（手動）", value:data.spySma, onChange:v=>patch('spySma',v) }),
                    React.createElement(NumInput, { label:"QQQ 收盤價", value:data.qqq, onChange:v=>patch('qqq',v) }),
                    React.createElement(NumInput, { label:"QQQ 200SMA（HOT 必要）", value:data.qqqSma, onChange:v=>patch('qqqSma',v) }),
                    React.createElement(NumInput, { label:"TQQQ 價格", value:data.tqqq, onChange:v=>patch('tqqq',v) }),
                    (['SPYI','QQQI'].includes(data.hotAsset||'QQQ')) && React.createElement(NumInput, { label:`${data.hotAsset} 價格`, value:data.hotAsset==='SPYI'?data.spyi:data.qqqi, onChange:v=>patch(data.hotAsset==='SPYI'?'spyi':'qqqi',v) }),
                    React.createElement("label", { className:"block bg-slate-50 border border-slate-200 rounded-2xl p-3" },
                        React.createElement("div", { className:"text-[10px] font-black text-slate-500 mb-1" }, "資料日期"),
                        React.createElement("input", { type:"date", value:data.marketDate||"", onChange:e=>patch('marketDate',e.target.value), className:"w-full bg-transparent text-center font-mono font-black min-h-[44px]" })))) }),
        Collapsible({ id:"holdings", title:"IB 持股與現金", desc:`目前輸入 TQQQ＋${metrics.positionAsset}｜只用於 TQQQ 策略`, children:
            React.createElement("div", null,
                React.createElement("div", { className:"grid grid-cols-2 md:grid-cols-4 gap-3" },
                    renderDraftNumInput("sharesTqqq", "TQQQ 股數"),
                    renderDraftNumInput(metrics.positionAsset==='QQQ'?'sharesQqq':metrics.positionAsset==='SPY'?'sharesSpy':metrics.positionAsset==='SPYI'?'sharesSpyi':'sharesQqqi', `${metrics.positionAsset} 股數`),
                    renderDraftNumInput("cashUsd", "現金 USD"),
                    renderDraftNumInput("otherUsd", "其他 IB 資產 USD"),
                    renderDraftNumInput("usdtwd", "USD/TWD（可手動覆寫）", "", data.exchangeRateProvider===EXCHANGE_RATE_PROVIDER?`線上更新 ${data.exchangeRateUpdatedDate||"-"}`:"目前為手動匯率"),
                    renderDraftNumInput("dcaPoolUsd", "DCA 資金池", "USD")),
                React.createElement("div", { className:"flex gap-2 mt-3" },
                    React.createElement("button", { onClick:resetAssetHigh, className:"flex-1 py-3 rounded-2xl bg-slate-950 text-white text-sm font-black" }, "以目前資產設高點"),
                    React.createElement("select", { value:data.currency, onChange:e=>patch('currency',e.target.value), className:"px-4 rounded-2xl bg-white text-sm font-black" }, React.createElement("option", { value:"USD" }, "USD"), React.createElement("option", { value:"TWD" }, "TWD")))) }),
        Collapsible({ id: "assetAccounts", title: "全部資產帳戶", desc: "IB 維持主策略；FT 用帳戶總淨值，複委託可用單一股票自動估值。", children:
            React.createElement("div", null,
                React.createElement("div", { className:"grid grid-cols-1 sm:grid-cols-2 gap-3" },
                    React.createElement(NumInput, { label: "IB 策略帳戶（自動）", value: money(metrics.totalUsd,2), onChange: ()=>{}, suffix:"USD", disabled:true, hint:"由 TQQQ＋替代標的＋現金＋其他資產自動計算" }),
                    renderDraftNumInput("ftUsd", "Firstrade 帳戶總資產", "USD", "只記 Total Account Value，不追蹤短線持股。"),
                    renderDraftNumInput("subUsd", "複委託手動備援淨值", "USD", "設定單一股票代號、股數與股價後會改用自動估值。"),
                    renderDraftNumInput("twStockTwd", "台股淨值", "TWD", "只計入全部總資產。"),
                    renderDraftNumInput("otherTotalTwd", "其他股票資產", "TWD", "可放其他券商、證券或投資現金，不包含房產與負債。")),
                React.createElement("div", { className:"mt-3 rounded-2xl bg-slate-950 text-white p-4" },
                    React.createElement("div", { className:"text-[10px] font-black text-white/60" }, "目前總覽"),
                    React.createElement("div", { className:"mt-2 text-2xl font-black" }, portfolio.totalDisplay),
                    React.createElement("div", { className:"mt-1 text-xs font-bold text-white/70" }, `IB 策略 ${portfolio.strategyDisplay}｜FT US$ ${money(portfolio.ftUsd,2)}｜複委託 US$ ${money(portfolio.subUsd,2)}｜台股 NT$ ${money(portfolio.twStockTwd,0)}`))
            ) }),
        Collapsible({ id: "scenario", title: "QQQ 情境模擬", desc: "需要時再展開。", children: ScenarioCard() }),
        Collapsible({ id: "marketStatus", title: "市場資料狀態", desc: "資料日期、來源與新鮮度。", children: FreshnessCard() }),
        Collapsible({ id: "strategyParams", title: "策略參數", desc: "Risk-On／Risk-Off、HOT 門檻與過熱替代標的。", children:
            React.createElement("div", null,
                React.createElement(SectionTitle, { title: "參數設定", desc: "首次導入先持有 QQQ；完整經歷 Risk-Off 後再啟用 TQQQ。", right: React.createElement("button", { onClick: () => {
                    if(data.parametersLocked!==false){
                        if(confirm("⚠️ 確定要解鎖策略參數嗎？\n\n修改 Risk-On、Risk-Off 或 HOT 門檻，可能改變整套策略的交易結果。請確認你已理解影響並確定要修改。")) patch('parametersLocked', false);
                    } else {
                        patch('parametersLocked', true); showToast("策略參數已鎖定");
                    }
                }, className: `px-3 py-2 rounded-xl text-xs font-black active:scale-95 ${data.parametersLocked!==false?"bg-slate-900 text-white":"bg-amber-500 text-white"}` }, data.parametersLocked!==false ? "🔒 已鎖定" : "🔓 重新鎖定") }),
                React.createElement("div", { className: "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3" },
                    React.createElement(NumInput, { label: "Risk-On", value: data.entryBuffer, onChange: v => patch('entryBuffer', v), suffix: "%", disabled:metrics.paramsLocked }),
                    React.createElement(NumInput, { label: "Risk-Off", value: data.exitBuffer, onChange: v => patch('exitBuffer', v), suffix: "%", disabled:metrics.paramsLocked }),
                    React.createElement(NumInput, { label: "過熱一階（60/40）", value: data.hot1, onChange: v => patch('hot1', v), suffix: "%", disabled:metrics.paramsLocked }),
                    React.createElement(NumInput, { label: "過熱二階（30/70）", value: data.hot2, onChange: v => patch('hot2', v), suffix: "%", disabled:metrics.paramsLocked }),
                    React.createElement(NumInput, { label: "過熱三階（0/100）", value: data.hot3, onChange: v => patch('hot3', v), suffix: "%", disabled:metrics.paramsLocked }),
                    React.createElement("label", { className: "block bg-slate-50 border border-slate-200 rounded-2xl p-3" },
                        React.createElement("div", { className: "text-[10px] font-black text-slate-500 mb-1" }, "過熱替代標的"),
                        React.createElement("select", { value:data.hotAsset||"QQQ", disabled:metrics.paramsLocked, onChange:e=>patch('hotAsset',e.target.value), className:`w-full bg-transparent text-center font-black min-h-[44px] ${metrics.paramsLocked?"text-slate-400":"text-slate-900"}` },
                            React.createElement("option", { value:"QQQ" }, "QQQ"), React.createElement("option", { value:"SPY" }, "SPY"), React.createElement("option", { value:"SPYI" }, "SPYI"), React.createElement("option", { value:"QQQI" }, "QQQI")),
                        React.createElement("div", { className:"text-[10px] text-slate-400 mt-1 leading-relaxed" }, "只影響 HOT1／HOT2／HOT3 被 TQQQ 釋出的比例；首次導入與 Risk-Off DCA 仍固定使用 QQQ。"))),
                React.createElement("div", { className:"flex flex-col sm:flex-row gap-2 mt-3" },
                    React.createElement("button", { onClick: () => {
                        if(data.parametersLocked!==false) return;
                        if(confirm("確定要恢復正式預設參數 +4% / -3% / 19% / 24% / 28% 嗎？")) merge({ entryBuffer:4, exitBuffer:3, hot1:19, hot2:24, hot3:28, hotAsset:"QQQ" }, true);
                    }, disabled:metrics.paramsLocked, className:`px-3 py-3 rounded-2xl text-xs font-black ${metrics.paramsLocked?"bg-slate-100 text-slate-400 cursor-not-allowed":"bg-brand-50 text-brand-700 border border-brand-100"}` }, "恢復正式預設"),
                    React.createElement("div", { className:`flex-1 rounded-2xl border p-3 ${metrics.paramsLocked?"bg-emerald-50 border-emerald-100":"bg-amber-50 border-amber-200"}` },
                        React.createElement("div", { className:`text-sm font-black ${metrics.paramsLocked?"text-emerald-900":"text-amber-900"}` }, metrics.paramsLocked?"參數已鎖定":"⚠️ 參數目前可修改"),
                        React.createElement("div", { className:`text-xs font-bold mt-1 leading-relaxed ${metrics.paramsLocked?"text-emerald-700":"text-amber-700"}` }, metrics.paramsLocked?"避免誤觸修改。需要調整時，按右上角解鎖並確認警告。":"修改完成後請按右上角「重新鎖定」，避免日後誤改。")))) }),
        Collapsible({ id: "hotCycle", title: "開啟新一輪 HOT", desc: "人工啟用或在過熱回落後重開 HOT 週期。", children:
            React.createElement("div", { className:`rounded-2xl border p-3 ${(String(data.strategyPhase||'INTRO_QQQ').toUpperCase()==='INTRO_QQQ'||(metrics.strategyActive&&metrics.storedHot>metrics.thresholdRank&&!metrics.riskOffNow))?'bg-amber-50 border-amber-200':'bg-slate-50 border-slate-200'}` },
                React.createElement("div", { className:"flex flex-col sm:flex-row sm:items-center justify-between gap-3" },
                    React.createElement("div", null,
                        React.createElement("div", { className:"text-sm font-black text-slate-900" }, "開啟新一輪 HOT"),
                        React.createElement("div", { className:"text-xs font-bold mt-1 leading-relaxed text-slate-600" },
                            String(data.strategyPhase||'INTRO_QQQ').toUpperCase()==='INTRO_QQQ'
                                ? `首次導入可在 SPY 已高於 +${data.entryBuffer}% 時人工啟用；會依當下 QQQ 即時門檻開始。`
                                : (metrics.strategyActive&&metrics.storedHot>metrics.thresholdRank&&!metrics.riskOffNow
                                    ? `本輪已鎖定 HOT${metrics.storedHot}，即時已回落至 HOT${metrics.thresholdRank}；可人工重開新週期。`
                                    : "只有首次導入已符合 Risk-On，或正式 HOT 已回落低於本輪鎖定時，才可使用。"))),
                    ((String(data.strategyPhase||'INTRO_QQQ').toUpperCase()==='INTRO_QQQ'&&metrics.riskOnNow&&!metrics.riskOffNow)||(metrics.strategyActive&&metrics.storedHot>metrics.thresholdRank&&!metrics.riskOffNow))
                        && React.createElement("button", { onClick:openNewHotCycle, className:"shrink-0 px-4 py-3 rounded-2xl bg-amber-600 text-white text-sm font-black active:scale-95" }, "開啟新一輪 HOT")),
                React.createElement("div", { className:"mt-3 bg-purple-50 border border-purple-100 rounded-2xl p-3" },
                    React.createElement("div", { className:"text-sm font-black text-purple-900" }, "過熱重置規則"),
                    React.createElement("div", { className:"text-xs font-bold text-purple-700 mt-1 leading-relaxed" }, "同一個 Risk-On 週期只會往更低槓桿移動。SPY 觸發 Risk-Off 後會自動重置；若 QQQ 已由高階 HOT 回落，也可由使用者按「開啟新一輪 HOT」人工重設為當下即時階級。"))) }),
        Collapsible({ id: "previewScenarios", title: "模擬情境", desc: "預覽首頁訊號、配置與交易清單，不修改正式資料。", children:
            React.createElement("div", { className:"bg-sky-50 border border-sky-200 rounded-2xl p-3" },
                React.createElement("div", { className:"flex items-center justify-between gap-2" },
                    React.createElement("div", null,
                        React.createElement("div", { className:"text-sm font-black text-sky-900" }, "畫面測試情境"),
                        React.createElement("div", { className:"text-xs font-bold text-sky-700 mt-1" }, "只預覽首頁訊號、配置與交易清單，不會修改、儲存或同步正式資料。")),
                    previewScenario!=="LIVE" && React.createElement("button", { onClick:()=>{setPreviewScenario("LIVE");setPage("home");}, className:"shrink-0 px-3 py-2 rounded-xl bg-slate-900 text-white text-xs font-black" }, "回正式資料")),
                React.createElement("div", { className:"grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3" },
                    [["LIVE","正式資料"],["INTRO","首次導入"],["HOT0","Risk-On"],["HOT1","HOT1"],["HOT2","HOT2"],["HOT3","HOT3"],["RISK_OFF","開始下跌"],["DCA","DCA 中"]].map(x=>React.createElement("button", { key:x[0], onClick:()=>{setPreviewScenario(x[0]);setPage("home");}, className:`py-2.5 rounded-xl text-xs font-black active:scale-95 ${previewScenario===x[0]?"bg-sky-600 text-white":"bg-white border border-sky-200 text-sky-800"}` }, x[1]))),
                previewScenario!=="LIVE" && React.createElement("div", { className:"mt-2 text-xs font-black text-sky-800" }, `目前預覽：${previewScenario}｜過熱替代標的：${data.hotAsset||"QQQ"}`)) }),
        Collapsible({ id: "strategyText", title: "完整策略文字", desc: "需要查規則時再展開。", children: React.createElement("pre", { className: "whitespace-pre-wrap text-xs leading-relaxed bg-slate-50 border border-slate-100 rounded-2xl p-4 text-slate-600 font-bold" }, STRATEGY_TEXT) }));
    const ProfitChart = ({ logs, range, mode, onRange, onMode }) => {
        const [activeIndex,setActiveIndex]=useState(null);
        const svgRef=useRef(null);
        const rangeOptions=[["1W","1週"],["1M","1個月"],["3M","3個月"],["6M","半年"],["YTD","本年至今"],["1Y","1年"],["MAX","最長"]];
        const rangeLabel=(rangeOptions.find(x=>x[0]===range)||rangeOptions[2])[1];
        const today=parseDateLocal(todayStr())||new Date();
        const subtractMonths=(date,months)=>{const d=new Date(date);const day=d.getDate();d.setDate(1);d.setMonth(d.getMonth()-months);const last=new Date(d.getFullYear(),d.getMonth()+1,0).getDate();d.setDate(Math.min(day,last));return d;};
        let cutoffText="";
        if(range==="1W"){const d=new Date(today);d.setDate(d.getDate()-7);cutoffText=formatDateLocal(d);}
        else if(range==="1M") cutoffText=formatDateLocal(subtractMonths(today,1));
        else if(range==="3M") cutoffText=formatDateLocal(subtractMonths(today,3));
        else if(range==="6M") cutoffText=formatDateLocal(subtractMonths(today,6));
        else if(range==="YTD") cutoffText=`${today.getFullYear()}-01-01`;
        else if(range==="1Y") cutoffText=formatDateLocal(subtractMonths(today,12));
        const strategyCurrentDate=data.marketDate||todayStr();
        const portfolioCurrentDate=todayStr();
        const snapshots=(Array.isArray(data.portfolioHistory)?data.portfolioHistory:[]).filter(x=>x&&x.date).slice().sort((a,b)=>String(a.date).localeCompare(String(b.date)));
        const rateForDate=date=>{
            const prior=snapshots.filter(x=>String(x.date||'').slice(0,10)<=date).slice(-1)[0];
            return getNum(prior?.rate)||getNum(portfolio.rate)||getNum(data.usdtwd)||1;
        };
        const ibRaw=[];
        snapshots.forEach(x=>{if(getNum(x.strategyUsd)>0)ibRaw.push({date:String(x.date||"").slice(0,10),value:getNum(x.strategyUsd),source:'daily'});});
        (Array.isArray(logs)?logs:[]).filter(h=>h.recordType!=="cashflow"&&getNum(h.totalUsd)>0).forEach(h=>ibRaw.push({date:recordDateText(h),value:getNum(h.totalUsd),source:'record'}));
        if(getNum(metrics.totalUsd)>0) ibRaw.push({date:strategyCurrentDate,value:getNum(metrics.totalUsd),source:'current'});
        const totalRaw=snapshots.map(x=>({date:String(x.date||"").slice(0,10),value:getNum(x.totalTwd),source:'daily'})).filter(x=>x.date&&x.value>=0);
        if(getNum(portfolio.totalTwd)>0) totalRaw.push({date:portfolioCurrentDate,value:getNum(portfolio.totalTwd),source:'current'});
        const accountSeries=(field,currentValue,accountCode)=>{
            const rows=snapshots.map(x=>({date:String(x.date||"").slice(0,10),value:getNum(x?.[field]),source:'daily'})).filter(x=>x.date&&x.value>=0);
            const flowDates=(Array.isArray(data.externalCashflows)?data.externalCashflows:[]).filter(f=>String(f.account||'').toUpperCase()===accountCode).map(f=>String(f.date||'').slice(0,10)).filter(Boolean).sort();
            const positiveDate=rows.find(x=>x.value>0)?.date||'';
            const firstDate=[positiveDate,flowDates[0]||''].filter(Boolean).sort()[0]||'';
            const trimmed=firstDate?rows.filter(x=>x.date>=firstDate):[];
            if(trimmed.length||getNum(currentValue)>0)trimmed.push({date:portfolioCurrentDate,value:getNum(currentValue),source:'current'});
            return trimmed;
        };
        const ftRaw=accountSeries('ftUsd',portfolio.ftUsd,'FT');
        const subRaw=accountSeries('subUsd',portfolio.subUsd,'SUB');
        const nativeRaw=mode==="TOTAL"?totalRaw:mode==="FT"?ftRaw:mode==="SUB"?subRaw:ibRaw;
        const convertAssetValue=(value,date)=>{
            const rate=Math.max(0.0001,rateForDate(date));
            if(historyCurrency==="TWD") return mode==="TOTAL"?getNum(value):getNum(value)*rate;
            return mode==="TOTAL"?getNum(value)/rate:getNum(value);
        };
        const raw=nativeRaw.map(x=>({...x,value:convertAssetValue(x.value,x.date)}));
        const byDate=new Map(); raw.forEach(x=>{if(x.date)byDate.set(x.date,x);});
        const allPoints=[...byDate.values()].sort((a,b)=>a.date.localeCompare(b.date));
        let pointsData=allPoints;
        if(cutoffText){
            const inRange=allPoints.filter(x=>x.date>=cutoffText);
            const prior=allPoints.filter(x=>x.date<cutoffText).slice(-1)[0];
            pointsData=prior?[{date:cutoffText,value:prior.value,synthetic:true,source:'baseline'},...inRange]:inRange;
            const deduped=new Map();pointsData.forEach(x=>deduped.set(x.date,x));pointsData=[...deduped.values()].sort((a,b)=>a.date.localeCompare(b.date));
        }
        useEffect(()=>setActiveIndex(null),[range,mode,historyCurrency,pointsData.length]);
        const modeMeta={IB:{title:'IB 主策略資產',empty:'至少需要 2 筆 IB 策略資產紀錄'},TOTAL:{title:'全部股票總資產',empty:'儲存至少 2 天的全部帳戶快照後才會顯示'},FT:{title:'Firstrade 帳戶',empty:'至少儲存 2 天 Firstrade 帳戶總資產'},SUB:{title:'複委託帳戶',empty:'至少儲存 2 天複委託估值'}}[mode]||{title:'IB 主策略資產',empty:'資料不足'};
        const currency=historyCurrency;
        const symbol=currency==="TWD"?"NT$":"$";
        const title=modeMeta.title;
        const canChart=pointsData.length>=2;
        const first=canChart?pointsData[0].value:0;
        const last=canChart?pointsData[pointsData.length-1].value:0;
        const startDate=canChart?pointsData[0].date:"";
        const endDate=canChart?pointsData[pointsData.length-1].date:"";
        const signedFlow=(type,amount)=>(String(type).toLowerCase()==='withdrawal'?-1:1)*Math.abs(getNum(amount));
        const allFlows=[];
        (Array.isArray(logs)?logs:[]).filter(r=>r.recordType==='cashflow').forEach(r=>allFlows.push({account:'IB',date:String(r.cashflowDate||r.executionDate||'').slice(0,10),amountUsd:signedFlow(r.cashflowType,r.cashflowAmountUsd)}));
        (Array.isArray(data.externalCashflows)?data.externalCashflows:[]).forEach(r=>allFlows.push({account:String(r.account||'FT').toUpperCase(),date:String(r.date||'').slice(0,10),amountUsd:signedFlow(r.type,r.amountUsd)}));
        const flowValue=(flow,targetMode)=>historyCurrency==='TWD'?flow.amountUsd*rateForDate(flow.date):flow.amountUsd;
        const flowMatches=(flow,targetMode)=>targetMode==='TOTAL'||(targetMode==='IB'&&flow.account==='IB')||(targetMode==='FT'&&flow.account==='FT')||(targetMode==='SUB'&&flow.account==='SUB');
        const flowBetween=(targetMode,from,to,exactDate='')=>allFlows.filter(f=>f.date&&flowMatches(f,targetMode)&&(exactDate?f.date===exactDate:(f.date>=from&&f.date<=to))).reduce((sum,f)=>sum+flowValue(f,targetMode),0);
        const netFlow=canChart?flowBetween(mode,startDate,endDate):0;
        const change=canChart?last-first-netFlow:0;
        const changePct=canChart&&first>0?change/first:0;
        const values=pointsData.map(x=>x.value);
        const min=canChart?Math.min(...values):0;
        const max=canChart?Math.max(...values):0;
        const rangeValue=Math.max(1,max-min);
        let peak=canChart?values[0]:0,maxDrawdown=0;
        values.forEach(v=>{peak=Math.max(peak,v);if(peak>0)maxDrawdown=Math.min(maxDrawdown,v/peak-1);});
        const w=360,h=180,padX=18,padTop=20,padBottom=26;
        const coords=pointsData.map((item,i)=>({...item,x:padX+(i*(w-padX*2))/Math.max(1,pointsData.length-1),y:h-padBottom-((item.value-min)*(h-padTop-padBottom))/rangeValue}));
        const linePoints=coords.map(p=>`${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
        const areaPoints=canChart?`${padX},${h-padBottom} ${linePoints} ${w-padX},${h-padBottom}`:"";
        const selectedIndex=canChart?(activeIndex==null?coords.length-1:Math.max(0,Math.min(coords.length-1,activeIndex))):-1;
        const selected=selectedIndex>=0?coords[selectedIndex]:null;
        const previous=selectedIndex>0?coords[selectedIndex-1]:null;
        const selectedFlow=selected?flowBetween(mode,startDate,selected.date,selected.date):0;
        const selectedDelta=selected&&previous?selected.value-previous.value-selectedFlow:0;
        const selectedNetFlow=selected?flowBetween(mode,startDate,selected.date):0;
        const selectedFromStart=selected?selected.value-first-selectedNetFlow:0;
        const selectedPct=selected&&first>0?selectedFromStart/first:0;
        const updatePointer=e=>{
            if(!canChart||!svgRef.current)return;
            const rect=svgRef.current.getBoundingClientRect();
            const clientX=e.clientX ?? e.touches?.[0]?.clientX;
            if(!Number.isFinite(clientX))return;
            const local=Math.max(0,Math.min(rect.width,clientX-rect.left));
            const idx=Math.round((local/Math.max(1,rect.width))*(coords.length-1));
            setActiveIndex(idx);
        };
        const modeButtons=[["IB","IB 主策略"],["TOTAL","全部"],["FT","FT"],["SUB","複委託"]].map(([id,label])=>React.createElement("button",{key:id,onClick:()=>onMode(id),className:`history-option shrink-0 px-3 py-2 rounded-full text-xs font-black ${mode===id?"is-active":""}`},label));
        const header=React.createElement("div",{className:"flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"},
            React.createElement("div",null,React.createElement("div",{className:"text-[11px] font-black tracking-[.16em] text-white/55"},`歷史資產與損益｜${historyCurrency==="TWD"?"新台幣":"美元"}`),React.createElement("div",{className:"text-2xl font-black mt-1"},title)),
            React.createElement("div",{className:"flex rounded-full bg-white/10 p-1 overflow-x-auto max-w-full"},modeButtons));
        const summaryLeft=React.createElement("div",null,
            React.createElement("div",{className:`font-mono text-3xl font-black privacy-value ${change>=0?"text-emerald-300":"text-red-300"}`},canChart?`${change>=0?"+":"-"}${symbol}${money(Math.abs(change),currency==="TWD"?0:2)}`:"資料累積中"),
            React.createElement("div",{className:"text-xs font-bold text-white/55 mt-1"},canChart?`${signedPctText(changePct*100,2)}｜${startDate} ～ ${endDate}`:modeMeta.empty));
        const summaryRight=canChart?React.createElement("div",{className:"text-right text-xs font-bold text-white/55"},React.createElement("div",{className:"privacy-value"},`高點 ${symbol}${money(max,0)}`),React.createElement("div",{className:maxDrawdown<=-0.2?"text-red-300":""},`最大回撤 ${pct(maxDrawdown,1)}`)):null;
        const summary=React.createElement("div",{className:"flex items-end justify-between gap-3 mt-5"},summaryLeft,summaryRight);
        const svgChildren=[];
        svgChildren.push(React.createElement("defs",{key:"defs"},React.createElement("linearGradient",{id:`assetAreaGradient-${mode}`,x1:"0",y1:"0",x2:"0",y2:"1"},React.createElement("stop",{offset:"0%",stopColor:change>=0?"#6ee7b7":"#fca5a5",stopOpacity:"0.42"}),React.createElement("stop",{offset:"100%",stopColor:change>=0?"#6ee7b7":"#fca5a5",stopOpacity:"0"}))));
        [0.25,0.5,0.75].forEach(v=>svgChildren.push(React.createElement("line",{key:`grid-${v}`,x1:padX,x2:w-padX,y1:padTop+(h-padTop-padBottom)*v,y2:padTop+(h-padTop-padBottom)*v,stroke:"rgba(255,255,255,.10)",strokeWidth:"1"})));
        svgChildren.push(React.createElement("polygon",{key:"area",points:areaPoints,fill:`url(#assetAreaGradient-${mode})`}));
        svgChildren.push(React.createElement("polyline",{key:"line",points:linePoints,fill:"none",stroke:change>=0?"#6ee7b7":"#fca5a5",strokeWidth:"4",strokeLinecap:"round",strokeLinejoin:"round"}));
        if(selected){svgChildren.push(React.createElement("line",{key:"cursor",x1:selected.x,x2:selected.x,y1:padTop,y2:h-padBottom,stroke:"rgba(255,255,255,.5)",strokeWidth:"1",strokeDasharray:"4 4"}));svgChildren.push(React.createElement("circle",{key:"selected",cx:selected.x,cy:selected.y,r:"6",fill:"white",stroke:change>=0?"#10b981":"#ef4444",strokeWidth:"3"}));}
        if(canChart){const maxIdx=values.indexOf(max),minIdx=values.indexOf(min);[maxIdx,minIdx].filter((v,i,a)=>v>=0&&a.indexOf(v)===i).forEach((idx,i)=>{const p=coords[idx],label=i===0?'高':'低';svgChildren.push(React.createElement("circle",{key:`ext-${i}`,cx:p.x,cy:p.y,r:"3",fill:i===0?"#fbbf24":"#60a5fa"}));svgChildren.push(React.createElement("text",{key:`ext-label-${i}`,x:p.x,y:i===0?Math.max(10,p.y-8):Math.min(h-padBottom-2,p.y+14),fill:i===0?"#fde68a":"#bfdbfe",fontSize:"9",fontWeight:"900",textAnchor:"middle"},label));});}
        svgChildren.push(React.createElement("text",{key:"start",x:padX,y:h-5,fill:"rgba(255,255,255,.45)",fontSize:"10",fontWeight:"700"},startDate.slice(5).replace("-","/")));
        svgChildren.push(React.createElement("text",{key:"end",x:w-padX,y:h-5,fill:"rgba(255,255,255,.45)",fontSize:"10",fontWeight:"700",textAnchor:"end"},endDate.slice(5).replace("-","/")));
        const chartBody=canChart?React.createElement("div",null,
            React.createElement("svg",{ref:svgRef,viewBox:`0 0 ${w} ${h}`,className:"w-full h-44 touch-pan-y",role:"img","aria-label":`${title}${rangeLabel}走勢圖`,onPointerMove:updatePointer,onPointerDown:updatePointer,onPointerLeave:()=>setActiveIndex(null)},svgChildren),
            selected&&React.createElement("div",{className:"grid grid-cols-3 gap-2 px-2 pb-2"},
                React.createElement("div",{className:"rounded-2xl bg-white/10 p-2"},React.createElement("div",{className:"text-[9px] font-black text-white/45"},"日期"),React.createElement("div",{className:"text-xs font-black mt-1"},selected.date)),
                React.createElement("div",{className:"rounded-2xl bg-white/10 p-2"},React.createElement("div",{className:"text-[9px] font-black text-white/45"},"當日資產"),React.createElement("div",{className:"text-xs font-black mt-1 privacy-value"},`${symbol}${money(selected.value,currency==="TWD"?0:2)}`)),
                React.createElement("div",{className:"rounded-2xl bg-white/10 p-2"},React.createElement("div",{className:"text-[9px] font-black text-white/45"},"較前一筆"),React.createElement("div",{className:`text-xs font-black mt-1 privacy-value ${selectedDelta>=0?'text-emerald-300':'text-red-300'}`},`${selectedDelta>=0?'+':'-'}${symbol}${money(Math.abs(selectedDelta),currency==="TWD"?0:2)}`)),
                React.createElement("div",{className:"col-span-3 text-center text-[10px] font-bold text-white/45"},`區間起點以來 ${signedPctText(selectedPct*100,2)}；已扣除已記錄入金／出金`)))
            :React.createElement("div",{className:"h-52 flex items-center justify-center text-center px-6 text-sm font-bold text-white/45 leading-relaxed"},modeMeta.empty);
        const chartBox=React.createElement("div",{className:"mt-4 rounded-[24px] bg-white/5 border border-white/10 p-2"},chartBody);
        const rangeButtons=rangeOptions.map(([id,label])=>React.createElement("button",{key:id,onClick:()=>onRange(id),className:`history-option shrink-0 min-w-[64px] px-4 py-2.5 rounded-full text-xs font-black snap-start ${range===id?"is-active":""}`},label));
        const controls=React.createElement("div",{className:"flex gap-2 mt-4 overflow-x-auto pb-1 snap-x snap-mandatory",role:"tablist","aria-label":"圖表期間"},rangeButtons);
        const noteText=mode==='IB'?'IB 主策略仍是預設與核心績效；FT、複委託資料不參與任何策略訊號或交易計算。':mode==='FT'?'FT 只使用你輸入的 Total Account Value 快照，不追蹤短線持股明細。':mode==='SUB'?(portfolio.subAccount.holdingMode?`複委託以 ${portfolio.subAccount.symbol} 股數、股價與現金自動估值。`:'複委託尚未設定單一股票，暫時使用手動淨值。'):'全部股票資產為 IB、FT、複委託、台股與其他資產加總；已記錄的資金流會從損益中扣除。';
        const note=React.createElement("div",{className:"mt-3 text-[10px] font-bold text-white/40 leading-relaxed"},`${noteText}｜目前統一以 ${historyCurrency==="TWD"?"新台幣":"美元"} 顯示，可用頁首 US$／NT$ 鍵切換。`);
        return React.createElement(Card,{className:"history-performance-card p-5 mb-4 overflow-hidden text-white"},header,summary,chartBox,controls,note);
    };
    const CalendarCard = ({logs}) => {
        const [yearText,monthText]=calendarMonth.split('-');
        const year=Number(yearText),month=Number(monthText);
        const firstDay=new Date(year,month-1,1,12);
        const daysInMonth=new Date(year,month,0,12).getDate();
        const startOffset=firstDay.getDay();
        const snapshots=(Array.isArray(data.portfolioHistory)?data.portfolioHistory:[]).filter(x=>x.date&&getNum(x.strategyUsd)>0).slice().sort((a,b)=>xdate(a).localeCompare(xdate(b)));
        function xdate(x){return String(x?.date||'').slice(0,10);}
        const snapshotByDate=new Map(snapshots.map(x=>[xdate(x),x]));
        const eventsByDate=new Map();
        (Array.isArray(logs)?logs:[]).forEach(r=>{const d=recordDateText(r);if(!d)return;const arr=eventsByDate.get(d)||[];arr.push(r);eventsByDate.set(d,arr);});
        const getPreviousSnapshot=date=>snapshots.filter(x=>xdate(x)<date).slice(-1)[0]||null;
        const monthPoints=snapshots.filter(x=>xdate(x).startsWith(calendarMonth));
        const monthFirst=monthPoints[0]||null,monthLast=monthPoints[monthPoints.length-1]||null;
        const monthStartValue=monthFirst?(getPreviousSnapshot(xdate(monthFirst))?.strategyUsd||monthFirst.strategyUsd):0;
        const monthFlows=(Array.isArray(logs)?logs:[]).filter(r=>r.recordType==='cashflow'&&String(r.cashflowDate||r.executionDate||'').startsWith(calendarMonth)).reduce((sum,r)=>sum+(r.cashflowType==='withdrawal'?-1:1)*Math.abs(getNum(r.cashflowAmountUsd)),0);
        const monthProfit=monthLast?getNum(monthLast.strategyUsd)-getNum(monthStartValue)-monthFlows:0;
        const flowForDate=date=>(Array.isArray(logs)?logs:[]).filter(r=>r.recordType==='cashflow'&&String(r.cashflowDate||r.executionDate||'').slice(0,10)===date).reduce((sum,r)=>sum+(r.cashflowType==='withdrawal'?-1:1)*Math.abs(getNum(r.cashflowAmountUsd)),0);
        let positiveDays=0,negativeDays=0;
        monthPoints.forEach(x=>{const date=xdate(x),prev=getPreviousSnapshot(date);if(!prev)return;const d=getNum(x.strategyUsd)-getNum(prev.strategyUsd)-flowForDate(date);if(d>0)positiveDays++;else if(d<0)negativeDays++;});
        const moveMonth=delta=>{const d=new Date(year,month-1+delta,1,12);setCalendarMonth(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`);setSelectedCalendarDay('');};
        const cells=[];
        ['日','一','二','三','四','五','六'].forEach(label=>cells.push(React.createElement('div',{key:`w-${label}`,className:'text-center text-[10px] font-black text-slate-400 py-1'},label)));
        for(let i=0;i<startOffset;i++)cells.push(React.createElement('div',{key:`empty-${i}`,className:'calendar-day is-empty'}));
        for(let day=1;day<=daysInMonth;day++){
            const date=`${calendarMonth}-${String(day).padStart(2,'0')}`;
            const snap=snapshotByDate.get(date);const prev=getPreviousSnapshot(date);const events=eventsByDate.get(date)||[];
            const dayFlow=events.filter(r=>r.recordType==='cashflow').reduce((sum,r)=>sum+(r.cashflowType==='withdrawal'?-1:1)*Math.abs(getNum(r.cashflowAmountUsd)),0);
            const delta=snap&&prev?getNum(snap.strategyUsd)-getNum(prev.strategyUsd)-dayFlow:0;const pctValue=snap&&prev&&getNum(prev.strategyUsd)>0?delta/getNum(prev.strategyUsd):0;
            const hasExec=events.some(r=>r.recordType==='execution'||r.recordType==='manual_hot_cycle');const hasFlow=events.some(r=>r.recordType==='cashflow');
            const cls=`calendar-day ${delta>0?'is-positive':delta<0?'is-negative':''} ${selectedCalendarDay===date?'is-selected':''}`;
            cells.push(React.createElement('button',{key:date,className:cls,onClick:()=>setSelectedCalendarDay(date)},
                React.createElement('div',{className:'flex justify-between items-start'},React.createElement('span',{className:'text-xs font-black text-slate-700'},day),React.createElement('span',{className:'calendar-dots'},hasExec&&React.createElement('i',{className:'calendar-dot exec'}),hasFlow&&React.createElement('i',{className:'calendar-dot flow'}),snap&&React.createElement('i',{className:'calendar-dot snapshot'}))),
                snap?React.createElement('div',{className:`text-[9px] font-black privacy-value ${delta>0?'text-emerald-700':delta<0?'text-red-700':'text-slate-400'}`},prev?`${pctValue>=0?'+':''}${(pctValue*100).toFixed(1)}%`:'快照'):React.createElement('div',{className:'text-[9px] text-slate-300'},'—')));
        }
        return React.createElement(Card,{className:'p-5 mb-4'},
            React.createElement('div',{className:'flex items-center justify-between gap-3'},
                React.createElement('button',{onClick:()=>moveMonth(-1),className:'w-10 h-10 rounded-full bg-slate-100 font-black text-slate-600'},'‹'),
                React.createElement('div',{className:'text-center'},React.createElement('div',{className:'text-[10px] font-black tracking-[.15em] text-brand-600'},'每日損益月曆'),React.createElement('div',{className:'text-xl font-black text-slate-950 mt-1'},`${year} 年 ${month} 月`)),
                React.createElement('button',{onClick:()=>moveMonth(1),className:'w-10 h-10 rounded-full bg-slate-100 font-black text-slate-600'},'›')),
            React.createElement('div',{className:'grid grid-cols-3 gap-2 mt-4'},
                React.createElement('div',{className:'rounded-2xl bg-slate-950 text-white p-3'},React.createElement('div',{className:'text-[9px] font-black text-white/55'},'本月損益'),React.createElement('div',{className:`mt-1 font-mono font-black privacy-value ${monthProfit>=0?'text-emerald-300':'text-red-300'}`},monthLast?`${monthProfit>=0?'+':'-'}$${money(Math.abs(monthProfit),0)}`:'累積中')),
                React.createElement('div',{className:'rounded-2xl bg-emerald-50 p-3'},React.createElement('div',{className:'text-[9px] font-black text-emerald-600'},'正報酬日'),React.createElement('div',{className:'mt-1 text-xl font-black text-emerald-800'},positiveDays)),
                React.createElement('div',{className:'rounded-2xl bg-red-50 p-3'},React.createElement('div',{className:'text-[9px] font-black text-red-600'},'負報酬日'),React.createElement('div',{className:'mt-1 text-xl font-black text-red-800'},negativeDays))),
            React.createElement('div',{className:'calendar-grid mt-4'},cells),
            React.createElement('div',{className:'mt-3 text-[10px] font-bold text-slate-400 leading-relaxed'},'藍點＝策略執行；黃點＝入金／出金；灰點＝每日資產快照。點日期查看當日明細。'));
    };
    const clearAllLogs = async () => {
        const logs=Array.isArray(data.history)?data.history:[];
        if(!logs.length){showToast('目前沒有紀錄');return;}
        if(!confirm(`確定隱藏全部 ${logs.length} 筆紀錄？雲端會保留刪除標記。`))return;
        setData(prev=>({...prev,history:[]})); setCommittedData(prev=>({...prev,history:[]}));
        try{localStorage.setItem(LOCAL_KEY+'_committed',JSON.stringify({...committedData,history:[]}));}catch(e){}
        if(recordsRef()) { try { for(let i=0;i<logs.length;i+=400){const batch=db.batch();logs.slice(i,i+400).forEach(r=>batch.set(recordsRef().doc(r.recordId),{deletedAt:new Date().toISOString(),updatedAt:firebase.firestore.FieldValue.serverTimestamp()},{merge:true}));await batch.commit();} } catch(e){showToast('本機已清空，部分雲端標記失敗');return;} }
        showToast('已隱藏全部紀錄');
    };
    const recordDateText = h => h.executionDate || h.signalDate || h.marketDate || String(h.createdAt || h.time || '').slice(0,10) || '';
    const recordYear = h => String(recordDateText(h)).slice(0,4) || '未分類';
    const recordMonth = h => String(recordDateText(h)).slice(5,7) || '00';
    const allLogs = (Array.isArray(data.history) ? data.history : []).slice().sort((a,b)=>String(b.createdAt||b.time||'').localeCompare(String(a.createdAt||a.time||'')));
    const performance = useMemo(()=>{
        const asc=allLogs.slice().sort((a,b)=>String(a.executionDate||a.createdAt).localeCompare(String(b.executionDate||b.createdAt)));
        const valuations=asc.filter(r=>r.recordType!=='cashflow'&&getNum(r.totalUsd)>0);
        if(valuations.length<2)return {ready:false,netFlow:0,profit:0,returnPct:0,start:0,end:0};
        const first=valuations[0],last=valuations[valuations.length-1],start=getNum(first.totalUsd),end=getNum(last.totalUsd);
        const startDate=parseDateLocal(first.executionDate||String(first.createdAt).slice(0,10)),endDate=parseDateLocal(last.executionDate||String(last.createdAt).slice(0,10));
        const totalDays=Math.max(1,(endDate-startDate)/86400000);
        let netFlow=0,weightedFlow=0;
        asc.filter(r=>r.recordType==='cashflow').forEach(r=>{const signed=(r.cashflowType==='withdrawal'?-1:1)*Math.abs(getNum(r.cashflowAmountUsd));const d=parseDateLocal(r.cashflowDate||r.executionDate);if(!d||d<startDate||d>endDate)return;netFlow+=signed;const weight=Math.max(0,Math.min(1,(endDate-d)/86400000/totalDays));weightedFlow+=signed*weight;});
        const profit=end-start-netFlow,den=start+weightedFlow; return {ready:true,start,end,netFlow,profit,returnPct:den!==0?profit/den:0};
    },[allLogs]);
    const availableYears = [...new Set(allLogs.map(recordYear))].sort((a,b)=>b.localeCompare(a));
    const availableMonths = [...new Set(allLogs.filter(h=>logYearFilter==='all'||recordYear(h)===logYearFilter).map(recordMonth))].sort((a,b)=>b.localeCompare(a));
    const filteredLogs = allLogs.filter(h => {
        if(logKindFilter !== 'all' && h.kind !== logKindFilter) return false;
        if(logSignalFilter !== 'all' && !String(h.signal || '').includes(logSignalFilter)) return false;
        if(logYearFilter !== 'all' && recordYear(h) !== logYearFilter) return false;
        if(logMonthFilter !== 'all' && recordMonth(h) !== logMonthFilter) return false;
        const q=String(logSearch||'').trim().toLowerCase();
        if(q){
            const hay=[h.signal,h.allocation,h.notes,...(Array.isArray(h.actions)?h.actions:[]),h.marketDate,h.executionDate].join(' ').toLowerCase();
            if(!hay.includes(q)) return false;
        }
        return true;
    });
    const groupedLogs = filteredLogs.reduce((acc,h)=>{
        const y=recordYear(h), m=recordMonth(h), key=`${y}-${m}`;
        if(!acc[key]) acc[key]={key,year:y,month:m,logs:[]};
        acc[key].logs.push(h); return acc;
    },{});
    const logGroups = Object.values(groupedLogs).sort((a,b)=>b.key.localeCompare(a.key));
    const toggleLogGroup = key => setOpenLogGroups(prev=>({...prev,[key]:prev[key]===undefined ? false : !prev[key]}));
    const isLogGroupOpen = (key,index) => openLogGroups[key]===undefined ? index===0 : openLogGroups[key];
    const downloadTextFile = (filename,text,type='application/json') => {
        const blob=new Blob([text],{type:`${type};charset=utf-8`}); const url=URL.createObjectURL(blob); const a=document.createElement('a');
        a.href=url; a.download=filename; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),1000);
    };
    const exportRecordsJson = async () => {
        try{showToast('正在整理完整備份…');const records=await fetchAllCloudRecords();const {history:_history,...currentState}=normalizeData(data);const payload={exportSchemaVersion:2,exportedAt:new Date().toISOString(),strategyId:STRATEGY_ID,recordCount:records.length,currentState,records};downloadTextFile(`tqqq-full-backup-${todayStr()}.json`,JSON.stringify(payload,null,2));showToast(`已完整備份 ${records.length} 筆紀錄與目前狀態`);}catch(e){showToast('備份失敗：'+e.message);}
    };
    const createBackupCard = async () => {
        try{
            showToast('正在建立本機備份…');
            const records=await fetchAllCloudRecords();
            const {history:_history,...currentState}=normalizeData(data);
            const payload={exportSchemaVersion:3,exportedAt:new Date().toISOString(),strategyId:STRATEGY_ID,strategyVersion:STRATEGY_VERSION,recordCount:records.length,currentState,records};
            const card={id:`backup-${Date.now()}`,createdAt:payload.exportedAt,strategyVersion:STRATEGY_VERSION,recordCount:records.length,strategyUsd:getNum(metrics.totalUsd),totalTwd:getNum(portfolio.totalTwd),payload};
            const next=[card,...backupCards].slice(0,5);
            try{writeBackupCards(next);}catch(e){
                const smaller=[card,...backupCards].slice(0,3);writeBackupCards(smaller);setBackupCards(smaller);showToast('備份已建立；因手機空間限制只保留最近 3 份');return;
            }
            setBackupCards(next);showToast('已建立備份卡片');
        }catch(e){showToast('建立備份失敗：'+e.message);}
    };
    const downloadBackupCard = card => {
        if(!card?.payload)return;
        downloadTextFile(`tqqq-backup-${String(card.createdAt||todayStr()).slice(0,10)}.json`,JSON.stringify(card.payload,null,2));
        showToast('備份已下載');
    };
    const restoreBackupCard = async card => {
        if(!card?.payload)return;
        const records=(Array.isArray(card.payload.records)?card.payload.records:[]).map(normalizeRecord).filter(r=>!r.deletedAt);
        if(!confirm(`確定完整還原 ${new Date(card.createdAt).toLocaleString('zh-TW')} 的備份？

目前正式策略狀態與雲端歷史紀錄會被替換成備份內的 ${records.length} 筆紀錄。此操作不會刪除本機其他備份卡片。`))return;
        try{
            const next=normalizeData({...card.payload.currentState,history:records});
            if(recordsRef()){
                for(let pageNo=0;pageNo<1000;pageNo++){
                    const snap=await recordsRef().limit(400).get();
                    if(snap.empty)break;
                    const batch=db.batch();snap.docs.forEach(d=>batch.delete(d.ref));await batch.commit();
                    if(snap.docs.length<400)break;
                }
                for(let i=0;i<records.length;i+=400){const batch=db.batch();records.slice(i,i+400).forEach(r=>batch.set(recordsRef().doc(r.recordId),sanitize(r),{merge:true}));await batch.commit();}
                if(docRef())await docRef().set({history:firebase.firestore.FieldValue.delete()},{merge:true});
            }
            setData(next);setCommittedData(next);localStorage.setItem(LOCAL_KEY,JSON.stringify(next));localStorage.setItem(LOCAL_KEY+'_committed',JSON.stringify(next));
            setRecordsCursor(null);setRecordsHasMore(records.length>200);
            await saveFormalData(next,'已完整還原備份卡片');
            showToast('備份完整還原完成');
        }catch(e){showToast('還原失敗：'+e.message);}
    };
    const deleteBackupCard = card => {
        if(!confirm('刪除這份本機備份卡片？已下載的 JSON 不受影響。'))return;
        const next=backupCards.filter(x=>x.id!==card.id);writeBackupCards(next);setBackupCards(next);showToast('備份卡片已刪除');
    };
    const csvCell = v => `"${String(v??'').replace(/"/g,'""')}"`;
    const exportRecordsCsv = async () => {
        try{showToast('正在整理完整 CSV…');const records=await fetchAllCloudRecords();const header=['執行日','行情日','類型','訊號','配置','總資產USD','資金流類型','資金流USD','SPY','QQQ','TQQQ','SPYI','QQQI','TQQQ股數','QQQ股數','SPY股數','SPYI股數','QQQI股數','現金USD','HOT','DCA進度','備註'];const rows=records.map(h=>[h.executionDate||'',h.marketDate||'',h.recordType||h.kind||'',h.signal||'',h.allocation||'',h.totalUsd||0,h.cashflowType||'',h.cashflowAmountUsd||0,h.spy||0,h.qqq||0,h.tqqq||0,h.spyi||0,h.qqqi||0,h.shares?.TQQQ||0,h.shares?.QQQ||0,h.shares?.SPY||0,h.shares?.SPYI||0,h.shares?.QQQI||0,h.shares?.cashUsd||0,h.hotRank||0,h.dcaCompleted||0,h.notes||'']);downloadTextFile(`tqqq-records-${todayStr()}.csv`,'\ufeff'+[header,...rows].map(r=>r.map(csvCell).join(',')).join('\n'),'text/csv');showToast(`已匯出完整 ${records.length} 筆 CSV`);}catch(e){showToast('CSV 匯出失敗：'+e.message);}
    };
    const recordPositionAsset = h => {
        const preferred=String(h.state?.hotAsset||h.hotAsset||'QQQ').toUpperCase();
        const after=h.afterShares||h.shares||{};
        const candidates=['QQQ','SPY','SPYI','QQQI'];
        const nonzero=candidates.find(a=>getNum(after[a])>0);
        if(String(h.state?.strategyPhase||'').toUpperCase()!=='ACTIVE' || h.state?.dcaActive) return nonzero||'QQQ';
        return candidates.includes(preferred)?preferred:(nonzero||'QQQ');
    };
    const LogItem = ({h,i}) => React.createElement("div", { key: h.recordId || h.time || i, className: "border border-slate-100 rounded-2xl p-3 bg-slate-50" },
        React.createElement("div", { className: "flex justify-between gap-2 items-start" },
            React.createElement("div", null,
                React.createElement("div", { className: "font-black text-slate-900" }, h.signal),
                React.createElement("div", { className: "text-[11px] text-slate-400 font-bold" }, h.timeText, "｜行情日 ", h.marketDate || '-')),
            React.createElement("div", { className: "text-right" },
                React.createElement("div", { className: "font-mono font-black text-slate-900 privacy-value" }, h.totalDisplay || ('$' + money(h.totalUsd, 2))),
                React.createElement("button", { onClick: () => deleteLog(h), className: `mt-1 px-2 py-1 rounded-lg text-[10px] font-black active:scale-95 ${h.recordType==='cashflow'?'bg-slate-100 text-slate-500':'bg-red-50 text-red-700'}` }, h.recordType==='cashflow'?'需反向沖銷':'刪除'))),
        React.createElement("div", { className: "mt-2 flex flex-wrap gap-2" },
            h.recordType==='cashflow' ? React.createElement(Pill, { tone:h.cashflowType==='withdrawal'?'red':'green' }, `${h.cashflowType==='withdrawal'?'出金':'入金'} $${money(h.cashflowAmountUsd,2)}`) : null,
            React.createElement(Pill, { tone: "blue" }, h.allocation || '-'),
            React.createElement(Pill, null, `${recordPositionAsset(h)} $${money(recordPositionAsset(h)==='QQQ'?h.qqq:recordPositionAsset(h)==='SPY'?h.spy:recordPositionAsset(h)==='SPYI'?h.spyi:h.qqqi, 2)}`),
            React.createElement(Pill, null, "TQQQ $", money(h.tqqq, 2))),
        React.createElement("div", { className: "mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2" },
            React.createElement("div", { className: "bg-white rounded-xl p-2" }, React.createElement("div", { className: "text-[10px] font-black text-slate-400" }, "TQQQ 股數"), React.createElement("div", { className: "font-mono text-xs font-black privacy-value" }, money(h.shares?.TQQQ, 4))),
            React.createElement("div", { className: "bg-white rounded-xl p-2" }, React.createElement("div", { className: "text-[10px] font-black text-slate-400" }, `${recordPositionAsset(h)} 股數`), React.createElement("div", { className: "font-mono text-xs font-black privacy-value" }, money(h.shares?.[recordPositionAsset(h)], 4))),
            React.createElement("div", { className: "bg-white rounded-xl p-2" }, React.createElement("div", { className: "text-[10px] font-black text-slate-400" }, "現金 USD"), React.createElement("div", { className: "font-mono text-xs font-black privacy-value" }, "$", money(h.shares?.cashUsd, 0)))),
        h.beforeShares && h.afterShares ? React.createElement("div", { className:"mt-2 bg-white border border-slate-100 rounded-2xl p-3" },
            React.createElement("div", { className:"text-[10px] font-black text-slate-500 mb-2" }, "執行前 → 執行後"),
            React.createElement("div", { className:"grid grid-cols-1 sm:grid-cols-2 gap-2" }, ["TQQQ",recordPositionAsset(h),"cashUsd"].filter((v,i,a)=>a.indexOf(v)===i).map(k => { const names={TQQQ:'TQQQ',QQQ:'QQQ',SPY:'SPY',SPYI:'SPYI',QQQI:'QQQI',cashUsd:'現金 USD'}; const b=getNum(h.beforeShares[k]); const a=getNum(h.afterShares[k]); const d=a-b; return React.createElement("div", { key:k, className:"flex justify-between gap-2 text-xs font-bold" }, React.createElement("span", { className:"text-slate-500" }, names[k]), React.createElement("span", { className:"font-mono text-slate-900 privacy-value" }, money(b,4), " → ", money(a,4), d!==0 ? `（${d>0?'+':''}${money(d,4)}）` : '')); }))) : null,
        h.actions && h.actions.length ? React.createElement("div", { className: "mt-2 text-xs text-slate-500 font-bold leading-relaxed" }, h.actions.map((a, ai) => React.createElement("div", { key: ai }, "・", a))) : null,
        h.notes && React.createElement("div", { className: "mt-2 text-xs text-slate-500 font-bold leading-relaxed bg-white rounded-xl p-2" }, "備註：", h.notes));
    const Logs = () => React.createElement("main", { className: "logs-page max-w-5xl mx-auto px-4 pt-5 content-bottom-space" },
        React.createElement(Card, { className: "p-4" },
            React.createElement(SectionTitle, { title: "IB 策略紀錄", desc: `共 ${allLogs.length} 筆；只統計 IB 策略帳戶，FT／複委託／台股不影響策略績效。` }),
            React.createElement(ProfitChart, { logs: allLogs, range:chartRange, mode:chartMode, onRange:setChartRange, onMode:setChartMode }),
            React.createElement(CalendarCard, { logs: allLogs }),
            React.createElement("div", {className:"grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4"},
                React.createElement("div",{className:"bg-slate-50 rounded-2xl p-3"},React.createElement("div",{className:"text-[10px] font-black text-slate-500"},"淨入金"),React.createElement("div",{className:"font-mono font-black privacy-value"},`${performance.netFlow>=0?'+':''}$${money(performance.netFlow,0)}`)),
                React.createElement("div",{className:"bg-slate-50 rounded-2xl p-3"},React.createElement("div",{className:"text-[10px] font-black text-slate-500"},"扣除資金流損益"),React.createElement("div",{className:`font-mono font-black privacy-value ${performance.profit>=0?'text-emerald-700':'text-red-700'}`},performance.ready?`${performance.profit>=0?'+':''}$${money(performance.profit,0)}`:'-')),
                React.createElement("div",{className:"bg-slate-50 rounded-2xl p-3"},React.createElement("div",{className:"text-[10px] font-black text-slate-500"},recordsHasMore?"Modified Dietz（部分）":"Modified Dietz"),React.createElement("div",{className:`font-mono font-black privacy-value ${performance.returnPct>=0?'text-emerald-700':'text-red-700'}`},performance.ready?pct(performance.returnPct,2):'-')),
                React.createElement("div",{className:"bg-slate-50 rounded-2xl p-3"},React.createElement("div",{className:"text-[10px] font-black text-slate-500"},"已載入紀錄"),React.createElement("div",{className:"font-mono font-black"},allLogs.length))),
            React.createElement("button", { onClick:()=>setShowMonthSheet(true), className:"settings-row w-full mb-3 text-left" },
                React.createElement("span", { className:"settings-icon text-slate-600" }, "▣"),
                React.createElement("span", { className:"flex-1 min-w-0" },
                    React.createElement("span", { className:"block text-[17px] font-black text-slate-900" }, "跳到指定月份"),
                    React.createElement("span", { className:"block text-xs font-bold text-slate-500 mt-1" }, logYearFilter==='all'&&logMonthFilter==='all'?'目前顯示全部紀錄':`${logYearFilter==='all'?'全部年份':logYearFilter+' 年'}｜${logMonthFilter==='all'?'全部月份':Number(logMonthFilter)+' 月'}｜${filteredLogs.length} 筆`)),
                React.createElement("span", { className:"text-2xl font-light text-slate-400" }, "›")),
            React.createElement("div", { className:"grid grid-cols-2 sm:grid-cols-5 gap-2 mb-3" },
                React.createElement("select", { value:logYearFilter, onChange:e=>{setLogYearFilter(e.target.value);setLogMonthFilter('all');}, className:"bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-black" }, React.createElement("option", { value:"all" }, "全部年份"), availableYears.map(y=>React.createElement("option",{key:y,value:y},`${y} 年`))),
                React.createElement("select", { value:logMonthFilter, onChange:e=>setLogMonthFilter(e.target.value), className:"bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-black" }, React.createElement("option", { value:"all" }, "全部月份"), availableMonths.map(m=>React.createElement("option",{key:m,value:m},`${Number(m)} 月`))),
                React.createElement("select", { value:logKindFilter, onChange:e=>setLogKindFilter(e.target.value), className:"bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-black" }, React.createElement("option", { value:"all" }, "全部類型"), React.createElement("option", { value:"execution" }, "已執行"), React.createElement("option", { value:"snapshot" }, "僅記錄"), React.createElement("option", { value:"cashflow" }, "入金／出金")),
                React.createElement("select", { value:logSignalFilter, onChange:e=>setLogSignalFilter(e.target.value), className:"bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-black" }, React.createElement("option", { value:"all" }, "全部訊號"), React.createElement("option", { value:"Risk-On" }, "Risk-On"), React.createElement("option", { value:"Risk-Off" }, "Risk-Off"), React.createElement("option", { value:"過熱" }, "過熱"), React.createElement("option", { value:"中間區" }, "中間區")),
                React.createElement("input", { value:logSearch, onChange:e=>setLogSearch(e.target.value), placeholder:"搜尋備註／動作", className:"col-span-2 sm:col-span-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold", style:{fontSize:'16px'} })),
            React.createElement("div", {className:"flex justify-between items-center mb-3 text-xs font-bold text-slate-500"},
                React.createElement("span",null,`顯示 ${filteredLogs.length} 筆，共 ${logGroups.length} 個月份`),
                React.createElement("button",{onClick:clearAllLogs,className:"text-red-600 font-black"},"隱藏全部")),
            filteredLogs.length === 0 && React.createElement("div", { className: "text-sm text-slate-600 font-bold text-center py-8" }, "沒有符合條件的紀錄"),
            React.createElement("div", {className:"space-y-3"}, logGroups.map((g,gi)=>{
                const open=isLogGroupOpen(g.key,gi); const monthTotal=g.logs.length;
                const valuationLogs=g.logs.filter(r=>r.recordType!=='cashflow'&&getNum(r.totalUsd)>0);
                const latest=valuationLogs[0]||g.logs[0], oldest=valuationLogs[valuationLogs.length-1]||g.logs[g.logs.length-1];
                const oldDate=String(oldest?.executionDate||oldest?.createdAt||''), newDate=String(latest?.executionDate||latest?.createdAt||'');
                const monthFlow=g.logs.filter(r=>r.recordType==='cashflow'&&String(r.cashflowDate||r.executionDate||'')>oldDate&&String(r.cashflowDate||r.executionDate||'')<=newDate).reduce((sum,r)=>sum+(r.cashflowType==='withdrawal'?-1:1)*Math.abs(getNum(r.cashflowAmountUsd)),0);
                const delta=valuationLogs.length>=2?getNum(latest.totalUsd)-getNum(oldest.totalUsd)-monthFlow:null;
                return React.createElement("section",{key:g.key,className:"border border-slate-200 rounded-2xl overflow-hidden bg-white"},
                    React.createElement("button",{type:"button",onClick:()=>toggleLogGroup(g.key),className:"w-full p-3 flex items-center justify-between gap-3 text-left bg-slate-50"},
                        React.createElement("div",null,React.createElement("div",{className:"font-black text-slate-900"},`${g.year} 年 ${Number(g.month)} 月`),React.createElement("div",{className:"text-[11px] font-bold text-slate-400 mt-1"},`${monthTotal} 筆紀錄｜月底資產 ${latest?.totalDisplay||('$'+money(latest?.totalUsd,0))}｜已扣資金流`)),
                        React.createElement("div",{className:"text-right"},React.createElement(Pill,{tone:delta==null?'slate':delta>=0?'green':'red'},delta==null?'樣本不足':`${delta>=0?'+':''}$${money(delta,0)}`),React.createElement("div",{className:"text-[10px] font-black text-slate-400 mt-1"},open?'收合':'展開'))),
                    open && React.createElement("div",{className:"p-3 space-y-3"},g.logs.map((h,i)=>React.createElement(LogItem,{key:h.recordId||i,h,i}))));
            })),
            recordsHasMore && React.createElement("div",{className:"grid grid-cols-2 gap-2 mt-4"},React.createElement("button",{onClick:loadMoreRecords,disabled:loadingMoreRecords,className:"py-3 rounded-2xl bg-slate-100 text-slate-700 font-black disabled:opacity-50"},loadingMoreRecords?'載入中…':'載入更早 200 筆'),React.createElement("button",{onClick:loadAllRecords,disabled:loadingMoreRecords,className:"py-3 rounded-2xl bg-slate-900 text-white font-black disabled:opacity-50"},"載入全部歷史"))));
    const MonthSheet = () => {
        if(!showMonthSheet) return null;
        const yearForGrid=logYearFilter==='all'?(availableYears[0]||String(new Date().getFullYear())):logYearFilter;
        const years=availableYears.length?availableYears:[String(new Date().getFullYear())];
        return React.createElement("div", { className:"fixed inset-0 z-[70] sheet-backdrop sheet-animate-backdrop flex items-end sm:items-center justify-center p-3", onClick:()=>setShowMonthSheet(false) },
            React.createElement("div", { className:"sheet-panel w-full max-w-md rounded-[34px] bg-white/95 border border-white shadow-2xl p-5 safe-bottom", onClick:e=>e.stopPropagation() },
                React.createElement("div", { className:"mx-auto w-12 h-1.5 rounded-full bg-slate-200 mb-5" }),
                React.createElement("div", { className:"flex items-start justify-between gap-3" },
                    React.createElement("div", null,
                        React.createElement("div", { className:"text-2xl font-black text-slate-950" }, "跳到指定月份"),
                        React.createElement("div", { className:"text-sm font-bold text-slate-500 mt-1" }, "選擇年份與月份")),
                    React.createElement("button", { onClick:()=>setShowMonthSheet(false), className:"w-12 h-12 rounded-full bg-slate-100 text-2xl text-slate-500" }, "×")),
                React.createElement("div", { className:"mt-5 flex items-center justify-between border-b border-slate-200 pb-3" },
                    React.createElement("span", { className:"text-sm font-black text-slate-500" }, "年份"),
                    React.createElement("select", { value:yearForGrid, onChange:e=>{setLogYearFilter(e.target.value);setLogMonthFilter('all');}, className:"bg-transparent text-xl font-black text-slate-950 text-right" }, years.map(y=>React.createElement("option", { key:y, value:y }, `${y} 年`)))),
                React.createElement("div", { className:"grid grid-cols-4 gap-3 mt-5" }, [1,2,3,4,5,6,7,8,9,10,11,12].map(m=>{
                    const mm=String(m).padStart(2,'0');
                    const count=allLogs.filter(h=>recordYear(h)===yearForGrid&&recordMonth(h)===mm).length;
                    const active=logYearFilter===yearForGrid&&logMonthFilter===mm;
                    return React.createElement("button", { key:mm, disabled:count===0, onClick:()=>{setLogYearFilter(yearForGrid);setLogMonthFilter(mm);setShowMonthSheet(false);}, className:`min-h-[72px] rounded-[22px] border text-center ${active?'bg-emerald-100 border-emerald-300 text-emerald-800':count?'bg-slate-50 border-slate-100 text-slate-700':'bg-slate-50 border-slate-100 text-slate-500'}` },
                        React.createElement("div", { className:"text-base font-black" }, `${m} 月`),
                        React.createElement("div", { className:"text-[10px] font-bold mt-1 opacity-80" }, count?`${count} 筆`:'無紀錄'));
                })),
                React.createElement("button", { onClick:()=>{setLogYearFilter('all');setLogMonthFilter('all');setShowMonthSheet(false);}, className:"w-full mt-5 py-4 rounded-[22px] bg-slate-950 text-white font-black" }, "顯示全部紀錄")));
    };

    const CalendarDaySheet = () => {
        if(!selectedCalendarDay)return null;
        const snapshots=(Array.isArray(data.portfolioHistory)?data.portfolioHistory:[]).filter(x=>x.date&&getNum(x.strategyUsd)>0).slice().sort((a,b)=>String(a.date).localeCompare(String(b.date)));
        const snap=snapshots.find(x=>String(x.date).slice(0,10)===selectedCalendarDay)||null;
        const prev=snapshots.filter(x=>String(x.date).slice(0,10)<selectedCalendarDay).slice(-1)[0]||null;
        const events=allLogs.filter(r=>recordDateText(r)===selectedCalendarDay);
        const dayFlow=events.filter(r=>r.recordType==='cashflow').reduce((sum,r)=>sum+(r.cashflowType==='withdrawal'?-1:1)*Math.abs(getNum(r.cashflowAmountUsd)),0);
        const delta=snap&&prev?getNum(snap.strategyUsd)-getNum(prev.strategyUsd)-dayFlow:0;
        const pctValue=snap&&prev&&getNum(prev.strategyUsd)>0?delta/getNum(prev.strategyUsd):0;
        return React.createElement("div",{className:"fixed inset-0 z-[78] sheet-backdrop sheet-animate-backdrop flex items-end justify-center p-3",onClick:()=>setSelectedCalendarDay('')},
            React.createElement("div",{className:"sheet-panel w-full max-w-md max-h-[86vh] overflow-auto rounded-[34px] bg-white p-5 safe-bottom shadow-2xl",onClick:e=>e.stopPropagation()},
                React.createElement("div",{className:"mx-auto w-12 h-1.5 rounded-full bg-slate-200 mb-5"}),
                React.createElement("div",{className:"flex justify-between items-start gap-3"},
                    React.createElement("div",null,React.createElement("div",{className:"text-[10px] font-black tracking-[.15em] text-brand-600"},"每日資產明細"),React.createElement("div",{className:"text-2xl font-black text-slate-950 mt-1"},selectedCalendarDay)),
                    React.createElement("button",{onClick:()=>setSelectedCalendarDay(''),className:"w-11 h-11 rounded-full bg-slate-100 text-xl text-slate-500"},"×")),
                React.createElement("div",{className:"grid grid-cols-2 gap-3 mt-5"},
                    React.createElement("div",{className:"rounded-[24px] bg-slate-950 text-white p-4"},React.createElement("div",{className:"text-[10px] font-black text-white/55"},"IB 策略資產"),React.createElement("div",{className:"mt-2 text-xl font-black privacy-value"},snap?`US$ ${money(snap.strategyUsd,2)}`:"無快照")),
                    React.createElement("div",{className:`rounded-[24px] p-4 ${delta>=0?'bg-emerald-50':'bg-red-50'}`},React.createElement("div",{className:`text-[10px] font-black ${delta>=0?'text-emerald-600':'text-red-600'}`},"較前一筆"),React.createElement("div",{className:`mt-2 text-xl font-black privacy-value ${delta>=0?'text-emerald-800':'text-red-800'}`},snap&&prev?`${delta>=0?'+':'-'}$${money(Math.abs(delta),2)}`:"—"),React.createElement("div",{className:"text-[10px] font-bold text-slate-500 mt-1"},snap&&prev?signedPctText(pctValue*100,2):"需要前一筆快照"))),
                React.createElement("div",{className:"mt-5 text-sm font-black text-slate-900"},`當日事件 ${events.length} 筆`),
                React.createElement("div",{className:"space-y-2 mt-3"},events.length?events.map((r,i)=>React.createElement("div",{key:r.recordId||i,className:"rounded-2xl bg-slate-50 border border-slate-100 p-3"},React.createElement("div",{className:"font-black text-slate-900"},r.signal||r.recordType),React.createElement("div",{className:"text-xs font-bold text-slate-500 mt-1"},r.allocation||r.todayAction||'-'))):React.createElement("div",{className:"rounded-2xl bg-slate-50 p-4 text-sm font-bold text-slate-400"},"當日沒有策略執行或入出金紀錄。"))));
    };

    const resetAllCloudData = async () => {
        if(!docRef() || !recordsRef()){showToast('請先使用 Google 登入');return;}
        const typed=prompt('這會永久刪除目前 Google 帳號的策略狀態與全部歷史紀錄，無法復原。\n\n請輸入「全部重置」繼續：','');
        if(typed!=='全部重置'){showToast('已取消重置');return;}
        if(!confirm('最後確認：確定永久刪除全部雲端資料與本機資料，重新從零開始？'))return;
        setResettingCloud(true); setSyncText('正在永久刪除全部雲端資料…');
        try{
            let deleted=0;
            for(let pageNo=0;pageNo<1000;pageNo++){
                const snap=await recordsRef().limit(400).get();
                if(snap.empty)break;
                const batch=db.batch(); snap.docs.forEach(d=>batch.delete(d.ref)); await batch.commit();
                deleted+=snap.docs.length; if(snap.docs.length<400)break;
            }
            await docRef().delete();
            localStorage.removeItem(LOCAL_KEY); localStorage.removeItem(LOCAL_KEY+'_committed');
            const fresh=normalizeData(DEFAULT); setData(fresh); setCommittedData(fresh);
            setRecordsCursor(null); setRecordsHasMore(false); setHasDraftChanges(false); draftChangesRef.current=false;
            setSyncText(`雲端已全部重置，共刪除 ${deleted} 筆歷史紀錄`); showToast('雲端與本機資料已全部重置'); setPage('home');
        }catch(e){setSyncText('重置失敗：'+e.message);showToast('重置失敗：'+e.message);}finally{setResettingCloud(false);}
    };
    const Sync = () => React.createElement("main", { className:"max-w-5xl mx-auto px-4 pt-5 content-bottom-space" },
        React.createElement(Card, { className:"p-6 mb-5 bg-gradient-to-br from-white/95 to-blue-50/80" },
            React.createElement("div", { className:"text-[11px] font-black tracking-[.2em] text-brand-600" }, "資料與同步"),
            React.createElement("div", { className:"mt-3 text-3xl font-black text-slate-950" }, user&&!user.isAnonymous?"Google 雲端已連線":"目前使用本機資料"),
            React.createElement("div", { className:"mt-2 text-sm font-bold text-slate-500 leading-relaxed" }, syncText),
            React.createElement("div", { className:"mt-5 rounded-[24px] bg-slate-950 text-white p-4" },
                React.createElement("div", { className:"text-[10px] font-black text-white/60" }, "資料位置"),
                React.createElement("div", { className:"mt-2 text-sm font-black break-all" }, "qldmax / strategyDashboards / tqqq-qqq200-main"),
                React.createElement("div", { className:"mt-2 text-xs font-bold text-white/60" }, `${allLogs.length} 筆已載入紀錄｜每頁最多 200 筆`))),
        React.createElement("div", { className:"space-y-3" },
            React.createElement("button", { onClick:manualSave, className:"settings-row w-full text-left" },
                React.createElement("span", { className:"settings-icon text-blue-600" }, "↥"),
                React.createElement("span", { className:"flex-1" }, React.createElement("span", { className:"block text-[17px] font-black text-slate-900" }, "手動同步正式資料"), React.createElement("span", { className:"block text-xs font-bold text-slate-500 mt-1" }, hasDraftChanges?"目前有草稿；同步會保存現況":"目前資料已正式保存")),
                React.createElement("span", { className:"text-2xl text-slate-400" }, "›")),
            React.createElement("button", { onClick:loginGoogle, className:"settings-row w-full text-left" },
                React.createElement("span", { className:"settings-icon text-emerald-600" }, "G"),
                React.createElement("span", { className:"flex-1" }, React.createElement("span", { className:"block text-[17px] font-black text-slate-900" }, user&&!user.isAnonymous?"重新確認 Google 帳號":"Google 登入"), React.createElement("span", { className:"block text-xs font-bold text-slate-500 mt-1" }, user&&!user.isAnonymous?"目前已可跨手機與網頁同步":"登入後才會跨裝置同步")),
                React.createElement("span", { className:`px-3 py-1.5 rounded-full text-xs font-black ${user&&!user.isAnonymous?'bg-emerald-100 text-emerald-700':'bg-slate-100 text-slate-500'}` }, user&&!user.isAnonymous?"已連線":"未登入")),
            React.createElement("button", { onClick:logout, className:"settings-row w-full text-left" },
                React.createElement("span", { className:"settings-icon text-slate-500" }, "◌"),
                React.createElement("span", { className:"flex-1" }, React.createElement("span", { className:"block text-[17px] font-black text-slate-900" }, "切回本機模式"), React.createElement("span", { className:"block text-xs font-bold text-slate-500 mt-1" }, "保留手機本機資料，不再讀取 Google 雲端")),
                React.createElement("span", { className:"text-2xl text-slate-400" }, "›"))),
        React.createElement("div", { className:"mt-8" },
            React.createElement("div", { className:"text-xs font-black tracking-[.15em] text-red-700 mb-3 ml-2" }, "系統維護"),
            React.createElement("button", { onClick:resetAllCloudData, disabled:resettingCloud||!user||user.isAnonymous, className:"settings-row w-full text-left disabled:opacity-40" },
                React.createElement("span", { className:"settings-icon text-red-600" }, "□"),
                React.createElement("span", { className:"flex-1" }, React.createElement("span", { className:"block text-[17px] font-black text-red-700" }, resettingCloud?"正在重置…":"重置全部雲端與本機資料"), React.createElement("span", { className:"block text-xs font-bold text-red-500 mt-1 leading-relaxed" }, "永久刪除正式策略狀態與全部紀錄；建議先備份 JSON")),
                React.createElement("span", { className:"text-2xl text-red-300" }, "›")))
    );
    const SettingsBack = useMemo(() => ({ title="返回設定" }) => React.createElement("div", { className:"max-w-5xl mx-auto px-4 pt-4" },
        React.createElement("button", { onClick:backToSettings, className:"inline-flex items-center gap-2 rounded-full bg-white/95 border border-white px-4 py-2.5 text-sm font-black text-slate-700 shadow-sm" }, "‹", title)), [backToSettings]);
    const SettingsPage = useMemo(() => ({eyebrow,title,desc,children}) => React.createElement("div",{className:"page-slide-from-right settings-input-stable"},
        React.createElement(SettingsBack,{title:"返回設定"}),
        React.createElement("main",{className:"max-w-5xl mx-auto px-4 pt-4 content-bottom-space"},
            React.createElement(Card,{className:"p-6 mb-4 bg-gradient-to-br from-white/94 to-indigo-50/80"},
                React.createElement("div",{className:"text-[10px] font-black tracking-[.18em] text-brand-600"},eyebrow),
                React.createElement("div",{className:"mt-2 text-3xl font-black text-slate-950"},title),
                desc&&React.createElement("div",{className:"mt-2 text-sm font-bold text-slate-500 leading-relaxed"},desc)),
            children)), [SettingsBack]);
    const MarketSettingsPage = () => React.createElement(SettingsPage,{eyebrow:"市場資料",title:"行情與 200SMA",desc:"更新 SPY、QQQ、TQQQ 與目前替代標的；200SMA 仍由你手動確認。"},
        React.createElement(Card,{className:"p-5"},
            React.createElement("div",{className:"grid grid-cols-1 sm:grid-cols-2 gap-3"},
                React.createElement(NumInput,{label:"SPY 收盤價",value:data.spy,onChange:v=>patch('spy',v)}),
                React.createElement(NumInput,{label:"SPY 200SMA",value:data.spySma,onChange:v=>patch('spySma',v)}),
                React.createElement(NumInput,{label:"QQQ 收盤價",value:data.qqq,onChange:v=>patch('qqq',v)}),
                React.createElement(NumInput,{label:"QQQ 200SMA",value:data.qqqSma,onChange:v=>patch('qqqSma',v)}),
                React.createElement(NumInput,{label:"TQQQ 價格",value:data.tqqq,onChange:v=>patch('tqqq',v)}),
                ['SPYI','QQQI'].includes(data.hotAsset)&&React.createElement(NumInput,{label:`${data.hotAsset} 價格`,value:data.hotAsset==='SPYI'?data.spyi:data.qqqi,onChange:v=>patch(data.hotAsset==='SPYI'?'spyi':'qqqi',v)})),
            React.createElement("div",{className:"grid grid-cols-2 gap-3 mt-4"},
                React.createElement("button",{onClick:fetchPrices,disabled:loadingPrice,className:"py-4 rounded-[22px] bg-slate-950 text-white font-black disabled:opacity-50"},loadingPrice?"更新中…":"更新股價"),
                React.createElement("button",{onClick:manualSave,className:"py-4 rounded-[22px] bg-brand-600 text-white font-black"},"儲存正式資料")),
            React.createElement("div",{className:"mt-4"},FreshnessCard())));
    const HoldingsSettingsPage = () => React.createElement(SettingsPage,{eyebrow:"IB 策略帳戶",title:"持股與現金",desc:"這一頁才會影響 TQQQ、HOT、Risk-Off 與 DCA 的交易計算。"},
        React.createElement(Card,{className:"p-5"},
            React.createElement("div",{className:"grid grid-cols-2 gap-3"},
                renderDraftNumInput("sharesTqqq","TQQQ 股數"),
                renderDraftNumInput(metrics.positionAsset==='QQQ'?'sharesQqq':metrics.positionAsset==='SPY'?'sharesSpy':metrics.positionAsset==='SPYI'?'sharesSpyi':'sharesQqqi',`${metrics.positionAsset} 股數`),
                renderDraftNumInput("cashUsd","現金 USD"),
                renderDraftNumInput("otherUsd","其他 IB 資產 USD"),
                renderDraftNumInput("usdtwd","USD/TWD"),
                renderDraftNumInput("dcaPoolUsd","DCA 資金池","USD")),
            React.createElement("button",{onClick:manualSave,className:"w-full mt-4 py-4 rounded-[22px] bg-slate-950 text-white font-black"},"儲存 IB 正式狀態")));
    const AccountsSettingsPage = () => {
        const draft={...pickExternalAccountState(data),...externalDraftRef.current};
        const preview=normalizeData({...data,...draft});
        const sub=computeSubAccountValue(preview);
        const recentFlows=(Array.isArray(data.externalCashflows)?data.externalCashflows:[]).slice(0,6);
        const stableNum=(field,label,suffix="",hint="")=>React.createElement(StableDraftNumInput,{key:field,label,value:draft[field],onDraft:v=>updateExternalDraft(field,v),suffix,hint});
        const saveDraft=(text)=>saveExternalAccounts(collectExternalDraft(),text);
        const content=React.createElement(React.Fragment,null,
            React.createElement(Card,{className:"p-5 mb-4 border-2 border-blue-100"},
                React.createElement("div",{className:"rounded-[24px] bg-slate-950 text-white p-4 mb-4"},
                    React.createElement("div",{className:"text-[10px] font-black text-white/55"},"股票資產總覽"),
                    React.createElement("div",{className:"mt-2 text-2xl font-black privacy-value"},portfolio.totalDisplay),
                    React.createElement("div",{className:"mt-1 text-xs font-bold text-white/60 privacy-value"},`IB 主策略 ${portfolio.strategyDisplay}｜其他帳戶不參與策略`)),
                React.createElement("div",{className:"rounded-[24px] bg-blue-50 border border-blue-100 p-4"},
                    React.createElement("div",{className:"font-black text-blue-950"},"IB 主策略保護"),
                    React.createElement("div",{className:"text-xs font-bold text-blue-700 mt-1 leading-relaxed"},"本頁只會更新 FT、複委託、台股、其他資產與其歷史快照，不會修改 IB 持股、Risk-On／Off、HOT、DCA 或交易紀錄。"))),
            React.createElement(Card,{className:"p-5 mb-4"},
                React.createElement(SectionTitle,{title:"Firstrade｜帳戶淨值模式",desc:"短線切換不用逐筆記錄，只輸入券商顯示的 Total Account Value。"}),
                stableNum("ftUsd","Firstrade Total Account Value","USD","輸入時只更新這個欄位，不會整頁重繪或跳回上方。"),
                React.createElement("div",{className:"mt-3 rounded-2xl bg-slate-50 border border-slate-100 p-3 text-xs font-bold text-slate-600 leading-relaxed"},"交易再頻繁也不用輸入持股；更新淨值並儲存今日快照即可。入金／出金請在下方另行記錄，避免績效失真。"),
                React.createElement("button",{onClick:()=>saveDraft('Firstrade 今日淨值已儲存'),className:"w-full mt-4 py-4 rounded-[22px] bg-slate-950 text-white font-black"},"儲存 FT 今日淨值")),
            React.createElement(Card,{className:"p-5 mb-4"},
                React.createElement(SectionTitle,{title:"複委託｜單一股票模式",desc:"輸入股票代號、股數與帳戶現金；股價可自動抓取或手動修正。"}),
                React.createElement("div",{className:"grid grid-cols-1 sm:grid-cols-2 gap-3"},
                    React.createElement(StableDraftTextInput,{label:"股票代號",value:draft.subSymbol,onDraft:v=>updateExternalDraft('subSymbol',String(v).toUpperCase().replace(/[^A-Z0-9.\-]/g,'').slice(0,12)),placeholder:"例如 AAPL",hint:"輸入完成後按下方藍色按鈕更新股價。"}),
                    React.createElement(StableDraftNumInput,{label:"目前股價",value:draft.subPriceUsd,onDraft:v=>updateExternalDraft('subPriceUsd',v),suffix:"USD",hint:data.subPriceUpdatedAt?`最後更新 ${new Date(data.subPriceUpdatedAt).toLocaleString('zh-TW')}`:"可手動輸入，或按下方按鈕自動更新"})),
                React.createElement("button",{type:"button",onClick:fetchSubPrice,disabled:loadingSubPrice,className:"sub-price-update-button w-full mt-3 py-4 rounded-[22px] bg-blue-600 text-white font-black disabled:opacity-50"},loadingSubPrice?"正在更新複委託股價…":"↻ 更新複委託股價"),
                React.createElement("div",{className:"grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3"},
                    stableNum("subShares","持有股數","股"),
                    stableNum("subCashUsd","帳戶現金","USD"),
                    stableNum("subAvgCostUsd","平均成本（選填）","USD"),
                    React.createElement("div",{className:"rounded-2xl bg-slate-950 text-white p-4"},
                        React.createElement("div",{className:"text-[10px] font-black text-white/55"},sub.holdingMode?`${sub.symbol} 複委託估值（儲存後更新）`:"複委託手動淨值"),
                        React.createElement("div",{className:"mt-2 text-xl font-black privacy-value"},`US$ ${money(sub.valueUsd,2)}`),
                        sub.costBasisUsd>0&&React.createElement("div",{className:`mt-1 text-xs font-black privacy-value ${sub.unrealizedUsd>=0?'text-emerald-300':'text-red-300'}`},`股票未實現 ${sub.unrealizedUsd>=0?'+':'-'}US$ ${money(Math.abs(sub.unrealizedUsd),2)}`))),
                React.createElement("button",{onClick:()=>saveDraft('複委託與今日快照已儲存'),className:"w-full mt-4 py-4 rounded-[22px] bg-slate-950 text-white font-black"},"儲存複委託與今日快照"),
                !sub.holdingMode&&React.createElement("div",{className:"mt-3"},stableNum("subUsd","複委託手動備援淨值","USD","尚未設定有效股票代號與股價時才使用。"))),
            React.createElement(Card,{className:"p-5 mb-4"},
                React.createElement(SectionTitle,{title:"台股與其他股票資產",desc:"維持手動淨值；只進入全部股票資產，不影響 IB。"}),
                React.createElement("div",{className:"grid grid-cols-1 sm:grid-cols-2 gap-3"},
                    stableNum("twStockTwd","台股淨值","TWD"),
                    stableNum("otherTotalTwd","其他股票相關資產","TWD")),
                React.createElement("button",{onClick:()=>saveDraft('全部其他帳戶與今日快照已儲存'),className:"w-full mt-4 py-4 rounded-[22px] bg-slate-950 text-white font-black"},"儲存全部其他帳戶與今日快照")),
            React.createElement(Card,{className:"p-5"},
                React.createElement(SectionTitle,{title:"FT／複委託入金與出金",desc:"只記外部資金進出，不記短線買賣；績效圖會自動扣除。"}),
                React.createElement("div",{className:"grid grid-cols-1 sm:grid-cols-2 gap-3"},
                    React.createElement("label",{className:"block bg-slate-50 border border-slate-200 rounded-2xl p-3"},React.createElement("div",{className:"text-[10px] font-black text-slate-500 mb-1"},"帳戶"),React.createElement("select",{value:externalFlowAccount,onChange:e=>setExternalFlowAccount(e.target.value),className:"w-full min-h-[44px] bg-transparent text-center font-black"},React.createElement("option",{value:"FT"},"Firstrade"),React.createElement("option",{value:"SUB"},"複委託"))),
                    React.createElement("label",{className:"block bg-slate-50 border border-slate-200 rounded-2xl p-3"},React.createElement("div",{className:"text-[10px] font-black text-slate-500 mb-1"},"類型"),React.createElement("select",{value:externalFlowType,onChange:e=>setExternalFlowType(e.target.value),className:"w-full min-h-[44px] bg-transparent text-center font-black"},React.createElement("option",{value:"deposit"},"入金"),React.createElement("option",{value:"withdrawal"},"出金"))),
                    React.createElement(NumInput,{label:"金額",value:externalFlowAmount,onChange:setExternalFlowAmount,suffix:"USD",hint:"請先確認上方帳戶淨值已反映這筆資金流。"}),
                    React.createElement("label",{className:"block bg-slate-50 border border-slate-200 rounded-2xl p-3"},React.createElement("div",{className:"text-[10px] font-black text-slate-500 mb-1"},"日期"),React.createElement("input",{type:"date",value:externalFlowDate,onChange:e=>setExternalFlowDate(e.target.value),className:"w-full min-h-[44px] bg-transparent text-center font-black",style:{fontSize:'16px'}})),
                    React.createElement("label",{className:"sm:col-span-2 block bg-slate-50 border border-slate-200 rounded-2xl p-3"},React.createElement("div",{className:"text-[10px] font-black text-slate-500 mb-1"},"備註（選填）"),React.createElement("input",{type:"text",value:externalFlowNote,onChange:e=>setExternalFlowNote(e.target.value),placeholder:"例如新增本金、提領",className:"w-full min-h-[44px] bg-transparent font-bold",style:{fontSize:'16px'}}))),
                React.createElement("button",{onClick:addExternalCashflow,className:"w-full mt-4 py-4 rounded-[22px] bg-emerald-600 text-white font-black"},"記錄資金流並建立今日快照"),
                recentFlows.length>0&&React.createElement("div",{className:"mt-4 space-y-2"},recentFlows.map(flow=>React.createElement("div",{key:flow.id,className:"flex items-center justify-between gap-3 rounded-2xl bg-slate-50 border border-slate-100 p-3"},React.createElement("div",null,React.createElement("div",{className:"text-sm font-black text-slate-900"},`${flow.account==='FT'?'Firstrade':'複委託'}｜${flow.type==='withdrawal'?'出金':'入金'}`),React.createElement("div",{className:"text-[10px] font-bold text-slate-500 mt-1"},`${flow.date}${flow.note?'｜'+flow.note:''}`)),React.createElement("div",{className:`font-mono font-black privacy-value ${flow.type==='withdrawal'?'text-red-600':'text-emerald-600'}`},`${flow.type==='withdrawal'?'-':'+'}US$ ${money(flow.amountUsd,2)}`))))));
        return SettingsPage({eyebrow:"其他券商",title:"FT 與複委託",desc:"IB 主策略完全獨立。FT 只記帳戶總資產；複委託可用單一股票與現金自動估值。",children:content});
    };
    const ParametersSettingsPage = () => React.createElement(SettingsPage,{eyebrow:"策略參數",title:"門檻與替代標的",desc:"平時保持鎖定。只有確定要更改正式規則時才解鎖。"},
        React.createElement(Card,{className:"p-5"},
            React.createElement("div",{className:"flex items-center justify-between gap-3 mb-4"},
                React.createElement("div",null,React.createElement("div",{className:"font-black text-slate-950"},metrics.paramsLocked?"參數已鎖定":"參數可修改"),React.createElement("div",{className:"text-xs font-bold text-slate-500 mt-1"},"正式預設 +4 / -3 / 19 / 24 / 28")),
                React.createElement("button",{onClick:()=>{if(data.parametersLocked!==false){if(confirm('確定解鎖正式策略參數？'))patch('parametersLocked',false);}else patch('parametersLocked',true);},className:`px-4 py-3 rounded-2xl text-xs font-black ${metrics.paramsLocked?'bg-slate-950 text-white':'bg-amber-500 text-white'}`},metrics.paramsLocked?"解鎖":"重新鎖定")),
            React.createElement("div",{className:"grid grid-cols-2 gap-3"},
                React.createElement(NumInput,{label:"Risk-On",value:data.entryBuffer,onChange:v=>patch('entryBuffer',v),suffix:"%",disabled:metrics.paramsLocked}),
                React.createElement(NumInput,{label:"Risk-Off",value:data.exitBuffer,onChange:v=>patch('exitBuffer',v),suffix:"%",disabled:metrics.paramsLocked}),
                React.createElement(NumInput,{label:"HOT1",value:data.hot1,onChange:v=>patch('hot1',v),suffix:"%",disabled:metrics.paramsLocked}),
                React.createElement(NumInput,{label:"HOT2",value:data.hot2,onChange:v=>patch('hot2',v),suffix:"%",disabled:metrics.paramsLocked}),
                React.createElement(NumInput,{label:"HOT3",value:data.hot3,onChange:v=>patch('hot3',v),suffix:"%",disabled:metrics.paramsLocked}),
                React.createElement("label",{className:"block bg-slate-50 border border-slate-200 rounded-2xl p-3"},React.createElement("div",{className:"text-[10px] font-black text-slate-500 mb-1"},"過熱替代標的"),React.createElement("select",{value:data.hotAsset,disabled:metrics.paramsLocked,onChange:e=>patch('hotAsset',e.target.value),className:"w-full min-h-[44px] bg-transparent text-center font-black"},['QQQ','SPY','SPYI','QQQI'].map(x=>React.createElement("option",{key:x,value:x},x))))),
            React.createElement("button",{onClick:manualSave,className:"w-full mt-4 py-4 rounded-[22px] bg-brand-600 text-white font-black"},"儲存正式參數")));
    const AppearanceSettingsPage = () => {
        const themes=[['aurora','極光'],['mountain','山景'],['ocean','海洋'],['off','純色']];
        return React.createElement(SettingsPage,{eyebrow:"外觀與隱私",title:"首頁封面",desc:"封面使用內建輕量圖層，不需要下載圖片，也不會影響滑動效能。"},
            React.createElement(Card,{className:"p-5"},
                React.createElement("button",{onClick:()=>setUiPreference('privacyMode',!data.privacyMode),className:"settings-row w-full text-left"},
                    React.createElement("span",{className:"settings-icon text-blue-600"},data.privacyMode?"◉":"◎"),
                    React.createElement("span",{className:"flex-1"},React.createElement("span",{className:"block text-[17px] font-black text-slate-900"},"金額隱私模式"),React.createElement("span",{className:"block text-xs font-bold text-slate-500 mt-1"},data.privacyMode?"金額與股數目前已模糊":"在公共場所快速隱藏資產與交易數字")),
                    React.createElement("span",{className:`px-3 py-1.5 rounded-full text-xs font-black ${data.privacyMode?'bg-blue-100 text-blue-700':'bg-slate-100 text-slate-500'}`},data.privacyMode?"開啟":"關閉")),
                React.createElement("div",{className:"grid grid-cols-2 gap-3 mt-5"},themes.map(([id,label])=>React.createElement("button",{key:id,onClick:()=>setUiPreference('coverTheme',id),className:`relative overflow-hidden rounded-[24px] min-h-[116px] text-left p-4 border-2 cover-hero cover-${id} ${data.coverTheme===id?'border-blue-500':'border-transparent'}`},React.createElement("div",{className:"relative z-10 text-white font-black"},label),data.coverTheme===id&&React.createElement("div",{className:"absolute right-3 top-3 z-10 w-7 h-7 rounded-full bg-white text-blue-600 flex items-center justify-center font-black"},"✓"))))));
    };
    const CashflowSettingsPage = () => React.createElement(SettingsPage,{eyebrow:"資金流",title:"IB 入金與出金",desc:"外部資金必須獨立記錄，避免把新增本金誤判成投資獲利。"},
        React.createElement(Card,{className:"p-5"},
            React.createElement("div",{className:"grid grid-cols-1 sm:grid-cols-2 gap-3"},
                React.createElement("select",{value:cashflowType,onChange:e=>setCashflowType(e.target.value),className:"rounded-2xl px-4 py-3 text-sm font-black"},React.createElement("option",{value:"deposit"},"入金"),React.createElement("option",{value:"withdrawal"},"出金")),
                React.createElement("input",{value:cashflowAmount,onChange:e=>setCashflowAmount(e.target.value.replace(/[^0-9.]/g,'')),inputMode:"decimal",placeholder:"金額 USD",className:"rounded-2xl px-4 py-3 text-sm font-mono font-black",style:{fontSize:'16px'}}),
                React.createElement("input",{type:"date",value:cashflowDate,onChange:e=>setCashflowDate(e.target.value),className:"rounded-2xl px-4 py-3 text-sm font-black"}),
                React.createElement("input",{value:cashflowNote,onChange:e=>setCashflowNote(e.target.value),placeholder:"備註",className:"rounded-2xl px-4 py-3 text-sm font-bold",style:{fontSize:'16px'}})),
            React.createElement("div",{className:"mt-4 rounded-[24px] bg-slate-50 border border-slate-100 p-4"},React.createElement("div",{className:"text-[10px] font-black text-slate-500"},"目前 IB 現金"),React.createElement("div",{className:"mt-2 text-2xl font-black privacy-value"},`US$ ${money(data.cashUsd,2)}`)),
            React.createElement("button",{onClick:addCashflowRecord,className:"w-full mt-4 rounded-[22px] bg-brand-600 text-white font-black px-4 py-4"},"記錄並調整 IB 現金")));
    const BackupsSettingsPage = () => React.createElement(SettingsPage,{eyebrow:"備份與還原",title:"本機備份卡片",desc:"最多保留最近 5 份。備份包含目前狀態、歷史紀錄與全部資產快照。"},
        React.createElement("div",null,
            React.createElement(Card,{className:"p-5 mb-4"},
                React.createElement("button",{onClick:createBackupCard,className:"w-full py-4 rounded-[22px] bg-slate-950 text-white font-black"},"建立新的備份卡片"),
                React.createElement("div",{className:"grid grid-cols-3 gap-2 mt-3"},React.createElement("button",{onClick:exportRecordsJson,className:"py-3 rounded-2xl bg-blue-50 text-blue-700 text-xs font-black"},"下載 JSON"),React.createElement("button",{onClick:()=>importInputRef.current?.click(),className:"py-3 rounded-2xl bg-emerald-50 text-emerald-700 text-xs font-black"},"還原 JSON"),React.createElement("button",{onClick:exportRecordsCsv,className:"py-3 rounded-2xl bg-purple-50 text-purple-700 text-xs font-black"},"匯出 CSV")),
                React.createElement("input",{ref:importInputRef,type:"file",accept:"application/json,.json",onChange:importRecordsJson,className:"hidden"})),
            React.createElement("div",{className:"space-y-3"},backupCards.length?backupCards.map(card=>React.createElement(Card,{key:card.id,className:"p-4"},
                React.createElement("div",{className:"flex justify-between gap-3"},React.createElement("div",null,React.createElement("div",{className:"font-black text-slate-950"},new Date(card.createdAt).toLocaleString('zh-TW')),React.createElement("div",{className:"text-xs font-bold text-slate-500 mt-1"},`${card.recordCount} 筆紀錄｜${card.strategyVersion}`)),React.createElement("div",{className:"text-right"},React.createElement("div",{className:"font-black privacy-value"},`IB US$ ${money(card.strategyUsd,0)}`),React.createElement("div",{className:"text-xs font-bold text-slate-500 privacy-value"},`全部 NT$ ${money(card.totalTwd,0)}`))),
                React.createElement("div",{className:"grid grid-cols-3 gap-2 mt-4"},React.createElement("button",{onClick:()=>restoreBackupCard(card),className:"py-3 rounded-2xl bg-brand-600 text-white text-xs font-black"},"恢復"),React.createElement("button",{onClick:()=>downloadBackupCard(card),className:"py-3 rounded-2xl bg-slate-100 text-slate-700 text-xs font-black"},"下載"),React.createElement("button",{onClick:()=>deleteBackupCard(card),className:"py-3 rounded-2xl bg-red-50 text-red-700 text-xs font-black"},"刪除")))):React.createElement(Card,{className:"p-5 text-center text-sm font-bold text-slate-400"},"尚未建立備份卡片"))));
    const Settings = () => {
        if(settingsView==="market")return MarketSettingsPage();
        if(settingsView==="holdings")return HoldingsSettingsPage();
        if(settingsView==="accounts")return AccountsSettingsPage();
        if(settingsView==="params")return ParametersSettingsPage();
        if(settingsView==="appearance")return AppearanceSettingsPage();
        if(settingsView==="cashflow")return CashflowSettingsPage();
        if(settingsView==="backups")return BackupsSettingsPage();
        if(settingsView==="advanced")return React.createElement("div",{className:"page-slide-from-right settings-input-stable"},React.createElement(SettingsBack,{title:"返回設定"}),Inputs());
        if(settingsView==="sync") return React.createElement("div",{className:"page-slide-from-right settings-input-stable"},React.createElement(SettingsBack,{title:"返回設定"}),Sync());
        const menuItems=[
            ['market','↻','市場資料','股價、日期與兩條 200SMA'],
            ['holdings','IB','IB 持股與現金','唯一會影響 TQQQ 策略的帳戶'],
            ['accounts','◎','FT、複委託與台股','FT 淨值、複委託單股與歷史績效'],
            ['params','◇','策略參數','Risk-On／Off、HOT 與替代標的'],
            ['appearance','◉','外觀與隱私','封面主題、金額隱藏'],
            ['cashflow','±','IB 入金與出金','獨立記錄資金流，避免績效失真'],
            ['backups','↓','備份與還原','本機備份卡片、JSON 與 CSV'],
            ['advanced','⚙','進階策略工具','情境模擬、新一輪 HOT 與完整規則'],
            ['sync','☁','雲端同步與系統',user&&!user.isAnonymous?'Google 雲端已連線':'目前使用本機資料']
        ];
        return React.createElement("main",{className:`settings-page max-w-5xl mx-auto px-4 pt-5 content-bottom-space ${settingsMotion==="back"?"page-slide-from-left":"page-fade-in"}`},
            React.createElement(Card,{className:"p-6 mb-5 bg-gradient-to-br from-white/92 to-indigo-50/80"},React.createElement("div",{className:"text-[11px] font-black tracking-[.2em] text-brand-600"},"設定"),React.createElement("div",{className:"mt-3 text-3xl font-black text-slate-950"},"每一項都是獨立頁面"),React.createElement("div",{className:"mt-2 text-sm font-bold text-slate-500 privacy-value"},`全部 ${portfolio.totalDisplay}｜IB ${portfolio.strategyDisplay}`)),
            React.createElement("div",{className:"settings-menu-grid space-y-3"},menuItems.map(([id,icon,title,desc])=>React.createElement("button",{key:id,onClick:()=>openSettingsView(id),className:"settings-row w-full text-left"},React.createElement("span",{className:"settings-icon text-blue-600 text-sm font-black"},icon),React.createElement("span",{className:"flex-1"},React.createElement("span",{className:"block text-[17px] font-black text-slate-900"},title),React.createElement("span",{className:"block text-xs font-bold text-slate-500 mt-1"},desc)),React.createElement("span",{className:"text-2xl text-slate-400"},"›")))));
    };
    const QuickUpdateSheet = () => {
        if(!showQuickUpdateSheet)return null;
        const draft={...pickExternalAccountState(data),...externalDraftRef.current};
        const preview=normalizeData({...data,...draft});
        const sub=computeSubAccountValue(preview);
        const stableNum=(field,label,suffix="",hint="")=>React.createElement(StableDraftNumInput,{key:field,label,value:draft[field],onDraft:v=>updateExternalDraft(field,v),suffix,hint});
        const lastPriceTime=draft.subPriceUpdatedAt?new Date(draft.subPriceUpdatedAt).toLocaleString('zh-TW'):'尚未自動更新';
        return React.createElement("div",{className:"fixed inset-0 z-[78] sheet-backdrop sheet-animate-backdrop flex items-end justify-center p-3",onClick:()=>setShowQuickUpdateSheet(false)},
            React.createElement("div",{className:"sheet-panel quick-update-sheet w-full max-w-md max-h-[90vh] overflow-auto rounded-[34px] bg-white p-5 safe-bottom shadow-2xl",onClick:e=>e.stopPropagation()},
                React.createElement("div",{className:"mx-auto w-12 h-1.5 rounded-full bg-slate-200 mb-5"}),
                React.createElement("div",{className:"flex justify-between items-start gap-3"},
                    React.createElement("div",null,
                        React.createElement("div",{className:"text-[10px] font-black tracking-[.18em] text-blue-600"},"首頁快速更新"),
                        React.createElement("div",{className:"mt-1 text-2xl font-black text-slate-950"},"更新 FT 與複委託"),
                        React.createElement("div",{className:"mt-1 text-xs font-bold text-slate-500"},"一次儲存今日快照；IB 主策略完全不變。")),
                    React.createElement("button",{onClick:()=>setShowQuickUpdateSheet(false),className:"w-11 h-11 rounded-full bg-slate-100 text-xl text-slate-500"},"×")),
                React.createElement("div",{className:"mt-5 rounded-[24px] bg-slate-950 text-white p-4"},
                    React.createElement("div",{className:"text-[10px] font-black text-white/55"},"目前全部股票總資產"),
                    React.createElement("div",{className:"mt-2 text-2xl font-black privacy-value"},portfolio.totalDisplay),
                    React.createElement("div",{className:"mt-1 text-xs font-bold text-white/60"},"本面板只更新外部帳戶與歷史快照")),
                React.createElement("div",{className:"mt-4 rounded-[26px] bg-blue-50 border border-blue-100 p-4"},
                    React.createElement(SectionTitle,{title:"Firstrade",desc:"輸入券商顯示的 Total Account Value；短線買賣不用逐筆記。"}),
                    stableNum("ftUsd","FT 帳戶總資產","USD","輸入完成後按最下方一次儲存。")),
                React.createElement("div",{className:"mt-4 rounded-[26px] bg-slate-50 border border-slate-100 p-4"},
                    React.createElement(SectionTitle,{title:"複委託",desc:sub.holdingMode?`${sub.symbol}｜${money(getNum(draft.subShares),3)} 股`:'尚未設定有效股票代號與股數'}),
                    React.createElement("div",{className:"grid grid-cols-1 sm:grid-cols-2 gap-3"},
                        stableNum("subPriceUsd","目前股價","USD",`最後更新：${lastPriceTime}`),
                        stableNum("subCashUsd","帳戶現金","USD","股數與成本等低頻資料仍放在完整設定。")),
                    React.createElement("button",{type:"button",onClick:fetchSubPrice,disabled:loadingSubPrice,className:"sub-price-update-button w-full mt-3 py-4 rounded-[22px] bg-blue-600 text-white font-black disabled:opacity-50"},loadingSubPrice?"正在更新複委託股價…":`↻ 更新 ${String(draft.subSymbol||'複委託').toUpperCase()} 股價`),
                    React.createElement("div",{className:"mt-3 rounded-2xl bg-white border border-slate-200 p-3 flex items-center justify-between gap-3"},
                        React.createElement("div",null,React.createElement("div",{className:"text-[10px] font-black text-slate-500"},"目前複委託估值"),React.createElement("div",{className:"mt-1 text-xs font-bold text-slate-500"},sub.holdingMode?"股票市值＋帳戶現金":"使用手動備援淨值")),
                        React.createElement("div",{className:"font-mono text-lg font-black text-slate-950 privacy-value"},`US$ ${money(sub.valueUsd,2)}`))),
                React.createElement("button",{onClick:saveQuickUpdate,disabled:quickSaving,className:"w-full mt-5 py-4 rounded-[22px] bg-slate-950 text-white font-black disabled:opacity-50"},quickSaving?"正在儲存今日快照…":"儲存今日 FT＋複委託快照"),
                React.createElement("button",{onClick:()=>{setShowQuickUpdateSheet(false);openSettingsView('accounts');setPage('settings');},className:"w-full mt-3 py-3 rounded-[20px] bg-slate-100 text-slate-700 text-xs font-black"},"修改股票代號、股數、成本或記錄入金／出金")));
    };
    const AccountSheet = () => {
        if(!showAccountSheet)return null;
        const rows=portfolio.cards.map(card=>React.createElement("div",{key:card.key,className:"rounded-[24px] bg-slate-50 border border-slate-100 p-4"},
            React.createElement("div",{className:"flex justify-between gap-3"},
                React.createElement("div",null,React.createElement("div",{className:"font-black text-slate-900"},card.label),React.createElement("div",{className:"text-xs font-bold text-slate-500 mt-1"},card.note)),
                React.createElement("div",{className:"text-right"},React.createElement("div",{className:"font-mono font-black text-slate-950 privacy-value"},card.amountText),React.createElement("div",{className:"text-[10px] font-bold text-slate-400 mt-1"},`占比 ${pct(card.ratio,1)}`)))));
        return React.createElement("div",{className:"fixed inset-0 z-[75] sheet-backdrop sheet-animate-backdrop flex items-end justify-center p-3",onClick:()=>setShowAccountSheet(false)},
            React.createElement("div",{className:"sheet-panel w-full max-w-md max-h-[86vh] overflow-auto rounded-[34px] bg-white p-5 safe-bottom shadow-2xl",onClick:e=>e.stopPropagation()},
                React.createElement("div",{className:"mx-auto w-12 h-1.5 rounded-full bg-slate-200 mb-5"}),
                React.createElement("div",{className:"flex justify-between items-start gap-3"},
                    React.createElement("div",null,React.createElement("div",{className:"text-2xl font-black text-slate-950"},"帳戶資產明細"),React.createElement("div",{className:"text-sm font-bold text-slate-500 mt-1"},portfolio.totalDisplay)),
                    React.createElement("button",{onClick:()=>setShowAccountSheet(false),className:"w-11 h-11 rounded-full bg-slate-100 text-xl text-slate-500"},"×")),
                React.createElement("div",{className:"space-y-3 mt-5"},rows),
                React.createElement("div",{className:"grid grid-cols-2 gap-2 mt-5"},
                    React.createElement("button",{onClick:()=>{setShowAccountSheet(false);openQuickUpdateSheet();},className:"action-blue-button py-4 rounded-[22px] bg-blue-600 text-white font-black"},"快速更新"),
                    React.createElement("button",{onClick:()=>{setShowAccountSheet(false);openSettingsView("accounts");setPage("settings");},className:"py-4 rounded-[22px] bg-slate-950 text-white font-black"},"完整設定"))));
    };
    const ExecutionModal = () => !pendingExecution ? null : React.createElement("div", { className: "fixed inset-0 z-50 sheet-backdrop sheet-animate-backdrop flex items-end sm:items-center justify-center p-4" },
        React.createElement("div", { className: "sheet-panel bg-white rounded-3xl shadow-2xl w-full max-w-md p-5" },
            React.createElement("div", { className: "flex items-start justify-between gap-3 mb-3" },
                React.createElement("div", null,
                    React.createElement("div", { className: "text-[10px] font-black text-brand-600 tracking-widest" }, "執行前確認"),
                    React.createElement("div", { className: "text-xl font-black text-slate-950" }, metrics.title),
                    React.createElement("div", { className: "text-xs font-bold text-slate-400 mt-1" }, "請確認價格、股數、DCA 期數與備註後再寫入紀錄。")),
                React.createElement(Pill, { tone: metrics.tone }, metrics.alloc.label)),
            React.createElement("div", { className: "bg-slate-50 border border-slate-100 rounded-2xl p-3 mb-3" },
                React.createElement("div", { className: "text-[10px] font-black text-slate-500" }, "IB 策略資產"),
                React.createElement("div", { className: "font-mono text-2xl font-black text-slate-950 privacy-value" }, "$", money(metrics.totalUsd, 2)),
                metrics.dcaActiveEffective && React.createElement("div", { className: "text-xs font-bold text-blue-700 mt-1" }, `DCA：${metrics.dcaCompleted}/6${metrics.dcaDue?` → ${metrics.plannedCompleted}/6，本期約 $${money(metrics.dcaBuyUsd,0)}`:`，下期 ${metrics.nextDue}`}`)),
            React.createElement("div", { className: "bg-purple-50 border border-purple-100 rounded-2xl p-3 mb-3" },
                React.createElement("div", { className: "text-[10px] font-black text-purple-700 mb-1" }, "策略狀態變更"),
                React.createElement("div", { className: "text-xs font-bold text-purple-900" }, `執行前：${metrics.formalStateText}`),
                React.createElement("div", { className: "text-xs font-bold text-purple-900 mt-1" }, `執行後：${metrics.title}｜${metrics.alloc.label}`),
                metrics.effectiveRank>metrics.storedHot && React.createElement("div", { className: "text-xs font-black text-purple-700 mt-1" }, `過熱鎖定 ${metrics.storedHot} → ${metrics.effectiveRank}；本輪不得反向加回 TQQQ。`),
                metrics.riskOffNow && React.createElement("div", { className: "text-xs font-black text-red-700 mt-1" }, "Risk-Off 執行後會清除舊過熱鎖定，並建立或延續同一輪 DCA。")),
            React.createElement("div", { className: "bg-amber-50 border border-amber-100 rounded-2xl p-3 mb-3" },
                React.createElement("div", { className: "text-[10px] font-black text-amber-700 mb-1" }, "本次草稿變更"),
                [["TQQQ 股數", committedData.sharesTqqq, data.sharesTqqq], [`${metrics.positionAsset} 股數`, committedData[metrics.positionAsset==="QQQ"?"sharesQqq":metrics.positionAsset==="SPY"?"sharesSpy":metrics.positionAsset==="SPYI"?"sharesSpyi":"sharesQqqi"], data[metrics.positionAsset==="QQQ"?"sharesQqq":metrics.positionAsset==="SPY"?"sharesSpy":metrics.positionAsset==="SPYI"?"sharesSpyi":"sharesQqqi"]], ["現金 USD", committedData.cashUsd, data.cashUsd], ["DCA 進度", committedData.dcaCompleted, data.dcaCompleted]].filter(x => String(x[1] ?? '') !== String(x[2] ?? '')).map((x,i) => React.createElement("div", { key:i, className:"text-xs font-bold text-amber-900" }, x[0], "：", x[1] || 0, " → ", x[2] || 0)),
                !hasDraftChanges && React.createElement("div", { className:"text-xs font-bold text-amber-800" }, "沒有持倉草稿變更；仍會依目前訊號寫入執行紀錄。")),
            React.createElement("div", { className: "space-y-2 max-h-48 overflow-auto mb-4" }, metrics.actionLines.map((a, i) => React.createElement("div", { key: i, className: "text-sm font-black text-slate-800 leading-relaxed bg-white border border-slate-100 rounded-2xl p-2" }, i + 1, ". ", a))),
            React.createElement("div", { className: "grid grid-cols-2 gap-2" },
                React.createElement("button", { onClick: () => setPendingExecution(false), className: "py-3 rounded-2xl bg-slate-100 text-slate-700 font-black active:scale-95" }, "取消"),
                React.createElement("button", { onClick: performExecution, className: `py-3 rounded-2xl text-white font-black active:scale-95 ${metrics.signal === 'OFF' || metrics.signal === 'HOT2' ? 'bg-red-600' : 'bg-brand-600'}` }, "確認執行"))));
    const BottomNav = () => React.createElement(React.Fragment, null,
        page==='home' && React.createElement("button", { onClick: confirmExecution, disabled:previewActive || !metrics.canExecute || executionPreparing || loadingPrice, className: `home-execute-button ${homeSlide===2?'mobile-active':'mobile-inactive'} fixed bottom-[6.35rem] left-1/2 -translate-x-1/2 z-50 min-w-[190px] px-7 py-3.5 rounded-full text-white text-sm font-black shadow-2xl border border-white/80 active:scale-95 ${!previewActive && metrics.canExecute && !executionPreparing && !loadingPrice?"bg-gradient-to-r from-blue-600 to-indigo-600":"bg-slate-400 opacity-80"}` }, previewActive?"測試預覽中":executionPreparing?"更新股價中…":loadingPrice?"股價更新中":metrics.canExecute?"更新後執行":"資料待修正"),
        React.createElement("nav", { className: "fixed z-40 floating-nav safe-bottom" },
            React.createElement("div", { className: "grid grid-cols-3 gap-1.5 px-2 pt-2" },
                [["home","⌂","總覽"],["logs","◫","紀錄"],["settings","◎","設定"]].map(([id,icon,label])=>React.createElement("button", { key:id,onClick:()=>{if(id==='settings'){setSettingsMotion('back');setSettingsView('menu');}setPage(id);}, className:`py-2.5 rounded-[22px] flex flex-col items-center justify-center gap-0.5 text-[10px] font-black active:scale-95 ${page===id?'nav-item-active text-white':'text-slate-500'}` },React.createElement("span",{className:"text-[18px] leading-none"},icon),React.createElement("span",null,label))))));
    return React.createElement("div", { className:data.privacyMode?"privacy-active":"" },
        Header(),
        previewActive && React.createElement("div", { className:"sticky top-[65px] z-20 max-w-5xl mx-auto px-4 pt-2" }, React.createElement("div", { className:"bg-sky-600 text-white rounded-2xl px-4 py-3 flex items-center justify-between shadow-lg" }, React.createElement("div", { className:"text-sm font-black" }, `測試預覽：${previewScenario}｜${data.hotAsset||"QQQ"}`), React.createElement("button", { onClick:()=>setPreviewScenario("LIVE"), className:"px-3 py-1.5 rounded-xl bg-white text-sky-700 text-xs font-black" }, "結束預覽"))),
        page === 'home' && Home(),
        page === 'logs' && Logs(),
        page === 'settings' && Settings(),
        BottomNav(),
        MonthSheet(),
        CalendarDaySheet(),
        AccountSheet(),
        QuickUpdateSheet(),
        ExecutionModal(),
        toast && React.createElement("div", { className: "fixed left-1/2 -translate-x-1/2 bottom-40 z-50 bg-slate-900/90 backdrop-blur text-white rounded-2xl px-4 py-3 text-sm font-black shadow-2xl" }, toast));
};
class ErrorBoundary extends React.Component {
    constructor(props){ super(props); this.state={error:null}; }
    static getDerivedStateFromError(error){ return {error}; }
    render(){
        if(!this.state.error) return this.props.children;
        return React.createElement("div", { style:{minHeight:"100vh",background:"#f1f5f9",padding:"24px",fontFamily:"system-ui"} },
            React.createElement("div", { style:{maxWidth:"480px",margin:"40px auto",background:"white",borderRadius:"24px",padding:"24px",boxShadow:"0 12px 30px rgba(15,23,42,.12)"} },
                React.createElement("h1", { style:{fontSize:"22px",fontWeight:900,color:"#0f172a"} }, "系統保護模式"),
                React.createElement("p", { style:{color:"#475569",lineHeight:1.7} }, "網頁發生錯誤，資料仍保留在本機。可先重新載入；若仍失敗，再使用安全模式清除介面快取，不會刪除正式歷史紀錄。"),
                React.createElement("pre", { style:{whiteSpace:"pre-wrap",fontSize:"11px",color:"#b91c1c",background:"#fff1f2",padding:"12px",borderRadius:"12px"} }, String(this.state.error?.message || this.state.error)),
                React.createElement("div", { style:{display:"grid",gap:"10px"} },
                    React.createElement("button", { onClick:()=>location.reload(), style:{padding:"12px",border:0,borderRadius:"14px",background:"#0f172a",color:"white",fontWeight:800} }, "重新載入"),
                    React.createElement("button", { onClick:()=>{location.reload();}, style:{padding:"12px",border:0,borderRadius:"14px",background:"#e2e8f0",color:"#0f172a",fontWeight:800} }, "使用本機安全模式"))));
    }
}
ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(ErrorBoundary, null, React.createElement(App, null)));
