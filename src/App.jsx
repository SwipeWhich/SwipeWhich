import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { Wallet, Plane, Check, HelpCircle, X, AlertTriangle, MessageSquare, ExternalLink, RotateCcw, Calculator, BookOpen, PlusCircle, ClipboardList, ChevronRight, ChevronLeft, CalendarDays } from "lucide-react";

/* 碌邊張 SwipeWhich v1.2 © 2026 */

function mk(id,n,iss,ty,desc,base,ov,cap,nc,mpr,cond,exp){
  const cb={local:base,dining:base,onlineHKD:base,mobilePay:base,octopus:0,octopusManual:0,supermarket:base,onlineFX:base,travelJKSTA:base,physicalFX:base,...ov};
  return{id,name:n,issuer:iss,type:ty,desc,cashback:cb,capInfo:cap,noCap:!!nc,milesPerDollar:mpr||null,cond:cond||null,exp:exp||null};
}
function getExpiry(card){
  if(!card.exp)return null;
  const now=new Date();const exp=new Date(card.exp+"T23:59:59");
  const diff=Math.ceil((exp-now)/(1000*60*60*24));
  const labels={hs_mmpower:"5%/6%回贈",hsbc_red:"4%網購$10K上限",ds_earnmore:"2%加碼回贈",dbs_compass:"超市8%",ae_plat_charge:"外幣$2/里",fubon_plat:"日韓台加碼",cncbi_motion:"6%食飯/網購",dbs_live:"5%自選類別",dbs_eminent_vs:"5%餐飲加碼",dbs_eminent_plat:"5%餐飲加碼",aeon_waku:"網購6%/日本3%",hs_travel:"7%/5%外幣回贈"};
  const what=labels[card.id]||"優惠";
  if(diff<0)return{status:"expired",text:`⏰ ${what}已過期，回贈率可能已更新`,color:"#FF3B30",short:`⏰ ${what}已過期`};
  if(diff<=30)return{status:"soon",text:`⏳ ${what}將於 ${diff} 天後到期（${card.exp.slice(5).replace("-","/")}）`,color:"#FF9500",short:`⏳ ${what} ${card.exp.slice(5).replace("-","/")}到期`};
  return null;
}

// FX fee by card ID (as decimal). Visa/MC=1.95%, AE=2%, UnionPay~1%, exceptions=0%
const FX_FEES={
  // 0% exceptions
  sc_smart:0, hsbc_pulse:0, mox_miles:0,
  // UnionPay 1%
  ds_earnmore:0.01, ds_wewa_up:0.01,
  // AE 2%
  ae_explorer:0.02, ae_plat_cc:0.02, ae_plat_charge:0.02, ae_blue:0.02,
  // All others default 1.95% (Visa/MC)
};
const getFxFee=(c,s)=>{
  // Special cases by scenario
  return FX_FEES[c.id]!==undefined?FX_FEES[c.id]:0.0195;
};
const FX_SCENARIOS=["onlineFX","travelJKSTA","physicalFX"];

// Miles conversion fee reference (bank points → airline miles)
const MILES_CONV_FEE={
  hsbc_vs:{fee:"免費",note:"獎賞錢→Asia Miles/Avios，Reward+ App即時到賬"},
  hsbc_plat:{fee:"免費",note:"獎賞錢→Asia Miles/Avios，Reward+ App即時到賬"},
  hsbc_gold:{fee:"免費",note:"獎賞錢→Asia Miles/Avios，Reward+ App即時到賬"},
  hsbc_pulse:{fee:"免費",note:"獎賞錢→Asia Miles/Avios，Reward+ App即時到賬"},
  hsbc_easy:{fee:"免費",note:"獎賞錢→Asia Miles/Avios，Reward+ App即時到賬"},
  hsbc_student:{fee:"免費",note:"獎賞錢→Asia Miles/Avios，Reward+ App即時到賬"},
  hsbc_premier:{fee:"免費",note:"獎賞錢→Asia Miles/Avios，Reward+ App即時到賬"},
  hsbc_everymile:{fee:"免費",note:"獎賞錢→Asia Miles/Avios，優惠兌換率1RC=20里"},
  hsbc_red:{fee:"免費",note:"獎賞錢→Asia Miles/Avios，Reward+ App即時到賬"},
  sc_cathay:{fee:"免費",note:"自動入Asia Miles戶口，免手動兌換"},
  sc_priority:{fee:"免費",note:"自動入Asia Miles戶口，免手動兌換"},
  dbs_black:{fee:"免費",note:"DBS$→Asia Miles，網上即時兌換免手續費"},
  ae_explorer:{fee:"免費",note:"MR積分→Asia Miles/Avios/多間，免費轉換，積分無限期"},
  ae_plat_cc:{fee:"$400/次",note:"MR積分→Asia Miles/Avios，每次$400手續費"},
  ae_plat_charge:{fee:"$400/次",note:"MR積分→Asia Miles/Avios，每次$400手續費"},
  citi_pm:{fee:"$200/次",note:"2026年3月起需手續費，ThankYou Points→Asia Miles"},
  citi_prestige:{fee:"$200/次",note:"2026年3月起需手續費，ThankYou Points→Asia Miles"},
  citi_rewards_m:{fee:"$200/次",note:"2026年3月起需手續費，Citi積分→Asia Miles"},
  ds_ba:{fee:"免費",note:"直接賺Avios，免轉換費"},
  mox_miles:{fee:"免費",note:"直接賺Asia Miles，免轉換費"},
  boc_cheers:{fee:"免費",note:"Cheers卡豁免兌換手續費"},
  boc_cheers_vs:{fee:"免費",note:"Cheers卡豁免兌換手續費"},
  boc_bliss:{fee:"$50/5000里",note:"每次上限$300，持Cheers卡可免費"},
  bea_sup:{fee:"免費",note:"直接賺Asia Miles/Avios，免轉換費"},
  hs_prestige:{fee:"免費",note:"直接賺Asia Miles，免轉換費"},
};

// Monthly cap amounts by card+scenario (approximate, for over-cap detection)
const CAP_AMT={
  hsbc_red:{onlineHKD:10000},
  hsbc_vs:{local:100000,dining:100000,onlineHKD:100000,onlineFX:100000,physicalFX:100000,travelJKSTA:1000000}, // annual
  hs_mmpower:{onlineHKD:10870,onlineFX:8929},
  hs_travel:{travelJKSTA:7576,physicalFX:10870,onlineFX:10870,dining:10870},
  boc_chill:{onlineHKD:3260,onlineFX:3260},
  boc_cheers:{dining:10000,onlineFX:25000,physicalFX:25000,travelJKSTA:25000},
  boc_cheers_vs:{dining:7500,onlineFX:18750,physicalFX:18750,travelJKSTA:18750},
  boc_sogo:{mobilePay:2000},
  boc_bliss:{onlineHKD:10000},
  cncbi_motion:{dining:3571,onlineHKD:3571},
  dbs_live:{onlineHKD:4000},
  dbs_eminent_vs:{dining:8000},
  dbs_eminent_plat:{dining:4000},
  dbs_compass:{supermarket:2000},
  aeon_waku:{onlineHKD:3571,travelJKSTA:3571},
  ds_wewa_vs:{travelJKSTA:5556,physicalFX:5556,onlineFX:5556,mobilePay:5556,onlineHKD:5556},
  ds_wewa_up:{travelJKSTA:5556,physicalFX:5556,onlineFX:5556,mobilePay:5556,onlineHKD:5556},
  ds_earnmore:{local:80000,dining:80000,onlineHKD:80000,onlineFX:80000,physicalFX:80000,travelJKSTA:80000}, // semi-annual
  sim_card:{onlineHKD:2500},
  bea_ititan:{onlineHKD:7500,mobilePay:7500}, // $300/month cap ÷ 4%
  ae_plat_charge:{onlineFX:15000,physicalFX:15000,travelJKSTA:15000}, // quarterly
  ae_explorer:{onlineFX:10000,physicalFX:10000,travelJKSTA:10000}, // quarterly promotional
  fubon_plat:{travelJKSTA:16000,physicalFX:16000},
  bea_world:{dining:10000,onlineFX:10000,physicalFX:10000,travelJKSTA:10000},
  ccb_eye:{dining:8888,onlineHKD:10000}, // dining cap = $800回贈 ÷ 9% ≈ $8,888
};

// ══ VERIFIED CARD DATABASE ══
// Rates expressed as decimal (0.04 = 4%). Miles as $/mile.
// Sources: flyformiles.hk, mrmiles.hk, hkcashrebate.com, bank official T&Cs (Mar 2026)
const CARDS=[
  // ── MILES ──
  mk("ae_explorer","AE Explorer","American Express","miles","基本$6/里，登記外幣優惠後$4.8/里，季度優惠$1.68/里(首$10,000)",0.006,{onlineFX:0.016,physicalFX:0.016,travelJKSTA:0.016},"$1.68/里季度首$10,000外幣+$10,000旅遊(需登記)",false,{local:6,dining:6,onlineHKD:6,onlineFX:4.8,travelJKSTA:4.8,physicalFX:4.8},{onlineFX:"⚠️ $1.68/里需登記兩個優惠，季度首$10,000，其後$4.8/里",physicalFX:"⚠️ $1.68/里需登記兩個優惠，季度首$10,000，其後$4.8/里",travelJKSTA:"⚠️ $1.68/里需登記兩個優惠，季度首$10,000，其後$4.8/里"}),
  mk("ae_plat_cc","AE 白金信用卡","American Express","miles","信用卡版(大頭)，本地/外幣$6/里",0.006,{},null,true,{local:6,dining:6,onlineHKD:6,onlineFX:6,travelJKSTA:6,physicalFX:6}),
  mk("ae_plat_charge","AE 白金卡（鋼卡/細頭）","American Express","miles","Charge Card，附Priority Pass，基本$9/里，外幣推廣期$2/里(季度$15,000上限)",0.004,{onlineFX:0.02,physicalFX:0.02,travelJKSTA:0.02},"外幣推廣期季度$15,000上限",false,{local:9,dining:9,onlineHKD:9,onlineFX:2,travelJKSTA:2,physicalFX:2},{onlineFX:"⚠️ $2/里需登記季度推廣，基本$9/里",physicalFX:"⚠️ $2/里需登記季度推廣，基本$9/里",travelJKSTA:"⚠️ $2/里需登記季度推廣，基本$9/里"},"2026-06-30"),
  mk("ae_blue","AE Blue Cash","American Express","cashback","1.2%所有消費，FCC 2%但CBF 0%",0.012,{},null,true),
  mk("sc_cathay","渣打國泰萬事達卡","Standard Chartered","miles","食飯/酒店/海外$4/里，其他$6/里，AAVS $6/里",0.006,{dining:0.018,onlineFX:0.02,physicalFX:0.02,travelJKSTA:0.02,octopus:0.006},null,true,{local:6,dining:4,onlineHKD:6,onlineFX:4,travelJKSTA:4,physicalFX:4,octopus:6}),
  mk("ds_ba","大新英國航空白金卡","Dah Sing","miles","Avios里數直接入賬，本地$6/Avios，外幣$4/Avios",0.006,{onlineFX:0.018,physicalFX:0.018,travelJKSTA:0.018},null,true,{local:6,dining:6,onlineHKD:6,onlineFX:4,travelJKSTA:4,physicalFX:4}),
  mk("hsbc_everymile","HSBC EveryMile","HSBC","miles","本地$5/里(1%)，指定日常$2/里(2.5%)，海外登記後$2/里(每階段需簽滿$12K觸發，$15K爆Cap)，配Travel Guru可再疊加",0.01,{physicalFX:0.025,travelJKSTA:0.025,octopus:0.004,supermarket:0.004},"海外每階段簽$12K起享$2/里，上限$225RC(≈$15K爆Cap)",false,{local:5,dining:5,onlineHKD:5,supermarket:12.5,octopus:12.5,octopusManual:12.5,onlineFX:5,travelJKSTA:2,physicalFX:2},{travelJKSTA:"⚠️ $2/里需Reward+登記+每階段簽滿$12,000觸發，簽$15,000爆Cap",physicalFX:"⚠️ $2/里需Reward+登記+每階段簽滿$12,000觸發，簽$15,000爆Cap"}),
  mk("citi_pm","Citi PremierMiles","Citibank","miles","外幣$4/里(滿$2萬$3/里)，里數永不過期",0.005,{onlineFX:0.02,physicalFX:0.02,travelJKSTA:0.02},null,true,{local:8,dining:8,onlineHKD:8,onlineFX:4,travelJKSTA:4,physicalFX:4}),
  mk("citi_prestige","Citi Prestige","Citibank","miles","高端卡，外幣$4/里+酒店住四送一，AAVS $6/里",0.006,{onlineFX:0.02,physicalFX:0.02,travelJKSTA:0.02,octopus:0.006},null,true,{local:6,dining:6,onlineHKD:6,onlineFX:4,travelJKSTA:4,physicalFX:4,octopus:6}),
  mk("citi_rewards_m","Citi Rewards","Citibank","both","指定購物/娛樂$3/里(≈1.85%)，流動支付5X≈1%，其他$15/里",0.003,{onlineHKD:0.0185,mobilePay:0.01},null,true,{local:15,dining:15,onlineHKD:3,onlineFX:15,travelJKSTA:15,physicalFX:15}),
  mk("dbs_black","DBS Black World MC","DBS","miles","外幣$4/里，其他$6/里，AAVS $6/里",0.005,{onlineFX:0.018,physicalFX:0.018,travelJKSTA:0.018,octopus:0.005},null,true,{local:6,dining:6,onlineHKD:6,onlineFX:4,travelJKSTA:4,physicalFX:4,octopus:6}),
  mk("mox_miles","MOX（Asia Miles）","Mox Bank","miles","所有消費$8/里，Asia Miles模式0%外幣手續費",0.005,{},null,true,{local:8,dining:8,onlineHKD:8,onlineFX:8,travelJKSTA:8,physicalFX:8},{local:"💡 維持$250K存款可升至$4/里",dining:"💡 維持$250K存款可升至$4/里",onlineFX:"💡 維持$250K存款可升至$4/里+0%手續費"}),

  // ── CASHBACK ──
  mk("hsbc_red","HSBC Red","HSBC","both","網購4%/$2.5里(月$10K)+指定商戶8%(壽司郎/譚仔/GU，月$1,250)，其他0.4%",0.004,{onlineHKD:0.04},"網購月度$10,000/指定商戶$1,250上限",false,{local:25,dining:25,onlineHKD:2.5,onlineFX:25,travelJKSTA:25,physicalFX:25},null,"2026-03-31"),
  mk("hsbc_vs","HSBC Visa Signature","HSBC","both","最紅自主9X=3.6%/$2.78里，配Travel Guru海外最高9.6%",0.004,{},"年度$100,000上限(最紅額外)",false,{local:25,dining:25,onlineHKD:25,onlineFX:25,travelJKSTA:25,physicalFX:25},{physicalFX:"⚠️ 9.6%需登記最紅自主賞世界+Travel Guru L3",travelJKSTA:"⚠️ 9.6%需登記最紅自主賞世界+Travel Guru L3"}),
  mk("hsbc_plat","HSBC Visa 白金卡","HSBC","cashback","基本0.4%獎賞錢，可配最紅自主+Travel Guru",0.004,{octopus:0.004,octopusManual:0.004},null,true,null,{physicalFX:"💡 登記Travel Guru可疊加海外+3%~6%",travelJKSTA:"💡 登記Travel Guru可疊加海外+3%~6%"}),
  mk("hsbc_gold","HSBC 金卡","HSBC","cashback","入門級，0.4%獎賞錢，可配最紅自主+Travel Guru",0.004,{octopus:0.004,octopusManual:0.004},null,true,null,{physicalFX:"💡 登記Travel Guru可疊加海外+3%~6%",travelJKSTA:"💡 登記Travel Guru可疊加海外+3%~6%"}),
  mk("hsbc_pulse","HSBC 銀聯 Pulse","HSBC","cashback","銀聯雙幣，內地消費免手續費，可配最紅自主+Guru",0.004,{octopus:0.004,octopusManual:0.004},null,true,null,{physicalFX:"💡 登記Travel Guru可疊加海外+3%~6%",travelJKSTA:"💡 登記Travel Guru可疊加海外+3%~6%"}),
  mk("hsbc_easy","HSBC easy 卡","HSBC","cashback","最紅自主2.4%，配合易賞錢最高4.8%，海外配Guru最高8.4%",0.004,{octopus:0.004,octopusManual:0.004},null,true,null,{physicalFX:"💡 登記Travel Guru可疊加海外+3%~6%",travelJKSTA:"💡 登記Travel Guru可疊加海外+3%~6%"}),
  mk("hsbc_student","HSBC 學生卡","HSBC","cashback","大學生專屬，可配最紅自主+Travel Guru",0.004,{octopus:0.004,octopusManual:0.004},null,true,null,{physicalFX:"💡 登記Travel Guru可疊加海外+3%~6%",travelJKSTA:"💡 登記Travel Guru可疊加海外+3%~6%"}),
  mk("hs_mmpower","恒生 MMPOWER","Hang Seng","cashback","海外外幣6%/網購5%，需登記+月簽$5K門檻",0.004,{onlineHKD:0.05,onlineFX:0.06},"需登記+簽滿$5,000，月度$500額外上限，優惠至2026年3月31日",false,null,{onlineHKD:"⚠️ 需登記+月簽滿$5,000，優惠至2026/3/31",onlineFX:"⚠️ 需登記+月簽滿$5,000，優惠至2026/3/31"},"2026-03-31"),
  mk("hs_travel","恒生 Travel+","Hang Seng","cashback","日韓泰中台澳門外幣7%，其他外幣/餐飲5%",0.004,{travelJKSTA:0.07,physicalFX:0.05,onlineFX:0.05,dining:0.05},"登記一次即可，簽滿$6,000起，月度$500額外上限",false,null,{travelJKSTA:"⚠️ 需登記一次+月簽滿$6,000",physicalFX:"⚠️ 需登記一次+月簽滿$6,000",onlineFX:"⚠️ 需登記一次+月簽滿$6,000",dining:"⚠️ 需登記一次+月簽滿$6,000"},"2026-12-31"),
  mk("hs_enjoy","恒生 enJoy 卡","Hang Seng","cashback","百佳屈臣氏豐澤指定商戶優惠",0.004,{},null,true),
  mk("hs_muji","恒生 Muji 卡","Hang Seng","cashback","MUJI消費額外積分獎賞",0.004,{onlineHKD:0.006},null,true),
  mk("hs_uni","恒生大學/大專卡","Hang Seng","cashback","學生專屬，永久免年費",0.004,{},null,true),
  mk("sc_simply","渣打 Simply Cash","Standard Chartered","cashback","本地1.5%/外幣2%，無上限，八達通AAVS 1.5%",0.015,{onlineFX:0.02,physicalFX:0.02,travelJKSTA:0.02,octopus:0.015,octopusManual:0.015},null,true),
  mk("sc_smart","渣打 Smart 卡","Standard Chartered","cashback","月簽$4K起0.56%/$15K起1.2%，特約商戶5%，免外幣手續費",0.0056,{},"需月簽$4,000起，特約商戶月度$5,000/年度$60,000上限",false,null,{local:"⚠️ 0.56%需月簽≥$4,000，$15K起升至1.2%"}),
  mk("sc_apoint","渣打 A. Point Card","Standard Chartered","cashback","積分兌換禮品或現金回贈",0.004,{},null,true),
  mk("boc_sogo","中銀 SOGO Visa Sig","Bank of China","cashback","流動支付5.4%，SOGO消費額外積分",0.004,{mobilePay:0.054},"手機支付月度$2,000上限(額外5%)",false,null,{mobilePay:"💡 狂賞派另加現金回贈(紅日+5%/平日+2%)",dining:"💡 狂賞派另加現金回贈(紅日+5%/平日+2%)"}),
  mk("boc_chill","中銀 Chill Card","Bank of China","cashback","網購5%/網上外幣5%(無門檻)，Chill商戶10%(需月簽$1,500實體)，海外實體0.4%",0.004,{onlineHKD:0.05,onlineFX:0.05},"月度額外$150上限(~$3,260爆Cap)",false,null,{onlineHKD:"💡 5%無需額外門檻 · 狂賞派另加現金回贈(紅日+5%/平日+2%)",onlineFX:"💡 5%無需額外門檻 · 狂賞飛另加現金回贈(紅日+5%/平日+2%)",physicalFX:"⚠️ 海外實體只有0.4%（5%只限網上外幣）"}),
  mk("boc_cheers","中銀 Cheers VI","Bank of China","both","食飯10X=$1.5/里或4%，外幣4%，年薪$60萬",0.004,{dining:0.04,onlineFX:0.04,physicalFX:0.04,travelJKSTA:0.04},"食飯$10k/外幣$25k分部上限(月合併封頂30萬分≈$30k)，需月簽$5,000",false,{local:10,dining:1.5,onlineHKD:10,onlineFX:4,travelJKSTA:4,physicalFX:4},{dining:"⚠️ 需月簽滿$5,000 · 💡狂賞派另加現金回贈(紅日+5%/平日+2%)",onlineFX:"⚠️ 需月簽滿$5,000 · 💡狂賞飛另加現金回贈(紅日+5%/平日+2%)",physicalFX:"⚠️ 需月簽滿$5,000 · 💡狂賞飛另加現金回贈(紅日+5%/平日+2%)",travelJKSTA:"⚠️ 需月簽滿$5,000 · 💡狂賞飛另加現金回贈(紅日+5%/平日+2%)"}),
  mk("boc_cheers_vs","中銀 Cheers VS","Bank of China","both","食飯8X=$1.9/里或3.2%，外幣3.2%，年薪$15萬",0.004,{dining:0.032,onlineFX:0.032,physicalFX:0.032,travelJKSTA:0.032},"食飯$7.5k/外幣$18.75k分部上限(月合併封頂18萬分≈$22.5k)，需月簽$5,000",false,{local:10,dining:1.9,onlineHKD:10,onlineFX:4.7,travelJKSTA:4.7,physicalFX:4.7},{dining:"⚠️ 需月簽滿$5,000 · 💡狂賞派另加現金回贈(紅日+5%/平日+2%)",onlineFX:"⚠️ 需月簽滿$5,000 · 💡狂賞飛另加現金回贈(紅日+5%/平日+2%)",physicalFX:"⚠️ 需月簽滿$5,000 · 💡狂賞飛另加現金回贈(紅日+5%/平日+2%)",travelJKSTA:"⚠️ 需月簽滿$5,000 · 💡狂賞飛另加現金回贈(紅日+5%/平日+2%)"}),
  mk("boc_taobao","中銀淘寶卡","Bank of China","cashback","淘寶RMB消費0%手續費+額外積分（銀聯卡）",0.004,{onlineHKD:0.006},null,true,null,{onlineHKD:"⚠️ 銀聯卡，不適用狂賞派/飛"}),
  mk("citi_cashback","Citi Cash Back","Citibank","cashback","食飯/酒店/外幣2%無上限，其他1%，八達通AAVS 1%",0.01,{dining:0.02,onlineFX:0.02,physicalFX:0.02,travelJKSTA:0.02,octopus:0.01,octopusManual:0.01},null,true),
  mk("citi_octopus","Citi Octopus","Citibank","cashback","八達通AAVS 0.5%+車費15%回贈(需Citi卡月簽$4,000)",0.005,{octopus:0.005},null,true,null,{octopus:"💡 車費15%回贈需所有Citi卡月簽滿$4,000"}),
  mk("citi_hktv","Citi HKTVMALL","Citibank","cashback","逢星期四HKTVmall 95折，其他0.4%",0.004,{onlineHKD:0.005},"星期四HKTVmall限定",true),
  mk("citi_club","Citi The Club","Citibank","cashback","賺Club積分兌換禮品，基本1%",0.01,{},null,true),
  mk("dbs_live","DBS Live Fresh","DBS","cashback","自選類別網購5%+基本0.4%=5.4%，網上外幣1%無上限，揀外幣類達6%",0.004,{onlineHKD:0.054,onlineFX:0.01},"自選5%月度$4,000上限，需App揀+單筆$300，基本0.4%需單筆$250，需InstaRedeem領",false,null,{onlineHKD:"⚠️ 需DBS Card+ App揀自選類別+單筆滿$300",onlineFX:"💡 揀「外幣」類別可達6%(5%+1%)"},"2026-06-30"),
  mk("dbs_eminent_vs","DBS Eminent VS","DBS","cashback","餐飲/健身/運動/醫療5%，Visa Sig版，每年登記+單筆$300",0.01,{dining:0.05},"月度$8,000上限(5%)，其他首$20K/月享1%",false,null,{dining:"⚠️ 需每年登記一次+每筆滿$300"},"2026-12-31"),
  mk("dbs_eminent_plat","DBS Eminent 白金","DBS","cashback","餐飲/健身/運動/醫療5%，白金版，每年登記+單筆$300",0.01,{dining:0.05},"月度$4,000上限(5%)，其他首$15K/月享1%",false,null,{dining:"⚠️ 需每年登記一次+每筆滿$300"},"2026-12-31"),
  mk("dbs_compass","DBS Compass Visa","DBS","cashback","逢星期三超市8%(滿$300)，其他0.4%",0.004,{supermarket:0.08},"超市$2,000/月上限(8%)，只限逢星期三，推廣至2026年5月",false,null,{supermarket:"⚠️ 只限逢星期三，單筆滿$300"},"2026-05-31"),
  mk("bea_goal","BEA GOAL","BEA","cashback","運動健身消費額外獎賞",0.004,{},null,true),
  mk("bea_world","BEA World MC","BEA","cashback","食飯/海外/電器/健身/醫療5%，App登記一次+月簽$4,000",0.004,{dining:0.05,onlineFX:0.05,physicalFX:0.05,travelJKSTA:0.05},"5%類別合計月度$10,000上限，不計歐洲及英國實體",false,null,{dining:"⚠️ 需App登記一次+月簽滿$4,000",onlineFX:"⚠️ 需App登記+月簽$4,000，不計歐洲及英國",physicalFX:"⚠️ 需App登記+月簽$4,000，不計歐洲及英國",travelJKSTA:"⚠️ 需App登記+月簽$4,000"}),
  mk("bea_ititan","BEA i-Titanium","BEA","cashback","網購/手機支付4%，月簽$2,000自動享有",0.004,{onlineHKD:0.04,mobilePay:0.04},"月度回贈$300上限(≈簽$7,500)，需累積零售滿$2,000",false,null,{onlineHKD:"⚠️ 需當月累積零售簽滿$2,000",mobilePay:"⚠️ 需當月累積零售簽滿$2,000"}),
  mk("bea_uni","BEA 大學/大專卡","BEA","cashback","學生專屬，永久免年費",0.004,{},null,true),
  mk("ds_wewa_vs","安信 WeWa Visa Sig","安信","cashback","Visa Sig版，手機支付/旅遊/海外/網上娛樂4%(4選1)，需滿$1,500/月",0.004,{},"月度額外$200上限(~$5,556爆Cap)",false,null,{travelJKSTA:"⚠️ 4%需自選此類別+當月簽滿$1,500",physicalFX:"⚠️ 4%需自選此類別+當月簽滿$1,500",onlineFX:"⚠️ 4%需自選此類別+當月簽滿$1,500",mobilePay:"⚠️ 4%需自選此類別+當月簽滿$1,500"}),
  mk("ds_wewa_up","安信 WeWa 銀聯卡","安信","cashback","銀聯版，手機支付/旅遊/海外/網上娛樂4%(4選1)，需滿$1,500/月，外幣手續費僅1%",0.004,{},"月度額外$200上限(~$5,556爆Cap)",false,null,{travelJKSTA:"⚠️ 4%需自選此類別+當月簽滿$1,500 · 銀聯FCC僅1%",physicalFX:"⚠️ 4%需自選此類別+當月簽滿$1,500 · 銀聯FCC僅1%",onlineFX:"⚠️ 4%需自選此類別+當月簽滿$1,500 · 銀聯FCC僅1%",mobilePay:"⚠️ 4%需自選此類別+當月簽滿$1,500 · 銀聯FCC僅1%"}),
  mk("ds_earnmore","安信 EarnMORE","安信","cashback","銀聯卡本地消費2%(推廣至2026/6/30)，外幣同樣2%(銀聯FCC僅1%，淨賺1%)，AAVS僅0.4%但Apple Pay手動增值2%",0.02,{onlineFX:0.02,physicalFX:0.02,travelJKSTA:0.02,octopus:0.004,octopusManual:0.02},"每半年$80,000上限(2%推廣)",false,null,{onlineFX:"⚠️ 外幣2%回贈 − 1%銀聯手續費 = 淨1%",physicalFX:"⚠️ 外幣2%回贈 − 1%銀聯手續費 = 淨1%",travelJKSTA:"⚠️ 外幣2%回贈 − 1%銀聯手續費 = 淨1%",octopus:"⚠️ 自動增值僅0.4%，Apple Pay手動增值先有2%"},"2026-06-30"),
  mk("cncbi_motion","信銀國際 Motion","CNCBI","cashback","食飯/網購6%（實際~5.7%因門檻>Cap），毋須登記",0.004,{dining:0.06,onlineHKD:0.06},"額外$200/月(簽$3,571爆Cap)，需當月零售簽滿$3,800",false,null,{dining:"⚠️ 需月簽滿$3,800，實際回贈約5.7%",onlineHKD:"⚠️ 需月簽滿$3,800，實際回贈約5.7%"},"2026-06-30"),
  mk("cncbi_gba","信銀國際大灣區卡","CNCBI","cashback","大灣區/外幣消費額外回贈",0.004,{onlineFX:0.015},null,true),
  mk("ds_oneplus","大新 ONE+","Dah Sing","cashback","1%無上限現金回贈",0.01,{},null,true),
  mk("ds_myauto","大新 MyAuto 車主卡","Dah Sing","cashback","油站汽車消費額外回贈",0.004,{},null,true),
  mk("ds_kitty","大新 Hello Kitty 白金卡","Dah Sing","cashback","限定版收藏卡",0.004,{},null,true),
  mk("sim_card","sim Credit Card","sim","cashback","網購高達8%，需當月非網上簽滿$1,000解鎖，免入息證明",0.004,{onlineHKD:0.08},"月度回贈$200上限(≈簽$2,500)，需非網上簽滿$1,000",false,null,{onlineHKD:"⚠️ 需當月非網上簽賬滿$1,000先解鎖8%"}),
  mk("mox_cb","MOX（CashBack）","Mox Bank","cashback","基本1%，超市3%（外幣1.95%手續費）",0.01,{supermarket:0.03,onlineFX:0.01,physicalFX:0.01},null,true,null,{local:"💡 維持$250K存款可升至2%",supermarket:"💡 維持$250K存款可升至5%",dining:"💡 維持$250K存款可升至2%"}),
  mk("ccb_eye","建行 eye Visa Sig","CCB Asia","cashback","網購/拍卡2%，食飯高達11%(2%基本+9%加碼)",0.004,{onlineHKD:0.02,dining:0.11},"食飯需每月1號App搶名額(~2,500個)+月簽滿$8,000，月度回贈上限$800(≈簽$8,888)",false,null,{dining:"⚠️ 需每月1號App搶名額+月簽滿$8,000"}),
  mk("aeon_basic","AEON 信用卡","AEON","cashback","AEON商店95折優惠",0.004,{},null,true),
  mk("aeon_waku","AEON WAKUWAKU","AEON","cashback","網購6%/日本3%/本地餐飲1%，永久免年費",0.004,{onlineHKD:0.06,travelJKSTA:0.03,dining:0.01},"額外$200/月結單周期上限(網購簽$3,571爆Cap)，海外3%只限日本",false,null,{onlineHKD:"⚠️ 以月結單日計算（非曆月）",travelJKSTA:"⚠️ 3%只限日本實體簽賬 · 以月結單日計算",dining:"⚠️ 以月結單日計算（非曆月）"},"2026-08-31"),
  mk("fubon_in","富邦 iN Visa 白金卡","Fubon","cashback","主打網購額外積分獎賞",0.004,{onlineHKD:0.006},null,true),
  mk("fubon_plat","富邦 Visa 白金卡","Fubon","cashback","日韓實體4%/台灣實體8%/其他外幣2%，推廣至2026年底",0.004,{travelJKSTA:0.04,physicalFX:0.02},"台灣月簽$5,333爆Cap/日韓月簽$16,000爆Cap",false,null,{travelJKSTA:"⚠️ 推廣期優惠至2026年底 · 台灣實體8%（非4%）",physicalFX:"⚠️ 推廣期優惠至2026年底 · 以月結單日計算"},"2026-12-31"),
  mk("icbc_star","工銀亞洲星座卡","ICBC Asia","cashback","基本回贈卡",0.004,{},null,true),
  // ── PREMIER BANKING CARDS ──
  mk("hsbc_premier","HSBC Premier MC","HSBC","both","基本$25/里(0.4%)，最紅自主類別$4.17/里(2.4%)，配Travel Guru海外最高8.4%",0.004,{octopus:0.004,octopusManual:0.004},"最紅自主年度$100,000上限（同其他HSBC卡共用）",false,{local:25,dining:25,onlineHKD:25,onlineFX:25,travelJKSTA:25,physicalFX:25},{physicalFX:"⚠️ 8.4%需登記最紅自主賞世界+Travel Guru L3",travelJKSTA:"⚠️ 8.4%需登記最紅自主賞世界+Travel Guru L3"}),
  mk("sc_priority","渣打 Priority Banking MC","Standard Chartered","miles","Priority客戶專屬，本地$8/里，海外$4/里",0.005,{onlineFX:0.018,physicalFX:0.018,travelJKSTA:0.018},null,true,{local:8,dining:8,onlineHKD:8,onlineFX:4,travelJKSTA:4,physicalFX:4}),
  mk("hs_prestige","恒生 Prestige Visa Infinite","Hang Seng","both","Prestige客戶，海外5%/食飯5%",0.004,{dining:0.05,onlineFX:0.05,physicalFX:0.05,travelJKSTA:0.05},"需簽滿$6,000/月，月度$500額外上限",false,{local:10,dining:2,onlineHKD:10,onlineFX:4,travelJKSTA:4,physicalFX:4},{dining:"⚠️ 需月簽滿$6,000",onlineFX:"⚠️ 需月簽滿$6,000",physicalFX:"⚠️ 需月簽滿$6,000",travelJKSTA:"⚠️ 需月簽滿$6,000"}),
  mk("boc_bliss","中銀 Bliss Card","Bank of China","both","指定網購6%/$1里，其他網購4%/$1.5里，實體0.4%",0.004,{onlineHKD:0.04},"月度$10,000上限(網購)，指定商戶6%",false,{local:25,dining:25,onlineHKD:1.5,onlineFX:25,travelJKSTA:25,physicalFX:25},{onlineHKD:"💡 指定商戶(Amazon/FARFETCH等)可達6% · 狂賞派另加現金回贈(紅日+5%/平日+2%)"}),
  mk("bea_sup","BEA Supreme","BEA","miles","東亞頂級卡，海外$5/里+機場Lounge",0.005,{onlineFX:0.015,physicalFX:0.015,travelJKSTA:0.015},null,true,{local:8,dining:8,onlineHKD:8,onlineFX:5,travelJKSTA:5,physicalFX:5}),
];

const SCENARIOS=[
  {id:"local",emoji:"🏠",label:"一般消費",sub:"實體拍卡/插卡"},
  {id:"dining",emoji:"🍴",label:"食飯",sub:"餐廳/外賣"},
  {id:"onlineHKD",emoji:"🛒",label:"網購 HKD",sub:"HKTVmall/淘寶等"},
  {id:"mobilePay",emoji:"📱",label:"流動支付",sub:"Apple Pay/Google Pay"},
  {id:"octopus",emoji:"🚇",label:"八達通增值",sub:"自動增值 AAVS"},
  {id:"supermarket",emoji:"🛍️",label:"超市",sub:"百佳/惠康"},
  {id:"onlineFX",emoji:"💻",label:"網上外幣",sub:"Amazon/Booking等"},
  {id:"physicalFX",emoji:"🌍",label:"海外實體",sub:"旅行碌卡"},
];
const ALL_SCENARIOS=[...SCENARIOS,{id:"travelJKSTA",emoji:"🇯🇵",label:"日韓泰中台",sub:"實體簽賬"},{id:"octopusManual",emoji:"📱",label:"手動增值",sub:"Apple Pay/八達通App"},{id:"manual",emoji:"💵",label:"手動記賬",sub:"現金/其他"}];

const ISSUERS=["HSBC","American Express","Hang Seng","Standard Chartered","Bank of China","Citibank","DBS","BEA","Dah Sing","安信","CNCBI","Mox Bank","CCB Asia","AEON","Fubon","ICBC Asia","sim"];
const S_LIGHT={bg:"#F2F2F7",dark:"#1C1C1E",label:"#8E8E93",sec:"#3C3C43",sep:"rgba(0,0,0,0.05)",blue:"#007AFF",green:"#34C759",red:"#FF3B30",shadow:"0 14px 34px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.03)",rad:24,card:"#fff",headerBg:"rgba(249,249,251,0.94)",tabBg:"rgba(249,249,251,0.94)",segBg:"rgba(118,118,128,0.12)",segInd:"#fff",inputBg:"rgba(0,0,0,0.06)",subtleBg:"rgba(118,118,128,0.04)",cardAlt:"#F8F8FA"};
const S_DARK={bg:"#000000",dark:"#F5F5F7",label:"#8E8E93",sec:"#D1D1D6",sep:"rgba(255,255,255,0.1)",blue:"#0A84FF",green:"#30D158",red:"#FF453A",shadow:"0 2px 8px rgba(0,0,0,0.4)",rad:24,card:"#1C1C1E",headerBg:"rgba(28,28,30,0.94)",tabBg:"rgba(28,28,30,0.94)",segBg:"rgba(118,118,128,0.24)",segInd:"#636366",inputBg:"rgba(255,255,255,0.08)",subtleBg:"rgba(255,255,255,0.04)",cardAlt:"#2C2C2E"};

// 2026 H1 BOC 狂賞派/飛「紅日」列表（星期日+公眾假期+BOC額外紅日）
const BOC_RED_DAYS=new Set([
  "2026-01-01","2026-01-04","2026-01-11","2026-01-18","2026-01-25",
  "2026-02-01","2026-02-08","2026-02-14","2026-02-15","2026-02-17","2026-02-18","2026-02-19","2026-02-22",
  "2026-03-01","2026-03-08","2026-03-15","2026-03-22","2026-03-29",
  "2026-04-03","2026-04-04","2026-04-05","2026-04-06","2026-04-07","2026-04-12","2026-04-19","2026-04-26",
  "2026-05-01","2026-05-03","2026-05-10","2026-05-17","2026-05-24","2026-05-25","2026-05-31",
  "2026-06-07","2026-06-14","2026-06-19","2026-06-21","2026-06-28"
]);
const BOC_PROMO_END="2026-06-30";
const BOC_VISA_IDS=["boc_sogo","boc_chill","boc_cheers","boc_cheers_vs","boc_bliss"]; // 狂賞派 Visa only (排除淘寶卡=銀聯)
const BOC_FLY_IDS=["boc_sogo","boc_chill","boc_cheers","boc_cheers_vs","boc_bliss"]; // 狂賞飛 Visa+MC (排除銀聯)
function isRedDay(d){const ds=(d||new Date()).toLocaleDateString("sv-SE",{timeZone:"Asia/Hong_Kong"});return BOC_RED_DAYS.has(ds);}
function isBocPromoActive(d){return(d||new Date()).toLocaleDateString("sv-SE",{timeZone:"Asia/Hong_Kong"})<=BOC_PROMO_END;}

const ISSUER_COLORS={"HSBC":{bg:"#DB0011",short:"滙豐"},"Hang Seng":{bg:"#00A84F",short:"恒生"},"Standard Chartered":{bg:"#0072AA",short:"渣打"},"Bank of China":{bg:"#C41230",short:"中銀"},"Citibank":{bg:"#003DA5",short:"Citi"},"DBS":{bg:"#E31837",short:"DBS"},"BEA":{bg:"#003B6F",short:"東亞"},"American Express":{bg:"#016FD0",short:"AE"},"安信":{bg:"#FF6B00",short:"安信"},"Mox Bank":{bg:"#6B4EFF",short:"MOX"},"CNCBI":{bg:"#D4001A",short:"信銀"},"AEON":{bg:"#E60039",short:"AEON"},"Fubon":{bg:"#0066B3",short:"富邦"},"Dah Sing":{bg:"#00529B",short:"大新"},"CCB Asia":{bg:"#003DA6",short:"建行"},"ICBC Asia":{bg:"#D71920",short:"工銀"},"sim":{bg:"#FF4D00",short:"sim"}};

function getRate(c,s,vs,guru,moxTier,dbsLfFx,wewaCat,bocMs,bocMf,regs){
  // Registration-gated rates (v1.2)
  if(c.id==="ae_explorer"&&["onlineFX","physicalFX","travelJKSTA"].includes(s)&&regs&&!regs.aeExplorerReg)return 0.006;
  if(c.id==="ae_plat_charge"&&["onlineFX","physicalFX","travelJKSTA"].includes(s)&&regs&&!regs.aeChargeReg)return 0.004;
  if(c.id==="hs_mmpower"&&regs&&!regs.mmpowerReg)return 0.004;
  if(c.id==="hs_travel"&&regs&&!regs.travelPlusReg)return 0.004;
  if((c.id==="dbs_eminent_vs"||c.id==="dbs_eminent_plat")&&s==="dining"&&regs&&!regs.dbsEminentReg)return 0.01;
  if(c.id==="bea_world"&&regs&&!regs.beaWorldReg)return 0.004;
  if(c.id==="ccb_eye"&&s==="dining"&&regs&&!regs.ccbEyeReg)return 0.02;
  // MOX tiered rewards
  if(c.id==="mox_cb"&&moxTier)return s==="supermarket"?0.05:0.02; // 5% super, 2% others
  if(c.id==="mox_miles"&&moxTier)return 0.01; // $4/里 = 1.25% RC equivalent

  // DBS Live Fresh self-select: "none"=base only (but FX still 1%), "fx"=onlineFX 6%, "other"=onlineHKD 5.4%
  if(c.id==="dbs_live"){
    if(dbsLfFx==="none")return s==="onlineFX"?0.01:0.004; // 未登記，外幣仍有1%
    if(dbsLfFx==="fx"&&s==="onlineFX")return 0.06; // 5% self-select + 1% FX base
    if(dbsLfFx==="fx"&&s==="onlineHKD")return 0.004; // base only when FX selected
    // default "other": onlineHKD=0.054 from override, onlineFX=0.01 from override
  }

  // WeWa 4選1 dynamic category
  if(c.id==="ds_wewa_vs"||c.id==="ds_wewa_up"){
    const wewaMap={travel:["travelJKSTA","physicalFX"],overseas:["onlineFX"],mobilePay:["mobilePay"],entertainment:["onlineHKD"]};
    const boosted=(wewaMap[wewaCat||"travel"])||[];
    return boosted.includes(s)?0.04:0.004;
  }

  // EveryMile + Travel Guru (base overseas = 2.5% with promo, guru stacks)
  if(c.id==="hsbc_everymile"&&["physicalFX","travelJKSTA"].includes(s)){
    const base=regs&&!regs.everyMileReg?0.01:0.025; // unreg: 1%, reg: 2.5%
    if(!guru||guru==="none")return base;
    const guruExtra=guru==="L3"?0.06:guru==="L2"?0.04:0.03;
    return base+guruExtra;
  }

  // 最紅自主獎賞 + Travel Guru — 適用 VS/白金/金卡/easy/Premier/Pulse/Student (NOT Red, NOT EveryMile)
  const vsCards=["hsbc_vs","hsbc_plat","hsbc_gold","hsbc_pulse","hsbc_easy","hsbc_student","hsbc_premier"];
  if(vsCards.includes(c.id)){
    const vsMap={world:["onlineFX","physicalFX","travelJKSTA"],savour:["dining"],home:["supermarket"],lifestyle:["local"],shopping:["onlineHKD"]};
    const boosted=(vs&&vs!=="none")?(vsMap[vs]||[]):[];
    const isBoosted=boosted.includes(s);

    // Travel Guru stacks on physicalFX/travelJKSTA
    if(["physicalFX","travelJKSTA"].includes(s)){
      let rate=0.004; // base 1X = 0.4%
      if(c.id==="hsbc_vs")rate=isBoosted?0.036:0.016; // 9X or 4X
      else rate=isBoosted?0.024:0.004; // 6X or 1X
      if(guru&&guru!=="none"){
        const guruExtra=guru==="L3"?0.06:guru==="L2"?0.04:0.03;
        return rate+guruExtra;
      }
      return rate;
    }

    // Non-guru scenarios: 最紅自主 only
    if(isBoosted){
      if(c.id==="hsbc_vs")return 0.036;
      if(c.id==="hsbc_premier")return 0.024;
      return 0.024;
    }
    return c.cashback[s]||0;
  }
  // BOC 狂賞派/飛: NOT added to getRate — displayed separately in UI
  return c.cashback[s]||0;
}

// BOC 狂賞派/飛 bonus calculator (separate from card's own rate)
function getBocBonus(c,s,bocMs,bocMf){
  if(c.issuer!=="Bank of China"||!isBocPromoActive())return 0;
  let bonus=0;const rd=isRedDay();
  if(bocMs==="registered"&&BOC_VISA_IDS.includes(c.id)){
    if(["dining","supermarket","local"].includes(s))bonus+=rd?0.05:0.02;
    if(s==="onlineHKD")bonus+=rd?0.05:0.02;
  }
  if(bocMf==="registered"&&BOC_FLY_IDS.includes(c.id)&&["physicalFX","travelJKSTA"].includes(s)){
    bonus+=rd?0.05:0.02;
  }
  return bonus;
}

function getMPD(c,s,vs,guru,moxTier,dbsLfFx,wewaCat,regs){
  if(!c.milesPerDollar)return null;
  // Registration-gated miles rates (v1.2)
  if(c.id==="ae_explorer"&&["onlineFX","physicalFX","travelJKSTA"].includes(s)&&regs&&!regs.aeExplorerReg)return 6;
  if(c.id==="ae_plat_charge"&&["onlineFX","physicalFX","travelJKSTA"].includes(s)&&regs&&!regs.aeChargeReg)return 9;
  // MOX tiered
  if(c.id==="mox_miles"&&moxTier)return 4; // $4/里 with $250k savings

  // EveryMile + Travel Guru (1RC=20miles, base overseas 2.5% with promo)
  if(c.id==="hsbc_everymile"&&["physicalFX","travelJKSTA"].includes(s)){
    const base=regs&&!regs.everyMileReg?0.01:0.025;
    if(!guru||guru==="none")return regs&&!regs.everyMileReg?5:2; // unreg $5/里, reg $2/里
    const guruExtra=guru==="L3"?0.06:guru==="L2"?0.04:0.03;
    const totalRc=base+guruExtra;
    const milesPerDollar=totalRc*20; // EveryMile 1RC=20miles
    return milesPerDollar>0?(1/milesPerDollar):null;
  }

  const vsCards=["hsbc_vs","hsbc_plat","hsbc_gold","hsbc_pulse","hsbc_easy","hsbc_student","hsbc_premier"];
  if(vsCards.includes(c.id)&&c.milesPerDollar){
    const vsMap={world:["onlineFX","physicalFX","travelJKSTA"],savour:["dining"],home:["supermarket"],lifestyle:["local"],shopping:["onlineHKD"]};
    const boosted=(vs&&vs!=="none")?(vsMap[vs]||[]):[];
    const isBoosted=boosted.includes(s);

    // Travel Guru stacks on physicalFX/travelJKSTA — 1RC=10miles for non-EveryMile HSBC cards
    if(["physicalFX","travelJKSTA"].includes(s)){
      let rcPct=0.004;
      if(c.id==="hsbc_vs")rcPct=isBoosted?0.036:0.016;
      else rcPct=isBoosted?0.024:0.004;
      if(guru&&guru!=="none"){
        const guruExtra=guru==="L3"?0.06:guru==="L2"?0.04:0.03;
        const totalRc=rcPct+guruExtra;
        const milesPerDollar=totalRc*10;
        return milesPerDollar>0?(1/milesPerDollar):null;
      }
      // No guru: convert RC% to $/mile
      const milesPerDollar=rcPct*10;
      return milesPerDollar>0?(1/milesPerDollar):null;
    }

    // Non-guru scenarios: 最紅自主 only
    if(isBoosted){
      if(c.id==="hsbc_vs")return 2.78; // 9X
      if(c.id==="hsbc_premier")return 4.17; // 6X
      return 4.17; // 6X for other HSBC cards
    }
    return c.milesPerDollar[s]||c.milesPerDollar["local"]||null;
  }
  const mpd=c.milesPerDollar[s]||c.milesPerDollar["local"];
  return mpd||null;
}

function doCalc(sc,amt,own,mode,vs,guru,moxTier,dbsLfFx,wewaCategory,bocMs,bocMf,regs){
  const r={primary:null,fallback:null,globalBest:null};
  if(!amt||amt<=0)return r;
  try{
    const oc=CARDS.filter(c=>own.includes(c.id));
    if(mode==="cashback"){
      let b=null,br=-1;oc.forEach(c=>{const x=getRate(c,sc,vs,guru,moxTier,dbsLfFx,wewaCategory,bocMs,bocMf,regs);if(x>br){br=x;b=c;}});
      if(b){const cap=CAP_AMT[b.id]&&CAP_AMT[b.id][sc];r.primary={card:b,rate:br,val:amt*br,fxFee:FX_SCENARIOS.includes(sc)?getFxFee(b,sc):0,overCap:cap?amt>cap:false,capAmt:cap||0};}
      // Fallback: first try owned no-cap cards, then all cards
      if(b&&!b.noCap){
        let f=null,fr=-1;
        oc.filter(c=>c.noCap&&c.id!==b.id).forEach(c=>{const x=getRate(c,sc,vs,guru,moxTier,dbsLfFx,wewaCategory,bocMs,bocMf,regs);if(x>fr){fr=x;f=c;}});
        if(f){r.fallback={card:f,rate:fr,val:amt*fr,notOwned:false,fxFee:FX_SCENARIOS.includes(sc)?getFxFee(f,sc):0};}
        else{CARDS.filter(c=>c.noCap&&c.id!==b.id).forEach(c=>{const x=getRate(c,sc,vs,guru,moxTier,dbsLfFx,wewaCategory,bocMs,bocMf,regs);if(x>fr){fr=x;f=c;}});if(f)r.fallback={card:f,rate:fr,val:amt*fr,notOwned:true,fxFee:FX_SCENARIOS.includes(sc)?getFxFee(f,sc):0};}
      }
      // GlobalBest: find best card that can actually handle this amount
      let g=null,gr=-1;CARDS.forEach(c=>{
        const x=getRate(c,sc,vs,guru,moxTier,dbsLfFx,wewaCategory,bocMs,bocMf,regs);
        const cap=CAP_AMT[c.id]&&CAP_AMT[c.id][sc];
        if(cap&&amt>cap)return;
        if(guru&&guru!=="none"&&["hsbc_everymile","hsbc_vs","hsbc_plat","hsbc_gold","hsbc_pulse","hsbc_easy","hsbc_student","hsbc_premier"].includes(c.id)&&["physicalFX","travelJKSTA"].includes(sc)){
          const eCap=guru==="L3"?36667:guru==="L2"?30000:16667;
          if(amt>eCap)return;
        }
        if(x>gr){gr=x;g=c;}
      });
      // If no uncapped card found, fallback to best noCap card
      if(!g){CARDS.filter(c=>c.noCap).forEach(c=>{const x=getRate(c,sc,vs,guru,moxTier,dbsLfFx,wewaCategory,bocMs,bocMf,regs);if(x>gr){gr=x;g=c;}});}
      if(g)r.globalBest={card:g,rate:gr,val:amt*gr};
    }else{
      const im=c=>c.type==="miles"||c.type==="both";
      let b=null,bm=Infinity;oc.filter(im).forEach(c=>{const m=getMPD(c,sc,vs,guru,moxTier,dbsLfFx,wewaCategory,regs);if(m&&m<bm){bm=m;b=c;}});
      if(b&&bm<Infinity){const cap=CAP_AMT[b.id]&&CAP_AMT[b.id][sc];r.primary={card:b,rate:bm,val:amt/bm,miles:true,fxFee:FX_SCENARIOS.includes(sc)?getFxFee(b,sc):0,overCap:cap?amt>cap:false,capAmt:cap||0};}
      // Fallback: first try owned no-cap miles cards, then all
      if(b&&!b.noCap){
        let f=null,fm=Infinity;
        oc.filter(c=>im(c)&&c.noCap&&c.id!==b.id).forEach(c=>{const m=getMPD(c,sc,vs,guru,moxTier,dbsLfFx,wewaCategory,regs);if(m&&m<fm){fm=m;f=c;}});
        if(f&&fm<Infinity){r.fallback={card:f,rate:fm,val:amt/fm,miles:true,notOwned:false,fxFee:FX_SCENARIOS.includes(sc)?getFxFee(f,sc):0};}
        else{CARDS.filter(c=>im(c)&&c.noCap&&c.id!==b.id).forEach(c=>{const m=getMPD(c,sc,vs,guru,moxTier,dbsLfFx,wewaCategory,regs);if(m&&m<fm){fm=m;f=c;}});if(f&&fm<Infinity)r.fallback={card:f,rate:fm,val:amt/fm,miles:true,notOwned:true,fxFee:FX_SCENARIOS.includes(sc)?getFxFee(f,sc):0};}
      }
      // GlobalBest miles: check cap (including EveryMile dynamic cap)
      let g=null,gm=Infinity;CARDS.filter(im).forEach(c=>{
        const m=getMPD(c,sc,vs,guru,moxTier,dbsLfFx,wewaCategory,regs);
        const cap=CAP_AMT[c.id]&&CAP_AMT[c.id][sc];
        if(cap&&amt>cap)return;
        // EveryMile dynamic cap
        if(guru&&guru!=="none"&&["hsbc_everymile","hsbc_vs","hsbc_plat","hsbc_gold","hsbc_pulse","hsbc_easy","hsbc_student","hsbc_premier"].includes(c.id)&&["physicalFX","travelJKSTA"].includes(sc)){
          const eCap=guru==="L3"?36667:guru==="L2"?30000:16667;
          if(amt>eCap)return;
        }
        if(m&&m<gm){gm=m;g=c;}
      });
      if(!g){CARDS.filter(c=>im(c)&&c.noCap).forEach(c=>{const m=getMPD(c,sc,vs,guru,moxTier,dbsLfFx,wewaCategory,regs);if(m&&m<gm){gm=m;g=c;}});}
      if(g&&gm<Infinity)r.globalBest={card:g,rate:gm,val:amt/gm,miles:true};
    }
  }catch(e){console.error(e);}
  // Dynamic capInfo for Travel Guru cards (shared cap pool)
  const allGuruCards=["hsbc_everymile","hsbc_vs","hsbc_plat","hsbc_gold","hsbc_pulse","hsbc_easy","hsbc_student","hsbc_premier"];
  if(guru&&guru!=="none"&&r.primary&&allGuruCards.includes(r.primary.card.id)&&["physicalFX","travelJKSTA"].includes(sc)){
    const guruCaps={L1:{cap:16667,label:"GO級(上限$500RC)"},L2:{cap:30000,label:"GING級(上限$1,200RC)"},L3:{cap:36667,label:"GURU級(上限$2,200RC)"}};
    const g=guruCaps[guru];
    if(g){
      r.primary.card={...r.primary.card,capInfo:`Travel Guru ${g.label}：簽$${g.cap.toLocaleString()}爆Cap`};
      r.primary.overCap=amt>g.cap;
      r.primary.capAmt=g.cap;
    }
  }
  // DBS Eminent: 5% requires each transaction ≥ $300
  if(r.primary&&(r.primary.card.id==="dbs_eminent_vs"||r.primary.card.id==="dbs_eminent_plat")&&sc==="dining"&&amt<300){
    r.primary.rate=0.01;r.primary.val=amt*0.01;
    r.primary.card={...r.primary.card,capInfo:null};
    r.primary.minWarning="⚠️ DBS Eminent 5% 需每筆滿 $300，此筆只得 1%";
  }
  // DBS Compass: 8% requires each transaction ≥ $300
  if(r.primary&&r.primary.card.id==="dbs_compass"&&sc==="supermarket"&&amt<300){
    r.primary.rate=0.004;r.primary.val=amt*0.004;
    r.primary.card={...r.primary.card,capInfo:null};
    r.primary.minWarning="⚠️ DBS Compass 超市 8% 需單筆滿 $300，此筆只得 0.4%";
  }
  // DBS Live Fresh: base 0.4% requires each transaction ≥ $250 to earn DBS$
  if(r.primary&&r.primary.card.id==="dbs_live"&&amt<250&&r.primary.rate<=0.004){
    r.primary.rate=0;r.primary.val=0;
    r.primary.minWarning="⚠️ DBS Live Fresh 基本回贈需單筆滿 $250 先有 DBS$，此筆冇回贈";
  }
  // After min-amount downgrade: swap to better card if available
  if(r.primary&&r.primary.minWarning){
    const downgraded=r.primary;
    if(r.fallback&&r.fallback.rate>downgraded.rate){
      r.primary={...r.fallback};r.fallback=downgraded;
    }else{
      // Check all owned cards for a better option
      const oc=CARDS.filter(c=>own.includes(c.id)&&c.id!==downgraded.card.id);
      let best=null,br=downgraded.rate;
      oc.forEach(c=>{const x=mode==="cashback"?getRate(c,sc,vs,guru,moxTier,dbsLfFx,wewaCategory,bocMs,bocMf,regs):0;if(x>br){br=x;best=c;}});
      if(best){r.primary={card:best,rate:br,val:amt*br,fxFee:FX_SCENARIOS.includes(sc)?getFxFee(best,sc):0};r.fallback=downgraded;}
    }
  }
  // If over cap: swap to best available no-cap card
  if(r.primary&&r.primary.overCap){
    r.cappedOriginal=r.primary;
    if(r.fallback){
      // User owns a no-cap fallback → use it
      r.primary={...r.fallback,swappedFrom:r.cappedOriginal.card.name};
      r.fallback=null;
    }else if(r.globalBest&&r.globalBest.card.id!==r.primary.card.id){
      // User has no owned fallback → recommend globalBest (mark as not owned)
      r.primary={...r.globalBest,swappedFrom:r.cappedOriginal.card.name,notOwned:!own.includes(r.globalBest.card.id),fxFee:FX_SCENARIOS.includes(sc)?getFxFee(r.globalBest.card,sc):0};
      r.fallback=null;
    }
  }
  return r;
}

function Badge({type,dark}){
  const cfg=type==="miles"?{bg:dark?"rgba(88,86,214,0.15)":"#F0EDFF",c:"#5856D6",t:"✈️ 里數"}:type==="both"?{bg:dark?"rgba(175,82,222,0.15)":"#F5F0FF",c:"#AF52DE",t:"✈️💰 兩用"}:{bg:dark?"rgba(52,199,89,0.15)":"#E8FAF0",c:dark?"#30D158":"#34C759",t:"💰 現金"};
  return <span style={{fontSize:10,fontWeight:600,padding:"2px 8px",borderRadius:99,background:cfg.bg,color:cfg.c}}>{cfg.t}</span>;
}

function getScenarioDesc(card,sc,rate,isCB,vs){
  const pct=(rate*100).toFixed(1);
  const capInfo=CAP_AMT[card.id]&&CAP_AMT[card.id][sc];
  const annualCapCards=["hsbc_vs","ds_earnmore"]; // caps are annual not monthly
  const allGuruIds=["hsbc_everymile","hsbc_vs","hsbc_plat","hsbc_gold","hsbc_pulse","hsbc_easy","hsbc_student","hsbc_premier"];
  const isGuruScenario=allGuruIds.includes(card.id)&&["physicalFX","travelJKSTA"].includes(sc);
  const capStr=capInfo?(annualCapCards.includes(card.id)?`年度$${capInfo.toLocaleString()}上限`:`月度$${capInfo.toLocaleString()}上限`):isGuruScenario?"Travel Guru上限":card.noCap?"無上限":card.capInfo?"有上限":"無上限";
  const scenarioNames={local:"一般消費",dining:"食飯",onlineHKD:"網購HKD",mobilePay:"流動支付",octopus:"八達通自動增值",octopusManual:"八達通手動增值",supermarket:"超市",onlineFX:"網上外幣",travelJKSTA:"日韓泰中台",physicalFX:"海外實體"};
  const sn=scenarioNames[sc]||sc;
  if(isCB)return `${sn} ${pct}% 回贈（${capStr}）`;
  return `${sn} $${parseFloat(rate.toFixed(2))}/里（${capStr}）`;
}

export default function App(){
  const[darkPref,setDarkPref]=useState(()=>{try{return localStorage.getItem("sw_dark")||"auto";}catch{return "auto";}});
  const[systemDark,setSystemDark]=useState(()=>window.matchMedia?.("(prefers-color-scheme: dark)").matches||false);
  useEffect(()=>{const mq=window.matchMedia?.("(prefers-color-scheme: dark)");if(!mq)return;const h=e=>setSystemDark(e.matches);mq.addEventListener("change",h);return()=>mq.removeEventListener("change",h);},[]);
  const darkMode=darkPref==="auto"?systemDark:darkPref==="dark";
  useEffect(()=>{try{localStorage.setItem("sw_dark",darkPref);}catch{}},[darkPref]);
  const[themeModal,setThemeModal]=useState(false);
  const S=darkMode?S_DARK:S_LIGHT;
  const[tab,setTabRaw]=useState("calc");
  const scrollTop=()=>window.scrollTo({top:0,behavior:"smooth"});
  const setTab=(t)=>{setTabRaw(t);setTimeout(()=>window.scrollTo({top:0,behavior:"smooth"}),50);};
  const[mode,setMode]=useState("cashback");
  const[sc,setSc]=useState("local");
  const[amt,setAmt]=useState(0);
  const[sMax,setSMax]=useState(3000);
  const[own,setOwn]=useState([]);
  const[vs,setVs]=useState("none");
  const[guru,setGuru]=useState("none");
  const[modal,setModal]=useState(null);
  const[tut,setTut]=useState(0);
  const[seen,setSeen]=useState(false);
  const[search,setSearch]=useState("");
  const[guideMode,setGuideMode]=useState("cashback");
  const[guideSc,setGuideSc]=useState("local");
  const[guideSettings,setGuideSettings]=useState(false);
  const[guideExpanded,setGuideExpanded]=useState(new Set());
  const[guideOvr,setGuideOvr]=useState(null); // null=use global, object=guide-local overrides
  const[guideToast,setGuideToast]=useState(null);
  const showGuideToast=(msg)=>{setGuideToast(msg);setTimeout(()=>setGuideToast(null),2500);};
  const[trackerView,setTrackerView]=useState("card");
  const[trackerSort,setTrackerSort]=useState("desc"); // "desc" high→low, "asc" low→high
  const[logDate,setLogDate]=useState(()=>new Date().toISOString().slice(0,10));
  const[logMemo,setLogMemo]=useState("");
  const[logOther,setLogOther]=useState(false);
  const[logCash,setLogCash]=useState(false);
  // cycleDay removed — use calendar month, warn about statement dates
  const[manualOpen,setManualOpen]=useState(false);
  const[resetStep,setResetStep]=useState(0);
  const[manualAmt,setManualAmt]=useState("");
  const[manualMemo,setManualMemo]=useState("");
  const[manualDate,setManualDate]=useState(()=>new Date().toISOString().slice(0,10));
  const[manualType,setManualType]=useState("cash");
  const[manualSc,setManualSc]=useState("local"); // cash, octopus, other
  const[fxSub,setFxSub]=useState(false);
  const[octSub,setOctSub]=useState(false);
  const[guideFxSub,setGuideFxSub]=useState(false);
  const[guideOctSub,setGuideOctSub]=useState(false);
  const[fxCur,setFxCur]=useState("HKD");
  const FX_FALLBACK={HKD:1,JPY:0.0516,USD:7.81,GBP:9.92,EUR:8.41,THB:0.223,KRW:0.00575,TWD:0.241,CNY:1.08,AUD:5.08,SGD:5.82,MYR:1.77};
  const[FX_RATES,setFxRates]=useState(FX_FALLBACK);
  const[fxLive,setFxLive]=useState(false);
  useEffect(()=>{
    let cancel=false;
    (async()=>{try{
      const r=await fetch("https://open.er-api.com/v6/latest/HKD");
      const d=await r.json();
      if(cancel||!d.rates)return;
      const map={HKD:1};
      const want=["JPY","USD","GBP","EUR","THB","KRW","TWD","CNY","AUD","SGD","MYR"];
      want.forEach(c=>{if(d.rates[c])map[c]=Math.round(1/d.rates[c]*10000)/10000;});
      if(!cancel){setFxRates(map);setFxLive(true);}
    }catch(e){/* use fallback */}})();
    return()=>{cancel=true;};
  },[]);
  const fxToHKD=fxCur==="HKD"?amt:Math.round(amt*FX_RATES[fxCur]);
  const[editMax,setEditMax]=useState(false);
  const[editQuick,setEditQuick]=useState(false);
  const[quickAmts,setQuickAmts]=useState([50,100,200,500,1000]);
  const[hsbcOpen,setHsbcOpen]=useState(false);
  const[moxTier,setMoxTier]=useState(false);
  const[dbsLfFx,setDbsLfFx]=useState("none"); // DBS Live Fresh: "none"=未登記, "other"=娛樂/服飾/旅遊, "fx"=外幣
  const[wewaCategory,setWewaCategory]=useState("travel"); // WeWa 4選1: travel/overseas/mobilePay/entertainment
  const[bocMs,setBocMs]=useState("none"); // BOC 狂賞派 (Visa only): none/registered
  const[bocMf,setBocMf]=useState("none"); // BOC 狂賞飛 (Visa/MC, 排除銀聯): none/registered
  const[moxOpen,setMoxOpen]=useState(false);
  const[dbsOpen,setDbsOpen]=useState(false);
  const[wewaOpen,setWewaOpen]=useState(false);
  const[bocOpen,setBocOpen]=useState(false);
  const[aeOpen,setAeOpen]=useState(false);
  const[hsOpen,setHsOpen]=useState(false);
  const[beaOpen,setBeaOpen]=useState(false);
  const[ccbOpen,setCcbOpen]=useState(false);
  // Registration toggles (v1.2)
  const[aeExplorerReg,setAeExplorerReg]=useState(true);
  const[aeChargeReg,setAeChargeReg]=useState(true);
  const[everyMileReg,setEveryMileReg]=useState(true);
  const[mmpowerReg,setMmpowerReg]=useState(true);
  const[travelPlusReg,setTravelPlusReg]=useState(true);
  const[dbsEminentReg,setDbsEminentReg]=useState(true);
  const[beaWorldReg,setBeaWorldReg]=useState(true);
  const[ccbEyeReg,setCcbEyeReg]=useState(true);
  const regs={aeExplorerReg,aeChargeReg,everyMileReg,mmpowerReg,travelPlusReg,dbsEminentReg,beaWorldReg,ccbEyeReg};
  const[calcExpanded,setCalcExpanded]=useState(false); // false, true (more cards), "wallet" (cheat sheet)
  const[walletOpen,setWalletOpen]=useState(false);
  const[toast,setToast]=useState(null); // {msg, type}
  const[installPrompt,setInstallPrompt]=useState(null);
  useEffect(()=>{const h=e=>{e.preventDefault();setInstallPrompt(e);};window.addEventListener("beforeinstallprompt",h);return()=>window.removeEventListener("beforeinstallprompt",h);},[]);
  const[bankFilter,setBankFilter]=useState([]); // [] = show all, or array of issuer names
  const[histMonth,setHistMonth]=useState(()=>{const n=new Date();return`${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,"0")}`;});
  // Tracker state
  const[logs,setLogs]=useState([]);
  // cycleDay removed in v1.5
  const[recurring,setRecurring]=useState([]);
  const[recForm,setRecForm]=useState(null); // null or {memo,amount,day,cardName,sc} // [{id,cardId,cardName,sc,amount,memo,dayOfMonth,isMiles,rate}]
  const[loaded,setLoaded]=useState(false);
  const showToast=(msg)=>{setToast(msg);setTimeout(()=>setToast(null),3500);};

  // ⑨ Auto-generate recurring logs on load
  useEffect(()=>{
    if(!loaded||recurring.length===0)return;
    const now=new Date();const ym=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
    const newLogs=[];
    recurring.forEach(r=>{
      const dueDate=`${ym}-${String(r.dayOfMonth).padStart(2,"0")}`;
      if(now.toISOString().slice(0,10)>=dueDate){
        const already=logs.some(l=>l.memo===`🔄 ${r.memo}`&&l.date.startsWith(ym));
        if(!already){
          const card=CARDS.find(c=>c.id===r.cardId);
          const rate=card?getRate(card,r.sc,vs,guru,moxTier,dbsLfFx,wewaCategory,bocMs,bocMf,regs):0;
          const mpd=card?getMPD(card,r.sc,vs,guru,moxTier,dbsLfFx,wewaCategory,regs):null;
          const isMiles=!!mpd&&mpd<50;
          newLogs.push({id:Date.now()+Math.random(),cardId:r.cardId,cardName:r.cardName,scenario:r.sc,amount:r.amount,rate:isMiles?mpd:rate,rebate:isMiles?0:r.amount*rate,miles:isMiles?Math.round(r.amount/mpd):0,isMiles,date:dueDate+"T00:00:00.000Z",memo:`🔄 ${r.memo}`});
        }
      }
    });
    if(newLogs.length>0)setLogs(p=>[...newLogs,...p]);
  },[loaded,recurring.length]);

  // ═══ PERSISTENT STORAGE ═══
  useEffect(()=>{
    (() => {
      try{
        const r={value:localStorage.getItem("sw_data")};
        if(r&&r.value){
          const d=JSON.parse(r.value);
          if(!d._v||d._v<3){d.quickAmts=d.quickAmts||[50,100,200,500,1000];d.mode=d.mode||"cashback";d.recurring=d.recurring||[];d.moxTier=d.moxTier||false;d._v=3;}
          if(d._v<4){
            // Migrate ds_wewa → ds_wewa_vs
            if(d.own)d.own=d.own.map(id=>id==="ds_wewa"?"ds_wewa_vs":id);
            if(d.logs)d.logs=d.logs.map(l=>l.cardId==="ds_wewa"?{...l,cardId:"ds_wewa_vs",cardName:"安信 WeWa Visa Sig"}:l);
            if(d.recurring)d.recurring=d.recurring.map(r=>r.cardId==="ds_wewa"?{...r,cardId:"ds_wewa_vs",cardName:"安信 WeWa Visa Sig"}:r);
            d._v=4;
          }
          if(d._v<5){d._v=5;} // v4→v5: new reg fields default true (useState defaults)
          if(d.own)setOwn(d.own);
          if(d.logs)setLogs(d.logs);
          
          if(d.vs)setVs(d.vs);
          if(d.guru)setGuru(d.guru);
          if(d.sMax)setSMax(d.sMax);
          if(d.seen){setSeen(true);}
          if(d.quickAmts&&Array.isArray(d.quickAmts))setQuickAmts(d.quickAmts);
          if(d.mode)setMode(d.mode);
          if(d.recurring&&Array.isArray(d.recurring))setRecurring(d.recurring);
          if(d.moxTier)setMoxTier(d.moxTier);
          // DBS backward compat: old boolean → new string
          if(d.dbsLfFx===true)setDbsLfFx("fx");else if(d.dbsLfFx===false)setDbsLfFx("none");else if(d.dbsLfFx)setDbsLfFx(d.dbsLfFx);
          if(d.wewaCategory)setWewaCategory(d.wewaCategory);
          if(d.bocMs)setBocMs(d.bocMs);if(d.bocMf)setBocMf(d.bocMf);
          // v1.2 registration toggles (default true if missing = backward compat)
          if(d.aeExplorerReg===false)setAeExplorerReg(false);
          if(d.aeChargeReg===false)setAeChargeReg(false);
          if(d.everyMileReg===false)setEveryMileReg(false);
          if(d.mmpowerReg===false)setMmpowerReg(false);
          if(d.travelPlusReg===false)setTravelPlusReg(false);
          if(d.dbsEminentReg===false)setDbsEminentReg(false);
          if(d.beaWorldReg===false)setBeaWorldReg(false);
          if(d.ccbEyeReg===false)setCcbEyeReg(false);
        }
      }catch(e){/* first time */}
      setLoaded(true);
    })();
  },[]);

  const saveRef=useRef(null);
  useEffect(()=>{
    if(!loaded)return;
    clearTimeout(saveRef.current);
    saveRef.current=setTimeout(() => {
      try{
        localStorage.setItem("sw_data",JSON.stringify({_v:5,own,logs,vs,guru,sMax:sMax>0?sMax:3000,seen,quickAmts,mode,recurring,moxTier,dbsLfFx,wewaCategory,bocMs,bocMf,aeExplorerReg,aeChargeReg,everyMileReg,mmpowerReg,travelPlusReg,dbsEminentReg,beaWorldReg,ccbEyeReg}));
      }catch(e){}
    },500);
  },[own,logs,vs,guru,sMax,seen,loaded,quickAmts,mode,recurring,moxTier,dbsLfFx,wewaCategory,bocMs,bocMf,aeExplorerReg,aeChargeReg,everyMileReg,mmpowerReg,travelPlusReg,dbsEminentReg,beaWorldReg,ccbEyeReg]);

  // Compute current calendar month range (v1.5: simplified, no cycleDay)
  const getCycleRange=useCallback(()=>{
    const now=new Date();
    let start=new Date(now.getFullYear(),now.getMonth(),1);
    let end=new Date(now.getFullYear(),now.getMonth()+1,1);
    return{start,end};
  },[]);

  // Filter logs to current cycle
  const cycleLogs=useMemo(()=>{
    const{start,end}=getCycleRange();
    return logs.filter(l=>{const d=new Date(l.date);return d>=start&&d<end;});
  },[logs,getCycleRange]);

  // Spending per card in current cycle
  const cardSpending=useMemo(()=>{
    const m={};
    let totalRebate=0,totalMiles=0;
    cycleLogs.forEach(l=>{
      if(!m[l.cardId])m[l.cardId]={total:0,rebateTotal:0,milesTotal:0,byScenario:{},cardName:l.cardName};
      m[l.cardId].total+=l.amount;
      m[l.cardId].rebateTotal+=(l.rebate||0);
      m[l.cardId].milesTotal+=(l.miles||0);
      totalRebate+=(l.rebate||0);
      totalMiles+=(l.miles||0);
      if(!m[l.cardId].byScenario[l.scenario])m[l.cardId].byScenario[l.scenario]={spent:0,rebate:0,miles:0};
      m[l.cardId].byScenario[l.scenario].spent+=l.amount;
      m[l.cardId].byScenario[l.scenario].rebate+=(l.rebate||0);
      m[l.cardId].byScenario[l.scenario].miles+=(l.miles||0);
    });
    return{cards:m,totalRebate,totalMiles};
  },[cycleLogs]);

  const addLog=(cardId,cardName,scenario,amount,rate,isMiles,customDate,memo)=>{
    const rebate=isMiles?0:amount*rate;
    const miles=isMiles?Math.round(amount/rate):0;
    const dateStr=customDate||new Date().toISOString();
    setLogs(p=>[{id:Date.now(),cardId,cardName,scenario,amount,rate,rebate,miles,isMiles:!!isMiles,date:dateStr,memo:memo||""},...p]);
    setLogMemo("");
    showToast(`✅ 已記錄 $${amount.toLocaleString()} → ${cardName}`);
  };
  const addManualLog=()=>{
    const a=parseFloat(manualAmt);if(!a||a<=0)return;
    const typeLabels={cash:"💵 現金",octopus:"🚇 八達通",other:"📝 其他"};
    const dateStr=new Date(manualDate+"T"+new Date().toTimeString().slice(0,8)).toISOString();
    setLogs(p=>[{id:Date.now(),cardId:"_manual_"+manualType,cardName:typeLabels[manualType],scenario:manualSc,amount:a,rate:0,rebate:0,miles:0,isMiles:false,date:dateStr,memo:manualMemo,isManual:true},...p]);
    showToast(`✅ 已記錄 ${typeLabels[manualType]} $${a.toLocaleString()}`);
    setManualAmt("");setManualMemo("");setManualOpen(false);
  };
  const removeLog=(id)=>setLogs(p=>p.filter(l=>l.id!==id));

  // Auto-reset removed — all logs kept permanently

  useEffect(()=>{if(loaded&&!seen){setTut(1);setSeen(true);}},[loaded]);

  const res=useMemo(()=>{try{return doCalc(sc,amt,own,mode,vs,guru,moxTier,dbsLfFx,wewaCategory,bocMs,bocMf,regs);}catch{return{primary:null,fallback:null,globalBest:null};}},[sc,amt,own,mode,vs,guru,moxTier,dbsLfFx,wewaCategory,bocMs,bocMf,aeExplorerReg,aeChargeReg,everyMileReg,mmpowerReg,travelPlusReg,dbsEminentReg,beaWorldReg,ccbEyeReg]);
  const toggle=useCallback(id=>setOwn(p=>p.includes(id)?p.filter(x=>x!==id):[...p,id]),[]);
  const noCards=own.length===0;
  const grouped=useMemo(()=>{const g={};CARDS.forEach(c=>{if(!g[c.issuer])g[c.issuer]=[];g[c.issuer].push(c);});return g;},[]);
  const filteredGrouped=useMemo(()=>{
    if(!search.trim())return grouped;
    const q=search.toLowerCase();
    const g={};
    CARDS.filter(c=>c.name.toLowerCase().includes(q)||c.desc.toLowerCase().includes(q)||c.issuer.toLowerCase().includes(q)).forEach(c=>{if(!g[c.issuer])g[c.issuer]=[];g[c.issuer].push(c);});
    return g;
  },[search,grouped]);

  const p=res?.primary,fb=res?.fallback,gb=res?.globalBest,co=res?.cappedOriginal;
  const isCB=mode==="cashback";
  const ownsG=gb&&p&&gb.card.id===p.card.id&&own.includes(gb.card.id);

  // Tutorial flow (9 steps):
  // 0=off, 1=welcome, 2=Card Holder cards, 3=HSBC settings btn,
  // 4=scenario, 5=mode toggle, 6=amount, 7=result, 8=記一筆, 9=tracker, 10=guide
  const tutNext=()=>{
    let n=tut+1;
    if(n===3)n=4; // skip old HSBC step (merged into step 2)
    if(n===2){setTab("cards");}
    if(n===4){setTab("calc");}
    if(n===9)setTab("tracker");
    if(n===10)setTab("guide");
    if(n>11){setTut(0);return;}
    setTut(n);
  };

  // Auto-scroll to highlighted element on tutorial step change
  useEffect(()=>{
    if(tut<2)return;
    const map={2:"tut-cardlist",4:"tut-scenario",5:"tut-mode",6:"tut-amount",7:"tut-result",8:"tut-logbtn",9:"tut-tracker",10:"tut-guide"};
    const id=map[tut];
    if(!id)return;
    const timer=setTimeout(()=>{
      const el=document.getElementById(id);
      if(el)el.scrollIntoView({behavior:"smooth",block:"center"});
    },200);
    return()=>clearTimeout(timer);
  },[tut]);

  const isHL=(section)=>{
    if(tut===2&&section==="cardlist")return true;
    if(tut===4&&section==="scenario")return true;
    if(tut===5&&section==="mode")return true;
    if(tut===6&&section==="amount")return true;
    if(tut===7&&section==="result")return true;
    if(tut===8&&section==="logbtn")return true;
    if(tut===9&&section==="trackertab")return true;
    if(tut===10&&section==="guidetab")return true;
    return false;
  };
  const dimmed=tut>=2&&tut<=10;
  const hlStyle=(section)=>{
    if(!isHL(section))return{};
    return{position:"relative",zIndex:9990,boxShadow:"0 0 0 3px #007AFF, 0 0 20px rgba(0,122,255,0.25)",borderRadius:16,background:S.card};
  };
  const scenarioHL={}; // highlight now on wrapper div
  // Tooltip positioning handled inline in JSX

  if(!loaded)return(
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:S.bg,fontFamily:'-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Helvetica Neue", Arial, sans-serif'}}>
      <div style={{textAlign:"center"}}>
        <div style={{width:64,height:64,borderRadius:16,overflow:"hidden",margin:"0 auto 16px",boxShadow:"0 8px 24px rgba(0,122,255,0.3)"}}>
              <svg viewBox="0 0 512 512" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                <defs><linearGradient id="lbg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#007AFF"/><stop offset="100%" stopColor="#34C759"/></linearGradient><linearGradient id="lai" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#007AFF"/><stop offset="100%" stopColor="#34C759"/></linearGradient><filter id="lg"><feDropShadow dx="-2" dy="10" stdDeviation="12" floodOpacity="0.25"/></filter></defs>
                <rect width="512" height="512" rx="112" fill="url(#lbg)"/>
                <rect x="136" y="180" width="240" height="145" rx="20" fill="rgba(255,255,255,0.15)" transform="rotate(-25 140 360)"/>
                <rect x="136" y="180" width="240" height="145" rx="20" fill="rgba(255,255,255,0.3)" transform="rotate(-10 140 360)"/>
                <g transform="rotate(5 140 360)"><rect x="136" y="180" width="240" height="145" rx="24" fill="#FFFFFF" filter="url(#lg)"/><path d="M 156 250 L 196 250 L 226 210 L 326 210" fill="none" stroke="#E5E5EA" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/><path d="M 166 280 L 216 280 L 246 250" fill="none" stroke="#E5E5EA" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/><circle cx="196" cy="250" r="4" fill="#D1D1D6"/><circle cx="216" cy="280" r="4" fill="#D1D1D6"/><circle cx="326" cy="210" r="4" fill="#34C759"/><path d="M 256 225 Q 256 250 231 250 Q 256 250 256 275 Q 256 250 281 250 Q 256 250 256 225 Z" fill="url(#lai)"/></g>
              </svg>
            </div>
        <p style={{fontSize:15,fontWeight:600,color:S.dark}}>碌邊張</p>
        <p style={{fontSize:12,color:S.label,marginTop:4}}>載入中...</p>
      </div>
    </div>
  );

  return(
    <div style={{minHeight:"100vh",paddingBottom:72,background:S.bg,fontFamily:'-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Helvetica Neue", Arial, sans-serif',WebkitFontSmoothing:"antialiased",MozOsxFontSmoothing:"grayscale"}}>

      {/* Dark overlay for tutorial — much darker */}
      {/* Tutorial tooltips - no dark overlay */}

      {/* Tutorial tooltip — Steps 2-3 use fixed position, Steps 4-6 use inline (rendered near target in JSX) */}
      {tut===2&&(
        <div style={{position:"fixed",bottom:62,left:"50%",transform:"translateX(-50%)",zIndex:9995,maxWidth:300,width:"calc(100% - 40px)"}}>
          <div style={{background:S.card,borderRadius:16,padding:16,boxShadow:darkMode?"0 8px 30px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.08)":"0 8px 30px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.05)"}}>
            <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}>
              <span style={{fontSize:10,fontWeight:700,color:S.blue,letterSpacing:1}}>步驟 1/9</span>
              <div style={{flex:1,height:3,borderRadius:2,background:darkMode?"#3A3A3C":"#E5E5EA"}}><div style={{height:3,borderRadius:2,background:S.blue,width:"11%"}}/></div>
            </div>
            <p style={{fontSize:15,fontWeight:600,color:S.dark,lineHeight:1.5}}>剔選你擁有嘅信用卡！部分銀行有 ⚙️ 可微調優惠設定（e.g. HSBC 最紅自主獎賞類別），唔設定都 OK</p>
            <div style={{display:"flex",gap:8,marginTop:12}}>
              <button onClick={()=>setTut(0)} style={{padding:"8px 16px",borderRadius:16,background:S.bg,border:"none",fontSize:12,fontWeight:600,color:S.label,cursor:"pointer"}}>跳過</button>
              <button onClick={tutNext} style={{flex:1,padding:"8px 16px",borderRadius:16,background:S.blue,border:"none",fontSize:12,fontWeight:700,color:"#fff",cursor:"pointer"}}>下一步 →</button>
            </div>
          </div>
          <div style={{width:0,height:0,borderLeft:"10px solid transparent",borderRight:"10px solid transparent",borderTop:"10px solid #fff",marginLeft:"37%"}}/>
        </div>
      )}
      {tut===9&&(
        <div style={{position:"fixed",bottom:76,left:"50%",transform:"translateX(-50%)",zIndex:9995,maxWidth:300,width:"calc(100% - 40px)"}}>
          <div style={{background:S.card,borderRadius:16,padding:16,boxShadow:darkMode?"0 8px 30px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.08)":"0 8px 30px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.05)"}}>
            <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}>
              <span style={{fontSize:10,fontWeight:700,color:S.blue,letterSpacing:1}}>步驟 7/9</span>
              <div style={{flex:1,height:3,borderRadius:2,background:darkMode?"#3A3A3C":"#E5E5EA"}}><div style={{height:3,borderRadius:2,background:S.blue,width:"78%"}}/></div>
            </div>
            <p style={{fontSize:15,fontWeight:600,color:S.dark,lineHeight:1.5}}>「記帳」追蹤每張卡嘅月度消費額度，爆 Cap 時會自動提醒你轉保底卡</p>
            <div style={{display:"flex",gap:8,marginTop:12}}>
              <button onClick={()=>setTut(0)} style={{padding:"8px 16px",borderRadius:16,background:S.bg,border:"none",fontSize:12,fontWeight:600,color:S.label,cursor:"pointer"}}>跳過</button>
              <button onClick={tutNext} style={{flex:1,padding:"8px 16px",borderRadius:16,background:S.blue,border:"none",fontSize:12,fontWeight:700,color:"#fff",cursor:"pointer"}}>下一步 →</button>
            </div>
          </div>
          <div style={{width:0,height:0,borderLeft:"10px solid transparent",borderRight:"10px solid transparent",borderTop:"10px solid #fff",marginLeft:"60%"}}/>
        </div>
      )}
      {tut===10&&(
        <div style={{position:"fixed",bottom:76,right:8,zIndex:9995,maxWidth:300,width:"calc(100% - 80px)"}}>
          <div style={{background:S.card,borderRadius:16,padding:16,boxShadow:darkMode?"0 8px 30px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.08)":"0 8px 30px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.05)"}}>
            <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}>
              <span style={{fontSize:10,fontWeight:700,color:S.blue,letterSpacing:1}}>步驟 8/9</span>
              <div style={{flex:1,height:3,borderRadius:2,background:darkMode?"#3A3A3C":"#E5E5EA"}}><div style={{height:3,borderRadius:2,background:S.blue,width:"89%"}}/></div>
            </div>
            <p style={{fontSize:15,fontWeight:600,color:S.dark,lineHeight:1.5}}>「攻略」可以睇到每個場景嘅信用卡排名！即刻了解邊張卡最強</p>
            <div style={{display:"flex",gap:8,marginTop:12}}>
              <button onClick={()=>setTut(0)} style={{padding:"8px 16px",borderRadius:16,background:S.bg,border:"none",fontSize:12,fontWeight:600,color:S.label,cursor:"pointer"}}>跳過</button>
              <button onClick={tutNext} style={{flex:1,padding:"8px 16px",borderRadius:16,background:S.blue,border:"none",fontSize:12,fontWeight:700,color:"#fff",cursor:"pointer"}}>下一步 →</button>
            </div>
          </div>
          <div style={{width:0,height:0,borderLeft:"10px solid transparent",borderRight:"10px solid transparent",borderTop:"10px solid #fff",marginLeft:"auto",marginRight:24}}/>
        </div>
      )}

      {/* PWA Install Tutorial - Step 11 or standalone */}
      {tut===11&&(()=>{
        const ua=navigator.userAgent||"";
        const isIOS=/iPad|iPhone|iPod/.test(ua);
        const isAndroid=/Android/.test(ua);
        const isSafari=isIOS&&!/CriOS|FxiOS|OPiOS|EdgiOS/.test(ua);
        const isIOSChrome=isIOS&&/CriOS/.test(ua);
        const isDesktop=!isIOS&&!isAndroid;
        const step=(n,t)=><div style={{display:"flex",gap:10,alignItems:"flex-start"}}><span style={{width:28,height:28,borderRadius:14,background:S.blue,color:"#fff",fontSize:13,fontWeight:700,display:"inline-flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{n}</span><p style={{fontSize:14,color:S.dark,lineHeight:1.6}}>{t}</p></div>;
        return(
        <div style={{position:"fixed",inset:0,zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",padding:16,background:"rgba(0,0,0,0.6)"}} onClick={()=>setTut(0)}>
          <div style={{background:S.card,borderRadius:24,maxWidth:360,width:"100%",maxHeight:"85vh",overflow:"auto",boxShadow:"0 25px 50px rgba(0,0,0,0.3)"}} onClick={e=>e.stopPropagation()}>
            <div style={{padding:"28px 24px 12px",textAlign:"center"}}>
              <div style={{fontSize:48,marginBottom:8}}>📲</div>
              <h2 style={{fontSize:20,fontWeight:700,color:S.dark,marginBottom:4}}>加入主畫面</h2>
              <p style={{fontSize:13,color:S.sec}}>一撳即開，同 App 一樣快！</p>
            </div>
            {installPrompt&&<div style={{padding:"8px 24px"}}><button onClick={async()=>{installPrompt.prompt();const r=await installPrompt.userChoice;if(r.outcome==="accepted"){setInstallPrompt(null);setTut(0);showToast("✅ 已安裝到主畫面！");}}} style={{width:"100%",padding:14,borderRadius:16,background:"linear-gradient(135deg, #34C759, #28A745)",color:"#fff",fontSize:15,fontWeight:700,border:"none",cursor:"pointer",boxShadow:"0 4px 12px rgba(52,199,89,0.3)"}}>⚡ 一鍵安裝到主畫面</button></div>}
            <div style={{padding:"8px 24px"}}>
              <div style={{background:S.cardAlt,borderRadius:14,padding:14}}>
                <p style={{fontSize:13,fontWeight:700,color:S.dark,marginBottom:10}}>{isIOS?(isSafari?"🍎 Safari（你而家用緊）":"🍎 iPhone / iPad"):isAndroid?"🤖 Android":"🖥️ 電腦瀏覽器"}</p>
                {isSafari&&<div style={{display:"flex",flexDirection:"column",gap:8}}>
                  {step(1,<>撳底部 <span style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:26,height:26,borderRadius:7,background:darkMode?"#3A3A3C":"#E5E5EA",fontSize:16,verticalAlign:"middle"}}>⋯</span> 三點按鈕</>)}
                  {step(2,<>揾到 <span style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:24,height:24,borderRadius:6,background:"#007AFF",color:"#fff",fontSize:12,verticalAlign:"middle"}}>⬆</span> <strong>「分享⋯」</strong></>)}
                  {step(3,<>向下碌，撳 <strong>「加入主畫面」</strong> ➕</>)}
                  {step(4,<>右上角撳 <strong>「新增」</strong> 就搞掂！✅</>)}
                </div>}
                {isIOSChrome&&<div style={{display:"flex",flexDirection:"column",gap:8}}>
                  <p style={{fontSize:12,color:S.red,fontWeight:600,marginBottom:4}}>⚠️ Chrome 喺 iOS 唔支援加入主畫面</p>
                  {step(1,<>用 <strong>Safari</strong> 打開 <strong style={{color:S.blue}}>swipewhich.com</strong></>)}
                  {step(2,<>跟返上面 Safari 嘅步驟</>)}
                </div>}
                {isAndroid&&<div style={{display:"flex",flexDirection:"column",gap:8}}>
                  {installPrompt?<p style={{fontSize:14,color:S.green,fontWeight:600,textAlign:"center",padding:4}}>⬆ 撳上面綠色「一鍵安裝」掣即可！</p>:<>
                    {step(1,<>撳右上角 <span style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:26,height:26,borderRadius:7,background:darkMode?"#3A3A3C":"#333",color:"#fff",fontSize:16,verticalAlign:"middle"}}>⋮</span> 三點選單</>)}
                    {step(2,<>撳 <strong>「安裝應用程式」</strong> 或 <strong>「新增至主畫面」</strong></>)}
                    {step(3,<>撳 <strong>「安裝」</strong> 就搞掂！✅</>)}
                  </>}
                </div>}
                {isDesktop&&<div style={{display:"flex",flexDirection:"column",gap:8}}>
                  {step(1,<>用 Chrome 打開 <strong style={{color:S.blue}}>swipewhich.com</strong></>)}
                  {step(2,<>撳網址列右邊嘅 📥 安裝 icon</>)}
                  {step(3,<>撳 <strong>「安裝」</strong> 就搞掂！✅</>)}
                </div>}
                <div style={{marginTop:10,padding:"8px 10px",borderRadius:8,background:"rgba(52,199,89,0.08)"}}><p style={{fontSize:11,color:S.green,lineHeight:1.4}}>💡 加入後主畫面會有碌邊張 icon，全螢幕運行似 native app！</p></div>
              </div>
            </div>
            <div style={{padding:"4px 24px 8px"}}><div style={{padding:"8px 10px",borderRadius:8,background:darkMode?"rgba(255,214,10,0.1)":"rgba(0,122,255,0.04)"}}><p style={{fontSize:11,color:S.sec,lineHeight:1.4}}>🌙 右上角 ☀️/🌙 icon 可以切換深色模式，支援跟隨系統設定！</p></div></div>
            <div style={{padding:"8px 24px 20px"}}><button onClick={()=>setTut(0)} style={{width:"100%",padding:13,borderRadius:S.rad,background:S.blue,color:"#fff",fontSize:15,fontWeight:600,border:"none",cursor:"pointer"}}>完成 🎉</button></div>
          </div>
        </div>);
      })()}

      {/* Welcome Modal (step 1 only) */}
      {tut===1&&(
        <div style={{position:"fixed",inset:0,zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",padding:20,background:"rgba(0,0,0,0.6)"}}>
          <div style={{background:S.card,borderRadius:24,maxWidth:340,width:"100%",boxShadow:"0 25px 50px rgba(0,0,0,0.3)"}}>
            <div style={{padding:"40px 32px 16px",textAlign:"center"}}>
              <div style={{width:64,height:64,borderRadius:16,overflow:"hidden",margin:"0 auto 16px",boxShadow:"0 8px 24px rgba(0,122,255,0.3)"}}>
                <svg viewBox="0 0 512 512" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="wbg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#007AFF"/><stop offset="100%" stopColor="#34C759"/></linearGradient><linearGradient id="wai" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#007AFF"/><stop offset="100%" stopColor="#34C759"/></linearGradient><filter id="wg"><feDropShadow dx="-2" dy="10" stdDeviation="12" floodOpacity="0.25"/></filter></defs><rect width="512" height="512" rx="112" fill="url(#wbg)"/><rect x="136" y="180" width="240" height="145" rx="20" fill="rgba(255,255,255,0.15)" transform="rotate(-25 140 360)"/><rect x="136" y="180" width="240" height="145" rx="20" fill="rgba(255,255,255,0.3)" transform="rotate(-10 140 360)"/><g transform="rotate(5 140 360)"><rect x="136" y="180" width="240" height="145" rx="24" fill="#FFFFFF" filter="url(#wg)"/><path d="M 156 250 L 196 250 L 226 210 L 326 210" fill="none" stroke="#E5E5EA" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/><path d="M 166 280 L 216 280 L 246 250" fill="none" stroke="#E5E5EA" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/><circle cx="196" cy="250" r="4" fill="#D1D1D6"/><circle cx="216" cy="280" r="4" fill="#D1D1D6"/><circle cx="326" cy="210" r="4" fill="#34C759"/><path d="M 256 225 Q 256 250 231 250 Q 256 250 256 275 Q 256 250 281 250 Q 256 250 256 225 Z" fill="url(#wai)"/></g></svg>
              </div>
              <h2 style={{fontSize:22,fontWeight:700,color:S.dark,marginBottom:8}}>歡迎使用碌邊張！</h2>
              <p style={{fontSize:14,color:S.sec,lineHeight:1.6}}>即時幫你計出每筆消費碌邊張卡最抵</p>
              <div style={{background:S.bg,borderRadius:14,padding:12,marginTop:12,textAlign:"left"}}>
                <p style={{fontSize:12,color:S.label,marginBottom:4}}>💡 你知唔知？</p>
                <p style={{fontSize:13,color:S.dark,lineHeight:1.5}}>同一筆 <strong>$500 食飯</strong>，用錯卡可能蝕 <strong style={{color:S.green}}>$25</strong> 回贈！碌邊張 3 步幫你搞掂：</p>
                <p style={{fontSize:12,color:S.sec,marginTop:8,lineHeight:1.6}}>① 揀你有嘅卡<br/>② 輸入消費金額<br/>③ 即刻知道碌邊張！</p>
              </div>
            </div>
            <div style={{padding:"0 24px 24px"}}>
              <button onClick={tutNext} style={{width:"100%",padding:14,borderRadius:S.rad,background:S.blue,color:"#fff",fontSize:15,fontWeight:600,border:"none",cursor:"pointer"}}>開始導覽 →</button>
              <button onClick={()=>setTut(0)} style={{width:"100%",padding:8,background:"none",border:"none",color:S.label,fontSize:13,cursor:"pointer",marginTop:4}}>跳過</button>
            </div>
          </div>
        </div>
      )}

      {/* T&C Modal — comprehensive */}
      {modal==="tc"&&(
        <div style={{position:"fixed",inset:0,zIndex:9998,display:"flex",alignItems:"center",justifyContent:"center",padding:16,background:"rgba(0,0,0,0.5)"}} onClick={()=>setModal(null)}>
          <div style={{background:S.card,borderRadius:S.rad,maxWidth:480,width:"100%",maxHeight:"85vh",overflow:"auto",boxShadow:"0 20px 40px rgba(0,0,0,0.25)"}} onClick={e=>e.stopPropagation()}>
            <div style={{padding:20,borderBottom:`1px solid ${S.sep}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}><strong style={{fontSize:16}}>免責聲明與使用條款</strong><button onClick={()=>setModal(null)} style={{background:"none",border:"none",cursor:"pointer",padding:4}}><X size={18} color={S.label}/></button></div>
            <div style={{padding:20,fontSize:13,lineHeight:1.9,color:S.sec}}>
              <p><strong>1. 僅供參考 (For Reference Only)</strong><br/>本工具所提供的信用卡回贈率、里數兌換率、簽賬上限及其他資料，均來自各發卡機構的公開資料及第三方資訊平台，僅供初步參考之用。實際回贈率、條款及細則以各發卡銀行或金融機構最新公佈的官方條款為準。碌邊張 SwipeWhich 不保證本工具所載資料的準確性、完整性、即時性或適用性。</p>
              <p style={{marginTop:16}}><strong>2. 商戶分類代碼 (MCC) 聲明</strong><br/>本工具的場景分類（如「食飯」、「超市」、「海外實體」等）僅為方便使用者參考之分類。實際回贈以各發卡銀行的商戶分類代碼（MCC）判定為準。同一商戶在不同銀行可能被歸入不同消費類別，導致實際回贈與本工具顯示不同。本工具無法預判銀行的 MCC 分類結果。</p>
              <p style={{marginTop:16}}><strong>3. 免責聲明 (Disclaimer of Liability)</strong><br/>碌邊張 SwipeWhich 及其開發者、營運者、關聯方不對任何因使用、依賴或無法使用本工具而直接或間接導致的任何損失承擔責任，包括但不限於：未能獲得的信用卡回贈或里數、因錯誤建議而產生的額外手續費或利息、任何形式的財務損失、利潤損失或機會成本、因銀行條款變更而導致的差異。使用者確認並同意自行承擔使用本工具的全部風險。</p>
              <p style={{marginTop:16}}><strong>4. 非財務建議 (Not Financial Advice)</strong><br/>本工具純粹為運算輔助工具，旨在幫助使用者比較不同信用卡在特定消費場景下的回贈效率。本工具不構成、亦不應被視為任何形式的財務建議、投資建議、信用卡申請建議或專業顧問服務。任何信用卡的申請、使用或取消決定，使用者應自行判斷或諮詢持牌財務顧問。</p>
              <p style={{marginTop:16}}><strong>5. 商標聲明 (Trademark Notice)</strong><br/>本工具中提及的所有信用卡名稱、銀行名稱、品牌名稱及相關標誌均為其各自擁有者的註冊商標或商標。碌邊張 SwipeWhich 與上述任何金融機構或品牌之間不存在任何贊助、背書、合作或關聯關係。本工具不使用任何銀行標誌或受版權保護的圖形。</p>
              <p style={{marginTop:16}}><strong>6. 隱私與數據保護</strong><br/>本工具採用完全客戶端運算架構。使用者的所有資料（包括信用卡選擇、消費金額、設定偏好）僅儲存於使用者裝置本地瀏覽器的 localStorage 中。本工具不設任何伺服器端數據儲存，不收集、不傳輸、不儲存任何個人身份識別資訊 (PII)。清除瀏覽器數據將永久刪除所有本地儲存的設定。<br/><br/>本工具使用 Google Analytics 收集匿名使用統計數據（如瀏覽量、裝置類型、地區），以改善服務質素。此數據不包含任何個人財務資料或信用卡資訊。詳情請參閱 <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" style={{color:"#007AFF"}}>Google 隱私政策</a>。</p>
              <p style={{marginTop:16}}><strong>7. 使用限制</strong><br/>使用者不得將本工具用於任何非法目的，不得對本工具進行逆向工程、反編譯或以任何方式提取原始碼，不得以任何方式暗示本工具獲得任何銀行或金融機構的官方認可。</p>
              <p style={{marginTop:16}}><strong>8. 條款修訂</strong><br/>碌邊張 SwipeWhich 保留隨時修訂本免責聲明及使用條款的權利，恕不另行通知。繼續使用本工具即表示使用者同意受最新條款約束。</p>
              <p style={{marginTop:16}}><strong>9. 管轄法律</strong><br/>本免責聲明及使用條款受香港特別行政區法律管轄，並按其詮釋。</p>
              <p style={{marginTop:16}}><strong>10. 聯絡我們</strong><br/>如有任何查詢、建議或投訴，請電郵至 <a href="mailto:admin@swipewhich.com" style={{color:S.blue}}>admin@swipewhich.com</a></p>
            </div>
            <div style={{padding:"12px 20px",textAlign:"center",fontSize:11,color:S.label,borderTop:`1px solid ${S.sep}`}}>v1.2.0 · 資料庫更新：2026年3月14日<br/>© 2026 碌邊張 SwipeWhich. All rights reserved.<br/>聯絡：admin@swipewhich.com</div>
            <div style={{padding:"0 20px 20px"}}><button onClick={()=>setModal(null)} style={{width:"100%",padding:14,borderRadius:S.rad,background:S.blue,color:"#fff",fontSize:15,fontWeight:600,border:"none",cursor:"pointer"}}>了解</button></div>
          </div>
        </div>
      )}

      {/* Theme Modal */}
      {themeModal&&(
        <div style={{position:"fixed",inset:0,zIndex:9998,display:"flex",alignItems:"center",justifyContent:"center",padding:16,background:"rgba(0,0,0,0.5)"}} onClick={()=>setThemeModal(false)}>
          <div onClick={e=>e.stopPropagation()} style={{background:S.card,borderRadius:20,width:"100%",maxWidth:320,overflow:"hidden"}}>
            <div style={{padding:"20px 20px 8px",textAlign:"center"}}>
              <p style={{fontSize:17,fontWeight:600,color:S.dark}}>外觀模式</p>
              <p style={{fontSize:13,color:S.label,marginTop:4}}>選擇你鍾意嘅顯示模式</p>
            </div>
            <div style={{padding:"8px 20px 20px",display:"flex",gap:10}}>
              {[{k:"auto",emoji:"📱",label:"自動",desc:"跟隨系統"},{k:"light",emoji:"☀️",label:"淺色",desc:"Light"},{k:"dark",emoji:"🌙",label:"深色",desc:"Dark"}].map(t=>(
                <button key={t.k} onClick={()=>{setDarkPref(t.k);setThemeModal(false);}} style={{flex:1,padding:"14px 8px",borderRadius:14,border:darkPref===t.k?`2px solid ${S.blue}`:`2px solid ${S.sep}`,background:darkPref===t.k?"rgba(0,122,255,0.08)":S.card,cursor:"pointer",textAlign:"center"}}>
                  <p style={{fontSize:24}}>{t.emoji}</p>
                  <p style={{fontSize:13,fontWeight:600,color:darkPref===t.k?S.blue:S.dark,marginTop:4}}>{t.label}</p>
                  <p style={{fontSize:10,color:S.label,marginTop:2}}>{t.desc}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header style={{position:"sticky",top:0,zIndex:9991,borderBottom:`0.5px solid ${S.sep}`,padding:"10px 16px",background:S.headerBg,backdropFilter:"blur(20px) saturate(180%)"}}>
        <div style={{maxWidth:640,margin:"0 auto",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer"}} onClick={()=>setTab("calc")}>
            <div style={{width:32,height:32,borderRadius:8,overflow:"hidden",flexShrink:0,boxShadow:"0 2px 8px rgba(0,122,255,0.25)"}}>
              <svg viewBox="0 0 1080 1080" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <linearGradient id="brandGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#2563EB"/><stop offset="100%" stopColor="#059669"/></linearGradient>
                  <filter id="brandGlow"><feDropShadow dx="-4" dy="16" stdDeviation="20" floodColor="#000000" floodOpacity="0.2"/></filter>
                </defs>
                <rect width="1080" height="1080" fill="url(#brandGrad)"/>
                <g transform="translate(540, 540) scale(3.3) translate(-242, -233)">
                  <rect x="136" y="180" width="240" height="145" rx="20" fill="rgba(255,255,255,0.2)" transform="rotate(-25 140 360)"/>
                  <rect x="136" y="180" width="240" height="145" rx="20" fill="rgba(255,255,255,0.4)" transform="rotate(-10 140 360)"/>
                  <g transform="rotate(5 140 360)">
                    <rect x="136" y="180" width="240" height="145" rx="24" fill="#FFFFFF" filter="url(#brandGlow)"/>
                    <path d="M 156 250 L 196 250 L 226 210 L 326 210" fill="none" stroke="#0F172A" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M 166 280 L 216 280 L 246 250" fill="none" stroke="#0F172A" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
                    <circle cx="196" cy="250" r="4.5" fill="#64748B"/><circle cx="216" cy="280" r="4.5" fill="#64748B"/><circle cx="326" cy="210" r="5" fill="#10B981"/>
                    <path d="M 256 220 Q 256 250 226 250 Q 256 250 256 280 Q 256 250 286 250 Q 256 250 256 220 Z" fill="url(#brandGrad)"/>
                  </g>
                </g>
              </svg>
            </div>
            <span style={{fontSize:17,fontWeight:700,color:S.dark,letterSpacing:-0.41}}>碌邊張 <span style={{color:S.label,fontWeight:500}}>SwipeWhich</span></span>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:2,padding:4}}>
            <a href="https://www.instagram.com/swipewhich.hk/" target="_blank" rel="noopener noreferrer" style={{padding:4,display:"flex",alignItems:"center",justifyContent:"center",background:"none",textDecoration:"none",borderRadius:8}}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><defs><linearGradient id="igG" x1="0%" y1="100%" x2="100%" y2="0%"><stop offset="0%" stopColor="#f09433"/><stop offset="25%" stopColor="#e6683c"/><stop offset="50%" stopColor="#dc2743"/><stop offset="75%" stopColor="#cc2366"/><stop offset="100%" stopColor="#bc1888"/></linearGradient></defs><rect x="2" y="2" width="16" height="16" rx="4.5" stroke="url(#igG)" strokeWidth="1.8"/><circle cx="10" cy="10" r="3.5" stroke="url(#igG)" strokeWidth="1.8"/><circle cx="14.5" cy="5.5" r="1.2" fill="url(#igG)"/></svg>
            </a>
            <a href="https://www.facebook.com/profile.php?id=61580560287535" target="_blank" rel="noopener noreferrer" style={{padding:4,display:"flex",alignItems:"center",justifyContent:"center",background:"none",textDecoration:"none",borderRadius:8}}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="10" fill="#1877F2"/><path d="M12.5 10H11V16H8.5V10H7V8H8.5V6.7C8.5 5.2 9.2 4 11 4H13V6H11.5C11 6 10.8 6.2 10.8 6.7V8H13L12.5 10Z" fill="#fff"/></svg>
            </a>
            <a href="https://www.threads.com/@swipewhich.hk" target="_blank" rel="noopener noreferrer" style={{padding:4,display:"flex",alignItems:"center",justifyContent:"center",background:"none",textDecoration:"none",borderRadius:8}}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="9" stroke={darkMode?"#fff":"#000"} strokeWidth="1.4"/><path d="M12.8 9.2C12.8 9.2 12.4 7.4 10.4 7.4C8.8 7.4 7.8 8.6 7.8 10.2C7.8 11.8 8.8 13 10.4 13C11.4 13 12 12.4 12 12.4" stroke={darkMode?"#fff":"#000"} strokeWidth="1.4" strokeLinecap="round"/><path d="M12.8 8V12.2C12.8 12.8 13.2 13.2 13.6 13.2" stroke={darkMode?"#fff":"#000"} strokeWidth="1.4" strokeLinecap="round"/></svg>
            </a>
            <button onClick={()=>setThemeModal(true)} style={{padding:4,display:"flex",alignItems:"center",justifyContent:"center",background:"none",border:"none",cursor:"pointer",borderRadius:8}}>
              {darkPref==="auto"?<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="3.5" stroke={S.blue} strokeWidth="1.6"/>{[0,45,90,135,180,225,270,315].map(d=><line key={d} x1="10" y1="3" x2="10" y2="5" stroke={S.blue} strokeWidth="1.6" strokeLinecap="round" transform={`rotate(${d} 10 10)`}/>)}</svg>
              :darkPref==="dark"?<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M15.5 11.5C15.5 14.8 12.8 17.5 9.5 17.5C6.2 17.5 3.5 14.8 3.5 11.5C3.5 8.5 5.7 6 8.5 5.5C7.5 6.5 7 7.8 7 9.3C7 12.3 9.4 14.7 12.4 14.7C13.5 14.7 14.5 14.3 15.3 13.7C15.4 13 15.5 12.2 15.5 11.5Z" fill="#FFD60A"/></svg>
              :<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="3.5" stroke={S.label} strokeWidth="1.6"/>{[0,45,90,135,180,225,270,315].map(d=><line key={d} x1="10" y1="3" x2="10" y2="5" stroke={S.label} strokeWidth="1.6" strokeLinecap="round" transform={`rotate(${d} 10 10)`}/>)}</svg>}
            </button>
            {!window.matchMedia("(display-mode: standalone)").matches&&<button onClick={()=>setTut(11)} style={{padding:4,display:"flex",alignItems:"center",justifyContent:"center",background:"none",border:"none",cursor:"pointer",fontSize:16,borderRadius:8}}>📲</button>}
            <button onClick={()=>setTut(1)} style={{padding:4,display:"flex",alignItems:"center",justifyContent:"center",background:"none",border:"none",cursor:"pointer",borderRadius:8}}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="8.2" stroke={S.label} strokeWidth="1.6"/><path d="M8.5 8.5C8.5 7.67 9.17 7 10 7C10.83 7 11.5 7.67 11.5 8.5C11.5 9.12 11.12 9.66 10.58 9.87L10 10.1" stroke={S.dark} strokeWidth="1.6" strokeLinecap="round"/><circle cx="10" cy="13" r="1" fill={S.dark}/></svg>
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      {dimmed&&<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:9989}}/>}
      <main style={{maxWidth:640,margin:"0 auto",padding:"0 16px"}}>
        {/* Privacy badge — always visible */}
        <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:6,padding:"6px 0",opacity:0.7}}>
          <span style={{fontSize:10,color:S.label}}>🔒 零伺服器 · 零追蹤 · 所有資料只存你手機</span>
        </div>

        {tab==="calc"&&(
          <div style={{paddingTop:20,display:"flex",flexDirection:"column",gap:16}}>

            {/* Monthly savings banner */}
            {logs.length>0&&(()=>{
              const now=new Date();const curKey=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
              const mLogs=logs.filter(l=>{const d=new Date(l.date);return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`===curKey&&!l.isManual;});
              const mRebate=mLogs.reduce((s,l)=>s+l.rebate,0);
              const mMiles=mLogs.reduce((s,l)=>s+l.miles,0);
              if(mRebate===0&&mMiles===0)return null;
              const cLvl=mRebate>=1000?"🍣":mRebate>=500?"🥩":mRebate>=300?"🔥":mRebate>=100?"💪":"🌱";
              const mLvl=mMiles>=20000?"✈️":mMiles>=10000?"🛫":mMiles>=5000?"🎫":mMiles>=2000?"🎯":"🌱";
              const cMsg=mRebate>=1000?"賺咗一餐 Omakase 🍣":mRebate>=500?"賺咗一餐靚晚餐 🥩":mRebate>=300?"夠食幾餐靚 lunch 🥘":mRebate>=100?"又多杯 Starbucks ☕":"繼續加油！";
              const mMsg=mMiles>=20000?"夠換東京來回 🗼":mMiles>=10000?"好快可以飛啦 ✈️":mMiles>=5000?"儲緊機票錢 🌏":mMiles>=2000?"開始儲里出發 🧳":"";
              const emoji=mMiles>=20000?mLvl:mRebate>=200?cLvl:mMiles>=5000?mLvl:cLvl;
              const topMsg=mMiles>=20000?mMsg:(mRebate>=50?cMsg:(mMsg||cMsg));
              return(
                <div onClick={()=>setTab("tracker")} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 14px",background:darkMode?"rgba(52,199,89,0.08)":"linear-gradient(135deg, #fff 0%, #F0FFF4 100%)",borderRadius:16,boxShadow:S.shadow,cursor:"pointer",border:"1px solid rgba(52,199,89,0.1)"}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,flex:1,minWidth:0}}>
                    <span style={{fontSize:20}}>{mMiles>=5000?mLvl:cLvl}</span>
                    <div style={{minWidth:0}}>
                      <span style={{fontSize:13,fontWeight:700,color:S.dark}}>本月已賺</span>
                      {cMsg&&<p style={{fontSize:10,color:S.green,fontWeight:600,marginTop:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{cMsg}</p>}
                      {mMsg&&<p style={{fontSize:10,color:S.blue,fontWeight:600,marginTop:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{mMsg}</p>}
                    </div>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    {mRebate>0&&<span style={{fontSize:15,fontWeight:800,color:S.green}}>+${mRebate.toFixed(0)}</span>}
                    {mMiles>0&&<span style={{fontSize:15,fontWeight:800,color:S.blue}}>+{mMiles.toLocaleString()}里</span>}
                    <ChevronRight size={14} color={S.label}/>
                  </div>
                </div>
              );
            })()}

            {/* Wallet + Scenario area (highlighted together in tutorial) */}
            <div style={{display:"flex",flexDirection:"column",gap:10,...(tut===4?{position:"relative",zIndex:9990,outline:"3px solid #007AFF",outlineOffset:4,borderRadius:20,padding:2,background:S.bg}:{})}}>

            {/* Wallet Cheat Sheet */}
            {own.length>=2&&<div style={{background:S.card,borderRadius:S.rad,overflow:"hidden",boxShadow:S.shadow}}>
              <button onClick={()=>setWalletOpen(p=>!p)} style={{width:"100%",padding:"12px 16px",background:"none",border:"none",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span style={{fontSize:13,fontWeight:600,color:S.dark}}>👀 一眼睇嗮用咩卡</span>
                <span style={{fontSize:10,color:S.blue,fontWeight:600}}>{walletOpen?"收起 ▲":"展開 ▼"}</span>
              </button>
              {walletOpen&&<div style={{padding:"0 12px 12px"}}>
                <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6}}>
                  {SCENARIOS.map(s=>{
                    const best=own.map(id=>CARDS.find(c=>c.id===id)).filter(Boolean).map(c=>({card:c,rate:isCB?(getRate(c,s.id,vs,guru,moxTier,dbsLfFx,wewaCategory,bocMs,bocMf,regs)+getBocBonus(c,s.id,bocMs,bocMf)):getMPD(c,s.id,vs,guru,moxTier,dbsLfFx,wewaCategory,regs)})).filter(x=>isCB?x.rate>0:x.rate&&x.rate<50).sort((a,b)=>isCB?b.rate-a.rate:a.rate-b.rate)[0];
                    if(!best)return null;
                    const ic=ISSUER_COLORS[best.card.issuer]||{bg:"#8E8E93",short:"?"};
                    return <div key={s.id} onClick={()=>{setSc(s.id);setWalletOpen(false);}} style={{padding:"8px 4px",borderRadius:12,background:S.cardAlt,textAlign:"center",cursor:"pointer"}}>
                      <p style={{fontSize:16}}>{s.emoji}</p>
                      <p style={{fontSize:10,color:S.label,marginTop:2}}>{s.label}</p>
                      <div style={{padding:"2px 8px",borderRadius:6,background:ic.bg,display:"inline-flex",alignItems:"center",justifyContent:"center",marginTop:4}}><span style={{fontSize:8,fontWeight:700,color:"#fff"}}>{ic.short}</span></div>
                      <p style={{fontSize:9,fontWeight:600,color:S.dark,marginTop:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{best.card.name.replace(/^.*?\s/,"")}</p>
                      <p style={{fontSize:11,fontWeight:700,color:isCB?S.green:S.blue}}>{isCB?`${(best.rate*100).toFixed(1)}%`:`$${parseFloat(best.rate.toFixed(1))}/里`}</p>
                    </div>;
                  })}
                </div>
                <p style={{fontSize:10,color:S.label,marginTop:8,textAlign:"center"}}>撳任何場景即跳去計算 · {own.length} 張卡 · {isCB?"現金回贈":"飛行里數"}</p>
              </div>}
            </div>}

            {/* 1) Scenario Selection Boxes */}
            <div>
              <label style={{fontSize:13,fontWeight:400,color:S.sec,letterSpacing:-0.08,display:"block",marginBottom:8}}>簽賬種類</label>
              <div id="tut-scenario">
                <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6}}>
                  {SCENARIOS.map(s=>{
                    const active=sc===s.id||(s.id==="physicalFX"&&sc==="travelJKSTA")||(s.id==="octopus"&&sc==="octopusManual");
                    return(
                      <button key={s.id} onClick={()=>{if(s.id==="physicalFX"){setFxSub(true);setOctSub(false);setSc("physicalFX");}else if(s.id==="octopus"){setOctSub(true);setFxSub(false);setSc("octopus");}else{setFxSub(false);setOctSub(false);setSc(s.id);}}} style={{padding:"8px 2px",borderRadius:14,border:active?"2px solid #007AFF":"2px solid transparent",background:active?"rgba(0,122,255,0.08)":S.card,cursor:"pointer",textAlign:"center",transition:"all 0.2s ease",boxShadow:active?"none":(darkMode?"none":S.shadow)}}>
                        <div style={{fontSize:20}}>{s.emoji}</div>
                        <div style={{fontSize:12,fontWeight:600,color:active?S.blue:S.dark,marginTop:2,letterSpacing:-0.08}}>{s.label}</div>
                      </button>
                    );
                  })}
                </div>
                {/* Sub-option for 海外實體 */}
                {fxSub&&<div style={{display:"flex",gap:8,marginTop:8}}>
                  <button onClick={()=>setSc("physicalFX")} style={{flex:1,padding:"10px 8px",borderRadius:14,border:sc==="physicalFX"?"2px solid #007AFF":"2px solid "+S.sep,background:sc==="physicalFX"?"rgba(0,122,255,0.08)":S.card,cursor:"pointer",transition:"all 0.15s"}}>
                    <span style={{fontSize:13,fontWeight:600,color:sc==="physicalFX"?S.blue:S.dark}}>🌍 一般外幣</span>
                  </button>
                  <button onClick={()=>setSc("travelJKSTA")} style={{flex:1,padding:"10px 8px",borderRadius:14,border:sc==="travelJKSTA"?"2px solid #007AFF":"2px solid "+S.sep,background:sc==="travelJKSTA"?"rgba(0,122,255,0.08)":S.card,cursor:"pointer",transition:"all 0.15s"}}>
                    <span style={{fontSize:13,fontWeight:600,color:sc==="travelJKSTA"?S.blue:S.dark}}>🇯🇵 日韓泰中台</span>
                  </button>
                </div>}
                {/* Sub-option for 八達通增值 */}
                {octSub&&<div style={{display:"flex",gap:8,marginTop:8}}>
                  <button onClick={()=>setSc("octopus")} style={{flex:1,padding:"10px 8px",borderRadius:14,border:sc==="octopus"?"2px solid #007AFF":"2px solid "+S.sep,background:sc==="octopus"?"rgba(0,122,255,0.08)":S.card,cursor:"pointer",transition:"all 0.15s"}}>
                    <span style={{fontSize:13,fontWeight:600,color:sc==="octopus"?S.blue:S.dark}}>🔄 自動增值</span>
                    <div style={{fontSize:11,color:sc==="octopus"?S.blue:S.label,marginTop:2}}>AAVS 信用卡自動</div>
                  </button>
                  <button onClick={()=>setSc("octopusManual")} style={{flex:1,padding:"10px 8px",borderRadius:14,border:sc==="octopusManual"?"2px solid #007AFF":"2px solid "+S.sep,background:sc==="octopusManual"?"rgba(0,122,255,0.08)":S.card,cursor:"pointer",transition:"all 0.15s"}}>
                    <span style={{fontSize:13,fontWeight:600,color:sc==="octopusManual"?S.blue:S.dark}}>📱 手動增值</span>
                    <div style={{fontSize:11,color:sc==="octopusManual"?S.blue:S.label,marginTop:2}}>Apple Pay/八達通App</div>
                  </button>
                </div>}
              </div>
            </div>
            </div>{/* close wallet+scenario wrapper */}
            {/* Inline tooltip for step 4: below scenario */}
            {tut===4&&<div style={{position:"relative",zIndex:9995}}>
              <div style={{width:0,height:0,borderLeft:"10px solid transparent",borderRight:"10px solid transparent",borderBottom:"10px solid #fff",marginLeft:24}}/>
              <div style={{background:S.card,borderRadius:16,padding:16,boxShadow:darkMode?"0 8px 30px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.08)":"0 8px 30px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.05)"}}>
                <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}><span style={{fontSize:10,fontWeight:700,color:S.blue,letterSpacing:1}}>步驟 2/9</span><div style={{flex:1,height:3,borderRadius:2,background:darkMode?"#3A3A3C":"#E5E5EA"}}><div style={{height:3,borderRadius:2,background:S.blue,width:"22%"}}/></div></div>
                <p style={{fontSize:15,fontWeight:600,color:S.dark,lineHeight:1.5}}>揀你嘅簽賬種類。上面「👀 一眼睇嗮用咩卡」可以速查所有場景！</p>
                <div style={{display:"flex",gap:8,marginTop:12}}><button onClick={()=>setTut(0)} style={{padding:"8px 16px",borderRadius:16,background:S.bg,border:"none",fontSize:12,fontWeight:600,color:S.label,cursor:"pointer"}}>跳過</button><button onClick={tutNext} style={{flex:1,padding:"8px 16px",borderRadius:16,background:S.blue,border:"none",fontSize:12,fontWeight:700,color:"#fff",cursor:"pointer"}}>下一步 →</button></div>
              </div>
            </div>}

            {/* 2) Amount */}
            <div id="tut-amount" style={{background:S.card,borderRadius:S.rad,padding:16,boxShadow:S.shadow,...hlStyle("amount")}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:FX_SCENARIOS.includes(sc)?6:12}}>
                <label style={{fontSize:13,fontWeight:400,color:S.sec,letterSpacing:-0.08}}>簽賬金額</label>
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  {FX_SCENARIOS.includes(sc)&&<select value={fxCur} onChange={e=>setFxCur(e.target.value)} style={{padding:"4px 8px",borderRadius:8,background:"rgba(0,122,255,0.06)",border:`1px solid rgba(0,122,255,0.15)`,fontSize:12,fontWeight:700,color:S.blue,cursor:"pointer",appearance:"auto",WebkitAppearance:"menulist"}}>
                    {Object.keys(FX_RATES).map(c=><option key={c} value={c}>{c}</option>)}
                  </select>}
                  <div style={{display:"flex",alignItems:"center",background:S.segBg,borderRadius:10,padding:"6px 12px"}}>
                    <span style={{fontSize:15,fontWeight:500,color:S.sec,marginRight:4}}>{fxCur==="HKD"?"$":fxCur}</span>
                  <input type="number" inputMode="numeric" value={amt||""} onChange={e=>setAmt(Math.max(0,parseInt(e.target.value)||0))} placeholder="0" style={{width:96,textAlign:"right",fontSize:17,fontWeight:600,background:"transparent",border:"none",outline:"none",color:S.blue,letterSpacing:-0.41}}/>
                </div></div>
              </div>
              {FX_SCENARIOS.includes(sc)&&fxCur!=="HKD"&&amt>0&&<p style={{fontSize:12,color:S.blue,fontWeight:600,textAlign:"right",marginBottom:4}}>≈ HK${fxToHKD.toLocaleString()} <span style={{fontSize:10,fontWeight:400,color:S.label}}>(1 {fxCur} ≈ {FX_RATES[fxCur]} HKD {fxLive?"🟢":"⚪"})</span></p>}
              <input type="range" min={0} max={sMax} step={100} value={Math.min(amt,sMax)} onChange={e=>setAmt(parseInt(e.target.value))} style={{width:"100%",accentColor:S.blue}}/>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:4}}>
                <span style={{fontSize:10,color:S.label}}>$0</span>
                {editMax?<div style={{display:"flex",alignItems:"center",gap:4}}>
                  <span style={{fontSize:10,color:S.label}}>$</span>
                  <input type="number" autoFocus value={sMax===-1?"":sMax} onChange={e=>{const v=e.target.value;setSMax(v===""?-1:parseInt(v)||0);}} onBlur={()=>{setSMax(v=>Math.max(1000,v<0?3000:v));setEditMax(false);}} onKeyDown={e=>{if(e.key==="Enter"){setSMax(v=>Math.max(1000,v<0?3000:v));setEditMax(false);}}} style={{width:60,fontSize:11,fontWeight:700,color:S.blue,background:"rgba(0,122,255,0.06)",border:`1px solid ${S.blue}`,borderRadius:8,padding:"3px 6px",outline:"none",textAlign:"right"}}/>
                </div>:<button onClick={()=>setEditMax(true)} style={{fontSize:10,color:S.label,background:"none",border:"none",cursor:"pointer",padding:"2px 4px",borderRadius:4}}>${sMax.toLocaleString()} ✎</button>}
              </div>
              {/* Quick amount buttons */}
              <div style={{display:"flex",gap:6,marginTop:10,alignItems:"center"}}>
                {quickAmts.map(v=>(
                  <button key={v} onClick={()=>{setAmt(v);if(v>sMax)setSMax(Math.ceil(v/1000)*1000);}} style={{flex:1,padding:"7px 0",borderRadius:10,fontSize:11,fontWeight:600,background:amt===v?"rgba(0,122,255,0.08)":S.bg,color:amt===v?S.blue:S.sec,border:amt===v?`1px solid rgba(0,122,255,0.2)`:"1px solid transparent",cursor:"pointer"}}>${v>=1000?`${v/1000}k`:v}</button>
                ))}
                <button onClick={()=>setEditQuick(p=>!p)} style={{width:28,height:28,borderRadius:8,background:editQuick?"rgba(0,122,255,0.08)":S.bg,border:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:14,color:editQuick?S.blue:S.label}}>⚙</button>
              </div>
              {editQuick&&<div style={{marginTop:8,padding:12,background:S.bg,borderRadius:12}}>
                <p style={{fontSize:10,fontWeight:600,color:S.label,marginBottom:6}}>自訂快捷金額（逗號分隔）</p>
                <input type="text" defaultValue={quickAmts.join(",")} onBlur={e=>{const vals=e.target.value.split(",").map(s=>parseInt(s.trim())).filter(n=>n>0&&!isNaN(n)).slice(0,6);if(vals.length>=2)setQuickAmts(vals.sort((a,b)=>a-b));setEditQuick(false);}} onKeyDown={e=>{if(e.key==="Enter")e.target.blur();}} style={{width:"100%",padding:"8px 10px",borderRadius:8,border:`1px solid ${S.sep}`,fontSize:13,fontWeight:600,outline:"none",color:S.dark,boxSizing:"border-box"}}/>
              </div>}
            </div>
            {/* Inline tooltip for step 5: below amount */}
            {tut===6&&<div style={{position:"relative",zIndex:9995}}>
              <div style={{width:0,height:0,borderLeft:"10px solid transparent",borderRight:"10px solid transparent",borderBottom:"10px solid #fff",marginLeft:24}}/>
              <div style={{background:S.card,borderRadius:16,padding:16,boxShadow:darkMode?"0 8px 30px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.08)":"0 8px 30px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.05)"}}>
                <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}><span style={{fontSize:10,fontWeight:700,color:S.blue,letterSpacing:1}}>步驟 4/9</span><div style={{flex:1,height:3,borderRadius:2,background:darkMode?"#3A3A3C":"#E5E5EA"}}><div style={{height:3,borderRadius:2,background:S.blue,width:"44%"}}/></div></div>
                <p style={{fontSize:15,fontWeight:600,color:S.dark}}>輸入今次簽賬金額</p>
                <div style={{display:"flex",gap:8,marginTop:12}}><button onClick={()=>setTut(0)} style={{padding:"8px 16px",borderRadius:16,background:S.bg,border:"none",fontSize:12,fontWeight:600,color:S.label,cursor:"pointer"}}>跳過</button><button onClick={tutNext} style={{flex:1,padding:"8px 16px",borderRadius:16,background:S.blue,border:"none",fontSize:12,fontWeight:700,color:"#fff",cursor:"pointer"}}>下一步 →</button></div>
              </div>
            </div>}

            {/* 3) Mode Toggle */}
            <div id="tut-mode" style={{position:"relative",display:"flex",padding:3,borderRadius:10,background:S.segBg,...hlStyle("mode")}}>
              <div style={{position:"absolute",top:3,bottom:3,borderRadius:8,background:S.segInd,boxShadow:darkMode?"0 1px 4px rgba(0,0,0,0.4)":"0 3px 8px rgba(0,0,0,0.12), 0 3px 1px rgba(0,0,0,0.04)",transition:"all 0.2s ease",width:"calc(50% - 3px)",left:mode==="cashback"?3:"calc(50%)"}}/>
              <button onClick={()=>setMode("cashback")} style={{position:"relative",zIndex:2,flex:1,padding:"9px 0",borderRadius:9,fontSize:13,fontWeight:600,background:"none",border:"none",cursor:"pointer",color:mode==="cashback"?S.dark:S.label}}>💰 現金回贈</button>
              <button onClick={()=>setMode("miles")} style={{position:"relative",zIndex:2,flex:1,padding:"9px 0",borderRadius:9,fontSize:13,fontWeight:600,background:"none",border:"none",cursor:"pointer",color:mode==="miles"?S.dark:S.label}}>✈️ 飛行里數</button>
            </div>
            {/* Inline tooltip for step 4: mode toggle */}
            {tut===5&&<div style={{position:"relative",zIndex:9995}}>
              <div style={{width:0,height:0,borderLeft:"10px solid transparent",borderRight:"10px solid transparent",borderBottom:"10px solid #fff",marginLeft:24}}/>
              <div style={{background:S.card,borderRadius:16,padding:16,boxShadow:darkMode?"0 8px 30px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.08)":"0 8px 30px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.05)"}}>
                <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}><span style={{fontSize:10,fontWeight:700,color:S.blue,letterSpacing:1}}>步驟 3/9</span><div style={{flex:1,height:3,borderRadius:2,background:darkMode?"#3A3A3C":"#E5E5EA"}}><div style={{height:3,borderRadius:2,background:S.blue,width:"33%"}}/></div></div>
                <p style={{fontSize:15,fontWeight:600,color:S.dark}}>揀返你想睇「現金回贈」定「飛行里數」</p>
                <div style={{display:"flex",gap:8,marginTop:12}}><button onClick={()=>setTut(0)} style={{padding:"8px 16px",borderRadius:16,background:S.bg,border:"none",fontSize:12,fontWeight:600,color:S.label,cursor:"pointer"}}>跳過</button><button onClick={tutNext} style={{flex:1,padding:"8px 16px",borderRadius:16,background:S.blue,border:"none",fontSize:12,fontWeight:700,color:"#fff",cursor:"pointer"}}>下一步 →</button></div>
              </div>
            </div>}

            {/* 4) Result Card — BIGGER fonts */}
            {/* Inline tooltip for step 6: above result */}
            {tut===7&&<div style={{position:"relative",zIndex:9995}}>
              <div style={{background:S.card,borderRadius:16,padding:16,boxShadow:darkMode?"0 8px 30px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.08)":"0 8px 30px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.05)"}}>
                <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}><span style={{fontSize:10,fontWeight:700,color:S.blue,letterSpacing:1}}>步驟 5/9</span><div style={{flex:1,height:3,borderRadius:2,background:darkMode?"#3A3A3C":"#E5E5EA"}}><div style={{height:3,borderRadius:2,background:S.blue,width:"56%"}}/></div></div>
                <p style={{fontSize:15,fontWeight:600,color:S.dark,lineHeight:1.5}}>推薦卡 + 保底卡即刻顯示！撳「更多最抵嘅卡」可以睇全市場 Top 5 排名</p>
                <div style={{display:"flex",gap:8,marginTop:12}}><button onClick={()=>setTut(0)} style={{padding:"8px 16px",borderRadius:16,background:S.bg,border:"none",fontSize:12,fontWeight:600,color:S.label,cursor:"pointer"}}>跳過</button><button onClick={tutNext} style={{flex:1,padding:"8px 16px",borderRadius:16,background:S.blue,border:"none",fontSize:12,fontWeight:700,color:"#fff",cursor:"pointer"}}>下一步 →</button></div>
              </div>
              <div style={{width:0,height:0,borderLeft:"10px solid transparent",borderRight:"10px solid transparent",borderTop:"10px solid #fff",margin:"0 auto"}}/>
            </div>}
            <div id="tut-result" style={{borderRadius:22,padding:22,background:S.card,border:p?`1px solid rgba(52,199,89,0.15)`:`1px solid ${S.sep}`,boxShadow:S.shadow,...hlStyle("result")}}>
              {!p?(
                <div style={{textAlign:"center",padding:"20px 0",cursor:noCards?"pointer":undefined}} onClick={()=>noCards&&setTab("cards")}>
                  <div style={{fontSize:36,marginBottom:12}}>{noCards?"👆":amt===0?"💰":"🤷"}</div>
                  <p style={{color:S.dark,fontWeight:600,fontSize:16}}>{noCards?"先去揀你有嘅信用卡":amt===0?"揀好場景，輸入金額即刻計":mode==="miles"?"你持有嘅卡冇適用嘅里數回贈":"你持有嘅卡冇適用嘅現金回贈"}</p>
                  {noCards?<div style={{marginTop:10,padding:"10px 20px",borderRadius:14,background:S.blue,display:"inline-block",cursor:"pointer"}}><span style={{color:"#fff",fontSize:13,fontWeight:700}}>去揀卡 →</span></div>
                  :amt===0?<p style={{color:S.label,fontSize:12,marginTop:8}}>撳上面嘅快捷金額或拉動滑桿</p>
                  :amt>0&&<p style={{color:S.label,fontSize:12,marginTop:8}}>試下切換{mode==="miles"?"「現金回贈」":"「飛行里數」"}模式，或者去 Card Holder 加多張卡</p>}
                </div>
              ):(
                <div>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
                    <div>
                      <p style={{fontSize:11,fontWeight:700,color:S.label,textTransform:"uppercase",letterSpacing:1.5}}>推薦使用</p>
                      <h3 style={{fontSize:20,fontWeight:800,color:S.dark,marginTop:4,letterSpacing:-0.5}}>{p.card.name}{p.notOwned&&<span style={{fontSize:11,fontWeight:600,color:"#FF9500",marginLeft:8,verticalAlign:"middle"}}>未持有</span>}</h3>
                      <p style={{fontSize:13,color:S.sec,marginTop:4,letterSpacing:-0.08}}>{p?getScenarioDesc(p.card,sc,p.rate,isCB,vs):""}</p>
                      {p.notOwned&&<a href={`https://www.google.com/search?q=${encodeURIComponent(p.card.name+" 申請 香港")}`} target="_blank" rel="noopener noreferrer" style={{fontSize:11,color:S.blue,marginTop:4,display:"inline-block"}}>了解更多 / 申請 →</a>}
                      {p.card.cond&&p.card.cond[sc]&&(
                        <div style={{marginTop:6,padding:"6px 10px",borderRadius:10,background:darkMode?"rgba(255,149,0,0.12)":"#FFF8E1",border:darkMode?"1px solid rgba(255,149,0,0.3)":"1px solid #FFE082",display:"inline-block"}}>
                          <span style={{fontSize:11,color:"#FF9500",fontWeight:600}}>{p.card.cond[sc]}</span>
                        </div>
                      )}
                      {p.minWarning&&<div style={{marginTop:6,padding:"6px 10px",borderRadius:10,background:darkMode?"rgba(255,59,48,0.12)":"#FFF1F0",border:darkMode?"1px solid rgba(255,59,48,0.3)":"1px solid #FFD1D1",display:"inline-block"}}><span style={{fontSize:11,color:S.red,fontWeight:600}}>{p.minWarning}</span></div>}
                      {(()=>{const ex=getExpiry(p.card);return ex?<p style={{fontSize:10,color:ex.color,fontWeight:600,marginTop:4}}>{ex.text}</p>:null;})()}
                    </div>
                    <div style={{width:36,height:36,borderRadius:18,background:isCB?"rgba(52,199,89,0.04)":"rgba(0,122,255,0.04)",display:"flex",alignItems:"center",justifyContent:"center"}}>{isCB?<Wallet size={18} color={S.green}/>:<Plane size={18} color={S.blue}/>}</div>
                  </div>
                  <div style={{display:"flex",alignItems:"flex-end",justifyContent:"space-between",marginBottom:16}}>
                    <div>
                      {(()=>{
                        const bocB=getBocBonus(p.card,sc,bocMs,bocMf);
                        const rd=isRedDay();const bocLabel=["physicalFX","travelJKSTA"].includes(sc)?"飛":"派";
                        const hasBoc=bocB>0;
                        if(isCB&&hasBoc){
                          const cardVal=p.val;const bocVal=amt*bocB;const total=cardVal+bocVal;
                          return <>
                            <p style={{fontSize:11,color:S.label}}>合計回贈</p>
                            <p style={{fontSize:36,fontWeight:800,color:S.green,lineHeight:1.1,letterSpacing:-0.5}}>${total.toFixed(1)}</p>
                            <p style={{fontSize:12,color:S.sec,marginTop:4}}>卡積分 ${cardVal.toFixed(1)} ({(p.rate*100).toFixed(1)}%) + 狂賞{bocLabel}{rd?"🔴":"⚪"} ${bocVal.toFixed(1)} ({(bocB*100).toFixed(0)}%)</p>
                            {p.fxFee>0&&<p style={{fontSize:11,color:S.sec,marginTop:2}}>扣手續費後 ≈ ${(amt*(p.rate-p.fxFee)+bocVal).toFixed(1)}</p>}
                          </>;
                        }
                        if(!isCB&&hasBoc){
                          return <>
                            <p style={{fontSize:11,color:S.label}}>預期里數</p>
                            <p style={{fontSize:36,fontWeight:800,color:S.blue,lineHeight:1.1,letterSpacing:-0.5}}>{Math.round(p.val).toLocaleString()} 里</p>
                            <p style={{fontSize:12,color:S.green,fontWeight:600,marginTop:4}}>+ 狂賞{bocLabel} {rd?"🔴紅日":"⚪平日"}另加 {(bocB*100).toFixed(0)}% 現金回贈 ≈ <span style={{fontWeight:800}}>${(amt*bocB).toFixed(1)}</span></p>
                          </>;
                        }
                        return <>
                          <p style={{fontSize:11,color:S.label}}>{isCB?"預期回贈":"預期里數"}</p>
                          <p style={{fontSize:36,fontWeight:800,color:isCB?S.green:S.blue,lineHeight:1.1,letterSpacing:-0.5}}>{isCB?`$${p.val.toFixed(1)}`:`${Math.round(p.val).toLocaleString()} 里`}</p>
                          {isCB&&p.fxFee>0&&<p style={{fontSize:12,color:S.sec,marginTop:4}}>扣手續費後 ≈ <span style={{color:(p.rate-p.fxFee)>0?S.green:S.red,fontWeight:600}}>${(amt*(p.rate-p.fxFee)).toFixed(1)}</span></p>}
                        </>;
                      })()}
                    </div>
                    <div style={{padding:"8px 14px",borderRadius:14,background:isCB?"linear-gradient(135deg, #34C759, #28A745)":"linear-gradient(135deg, #007AFF, #0056D6)",boxShadow:isCB?"0 4px 12px rgba(52,199,89,0.3)":"0 4px 12px rgba(0,122,255,0.3)"}}>
                      {(()=>{
                        const bocB=getBocBonus(p.card,sc,bocMs,bocMf);
                        if(isCB&&bocB>0)return <>
                          <p style={{fontSize:20,fontWeight:700,color:"#fff",letterSpacing:-0.36}}>{(p.rate*100).toFixed(1)}%+{(bocB*100).toFixed(0)}%</p>
                          <p style={{fontSize:11,color:"rgba(255,255,255,0.8)",marginTop:1}}>積分+狂賞{["physicalFX","travelJKSTA"].includes(sc)?"飛":"派"}</p>
                        </>;
                        return <>
                          <p style={{fontSize:22,fontWeight:700,color:"#fff",letterSpacing:-0.36}}>{isCB?`${(p.rate*100).toFixed(1)}%`:`$${parseFloat(p.rate.toFixed(2))}/里`}</p>
                          {p.fxFee>0&&<p style={{fontSize:10,color:"rgba(255,255,255,0.8)",marginTop:2}}>{isCB?`扣手續費${(p.fxFee*100).toFixed(2)}%`:`手續費$${Math.round(amt*p.fxFee)}`}</p>}
                          {p.fxFee===0&&FX_SCENARIOS.includes(sc)&&<p style={{fontSize:10,color:"rgba(255,255,255,0.9)",marginTop:2}}>✅ 免手續費</p>}
                        </>;
                      })()}
                    </div>
                  </div>
                  {/* Swapped from capped card note */}
                  {co&&(
                    <div style={{background:darkMode?"rgba(255,149,0,0.12)":"#FFF8E1",borderRadius:16,padding:12,marginBottom:10,border:darkMode?"1px solid rgba(255,149,0,0.3)":"1px solid #FFE082"}}>
                      <p style={{fontSize:12,fontWeight:700,color:"#FF9500",marginBottom:4}}>🚨 {co.card.name} 已超出回贈上限</p>
                      <p style={{fontSize:11,color:S.sec,lineHeight:1.5}}>簽 ${amt.toLocaleString()} 超出上限 {co.capAmt?`$${co.capAmt.toLocaleString()}/月`:""}，自動推薦保底卡</p>
                    </div>
                  )}
                  {p.card.capInfo&&(
                    <div style={{background:p.overCap?(darkMode?"rgba(255,149,0,0.12)":"#FFF8E1"):(darkMode?"rgba(255,59,48,0.12)":"#FFF1F0"),borderRadius:S.rad,padding:14,marginBottom:10,border:p.overCap?(darkMode?"1px solid rgba(255,149,0,0.3)":"1px solid #FFE082"):(darkMode?"1px solid rgba(255,59,48,0.3)":"1px solid #FFD1D1")}}>
                      {p.overCap?(
                        <div>
                          <p style={{fontSize:13,fontWeight:700,color:"#FF9500",marginBottom:6}}>🚨 已超出此卡回贈上限</p>
                          <p style={{fontSize:12,color:S.sec,lineHeight:1.6}}>上限 <strong style={{color:S.dark}}>${p.capAmt.toLocaleString()}/月</strong>，超出部分只得基本回贈{(()=>{const spent=(cardSpending.cards[p.card.id]?.byScenario?.[sc]?.spent)||0;return spent>0?`\n本期已簽 $${spent.toLocaleString()}`:"";})()}</p>
                          {fb&&<div style={{marginTop:10,paddingTop:10,borderTop:`1px solid ${S.sep}`}}>
                            <p style={{fontSize:11,color:S.label,marginBottom:4}}>👉 建議改用{fb.notOwned?"（市面推薦）":""}</p>
                            <p style={{fontSize:14,fontWeight:600,color:S.dark}}>{fb.card.name} <span style={{color:isCB?S.green:S.blue}}>{isCB?`${(fb.rate*100).toFixed(1)}%`:`$${parseFloat(fb.rate.toFixed(2))}/里`}</span>{fb.notOwned&&<span style={{color:"#FF9500",fontSize:11,marginLeft:6}}>未持有</span>}</p>
                            {fb.card.cond&&fb.card.cond[sc]&&<p style={{fontSize:11,color:"#FF9500",marginTop:2}}>{fb.card.cond[sc]}</p>}
                          </div>}
                        </div>
                      ):(
                        <div>
                          <p style={{fontSize:13,fontWeight:700,color:S.red,marginBottom:4}}>⚠️ 此卡有回贈上限</p>
                          <p style={{fontSize:12,color:S.sec,lineHeight:1.5}}>{p.card.capInfo}</p>
                          {(()=>{const spent=(cardSpending.cards[p.card.id]?.byScenario?.[sc]?.spent)||0;const cap=p.capAmt;if(!cap)return null;const pct=Math.min((spent/cap)*100,100);const afterPct=Math.min(((spent+amt)/cap)*100,100);const isOver=spent>=cap;const willOver=(spent+amt)>cap;return(
                            <div style={{marginTop:8}}>
                              <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:isOver?"#FF9500":S.sec,marginBottom:3}}>
                                <span>本月已簽 ${spent.toLocaleString()}</span>
                                <span>上限 ${cap.toLocaleString()}</span>
                              </div>
                              <div style={{height:8,borderRadius:4,background:darkMode?"#3A3A3C":"#E5E5EA",overflow:"hidden",position:"relative"}}>
                                <div style={{height:"100%",borderRadius:4,background:isOver?"#FF9500":willOver?"#FF9500":S.green,width:`${pct}%`,transition:"width 0.3s"}}/>
                                {amt>0&&!isOver&&<div style={{position:"absolute",top:0,left:`${pct}%`,height:"100%",borderRadius:4,background:willOver?"rgba(255,59,48,0.3)":"rgba(52,199,89,0.3)",width:`${Math.min(afterPct-pct,100-pct)}%`}}/>}
                              </div>
                              <p style={{fontSize:10,color:willOver?"#FF9500":S.label,marginTop:3}}>{isOver?"已爆 Cap！超出部分只得基本回贈":willOver?`⚠️ 加埋今筆 $${amt.toLocaleString()} 會超出上限`:`剩餘 $${(cap-spent).toLocaleString()}`}</p>
                            </div>
                          );})()}
                          {fb&&<div style={{marginTop:10,paddingTop:10,borderTop:`1px solid ${S.sep}`}}>
                            <p style={{fontSize:11,color:S.label,marginBottom:4}}>{fb.notOwned?"💡 市面最佳保底卡":"🛡️ 保底可用"}</p>
                            <p style={{fontSize:14,fontWeight:600,color:S.dark}}>{fb.card.name} <span style={{color:isCB?S.green:S.blue}}>{isCB?`${(fb.rate*100).toFixed(1)}%`:`$${parseFloat(fb.rate.toFixed(2))}/里`}</span>{fb.notOwned&&<span style={{color:"#FF9500",fontSize:11,marginLeft:6}}>未持有</span>}</p>
                            {fb.card.cond&&fb.card.cond[sc]&&<p style={{fontSize:11,color:"#FF9500",marginTop:2}}>{fb.card.cond[sc]}</p>}
                          </div>}
                        </div>
                      )}
                    </div>
                  )}
                  {/* Fallback when no capInfo but fallback exists */}
                  {!p.card.capInfo&&fb&&(
                    <div style={{background:S.bg,borderRadius:16,padding:12,marginBottom:10}}>
                      <p style={{fontSize:11,color:S.label,marginBottom:4}}>{fb.notOwned?"💡 市面最佳保底卡":"🛡️ 保底可用"}</p>
                      <p style={{fontSize:14,fontWeight:600,color:S.dark}}>{fb.card.name} <span style={{color:isCB?S.green:S.blue}}>{isCB?`${(fb.rate*100).toFixed(1)}%`:`$${parseFloat(fb.rate.toFixed(2))}/里`}</span>{fb.notOwned&&<span style={{color:"#FF9500",fontSize:11,marginLeft:6}}>未持有</span>}</p>
                      {fb.card.cond&&fb.card.cond[sc]&&<p style={{fontSize:11,color:"#FF9500",marginTop:2}}>{fb.card.cond[sc]}</p>}
                    </div>
                  )}
                  {gb&&(
                    <div style={{background:gb.card.id===p.card.id?(darkMode?"rgba(52,199,89,0.12)":"rgba(52,199,89,0.06)"):(darkMode?"rgba(255,149,0,0.1)":"#FFFBEB"),borderRadius:16,padding:12}}>
                      {gb.card.id===p.card.id?<p style={{fontSize:12,fontWeight:600,color:S.green}}>🎉 推薦俾你嘅卡已經係全城最抵！</p>
                      :ownsG?<p style={{fontSize:12,fontWeight:600,color:S.green}}>🎉 你已經擁有全城最抵嘅卡！</p>
                      :<div>
                        <p style={{fontSize:11,color:S.label,marginBottom:4}}>✨ 全城最抵</p>
                        <p style={{fontSize:14,fontWeight:600,color:S.dark}}>{gb.card.name} <span style={{color:"#FF9500"}}>{isCB?`${(gb.rate*100).toFixed(1)}%`:`$${parseFloat(gb.rate.toFixed(2))}/里`}</span>{!own.includes(gb.card.id)&&<span style={{color:"#FF9500",fontSize:11,marginLeft:6}}>未持有</span>}</p>
                        {gb.card.cond&&gb.card.cond[sc]&&<p style={{fontSize:11,color:"#FF9500",marginTop:2}}>{gb.card.cond[sc]}</p>}
                        <a href={`https://www.google.com/search?q=${encodeURIComponent(gb.card.name+" 申請 香港")}`} target="_blank" rel="noopener noreferrer" style={{fontSize:11,color:S.blue,marginTop:6,display:"inline-block"}}>了解更多 / 申請 →</a>
                      </div>}
                    </div>
                  )}
                  {/* CBF net return for FX scenarios — cashback only */}
                  {isCB&&FX_SCENARIOS.includes(sc)&&p&&(()=>{
                    const fee=getFxFee(p.card,sc);const net=p.rate-fee;
                    return <div style={{background:"rgba(0,122,255,0.03)",borderRadius:12,padding:10,marginTop:8,border:`1px solid rgba(0,122,255,0.08)`}}>
                      <p style={{fontSize:11,fontWeight:600,color:S.dark}}>💱 外幣手續費分析</p>
                      <p style={{fontSize:10,color:S.sec,marginTop:3,lineHeight:1.6}}>回贈 {(p.rate*100).toFixed(2)}% − 手續費 {(fee*100).toFixed(2)}% = <strong style={{color:net>0?S.green:S.red}}>淨回贈 {(net*100).toFixed(2)}%</strong>{net<=0?" ⚠️ 蝕手續費！":""}</p>
                    </div>;
                  })()}
                  {/* More top cards — market-wide */}
                  {amt>0&&p&&(()=>{
                    const allRanked=isCB
                      ?CARDS.map(c=>({card:c,rate:getRate(c,sc,vs,guru,moxTier,dbsLfFx,wewaCategory,bocMs,bocMf,regs)+getBocBonus(c,sc,bocMs,bocMf)})).filter(x=>x.rate>0).sort((a,b)=>b.rate-a.rate)
                      :CARDS.filter(c=>c.type==="miles"||c.type==="both").map(c=>({card:c,rate:getMPD(c,sc,vs,guru,moxTier,dbsLfFx,wewaCategory,regs)})).filter(x=>x.rate&&x.rate<50).sort((a,b)=>a.rate-b.rate);
                    const top=allRanked.filter(x=>x.card.id!==p.card.id).slice(0,5);
                    if(top.length===0)return null;
                    return <div style={{marginTop:10}}>
                      <button onClick={()=>setCalcExpanded(x=>x===true?false:true)} style={{width:"100%",padding:"8px 0",background:"none",border:"none",cursor:"pointer",fontSize:12,fontWeight:600,color:S.blue,display:"flex",alignItems:"center",justifyContent:"center",gap:4}}>
                        {calcExpanded===true?"收起 ▲":"更多最抵嘅卡 ▼"}
                      </button>
                      {calcExpanded===true&&<div style={{display:"flex",flexDirection:"column",gap:8,marginTop:4}}>
                        {top.map((x,i)=>{const isOwned=own.includes(x.card.id);const fee=FX_SCENARIOS.includes(sc)?getFxFee(x.card,sc):0;const ex=getExpiry(x.card);const ic=ISSUER_COLORS[x.card.issuer]||{bg:"#8E8E93",short:"?"};return(
                          <div key={x.card.id} style={{background:S.card,borderRadius:14,padding:"10px 14px",border:`1px solid ${S.sep}`}}>
                            <div style={{display:"flex",alignItems:"center",gap:8}}>
                              <div style={{padding:"3px 8px",borderRadius:6,background:ic.bg,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><span style={{fontSize:9,fontWeight:700,color:"#fff"}}>{ic.short}</span></div>
                              <div style={{flex:1,minWidth:0}}>
                                <p style={{fontSize:13,fontWeight:600,color:S.dark,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{x.card.name}</p>
                                <p style={{fontSize:10,color:S.label,marginTop:1,lineHeight:1.4}}>{x.card.desc}</p>
                              </div>
                              <div style={{textAlign:"right",flexShrink:0}}>
                                <p style={{fontSize:14,fontWeight:700,color:isCB?S.green:S.blue}}>{isCB?`${(x.rate*100).toFixed(1)}%`:`$${parseFloat(x.rate.toFixed(2))}/里`}</p>
                                <p style={{fontSize:10,color:isOwned?S.green:"#FF9500",marginTop:1}}>{isOwned?"✓ 持有":"未持有"}</p>
                              </div>
                            </div>
                            {isCB&&fee>0&&<p style={{fontSize:10,color:S.sec,marginTop:4}}>💱 手續費 {(fee*100).toFixed(2)}%，淨回贈 {((x.rate-fee)*100).toFixed(2)}%</p>}
                            {x.card.capInfo&&<p style={{fontSize:10,color:S.red,marginTop:2}}>⚠️ {x.card.capInfo}</p>}
                            {ex&&<p style={{fontSize:10,color:ex.color,marginTop:2}}>{ex.short}</p>}
                            {!isOwned&&<a href={`https://www.google.com/search?q=${encodeURIComponent(x.card.name+" 申請 香港 迎新")}`} target="_blank" rel="noopener noreferrer" onClick={e=>e.stopPropagation()} style={{fontSize:10,color:S.blue,marginTop:2,display:"inline-block"}}>了解更多 / 申請 →</a>}
                          </div>
                        );})}
                      </div>}
                    </div>;
                  })()}
                  {/* Single card tip */}
                  {own.length===1&&!fb&&<p style={{fontSize:11,color:S.label,textAlign:"center",marginTop:8}}>💡 加多一張信用卡可以比較邊張更抵</p>}
                </div>
              )}
            </div>

            {/* 記一筆 — always visible */}
            <div id="tut-logbtn" style={{background:darkMode?"rgba(255,159,10,0.08)":"linear-gradient(135deg, #FFF8F0 0%, #FFF1E0 50%, #FFE8CC 100%)",borderRadius:S.rad,padding:14,boxShadow:S.shadow,border:"1px solid rgba(255,159,10,0.15)",...hlStyle("logbtn")}}>
              {p&&amt>0?(()=>{
                const pCap=p.capAmt||0;
                const pSpent=(cardSpending.cards[p.card.id]?.byScenario?.[sc]?.spent)||0;
                const pExhausted=pCap>0&&(pSpent+amt)>pCap;
                const btnBase={borderRadius:12,border:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6,transition:"all 0.15s",fontSize:12,fontWeight:600,minWidth:0};
                const mkDate=()=>new Date(logDate+"T"+new Date().toTimeString().slice(0,8)).toISOString();
                return(
                  <div>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                      <p style={{fontSize:14,fontWeight:700,color:"#FF9500"}}>✏️ 記一筆</p>
                      <div style={{display:"flex",alignItems:"center",gap:6}}>
                        {logDate!==new Date().toISOString().slice(0,10)&&<button onClick={()=>setLogDate(new Date().toISOString().slice(0,10))} style={{padding:"5px 10px",borderRadius:20,background:"rgba(52,199,89,0.08)",border:"1px solid rgba(52,199,89,0.2)",cursor:"pointer",fontSize:12,fontWeight:600,color:S.green}}>今日</button>}
                        <div style={{position:"relative"}}>
                          <div onClick={()=>{const el=document.getElementById("log-date-input");if(el)el.showPicker?.();}} style={{padding:"6px 12px",borderRadius:20,background:logDate!==new Date().toISOString().slice(0,10)?"rgba(0,122,255,0.08)":darkMode?"rgba(255,255,255,0.06)":"rgba(0,0,0,0.04)",cursor:"pointer",display:"flex",alignItems:"center",gap:5,border:logDate!==new Date().toISOString().slice(0,10)?`1px solid rgba(0,122,255,0.2)`:"1px solid transparent"}}>
                            <CalendarDays size={13} color={logDate!==new Date().toISOString().slice(0,10)?S.blue:S.sec}/>
                            <span style={{fontSize:13,fontWeight:600,color:logDate!==new Date().toISOString().slice(0,10)?S.blue:S.dark}}>{(()=>{const[ly,lm,ld]=logDate.split("-");const today=new Date().toISOString().slice(0,10);return logDate===today?"今日":`${parseInt(lm)}月${parseInt(ld)}日`;})()}</span>
                          </div>
                          <input id="log-date-input" type="date" value={logDate} onChange={e=>setLogDate(e.target.value)} max={new Date().toISOString().slice(0,10)} style={{position:"absolute",top:0,left:0,width:"100%",height:"100%",opacity:0,cursor:"pointer"}}/>
                        </div>
                      </div>
                    </div>
                    {/* Amount + Memo row */}
                    <div style={{display:"flex",gap:8,marginBottom:10,alignItems:"center"}}>
                      <p style={{fontSize:13,color:S.sec,flexShrink:0}}>簽賬金額 <strong style={{color:S.dark,fontSize:15}}>${amt.toLocaleString()}</strong></p>
                      <input type="text" value={logMemo} onChange={e=>setLogMemo(e.target.value)} placeholder="Mark低用咗咩錢" maxLength={40} style={{flex:1,padding:"6px 10px",borderRadius:10,border:`1px solid ${S.sep}`,background:S.card,fontSize:12,outline:"none",color:S.dark,minWidth:0}}/>
                    </div>
                    {pExhausted&&<p style={{fontSize:11,color:"#FF9500",marginBottom:8}}>⚠️ 已簽 ${pSpent.toLocaleString()} / ${pCap.toLocaleString()}，建議用保底卡</p>}
                    <p style={{fontSize:10,color:S.label,marginBottom:6}}>撳下面揀用邊張卡記賬 ↓</p>
                    {/* 2x2 grid: 推薦 | 保底 / 其他 | 現金 */}
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                      {/* Row 1 Left: 推薦卡 */}
                      {p.notOwned?(
                        <div style={{padding:"12px 10px",borderRadius:14,background:darkMode?"rgba(255,149,0,0.08)":"#FFFBEB",border:darkMode?"1px solid rgba(255,149,0,0.3)":"1px solid #FFE082",textAlign:"center"}}>
                          <p style={{fontSize:11,fontWeight:600,color:"#FF9500"}}>未持有 {p.card.name}</p>
                        </div>
                      ):(
                        <button onClick={()=>{addLog(p.card.id,p.card.name,sc,amt,p.rate,!isCB,mkDate(),logMemo);scrollTop();}} style={{...btnBase,padding:"12px 10px",background:pExhausted?S.bg:isCB?"linear-gradient(135deg, #34C759, #28A745)":"linear-gradient(135deg, #007AFF, #0056D6)",color:pExhausted?S.label:"#fff",boxShadow:pExhausted?"none":isCB?"0 4px 12px rgba(52,199,89,0.3)":"0 4px 12px rgba(0,122,255,0.3)",borderRadius:14}}>
                          <PlusCircle size={14} style={{flexShrink:0}}/>
                          <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",fontSize:12}}>{p.card.name}</span>
                        </button>
                      )}
                      {/* Row 1 Right: 保底卡 */}
                      {fb?(
                        <button onClick={()=>{addLog(fb.card.id,fb.card.name,sc,amt,fb.rate,!isCB,mkDate(),logMemo);scrollTop();}} style={{...btnBase,padding:"12px 10px",background:pExhausted?isCB?"linear-gradient(135deg, #34C759, #28A745)":"linear-gradient(135deg, #007AFF, #0056D6)":S.bg,color:pExhausted?"#fff":S.sec,boxShadow:pExhausted?isCB?"0 4px 12px rgba(52,199,89,0.3)":"0 4px 12px rgba(0,122,255,0.3)":"none",borderRadius:14}}>
                          <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",fontSize:12}}>🛡️ {fb.card.name}</span>
                        </button>
                      ):(
                        <div style={{padding:"12px 10px",borderRadius:14,background:S.bg,textAlign:"center"}}>
                          <p style={{fontSize:11,color:S.label}}>冇保底卡</p>
                        </div>
                      )}
                      {/* Row 2 Left: 其他卡 */}
                      <button onClick={()=>{setLogOther(o=>!o);setLogCash(false);}} style={{...btnBase,padding:"12px 10px",background:logOther?"rgba(0,122,255,0.08)":S.bg,color:S.dark,borderRadius:14,border:logOther?`2px solid ${S.blue}`:"2px solid transparent"}}>
                        <span style={{fontSize:12}}>📋 {logOther?"收起":"其他卡"}</span>
                      </button>
                      {/* Row 2 Right: 現金/八達通 */}
                      <button onClick={()=>{setLogCash(o=>!o);setLogOther(false);}} style={{...btnBase,padding:"12px 10px",background:logCash?"rgba(255,159,10,0.08)":S.bg,color:S.dark,borderRadius:14,border:logCash?`2px solid #FF9500`:"2px solid transparent"}}>
                        <span style={{fontSize:12}}>💵 {logCash?"收起":"現金/其他"}</span>
                      </button>
                    </div>
                    {/* 現金/八達通/其他 expandable */}
                    {logCash&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6,marginTop:8}}>
                      {[{id:"_cash",label:"💴 現金",emoji:"💴"},{id:"_octopus",label:"🐙 八達通",emoji:"🐙"},{id:"_other",label:"🔄 其他",emoji:"🔄"}].map(o=>
                        <button key={o.id} onClick={()=>{addLog(o.id,o.label.slice(2),sc,amt,0,false,mkDate(),logMemo);setLogCash(false);scrollTop();}} style={{...btnBase,padding:"12px 8px",background:S.card,color:S.dark,borderRadius:14,border:`1px solid ${S.sep}`,justifyContent:"center"}}>
                          <span style={{fontSize:12}}>{o.label}</span>
                        </button>
                      )}
                    </div>}
                    {/* 其他卡 expandable list */}
                    {logOther&&own.length>0&&<div style={{display:"flex",flexDirection:"column",gap:6,marginTop:8}}>
                      {own.filter(id=>(!p||p.notOwned||id!==p.card.id)&&(!fb||id!==fb.card.id)).map(id=>{
                        const c=CARDS.find(x=>x.id===id);
                        if(!c)return null;
                        const r=isCB?getRate(c,sc,vs,guru,moxTier,dbsLfFx,wewaCategory,bocMs,bocMf,regs):getMPD(c,sc,vs,guru,moxTier,dbsLfFx,wewaCategory,regs);
                        if(!r||r<=0)return null;
                        return <button key={id} onClick={()=>{addLog(c.id,c.name,sc,amt,r,!isCB,mkDate(),logMemo);setLogOther(false);scrollTop();}} style={{...btnBase,padding:"13px 14px",background:S.card,color:S.dark,borderRadius:14,fontSize:13,justifyContent:"space-between",border:`1px solid ${S.sep}`}}>
                          <span style={{display:"flex",alignItems:"center",gap:8,overflow:"hidden"}}>
                            <PlusCircle size={14} style={{flexShrink:0,color:S.label}}/>
                            <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.name}</span>
                          </span>
                          <span style={{color:isCB?S.green:S.blue,fontSize:12,fontWeight:700,flexShrink:0}}>{isCB?`${(r*100).toFixed(1)}%`:`$${parseFloat(r.toFixed(2))}/里`}</span>
                        </button>;
                      })}
                    </div>}
                  </div>
                );
              })():(
                <div style={{textAlign:"center",padding:"4px 0"}}>
                  <p style={{fontSize:14,fontWeight:700,color:"#FF9500"}}>✏️ 記一筆</p>
                  <p style={{fontSize:12,color:S.label,marginTop:4}}>{noCards?"先揀卡再記帳":"輸入金額即可記帳"}</p>
                </div>
              )}
            </div>

            {/* Inline tooltip for step 7: 記一筆 — just above the box */}
            {tut===8&&<div style={{position:"relative",zIndex:9995}}>
              <div style={{width:0,height:0,borderLeft:"10px solid transparent",borderRight:"10px solid transparent",borderBottom:"10px solid #fff",marginLeft:24}}/>
              <div style={{background:S.card,borderRadius:16,padding:16,boxShadow:darkMode?"0 8px 30px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.08)":"0 8px 30px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.05)"}}>
                <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}><span style={{fontSize:10,fontWeight:700,color:S.blue,letterSpacing:1}}>步驟 6/9</span><div style={{flex:1,height:3,borderRadius:2,background:darkMode?"#3A3A3C":"#E5E5EA"}}><div style={{height:3,borderRadius:2,background:S.blue,width:"67%"}}/></div></div>
                <p style={{fontSize:15,fontWeight:600,color:S.dark}}>碌完卡撳「記一筆」追蹤消費，爆 Cap 時會自動建議轉保底卡！</p>
                <div style={{display:"flex",gap:8,marginTop:12}}><button onClick={()=>setTut(0)} style={{padding:"8px 16px",borderRadius:16,background:S.bg,border:"none",fontSize:12,fontWeight:600,color:S.label,cursor:"pointer"}}>跳過</button><button onClick={tutNext} style={{flex:1,padding:"8px 16px",borderRadius:16,background:S.blue,border:"none",fontSize:12,fontWeight:700,color:"#fff",cursor:"pointer"}}>下一步 →</button></div>
              </div>
            </div>}

            {/* Footer */}
            <div style={{background:"rgba(52,199,89,0.04)",borderRadius:14,padding:12,border:"1px solid rgba(52,199,89,0.1)",display:"flex",alignItems:"center",gap:10}}>
              <span style={{fontSize:20}}>🔒</span>
              <div>
                <p style={{fontSize:11,fontWeight:600,color:S.green}}>完全離線 · 零追蹤 · 零註冊</p>
                <p style={{fontSize:10,color:S.sec,marginTop:2,lineHeight:1.4}}>所有資料只存你手機，唔會上傳任何伺服器。冇帳號、冇廣告。</p>
              </div>
            </div>
            <a href="https://forms.gle/PwkderZ1RSDW7kRNA" target="_blank" rel="noopener noreferrer" style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,padding:12,borderRadius:12,background:S.card,fontSize:15,fontWeight:400,color:S.sec,boxShadow:S.shadow,textDecoration:"none",letterSpacing:-0.24}}><MessageSquare size={15}/> 意見回饋 / 報 Bug <ExternalLink size={11}/></a>
            <div style={{textAlign:"center"}}>
              <p style={{fontSize:11,fontWeight:600,color:S.blue}}>🚀 Beta 測試中</p>
              <p style={{fontSize:10,color:S.sec,marginTop:4,lineHeight:1.5}}>65 張卡資料以各銀行官方條款為準，如有出入歡迎回饋。</p>
              <button onClick={()=>setModal("tc")} style={{background:"none",border:"none",fontSize:10,color:S.label,cursor:"pointer",marginTop:6}}>🛡️ 僅供參考 · 點擊查看免責聲明</button>
              <p style={{fontSize:10,color:S.label,marginTop:4}}>admin@swipewhich.com</p>
            </div>
          </div>
        )}

        {tab==="cards"&&(
          <div style={{paddingTop:20,display:"flex",flexDirection:"column",gap:16}}>
            <div id="tut-cardlist" style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div>
                <h2 style={{fontSize:22,fontWeight:700,color:S.dark,letterSpacing:-0.26}}>Card Holder</h2>
                <p style={{fontSize:12,color:S.label,marginTop:2}}>已選 {own.length} / {CARDS.length} 張</p>
              </div>
              <div style={{display:"flex",gap:8}}>
                <button onClick={()=>setOwn(CARDS.map(c=>c.id))} style={{padding:"8px 12px",borderRadius:16,fontSize:11,fontWeight:700,background:S.blue,color:"#fff",border:"none",cursor:"pointer"}}>全選</button>
                <button onClick={()=>setOwn([])} style={{padding:"8px 12px",borderRadius:16,fontSize:11,fontWeight:600,background:S.card,color:S.label,border:`1px solid ${S.sep}`,cursor:"pointer"}}>全部移除</button>
              </div>
            </div>

            {noCards&&tut===0&&<div style={{background:darkMode?"rgba(255,59,48,0.12)":"#FFF1F0",borderRadius:12,padding:12,display:"flex",alignItems:"center",gap:8}}><AlertTriangle size={14} color={S.red}/><p style={{fontSize:12,fontWeight:600,color:S.red}}>請先剔選你擁有嘅信用卡</p></div>}
            {own.length===0&&tut===0&&<div style={{background:"rgba(0,122,255,0.04)",borderRadius:14,padding:12}}>
              <p style={{fontSize:12,color:S.sec,lineHeight:1.5}}>💡 只揀你<strong>錢包入面有</strong>嘅卡。唔使全選 — 揀得越準，推薦越啱你！</p>
            </div>}
            {own.length>0&&tut===0&&<div style={{background:"rgba(52,199,89,0.04)",borderRadius:12,padding:10,border:"1px solid rgba(52,199,89,0.08)"}}>
              <p style={{fontSize:11,color:S.sec,lineHeight:1.5}}>✅ 揀好卡即刻用到！下面銀行 ⚙️ 設定係<strong>進階功能</strong>（可選），唔設定一樣正常運作。</p>
            </div>}

            {/* Search */}
            <div style={{position:"relative",borderRadius:12}}>
              <input type="text" value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 搜尋信用卡名稱或銀行..." style={{width:"100%",padding:"8px 14px",borderRadius:10,border:"none",background:S.inputBg,fontSize:15,outline:"none",boxSizing:"border-box",letterSpacing:-0.24}}/>
              {search&&<button onClick={()=>setSearch("")} style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer"}}><X size={16} color={S.label}/></button>}
            </div>

            {/* Bank quick filter — multi-select */}
            <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:4,WebkitOverflowScrolling:"touch"}}>
              {bankFilter.length>0&&<button onClick={()=>setBankFilter([])} style={{padding:"6px 14px",borderRadius:20,fontSize:11,fontWeight:600,background:darkMode?"rgba(255,59,48,0.12)":"#FFF1F0",color:S.red,border:`1px solid rgba(255,59,48,0.2)`,cursor:"pointer",whiteSpace:"nowrap",flexShrink:0}}>重設 ✕</button>}
              {ISSUERS.map(iss=>{const cnt=(grouped[iss]||[]).filter(c=>own.includes(c.id)).length;const active=bankFilter.includes(iss);return(
                <button key={iss} onClick={()=>setBankFilter(p=>active?p.filter(x=>x!==iss):[...p,iss])} style={{padding:"6px 12px",borderRadius:20,fontSize:11,fontWeight:600,background:active?S.blue:S.card,color:active?"#fff":S.sec,border:`1px solid ${active?S.blue:S.sep}`,cursor:"pointer",whiteSpace:"nowrap",flexShrink:0}}>{iss}{cnt>0&&<span style={{marginLeft:3,fontSize:11,opacity:0.85}}>·{cnt}</span>}</button>
              );})}
            </div>

            {ISSUERS.filter(x=>filteredGrouped[x]&&(bankFilter.length===0||bankFilter.includes(x))).map((iss,gi)=>(
              <div key={iss}>
              <div style={{background:S.card,borderRadius:S.rad,overflow:"hidden",boxShadow:S.shadow,...hlStyle("cardlist")}}>
                <div style={{padding:"12px 16px",borderBottom:`1px solid ${S.sep}`,background:S.subtleBg}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      {(()=>{const ic=ISSUER_COLORS[iss]||{bg:"#8E8E93",short:"?"};return <div style={{padding:"3px 8px",borderRadius:6,background:ic.bg,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><span style={{fontSize:9,fontWeight:700,color:"#fff"}}>{ic.short}</span></div>;})()}
                      <p style={{fontSize:15,fontWeight:600,letterSpacing:-0.24,color:S.sec}}>{iss}</p>
                    </div>
                    <div style={{display:"flex",gap:4,flexWrap:"wrap",justifyContent:"flex-end"}}>
                  {iss==="American Express"&&(own.includes("ae_explorer")||own.includes("ae_plat_charge"))&&<button onClick={()=>setAeOpen(p=>!p)} style={{padding:"6px 12px",borderRadius:10,background:aeOpen?"rgba(0,122,255,0.08)":"rgba(118,118,128,0.08)",border:"none",cursor:"pointer",fontSize:11,fontWeight:600,color:aeOpen?S.blue:S.label}}>{aeOpen?"收起 ▲":"外幣優惠 ⚙️"}</button>}
                  {iss==="HSBC"&&(own.some(id=>["hsbc_vs","hsbc_plat","hsbc_gold","hsbc_pulse","hsbc_easy","hsbc_student","hsbc_premier","hsbc_everymile"].includes(id)))&&<button id="tut-hsbc-btn" onClick={()=>setHsbcOpen(p=>!p)} style={{padding:"6px 12px",borderRadius:10,background:hsbcOpen?"rgba(0,122,255,0.08)":"rgba(118,118,128,0.08)",border:"none",cursor:"pointer",fontSize:11,fontWeight:600,color:hsbcOpen?S.blue:S.label}}>{hsbcOpen?"收起 ▲":"最紅自主 & Guru ⚙️"}</button>}
                  {iss==="Hang Seng"&&(own.includes("hs_mmpower")||own.includes("hs_travel"))&&<button onClick={()=>setHsOpen(p=>!p)} style={{padding:"6px 12px",borderRadius:10,background:hsOpen?"rgba(0,122,255,0.08)":"rgba(118,118,128,0.08)",border:"none",cursor:"pointer",fontSize:11,fontWeight:600,color:hsOpen?S.blue:S.label}}>{hsOpen?"收起 ▲":"回贈登記 ⚙️"}</button>}
                  {iss==="Mox Bank"&&<button onClick={()=>setMoxOpen(p=>!p)} style={{padding:"6px 12px",borderRadius:10,background:moxOpen?"rgba(0,122,255,0.08)":"rgba(118,118,128,0.08)",border:"none",cursor:"pointer",fontSize:11,fontWeight:600,color:moxOpen?S.blue:S.label}}>{moxOpen?"收起 ▲":"存款設定 ⚙️"}</button>}
                  {iss==="DBS"&&(own.includes("dbs_live")||own.includes("dbs_eminent_vs")||own.includes("dbs_eminent_plat"))&&<button onClick={()=>setDbsOpen(p=>!p)} style={{padding:"6px 12px",borderRadius:10,background:dbsOpen?"rgba(0,122,255,0.08)":"rgba(118,118,128,0.08)",border:"none",cursor:"pointer",fontSize:11,fontWeight:600,color:dbsOpen?S.blue:S.label}}>{dbsOpen?"收起 ▲":"優惠設定 ⚙️"}</button>}
                  {iss==="安信"&&(own.includes("ds_wewa_vs")||own.includes("ds_wewa_up"))&&<button onClick={()=>setWewaOpen(p=>!p)} style={{padding:"6px 12px",borderRadius:10,background:wewaOpen?"rgba(0,122,255,0.08)":"rgba(118,118,128,0.08)",border:"none",cursor:"pointer",fontSize:11,fontWeight:600,color:wewaOpen?S.blue:S.label}}>{wewaOpen?"收起 ▲":"WeWa 自選 ⚙️"}</button>}
                  {iss==="Bank of China"&&<button onClick={()=>setBocOpen(p=>!p)} style={{padding:"6px 12px",borderRadius:10,background:bocOpen?"rgba(0,122,255,0.08)":"rgba(118,118,128,0.08)",border:"none",cursor:"pointer",fontSize:11,fontWeight:600,color:bocOpen?S.blue:S.label}}>{bocOpen?"收起 ▲":`狂賞派/飛 ${isRedDay()?"🔴":"⚪"} ⚙️`}</button>}
                  {iss==="BEA"&&own.includes("bea_world")&&<button onClick={()=>setBeaOpen(p=>!p)} style={{padding:"6px 12px",borderRadius:10,background:beaOpen?"rgba(0,122,255,0.08)":"rgba(118,118,128,0.08)",border:"none",cursor:"pointer",fontSize:11,fontWeight:600,color:beaOpen?S.blue:S.label}}>{beaOpen?"收起 ▲":"優惠登記 ⚙️"}</button>}
                  {iss==="CCB Asia"&&own.includes("ccb_eye")&&<button onClick={()=>setCcbOpen(p=>!p)} style={{padding:"6px 12px",borderRadius:10,background:ccbOpen?"rgba(0,122,255,0.08)":"rgba(118,118,128,0.08)",border:"none",cursor:"pointer",fontSize:11,fontWeight:600,color:ccbOpen?S.blue:S.label}}>{ccbOpen?"收起 ▲":"食飯優惠 ⚙️"}</button>}
                    </div>
                  </div>
                </div>
                {/* AE settings panel */}
                {iss==="American Express"&&aeOpen&&(own.includes("ae_explorer")||own.includes("ae_plat_charge"))&&(
                  <div style={{padding:"14px 16px",background:darkMode?"rgba(0,122,255,0.06)":"rgba(0,122,255,0.02)",borderBottom:`1px solid ${S.sep}`}}>
                    <p style={{fontSize:12,fontWeight:700,color:S.dark,marginBottom:8}}>外幣優惠登記狀態</p>
                    {own.includes("ae_explorer")&&<div style={{marginBottom:8}}>
                      <div style={{display:"flex",alignItems:"center",gap:6}}>
                        <span style={{fontSize:11,color:S.sec,flex:1}}>Explorer 外幣及旅遊優惠</span>
                        <button onClick={()=>setAeExplorerReg(p=>!p)} style={{padding:"5px 12px",borderRadius:8,fontSize:11,fontWeight:600,border:`1.5px solid ${aeExplorerReg?S.green:S.red}`,background:aeExplorerReg?"rgba(52,199,89,0.06)":"rgba(255,59,48,0.06)",color:aeExplorerReg?S.green:S.red,cursor:"pointer"}}>{aeExplorerReg?"✅ 已登記":"❌ 未登記"}</button>
                      </div>
                      <p style={{fontSize:10,color:S.label,marginTop:3,lineHeight:1.4}}>包括兩個優惠（需分別登記）：0.75X 額外積分 + 7X 額外積分</p>
                    </div>}
                    {own.includes("ae_plat_charge")&&<div style={{display:"flex",alignItems:"center",gap:6}}>
                      <span style={{fontSize:11,color:S.sec,flex:1}}>鋼卡外幣推廣</span>
                      <button onClick={()=>setAeChargeReg(p=>!p)} style={{padding:"5px 12px",borderRadius:8,fontSize:11,fontWeight:600,border:`1.5px solid ${aeChargeReg?S.green:S.red}`,background:aeChargeReg?"rgba(52,199,89,0.06)":"rgba(255,59,48,0.06)",color:aeChargeReg?S.green:S.red,cursor:"pointer"}}>{aeChargeReg?"✅ 已登記":"❌ 未登記"}</button>
                    </div>}
                  </div>
                )}
                {/* HSBC settings panel */}
                {iss==="HSBC"&&hsbcOpen&&(
                  <div id="tut-settings" style={{padding:"14px 16px",background:darkMode?"rgba(0,122,255,0.06)":"rgba(0,122,255,0.02)",borderBottom:`1px solid ${S.sep}`}}>                    <p style={{fontSize:12,fontWeight:700,color:S.dark,marginBottom:4}}>最紅自主獎賞</p>
                    <p style={{fontSize:10,color:S.label,marginBottom:8}}>如果你有喺 HSBC App 登記「最紅自主獎賞」，揀返你嗰個類別</p>
                    <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:6,marginBottom:14}}>
                      {[{k:"none",l:"❌ 冇登記",d:"無額外加碼"},{k:"world",l:"🌍 賞世界",d:"海外/外幣"},{k:"savour",l:"🍴 賞滋味",d:"食飯"},{k:"home",l:"🏠 賞家居",d:"超市/電器/電訊"},{k:"lifestyle",l:"🎬 賞享受",d:"戲院/健身/SPA"},{k:"shopping",l:"🛍️ 賞購物",d:"百貨/時裝/護膚"}].map(o=><button key={o.k} onClick={()=>setVs(o.k)} style={{padding:"8px 4px",borderRadius:10,fontSize:11,fontWeight:600,border:vs===o.k?`2px solid ${o.k==="none"?S.red:S.blue}`:`2px solid ${S.sep}`,background:vs===o.k?(o.k==="none"?"rgba(255,59,48,0.06)":"rgba(0,122,255,0.06)"):S.card,color:vs===o.k?(o.k==="none"?S.red:S.blue):S.label,cursor:"pointer",textAlign:"center"}}><div>{o.l}</div><div style={{fontSize:10,marginTop:2,opacity:0.85}}>{o.d}</div></button>)}
                    </div>
                    <p style={{fontSize:12,fontWeight:700,color:S.dark,marginBottom:4}}>Travel Guru 等級</p>
                    <p style={{fontSize:10,color:S.label,marginBottom:8}}>所有 HSBC 信用卡嘅海外簽賬加碼等級（非只限 EveryMile）</p>
                    <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:6}}>
                      {[{k:"none",l:"❌ 冇登記"},{k:"L1",l:"Lv1 GO +3%"},{k:"L2",l:"Lv2 GING +4%"},{k:"L3",l:"Lv3 GURU +6%"}].map(o=><button key={o.k} onClick={()=>setGuru(o.k)} style={{padding:10,borderRadius:12,fontSize:11,fontWeight:600,border:guru===o.k?`2px solid ${o.k==="none"?S.red:S.blue}`:`2px solid ${S.sep}`,background:guru===o.k?(o.k==="none"?"rgba(255,59,48,0.06)":"rgba(0,122,255,0.06)"):S.card,color:guru===o.k?(o.k==="none"?S.red:S.blue):S.label,cursor:"pointer"}}>{o.l}</button>)}
                    </div>
                    {own.includes("hsbc_everymile")&&<div style={{marginTop:12,paddingTop:10,borderTop:`1px solid ${S.sep}`}}>
                      <div style={{display:"flex",alignItems:"center",gap:6}}>
                        <span style={{fontSize:11,fontWeight:600,color:S.dark,flex:1}}>EveryMile 海外簽賬優惠</span>
                        <button onClick={()=>setEveryMileReg(p=>!p)} style={{padding:"5px 12px",borderRadius:8,fontSize:11,fontWeight:600,border:`1.5px solid ${everyMileReg?S.green:S.red}`,background:everyMileReg?"rgba(52,199,89,0.06)":"rgba(255,59,48,0.06)",color:everyMileReg?S.green:S.red,cursor:"pointer"}}>{everyMileReg?"✅ 已登記":"❌ 未登記"}</button>
                      </div>
                      <p style={{fontSize:10,color:S.label,marginTop:3}}>登記後海外 $2/里（每階段簽$12K）</p>
                    </div>}
                  </div>
                )}
                {iss==="Mox Bank"&&moxOpen&&(
                  <div style={{padding:"14px 16px",background:darkMode?"rgba(0,122,255,0.06)":"rgba(0,122,255,0.02)",borderBottom:`1px solid ${S.sep}`}}>
                    <p style={{fontSize:12,fontWeight:700,color:S.dark,marginBottom:4}}>MOX 存款等級</p>
                    <p style={{fontSize:10,color:S.label,marginBottom:8}}>維持 $250,000 活期存款可享更高回贈</p>
                    <div style={{display:"flex",gap:8}}>
                      <button onClick={()=>setMoxTier(false)} style={{flex:1,padding:10,borderRadius:12,fontSize:11,fontWeight:600,border:!moxTier?`2px solid ${S.blue}`:`2px solid ${S.sep}`,background:!moxTier?"rgba(0,122,255,0.06)":S.card,color:!moxTier?S.blue:S.label,cursor:"pointer",textAlign:"center"}}><div>基本</div><div style={{fontSize:11,marginTop:2,opacity:0.85}}>CashBack 1% · Miles $8/里</div></button>
                      <button onClick={()=>setMoxTier(true)} style={{flex:1,padding:10,borderRadius:12,fontSize:11,fontWeight:600,border:moxTier?`2px solid ${S.blue}`:`2px solid ${S.sep}`,background:moxTier?"rgba(0,122,255,0.06)":S.card,color:moxTier?S.blue:S.label,cursor:"pointer",textAlign:"center"}}><div>$250K 存款</div><div style={{fontSize:11,marginTop:2,opacity:0.85}}>CashBack 2% · Miles $4/里</div></button>
                    </div>
                  </div>
                )}
                {/* Hang Seng settings */}
                {iss==="Hang Seng"&&hsOpen&&(own.includes("hs_mmpower")||own.includes("hs_travel"))&&(
                  <div style={{padding:"14px 16px",background:darkMode?"rgba(0,122,255,0.06)":"rgba(0,122,255,0.02)",borderBottom:`1px solid ${S.sep}`}}>
                    <p style={{fontSize:12,fontWeight:700,color:S.dark,marginBottom:8}}>回贈優惠登記狀態</p>
                    {own.includes("hs_mmpower")&&<div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}>
                      <span style={{fontSize:11,color:S.sec,flex:1}}>MMPOWER 回贈計劃</span>
                      <button onClick={()=>setMmpowerReg(p=>!p)} style={{padding:"5px 12px",borderRadius:8,fontSize:11,fontWeight:600,border:`1.5px solid ${mmpowerReg?S.green:S.red}`,background:mmpowerReg?"rgba(52,199,89,0.06)":"rgba(255,59,48,0.06)",color:mmpowerReg?S.green:S.red,cursor:"pointer"}}>{mmpowerReg?"✅ 已登記":"❌ 未登記"}</button>
                    </div>}
                    {own.includes("hs_travel")&&<div style={{display:"flex",alignItems:"center",gap:6}}>
                      <span style={{fontSize:11,color:S.sec,flex:1}}>Travel+ 回贈計劃</span>
                      <button onClick={()=>setTravelPlusReg(p=>!p)} style={{padding:"5px 12px",borderRadius:8,fontSize:11,fontWeight:600,border:`1.5px solid ${travelPlusReg?S.green:S.red}`,background:travelPlusReg?"rgba(52,199,89,0.06)":"rgba(255,59,48,0.06)",color:travelPlusReg?S.green:S.red,cursor:"pointer"}}>{travelPlusReg?"✅ 已登記":"❌ 未登記"}</button>
                    </div>}
                  </div>
                )}
                {iss==="DBS"&&dbsOpen&&(
                  <div style={{padding:"14px 16px",background:darkMode?"rgba(0,122,255,0.06)":"rgba(0,122,255,0.02)",borderBottom:`1px solid ${S.sep}`}}>
                    {own.includes("dbs_live")&&<div style={{marginBottom:(own.includes("dbs_eminent_vs")||own.includes("dbs_eminent_plat"))?12:0}}>
                      <p style={{fontSize:12,fontWeight:700,color:S.dark,marginBottom:4}}>DBS Live Fresh 自選類別</p>
                      <p style={{fontSize:10,color:S.label,marginBottom:8}}>喺 DBS Card+ App 登記嘅網上簽賬類別</p>
                      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:6}}>
                        <button onClick={()=>setDbsLfFx("none")} style={{padding:10,borderRadius:12,fontSize:11,fontWeight:600,border:dbsLfFx==="none"?`2px solid ${S.red}`:`2px solid ${S.sep}`,background:dbsLfFx==="none"?"rgba(255,59,48,0.06)":S.card,color:dbsLfFx==="none"?S.red:S.label,cursor:"pointer",textAlign:"center"}}><div>❌ 未登記</div><div style={{fontSize:10,marginTop:2,opacity:0.85}}>只有基本 0.4%</div></button>
                        <button onClick={()=>setDbsLfFx("other")} style={{padding:10,borderRadius:12,fontSize:11,fontWeight:600,border:dbsLfFx==="other"?`2px solid ${S.blue}`:`2px solid ${S.sep}`,background:dbsLfFx==="other"?"rgba(0,122,255,0.06)":S.card,color:dbsLfFx==="other"?S.blue:S.label,cursor:"pointer",textAlign:"center"}}><div>🎭 娛樂/服飾</div><div style={{fontSize:10,marginTop:2,opacity:0.85}}>網購HKD 5.4%</div></button>
                        <button onClick={()=>setDbsLfFx("fx")} style={{padding:10,borderRadius:12,fontSize:11,fontWeight:600,border:dbsLfFx==="fx"?`2px solid ${S.blue}`:`2px solid ${S.sep}`,background:dbsLfFx==="fx"?"rgba(0,122,255,0.06)":S.card,color:dbsLfFx==="fx"?S.blue:S.label,cursor:"pointer",textAlign:"center"}}><div>🌍 外幣</div><div style={{fontSize:10,marginTop:2,opacity:0.85}}>網上外幣 6%</div></button>
                      </div>
                    </div>}
                    {(own.includes("dbs_eminent_vs")||own.includes("dbs_eminent_plat"))&&<div style={{paddingTop:own.includes("dbs_live")?10:0,borderTop:own.includes("dbs_live")?`1px solid ${S.sep}`:"none"}}>
                      <div style={{display:"flex",alignItems:"center",gap:6}}>
                        <span style={{fontSize:11,fontWeight:600,color:S.dark,flex:1}}>Eminent 5% 食飯回贈</span>
                        <button onClick={()=>setDbsEminentReg(p=>!p)} style={{padding:"5px 12px",borderRadius:8,fontSize:11,fontWeight:600,border:`1.5px solid ${dbsEminentReg?S.green:S.red}`,background:dbsEminentReg?"rgba(52,199,89,0.06)":"rgba(255,59,48,0.06)",color:dbsEminentReg?S.green:S.red,cursor:"pointer"}}>{dbsEminentReg?"✅ 已登記":"❌ 未登記"}</button>
                      </div>
                      <p style={{fontSize:10,color:S.label,marginTop:3}}>每年登記 + 單筆滿$300</p>
                    </div>}
                  </div>
                )}
                {iss==="安信"&&wewaOpen&&(own.includes("ds_wewa_vs")||own.includes("ds_wewa_up"))&&(
                  <div style={{padding:"14px 16px",background:darkMode?"rgba(0,122,255,0.06)":"rgba(0,122,255,0.02)",borderBottom:`1px solid ${S.sep}`}}>
                    <p style={{fontSize:12,fontWeight:700,color:S.dark,marginBottom:4}}>WeWa 自選加碼類別（4 揀 1）</p>
                    <p style={{fontSize:10,color:S.label,marginBottom:8}}>揀返你 WeWa 卡 App 登記嘅 4% 加碼類別</p>
                    <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:6}}>
                      {[{k:"travel",l:"✈️ 旅遊",d:"日韓泰中台+海外實體"},{k:"overseas",l:"🌍 海外",d:"網上外幣簽賬"},{k:"mobilePay",l:"📱 手機支付",d:"Apple/Google Pay"},{k:"entertainment",l:"🎮 網上娛樂",d:"串流/遊戲/訂閱"}].map(o=><button key={o.k} onClick={()=>setWewaCategory(o.k)} style={{padding:10,borderRadius:12,fontSize:11,fontWeight:600,border:wewaCategory===o.k?`2px solid ${S.blue}`:`2px solid ${S.sep}`,background:wewaCategory===o.k?"rgba(0,122,255,0.06)":S.card,color:wewaCategory===o.k?S.blue:S.label,cursor:"pointer",textAlign:"center"}}><div>{o.l}</div><div style={{fontSize:10,marginTop:2,opacity:0.85}}>{o.d}</div></button>)}
                    </div>
                  </div>
                )}
                {iss==="Bank of China"&&bocOpen&&(
                  <div style={{padding:"14px 16px",background:darkMode?"rgba(0,122,255,0.06)":"rgba(0,122,255,0.02)",borderBottom:`1px solid ${S.sep}`}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                      <p style={{fontSize:12,fontWeight:700,color:S.dark}}>中銀狂賞派/飛 (2026 H1)</p>
                      <span style={{fontSize:10,fontWeight:700,color:isRedDay()?S.red:S.label,background:isRedDay()?"rgba(255,59,48,0.08)":"rgba(118,118,128,0.08)",padding:"2px 8px",borderRadius:8}}>{isRedDay()?"🔴 今日紅日 +5%":"⚪ 今日平日 +2%"}</span>
                    </div>
                    <p style={{fontSize:10,color:S.label,marginBottom:10}}>需要喺推廣期內登記（名額有限）。狂賞派只限 Visa 卡，狂賞飛適用 Visa/MC（不包括銀聯）。額外回贈按交易日期自動判斷紅日/平日。</p>
                    <p style={{fontSize:11,fontWeight:600,color:S.sec,marginBottom:4}}>狂賞派（本地食飯/網購7大類別，Visa only）</p>
                    <div style={{display:"flex",gap:8,marginBottom:12}}>
                      <button onClick={()=>setBocMs("none")} style={{flex:1,padding:10,borderRadius:12,fontSize:11,fontWeight:600,border:bocMs==="none"?`2px solid ${S.red}`:`2px solid ${S.sep}`,background:bocMs==="none"?"rgba(255,59,48,0.06)":S.card,color:bocMs==="none"?S.red:S.label,cursor:"pointer",textAlign:"center"}}><div>❌ 未登記</div></button>
                      <button onClick={()=>setBocMs("registered")} style={{flex:1,padding:10,borderRadius:12,fontSize:11,fontWeight:600,border:bocMs==="registered"?`2px solid ${S.blue}`:`2px solid ${S.sep}`,background:bocMs==="registered"?"rgba(0,122,255,0.06)":S.card,color:bocMs==="registered"?S.blue:S.label,cursor:"pointer",textAlign:"center"}}><div>✅ 已登記</div><div style={{fontSize:10,marginTop:2,opacity:0.85}}>本地$6K+網購$3K月Cap</div></button>
                    </div>
                    <p style={{fontSize:11,fontWeight:600,color:S.sec,marginBottom:4}}>狂賞飛（海外實體簽賬，Visa/MC，排除銀聯）</p>
                    <div style={{display:"flex",gap:8}}>
                      <button onClick={()=>setBocMf("none")} style={{flex:1,padding:10,borderRadius:12,fontSize:11,fontWeight:600,border:bocMf==="none"?`2px solid ${S.red}`:`2px solid ${S.sep}`,background:bocMf==="none"?"rgba(255,59,48,0.06)":S.card,color:bocMf==="none"?S.red:S.label,cursor:"pointer",textAlign:"center"}}><div>❌ 未登記</div></button>
                      <button onClick={()=>setBocMf("registered")} style={{flex:1,padding:10,borderRadius:12,fontSize:11,fontWeight:600,border:bocMf==="registered"?`2px solid ${S.blue}`:`2px solid ${S.sep}`,background:bocMf==="registered"?"rgba(0,122,255,0.06)":S.card,color:bocMf==="registered"?S.blue:S.label,cursor:"pointer",textAlign:"center"}}><div>✅ 已登記</div><div style={{fontSize:10,marginTop:2,opacity:0.85}}>海外$6K月Cap</div></button>
                    </div>
                    {!isBocPromoActive()&&<p style={{fontSize:10,color:S.red,marginTop:8,fontWeight:600}}>⚠️ 狂賞派/飛推廣已過期（2026/6/30），額外回贈不適用</p>}
                  </div>
                )}
                {/* BEA settings */}
                {iss==="BEA"&&beaOpen&&own.includes("bea_world")&&(
                  <div style={{padding:"14px 16px",background:darkMode?"rgba(0,122,255,0.06)":"rgba(0,122,255,0.02)",borderBottom:`1px solid ${S.sep}`}}>
                    <div style={{display:"flex",alignItems:"center",gap:6}}>
                      <span style={{fontSize:11,fontWeight:600,color:S.dark,flex:1}}>World 5% 食飯/海外回贈</span>
                      <button onClick={()=>setBeaWorldReg(p=>!p)} style={{padding:"5px 12px",borderRadius:8,fontSize:11,fontWeight:600,border:`1.5px solid ${beaWorldReg?S.green:S.red}`,background:beaWorldReg?"rgba(52,199,89,0.06)":"rgba(255,59,48,0.06)",color:beaWorldReg?S.green:S.red,cursor:"pointer"}}>{beaWorldReg?"✅ 已登記":"❌ 未登記"}</button>
                    </div>
                    <p style={{fontSize:10,color:S.label,marginTop:3}}>App 登記 + 月簽$4,000</p>
                  </div>
                )}
                {/* CCB settings */}
                {iss==="CCB Asia"&&ccbOpen&&own.includes("ccb_eye")&&(
                  <div style={{padding:"14px 16px",background:darkMode?"rgba(0,122,255,0.06)":"rgba(0,122,255,0.02)",borderBottom:`1px solid ${S.sep}`}}>
                    <div style={{display:"flex",alignItems:"center",gap:6}}>
                      <span style={{fontSize:11,fontWeight:600,color:S.dark,flex:1}}>eye 食飯 11% 加碼</span>
                      <button onClick={()=>setCcbEyeReg(p=>!p)} style={{padding:"5px 12px",borderRadius:8,fontSize:11,fontWeight:600,border:`1.5px solid ${ccbEyeReg?S.green:S.red}`,background:ccbEyeReg?"rgba(52,199,89,0.06)":"rgba(255,59,48,0.06)",color:ccbEyeReg?S.green:S.red,cursor:"pointer"}}>{ccbEyeReg?"✅ 已搶到":"❌ 未搶到"}</button>
                    </div>
                    <p style={{fontSize:10,color:S.label,marginTop:3}}>每月1號 App 搶名額 + 月簽$8,000</p>
                  </div>
                )}
                {filteredGrouped[iss].map((c,i)=>{const sel=own.includes(c.id);return(
                  <button key={c.id} onClick={()=>toggle(c.id)} style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"12px 16px",textAlign:"left",background:sel?"rgba(0,122,255,0.04)":S.card,border:"none",borderBottom:i<filteredGrouped[iss].length-1?`0.5px solid ${S.sep}`:"none",cursor:"pointer",minHeight:44,boxSizing:"border-box"}}>
                    <div style={{flex:1,minWidth:0}}>
                      <p style={{fontSize:15,fontWeight:sel?600:400,color:sel?S.dark:S.label,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",letterSpacing:-0.24}}>{c.name}</p>
                      <p style={{fontSize:12,color:S.label,marginTop:2,lineHeight:1.4}}>{c.desc}</p>
                      <div style={{marginTop:4,display:"flex",alignItems:"center",gap:6}}><Badge type={c.type} dark={darkMode}/>{(()=>{const ex=getExpiry(c);return ex?<span style={{fontSize:10,color:ex.color,fontWeight:600}}>{ex.short}</span>:null;})()}</div>
                    </div>
                    {sel?<div style={{width:24,height:24,borderRadius:12,background:S.blue,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><Check size={14} color="#fff" strokeWidth={3}/></div>:<div style={{width:24,height:24,borderRadius:12,border:`2px solid ${S.sep}`,flexShrink:0}}/>}
                  </button>
                );})}
              </div>
              </div>
            ))}
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>setTut(1)} style={{flex:1,padding:12,borderRadius:S.rad,background:S.card,border:"none",fontSize:12,fontWeight:600,color:S.sec,cursor:"pointer",boxShadow:S.shadow,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}><HelpCircle size={14}/> 睇教學</button>
              <button onClick={()=>{if(!confirm("確定要重設所有資料？"))return;setOwn([]);setAmt(0);setVs("none");setGuru("none");setSMax(3000);setLogs([]);setSeen(false);try{localStorage.removeItem("sw_data");}catch(e){}}} style={{flex:1,padding:12,borderRadius:S.rad,background:S.card,border:"none",fontSize:12,fontWeight:600,color:S.red,cursor:"pointer",boxShadow:S.shadow,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}><RotateCcw size={14}/> 重設</button>
            </div>
            <p style={{textAlign:"center",fontSize:10,color:S.label,padding:8}}>© 2026 碌邊張 SwipeWhich · v1.2</p>
          </div>
        )}

        {/* ── GUIDE TAB ── */}
        {tab==="guide"&&(()=>{
          // Guide-local settings (override or fallback to global)
          const gVs=guideOvr?.vs??vs;const gGuru=guideOvr?.guru??guru;const gMox=guideOvr?.moxTier??moxTier;
          const gDbs=guideOvr?.dbsLfFx??dbsLfFx;const gWewa=guideOvr?.wewaCategory??wewaCategory;
          const gBocMs=guideOvr?.bocMs??bocMs;const gBocMf=guideOvr?.bocMf??bocMf;
          const gRegs={aeExplorerReg:guideOvr?.aeExplorerReg??aeExplorerReg,aeChargeReg:guideOvr?.aeChargeReg??aeChargeReg,everyMileReg:guideOvr?.everyMileReg??everyMileReg,mmpowerReg:guideOvr?.mmpowerReg??mmpowerReg,travelPlusReg:guideOvr?.travelPlusReg??travelPlusReg,dbsEminentReg:guideOvr?.dbsEminentReg??dbsEminentReg,beaWorldReg:guideOvr?.beaWorldReg??beaWorldReg,ccbEyeReg:guideOvr?.ccbEyeReg??ccbEyeReg};
          // Compute rankings for selected scenario (include BOC bonus in ranking)
          const isCBG=guideMode==="cashback"||guideMode==="combo";
          let ranked=[];
          if(guideMode==="cashback"||guideMode==="combo"){
            ranked=CARDS.map(c=>{const r=getRate(c,guideSc,gVs,gGuru,gMox,gDbs,gWewa,gBocMs,gBocMf,gRegs)+getBocBonus(c,guideSc,gBocMs,gBocMf);return{card:c,rate:r,val:r};}).filter(x=>x.rate>0).sort((a,b)=>b.rate-a.rate);
          }else{
            ranked=CARDS.filter(c=>c.type==="miles"||c.type==="both").map(c=>{const m=getMPD(c,guideSc,gVs,gGuru,gMox,gDbs,gWewa,gRegs);return{card:c,rate:m,val:m};}).filter(x=>x.rate&&x.rate<Infinity&&x.rate<50).sort((a,b)=>a.rate-b.rate);
          }
          const scenarioLabel=ALL_SCENARIOS.find(s=>s.id===guideSc);
          return(
            <div style={{paddingTop:20,display:"flex",flexDirection:"column",gap:16}}>
              <h2 style={{fontSize:22,fontWeight:700,color:S.dark,letterSpacing:-0.26}}>攻略</h2>
              <p style={{fontSize:12,color:S.label}}>每個消費場景嘅信用卡排名推薦</p>

              {/* Scenario selector */}
              <div>
                <label style={{fontSize:13,fontWeight:400,color:S.sec,letterSpacing:-0.08,display:"block",marginBottom:8}}>簽賬種類</label>
                <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:5}}>
                  {SCENARIOS.map(s=>{
                    const active=guideSc===s.id||(s.id==="physicalFX"&&guideSc==="travelJKSTA")||(s.id==="octopus"&&guideSc==="octopusManual");
                    return(
                      <button key={s.id} onClick={()=>{if(s.id==="physicalFX"){setGuideFxSub(true);setGuideOctSub(false);setGuideSc("physicalFX");}else if(s.id==="octopus"){setGuideOctSub(true);setGuideFxSub(false);setGuideSc("octopus");}else{setGuideFxSub(false);setGuideOctSub(false);setGuideSc(s.id);}}} style={{padding:"8px 2px",borderRadius:12,border:active?"2px solid #007AFF":"2px solid transparent",background:active?"rgba(0,122,255,0.08)":S.card,boxShadow:active?"none":(darkMode?"none":S.shadow),cursor:"pointer",textAlign:"center"}}>
                        <div style={{fontSize:20}}>{s.emoji}</div>
                        <div style={{fontSize:12,fontWeight:600,color:active?S.blue:S.dark,marginTop:2,letterSpacing:-0.08}}>{s.label}</div>
                        <div style={{fontSize:10,color:active?S.blue:S.label,marginTop:1,lineHeight:1.4}}>{s.sub}</div>
                      </button>
                    );
                  })}
                </div>
                {guideFxSub&&<div style={{display:"flex",gap:6,marginTop:6}}>
                  <button onClick={()=>setGuideSc("physicalFX")} style={{flex:1,padding:"8px",borderRadius:12,border:guideSc==="physicalFX"?"2px solid #007AFF":"2px solid "+S.sep,background:guideSc==="physicalFX"?"rgba(0,122,255,0.08)":S.card,cursor:"pointer"}}>
                    <span style={{fontSize:12,fontWeight:600,color:guideSc==="physicalFX"?S.blue:S.dark}}>🌍 一般外幣</span>
                  </button>
                  <button onClick={()=>setGuideSc("travelJKSTA")} style={{flex:1,padding:"8px",borderRadius:12,border:guideSc==="travelJKSTA"?"2px solid #007AFF":"2px solid "+S.sep,background:guideSc==="travelJKSTA"?"rgba(0,122,255,0.08)":S.card,cursor:"pointer"}}>
                    <span style={{fontSize:12,fontWeight:600,color:guideSc==="travelJKSTA"?S.blue:S.dark}}>🇯🇵 日韓泰中台</span>
                  </button>
                </div>}
                {guideOctSub&&<div style={{display:"flex",gap:6,marginTop:6}}>
                  <button onClick={()=>setGuideSc("octopus")} style={{flex:1,padding:"8px",borderRadius:12,border:guideSc==="octopus"?"2px solid #007AFF":"2px solid "+S.sep,background:guideSc==="octopus"?"rgba(0,122,255,0.08)":S.card,cursor:"pointer"}}>
                    <span style={{fontSize:12,fontWeight:600,color:guideSc==="octopus"?S.blue:S.dark}}>🔄 自動增值</span>
                  </button>
                  <button onClick={()=>setGuideSc("octopusManual")} style={{flex:1,padding:"8px",borderRadius:12,border:guideSc==="octopusManual"?"2px solid #007AFF":"2px solid "+S.sep,background:guideSc==="octopusManual"?"rgba(0,122,255,0.08)":S.card,cursor:"pointer"}}>
                    <span style={{fontSize:12,fontWeight:600,color:guideSc==="octopusManual"?S.blue:S.dark}}>📱 手動增值</span>
                  </button>
                </div>}
              </div>

              {/* Mode toggle — 3 options */}
              <div style={{position:"relative",display:"flex",padding:3,borderRadius:10,background:S.segBg}}>
                <div style={{position:"absolute",top:3,bottom:3,borderRadius:8,background:S.segInd,boxShadow:darkMode?"0 1px 4px rgba(0,0,0,0.4)":"0 3px 8px rgba(0,0,0,0.12), 0 3px 1px rgba(0,0,0,0.04)",transition:"all 0.2s ease",width:"calc(33.33% - 2px)",left:guideMode==="cashback"?3:guideMode==="miles"?"calc(33.33% + 1px)":"calc(66.67%)"}}/>
                <button onClick={()=>setGuideMode("cashback")} style={{position:"relative",zIndex:2,flex:1,padding:"9px 0",borderRadius:9,fontSize:12,fontWeight:600,background:"none",border:"none",cursor:"pointer",color:guideMode==="cashback"?S.dark:S.label}}>💰 現金</button>
                <button onClick={()=>setGuideMode("miles")} style={{position:"relative",zIndex:2,flex:1,padding:"9px 0",borderRadius:9,fontSize:12,fontWeight:600,background:"none",border:"none",cursor:"pointer",color:guideMode==="miles"?S.dark:S.label}}>✈️ 里數</button>
                <button onClick={()=>setGuideMode("combo")} style={{position:"relative",zIndex:2,flex:1,padding:"9px 0",borderRadius:9,fontSize:12,fontWeight:600,background:"none",border:"none",cursor:"pointer",color:guideMode==="combo"?S.dark:S.label}}>🏆 組合</button>
              </div>

              {/* Settings indicator — pill tags + ⚙️ toggle */}
              <div style={{borderRadius:14,overflow:"hidden",background:S.card,boxShadow:darkMode?"none":"0 1px 3px rgba(0,0,0,0.04)"}}>
                <button onClick={()=>setGuideSettings(p=>!p)} style={{width:"100%",padding:"10px 14px",background:"none",border:"none",cursor:"pointer",display:"flex",flexDirection:"column",gap:8,alignItems:"stretch"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <span style={{fontSize:12,fontWeight:600,color:S.dark}}>優惠等級設定</span>
                    <span style={{fontSize:11,color:S.blue,fontWeight:600,padding:"3px 10px",borderRadius:8,background:"rgba(0,122,255,0.06)"}}>{guideSettings?"收起 ▲":"⚙️ 設定"}</span>
                  </div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
                    {gVs&&gVs!=="none"&&<span style={{fontSize:10,padding:"3px 8px",borderRadius:6,background:"rgba(0,122,255,0.06)",color:S.blue,fontWeight:600}}>HSBC {({world:"賞世界",savour:"賞滋味",home:"賞家居",lifestyle:"賞享受",shopping:"賞購物"})[gVs]}</span>}
                    {gGuru&&gGuru!=="none"&&<span style={{fontSize:10,padding:"3px 8px",borderRadius:6,background:"rgba(0,122,255,0.06)",color:S.blue,fontWeight:600}}>Guru {({L1:"Lv1",L2:"Lv2",L3:"Lv3"})[gGuru]}</span>}
                    {gBocMs==="registered"&&<span style={{fontSize:10,padding:"3px 8px",borderRadius:6,background:"rgba(52,199,89,0.08)",color:S.green,fontWeight:600}}>狂賞派 ✓</span>}
                    {gBocMf==="registered"&&<span style={{fontSize:10,padding:"3px 8px",borderRadius:6,background:"rgba(52,199,89,0.08)",color:S.green,fontWeight:600}}>狂賞飛 ✓</span>}
                    {gDbs!=="none"&&own.includes("dbs_live")&&<span style={{fontSize:10,padding:"3px 8px",borderRadius:6,background:"rgba(0,122,255,0.06)",color:S.blue,fontWeight:600}}>DBS {gDbs==="fx"?"外幣":"娛樂"}</span>}
                    {gMox&&<span style={{fontSize:10,padding:"3px 8px",borderRadius:6,background:"rgba(0,122,255,0.06)",color:S.blue,fontWeight:600}}>MOX $250K</span>}
                    {gWewa!=="travel"&&(own.includes("ds_wewa_vs")||own.includes("ds_wewa_up"))&&<span style={{fontSize:10,padding:"3px 8px",borderRadius:6,background:"rgba(0,122,255,0.06)",color:S.blue,fontWeight:600}}>WeWa {({overseas:"海外",mobilePay:"手機",entertainment:"娛樂"})[gWewa]}</span>}
                    {!gRegs.aeExplorerReg&&<span style={{fontSize:10,padding:"3px 8px",borderRadius:6,background:"rgba(255,59,48,0.06)",color:S.red,fontWeight:600}}>AE Explorer ✗</span>}
                    {!gRegs.aeChargeReg&&<span style={{fontSize:10,padding:"3px 8px",borderRadius:6,background:"rgba(255,59,48,0.06)",color:S.red,fontWeight:600}}>AE 鋼卡 ✗</span>}
                    {!gRegs.everyMileReg&&<span style={{fontSize:10,padding:"3px 8px",borderRadius:6,background:"rgba(255,59,48,0.06)",color:S.red,fontWeight:600}}>EveryMile ✗</span>}
                    {!gRegs.mmpowerReg&&<span style={{fontSize:10,padding:"3px 8px",borderRadius:6,background:"rgba(255,59,48,0.06)",color:S.red,fontWeight:600}}>MMPOWER ✗</span>}
                    {!gRegs.travelPlusReg&&<span style={{fontSize:10,padding:"3px 8px",borderRadius:6,background:"rgba(255,59,48,0.06)",color:S.red,fontWeight:600}}>Travel+ ✗</span>}
                    {!gRegs.dbsEminentReg&&<span style={{fontSize:10,padding:"3px 8px",borderRadius:6,background:"rgba(255,59,48,0.06)",color:S.red,fontWeight:600}}>Eminent ✗</span>}
                    {!gRegs.beaWorldReg&&<span style={{fontSize:10,padding:"3px 8px",borderRadius:6,background:"rgba(255,59,48,0.06)",color:S.red,fontWeight:600}}>BEA World ✗</span>}
                    {!gRegs.ccbEyeReg&&<span style={{fontSize:10,padding:"3px 8px",borderRadius:6,background:"rgba(255,59,48,0.06)",color:S.red,fontWeight:600}}>建行eye ✗</span>}
                    {gVs==="none"&&gGuru==="none"&&gBocMs==="none"&&gBocMf==="none"&&<span style={{fontSize:10,padding:"3px 8px",borderRadius:6,background:"rgba(118,118,128,0.06)",color:S.label}}>未設定 — 撳「設定」揀返你嘅優惠等級</span>}
                  </div>
                </button>
                {guideSettings&&(()=>{
                  const gSet=(k,v)=>setGuideOvr(p=>({vs:p?.vs??vs,guru:p?.guru??guru,moxTier:p?.moxTier??moxTier,dbsLfFx:p?.dbsLfFx??dbsLfFx,wewaCategory:p?.wewaCategory??wewaCategory,bocMs:p?.bocMs??bocMs,bocMf:p?.bocMf??bocMf,aeExplorerReg:p?.aeExplorerReg??aeExplorerReg,aeChargeReg:p?.aeChargeReg??aeChargeReg,everyMileReg:p?.everyMileReg??everyMileReg,mmpowerReg:p?.mmpowerReg??mmpowerReg,travelPlusReg:p?.travelPlusReg??travelPlusReg,dbsEminentReg:p?.dbsEminentReg??dbsEminentReg,beaWorldReg:p?.beaWorldReg??beaWorldReg,ccbEyeReg:p?.ccbEyeReg??ccbEyeReg,[k]:v}));
                  return(
                  <div style={{padding:"0 14px 14px",display:"flex",flexDirection:"column",gap:14,borderTop:`1px solid ${S.sep}`}}>
                    {/* HSBC */}
                    <div style={{paddingTop:12}}>
                      <p style={{fontSize:11,fontWeight:700,color:S.dark,marginBottom:6}}>HSBC 最紅自主獎賞</p>
                      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:4}}>
                        {[{k:"none",l:"❌ 冇登記"},{k:"world",l:"🌍 賞世界"},{k:"savour",l:"🍴 賞滋味"},{k:"home",l:"🏠 賞家居"},{k:"lifestyle",l:"🎬 賞享受"},{k:"shopping",l:"🛍️ 賞購物"}].map(o=><button key={o.k} onClick={()=>gSet("vs",o.k)} style={{padding:"6px 2px",borderRadius:8,fontSize:10,fontWeight:600,border:gVs===o.k?`2px solid ${o.k==="none"?S.red:S.blue}`:`1px solid ${S.sep}`,background:gVs===o.k?(o.k==="none"?"rgba(255,59,48,0.06)":"rgba(0,122,255,0.06)"):S.card,color:gVs===o.k?(o.k==="none"?S.red:S.blue):S.label,cursor:"pointer"}}>{o.l}</button>)}
                      </div>
                      <p style={{fontSize:11,fontWeight:700,color:S.dark,marginTop:10,marginBottom:6}}>HSBC Travel Guru</p>
                      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:4}}>
                        {[{k:"none",l:"❌ 冇登記"},{k:"L1",l:"Lv1"},{k:"L2",l:"Lv2"},{k:"L3",l:"Lv3 GURU"}].map(o=><button key={o.k} onClick={()=>gSet("guru",o.k)} style={{padding:6,borderRadius:8,fontSize:10,fontWeight:600,border:gGuru===o.k?`2px solid ${o.k==="none"?S.red:S.blue}`:`1px solid ${S.sep}`,background:gGuru===o.k?(o.k==="none"?"rgba(255,59,48,0.06)":"rgba(0,122,255,0.06)"):S.card,color:gGuru===o.k?(o.k==="none"?S.red:S.blue):S.label,cursor:"pointer"}}>{o.l}</button>)}
                      </div>
                    </div>
                    {/* BOC */}
                    <div style={{borderTop:`1px solid ${S.sep}`,paddingTop:12}}>
                      <p style={{fontSize:11,fontWeight:700,color:S.dark,marginBottom:6}}>中銀狂賞派（Visa only）{isRedDay()?" 🔴紅日+5%":" ⚪平日+2%"}</p>
                      <div style={{display:"flex",gap:6}}>
                        <button onClick={()=>gSet("bocMs","none")} style={{flex:1,padding:6,borderRadius:8,fontSize:10,fontWeight:600,border:gBocMs==="none"?`2px solid ${S.red}`:`1px solid ${S.sep}`,background:gBocMs==="none"?"rgba(255,59,48,0.06)":S.card,color:gBocMs==="none"?S.red:S.label,cursor:"pointer"}}>❌ 未登記</button>
                        <button onClick={()=>gSet("bocMs","registered")} style={{flex:1,padding:6,borderRadius:8,fontSize:10,fontWeight:600,border:gBocMs==="registered"?`2px solid ${S.green}`:`1px solid ${S.sep}`,background:gBocMs==="registered"?darkMode?"rgba(52,199,89,0.12)":"rgba(52,199,89,0.06)":S.card,color:gBocMs==="registered"?S.green:S.label,cursor:"pointer"}}>✅ 已登記</button>
                      </div>
                      <p style={{fontSize:11,fontWeight:700,color:S.dark,marginTop:8,marginBottom:6}}>中銀狂賞飛（Visa/MC，排除銀聯）</p>
                      <div style={{display:"flex",gap:6}}>
                        <button onClick={()=>gSet("bocMf","none")} style={{flex:1,padding:6,borderRadius:8,fontSize:10,fontWeight:600,border:gBocMf==="none"?`2px solid ${S.red}`:`1px solid ${S.sep}`,background:gBocMf==="none"?"rgba(255,59,48,0.06)":S.card,color:gBocMf==="none"?S.red:S.label,cursor:"pointer"}}>❌ 未登記</button>
                        <button onClick={()=>gSet("bocMf","registered")} style={{flex:1,padding:6,borderRadius:8,fontSize:10,fontWeight:600,border:gBocMf==="registered"?`2px solid ${S.green}`:`1px solid ${S.sep}`,background:gBocMf==="registered"?darkMode?"rgba(52,199,89,0.12)":"rgba(52,199,89,0.06)":S.card,color:gBocMf==="registered"?S.green:S.label,cursor:"pointer"}}>✅ 已登記</button>
                      </div>
                    </div>
                    {/* DBS + WeWa + Mox */}
                    <div style={{borderTop:`1px solid ${S.sep}`,paddingTop:12}}>
                      <p style={{fontSize:11,fontWeight:700,color:S.dark,marginBottom:6}}>DBS Live Fresh 自選類別</p>
                      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:4}}>
                        {[{k:"none",l:"❌ 未登記"},{k:"other",l:"🎭 娛樂/服飾"},{k:"fx",l:"🌍 外幣"}].map(o=><button key={o.k} onClick={()=>gSet("dbsLfFx",o.k)} style={{padding:6,borderRadius:8,fontSize:10,fontWeight:600,border:gDbs===o.k?`2px solid ${o.k==="none"?S.red:S.blue}`:`1px solid ${S.sep}`,background:gDbs===o.k?(o.k==="none"?"rgba(255,59,48,0.06)":"rgba(0,122,255,0.06)"):S.card,color:gDbs===o.k?(o.k==="none"?S.red:S.blue):S.label,cursor:"pointer"}}>{o.l}</button>)}
                      </div>
                      <p style={{fontSize:11,fontWeight:700,color:S.dark,marginTop:8,marginBottom:6}}>WeWa 自選加碼（4選1）</p>
                      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:4}}>
                        {[{k:"travel",l:"✈️ 旅遊"},{k:"overseas",l:"🌍 海外"},{k:"mobilePay",l:"📱 手機"},{k:"entertainment",l:"🎮 娛樂"}].map(o=><button key={o.k} onClick={()=>gSet("wewaCategory",o.k)} style={{padding:6,borderRadius:8,fontSize:10,fontWeight:600,border:gWewa===o.k?`2px solid ${S.blue}`:`1px solid ${S.sep}`,background:gWewa===o.k?"rgba(0,122,255,0.06)":S.card,color:gWewa===o.k?S.blue:S.label,cursor:"pointer"}}>{o.l}</button>)}
                      </div>
                      <p style={{fontSize:11,fontWeight:700,color:S.dark,marginTop:8,marginBottom:6}}>MOX 存款等級</p>
                      <div style={{display:"flex",gap:6}}>
                        <button onClick={()=>gSet("moxTier",false)} style={{flex:1,padding:6,borderRadius:8,fontSize:10,fontWeight:600,border:!gMox?`2px solid ${S.blue}`:`1px solid ${S.sep}`,background:!gMox?"rgba(0,122,255,0.06)":S.card,color:!gMox?S.blue:S.label,cursor:"pointer"}}>基本</button>
                        <button onClick={()=>gSet("moxTier",true)} style={{flex:1,padding:6,borderRadius:8,fontSize:10,fontWeight:600,border:gMox?`2px solid ${S.blue}`:`1px solid ${S.sep}`,background:gMox?"rgba(0,122,255,0.06)":S.card,color:gMox?S.blue:S.label,cursor:"pointer"}}>$250K 存款</button>
                      </div>
                    </div>
                    {/* Registration toggles */}
                    <div style={{borderTop:`1px solid ${S.sep}`,paddingTop:12}}>
                      <p style={{fontSize:11,fontWeight:700,color:S.dark,marginBottom:6}}>優惠登記狀態</p>
                      {[{k:"aeExplorerReg",l:"AE Explorer 外幣及旅遊",v:gRegs.aeExplorerReg},{k:"aeChargeReg",l:"AE 鋼卡外幣",v:gRegs.aeChargeReg},{k:"everyMileReg",l:"EveryMile 海外",v:gRegs.everyMileReg},{k:"mmpowerReg",l:"MMPOWER 回贈",v:gRegs.mmpowerReg},{k:"travelPlusReg",l:"Travel+ 回贈",v:gRegs.travelPlusReg},{k:"dbsEminentReg",l:"DBS Eminent 5%",v:gRegs.dbsEminentReg},{k:"beaWorldReg",l:"BEA World 5%",v:gRegs.beaWorldReg},{k:"ccbEyeReg",l:"建行 eye 11%",v:gRegs.ccbEyeReg}].map(r=>(
                        <div key={r.k} style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}>
                          <span style={{fontSize:11,color:S.sec,flex:1}}>{r.l}</span>
                          <button onClick={()=>gSet(r.k,!r.v)} style={{padding:"4px 10px",borderRadius:8,fontSize:10,fontWeight:600,border:`1.5px solid ${r.v?S.green:S.red}`,background:r.v?"rgba(52,199,89,0.06)":"rgba(255,59,48,0.06)",color:r.v?S.green:S.red,cursor:"pointer"}}>{r.v?"✅ 已登記":"❌ 未登記"}</button>
                        </div>
                      ))}
                    </div>
                    <button onClick={()=>{setGuideOvr({vs:"none",guru:"none",moxTier:false,dbsLfFx:"none",wewaCategory:"travel",bocMs:"none",bocMf:"none",aeExplorerReg:true,aeChargeReg:true,everyMileReg:true,mmpowerReg:true,travelPlusReg:true,dbsEminentReg:true,beaWorldReg:true,ccbEyeReg:true});showGuideToast("⚙️ 已重設攻略設定（Card Holder 不受影響）");}} style={{padding:10,borderRadius:10,fontSize:11,fontWeight:600,border:`1px solid rgba(255,59,48,0.2)`,background:"rgba(255,59,48,0.04)",color:S.red,cursor:"pointer",textAlign:"center"}}>🔄 一鍵重設所有設定</button>
                  </div>);
                })()}
              </div>

              {/* Rankings or Combo View */}
              {guideMode==="combo"?(
                <div style={{display:"flex",flexDirection:"column",gap:12}}>
                  {ALL_SCENARIOS.map(s=>{
                    const cbRank=CARDS.map(c=>({card:c,rate:getRate(c,s.id,gVs,gGuru,gMox,gDbs,gWewa,gBocMs,gBocMf,gRegs)+getBocBonus(c,s.id,gBocMs,gBocMf)})).filter(x=>x.rate>0).sort((a,b)=>b.rate-a.rate);
                    const best=cbRank[0];const fb=cbRank.find(x=>x.card.noCap&&x.card.id!==(best?.card.id));
                    const miRank=CARDS.filter(c=>c.type==="miles"||c.type==="both").map(c=>({card:c,rate:getMPD(c,s.id,gVs,gGuru,gMox,gDbs,gWewa,gRegs)})).filter(x=>x.rate&&x.rate<50).sort((a,b)=>a.rate-b.rate);
                    const mBest=miRank[0];const mFb=miRank.find(x=>x.card.noCap&&x.card.id!==(mBest?.card.id));
                    const comboCard=(item,label,isMiles,accent)=>{
                      if(!item)return null;
                      const cid=`combo_${s.id}_${label}_${item.card.id}`;
                      const exp2=guideExpanded.has(cid);
                      const toggle2=()=>setGuideExpanded(p=>{const n=new Set(p);n.has(cid)?n.delete(cid):n.add(cid);return n;});
                      const ex=getExpiry(item.card);const mf=MILES_CONV_FEE[item.card.id];const cond1=item.card.cond?.[s.id];
                      return(<div onClick={toggle2} style={{flex:1,padding:"8px 10px",borderRadius:12,background:accent,border:`1px solid ${label==="首選"?(isMiles?"rgba(0,122,255,0.12)":"rgba(52,199,89,0.15)"):S.sep}`,minWidth:0,overflow:"hidden",cursor:"pointer"}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                          <p style={{fontSize:11,color:S.label}}>{label}</p>
                          <span style={{fontSize:10,color:S.blue,fontWeight:600,padding:"1px 5px",borderRadius:5,background:"rgba(0,122,255,0.06)"}}>{exp2?"▲":"▼"}</span>
                        </div>
                        <p style={{fontSize:12,fontWeight:600,color:S.dark,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{item.card.name}</p>
                        <p style={{fontSize:13,fontWeight:700,color:isMiles?S.blue:label==="首選"?S.green:S.sec}}>{isMiles?`$${parseFloat(item.rate.toFixed(2))}/里`:`${(item.rate*100).toFixed(1)}%`}</p>
                        {!exp2&&<p style={{fontSize:10,color:S.label,marginTop:2,lineHeight:1.4}}>{item.card.desc}</p>}
                        {exp2&&<div style={{marginTop:4,fontSize:10,lineHeight:1.7,color:S.sec,borderTop:`1px solid ${S.sep}`,paddingTop:4}}>
                          <p>{item.card.desc}</p>
                          {item.card.capInfo&&<p style={{color:S.red}}>⚠️ {item.card.capInfo}</p>}
                          {cond1&&<p style={{color:"#FF9500"}}>{cond1}</p>}
                          {ex&&<p style={{color:ex.color}}>{ex.text}</p>}
                          {mf&&<p style={{color:"#AF52DE"}}>💜 轉里數：{mf.fee}（{mf.note}）</p>}
                          {own.includes(item.card.id)?<p style={{color:S.green}}>✓ 已持有</p>:<p style={{color:"#FF9500"}}>未持有</p>}
                          {!own.includes(item.card.id)&&<a href={`https://www.google.com/search?q=${encodeURIComponent(item.card.name+" 申請 香港 迎新")}`} target="_blank" rel="noopener noreferrer" onClick={e=>e.stopPropagation()} style={{color:S.blue,fontWeight:600,fontSize:11}}>了解更多 / 申請 →</a>}
                        </div>}
                      </div>);
                    };
                    return(
                      <div key={s.id} style={{background:S.card,borderRadius:S.rad,overflow:"hidden",boxShadow:S.shadow}}>
                        <div style={{padding:"10px 14px",borderBottom:`1px solid ${S.sep}`,display:"flex",alignItems:"center",gap:8}}>
                          <span style={{fontSize:18}}>{s.emoji}</span>
                          <span style={{fontSize:14,fontWeight:700,color:S.dark}}>{s.label}</span>
                        </div>
                        <div style={{padding:14,display:"flex",flexDirection:"column",gap:10}}>
                          <div>
                            <p style={{fontSize:10,fontWeight:700,color:S.label,textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>💰 現金回贈</p>
                            <div style={{display:"flex",gap:8}}>
                              {comboCard(best,"首選",false,"rgba(52,199,89,0.06)")}
                              {fb&&fb.card.id!==best?.card.id&&comboCard(fb,"🛡️ 保底",false,S.bg)}
                            </div>
                          </div>
                          {mBest&&<div>
                            <p style={{fontSize:10,fontWeight:700,color:S.label,textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>✈️ 飛行里數</p>
                            <div style={{display:"flex",gap:8}}>
                              {comboCard(mBest,"首選",true,"rgba(0,122,255,0.04)")}
                              {mFb&&mFb.card.id!==mBest.card.id&&comboCard(mFb,"🛡️ 保底",true,S.bg)}
                            </div>
                          </div>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ):(<div>
              <div style={{background:S.card,borderRadius:S.rad,overflow:"hidden",boxShadow:darkMode?"none":"0 1px 2px rgba(0,0,0,0.04)"}}>
                <div style={{padding:"12px 16px",borderBottom:`1px solid ${S.sep}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <span style={{fontSize:14,fontWeight:700,color:S.dark}}>{scenarioLabel?.emoji} {scenarioLabel?.label}</span>
                  <span style={{fontSize:11,fontWeight:600,color:S.label}}>{isCBG?"回贈率排名":"$/里 排名 (低=好)"}</span>
                </div>
                {ranked.length===0&&<div style={{padding:20,textAlign:"center",color:S.label,fontSize:13}}>此場景暫無適用卡片</div>}
                {ranked.slice(0,20).map((item,i)=>{
                  const isOwned=own.includes(item.card.id);
                  const isTop3=i<3;
                  const medal=i===0?"🥇":i===1?"🥈":i===2?"🥉":null;
                  const expanded=guideExpanded.has(item.card.id);
                  const toggle=()=>setGuideExpanded(p=>{const n=new Set(p);n.has(item.card.id)?n.delete(item.card.id):n.add(item.card.id);return n;});
                  const cond1=item.card.cond?.[guideSc];
                  const ex=getExpiry(item.card);
                  const mf=guideMode!=="cashback"?MILES_CONV_FEE[item.card.id]:null;
                  const vsCards=["hsbc_vs","hsbc_plat","hsbc_gold","hsbc_pulse","hsbc_easy","hsbc_student","hsbc_premier"];
                  const vsMap={world:["onlineFX","physicalFX","travelJKSTA"],savour:["dining"],home:["supermarket"],lifestyle:["local"],shopping:["onlineHKD"]};
                  return(
                    <div key={item.card.id} onClick={toggle} style={{padding:isTop3?"12px 14px":"9px 14px",borderBottom:i<Math.min(ranked.length,20)-1?`1px solid ${S.bg}`:"none",background:expanded?"rgba(0,122,255,0.03)":isTop3?"rgba(0,122,255,0.02)":S.card,cursor:"pointer"}}>
                      {/* Row 1: medal + name + rate */}
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <div style={{width:28,textAlign:"center",fontSize:medal?22:12,fontWeight:700,color:medal?undefined:S.label,flexShrink:0}}>{medal||i+1}</div>
                        <div style={{flex:1,minWidth:0}}>
                          <p style={{fontSize:isTop3?15:13,fontWeight:isTop3?700:500,color:S.dark,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{item.card.name} {isOwned?"✓":""}</p>
                        </div>
                        <div style={{flexShrink:0}}>
                          {isTop3?<div style={{padding:"5px 10px",borderRadius:10,background:isCBG?"linear-gradient(135deg, #34C759, #28A745)":"linear-gradient(135deg, #007AFF, #0056D6)"}}>
                            <p style={{fontSize:14,fontWeight:700,color:"#fff"}}>{isCBG?`${(item.rate*100).toFixed(1)}%`:`$${parseFloat(item.rate.toFixed(2))}/里`}</p>
                          </div>:<p style={{fontSize:13,fontWeight:500,color:S.sec}}>{isCBG?`${(item.rate*100).toFixed(1)}%`:`$${parseFloat(item.rate.toFixed(2))}/里`}</p>}
                        </div>
                      </div>
                      {/* Row 2: always show — short desc + tap hint */}
                      <div style={{display:"flex",alignItems:"center",gap:6,marginTop:3,marginLeft:36}}>
                        <p style={{flex:1,fontSize:10,color:S.label,lineHeight:1.4}}>{item.card.desc}</p>
                        <span style={{fontSize:11,color:S.blue,fontWeight:600,flexShrink:0,padding:"1px 6px",borderRadius:6,background:"rgba(0,122,255,0.06)"}}>{expanded?"收起 ▲":"詳情 ▼"}</span>
                      </div>
                      {/* Expanded: full details */}
                      {expanded&&(
                        <div style={{marginTop:8,marginLeft:36,fontSize:10,lineHeight:1.7,color:S.sec,borderTop:`1px solid ${S.sep}`,paddingTop:8}}>
                          {item.card.capInfo&&<p style={{color:S.red}}>⚠️ {item.card.capInfo}</p>}
                          {cond1&&<p style={{color:"#FF9500"}}>{cond1}</p>}
                          {ex&&<p style={{color:ex.color,fontSize:11}}>{ex.text}</p>}
                          {vsCards.includes(item.card.id)&&gVs&&gVs!=="none"&&vsMap[gVs]?.includes(guideSc)&&<p style={{color:S.green}}>✓ 命中最紅自主「{({world:"賞世界",savour:"賞滋味",home:"賞家居",lifestyle:"賞享受",shopping:"賞購物"})[gVs]}」</p>}
                          {vsCards.includes(item.card.id)&&(!gVs||gVs==="none")&&<p style={{color:"#FF9500"}}>⚠️ 未登記最紅自主</p>}
                          {mf&&<p style={{color:"#AF52DE"}}>💜 轉里數：{mf.fee}（{mf.note}）</p>}
                          {!isOwned&&<a href={`https://www.google.com/search?q=${encodeURIComponent(item.card.name+" 申請 香港 迎新")}`} target="_blank" rel="noopener noreferrer" onClick={e=>e.stopPropagation()} style={{color:S.blue,fontWeight:600,fontSize:11}}>了解更多 / 申請 →</a>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {ranked.length>20&&<p style={{textAlign:"center",fontSize:11,color:S.label}}>顯示頭 20 張最佳卡片</p>}
              </div>)}

              {guideToast&&<div style={{position:"fixed",bottom:68,left:"50%",transform:"translateX(-50%)",zIndex:9999}}><div style={{background:darkMode?"#F5F5F7":"#1C1C1E",color:darkMode?"#000":"#fff",padding:"10px 18px",borderRadius:14,fontSize:13,fontWeight:600,boxShadow:"0 8px 24px rgba(0,0,0,0.3)",textAlign:"center"}}>{guideToast}</div></div>}
              <p style={{textAlign:"center",fontSize:10,color:S.label,padding:16}}>© 2026 碌邊張 SwipeWhich · v1.2</p>
            </div>
          );
        })()}

        {tab==="tracker"&&(()=>{
          const[y,m]=histMonth.split("-").map(Number);
          const shiftMonth=(d)=>{const dt=new Date(y,m-1+d,1);setHistMonth(`${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,"0")}`);};
          const monthStart=new Date(y,m-1,1);
          const monthEnd=new Date(y,m,1);
          const monthLogs=logs.filter(l=>{const d=new Date(l.date);return d>=monthStart&&d<monthEnd;}).sort((a,b)=>new Date(b.date)-new Date(a.date));
          const monthTotal=monthLogs.reduce((s,l)=>s+l.amount,0);
          const monthRebate=monthLogs.reduce((s,l)=>s+(l.rebate||0),0);
          const monthMiles=monthLogs.reduce((s,l)=>s+(l.miles||0),0);
          const now=new Date();const curKey=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
          const isCurrentMonth=histMonth===curKey;
          // Per-card spending for this month
          const mCards={};
          monthLogs.forEach(l=>{
            if(!mCards[l.cardId])mCards[l.cardId]={total:0,rebateTotal:0,milesTotal:0,byScenario:{},cardName:l.cardName};
            mCards[l.cardId].total+=l.amount;
            mCards[l.cardId].rebateTotal+=(l.rebate||0);
            mCards[l.cardId].milesTotal+=(l.miles||0);
            if(!mCards[l.cardId].byScenario[l.scenario])mCards[l.cardId].byScenario[l.scenario]={spent:0,rebate:0,miles:0};
            mCards[l.cardId].byScenario[l.scenario].spent+=l.amount;
            mCards[l.cardId].byScenario[l.scenario].rebate+=(l.rebate||0);
            mCards[l.cardId].byScenario[l.scenario].miles+=(l.miles||0);
          });
          // Per-category for this month
          const mCats={};
          monthLogs.forEach(l=>{
            if(!mCats[l.scenario])mCats[l.scenario]={spent:0,rebate:0,miles:0,count:0};
            mCats[l.scenario].spent+=l.amount;
            mCats[l.scenario].rebate+=(l.rebate||0);
            mCats[l.scenario].miles+=(l.miles||0);
            mCats[l.scenario].count++;
          });
          // Group by day
          const byDay={};
          monthLogs.forEach(l=>{const d=new Date(l.date);const dk=`${d.getMonth()+1}月${d.getDate()}日`;if(!byDay[dk])byDay[dk]=[];byDay[dk].push(l);});

          return(
            <div style={{paddingTop:16,display:"flex",flexDirection:"column",gap:14}}>
              {/* Month navigator — smooth drag */}
              <div style={{background:S.card,borderRadius:S.rad,padding:"10px 8px 14px",boxShadow:S.shadow,overflow:"hidden",position:"relative"}}
                onTouchStart={e=>{const t=e.currentTarget;t._sx=e.touches[0].clientX;t._moving=true;const inner=t.querySelector("[data-month-inner]");if(inner)inner.style.transition="none";}}
                onTouchMove={e=>{const t=e.currentTarget;if(!t._moving)return;const dx=e.touches[0].clientX-t._sx;const inner=t.querySelector("[data-month-inner]");if(inner){inner.style.transform=`translateX(${dx}px)`;inner.style.opacity=`${Math.max(0.2,1-Math.abs(dx)/250)}`;}}}
                onTouchEnd={e=>{const t=e.currentTarget;t._moving=false;const dx=e.changedTouches[0].clientX-t._sx;const inner=t.querySelector("[data-month-inner]");if(!inner)return;const threshold=60;if(Math.abs(dx)>threshold){const dir=dx>0?-1:1;const canGo=dir===1?(histMonth<curKey):true;if(canGo){inner.style.transition="transform 0.2s ease-out, opacity 0.2s ease-out";inner.style.transform=`translateX(${dx>0?200:-200}px)`;inner.style.opacity="0";setTimeout(()=>{shiftMonth(dir);inner.style.transition="none";inner.style.transform=`translateX(${dx>0?-200:200}px)`;inner.style.opacity="0";requestAnimationFrame(()=>{inner.style.transition="transform 0.25s ease-out, opacity 0.25s ease-out";inner.style.transform="translateX(0)";inner.style.opacity="1";});},220);}else{inner.style.transition="transform 0.3s ease, opacity 0.3s ease";inner.style.transform="translateX(0)";inner.style.opacity="1";}}else{inner.style.transition="transform 0.3s ease, opacity 0.3s ease";inner.style.transform="translateX(0)";inner.style.opacity="1";}}}
              >
                <div data-month-inner="" style={{display:"flex",alignItems:"center",gap:4}}>
                  <button onClick={()=>shiftMonth(-1)} style={{padding:8,background:"none",border:"none",cursor:"pointer",flexShrink:0}}><ChevronLeft size={20} color={S.sec}/></button>
                  <div style={{flex:1,textAlign:"center",userSelect:"none"}}>
                    <p style={{fontSize:18,fontWeight:700,color:S.dark,letterSpacing:-0.3}}>{y}年{m}月</p>
                    <p style={{fontSize:11,color:S.label}}>
                      曆月計算 · {monthLogs.length} 筆
                    </p>
                    <p style={{fontSize:11,color:S.label,marginTop:2}}>⚠️ 部分銀行以月結單日（非曆月）計算上限</p>
                  </div>
                  <button onClick={()=>shiftMonth(1)} disabled={histMonth>=curKey} style={{padding:8,background:"none",border:"none",cursor:histMonth>=curKey?"default":"pointer",opacity:histMonth>=curKey?0.3:1,flexShrink:0}}><ChevronRight size={20} color={S.sec}/></button>
                </div>
                <div style={{width:36,height:4,borderRadius:2,background:darkMode?"#3A3A3C":"#E5E5EA",margin:"8px auto 0"}}/>
              </div>

              {/* Month summary — gamified card */}
              {(()=>{
                const cLvl=monthRebate>=1000?"🍣":monthRebate>=500?"🥩":monthRebate>=300?"🔥":monthRebate>=100?"💪":"🌱";
                const mLvl=monthMiles>=20000?"✈️":monthMiles>=10000?"🛫":monthMiles>=5000?"🎫":monthMiles>=2000?"🎯":"🌱";
                const cMsg=monthRebate>=1000?"賺咗一餐 Omakase 🍣":monthRebate>=500?"賺咗一餐靚晚餐 🥩":monthRebate>=300?"夠食幾餐靚 lunch 🥘":monthRebate>=100?"又多杯 Starbucks ☕":"";
                const mMsg=monthMiles>=20000?"夠換東京來回 🗼":monthMiles>=10000?"好快可以飛啦 ✈️":monthMiles>=5000?"儲緊機票錢 🌏":monthMiles>=2000?"開始儲里出發 🧳":"";
                const cPct=Math.min(100,monthRebate/1000*100);
                const mPct=Math.min(100,monthMiles/20000*100);
                return(
                <div style={{background:darkMode?"rgba(52,199,89,0.08)":"linear-gradient(135deg, #fff 0%, #F0FFF4 100%)",borderRadius:S.rad,padding:16,boxShadow:S.shadow,border:"1px solid rgba(52,199,89,0.08)"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                    <div style={{flex:1,minWidth:0}}>
                      {/* Show both achievement lines */}
                      {cMsg&&<div style={{display:"flex",alignItems:"center",gap:4,marginBottom:2}}>
                        <span style={{fontSize:18}}>{cLvl}</span>
                        <p style={{fontSize:11,fontWeight:700,color:S.green}}>{cMsg}</p>
                      </div>}
                      {mMsg&&<div style={{display:"flex",alignItems:"center",gap:4,marginBottom:4}}>
                        <span style={{fontSize:18}}>{mLvl}</span>
                        <p style={{fontSize:11,fontWeight:700,color:S.blue}}>{mMsg}</p>
                      </div>}
                      {!cMsg&&!mMsg&&<p style={{fontSize:11,color:S.label,marginBottom:4}}>開始記帳，解鎖成就！</p>}
                      {monthRebate>0&&<p style={{fontSize:32,fontWeight:800,color:S.green,letterSpacing:-0.5}}>+${monthRebate.toFixed(1)}</p>}
                      {monthMiles>0&&<p style={{fontSize:22,fontWeight:700,color:S.blue,marginTop:monthRebate>0?4:0}}>+{monthMiles.toLocaleString()} 里</p>}
                      {monthTotal===0&&<p style={{fontSize:22,color:S.label,marginTop:2}}>—</p>}
                    </div>
                    <div style={{textAlign:"right",flexShrink:0}}>
                      <p style={{fontSize:11,fontWeight:600,color:S.label,textTransform:"uppercase",letterSpacing:1}}>總簽賬</p>
                      <p style={{fontSize:20,fontWeight:700,color:S.dark,letterSpacing:-0.3,marginTop:2}}>${monthTotal.toLocaleString()}</p>
                    </div>
                  </div>
                  {/* Cashback progress */}
                  {monthRebate>0&&<div style={{marginTop:10}}>
                    <p style={{fontSize:11,color:S.label,marginBottom:3}}>💰 現金回贈</p>
                    <div style={{height:6,borderRadius:3,background:"rgba(52,199,89,0.1)",overflow:"hidden"}}>
                      <div style={{height:6,borderRadius:3,background:"linear-gradient(90deg, #34C759, #28A745)",width:`${cPct}%`,transition:"width 0.5s ease"}}/>
                    </div>
                    <div style={{display:"flex",justifyContent:"space-between",marginTop:3}}>
                      {[{a:100,l:"☕$100"},{a:300,l:"🥘$300"},{a:500,l:"🥩$500"},{a:1000,l:"🍣$1k"}].map(m=>(
                        <span key={m.a} style={{fontSize:11,color:monthRebate>=m.a?S.green:S.label,fontWeight:monthRebate>=m.a?700:400}}>{m.l}</span>
                      ))}
                    </div>
                  </div>}
                  {/* Miles progress */}
                  {monthMiles>0&&<div style={{marginTop:8}}>
                    <p style={{fontSize:11,color:S.label,marginBottom:3}}>✈️ 飛行里數</p>
                    <div style={{height:6,borderRadius:3,background:"rgba(0,122,255,0.08)",overflow:"hidden"}}>
                      <div style={{height:6,borderRadius:3,background:"linear-gradient(90deg, #007AFF, #0056D6)",width:`${mPct}%`,transition:"width 0.5s ease"}}/>
                    </div>
                    <div style={{display:"flex",justifyContent:"space-between",marginTop:3}}>
                      {[{a:2000,l:"🧳2k"},{a:5000,l:"🌏5k"},{a:10000,l:"🛫10k"},{a:20000,l:"✈️20k"}].map(m=>(
                        <span key={m.a} style={{fontSize:11,color:monthMiles>=m.a?S.blue:S.label,fontWeight:monthMiles>=m.a?700:400}}>{m.l}</span>
                      ))}
                    </div>
                  </div>}
                </div>);
              })()}

              {/* Manual entry button + form */}
              <div style={{background:S.card,borderRadius:S.rad,overflow:"hidden",boxShadow:S.shadow}}>
                <button onClick={()=>setManualOpen(p=>!p)} style={{width:"100%",padding:"12px 16px",background:"none",border:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <span style={{fontSize:18}}>💵</span>
                    <span style={{fontSize:14,fontWeight:600,color:S.dark}}>手動記賬</span>
                    <span style={{fontSize:11,color:S.label}}>現金 / 八達通 / 其他</span>
                  </div>
                  <span style={{fontSize:12,color:S.label}}>{manualOpen?"▲":"＋"}</span>
                </button>
                {manualOpen&&(
                  <div style={{padding:"0 16px 16px",borderTop:`1px solid ${S.sep}`}}>
                    <div style={{display:"flex",gap:6,marginTop:12,marginBottom:12}}>
                      {[{k:"cash",l:"💵 現金"},{k:"octopus",l:"🚇 八達通"},{k:"other",l:"📝 其他"}].map(t=>(
                        <button key={t.k} onClick={()=>setManualType(t.k)} style={{flex:1,padding:"8px 4px",borderRadius:10,fontSize:11,fontWeight:600,border:manualType===t.k?`2px solid ${S.blue}`:`2px solid ${S.sep}`,background:manualType===t.k?"rgba(0,122,255,0.06)":S.card,color:manualType===t.k?S.blue:S.label,cursor:"pointer"}}>{t.l}</button>
                      ))}
                    </div>
                    {/* Scenario picker */}
                    <div style={{display:"flex",gap:4,marginBottom:10,overflowX:"auto",paddingBottom:2}}>
                      {ALL_SCENARIOS.filter(s=>s.id!=="manual").map(s=>(
                        <button key={s.id} onClick={()=>setManualSc(s.id)} style={{padding:"5px 8px",borderRadius:8,fontSize:10,fontWeight:600,background:manualSc===s.id?"rgba(0,122,255,0.08)":S.card,color:manualSc===s.id?S.blue:S.label,border:manualSc===s.id?`1px solid rgba(0,122,255,0.2)`:`1px solid ${S.sep}`,cursor:"pointer",whiteSpace:"nowrap",flexShrink:0}}>{s.emoji}{s.label}</button>
                      ))}
                    </div>
                    <div style={{display:"flex",gap:8,marginBottom:10}}>
                      <div style={{flex:1,display:"flex",alignItems:"center",gap:4,background:S.bg,borderRadius:10,padding:"8px 10px",border:`1px solid ${S.sep}`}}>
                        <span style={{fontSize:14,color:S.label,fontWeight:600}}>$</span>
                        <input type="number" value={manualAmt} onChange={e=>setManualAmt(e.target.value)} placeholder="金額" style={{flex:1,background:"transparent",border:"none",outline:"none",fontSize:14,fontWeight:700,color:S.dark,minWidth:0}}/>
                      </div>
                      <div style={{position:"relative"}}>
                        <div onClick={()=>{const el=document.getElementById("manual-date-input");if(el)el.showPicker?.();}} style={{padding:"8px 12px",borderRadius:10,background:S.bg,border:`1px solid ${S.sep}`,cursor:"pointer",display:"flex",alignItems:"center",gap:4,height:"100%",boxSizing:"border-box"}}>
                          <CalendarDays size={12} color={S.label}/>
                          <span style={{fontSize:12,fontWeight:600,color:S.dark}}>{(()=>{const today=new Date().toISOString().slice(0,10);if(manualDate===today)return"今日";const[,lm,ld]=manualDate.split("-");return`${parseInt(lm)}/${parseInt(ld)}`;})()}</span>
                        </div>
                        <input id="manual-date-input" type="date" value={manualDate} onChange={e=>setManualDate(e.target.value)} max={new Date().toISOString().slice(0,10)} style={{position:"absolute",top:0,left:0,width:"100%",height:"100%",opacity:0,cursor:"pointer"}}/>
                      </div>
                    </div>
                    <input type="text" value={manualMemo} onChange={e=>setManualMemo(e.target.value)} placeholder="Mark低用咗咩錢" maxLength={40} style={{width:"100%",padding:"8px 10px",borderRadius:10,border:`1px solid ${S.sep}`,background:S.bg,fontSize:12,outline:"none",color:S.dark,boxSizing:"border-box",marginBottom:10}}/>
                    <button onClick={addManualLog} disabled={!manualAmt||parseFloat(manualAmt)<=0} style={{width:"100%",padding:12,borderRadius:14,background:(!manualAmt||parseFloat(manualAmt)<=0)?S.bg:S.blue,color:(!manualAmt||parseFloat(manualAmt)<=0)?S.label:"#fff",border:"none",fontSize:14,fontWeight:700,cursor:(!manualAmt||parseFloat(manualAmt)<=0)?"default":"pointer"}}>記錄</button>
                  </div>
                )}
              </div>

              {/* Recurring entries management */}
              <div style={{background:S.card,borderRadius:S.rad,overflow:"hidden",boxShadow:S.shadow}}>
                <button onClick={()=>setRecForm(recForm?null:{memo:"",amount:"",day:"1",cardId:"",cardName:"",sc:"onlineHKD",isMiles:false,currency:"HKD"})} style={{width:"100%",padding:"12px 16px",background:"none",border:"none",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center",borderBottom:(recurring.length>0||recForm)?`1px solid ${S.sep}`:"none"}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <span style={{fontSize:16}}>🔄</span>
                    <span style={{fontSize:14,fontWeight:600,color:S.dark}}>定期扣款</span>
                    {recurring.length>0&&<span style={{fontSize:11,color:S.label}}>{recurring.length} 項</span>}
                  </div>
                  <span style={{fontSize:12,color:recForm?S.red:S.label}}>{recForm?"取消":"＋"}</span>
                </button>
                {/* Inline add form */}
                {recForm&&(()=>{
                  const isFx=FX_SCENARIOS.includes(recForm.sc);
                  return(
                  <div style={{padding:"12px 16px",borderBottom:`1px solid ${S.sep}`,background:darkMode?"rgba(0,122,255,0.06)":"rgba(0,122,255,0.02)"}}>
                    <div style={{display:"flex",gap:8,marginBottom:8}}>
                      <input type="text" value={recForm.memo} onChange={e=>setRecForm(p=>({...p,memo:e.target.value}))} placeholder="洗費 (e.g. YouTube)" style={{flex:1,padding:"8px 10px",borderRadius:10,border:`1px solid ${S.sep}`,fontSize:12,outline:"none",color:S.dark,background:S.card,minWidth:0}}/>
                      <div style={{display:"flex",alignItems:"center",gap:2,background:S.card,borderRadius:10,padding:"0 10px",border:`1px solid ${S.sep}`,flexShrink:0,minWidth:isFx?130:90}}>
                        {isFx&&<select value={recForm.currency||"HKD"} onChange={e=>setRecForm(p=>({...p,currency:e.target.value}))} style={{border:"none",outline:"none",fontSize:11,fontWeight:700,color:S.blue,background:"transparent",appearance:"auto",padding:0}}>
                          {["HKD","USD","JPY","EUR","GBP","CNY","TWD","THB","KRW","SGD","AUD","CAD"].map(c=><option key={c} value={c}>{c}</option>)}
                        </select>}
                        {!isFx&&<span style={{fontSize:12,color:S.label}}>$</span>}
                        <input type="number" value={recForm.amount} onChange={e=>setRecForm(p=>({...p,amount:e.target.value}))} placeholder="金額" style={{width:"100%",border:"none",outline:"none",fontSize:12,fontWeight:700,color:S.dark,background:"transparent"}}/>
                      </div>
                    </div>
                    <div style={{display:"flex",gap:8,marginBottom:8}}>
                      <div style={{display:"flex",alignItems:"center",gap:4,background:S.card,borderRadius:10,padding:"6px 10px",border:`1px solid ${S.sep}`,flex:1}}>
                        <span style={{fontSize:11,color:S.label}}>每月</span>
                        <input type="number" min={1} max={28} value={recForm.day} onChange={e=>setRecForm(p=>({...p,day:e.target.value}))} style={{width:30,border:"none",outline:"none",fontSize:12,fontWeight:700,color:S.dark,textAlign:"center",background:"transparent"}}/>
                        <span style={{fontSize:11,color:S.label}}>號</span>
                      </div>
                      <select value={recForm.cardId||""} onChange={e=>{const c=CARDS.find(x=>x.id===e.target.value);setRecForm(p=>({...p,cardId:e.target.value,cardName:c?c.name:"未指定"}));}} style={{flex:2,padding:"6px 10px",borderRadius:10,border:`1px solid ${S.sep}`,fontSize:12,outline:"none",color:recForm.cardId?S.dark:S.label,background:S.card,appearance:"auto"}}>
                        <option value="" disabled>揀你嘅卡</option>
                        {CARDS.filter(c=>own.includes(c.id)).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                    <div style={{display:"flex",gap:6,marginBottom:8}}>
                      <button onClick={()=>setRecForm(p=>({...p,isMiles:false}))} style={{flex:1,padding:"6px 0",borderRadius:8,fontSize:11,fontWeight:600,border:!recForm.isMiles?`2px solid ${S.green}`:`2px solid ${S.sep}`,background:!recForm.isMiles?"rgba(52,199,89,0.06)":S.card,color:!recForm.isMiles?S.green:S.label,cursor:"pointer"}}>💰 現金回贈</button>
                      <button onClick={()=>setRecForm(p=>({...p,isMiles:true}))} style={{flex:1,padding:"6px 0",borderRadius:8,fontSize:11,fontWeight:600,border:recForm.isMiles?`2px solid ${S.blue}`:`2px solid ${S.sep}`,background:recForm.isMiles?"rgba(0,122,255,0.06)":S.card,color:recForm.isMiles?S.blue:S.label,cursor:"pointer"}}>✈️ 飛行里數</button>
                    </div>
                    <div style={{display:"flex",gap:4,marginBottom:10,overflowX:"auto"}}>
                      {SCENARIOS.map(s=>(
                        <button key={s.id} onClick={()=>setRecForm(p=>({...p,sc:s.id,currency:FX_SCENARIOS.includes(s.id)?(p.currency==="HKD"?"USD":p.currency):"HKD"}))} style={{padding:"4px 8px",borderRadius:8,fontSize:11,fontWeight:600,background:recForm.sc===s.id?"rgba(0,122,255,0.08)":S.card,color:recForm.sc===s.id?S.blue:S.label,border:recForm.sc===s.id?`1px solid rgba(0,122,255,0.2)`:`1px solid ${S.sep}`,cursor:"pointer",whiteSpace:"nowrap",flexShrink:0}}>{s.emoji}{s.label}</button>
                      ))}
                    </div>
                    <button onClick={()=>{const a=parseFloat(recForm.amount);if(!recForm.memo||!a)return;setRecurring(p=>[...p,{id:Date.now(),cardId:recForm.cardId||"_recurring",cardName:recForm.cardName||"未指定",sc:recForm.sc,amount:a,memo:recForm.memo,dayOfMonth:Math.min(28,Math.max(1,parseInt(recForm.day)||1)),isMiles:recForm.isMiles,rate:0,currency:isFx?(recForm.currency||"USD"):"HKD"}]);setRecForm(null);showToast("✅ 已新增定期扣款");}} disabled={!recForm.memo||!recForm.amount} style={{width:"100%",padding:10,borderRadius:12,background:(!recForm.memo||!recForm.amount)?S.bg:S.blue,color:(!recForm.memo||!recForm.amount)?S.label:"#fff",border:"none",fontSize:13,fontWeight:700,cursor:(!recForm.memo||!recForm.amount)?"default":"pointer"}}>新增定期扣款</button>
                  </div>);
                })()}
                {recurring.map(r=>(
                  <div key={r.id} style={{padding:"10px 16px",display:"flex",alignItems:"center",borderBottom:`1px solid ${S.sep}`}}>
                    <div style={{flex:1,minWidth:0}}>
                      <p style={{fontSize:13,fontWeight:500,color:S.dark}}>{r.memo}</p>
                      <p style={{fontSize:11,color:S.label}}>{r.cardName} · 每月{r.dayOfMonth}號 · {r.currency&&r.currency!=="HKD"?`${r.currency} ${r.amount}`:`$${r.amount}`} · {r.isMiles?"✈️ 里數":"💰 回贈"}</p>
                    </div>
                    <button onClick={()=>setRecurring(p=>p.filter(x=>x.id!==r.id))} style={{padding:6,background:"none",border:"none",cursor:"pointer"}}><X size={14} color={S.label}/></button>
                  </div>
                ))}
              </div>

              {/* View toggle */}
              {monthLogs.length>0&&(
                <div style={{display:"flex",gap:8,alignItems:"center"}}>
                  <div style={{position:"relative",display:"flex",padding:3,borderRadius:10,background:S.segBg,flex:1}}>
                    <div style={{position:"absolute",top:3,bottom:3,borderRadius:8,background:S.segInd,boxShadow:darkMode?"0 1px 4px rgba(0,0,0,0.4)":"0 3px 8px rgba(0,0,0,0.12), 0 3px 1px rgba(0,0,0,0.04)",transition:"all 0.2s ease",width:"calc(25% - 2px)",left:trackerView==="card"?3:trackerView==="category"?"calc(25% + 1px)":trackerView==="daily"?"calc(50% + 1px)":"calc(75%)"}}/>
                    <button onClick={()=>setTrackerView("card")} style={{position:"relative",zIndex:2,flex:1,padding:"8px 0",borderRadius:8,fontSize:11,fontWeight:600,background:"none",border:"none",cursor:"pointer",color:trackerView==="card"?S.dark:S.label}}>💳 按卡</button>
                    <button onClick={()=>setTrackerView("category")} style={{position:"relative",zIndex:2,flex:1,padding:"8px 0",borderRadius:8,fontSize:11,fontWeight:600,background:"none",border:"none",cursor:"pointer",color:trackerView==="category"?S.dark:S.label}}>📊 場景</button>
                    <button onClick={()=>setTrackerView("daily")} style={{position:"relative",zIndex:2,flex:1,padding:"8px 0",borderRadius:8,fontSize:11,fontWeight:600,background:"none",border:"none",cursor:"pointer",color:trackerView==="daily"?S.dark:S.label}}>📅 日誌</button>
                    <button onClick={()=>setTrackerView("chart")} style={{position:"relative",zIndex:2,flex:1,padding:"8px 0",borderRadius:8,fontSize:11,fontWeight:600,background:"none",border:"none",cursor:"pointer",color:trackerView==="chart"?S.dark:S.label}}>🥧 圖表</button>
                  </div>
                  {(trackerView==="card"||trackerView==="category")&&<button onClick={()=>setTrackerSort(p=>p==="desc"?"asc":"desc")} style={{padding:"8px 10px",borderRadius:10,background:S.card,border:`1px solid ${S.sep}`,cursor:"pointer",display:"flex",alignItems:"center",gap:3,flexShrink:0,boxShadow:S.shadow}}>
                    <span style={{fontSize:12}}>{trackerSort==="desc"?"↓":"↑"}</span>
                    <span style={{fontSize:10,fontWeight:600,color:S.sec}}>{trackerSort==="desc"?"高→低":"低→高"}</span>
                  </button>}
                </div>
              )}

              {/* Content based on view */}
              {monthLogs.length===0?(
                <div style={{background:S.card,borderRadius:S.rad,padding:28,textAlign:"center",boxShadow:S.shadow}}>
                  <div style={{fontSize:40,marginBottom:12}}>📊</div>
                  <p style={{fontSize:17,fontWeight:700,color:S.dark}}>{isCurrentMonth?"開始追蹤消費！":"呢個月未有記錄"}</p>
                  {isCurrentMonth&&<>
                    <p style={{fontSize:13,color:S.label,marginTop:8,lineHeight:1.6}}>每次碌卡後記低，月尾就知道慳咗幾多</p>
                    <div style={{textAlign:"left",background:S.bg,borderRadius:16,padding:16,marginTop:16}}>
                      <p style={{fontSize:12,fontWeight:700,color:S.dark,marginBottom:10}}>點樣開始？</p>
                      {[{n:"1",t:"去「計算器」揀場景同金額"},{n:"2",t:"睇推薦卡，撳綠色按鈕記賬"},{n:"3",t:"或者喺下面「手動記賬」記現金消費"}].map(s=>(
                        <div key={s.n} style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
                          <div style={{width:22,height:22,borderRadius:11,background:S.blue,color:"#fff",fontSize:11,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{s.n}</div>
                          <p style={{fontSize:12,color:S.sec}}>{s.t}</p>
                        </div>
                      ))}
                    </div>
                    <button onClick={()=>setTab("calc")} style={{width:"100%",padding:13,borderRadius:14,background:S.blue,color:"#fff",fontSize:14,fontWeight:700,border:"none",cursor:"pointer",marginTop:14}}>去計算器開始 →</button>
                  </>}
                </div>
              ):trackerView==="card"?(
                <div style={{display:"flex",flexDirection:"column",gap:10}}>
                  {Object.entries(mCards).sort((a,b)=>trackerSort==="desc"?b[1].total-a[1].total:a[1].total-b[1].total).map(([cid,data])=>{
                    const caps=isCurrentMonth?(CAP_AMT[cid]||{}):{};
                    return(
                      <div key={cid} style={{background:S.card,borderRadius:S.rad,overflow:"hidden",boxShadow:S.shadow}}>
                        <div style={{padding:"14px 16px",borderBottom:`1px solid ${S.sep}`}}>
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                            <div>
                              <p style={{fontSize:15,fontWeight:600,color:S.dark}}>{data.cardName}</p>
                              {data.rebateTotal>0&&<p style={{fontSize:16,fontWeight:700,color:S.green,marginTop:2}}>+${data.rebateTotal.toFixed(1)}</p>}
                              {data.milesTotal>0&&<p style={{fontSize:14,fontWeight:700,color:"#5AC8FA",marginTop:data.rebateTotal>0?2:2}}>+{data.milesTotal.toLocaleString()}里</p>}
                            </div>
                            <p style={{fontSize:17,fontWeight:700,color:S.dark}}>${data.total.toLocaleString()}</p>
                          </div>
                        </div>
                        {Object.entries(data.byScenario).sort((a,b)=>trackerSort==="desc"?b[1].spent-a[1].spent:a[1].spent-b[1].spent).map(([scKey,scData])=>{
                          const cap=caps[scKey];const spent=scData.spent;
                          const si=ALL_SCENARIOS.find(s=>s.id===scKey);
                          const pct=cap?Math.min(100,Math.round(spent/cap*100)):0;
                          return(
                            <div key={scKey} style={{padding:"10px 16px",borderBottom:`1px solid ${S.sep}`}}>
                              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:cap?6:0}}>
                                <div>
                                  <span style={{fontSize:13,color:S.sec}}>{si?`${si.emoji} ${si.label}`:scKey}</span>
                                  {scData.rebate>0&&<span style={{fontSize:12,fontWeight:600,color:S.green,marginLeft:6}}>+${scData.rebate.toFixed(1)}</span>}
                                  {scData.miles>0&&<span style={{fontSize:11,fontWeight:600,color:"#5AC8FA",marginLeft:6}}>+{scData.miles.toLocaleString()}里</span>}
                                </div>
                                <span style={{fontSize:13,fontWeight:600,color:cap&&spent>=cap?S.red:S.dark}}>${spent.toLocaleString()}{cap?<span style={{fontSize:11,fontWeight:400,color:S.label}}> / ${cap.toLocaleString()}</span>:""}</span>
                              </div>
                              {cap&&<div style={{height:4,borderRadius:2,background:darkMode?"#3A3A3C":"#E5E5EA",overflow:"hidden"}}><div style={{height:4,borderRadius:2,background:pct>=100?S.red:pct>=80?"#FF9500":S.green,width:`${pct}%`,transition:"width 0.3s ease"}}/></div>}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              ):trackerView==="category"?(
                <div style={{background:S.card,borderRadius:S.rad,overflow:"hidden",boxShadow:S.shadow}}>
                  {ALL_SCENARIOS.filter(s=>mCats[s.id]).sort((a,b)=>trackerSort==="desc"?mCats[b.id].spent-mCats[a.id].spent:mCats[a.id].spent-mCats[b.id].spent).map((s,i,arr)=>{
                    const d=mCats[s.id];
                    return(
                      <div key={s.id} style={{padding:"14px 16px",borderBottom:i<arr.length-1?`1px solid ${S.sep}`:"none"}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                          <div>
                            <p style={{fontSize:14,fontWeight:500,color:S.dark}}>{s.emoji} {s.label}</p>
                            {d.rebate>0&&<p style={{fontSize:14,fontWeight:700,color:S.green,marginTop:2}}>+${d.rebate.toFixed(1)}</p>}
                            {d.miles>0&&<p style={{fontSize:13,fontWeight:700,color:"#5AC8FA",marginTop:2}}>+{d.miles.toLocaleString()}里</p>}
                          </div>
                          <div style={{textAlign:"right"}}>
                            <p style={{fontSize:15,fontWeight:700,color:S.dark}}>${d.spent.toLocaleString()}</p>
                            <p style={{fontSize:11,color:S.label}}>{d.count} 筆</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ):trackerView==="daily"?(
                <div style={{display:"flex",flexDirection:"column",gap:10}}>
                  {Object.entries(byDay).map(([dayKey,dayLogs])=>{
                    const dayTotal=dayLogs.reduce((s,l)=>s+l.amount,0);
                    return(
                      <div key={dayKey} style={{background:S.card,borderRadius:S.rad,overflow:"hidden",boxShadow:S.shadow}}>
                        <div style={{padding:"10px 16px",borderBottom:`1px solid ${S.sep}`,background:S.subtleBg,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                          <p style={{fontSize:14,fontWeight:600,color:S.dark}}>{dayKey}</p>
                          <p style={{fontSize:13,fontWeight:600,color:S.blue}}>${dayTotal.toLocaleString()}</p>
                        </div>
                        {dayLogs.map((l,i)=>{
                          const si=ALL_SCENARIOS.find(s=>s.id===l.scenario);
                          const d=new Date(l.date);
                          return(
                            <div key={l.id} style={{padding:"10px 16px",display:"flex",alignItems:"center",borderBottom:i<dayLogs.length-1?`1px solid ${S.sep}`:"none"}}>
                              <div style={{flex:1,minWidth:0}}>
                                <div style={{display:"flex",alignItems:"center",gap:6}}>
                                  <p style={{fontSize:14,fontWeight:500,color:S.dark,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{l.cardName}</p>
                                  {!l.isManual&&(l.isMiles?<span style={{fontSize:10,color:"#5AC8FA",fontWeight:600}}>+{(l.miles||0).toLocaleString()}里</span>:<span style={{fontSize:10,color:S.green,fontWeight:600}}>+${(l.rebate||0).toFixed(1)}</span>)}
                                </div>
                                <p style={{fontSize:11,color:S.label}}>{l.isManual?"":si?`${si.emoji} ${si.label}`:l.scenario}{l.memo&&<span style={{color:S.blue,fontStyle:"italic"}}>{l.isManual?"":` · `}{l.memo}</span>}</p>
                              </div>
                              <p style={{fontSize:14,fontWeight:600,color:S.dark,marginRight:8,flexShrink:0}}>${l.amount.toLocaleString()}</p>
                              <button onClick={()=>removeLog(l.id)} style={{padding:6,background:"none",border:"none",cursor:"pointer",flexShrink:0}}><X size={14} color={S.label}/></button>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              ):(
                <div style={{background:S.card,borderRadius:S.rad,padding:20,boxShadow:S.shadow}}>
                  {(()=>{
                    const cats=ALL_SCENARIOS.filter(s=>mCats[s.id]).map(s=>({...s,spent:mCats[s.id].spent}));
                    const total=cats.reduce((s,c)=>s+c.spent,0);
                    if(total===0)return<p style={{textAlign:"center",color:S.label,fontSize:13}}>未有消費數據</p>;
                    const colors=["#007AFF","#34C759","#FF9500","#FF3B30","#AF52DE","#5AC8FA","#FF2D55","#FFCC00","#8E8E93","#00C7BE"];
                    let cumPct=0;
                    const mkSlice=(items,tot)=>{let c=0;return items.map((it,i)=>{const pct=it.spent/tot;const sa=c*360;c+=pct;const ea=c*360;const large=pct>0.5?1:0;const r=80,cx=90,cy=90;const x1=cx+r*Math.cos((sa-90)*Math.PI/180),y1=cy+r*Math.sin((sa-90)*Math.PI/180);const x2=cx+r*Math.cos((ea-90)*Math.PI/180),y2=cy+r*Math.sin((ea-90)*Math.PI/180);return{...it,color:colors[i%colors.length],pct,d:pct>=1?`M ${cx},${cy-r} A ${r},${r} 0 1,1 ${cx-0.01},${cy-r} Z`:`M ${cx},${cy} L ${x1},${y1} A ${r},${r} 0 ${large},1 ${x2},${y2} Z`};});};
                    const catSlices=mkSlice(cats,total);
                    const cards=Object.entries(mCards).map(([cid,d])=>({name:d.cardName,spent:d.total})).sort((a,b)=>b.spent-a.spent);
                    const cardSlices=mkSlice(cards,total);
                    const PieChart=({slices,centerTop,centerBot})=>(
                      <div style={{display:"flex",justifyContent:"center",marginBottom:14}}>
                        <svg width={180} height={180} viewBox="0 0 180 180">
                          {slices.map((s,i)=><path key={i} d={s.d} fill={s.color} stroke={S.card} strokeWidth={2}/>)}
                          <circle cx={90} cy={90} r={40} fill={S.card}/>
                          <text x={90} y={85} textAnchor="middle" style={{fontSize:14,fontWeight:800,fill:S.dark}}>{centerTop}</text>
                          <text x={90} y={102} textAnchor="middle" style={{fontSize:10,fill:S.label}}>{centerBot}</text>
                        </svg>
                      </div>
                    );
                    const Legend=({slices})=>(
                      <div style={{display:"flex",flexDirection:"column",gap:5}}>
                        {slices.map((s,i)=>(
                          <div key={i} style={{display:"flex",alignItems:"center",gap:8}}>
                            <div style={{width:10,height:10,borderRadius:3,background:s.color,flexShrink:0}}/>
                            <span style={{fontSize:12,color:S.dark,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.emoji?`${s.emoji} ${s.label}`:s.name}</span>
                            <span style={{fontSize:12,fontWeight:600,color:S.dark}}>${s.spent.toLocaleString()}</span>
                            <span style={{fontSize:11,color:S.label,width:36,textAlign:"right"}}>{(s.pct*100).toFixed(0)}%</span>
                          </div>
                        ))}
                      </div>
                    );
                    return(<div>
                      <p style={{fontSize:13,fontWeight:700,color:S.dark,marginBottom:12}}>按場景分佈</p>
                      <PieChart slices={catSlices} centerTop={`$${total.toLocaleString()}`} centerBot="總簽賬"/>
                      <Legend slices={catSlices}/>
                      {cards.length>1&&<div style={{marginTop:20,paddingTop:16,borderTop:`1px solid ${S.sep}`}}>
                        <p style={{fontSize:13,fontWeight:700,color:S.dark,marginBottom:12}}>按卡分佈</p>
                        <PieChart slices={cardSlices} centerTop={`${cards.length}`} centerBot="張卡"/>
                        <Legend slices={cardSlices}/>
                      </div>}
                    </div>);
                  })()}
                </div>
              )}

              <p style={{textAlign:"center",fontSize:10,color:S.label,padding:8,lineHeight:1.5}}>🔒 所有資料只存你手機 · 零伺服器 · 零追蹤<br/>清除瀏覽器數據會消失 · 建議定期匯出備份</p>
              <div style={{display:"flex",gap:8}}>
                <button onClick={()=>{try{const d=JSON.stringify({_v:5,own,logs,vs,guru,sMax,seen,quickAmts,mode,recurring,moxTier,dbsLfFx,wewaCategory,bocMs,bocMf,aeExplorerReg,aeChargeReg,everyMileReg,mmpowerReg,travelPlusReg,dbsEminentReg,beaWorldReg,ccbEyeReg},null,2);const b=new Blob([d],{type:"application/json"});const u=URL.createObjectURL(b);const a=document.createElement("a");a.href=u;a.download=`swipewhich_backup_${new Date().toISOString().slice(0,10)}.json`;a.click();showToast("✅ 備份已下載");}catch(e){showToast("❌ 匯出失敗");}}} style={{flex:1,padding:12,borderRadius:S.rad,background:S.card,border:"none",fontSize:12,fontWeight:600,color:S.blue,cursor:"pointer",boxShadow:S.shadow,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>📤 匯出備份</button>
              </div>
              {/* Triple-confirm reset */}
              {resetStep===0&&(
                <button onClick={()=>setResetStep(1)} style={{width:"100%",padding:12,borderRadius:S.rad,background:S.card,border:"none",fontSize:12,fontWeight:600,color:S.red,cursor:"pointer",boxShadow:S.shadow}}>🗑️ 清除所有記帳記錄</button>
              )}
              {resetStep>=1&&(
                <div style={{background:S.card,borderRadius:S.rad,padding:14,boxShadow:S.shadow,border:"1px solid rgba(255,59,48,0.15)"}}>
                  {resetStep===1&&(<div>
                    <p style={{fontSize:13,fontWeight:700,color:S.red,marginBottom:4}}>⚠️ 第 1 步：你確定要清除所有記帳記錄？</p>
                    <p style={{fontSize:11,color:S.sec,marginBottom:10}}>此操作將刪除你所有消費記錄、定期扣款設定。你嘅信用卡選擇同設定唔會受影響。</p>
                    <div style={{display:"flex",gap:8}}>
                      <button onClick={()=>setResetStep(0)} style={{flex:1,padding:10,borderRadius:12,background:S.bg,border:"none",fontSize:12,fontWeight:600,color:S.sec,cursor:"pointer"}}>取消</button>
                      <button onClick={()=>setResetStep(2)} style={{flex:1,padding:10,borderRadius:12,background:"rgba(255,59,48,0.08)",border:"1px solid rgba(255,59,48,0.2)",fontSize:12,fontWeight:600,color:S.red,cursor:"pointer"}}>繼續 →</button>
                    </div>
                  </div>)}
                  {resetStep===2&&(<div>
                    <p style={{fontSize:13,fontWeight:700,color:S.red,marginBottom:4}}>🚨 第 2 步：此操作不可恢復！</p>
                    <p style={{fontSize:11,color:S.sec,marginBottom:4}}>建議你先匯出備份，清除後無法還原。</p>
                    <p style={{fontSize:11,color:S.red,fontWeight:600,marginBottom:10}}>將會刪除：{logs.length} 筆消費記錄 + {recurring.length} 個定期扣款</p>
                    <div style={{display:"flex",gap:8}}>
                      <button onClick={()=>setResetStep(0)} style={{flex:1,padding:10,borderRadius:12,background:S.bg,border:"none",fontSize:12,fontWeight:600,color:S.sec,cursor:"pointer"}}>取消</button>
                      <button onClick={()=>setResetStep(3)} style={{flex:1,padding:10,borderRadius:12,background:"rgba(255,59,48,0.15)",border:"1px solid rgba(255,59,48,0.3)",fontSize:12,fontWeight:600,color:S.red,cursor:"pointer"}}>我明白，繼續 →</button>
                    </div>
                  </div>)}
                  {resetStep===3&&(<div>
                    <p style={{fontSize:13,fontWeight:700,color:"#fff",background:S.red,padding:"8px 12px",borderRadius:10,marginBottom:8,textAlign:"center"}}>❌ 最後確認：真係要清除晒？</p>
                    <p style={{fontSize:11,color:S.sec,marginBottom:10}}>撳「確認清除」後，所有記帳記錄同定期扣款將永久刪除，無法恢復。</p>
                    <div style={{display:"flex",gap:8}}>
                      <button onClick={()=>setResetStep(0)} style={{flex:1,padding:10,borderRadius:12,background:S.bg,border:"none",fontSize:12,fontWeight:600,color:S.sec,cursor:"pointer"}}>算啦，唔刪</button>
                      <button onClick={()=>{setLogs([]);setRecurring([]);setResetStep(0);showToast("🗑️ 所有記帳記錄已清除");}} style={{flex:1,padding:10,borderRadius:12,background:S.red,border:"none",fontSize:12,fontWeight:700,color:"#fff",cursor:"pointer"}}>確認清除</button>
                    </div>
                  </div>)}
                </div>
              )}
            </div>
          );
        })()}
      </main>

      {/* Toast notification — above tracker tab with bouncing arrow */}
      {toast&&<div style={{position:"fixed",bottom:68,left:"62.5%",transform:"translateX(-50%)",zIndex:9999,display:"flex",flexDirection:"column",alignItems:"center",gap:0}}>
        <div style={{background:darkMode?"#F5F5F7":"#1C1C1E",color:darkMode?"#000":"#fff",padding:"10px 18px",borderRadius:14,fontSize:13,fontWeight:600,boxShadow:"0 8px 24px rgba(0,0,0,0.3)",maxWidth:300,textAlign:"center",whiteSpace:"nowrap"}}>{toast}</div>
        <div style={{animation:"bounce 0.8s ease infinite",marginTop:2}}>
          <svg width="20" height="12" viewBox="0 0 20 12"><path d="M2 2L10 10L18 2" fill="none" stroke={darkMode?"#F5F5F7":"#1C1C1E"} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </div>
        <style>{`@keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(5px)}}`}</style>
      </div>}

      {/* Bottom Tabs */}
      <nav style={{position:"fixed",bottom:0,left:0,right:0,zIndex:9991,display:"flex",borderTop:`1px solid ${S.sep}`,background:S.tabBg,backdropFilter:"blur(20px) saturate(180%)",paddingBottom:"env(safe-area-inset-bottom,8px)"}}>
        {[{k:"calc",l:"計算器",Ic:Calculator},{k:"cards",l:"Card Holder",Ic:Wallet},{k:"tracker",l:"記帳",Ic:ClipboardList},{k:"guide",l:"攻略",Ic:BookOpen}].map(t=>(
          <button key={t.k} onClick={()=>setTab(t.k)} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2,paddingTop:8,paddingBottom:4,background:"none",border:"none",cursor:"pointer",position:"relative",...(isHL("guidetab")&&t.k==="guide"?{outline:"3px solid #007AFF",outlineOffset:-2,borderRadius:12}:{}),...(isHL("trackertab")&&t.k==="tracker"?{outline:"3px solid #007AFF",outlineOffset:-2,borderRadius:12}:{}),...(toast&&t.k==="tracker"?{zIndex:9992}:{})}}>
            <div style={{...(toast&&t.k==="tracker"?{animation:"tabPulse 1s ease infinite",borderRadius:12,padding:4,background:"rgba(0,122,255,0.08)"}:{})}}>
              <t.Ic size={22} color={tab===t.k||toast&&t.k==="tracker"?S.blue:S.label}/>
            </div>
            <span style={{fontSize:11,fontWeight:500,color:tab===t.k||toast&&t.k==="tracker"?S.blue:S.label,letterSpacing:0.06}}>{t.l}</span>
            {t.k==="cards"&&noCards&&tut===0&&<div style={{position:"absolute",top:4,right:"25%",width:10,height:10,borderRadius:5,background:S.red,animation:"pulse 2s infinite"}}/>}
            {t.k==="tracker"&&cycleLogs.length>0&&<div style={{position:"absolute",top:2,right:"22%",minWidth:16,height:16,borderRadius:8,background:S.blue,display:"flex",alignItems:"center",justifyContent:"center"}}><span style={{fontSize:11,fontWeight:700,color:"#fff"}}>{cycleLogs.length}</span></div>}
          </button>
        ))}
      </nav>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}@keyframes tabPulse{0%,100%{transform:scale(1);box-shadow:0 0 0 0 rgba(0,122,255,0.3)}50%{transform:scale(1.1);box-shadow:0 0 12px 4px rgba(0,122,255,0.2)}}`}</style>
    </div>
  );
}
