import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { Wallet, Plane, Check, HelpCircle, X, AlertTriangle, MessageSquare, ExternalLink, RotateCcw, Calculator, BookOpen, PlusCircle, ClipboardList, ChevronRight, ChevronLeft, CalendarDays } from "lucide-react";

/* 碌邊張 SwipeWhich v1.4 © 2026 */

function mk(id,n,iss,ty,desc,base,ov,cap,nc,mpr,cond,exp){
  const cb={local:base,dining:base,onlineHKD:base,mobilePay:base,octopus:0,supermarket:base,onlineFX:base,travelJKSTA:base,physicalFX:base,...ov};
  return{id,name:n,issuer:iss,type:ty,desc,cashback:cb,capInfo:cap,noCap:!!nc,milesPerDollar:mpr||null,cond:cond||null,exp:exp||null};
}
function getExpiry(card){
  if(!card.exp)return null;
  const now=new Date();const exp=new Date(card.exp+"T23:59:59");
  const diff=Math.ceil((exp-now)/(1000*60*60*24));
  if(diff<0)return{status:"expired",text:"⏰ 此優惠已過期，回贈率可能已更新",color:"#FF3B30"};
  if(diff<=30)return{status:"soon",text:`⏳ 此優惠將於 ${diff} 天後到期（${card.exp.slice(5).replace("-","/")}）`,color:"#FF9500"};
  return null;
}

// FX fee by card ID (as decimal). Visa/MC=1.95%, AE=2%, UnionPay~1%, exceptions=0%
const FX_FEES={
  // 0% exceptions
  sc_smart:0, hsbc_pulse:0, mox_miles:0,
  // UnionPay 1%
  ds_earnmore:0.01,
  // AE 2%
  ae_explorer:0.02, ae_plat_cc:0.02, ae_plat_charge:0.02, ae_blue:0.02,
  // All others default 1.95% (Visa/MC)
};
const getFxFee=(c,s)=>{
  // Special cases by scenario
  return FX_FEES[c.id]!==undefined?FX_FEES[c.id]:0.0195;
};
const FX_SCENARIOS=["onlineFX","travelJKSTA","physicalFX"];

// Monthly cap amounts by card+scenario (approximate, for over-cap detection)
const CAP_AMT={
  hsbc_red:{onlineHKD:10000},
  hsbc_vs:{local:100000,dining:100000,onlineHKD:100000,onlineFX:100000,physicalFX:100000,travelJKSTA:1000000}, // annual
  hs_mmpower:{onlineHKD:10870,onlineFX:8929},
  hs_travel:{travelJKSTA:7576,physicalFX:10870,dining:10870},
  boc_chill:{onlineHKD:3260,onlineFX:3260},
  boc_cheers:{dining:10000,onlineFX:25000,physicalFX:25000,travelJKSTA:25000},
  boc_sogo:{mobilePay:2000},
  cncbi_motion:{dining:3571,onlineHKD:3571},
  dbs_live:{onlineHKD:4000},
  dbs_eminent:{dining:8000},
  dbs_compass:{supermarket:2000},
  aeon_waku:{onlineHKD:3571,travelJKSTA:3571},
  ds_wewa:{travelJKSTA:5556,physicalFX:5556,onlineFX:5556},
  ds_earnmore:{local:80000,dining:80000,onlineHKD:80000,onlineFX:80000,physicalFX:80000,travelJKSTA:80000}, // semi-annual
  sim_card:{onlineHKD:2500},
  bea_ititan:{onlineHKD:7500,mobilePay:7500}, // $300/month cap ÷ 4%
  ae_plat_charge:{onlineFX:15000,physicalFX:15000,travelJKSTA:15000}, // quarterly
  fubon_plat:{travelJKSTA:16000,physicalFX:16000},
  ccb_eye:{dining:8888,onlineHKD:10000}, // dining cap = $800回贈 ÷ 9% ≈ $8,888
};

// ══ VERIFIED CARD DATABASE ══
// Rates expressed as decimal (0.04 = 4%). Miles as $/mile.
// Sources: flyformiles.hk, mrmiles.hk, hkcashrebate.com, bank official T&Cs (Mar 2026)
const CARDS=[
  // ── MILES ──
  mk("ae_explorer","AE Explorer","American Express","miles","基本$6/里，登記外幣優惠後$4.8/里，季度優惠$1.68/里(首$10,000)",0.006,{onlineFX:0.016,physicalFX:0.016,travelJKSTA:0.016},null,true,{local:6,dining:6,onlineHKD:6,onlineFX:4.8,travelJKSTA:4.8,physicalFX:4.8},{onlineFX:"⚠️ $4.8/里需登記3.75X外幣優惠，基本只有$6/里",physicalFX:"⚠️ $4.8/里需登記3.75X外幣優惠，基本只有$6/里",travelJKSTA:"⚠️ $4.8/里需登記3.75X外幣優惠，基本只有$6/里"}),
  mk("ae_plat_cc","AE 白金信用卡","American Express","miles","信用卡版(大頭)，本地/外幣$6/里",0.006,{},null,true,{local:6,dining:6,onlineHKD:6,onlineFX:6,travelJKSTA:6,physicalFX:6}),
  mk("ae_plat_charge","AE 白金卡（鋼卡/細頭）","American Express","miles","Charge Card，附Priority Pass，基本$9/里，外幣推廣期$2/里(季度$15,000上限)",0.004,{onlineFX:0.02,physicalFX:0.02,travelJKSTA:0.02},"外幣推廣期季度$15,000上限",false,{local:9,dining:9,onlineHKD:9,onlineFX:2,travelJKSTA:2,physicalFX:2},{onlineFX:"⚠️ $2/里需登記季度推廣，基本$9/里",physicalFX:"⚠️ $2/里需登記季度推廣，基本$9/里",travelJKSTA:"⚠️ $2/里需登記季度推廣，基本$9/里"},"2026-06-30"),
  mk("ae_blue","AE Blue Cash","American Express","cashback","1.2%所有消費，FCC 2%但CBF 0%",0.012,{},null,true),
  mk("sc_cathay","渣打國泰萬事達卡","Standard Chartered","miles","食飯/酒店/海外$4/里，其他$6/里",0.006,{dining:0.018,onlineFX:0.02,physicalFX:0.02,travelJKSTA:0.02},null,true,{local:6,dining:4,onlineHKD:6,onlineFX:4,travelJKSTA:4,physicalFX:4}),
  mk("ds_ba","大新英國航空白金卡","Dah Sing","miles","Avios里數直接入賬，本地$6/Avios，外幣$4/Avios",0.006,{onlineFX:0.018,physicalFX:0.018,travelJKSTA:0.018},null,true,{local:6,dining:6,onlineHKD:6,onlineFX:4,travelJKSTA:4,physicalFX:4}),
  mk("hsbc_everymile","HSBC EveryMile","HSBC","miles","本地$5/里(1%)，指定日常$2/里(2.5%)，海外配Travel Guru低至$0.71/里。不適用最紅自主。",0.01,{physicalFX:0.01,travelJKSTA:0.01,octopus:0.004,supermarket:0.004},"年度簽$80,000豁免年費",false,{local:5,dining:5,onlineHKD:5,supermarket:12.5,onlineFX:5,travelJKSTA:0.71,physicalFX:0.71},{travelJKSTA:"⚠️ 加碼需登記Travel Guru，基本只有$5/里",physicalFX:"⚠️ 加碼需登記Travel Guru，基本只有$5/里"}),
  mk("citi_pm","Citi PremierMiles","Citibank","miles","外幣$4/里(滿$2萬$3/里)，里數永不過期",0.005,{onlineFX:0.02,physicalFX:0.02,travelJKSTA:0.02},null,true,{local:8,dining:8,onlineHKD:8,onlineFX:4,travelJKSTA:4,physicalFX:4}),
  mk("citi_prestige","Citi Prestige","Citibank","miles","高端卡，外幣$4/里+酒店住四送一",0.006,{onlineFX:0.02,physicalFX:0.02,travelJKSTA:0.02},null,true,{local:6,dining:6,onlineHKD:6,onlineFX:4,travelJKSTA:4,physicalFX:4}),
  mk("citi_rewards_m","Citi Rewards","Citibank","both","指定購物/娛樂$3/里(≈1.85%)，流動支付5X≈1%，其他$15/里",0.003,{onlineHKD:0.0185,mobilePay:0.01},null,true,{local:15,dining:15,onlineHKD:3,onlineFX:15,travelJKSTA:15,physicalFX:15}),
  mk("dbs_black","DBS Black World MC","DBS","miles","外幣$4/里，免年費里數卡",0.005,{onlineFX:0.018,physicalFX:0.018,travelJKSTA:0.018},null,true,{local:6,dining:6,onlineHKD:6,onlineFX:4,travelJKSTA:4,physicalFX:4}),
  mk("mox_miles","MOX（Asia Miles）","Mox Bank","miles","所有消費$8/里，Asia Miles模式0%外幣手續費",0.005,{},null,true,{local:8,dining:8,onlineHKD:8,onlineFX:8,travelJKSTA:8,physicalFX:8},{local:"💡 維持$250K存款可升至$4/里",dining:"💡 維持$250K存款可升至$4/里",onlineFX:"💡 維持$250K存款可升至$4/里+0%手續費"}),

  // ── CASHBACK ──
  mk("hsbc_red","HSBC Red","HSBC","both","網購4%/$2.5里(月$10K)+指定商戶8%(壽司郎/譚仔/GU，月$1,250)，其他0.4%",0.004,{onlineHKD:0.04},"網購月度$10,000/指定商戶$1,250上限",false,{local:25,dining:25,onlineHKD:2.5,onlineFX:25,travelJKSTA:25,physicalFX:25},null,"2026-03-31"),
  mk("hsbc_vs","HSBC Visa Signature","HSBC","both","最紅自主9X=3.6%/$2.78里，配Travel Guru海外最高9.6%",0.004,{},"年度$100,000上限(最紅額外)",false,{local:25,dining:25,onlineHKD:25,onlineFX:25,travelJKSTA:25,physicalFX:25},{physicalFX:"⚠️ 9.6%需登記最紅自主賞世界+Travel Guru L3",travelJKSTA:"⚠️ 9.6%需登記最紅自主賞世界+Travel Guru L3"}),
  mk("hsbc_plat","HSBC Visa 白金卡","HSBC","cashback","基本0.4%獎賞錢，可配最紅自主+Travel Guru",0.004,{octopus:0.004},null,true,null,{physicalFX:"💡 登記Travel Guru可疊加海外+3%~6%",travelJKSTA:"💡 登記Travel Guru可疊加海外+3%~6%"}),
  mk("hsbc_gold","HSBC 金卡","HSBC","cashback","入門級，0.4%獎賞錢，可配最紅自主+Travel Guru",0.004,{octopus:0.004},null,true,null,{physicalFX:"💡 登記Travel Guru可疊加海外+3%~6%",travelJKSTA:"💡 登記Travel Guru可疊加海外+3%~6%"}),
  mk("hsbc_pulse","HSBC 銀聯 Pulse","HSBC","cashback","銀聯雙幣，內地消費免手續費，可配最紅自主+Guru",0.004,{octopus:0.004},null,true,null,{physicalFX:"💡 登記Travel Guru可疊加海外+3%~6%",travelJKSTA:"💡 登記Travel Guru可疊加海外+3%~6%"}),
  mk("hsbc_easy","HSBC easy 卡","HSBC","cashback","最紅自主2.4%，配合易賞錢最高4.8%，海外配Guru最高8.4%",0.004,{octopus:0.004},null,true,null,{physicalFX:"💡 登記Travel Guru可疊加海外+3%~6%",travelJKSTA:"💡 登記Travel Guru可疊加海外+3%~6%"}),
  mk("hsbc_student","HSBC 學生卡","HSBC","cashback","大學生專屬，可配最紅自主+Travel Guru",0.004,{octopus:0.004},null,true,null,{physicalFX:"💡 登記Travel Guru可疊加海外+3%~6%",travelJKSTA:"💡 登記Travel Guru可疊加海外+3%~6%"}),
  mk("hs_mmpower","恒生 MMPOWER","Hang Seng","cashback","海外外幣6%/網購5%，需每月登記",0.004,{onlineHKD:0.05,onlineFX:0.06},"需簽滿$5,000，月度$500額外上限，優惠至2026年3月31日",false,null,{onlineHKD:"⚠️ 需每月登記+月簽滿$5,000，優惠至2026/3/31",onlineFX:"⚠️ 需每月登記+月簽滿$5,000，優惠至2026/3/31"},"2026-03-31"),
  mk("hs_travel","恒生 Travel+","Hang Seng","cashback","日韓泰中台澳門實體7%，其他外幣/餐飲5%",0.004,{travelJKSTA:0.07,physicalFX:0.05,dining:0.05},"登記一次即可，簽滿$6,000起，月度$500額外上限，只計實體",false,null,{travelJKSTA:"⚠️ 需登記一次+月簽滿$6,000，只計實體",physicalFX:"⚠️ 需登記一次+月簽滿$6,000，只計實體",dining:"⚠️ 需登記一次+月簽滿$6,000"}),
  mk("hs_enjoy","恒生 enJoy 卡","Hang Seng","cashback","百佳屈臣氏豐澤指定商戶優惠",0.004,{},null,true),
  mk("hs_muji","恒生 Muji 卡","Hang Seng","cashback","MUJI消費額外積分獎賞",0.004,{onlineHKD:0.006},null,true),
  mk("hs_uni","恒生大學/大專卡","Hang Seng","cashback","學生專屬，永久免年費",0.004,{},null,true),
  mk("sc_simply","渣打 Simply Cash","Standard Chartered","cashback","本地1.5%/外幣2%，無上限",0.015,{onlineFX:0.02,physicalFX:0.02,travelJKSTA:0.02},null,true),
  mk("sc_smart","渣打 Smart 卡","Standard Chartered","cashback","月簽$4K起0.56%/$15K起1.2%，特約商戶5%，免外幣手續費",0.0056,{},"需月簽$4,000起，特約商戶年度$60,000上限",false,null,{local:"⚠️ 0.56%需月簽≥$4,000，$15K起升至1.2%"}),
  mk("sc_apoint","渣打 A. Point Card","Standard Chartered","cashback","積分兌換禮品或現金回贈",0.004,{},null,true),
  mk("boc_sogo","中銀 SOGO Visa Sig","Bank of China","cashback","流動支付5.4%，SOGO消費額外積分",0.004,{mobilePay:0.054},"手機支付月度$2,000上限(額外5%)",false,null,{mobilePay:"💡 疊加狂賞派紅日可達5.4%+5%（需登記）",dining:"💡 疊加狂賞派紅日可+5%（需登記搶名額）"}),
  mk("boc_chill","中銀 Chill Card","Bank of China","cashback","網購/海外5%，Chill商戶10%(需月簽$1,500實體)，日常0.4%",0.004,{onlineHKD:0.05,onlineFX:0.05},"月度額外$150上限(~$3,260爆Cap)",false,null,{onlineHKD:"💡 疊加狂賞派紅日可達5%+5%=10%（需登記）",onlineFX:"💡 疊加狂賞飛可+高達6%（需登記搶名額）"}),
  mk("boc_cheers","中銀 Cheers Card VI","Bank of China","both","食飯10X=$1.5/里或4%，外幣4%",0.004,{dining:0.04,onlineFX:0.04,physicalFX:0.04,travelJKSTA:0.04},"食飯$10k/外幣$25k月度上限，需簽滿$5,000/月",false,{local:10,dining:1.5,onlineHKD:10,onlineFX:4,travelJKSTA:4,physicalFX:4},{dining:"⚠️ 需月簽滿$5,000 · 💡疊加狂賞派紅日可+5%",onlineFX:"⚠️ 需月簽滿$5,000 · 💡疊加狂賞飛可+6%",physicalFX:"⚠️ 需月簽滿$5,000 · 💡疊加狂賞飛可+6%",travelJKSTA:"⚠️ 需月簽滿$5,000 · 💡疊加狂賞飛可+6%"}),
  mk("boc_taobao","中銀淘寶卡","Bank of China","cashback","淘寶RMB消費0%手續費+額外積分",0.004,{onlineHKD:0.006},null,true,null,{onlineHKD:"💡 疊加狂賞派紅日可+5%（需登記搶名額）"}),
  mk("citi_cashback","Citi Cash Back","Citibank","cashback","食飯/酒店/外幣2%無上限，其他1%",0.01,{dining:0.02,onlineFX:0.02,physicalFX:0.02,travelJKSTA:0.02},null,true),
  mk("citi_octopus","Citi Octopus","Citibank","cashback","八達通AAVS 0.5%+車費15%回贈(需Citi卡月簽$4,000)",0.005,{octopus:0.005},null,true,null,{octopus:"💡 車費15%回贈需所有Citi卡月簽滿$4,000"}),
  mk("citi_hktv","Citi HKTVMALL","Citibank","cashback","逢星期四HKTVmall 95折，其他0.4%",0.004,{onlineHKD:0.005},"星期四HKTVmall限定",false),
  mk("citi_club","Citi The Club","Citibank","cashback","賺Club積分兌換禮品，基本1%",0.01,{},null,true),
  mk("dbs_live","DBS Live Fresh","DBS","cashback","自選類別5.4%(4揀1)，需App揀+單筆$300",0.004,{onlineHKD:0.054},"月度$4,000上限(5.4%)，需InstaRedeem 45日內領取",false,null,{onlineHKD:"⚠️ 需App揀自選類別+單筆滿$300"}),
  mk("dbs_eminent","DBS Eminent Card","DBS","cashback","餐飲/健身/運動/醫療5%，每年登記一次+單筆滿$300",0.01,{dining:0.05},"VS卡月度$8,000/白金$4,000上限(5%)",false,null,{dining:"⚠️ 需每年登記一次+每筆滿$300"}),
  mk("dbs_compass","DBS Compass Visa","DBS","cashback","逢星期三超市8%(滿$300)，其他0.4%",0.004,{supermarket:0.08},"超市$2,000/月上限(8%)，只限逢星期三，推廣至2026年5月",false,null,{supermarket:"⚠️ 只限逢星期三，單筆滿$300"},"2026-05-31"),
  mk("bea_goal","BEA GOAL","BEA","cashback","運動健身消費額外獎賞",0.004,{},null,true),
  mk("bea_world","BEA World MC","BEA","cashback","食飯/海外/電器/健身/醫療5%，App登記一次+月簽$4,000",0.004,{dining:0.05,onlineFX:0.05,physicalFX:0.05,travelJKSTA:0.05},"5%類別合計月度$10,000上限，不計歐洲及英國實體",false,null,{dining:"⚠️ 需App登記一次+月簽滿$4,000",onlineFX:"⚠️ 需App登記+月簽$4,000，不計歐洲及英國",physicalFX:"⚠️ 需App登記+月簽$4,000，不計歐洲及英國",travelJKSTA:"⚠️ 需App登記+月簽$4,000"}),
  mk("bea_ititan","BEA i-Titanium","BEA","cashback","網購/手機支付4%，月簽$2,000自動享有",0.004,{onlineHKD:0.04,mobilePay:0.04},"月度回贈$300上限(≈簽$7,500)，需累積零售滿$2,000",false,null,{onlineHKD:"⚠️ 需當月累積零售簽滿$2,000",mobilePay:"⚠️ 需當月累積零售簽滿$2,000"}),
  mk("bea_uni","BEA 大學/大專卡","BEA","cashback","學生專屬，永久免年費",0.004,{},null,true),
  mk("ds_wewa","安信 WeWa Visa Signature","Dah Sing","cashback","手機支付/旅遊/海外/網上娛樂4%(選1)，需滿$1,500/月",0.004,{travelJKSTA:0.04,physicalFX:0.04,onlineFX:0.04},"月度額外$200上限(~$5,556爆Cap)",false,null,{travelJKSTA:"⚠️ 需當月簽滿$1,500",physicalFX:"⚠️ 需當月簽滿$1,500",onlineFX:"⚠️ 需當月簽滿$1,500"}),
  mk("ds_earnmore","安信 EarnMORE","Dah Sing","cashback","銀聯卡本地消費2%(恆常)，外幣淨1%(有1%手續費)",0.02,{onlineFX:0.01,physicalFX:0.01,travelJKSTA:0.01},"每半年$80,000上限(2%恆常)，海外額外5%加碼至2026年3月31日",false,null,{onlineFX:"⚠️ 外幣淨回贈1%（2%-1%手續費）",physicalFX:"⚠️ 外幣淨回贈1%（2%-1%手續費）"},"2026-03-31"),
  mk("cncbi_motion","信銀國際 Motion","CNCBI","cashback","食飯/網購高達6%，毋須登記，簽滿$3,800自動享有",0.004,{dining:0.06,onlineHKD:0.06},"月度額外$200上限(~$3,571爆Cap)，需當月簽滿$3,800",false,null,{dining:"⚠️ 需當月累積簽滿$3,800",onlineHKD:"⚠️ 需當月累積簽滿$3,800"}),
  mk("cncbi_gba","信銀國際大灣區卡","CNCBI","cashback","大灣區/外幣消費額外回贈",0.004,{onlineFX:0.015},null,true),
  mk("ds_oneplus","大新 ONE+","Dah Sing","cashback","1%無上限現金回贈",0.01,{},null,true),
  mk("ds_myauto","大新 MyAuto 車主卡","Dah Sing","cashback","油站汽車消費額外回贈",0.004,{},null,true),
  mk("ds_kitty","大新 Hello Kitty 白金卡","Dah Sing","cashback","限定版收藏卡",0.004,{},null,true),
  mk("sim_card","sim Credit Card","sim","cashback","網購高達8%，需當月非網上簽滿$1,000解鎖，免入息證明",0.004,{onlineHKD:0.08},"月度回贈$200上限(≈簽$2,500)，需非網上簽滿$1,000",false,null,{onlineHKD:"⚠️ 需當月非網上簽賬滿$1,000先解鎖8%"}),
  mk("mox_cb","MOX（CashBack）","Mox Bank","cashback","基本1%，超市3%（外幣1.95%手續費）",0.01,{supermarket:0.03,onlineFX:0.01,physicalFX:0.01},null,true,null,{local:"💡 維持$250K存款可升至2%",supermarket:"💡 維持$250K存款可升至5%",dining:"💡 維持$250K存款可升至2%"}),
  mk("ccb_eye","建行 eye Visa Sig","CCB Asia","cashback","網購/拍卡2%，食飯高達11%(2%基本+9%加碼)",0.004,{onlineHKD:0.02,dining:0.11},"食飯需每月1號App搶名額(~2,500個)+月簽滿$8,000，月度回贈上限$800(≈簽$8,888)",false,null,{dining:"⚠️ 需每月1號App搶名額+月簽滿$8,000"}),
  mk("aeon_basic","AEON 信用卡","AEON","cashback","AEON商店95折優惠",0.004,{},null,true),
  mk("aeon_waku","AEON WAKUWAKU","AEON","cashback","網購6%/日本3%/本地餐飲1%，永久免年費",0.004,{onlineHKD:0.06,travelJKSTA:0.03,dining:0.01},"月度上限，海外3%只限日本",false,null,{travelJKSTA:"⚠️ 3%只限日本實體簽賬，其他地區只有0.4%"}),
  mk("fubon_in","富邦 iN Visa 白金卡","Fubon","cashback","主打網購額外積分獎賞",0.004,{onlineHKD:0.006},null,true),
  mk("fubon_plat","富邦 Visa 白金卡","Fubon","cashback","日韓實體4%/台灣實體8%/其他外幣2%，推廣至2026年底",0.004,{travelJKSTA:0.04,physicalFX:0.02},"台灣月簽$5,333爆Cap/日韓月簽$16,000爆Cap",false,null,{travelJKSTA:"⚠️ 推廣期優惠，至2026年12月底",physicalFX:"⚠️ 推廣期優惠，至2026年12月底"},"2026-12-31"),
  mk("icbc_star","工銀亞洲星座卡","ICBC Asia","cashback","基本回贈卡",0.004,{},null,true),
  // ── PREMIER BANKING CARDS ──
  mk("hsbc_premier","HSBC Premier MC","HSBC","both","基本$25/里(0.4%)，最紅自主類別$4.17/里(2.4%)，配Travel Guru海外最高8.4%",0.004,{octopus:0.004},null,false,{local:25,dining:25,onlineHKD:25,onlineFX:25,travelJKSTA:25,physicalFX:25},{physicalFX:"⚠️ 8.4%需登記最紅自主賞世界+Travel Guru L3",travelJKSTA:"⚠️ 8.4%需登記最紅自主賞世界+Travel Guru L3"}),
  mk("sc_priority","渣打 Priority Banking MC","Standard Chartered","miles","Priority客戶專屬，本地$8/里，海外$4/里",0.005,{onlineFX:0.018,physicalFX:0.018,travelJKSTA:0.018},null,true,{local:8,dining:8,onlineHKD:8,onlineFX:4,travelJKSTA:4,physicalFX:4}),
  mk("citi_ultima","Citi Ultima","Citibank","miles","頂級卡，全部$4/里+免費機場貴賓室",0.012,{},null,true,{local:4,dining:4,onlineHKD:4,onlineFX:4,travelJKSTA:4,physicalFX:4}),
  mk("hs_prestige","恒生 Prestige Visa Infinite","Hang Seng","both","Prestige客戶，海外5%/食飯5%",0.004,{dining:0.05,onlineFX:0.05,physicalFX:0.05,travelJKSTA:0.05},"需簽滿$6,000/月，月度$500額外上限",false,{local:10,dining:2,onlineHKD:10,onlineFX:4,travelJKSTA:4,physicalFX:4},{dining:"⚠️ 需月簽滿$6,000",onlineFX:"⚠️ 需月簽滿$6,000",physicalFX:"⚠️ 需月簽滿$6,000",travelJKSTA:"⚠️ 需月簽滿$6,000"}),
  mk("boc_emv","中銀 Visa Infinite","Bank of China","both","中銀私銀客戶，海外3X積分",0.004,{onlineFX:0.012,physicalFX:0.012,travelJKSTA:0.012},null,true,{local:10,dining:10,onlineHKD:10,onlineFX:5,travelJKSTA:5,physicalFX:5},{physicalFX:"💡 疊加狂賞飛可+高達6%（需登記搶名額）",travelJKSTA:"💡 疊加狂賞飛可+高達6%（需登記搶名額）"}),
  mk("boc_bliss","中銀 Bliss Card","Bank of China","both","指定網購6%/$1里，其他網購4%/$1.5里，實體0.4%",0.004,{onlineHKD:0.04},"月度$10,000上限(網購)，指定商戶6%",false,{local:25,dining:25,onlineHKD:1.5,onlineFX:25,travelJKSTA:25,physicalFX:25},{onlineHKD:"💡 指定商戶(Amazon/FARFETCH等)可達6%，疊加狂賞派紅日+5%"}),
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
const ALL_SCENARIOS=[...SCENARIOS,{id:"travelJKSTA",emoji:"🇯🇵",label:"日韓泰中台",sub:"實體簽賬"},{id:"manual",emoji:"💵",label:"手動記賬",sub:"現金/其他"}];

const ISSUERS=["HSBC","American Express","Hang Seng","Standard Chartered","Bank of China","Citibank","DBS","BEA","Dah Sing","CNCBI","Mox Bank","CCB Asia","AEON","Fubon","ICBC Asia","sim"];
const S={bg:"#F2F2F7",dark:"#1C1C1E",label:"#8E8E93",sec:"#3C3C43",sep:"rgba(0,0,0,0.05)",blue:"#007AFF",green:"#34C759",red:"#FF3B30",shadow:"0 14px 34px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.03)",rad:24};

function getRate(c,s,vs,guru,moxTier){
  // MOX tiered rewards
  if(c.id==="mox_cb"&&moxTier)return s==="supermarket"?0.05:0.02; // 5% super, 2% others
  if(c.id==="mox_miles"&&moxTier)return 0.01; // $4/里 = 1.25% RC equivalent

  // 最紅自主獎賞 — 適用 VS/白金/金卡/easy/Premier/Pulse/Student (NOT Red, NOT EveryMile)
  const vsCards=["hsbc_vs","hsbc_plat","hsbc_gold","hsbc_pulse","hsbc_easy","hsbc_student","hsbc_premier"];
  if(vsCards.includes(c.id)){
    const vsMap={world:["onlineFX","physicalFX","travelJKSTA"],savour:["dining"],home:["supermarket"],lifestyle:["local"],shopping:["onlineHKD"]};
    const boosted=vsMap[vs]||[];
    if(boosted.includes(s)){
      // VS: base 4X (1.6%) + 最紅自主 5X (2%) = 9X total = 3.6%
      if(c.id==="hsbc_vs")return 0.036;
      // Premier: base 1X + 最紅自主 5X = 6X = 2.4%
      if(c.id==="hsbc_premier")return 0.024;
      // Others (白金/金卡/easy等): base 1X + 最紅自主 5X = 6X = 2.4%
      return 0.024;
    }
    return c.cashback[s]||0;
  }
  if(c.id==="hsbc_everymile"&&["physicalFX","travelJKSTA"].includes(s)){
    // Base 1% + Travel Guru extra: GO +3%=4%, GING +4%=5%, GURU +6%=7%
    return guru==="L3"?0.07:guru==="L2"?0.05:0.04;
  }
  // Travel Guru for VS/Premier/白金/金/Pulse/easy/學生 — stacks on top of 最紅自主
  const guruCards=["hsbc_vs","hsbc_plat","hsbc_gold","hsbc_pulse","hsbc_easy","hsbc_student","hsbc_premier"];
  if(guruCards.includes(c.id)&&["physicalFX","travelJKSTA"].includes(s)){
    const baseRate=c.cashback[s]||0;
    // Check if 賞世界 is selected (boosts these scenarios)
    const vsMap2={world:["onlineFX","physicalFX","travelJKSTA"],savour:["dining"],home:["supermarket"],lifestyle:["local"],shopping:["onlineHKD"]};
    const boosted2=(vsMap2[vs]||[]).includes(s);
    let rate=0.004; // base 1X = 0.4%
    if(c.id==="hsbc_vs")rate=boosted2?0.036:0.016; // 9X or 4X
    else rate=boosted2?0.024:0.004; // 6X or 1X
    const guruExtra=guru==="L3"?0.06:guru==="L2"?0.04:0.03;
    return rate+guruExtra;
  }
  return c.cashback[s]||0;
}

function getMPD(c,s,vs,guru,moxTier){
  if(!c.milesPerDollar)return null;
  if(s==="octopus")return null;
  // MOX tiered
  if(c.id==="mox_miles"&&moxTier)return 4; // $4/里 with $250k savings
  const vsCards=["hsbc_vs","hsbc_plat","hsbc_gold","hsbc_pulse","hsbc_easy","hsbc_student","hsbc_premier"];
  if(vsCards.includes(c.id)&&c.milesPerDollar){
    const vsMap={world:["onlineFX","physicalFX","travelJKSTA"],savour:["dining"],home:["supermarket"],lifestyle:["local"],shopping:["onlineHKD"]};
    const boosted=vsMap[vs]||[];
    if(boosted.includes(s)){
      if(c.id==="hsbc_vs")return 2.78; // 9X
      if(c.id==="hsbc_premier")return 4.17; // 6X
      return 4.17; // 6X for other HSBC cards
    }
    return c.milesPerDollar[s]||c.milesPerDollar["local"]||null;
  }
  if(c.id==="hsbc_everymile"&&["physicalFX","travelJKSTA"].includes(s)){
    // EveryMile 1RC=20miles. Total RC%: L1=4%, L2=5%, L3=7%
    // L1: 4%×20=0.8 miles/$1→$1.25/里, L2: 5%×20=1.0→$1/里, L3: 7%×20=1.4→$0.71/里
    return guru==="L3"?0.71:guru==="L2"?1:1.25;
  }
  // Travel Guru for VS/Premier — 1RC=10miles for these cards
  const guruMilesCards=["hsbc_vs","hsbc_plat","hsbc_gold","hsbc_pulse","hsbc_easy","hsbc_student","hsbc_premier"];
  if(guruMilesCards.includes(c.id)&&c.milesPerDollar&&["physicalFX","travelJKSTA"].includes(s)){
    const vsMap3={world:["onlineFX","physicalFX","travelJKSTA"],savour:["dining"],home:["supermarket"],lifestyle:["local"],shopping:["onlineHKD"]};
    const boosted3=(vsMap3[vs]||[]).includes(s);
    // VS: 9X(boosted) or 4X(not) → RC%. 1RC=10miles. Plus Guru extra RC%.
    let rcPct=0.004;
    if(c.id==="hsbc_vs")rcPct=boosted3?0.036:0.016;
    else rcPct=boosted3?0.024:0.004;
    const guruExtra2=guru==="L3"?0.06:guru==="L2"?0.04:0.03;
    const totalRc=rcPct+guruExtra2;
    // 1RC=10miles for non-EveryMile HSBC cards, so miles per $1 = totalRc * 10
    const milesPerDollar=totalRc*10;
    return milesPerDollar>0?(1/milesPerDollar):null;
  }
  const mpd=c.milesPerDollar[s]||c.milesPerDollar["local"];
  return mpd||null;
}

function doCalc(sc,amt,own,mode,vs,guru,moxTier){
  const r={primary:null,fallback:null,globalBest:null};
  if(!amt||amt<=0)return r;
  try{
    const oc=CARDS.filter(c=>own.includes(c.id));
    if(mode==="cashback"){
      let b=null,br=-1;oc.forEach(c=>{const x=getRate(c,sc,vs,guru,moxTier);if(x>br){br=x;b=c;}});
      if(b){const cap=CAP_AMT[b.id]&&CAP_AMT[b.id][sc];r.primary={card:b,rate:br,val:amt*br,fxFee:FX_SCENARIOS.includes(sc)?getFxFee(b,sc):0,overCap:cap?amt>cap:false,capAmt:cap||0};}
      // Fallback: first try owned no-cap cards, then all cards
      if(b&&!b.noCap){
        let f=null,fr=-1;
        oc.filter(c=>c.noCap&&c.id!==b.id).forEach(c=>{const x=getRate(c,sc,vs,guru,moxTier);if(x>fr){fr=x;f=c;}});
        if(f){r.fallback={card:f,rate:fr,val:amt*fr,notOwned:false,fxFee:FX_SCENARIOS.includes(sc)?getFxFee(f,sc):0};}
        else{CARDS.filter(c=>c.noCap&&c.id!==b.id).forEach(c=>{const x=getRate(c,sc,vs,guru,moxTier);if(x>fr){fr=x;f=c;}});if(f)r.fallback={card:f,rate:fr,val:amt*fr,notOwned:true,fxFee:FX_SCENARIOS.includes(sc)?getFxFee(f,sc):0};}
      }
      // GlobalBest: find best card that can actually handle this amount
      let g=null,gr=-1;CARDS.forEach(c=>{
        const x=getRate(c,sc,vs,guru,moxTier);
        const cap=CAP_AMT[c.id]&&CAP_AMT[c.id][sc];
        if(cap&&amt>cap)return;
        if(["hsbc_everymile","hsbc_vs","hsbc_plat","hsbc_gold","hsbc_pulse","hsbc_easy","hsbc_student","hsbc_premier"].includes(c.id)&&["physicalFX","travelJKSTA"].includes(sc)){
          const eCap=guru==="L3"?36667:guru==="L2"?30000:16667;
          if(amt>eCap)return;
        }
        if(x>gr){gr=x;g=c;}
      });
      // If no uncapped card found, fallback to best noCap card
      if(!g){CARDS.filter(c=>c.noCap).forEach(c=>{const x=getRate(c,sc,vs,guru,moxTier);if(x>gr){gr=x;g=c;}});}
      if(g)r.globalBest={card:g,rate:gr,val:amt*gr};
    }else{
      const im=c=>c.type==="miles"||c.type==="both";
      let b=null,bm=Infinity;oc.filter(im).forEach(c=>{const m=getMPD(c,sc,vs,guru,moxTier);if(m&&m<bm){bm=m;b=c;}});
      if(b&&bm<Infinity){const cap=CAP_AMT[b.id]&&CAP_AMT[b.id][sc];r.primary={card:b,rate:bm,val:amt/bm,miles:true,fxFee:FX_SCENARIOS.includes(sc)?getFxFee(b,sc):0,overCap:cap?amt>cap:false,capAmt:cap||0};}
      // Fallback: first try owned no-cap miles cards, then all
      if(b&&!b.noCap){
        let f=null,fm=Infinity;
        oc.filter(c=>im(c)&&c.noCap&&c.id!==b.id).forEach(c=>{const m=getMPD(c,sc,vs,guru,moxTier);if(m&&m<fm){fm=m;f=c;}});
        if(f&&fm<Infinity){r.fallback={card:f,rate:fm,val:amt/fm,miles:true,notOwned:false,fxFee:FX_SCENARIOS.includes(sc)?getFxFee(f,sc):0};}
        else{CARDS.filter(c=>im(c)&&c.noCap&&c.id!==b.id).forEach(c=>{const m=getMPD(c,sc,vs,guru,moxTier);if(m&&m<fm){fm=m;f=c;}});if(f&&fm<Infinity)r.fallback={card:f,rate:fm,val:amt/fm,miles:true,notOwned:true,fxFee:FX_SCENARIOS.includes(sc)?getFxFee(f,sc):0};}
      }
      // GlobalBest miles: check cap (including EveryMile dynamic cap)
      let g=null,gm=Infinity;CARDS.filter(im).forEach(c=>{
        const m=getMPD(c,sc,vs,guru,moxTier);
        const cap=CAP_AMT[c.id]&&CAP_AMT[c.id][sc];
        if(cap&&amt>cap)return;
        // EveryMile dynamic cap
        if(["hsbc_everymile","hsbc_vs","hsbc_plat","hsbc_gold","hsbc_pulse","hsbc_easy","hsbc_student","hsbc_premier"].includes(c.id)&&["physicalFX","travelJKSTA"].includes(sc)){
          const eCap=guru==="L3"?36667:guru==="L2"?30000:16667;
          if(amt>eCap)return;
        }
        if(m&&m<gm){gm=m;g=c;}
      });
      if(!g){CARDS.filter(c=>im(c)&&c.noCap).forEach(c=>{const m=getMPD(c,sc,vs,guru,moxTier);if(m&&m<gm){gm=m;g=c;}});}
      if(g&&gm<Infinity)r.globalBest={card:g,rate:gm,val:amt/gm,miles:true};
    }
  }catch(e){console.error(e);}
  // Dynamic capInfo for Travel Guru cards (shared cap pool)
  const allGuruCards=["hsbc_everymile","hsbc_vs","hsbc_plat","hsbc_gold","hsbc_pulse","hsbc_easy","hsbc_student","hsbc_premier"];
  if(r.primary&&allGuruCards.includes(r.primary.card.id)&&["physicalFX","travelJKSTA"].includes(sc)){
    const guruCaps={L1:{cap:16667,label:"GO級(上限$500RC)"},L2:{cap:30000,label:"GING級(上限$1,200RC)"},L3:{cap:36667,label:"GURU級(上限$2,200RC)"}};
    const g=guruCaps[guru];
    r.primary.card={...r.primary.card,capInfo:`Travel Guru ${g.label}：簽$${g.cap.toLocaleString()}爆Cap`};
    r.primary.overCap=amt>g.cap;
    r.primary.capAmt=g.cap;
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

function Badge({type}){
  const cfg=type==="miles"?{bg:"#F0EDFF",c:"#5856D6",t:"✈️ 里數"}:type==="both"?{bg:"#F5F0FF",c:"#AF52DE",t:"✈️💰 兩用"}:{bg:"#E8FAF0",c:"#34C759",t:"💰 現金"};
  return <span style={{fontSize:10,fontWeight:600,padding:"2px 8px",borderRadius:99,background:cfg.bg,color:cfg.c}}>{cfg.t}</span>;
}

function getScenarioDesc(card,sc,rate,isCB,vs){
  const pct=(rate*100).toFixed(1);
  const capInfo=CAP_AMT[card.id]&&CAP_AMT[card.id][sc];
  // Check dynamic guru cap for HSBC cards on FX scenarios
  const allGuruIds=["hsbc_everymile","hsbc_vs","hsbc_plat","hsbc_gold","hsbc_pulse","hsbc_easy","hsbc_student","hsbc_premier"];
  const isGuruScenario=allGuruIds.includes(card.id)&&["physicalFX","travelJKSTA"].includes(sc);
  const capStr=capInfo?`月度$${capInfo.toLocaleString()}上限`:isGuruScenario?"Travel Guru上限":card.noCap?"無上限":card.capInfo?"有上限":"無上限";
  const scenarioNames={local:"一般消費",dining:"食飯",onlineHKD:"網購HKD",mobilePay:"流動支付",octopus:"八達通增值",supermarket:"超市",onlineFX:"網上外幣",travelJKSTA:"日韓泰中台",physicalFX:"海外實體"};
  const sn=scenarioNames[sc]||sc;
  if(isCB)return `${sn} ${pct}% 回贈（${capStr}）`;
  return `${sn} $${parseFloat(rate.toFixed(2))}/里（${capStr}）`;
}

export default function App(){
  const[tab,setTabRaw]=useState("calc");
  const scrollTop=()=>window.scrollTo({top:0,behavior:"smooth"});
  const setTab=(t)=>{setTabRaw(t);setTimeout(()=>window.scrollTo({top:0,behavior:"smooth"}),50);};
  const[mode,setMode]=useState("cashback");
  const[sc,setSc]=useState("local");
  const[amt,setAmt]=useState(0);
  const[sMax,setSMax]=useState(3000);
  const[own,setOwn]=useState([]);
  const[vs,setVs]=useState("world");
  const[guru,setGuru]=useState("L3");
  const[modal,setModal]=useState(null);
  const[tut,setTut]=useState(0);
  const[seen,setSeen]=useState(false);
  const[search,setSearch]=useState("");
  const[guideMode,setGuideMode]=useState("cashback");
  const[guideSc,setGuideSc]=useState("local");
  const[trackerView,setTrackerView]=useState("card");
  const[trackerSort,setTrackerSort]=useState("desc"); // "desc" high→low, "asc" low→high
  const[logDate,setLogDate]=useState(()=>new Date().toISOString().slice(0,10));
  const[logMemo,setLogMemo]=useState("");
  const[manualOpen,setManualOpen]=useState(false);
  const[resetStep,setResetStep]=useState(0);
  const[manualAmt,setManualAmt]=useState("");
  const[manualMemo,setManualMemo]=useState("");
  const[manualDate,setManualDate]=useState(()=>new Date().toISOString().slice(0,10));
  const[manualType,setManualType]=useState("cash");
  const[manualSc,setManualSc]=useState("local"); // cash, octopus, other
  const[fxSub,setFxSub]=useState(false);
  const[guideFxSub,setGuideFxSub]=useState(false);
  const[fxCur,setFxCur]=useState("HKD");
  const FX_RATES={HKD:1,JPY:0.0516,USD:7.81,GBP:9.92,EUR:8.41,THB:0.223,KRW:0.00575,TWD:0.241,CNY:1.08,AUD:5.08,SGD:5.82,MYR:1.77};
  const fxToHKD=fxCur==="HKD"?amt:Math.round(amt*FX_RATES[fxCur]);
  const[editMax,setEditMax]=useState(false);
  const[editQuick,setEditQuick]=useState(false);
  const[quickAmts,setQuickAmts]=useState([50,100,200,500,1000]);
  const[hsbcOpen,setHsbcOpen]=useState(false);
  const[moxTier,setMoxTier]=useState(false);
  const[moxOpen,setMoxOpen]=useState(false); // false=basic, true=$250k savings
  const[toast,setToast]=useState(null); // {msg, type}
  const[bankFilter,setBankFilter]=useState([]); // [] = show all, or array of issuer names
  const[histMonth,setHistMonth]=useState(()=>{const n=new Date();return`${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,"0")}`;});
  // Tracker state
  const[logs,setLogs]=useState([]);
  const[cycleDay,setCycleDay]=useState(1);
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
          const rate=card?getRate(card,r.sc,vs,guru,moxTier):0;
          const mpd=card?getMPD(card,r.sc,vs,guru,moxTier):null;
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
          if(d.own)setOwn(d.own);
          if(d.logs)setLogs(d.logs);
          if(d.cycleDay)setCycleDay(d.cycleDay);
          
          if(d.vs)setVs(d.vs);
          if(d.guru)setGuru(d.guru);
          if(d.sMax)setSMax(d.sMax);
          if(d.seen){setSeen(true);}
          if(d.quickAmts&&Array.isArray(d.quickAmts))setQuickAmts(d.quickAmts);
          if(d.mode)setMode(d.mode);
          if(d.recurring&&Array.isArray(d.recurring))setRecurring(d.recurring);
          if(d.moxTier)setMoxTier(d.moxTier);
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
        localStorage.setItem("sw_data",JSON.stringify({_v:3,own,logs,cycleDay,vs,guru,sMax:sMax>0?sMax:3000,seen,quickAmts,mode,recurring,moxTier}));
      }catch(e){}
    },500);
  },[own,logs,cycleDay,vs,guru,sMax,seen,loaded,quickAmts,mode,recurring,moxTier]);

  // Compute current billing cycle range
  const getCycleRange=useCallback(()=>{
    const now=new Date();
    let start=new Date(now.getFullYear(),now.getMonth(),cycleDay);
    if(now<start)start=new Date(now.getFullYear(),now.getMonth()-1,cycleDay);
    let end=new Date(start.getFullYear(),start.getMonth()+1,cycleDay);
    return{start,end};
  },[cycleDay]);

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

  const res=useMemo(()=>{try{return doCalc(sc,amt,own,mode,vs,guru,moxTier);}catch{return{primary:null,fallback:null,globalBest:null};}},[sc,amt,own,mode,vs,guru,moxTier]);
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
    const n=tut+1;
    if(n===2){setTab("cards");}
    if(n===3){setTab("cards");} // stay on cards, point at HSBC settings btn
    if(n===4){setTab("calc");}
    if(n===9)setTab("tracker");
    if(n===10)setTab("guide");
    if(n>10){setTut(0);setTab("cards");return;}
    setTut(n);
  };

  // Auto-scroll to highlighted element on tutorial step change
  useEffect(()=>{
    if(tut<2)return;
    const map={2:"tut-cardlist",3:"tut-hsbc-btn",4:"tut-scenario",5:"tut-mode",6:"tut-amount",7:"tut-result",8:"tut-logbtn",9:"tut-tracker",10:"tut-guide"};
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
    if(tut===3&&section==="hsbcbtn")return true;
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
  const hlStyle=(section)=>isHL(section)?{position:"relative",zIndex:9990,boxShadow:"0 0 0 3px #007AFF, 0 0 20px rgba(0,122,255,0.25)",borderRadius:16}:{};

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
      {dimmed&&<div style={{position:"fixed",inset:0,zIndex:9980,background:"rgba(0,0,0,0.75)",pointerEvents:"none"}}/>}

      {/* Tutorial tooltip — Steps 2-3 use fixed position, Steps 4-6 use inline (rendered near target in JSX) */}
      {tut===2&&(
        <div style={{position:"fixed",bottom:62,left:"50%",transform:"translateX(-50%)",zIndex:9995,maxWidth:300,width:"calc(100% - 40px)"}}>
          <div style={{background:"#fff",borderRadius:16,padding:16,boxShadow:"0 8px 30px rgba(0,0,0,0.3)"}}>
            <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}>
              <span style={{fontSize:10,fontWeight:700,color:S.blue,letterSpacing:1}}>步驟 1/9</span>
              <div style={{flex:1,height:3,borderRadius:2,background:"#E5E5EA"}}><div style={{height:3,borderRadius:2,background:S.blue,width:"11.1%"}}/></div>
            </div>
            <p style={{fontSize:15,fontWeight:600,color:S.dark,lineHeight:1.5}}>剔選你擁有嘅信用卡！揀完撳「下一步」</p>
            <div style={{display:"flex",gap:8,marginTop:12}}>
              <button onClick={()=>setTut(0)} style={{padding:"8px 16px",borderRadius:16,background:"#F2F2F7",border:"none",fontSize:12,fontWeight:600,color:S.label,cursor:"pointer"}}>跳過</button>
              <button onClick={tutNext} style={{flex:1,padding:"8px 16px",borderRadius:16,background:S.blue,border:"none",fontSize:12,fontWeight:700,color:"#fff",cursor:"pointer"}}>下一步 →</button>
            </div>
          </div>
          <div style={{width:0,height:0,borderLeft:"10px solid transparent",borderRight:"10px solid transparent",borderTop:"10px solid #fff",marginLeft:"37%"}}/>
        </div>
      )}
      {tut===9&&(
        <div style={{position:"fixed",bottom:76,left:"50%",transform:"translateX(-50%)",zIndex:9995,maxWidth:300,width:"calc(100% - 40px)"}}>
          <div style={{background:"#fff",borderRadius:16,padding:16,boxShadow:"0 8px 30px rgba(0,0,0,0.3)"}}>
            <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}>
              <span style={{fontSize:10,fontWeight:700,color:S.blue,letterSpacing:1}}>步驟 8/9</span>
              <div style={{flex:1,height:3,borderRadius:2,background:"#E5E5EA"}}><div style={{height:3,borderRadius:2,background:S.blue,width:"88.9%"}}/></div>
            </div>
            <p style={{fontSize:15,fontWeight:600,color:S.dark,lineHeight:1.5}}>「記帳」追蹤每張卡嘅月度消費額度，爆 Cap 時會自動提醒你轉保底卡</p>
            <div style={{display:"flex",gap:8,marginTop:12}}>
              <button onClick={()=>setTut(0)} style={{padding:"8px 16px",borderRadius:16,background:"#F2F2F7",border:"none",fontSize:12,fontWeight:600,color:S.label,cursor:"pointer"}}>跳過</button>
              <button onClick={tutNext} style={{flex:1,padding:"8px 16px",borderRadius:16,background:S.blue,border:"none",fontSize:12,fontWeight:700,color:"#fff",cursor:"pointer"}}>下一步 →</button>
            </div>
          </div>
          <div style={{width:0,height:0,borderLeft:"10px solid transparent",borderRight:"10px solid transparent",borderTop:"10px solid #fff",marginLeft:"60%"}}/>
        </div>
      )}
      {tut===10&&(
        <div style={{position:"fixed",bottom:76,right:8,zIndex:9995,maxWidth:300,width:"calc(100% - 80px)"}}>
          <div style={{background:"#fff",borderRadius:16,padding:16,boxShadow:"0 8px 30px rgba(0,0,0,0.3)"}}>
            <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}>
              <span style={{fontSize:10,fontWeight:700,color:S.blue,letterSpacing:1}}>步驟 9/9</span>
              <div style={{flex:1,height:3,borderRadius:2,background:"#E5E5EA"}}><div style={{height:3,borderRadius:2,background:S.blue,width:"100%"}}/></div>
            </div>
            <p style={{fontSize:15,fontWeight:600,color:S.dark,lineHeight:1.5}}>「攻略」可以睇到每個場景嘅信用卡排名！即刻了解邊張卡最強</p>
            <div style={{display:"flex",gap:8,marginTop:12}}>
              <button onClick={()=>setTut(0)} style={{padding:"8px 16px",borderRadius:16,background:"#F2F2F7",border:"none",fontSize:12,fontWeight:600,color:S.label,cursor:"pointer"}}>跳過</button>
              <button onClick={tutNext} style={{flex:1,padding:"8px 16px",borderRadius:16,background:S.blue,border:"none",fontSize:12,fontWeight:700,color:"#fff",cursor:"pointer"}}>完成教學 🎉</button>
            </div>
          </div>
          <div style={{width:0,height:0,borderLeft:"10px solid transparent",borderRight:"10px solid transparent",borderTop:"10px solid #fff",marginLeft:"auto",marginRight:24}}/>
        </div>
      )}

      {/* Welcome Modal (step 1 only) */}
      {tut===1&&(
        <div style={{position:"fixed",inset:0,zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",padding:20,background:"rgba(0,0,0,0.6)"}}>
          <div style={{background:"#fff",borderRadius:24,maxWidth:340,width:"100%",boxShadow:"0 25px 50px rgba(0,0,0,0.3)"}}>
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
          <div style={{background:"#fff",borderRadius:S.rad,maxWidth:480,width:"100%",maxHeight:"85vh",overflow:"auto",boxShadow:"0 20px 40px rgba(0,0,0,0.25)"}} onClick={e=>e.stopPropagation()}>
            <div style={{padding:20,borderBottom:`1px solid ${S.sep}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}><strong style={{fontSize:16}}>免責聲明與使用條款</strong><button onClick={()=>setModal(null)} style={{background:"none",border:"none",cursor:"pointer",padding:4}}><X size={18} color={S.label}/></button></div>
            <div style={{padding:20,fontSize:13,lineHeight:1.9,color:S.sec}}>
              <p><strong>1. 僅供參考 (For Reference Only)</strong><br/>本工具所提供的信用卡回贈率、里數兌換率、簽賬上限及其他資料，均來自各發卡機構的公開資料及第三方資訊平台，僅供初步參考之用。實際回贈率、條款及細則以各發卡銀行或金融機構最新公佈的官方條款為準。碌邊張 SwipeWhich 不保證本工具所載資料的準確性、完整性、即時性或適用性。</p>
              <p style={{marginTop:16}}><strong>2. 免責聲明 (Disclaimer of Liability)</strong><br/>碌邊張 SwipeWhich 及其開發者、營運者、關聯方不對任何因使用、依賴或無法使用本工具而直接或間接導致的任何損失承擔責任，包括但不限於：未能獲得的信用卡回贈或里數、因錯誤建議而產生的額外手續費或利息、任何形式的財務損失、利潤損失或機會成本、因銀行條款變更而導致的差異。使用者確認並同意自行承擔使用本工具的全部風險。</p>
              <p style={{marginTop:16}}><strong>3. 非財務建議 (Not Financial Advice)</strong><br/>本工具純粹為運算輔助工具，旨在幫助使用者比較不同信用卡在特定消費場景下的回贈效率。本工具不構成、亦不應被視為任何形式的財務建議、投資建議、信用卡申請建議或專業顧問服務。任何信用卡的申請、使用或取消決定，使用者應自行判斷或諮詢持牌財務顧問。</p>
              <p style={{marginTop:16}}><strong>4. 商標聲明 (Trademark Notice)</strong><br/>本工具中提及的所有信用卡名稱、銀行名稱、品牌名稱及相關標誌均為其各自擁有者的註冊商標或商標。碌邊張 SwipeWhich 與上述任何金融機構或品牌之間不存在任何贊助、背書、合作或關聯關係。本工具不使用任何銀行標誌或受版權保護的圖形。</p>
              <p style={{marginTop:16}}><strong>5. 隱私與數據保護</strong><br/>本工具採用完全客戶端運算架構。使用者的所有資料（包括信用卡選擇、消費金額、設定偏好）僅儲存於使用者裝置本地瀏覽器的 localStorage 中。本工具不設任何伺服器端數據儲存，不收集、不傳輸、不儲存任何個人身份識別資訊 (PII)。清除瀏覽器數據將永久刪除所有本地儲存的設定。<br/><br/>本工具使用 Google Analytics 收集匿名使用統計數據（如瀏覽量、裝置類型、地區），以改善服務質素。此數據不包含任何個人財務資料或信用卡資訊。詳情請參閱 <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" style={{color:"#007AFF"}}>Google 隱私政策</a>。</p>
              <p style={{marginTop:16}}><strong>6. 使用限制</strong><br/>使用者不得將本工具用於任何非法目的，不得對本工具進行逆向工程、反編譯或以任何方式提取原始碼，不得以任何方式暗示本工具獲得任何銀行或金融機構的官方認可。</p>
              <p style={{marginTop:16}}><strong>7. 條款修訂</strong><br/>碌邊張 SwipeWhich 保留隨時修訂本免責聲明及使用條款的權利，恕不另行通知。繼續使用本工具即表示使用者同意受最新條款約束。</p>
              <p style={{marginTop:16}}><strong>8. 管轄法律</strong><br/>本免責聲明及使用條款受香港特別行政區法律管轄，並按其詮釋。</p>
              <p style={{marginTop:16}}><strong>9. 聯絡我們</strong><br/>如有任何查詢、建議或投訴，請電郵至 <a href="mailto:admin@swipewhich.com" style={{color:S.blue}}>admin@swipewhich.com</a></p>
            </div>
            <div style={{padding:"12px 20px",textAlign:"center",fontSize:11,color:"#C7C7CC",borderTop:`1px solid ${S.sep}`}}>v1.4.0 · 資料庫更新：2026年3月10日<br/>© 2026 碌邊張 SwipeWhich. All rights reserved.<br/>聯絡：admin@swipewhich.com</div>
            <div style={{padding:"0 20px 20px"}}><button onClick={()=>setModal(null)} style={{width:"100%",padding:14,borderRadius:S.rad,background:S.blue,color:"#fff",fontSize:15,fontWeight:600,border:"none",cursor:"pointer"}}>了解</button></div>
          </div>
        </div>
      )}

      {/* Header */}
      <header style={{position:"sticky",top:0,zIndex:9991,borderBottom:"0.5px solid rgba(60,60,67,0.29)",padding:"10px 16px",background:"rgba(249,249,251,0.94)",backdropFilter:"blur(20px) saturate(180%)"}}>
        <div style={{maxWidth:640,margin:"0 auto",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:32,height:32,borderRadius:8,overflow:"hidden",flexShrink:0,boxShadow:"0 2px 8px rgba(0,122,255,0.25)"}}>
              <svg viewBox="0 0 512 512" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <linearGradient id="bg52" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#007AFF"/><stop offset="100%" stopColor="#34C759"/></linearGradient>
                  <linearGradient id="aiGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#007AFF"/><stop offset="100%" stopColor="#34C759"/></linearGradient>
                  <filter id="glow52"><feDropShadow dx="-2" dy="10" stdDeviation="12" floodOpacity="0.25"/></filter>
                </defs>
                <rect width="512" height="512" rx="112" fill="url(#bg52)"/>
                <rect x="136" y="180" width="240" height="145" rx="20" fill="rgba(255,255,255,0.15)" transform="rotate(-25 140 360)"/>
                <rect x="136" y="180" width="240" height="145" rx="20" fill="rgba(255,255,255,0.3)" transform="rotate(-10 140 360)"/>
                <g transform="rotate(5 140 360)">
                  <rect x="136" y="180" width="240" height="145" rx="24" fill="#FFFFFF" filter="url(#glow52)"/>
                  <path d="M 156 250 L 196 250 L 226 210 L 326 210" fill="none" stroke="#E5E5EA" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M 166 280 L 216 280 L 246 250" fill="none" stroke="#E5E5EA" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
                  <circle cx="196" cy="250" r="4" fill="#D1D1D6"/><circle cx="216" cy="280" r="4" fill="#D1D1D6"/><circle cx="326" cy="210" r="4" fill="#34C759"/>
                  <path d="M 256 225 Q 256 250 231 250 Q 256 250 256 275 Q 256 250 281 250 Q 256 250 256 225 Z" fill="url(#aiGrad)"/>
                </g>
              </svg>
            </div>
            <span style={{fontSize:17,fontWeight:700,color:S.dark,letterSpacing:-0.41}}>碌邊張 <span style={{color:S.label,fontWeight:500}}>SwipeWhich</span></span>
          </div>
          <div style={{display:"flex",alignItems:"center"}}>
            <button onClick={()=>setTut(1)} style={{padding:8,background:"none",border:"none",cursor:"pointer"}}><HelpCircle size={20} color={S.label}/></button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main style={{maxWidth:640,margin:"0 auto",padding:"0 16px"}}>

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
                <div onClick={()=>setTab("tracker")} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 14px",background:"linear-gradient(135deg, #fff 0%, #F0FFF4 100%)",borderRadius:16,boxShadow:S.shadow,cursor:"pointer",border:"1px solid rgba(52,199,89,0.1)"}}>
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

            {/* 1) Scenario Selection Boxes */}
            <div>
              <label style={{fontSize:13,fontWeight:400,color:S.sec,letterSpacing:-0.08,display:"block",marginBottom:8}}>簽賬種類</label>
              <div id="tut-scenario" style={{...hlStyle("scenario")}}>
                <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8}}>
                  {SCENARIOS.map(s=>{
                    const active=sc===s.id||(s.id==="physicalFX"&&sc==="travelJKSTA");
                    return(
                      <button key={s.id} onClick={()=>{if(s.id==="physicalFX"){setFxSub(true);setSc("physicalFX");}else{setFxSub(false);setSc(s.id);}}} style={{padding:"8px 4px",borderRadius:S.rad,border:active?"2px solid #007AFF":"2px solid transparent",background:active?"rgba(0,122,255,0.08)":"#fff",cursor:"pointer",textAlign:"center",transition:"all 0.2s ease",boxShadow:active?"none":S.shadow}}>
                        <div style={{fontSize:18}}>{s.emoji}</div>
                        <div style={{fontSize:10,fontWeight:600,color:active?S.blue:S.dark,marginTop:2,letterSpacing:-0.08}}>{s.label}</div>
                        <div style={{fontSize:7,color:active?S.blue:S.label,marginTop:1,letterSpacing:-0.05,lineHeight:1.2}}>{s.sub}</div>
                      </button>
                    );
                  })}
                </div>
                {/* Sub-option for 海外實體 */}
                {fxSub&&<div style={{display:"flex",gap:8,marginTop:8}}>
                  <button onClick={()=>setSc("physicalFX")} style={{flex:1,padding:"10px 8px",borderRadius:14,border:sc==="physicalFX"?"2px solid #007AFF":"2px solid "+S.sep,background:sc==="physicalFX"?"rgba(0,122,255,0.08)":"#fff",cursor:"pointer",transition:"all 0.15s"}}>
                    <span style={{fontSize:13,fontWeight:600,color:sc==="physicalFX"?S.blue:S.dark}}>🌍 一般外幣</span>
                  </button>
                  <button onClick={()=>setSc("travelJKSTA")} style={{flex:1,padding:"10px 8px",borderRadius:14,border:sc==="travelJKSTA"?"2px solid #007AFF":"2px solid "+S.sep,background:sc==="travelJKSTA"?"rgba(0,122,255,0.08)":"#fff",cursor:"pointer",transition:"all 0.15s"}}>
                    <span style={{fontSize:13,fontWeight:600,color:sc==="travelJKSTA"?S.blue:S.dark}}>🇯🇵 日韓泰中台</span>
                  </button>
                </div>}
              </div>
            </div>
            {/* Inline tooltip for step 4: below scenario */}
            {tut===4&&<div style={{position:"relative",zIndex:9995}}>
              <div style={{width:0,height:0,borderLeft:"10px solid transparent",borderRight:"10px solid transparent",borderBottom:"10px solid #fff",marginLeft:24}}/>
              <div style={{background:"#fff",borderRadius:16,padding:16,boxShadow:"0 8px 30px rgba(0,0,0,0.3)"}}>
                <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}><span style={{fontSize:10,fontWeight:700,color:S.blue,letterSpacing:1}}>步驟 3/9</span><div style={{flex:1,height:3,borderRadius:2,background:"#E5E5EA"}}><div style={{height:3,borderRadius:2,background:S.blue,width:"33.3%"}}/></div></div>
                <p style={{fontSize:15,fontWeight:600,color:S.dark}}>揀你嘅簽賬種類</p>
                <div style={{display:"flex",gap:8,marginTop:12}}><button onClick={()=>setTut(0)} style={{padding:"8px 16px",borderRadius:16,background:"#F2F2F7",border:"none",fontSize:12,fontWeight:600,color:S.label,cursor:"pointer"}}>跳過</button><button onClick={tutNext} style={{flex:1,padding:"8px 16px",borderRadius:16,background:S.blue,border:"none",fontSize:12,fontWeight:700,color:"#fff",cursor:"pointer"}}>下一步 →</button></div>
              </div>
            </div>}

            {/* 2) Amount */}
            <div id="tut-amount" style={{background:"#fff",borderRadius:S.rad,padding:16,boxShadow:S.shadow,...hlStyle("amount")}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:FX_SCENARIOS.includes(sc)?6:12}}>
                <label style={{fontSize:13,fontWeight:400,color:S.sec,letterSpacing:-0.08}}>簽賬金額</label>
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  {FX_SCENARIOS.includes(sc)&&<select value={fxCur} onChange={e=>setFxCur(e.target.value)} style={{padding:"4px 8px",borderRadius:8,background:"rgba(0,122,255,0.06)",border:`1px solid rgba(0,122,255,0.15)`,fontSize:12,fontWeight:700,color:S.blue,cursor:"pointer",appearance:"auto",WebkitAppearance:"menulist"}}>
                    {Object.keys(FX_RATES).map(c=><option key={c} value={c}>{c}</option>)}
                  </select>}
                  <div style={{display:"flex",alignItems:"center",background:"rgba(118,118,128,0.12)",borderRadius:10,padding:"6px 12px"}}>
                    <span style={{fontSize:15,fontWeight:500,color:S.sec,marginRight:4}}>{fxCur==="HKD"?"$":fxCur}</span>
                  <input type="number" inputMode="numeric" value={amt||""} onChange={e=>setAmt(Math.max(0,parseInt(e.target.value)||0))} placeholder="0" style={{width:96,textAlign:"right",fontSize:17,fontWeight:600,background:"transparent",border:"none",outline:"none",color:S.blue,letterSpacing:-0.41}}/>
                </div></div>
              </div>
              {FX_SCENARIOS.includes(sc)&&fxCur!=="HKD"&&amt>0&&<p style={{fontSize:12,color:S.blue,fontWeight:600,textAlign:"right",marginBottom:4}}>≈ HK${fxToHKD.toLocaleString()} <span style={{fontSize:10,fontWeight:400,color:S.label}}>(1 {fxCur} ≈ {FX_RATES[fxCur]} HKD)</span></p>}
              <input type="range" min={0} max={sMax} step={100} value={Math.min(amt,sMax)} onChange={e=>setAmt(parseInt(e.target.value))} style={{width:"100%",accentColor:S.blue}}/>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:4}}>
                <span style={{fontSize:10,color:"#C7C7CC"}}>$0</span>
                {editMax?<div style={{display:"flex",alignItems:"center",gap:4}}>
                  <span style={{fontSize:10,color:S.label}}>$</span>
                  <input type="number" autoFocus value={sMax===-1?"":sMax} onChange={e=>{const v=e.target.value;setSMax(v===""?-1:parseInt(v)||0);}} onBlur={()=>{setSMax(v=>Math.max(1000,v<0?3000:v));setEditMax(false);}} onKeyDown={e=>{if(e.key==="Enter"){setSMax(v=>Math.max(1000,v<0?3000:v));setEditMax(false);}}} style={{width:60,fontSize:11,fontWeight:700,color:S.blue,background:"rgba(0,122,255,0.06)",border:`1px solid ${S.blue}`,borderRadius:8,padding:"3px 6px",outline:"none",textAlign:"right"}}/>
                </div>:<button onClick={()=>setEditMax(true)} style={{fontSize:10,color:S.label,background:"none",border:"none",cursor:"pointer",padding:"2px 4px",borderRadius:4}}>${sMax.toLocaleString()} ✎</button>}
              </div>
              {/* Quick amount buttons */}
              <div style={{display:"flex",gap:6,marginTop:10,alignItems:"center"}}>
                {quickAmts.map(v=>(
                  <button key={v} onClick={()=>{setAmt(v);if(v>sMax)setSMax(Math.ceil(v/1000)*1000);}} style={{flex:1,padding:"7px 0",borderRadius:10,fontSize:11,fontWeight:600,background:amt===v?"rgba(0,122,255,0.08)":"#F2F2F7",color:amt===v?S.blue:S.sec,border:amt===v?`1px solid rgba(0,122,255,0.2)`:"1px solid transparent",cursor:"pointer"}}>${v>=1000?`${v/1000}k`:v}</button>
                ))}
                <button onClick={()=>setEditQuick(p=>!p)} style={{width:28,height:28,borderRadius:8,background:editQuick?"rgba(0,122,255,0.08)":"#F2F2F7",border:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:14,color:editQuick?S.blue:S.label}}>⚙</button>
              </div>
              {editQuick&&<div style={{marginTop:8,padding:12,background:S.bg,borderRadius:12}}>
                <p style={{fontSize:10,fontWeight:600,color:S.label,marginBottom:6}}>自訂快捷金額（逗號分隔）</p>
                <input type="text" defaultValue={quickAmts.join(",")} onBlur={e=>{const vals=e.target.value.split(",").map(s=>parseInt(s.trim())).filter(n=>n>0&&!isNaN(n)).slice(0,6);if(vals.length>=2)setQuickAmts(vals.sort((a,b)=>a-b));setEditQuick(false);}} onKeyDown={e=>{if(e.key==="Enter")e.target.blur();}} style={{width:"100%",padding:"8px 10px",borderRadius:8,border:`1px solid ${S.sep}`,fontSize:13,fontWeight:600,outline:"none",color:S.dark,boxSizing:"border-box"}}/>
              </div>}
            </div>
            {/* Inline tooltip for step 5: below amount */}
            {tut===6&&<div style={{position:"relative",zIndex:9995}}>
              <div style={{width:0,height:0,borderLeft:"10px solid transparent",borderRight:"10px solid transparent",borderBottom:"10px solid #fff",marginLeft:24}}/>
              <div style={{background:"#fff",borderRadius:16,padding:16,boxShadow:"0 8px 30px rgba(0,0,0,0.3)"}}>
                <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}><span style={{fontSize:10,fontWeight:700,color:S.blue,letterSpacing:1}}>步驟 5/9</span><div style={{flex:1,height:3,borderRadius:2,background:"#E5E5EA"}}><div style={{height:3,borderRadius:2,background:S.blue,width:"55.6%"}}/></div></div>
                <p style={{fontSize:15,fontWeight:600,color:S.dark}}>輸入今次簽賬金額</p>
                <div style={{display:"flex",gap:8,marginTop:12}}><button onClick={()=>setTut(0)} style={{padding:"8px 16px",borderRadius:16,background:"#F2F2F7",border:"none",fontSize:12,fontWeight:600,color:S.label,cursor:"pointer"}}>跳過</button><button onClick={tutNext} style={{flex:1,padding:"8px 16px",borderRadius:16,background:S.blue,border:"none",fontSize:12,fontWeight:700,color:"#fff",cursor:"pointer"}}>下一步 →</button></div>
              </div>
            </div>}

            {/* 3) Mode Toggle */}
            <div id="tut-mode" style={{position:"relative",display:"flex",padding:3,borderRadius:10,background:"rgba(118,118,128,0.12)",...hlStyle("mode")}}>
              <div style={{position:"absolute",top:3,bottom:3,borderRadius:8,background:"#fff",boxShadow:"0 3px 8px rgba(0,0,0,0.12), 0 3px 1px rgba(0,0,0,0.04)",transition:"all 0.2s ease",width:"calc(50% - 3px)",left:mode==="cashback"?3:"calc(50%)"}}/>
              <button onClick={()=>setMode("cashback")} style={{position:"relative",zIndex:2,flex:1,padding:"9px 0",borderRadius:9,fontSize:13,fontWeight:600,background:"none",border:"none",cursor:"pointer",color:mode==="cashback"?S.dark:S.label}}>💰 現金回贈</button>
              <button onClick={()=>setMode("miles")} style={{position:"relative",zIndex:2,flex:1,padding:"9px 0",borderRadius:9,fontSize:13,fontWeight:600,background:"none",border:"none",cursor:"pointer",color:mode==="miles"?S.dark:S.label}}>✈️ 飛行里數</button>
            </div>
            {/* Inline tooltip for step 4: mode toggle */}
            {tut===5&&<div style={{position:"relative",zIndex:9995}}>
              <div style={{width:0,height:0,borderLeft:"10px solid transparent",borderRight:"10px solid transparent",borderBottom:"10px solid #fff",marginLeft:24}}/>
              <div style={{background:"#fff",borderRadius:16,padding:16,boxShadow:"0 8px 30px rgba(0,0,0,0.3)"}}>
                <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}><span style={{fontSize:10,fontWeight:700,color:S.blue,letterSpacing:1}}>步驟 4/9</span><div style={{flex:1,height:3,borderRadius:2,background:"#E5E5EA"}}><div style={{height:3,borderRadius:2,background:S.blue,width:"44.4%"}}/></div></div>
                <p style={{fontSize:15,fontWeight:600,color:S.dark}}>揀返你想睇「現金回贈」定「飛行里數」</p>
                <div style={{display:"flex",gap:8,marginTop:12}}><button onClick={()=>setTut(0)} style={{padding:"8px 16px",borderRadius:16,background:"#F2F2F7",border:"none",fontSize:12,fontWeight:600,color:S.label,cursor:"pointer"}}>跳過</button><button onClick={tutNext} style={{flex:1,padding:"8px 16px",borderRadius:16,background:S.blue,border:"none",fontSize:12,fontWeight:700,color:"#fff",cursor:"pointer"}}>下一步 →</button></div>
              </div>
            </div>}

            {/* 4) Result Card — BIGGER fonts */}
            {/* Inline tooltip for step 6: above result */}
            {tut===7&&<div style={{position:"relative",zIndex:9995}}>
              <div style={{background:"#fff",borderRadius:16,padding:16,boxShadow:"0 8px 30px rgba(0,0,0,0.3)"}}>
                <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}><span style={{fontSize:10,fontWeight:700,color:S.blue,letterSpacing:1}}>步驟 6/9</span><div style={{flex:1,height:3,borderRadius:2,background:"#E5E5EA"}}><div style={{height:3,borderRadius:2,background:S.blue,width:"66.7%"}}/></div></div>
                <p style={{fontSize:15,fontWeight:600,color:S.dark}}>搞掂！呢度即刻顯示推薦卡同保底卡！</p>
                <div style={{display:"flex",gap:8,marginTop:12}}><button onClick={()=>setTut(0)} style={{padding:"8px 16px",borderRadius:16,background:"#F2F2F7",border:"none",fontSize:12,fontWeight:600,color:S.label,cursor:"pointer"}}>跳過</button><button onClick={tutNext} style={{flex:1,padding:"8px 16px",borderRadius:16,background:S.blue,border:"none",fontSize:12,fontWeight:700,color:"#fff",cursor:"pointer"}}>下一步 →</button></div>
              </div>
              <div style={{width:0,height:0,borderLeft:"10px solid transparent",borderRight:"10px solid transparent",borderTop:"10px solid #fff",margin:"0 auto"}}/>
            </div>}
            <div id="tut-result" style={{borderRadius:22,padding:22,background:"#fff",border:"1px solid rgba(0,0,0,0.03)",boxShadow:S.shadow,...hlStyle("result")}}>
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
                        <div style={{marginTop:6,padding:"6px 10px",borderRadius:10,background:"#FFF8E1",border:"1px solid #FFE082",display:"inline-block"}}>
                          <span style={{fontSize:11,color:"#FF9500",fontWeight:600}}>{p.card.cond[sc]}</span>
                        </div>
                      )}
                      {(()=>{const ex=getExpiry(p.card);return ex?<p style={{fontSize:10,color:ex.color,fontWeight:600,marginTop:4}}>{ex.text}</p>:null;})()}
                    </div>
                    <div style={{width:36,height:36,borderRadius:18,background:isCB?"rgba(52,199,89,0.04)":"rgba(0,122,255,0.04)",display:"flex",alignItems:"center",justifyContent:"center"}}>{isCB?<Wallet size={18} color={S.green}/>:<Plane size={18} color={S.blue}/>}</div>
                  </div>
                  <div style={{display:"flex",alignItems:"flex-end",justifyContent:"space-between",marginBottom:16}}>
                    <div>
                      <p style={{fontSize:11,color:S.label}}>{isCB?"預期回贈":"預期里數"}</p>
                      <p style={{fontSize:36,fontWeight:800,color:isCB?S.green:S.blue,lineHeight:1.1,letterSpacing:-0.5}}>{isCB?`$${p.val.toFixed(1)}`:`${Math.round(p.val).toLocaleString()} 里`}</p>
                      {isCB&&p.fxFee>0&&<p style={{fontSize:12,color:S.sec,marginTop:4}}>扣手續費後 ≈ <span style={{color:(p.rate-p.fxFee)>0?S.green:S.red,fontWeight:600}}>${(amt*(p.rate-p.fxFee)).toFixed(1)}</span></p>}
                    </div>
                    <div style={{padding:"8px 14px",borderRadius:14,background:isCB?"linear-gradient(135deg, #34C759, #28A745)":"linear-gradient(135deg, #007AFF, #0056D6)",boxShadow:isCB?"0 4px 12px rgba(52,199,89,0.3)":"0 4px 12px rgba(0,122,255,0.3)"}}>
                      <p style={{fontSize:22,fontWeight:700,color:"#fff",letterSpacing:-0.36}}>{isCB?`${(p.rate*100).toFixed(1)}%`:`$${parseFloat(p.rate.toFixed(2))}/里`}</p>
                      {p.fxFee>0&&<p style={{fontSize:10,color:"rgba(255,255,255,0.8)",marginTop:2}}>{isCB?`扣手續費${(p.fxFee*100).toFixed(2)}%`:`手續費$${Math.round(amt*p.fxFee)}`}</p>}
                      {p.fxFee===0&&FX_SCENARIOS.includes(sc)&&<p style={{fontSize:10,color:"rgba(255,255,255,0.9)",marginTop:2}}>✅ 免手續費</p>}
                    </div>
                  </div>
                  {/* Swapped from capped card note */}
                  {co&&(
                    <div style={{background:"#FFF8E1",borderRadius:16,padding:12,marginBottom:10,border:"1px solid #FFE082"}}>
                      <p style={{fontSize:12,fontWeight:700,color:"#FF9500",marginBottom:4}}>🚨 {co.card.name} 已超出回贈上限</p>
                      <p style={{fontSize:11,color:S.sec,lineHeight:1.5}}>簽 ${amt.toLocaleString()} 超出上限 {co.capAmt?`$${co.capAmt.toLocaleString()}/月`:""}，自動推薦保底卡</p>
                    </div>
                  )}
                  {p.card.capInfo&&(
                    <div style={{background:p.overCap?"#FFF8E1":"#FFF1F0",borderRadius:S.rad,padding:14,marginBottom:10,border:p.overCap?"1px solid #FFE082":"1px solid #FFD1D1"}}>
                      {p.overCap?(
                        <div>
                          <p style={{fontSize:13,fontWeight:700,color:"#FF9500",marginBottom:6}}>🚨 已超出此卡回贈上限</p>
                          <p style={{fontSize:12,color:S.sec,lineHeight:1.6}}>上限 <strong style={{color:S.dark}}>${p.capAmt.toLocaleString()}/月</strong>，超出部分只得基本回贈{(()=>{const spent=(cardSpending.cards[p.card.id]?.byScenario?.[sc]?.spent)||0;return spent>0?`\n本期已簽 $${spent.toLocaleString()}`:"";})()}</p>
                          {fb&&<div style={{marginTop:10,paddingTop:10,borderTop:"1px solid rgba(0,0,0,0.06)"}}>
                            <p style={{fontSize:11,color:S.label,marginBottom:4}}>👉 建議改用{fb.notOwned?"（市面推薦）":""}</p>
                            <p style={{fontSize:14,fontWeight:600,color:S.dark}}>{fb.card.name} <span style={{color:isCB?S.green:S.blue}}>{isCB?`${(fb.rate*100).toFixed(1)}%`:`$${parseFloat(fb.rate.toFixed(2))}/里`}</span>{fb.notOwned&&<span style={{color:"#FF9500",fontSize:11,marginLeft:6}}>未持有</span>}</p>
                            {fb.card.cond&&fb.card.cond[sc]&&<p style={{fontSize:9,color:"#FF9500",marginTop:2}}>{fb.card.cond[sc]}</p>}
                          </div>}
                        </div>
                      ):(
                        <div>
                          <p style={{fontSize:13,fontWeight:700,color:S.red,marginBottom:4}}>⚠️ 此卡有回贈上限</p>
                          <p style={{fontSize:12,color:S.sec,lineHeight:1.5}}>{p.card.capInfo}</p>
                          {(()=>{const spent=(cardSpending.cards[p.card.id]?.byScenario?.[sc]?.spent)||0;return spent>0&&p.capAmt?(
                            <p style={{fontSize:11,color:spent>=p.capAmt?"#FF9500":S.label,marginTop:4}}>📊 本期已簽 ${spent.toLocaleString()} / ${p.capAmt.toLocaleString()}{spent>=p.capAmt?" — 已爆Cap！":""}</p>
                          ):null;})()}
                          {fb&&<div style={{marginTop:10,paddingTop:10,borderTop:"1px solid rgba(0,0,0,0.06)"}}>
                            <p style={{fontSize:11,color:S.label,marginBottom:4}}>{fb.notOwned?"💡 市面最佳保底卡":"🛡️ 保底可用"}</p>
                            <p style={{fontSize:14,fontWeight:600,color:S.dark}}>{fb.card.name} <span style={{color:isCB?S.green:S.blue}}>{isCB?`${(fb.rate*100).toFixed(1)}%`:`$${parseFloat(fb.rate.toFixed(2))}/里`}</span>{fb.notOwned&&<span style={{color:"#FF9500",fontSize:11,marginLeft:6}}>未持有</span>}</p>
                            {fb.card.cond&&fb.card.cond[sc]&&<p style={{fontSize:9,color:"#FF9500",marginTop:2}}>{fb.card.cond[sc]}</p>}
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
                      {fb.card.cond&&fb.card.cond[sc]&&<p style={{fontSize:9,color:"#FF9500",marginTop:2}}>{fb.card.cond[sc]}</p>}
                    </div>
                  )}
                  {gb&&gb.card.id!==p.card.id&&(
                    <div style={{background:ownsG?"rgba(52,199,89,0.06)":"#FFFBEB",borderRadius:16,padding:12}}>
                      {ownsG?<p style={{fontSize:12,fontWeight:600,color:S.green}}>🎉 你已經擁有全城最抵嘅卡！</p>
                      :<div>
                        <p style={{fontSize:11,color:S.label,marginBottom:4}}>✨ 全城最抵</p>
                        <p style={{fontSize:14,fontWeight:600,color:S.dark}}>{gb.card.name} <span style={{color:"#FF9500"}}>{isCB?`${(gb.rate*100).toFixed(1)}%`:`$${parseFloat(gb.rate.toFixed(2))}/里`}</span>{!own.includes(gb.card.id)&&<span style={{color:"#FF9500",fontSize:11,marginLeft:6}}>未持有</span>}</p>
                        <a href={`https://www.google.com/search?q=${encodeURIComponent(gb.card.name+" 申請 香港")}`} target="_blank" rel="noopener noreferrer" style={{fontSize:11,color:S.blue,marginTop:6,display:"inline-block"}}>了解更多 / 申請 →</a>
                      </div>}
                    </div>
                  )}
                  {/* Single card tip */}
                  {own.length===1&&!fb&&<p style={{fontSize:11,color:S.label,textAlign:"center",marginTop:8}}>💡 加多一張信用卡可以比較邊張更抵</p>}
                </div>
              )}
            </div>

            {/* 記一筆 — always visible */}
            <div id="tut-logbtn" style={{background:"linear-gradient(135deg, #FFF8F0 0%, #FFF1E0 50%, #FFE8CC 100%)",borderRadius:S.rad,padding:14,boxShadow:S.shadow,border:"1px solid rgba(255,159,10,0.15)",...hlStyle("logbtn")}}>
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
                          <div onClick={()=>{const el=document.getElementById("log-date-input");if(el)el.showPicker?.();}} style={{padding:"6px 12px",borderRadius:20,background:logDate!==new Date().toISOString().slice(0,10)?"rgba(0,122,255,0.08)":"rgba(0,0,0,0.04)",cursor:"pointer",display:"flex",alignItems:"center",gap:5,border:logDate!==new Date().toISOString().slice(0,10)?`1px solid rgba(0,122,255,0.2)`:"1px solid transparent"}}>
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
                      <input type="text" value={logMemo} onChange={e=>setLogMemo(e.target.value)} placeholder="Mark低用咗咩錢" maxLength={40} style={{flex:1,padding:"6px 10px",borderRadius:10,border:`1px solid ${S.sep}`,background:"#fff",fontSize:12,outline:"none",color:S.dark,minWidth:0}}/>
                    </div>
                    {pExhausted&&<p style={{fontSize:11,color:"#FF9500",marginBottom:8}}>⚠️ 已簽 ${pSpent.toLocaleString()} / ${pCap.toLocaleString()}，建議用保底卡</p>}
                    <p style={{fontSize:10,color:S.label,marginBottom:6}}>撳下面揀用邊張卡記賬 ↓</p>
                    <div style={{display:"flex",gap:8}}>
                      {p.notOwned?(
                        <div style={{flex:1,padding:"13px 10px",borderRadius:14,background:"#FFFBEB",border:"1px solid #FFE082",textAlign:"center"}}>
                          <p style={{fontSize:12,fontWeight:600,color:"#FF9500"}}>你未持有 {p.card.name}</p>
                          <a href={`https://www.google.com/search?q=${encodeURIComponent(p.card.name+" 申請 香港")}`} target="_blank" rel="noopener noreferrer" style={{fontSize:11,color:S.blue,marginTop:4,display:"inline-block"}}>了解更多 / 申請 →</a>
                        </div>
                      ):(
                        <button onClick={()=>{addLog(p.card.id,p.card.name,sc,amt,p.rate,!isCB,mkDate(),logMemo);scrollTop();}} style={{...btnBase,flex:1,padding:"13px 10px",background:pExhausted?"#F2F2F7":isCB?"linear-gradient(135deg, #34C759, #28A745)":"linear-gradient(135deg, #007AFF, #0056D6)",color:pExhausted?S.label:"#fff",boxShadow:pExhausted?"none":isCB?"0 4px 12px rgba(52,199,89,0.3)":"0 4px 12px rgba(0,122,255,0.3)",borderRadius:14}}>
                          <PlusCircle size={14} style={{flexShrink:0}}/>
                          <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.card.name}</span>
                        </button>
                      )}
                      {fb&&(
                        <button onClick={()=>{addLog(fb.card.id,fb.card.name,sc,amt,fb.rate,!isCB,mkDate(),logMemo);scrollTop();}} style={{...btnBase,flex:1,padding:"13px 10px",background:pExhausted?isCB?"linear-gradient(135deg, #34C759, #28A745)":"linear-gradient(135deg, #007AFF, #0056D6)":"#F2F2F7",color:pExhausted?"#fff":S.sec,boxShadow:pExhausted?isCB?"0 4px 12px rgba(52,199,89,0.3)":"0 4px 12px rgba(0,122,255,0.3)":"none",borderRadius:14}}>
                          <PlusCircle size={14} style={{flexShrink:0}}/>
                          <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>🛡️ {fb.card.name}</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })():(
                <div style={{textAlign:"center",padding:"4px 0"}}>
                  <p style={{fontSize:14,fontWeight:700,color:"#FF9500"}}>✏️ 記一筆</p>
                  <p style={{fontSize:12,color:"#C7C7CC",marginTop:4}}>{noCards?"先揀卡再記帳":"輸入金額即可記帳"}</p>
                </div>
              )}
            </div>

            {/* Inline tooltip for step 7: 記一筆 — just above the box */}
            {tut===8&&<div style={{position:"relative",zIndex:9995}}>
              <div style={{width:0,height:0,borderLeft:"10px solid transparent",borderRight:"10px solid transparent",borderBottom:"10px solid #fff",marginLeft:24}}/>
              <div style={{background:"#fff",borderRadius:16,padding:16,boxShadow:"0 8px 30px rgba(0,0,0,0.3)"}}>
                <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}><span style={{fontSize:10,fontWeight:700,color:S.blue,letterSpacing:1}}>步驟 7/9</span><div style={{flex:1,height:3,borderRadius:2,background:"#E5E5EA"}}><div style={{height:3,borderRadius:2,background:S.blue,width:"77.8%"}}/></div></div>
                <p style={{fontSize:15,fontWeight:600,color:S.dark}}>碌完卡撳「記一筆」追蹤消費，爆 Cap 時會自動建議轉保底卡！</p>
                <div style={{display:"flex",gap:8,marginTop:12}}><button onClick={()=>setTut(0)} style={{padding:"8px 16px",borderRadius:16,background:"#F2F2F7",border:"none",fontSize:12,fontWeight:600,color:S.label,cursor:"pointer"}}>跳過</button><button onClick={tutNext} style={{flex:1,padding:"8px 16px",borderRadius:16,background:S.blue,border:"none",fontSize:12,fontWeight:700,color:"#fff",cursor:"pointer"}}>下一步 →</button></div>
              </div>
            </div>}

            {/* Disclaimer */}
            <button onClick={()=>setModal("tc")} style={{width:"100%",padding:6,background:"none",border:"none",fontSize:11,color:"#C7C7CC",cursor:"pointer",letterSpacing:-0.08}}>🛡️ 運算結果僅供參考，不構成任何財務建議 · 點擊查看完整免責聲明與使用條款</button>

            <a href="https://forms.gle/PwkderZ1RSDW7kRNA" target="_blank" rel="noopener noreferrer" style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,padding:12,borderRadius:12,background:"#fff",fontSize:15,fontWeight:400,color:S.sec,boxShadow:S.shadow,textDecoration:"none",letterSpacing:-0.24}}><MessageSquare size={15}/> 意見回饋 / 報 Bug <ExternalLink size={11}/></a>
            <p style={{textAlign:"center",fontSize:10,color:"#C7C7CC"}}>admin@swipewhich.com</p>
            <details style={{background:"#fff",borderRadius:16,overflow:"hidden",boxShadow:S.shadow}}>
              <summary style={{padding:"12px 16px",fontSize:12,fontWeight:600,color:S.sec,cursor:"pointer",listStyle:"none",display:"flex",justifyContent:"space-between",alignItems:"center"}}>📋 更新日誌 <span style={{fontSize:10,color:S.label}}>v1.4</span></summary>
              <div style={{padding:"0 16px 14px",fontSize:11,color:S.sec,lineHeight:1.8}}>
                <p style={{fontWeight:700,color:S.dark,marginTop:8}}>v1.4 — 2026年3月10日</p>
                <p>• 63 張卡數據經三重驗證修正</p>
                <p>• 最紅自主獎賞擴展至 5 個官方類別</p>
                <p>• 新增 MOX 存款等級設定</p>
                <p>• 23 張卡加入條件提示 Badge</p>
                <p>• 超 Cap 自動推薦保底卡</p>
                <p>• 外幣金額轉換器（12 種貨幣）</p>
                <p>• 定期扣款自動記帳功能</p>
                <p>• 記帳成就系統（回贈+里數雙軌）</p>
                <p>• 攻略排行榜顯示最紅自主命中狀態</p>
                <p style={{fontWeight:700,color:S.dark,marginTop:8}}>v1.3 — 2026年3月9日</p>
                <p>• 首次發佈，63 張卡</p>
                <p>• 計算器 + 記帳 + 攻略四大功能</p>
                <p>• iOS 原生設計系統</p>
                <p>• 9 步新手教學</p>
              </div>
            </details>
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
                <button onClick={()=>setOwn([])} style={{padding:"8px 12px",borderRadius:16,fontSize:11,fontWeight:600,background:"#fff",color:S.label,border:`1px solid ${S.sep}`,cursor:"pointer"}}>全部移除</button>
              </div>
            </div>

            {noCards&&tut===0&&<div style={{background:"#FFF1F0",borderRadius:12,padding:12,display:"flex",alignItems:"center",gap:8}}><AlertTriangle size={14} color={S.red}/><p style={{fontSize:12,fontWeight:600,color:S.red}}>請先剔選你擁有嘅信用卡</p></div>}
            {own.length===0&&tut===0&&<div style={{background:"rgba(0,122,255,0.04)",borderRadius:14,padding:12}}>
              <p style={{fontSize:12,color:S.sec,lineHeight:1.5}}>💡 只揀你<strong>錢包入面有</strong>嘅卡。唔使全選 — 揀得越準，推薦越啱你！</p>
            </div>}

            {/* Search */}
            <div style={{position:"relative",borderRadius:12}}>
              <input type="text" value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 搜尋信用卡名稱或銀行..." style={{width:"100%",padding:"8px 14px",borderRadius:10,border:"none",background:"rgba(0,0,0,0.06)",fontSize:15,outline:"none",boxSizing:"border-box",letterSpacing:-0.24}}/>
              {search&&<button onClick={()=>setSearch("")} style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer"}}><X size={16} color={S.label}/></button>}
            </div>

            {/* Bank quick filter — multi-select */}
            <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:4,WebkitOverflowScrolling:"touch"}}>
              {bankFilter.length>0&&<button onClick={()=>setBankFilter([])} style={{padding:"6px 14px",borderRadius:20,fontSize:11,fontWeight:600,background:"#FFF1F0",color:S.red,border:`1px solid rgba(255,59,48,0.2)`,cursor:"pointer",whiteSpace:"nowrap",flexShrink:0}}>重設 ✕</button>}
              {ISSUERS.map(iss=>{const cnt=(grouped[iss]||[]).filter(c=>own.includes(c.id)).length;const active=bankFilter.includes(iss);return(
                <button key={iss} onClick={()=>setBankFilter(p=>active?p.filter(x=>x!==iss):[...p,iss])} style={{padding:"6px 12px",borderRadius:20,fontSize:11,fontWeight:600,background:active?S.blue:"#fff",color:active?"#fff":S.sec,border:`1px solid ${active?S.blue:S.sep}`,cursor:"pointer",whiteSpace:"nowrap",flexShrink:0}}>{iss}{cnt>0&&<span style={{marginLeft:3,fontSize:9,opacity:0.7}}>·{cnt}</span>}</button>
              );})}
            </div>

            {ISSUERS.filter(x=>filteredGrouped[x]&&(bankFilter.length===0||bankFilter.includes(x))).map((iss,gi)=>(
              <div key={iss}>
              <div style={{background:"#fff",borderRadius:S.rad,overflow:"hidden",boxShadow:S.shadow,...hlStyle("cardlist")}}>
                <div style={{padding:"12px 16px",borderBottom:"1px solid rgba(0,0,0,0.06)",background:"rgba(118,118,128,0.04)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <p style={{fontSize:15,fontWeight:600,letterSpacing:-0.24,color:S.sec}}>{iss}</p>
                  {iss==="HSBC"&&<button id="tut-hsbc-btn" onClick={()=>setHsbcOpen(p=>!p)} style={{padding:"6px 12px",borderRadius:10,background:tut===3?"#fff":hsbcOpen?"rgba(0,122,255,0.08)":"rgba(118,118,128,0.08)",border:"none",cursor:"pointer",fontSize:11,fontWeight:600,color:hsbcOpen?S.blue:S.label,...hlStyle("hsbcbtn")}}>{hsbcOpen?"收起 ▲":"最紅自主 & Guru ⚙️"}</button>}
                  {iss==="Mox Bank"&&<button onClick={()=>setMoxOpen(p=>!p)} style={{padding:"6px 12px",borderRadius:10,background:moxOpen?"rgba(0,122,255,0.08)":"rgba(118,118,128,0.08)",border:"none",cursor:"pointer",fontSize:11,fontWeight:600,color:moxOpen?S.blue:S.label}}>{moxOpen?"收起 ▲":"存款設定 ⚙️"}</button>}
                </div>
                {/* Step 2 inline tooltip — only when panel is closed */}
                {iss==="HSBC"&&tut===3&&!hsbcOpen&&(
                  <div style={{position:"relative",zIndex:9995,padding:"0 16px 12px"}}>
                    <div style={{width:0,height:0,borderLeft:"10px solid transparent",borderRight:"10px solid transparent",borderBottom:"10px solid #fff",marginLeft:"auto",marginRight:16}}/>
                    <div style={{background:"#fff",borderRadius:14,padding:14,boxShadow:"0 8px 24px rgba(0,0,0,0.15)"}}>
                      <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}>
                        <span style={{fontSize:10,fontWeight:700,color:S.blue,letterSpacing:1}}>步驟 2/9</span>
                        <div style={{flex:1,height:3,borderRadius:2,background:"#E5E5EA"}}><div style={{height:3,borderRadius:2,background:S.blue,width:"22.2%"}}/></div>
                      </div>
                      <p style={{fontSize:14,fontWeight:600,color:S.dark,lineHeight:1.4}}>如有 HSBC 卡，撳上面「⚙️ 設定」揀最紅獎賞同 Travel Guru 等級</p>
                      <p style={{fontSize:11,color:S.label,marginTop:3}}>冇 HSBC 卡可直接略過</p>
                      <div style={{display:"flex",gap:8,marginTop:10}}>
                        <button onClick={tutNext} style={{padding:"7px 14px",borderRadius:12,background:"#F2F2F7",border:"none",fontSize:11,fontWeight:600,color:S.label,cursor:"pointer"}}>略過此步</button>
                        <button onClick={()=>setHsbcOpen(true)} style={{flex:1,padding:"7px 14px",borderRadius:12,background:S.blue,border:"none",fontSize:11,fontWeight:700,color:"#fff",cursor:"pointer"}}>打開設定 →</button>
                      </div>
                    </div>
                  </div>
                )}
                {/* Step 2 — when panel is open, show 下一步 inside panel */}
                {iss==="HSBC"&&hsbcOpen&&(
                  <div id="tut-settings" style={{padding:"14px 16px",background:tut===3?"#fff":"rgba(0,122,255,0.02)",borderBottom:"1px solid rgba(0,0,0,0.06)",...(tut===3?{position:"relative",zIndex:9990,boxShadow:"0 0 0 3px #007AFF, 0 0 20px rgba(0,122,255,0.25)",borderRadius:16,margin:4}:{})}}>
                    <p style={{fontSize:12,fontWeight:700,color:S.dark,marginBottom:4}}>最紅自主獎賞</p>
                    <p style={{fontSize:10,color:S.label,marginBottom:8}}>如果你有喺 HSBC App 登記「最紅自主獎賞」，揀返你嗰個類別</p>
                    <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:6,marginBottom:14}}>
                      {[{k:"world",l:"🌍 賞世界",d:"海外/外幣"},{k:"savour",l:"🍴 賞滋味",d:"食飯"},{k:"home",l:"🏠 賞家居",d:"超市/電器/電訊"},{k:"lifestyle",l:"🎬 賞享受",d:"戲院/健身/SPA"},{k:"shopping",l:"🛍️ 賞購物",d:"百貨/時裝/護膚"}].map(o=><button key={o.k} onClick={()=>setVs(o.k)} style={{padding:"8px 4px",borderRadius:10,fontSize:11,fontWeight:600,border:vs===o.k?`2px solid ${S.blue}`:`2px solid ${S.sep}`,background:vs===o.k?"rgba(0,122,255,0.06)":"#fff",color:vs===o.k?S.blue:S.label,cursor:"pointer",textAlign:"center"}}><div>{o.l}</div><div style={{fontSize:8,marginTop:2,opacity:0.7}}>{o.d}</div></button>)}
                    </div>
                    <p style={{fontSize:12,fontWeight:700,color:S.dark,marginBottom:4}}>Travel Guru 等級</p>
                    <p style={{fontSize:10,color:S.label,marginBottom:8}}>HSBC EveryMile 嘅海外簽賬里數等級</p>
                    <div style={{display:"flex",gap:6}}>
                      {[{k:"L1",l:"Lv1 GO +3%/$1.25里"},{k:"L2",l:"Lv2 GING +4%/$1里"},{k:"L3",l:"Lv3 GURU +6%/$0.71里"}].map(o=><button key={o.k} onClick={()=>setGuru(o.k)} style={{flex:1,padding:10,borderRadius:12,fontSize:11,fontWeight:600,border:guru===o.k?`2px solid ${S.blue}`:`2px solid ${S.sep}`,background:guru===o.k?"rgba(0,122,255,0.06)":"#fff",color:guru===o.k?S.blue:S.label,cursor:"pointer"}}>{o.l}</button>)}
                    </div>
                    {tut===3&&<button onClick={tutNext} style={{width:"100%",marginTop:12,padding:10,borderRadius:12,background:S.blue,border:"none",fontSize:12,fontWeight:700,color:"#fff",cursor:"pointer"}}>設定完成，下一步 →</button>}
                  </div>
                )}
                {iss==="Mox Bank"&&moxOpen&&(
                  <div style={{padding:"14px 16px",background:"rgba(0,122,255,0.02)",borderBottom:"1px solid rgba(0,0,0,0.06)"}}>
                    <p style={{fontSize:12,fontWeight:700,color:S.dark,marginBottom:4}}>MOX 存款等級</p>
                    <p style={{fontSize:10,color:S.label,marginBottom:8}}>維持 $250,000 活期存款可享更高回贈</p>
                    <div style={{display:"flex",gap:8}}>
                      <button onClick={()=>setMoxTier(false)} style={{flex:1,padding:10,borderRadius:12,fontSize:11,fontWeight:600,border:!moxTier?`2px solid ${S.blue}`:`2px solid ${S.sep}`,background:!moxTier?"rgba(0,122,255,0.06)":"#fff",color:!moxTier?S.blue:S.label,cursor:"pointer",textAlign:"center"}}><div>基本</div><div style={{fontSize:9,marginTop:2,opacity:0.7}}>CashBack 1% · Miles $8/里</div></button>
                      <button onClick={()=>setMoxTier(true)} style={{flex:1,padding:10,borderRadius:12,fontSize:11,fontWeight:600,border:moxTier?`2px solid ${S.blue}`:`2px solid ${S.sep}`,background:moxTier?"rgba(0,122,255,0.06)":"#fff",color:moxTier?S.blue:S.label,cursor:"pointer",textAlign:"center"}}><div>$250K 存款</div><div style={{fontSize:9,marginTop:2,opacity:0.7}}>CashBack 2% · Miles $4/里</div></button>
                    </div>
                  </div>
                )}
                {filteredGrouped[iss].map((c,i)=>{const sel=own.includes(c.id);return(
                  <button key={c.id} onClick={()=>toggle(c.id)} style={{width:"100%",display:"flex",alignItems:"center",gap:12,padding:"12px 16px",textAlign:"left",background:sel?"rgba(0,122,255,0.04)":"#fff",border:"none",borderBottom:i<filteredGrouped[iss].length-1?"0.5px solid rgba(60,60,67,0.12)":"none",cursor:"pointer",minHeight:44,boxSizing:"border-box"}}>
                    <div style={{flex:1,minWidth:0}}>
                      <p style={{fontSize:15,fontWeight:sel?600:400,color:sel?S.dark:"#AEAEB2",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",letterSpacing:-0.24}}>{c.name}</p>
                      <p style={{fontSize:12,color:"#C7C7CC",marginTop:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.desc}</p>
                      <div style={{marginTop:4,display:"flex",alignItems:"center",gap:6}}><Badge type={c.type}/>{(()=>{const ex=getExpiry(c);return ex?<span style={{fontSize:8,color:ex.color,fontWeight:600}}>{ex.status==="expired"?"⏰ 已過期":"⏳ 即將到期"}</span>:null;})()}</div>
                    </div>
                    {sel?<div style={{width:24,height:24,borderRadius:12,background:S.blue,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><Check size={14} color="#fff" strokeWidth={3}/></div>:<div style={{width:24,height:24,borderRadius:12,border:"2px solid #C7C7CC",flexShrink:0}}/>}
                  </button>
                );})}
              </div>
              </div>
            ))}
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>setTut(1)} style={{flex:1,padding:12,borderRadius:S.rad,background:"#fff",border:"none",fontSize:12,fontWeight:600,color:S.sec,cursor:"pointer",boxShadow:S.shadow,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}><HelpCircle size={14}/> 睇教學</button>
              <button onClick={()=>{if(!confirm("確定要重設所有資料？"))return;setOwn([]);setAmt(0);setVs("world");setGuru("L3");setSMax(3000);setLogs([]);setCycleDay(1);setSeen(false);try{localStorage.removeItem("sw_data");}catch(e){}}} style={{flex:1,padding:12,borderRadius:S.rad,background:"#fff",border:"none",fontSize:12,fontWeight:600,color:S.red,cursor:"pointer",boxShadow:S.shadow,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}><RotateCcw size={14}/> 重設</button>
            </div>
            <p style={{textAlign:"center",fontSize:10,color:"#C7C7CC",padding:8}}>© 2026 碌邊張 SwipeWhich · v1.4</p>
          </div>
        )}

        {/* ── GUIDE TAB ── */}
        {tab==="guide"&&(()=>{
          // Compute rankings for selected scenario
          const isCBG=guideMode==="cashback"||guideMode==="combo";
          let ranked=[];
          if(guideMode==="cashback"||guideMode==="combo"){
            ranked=CARDS.map(c=>{const r=getRate(c,guideSc,vs,guru,moxTier);return{card:c,rate:r,val:r};}).filter(x=>x.rate>0).sort((a,b)=>b.rate-a.rate);
          }else{
            ranked=CARDS.filter(c=>c.type==="miles"||c.type==="both").map(c=>{const m=getMPD(c,guideSc,vs,guru,moxTier);return{card:c,rate:m,val:m};}).filter(x=>x.rate&&x.rate<Infinity&&x.rate<50).sort((a,b)=>a.rate-b.rate);
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
                    const active=guideSc===s.id||(s.id==="physicalFX"&&guideSc==="travelJKSTA");
                    return(
                      <button key={s.id} onClick={()=>{if(s.id==="physicalFX"){setGuideFxSub(true);setGuideSc("physicalFX");}else{setGuideFxSub(false);setGuideSc(s.id);}}} style={{padding:"8px 2px",borderRadius:12,border:active?"2px solid #007AFF":"2px solid transparent",background:active?"rgba(0,122,255,0.08)":"#fff",boxShadow:active?"none":S.shadow,cursor:"pointer",textAlign:"center"}}>
                        <div style={{fontSize:15}}>{s.emoji}</div>
                        <div style={{fontSize:9,fontWeight:500,color:active?S.blue:S.dark,marginTop:2,letterSpacing:-0.08}}>{s.label}</div>
                      </button>
                    );
                  })}
                </div>
                {guideFxSub&&<div style={{display:"flex",gap:6,marginTop:6}}>
                  <button onClick={()=>setGuideSc("physicalFX")} style={{flex:1,padding:"8px",borderRadius:12,border:guideSc==="physicalFX"?"2px solid #007AFF":"2px solid "+S.sep,background:guideSc==="physicalFX"?"rgba(0,122,255,0.08)":"#fff",cursor:"pointer"}}>
                    <span style={{fontSize:12,fontWeight:600,color:guideSc==="physicalFX"?S.blue:S.dark}}>🌍 一般外幣</span>
                  </button>
                  <button onClick={()=>setGuideSc("travelJKSTA")} style={{flex:1,padding:"8px",borderRadius:12,border:guideSc==="travelJKSTA"?"2px solid #007AFF":"2px solid "+S.sep,background:guideSc==="travelJKSTA"?"rgba(0,122,255,0.08)":"#fff",cursor:"pointer"}}>
                    <span style={{fontSize:12,fontWeight:600,color:guideSc==="travelJKSTA"?S.blue:S.dark}}>🇯🇵 日韓泰中台</span>
                  </button>
                </div>}
              </div>

              {/* Mode toggle — 3 options */}
              <div style={{position:"relative",display:"flex",padding:3,borderRadius:10,background:"rgba(118,118,128,0.12)"}}>
                <div style={{position:"absolute",top:3,bottom:3,borderRadius:8,background:"#fff",boxShadow:"0 3px 8px rgba(0,0,0,0.12), 0 3px 1px rgba(0,0,0,0.04)",transition:"all 0.2s ease",width:"calc(33.33% - 2px)",left:guideMode==="cashback"?3:guideMode==="miles"?"calc(33.33% + 1px)":"calc(66.67%)"}}/>
                <button onClick={()=>setGuideMode("cashback")} style={{position:"relative",zIndex:2,flex:1,padding:"9px 0",borderRadius:9,fontSize:12,fontWeight:600,background:"none",border:"none",cursor:"pointer",color:guideMode==="cashback"?S.dark:S.label}}>💰 現金</button>
                <button onClick={()=>setGuideMode("miles")} style={{position:"relative",zIndex:2,flex:1,padding:"9px 0",borderRadius:9,fontSize:12,fontWeight:600,background:"none",border:"none",cursor:"pointer",color:guideMode==="miles"?S.dark:S.label}}>✈️ 里數</button>
                <button onClick={()=>setGuideMode("combo")} style={{position:"relative",zIndex:2,flex:1,padding:"9px 0",borderRadius:9,fontSize:12,fontWeight:600,background:"none",border:"none",cursor:"pointer",color:guideMode==="combo"?S.dark:S.label}}>🏆 組合</button>
              </div>

              {/* HSBC settings indicator */}
              {(()=>{
                const vsLabels={world:"🌍 賞世界",savour:"🍴 賞滋味",home:"🏠 賞家居",lifestyle:"🎬 賞享受",shopping:"🛍️ 賞購物"};
                const guruLabels={L1:"Lv1 GO",L2:"Lv2 GING",L3:"Lv3 GURU"};
                return(
                <div onClick={()=>setTab("cards")} style={{padding:"8px 12px",borderRadius:12,background:"rgba(0,122,255,0.04)",border:`1px solid rgba(0,122,255,0.1)`,cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div style={{fontSize:11,color:S.sec}}>
                    <span style={{fontWeight:600}}>HSBC 最紅自主：</span><span style={{color:S.blue,fontWeight:700}}>{vsLabels[vs]}</span>
                    <span style={{marginLeft:8,fontWeight:600}}>Guru：</span><span style={{color:S.blue,fontWeight:700}}>{guruLabels[guru]}</span>
                    {moxTier&&<span style={{marginLeft:8}}>· <span style={{fontWeight:600}}>MOX：</span><span style={{color:S.blue,fontWeight:700}}>$250K</span></span>}
                  </div>
                  <span style={{fontSize:10,color:S.blue}}>更改 →</span>
                </div>);
              })()}

              {/* Rankings or Combo View */}
              {guideMode==="combo"?(
                <div style={{display:"flex",flexDirection:"column",gap:12}}>
                  {ALL_SCENARIOS.map(s=>{
                    const cbRank=CARDS.map(c=>({card:c,rate:getRate(c,s.id,vs,guru,moxTier)})).filter(x=>x.rate>0).sort((a,b)=>b.rate-a.rate);
                    const best=cbRank[0];const fb=cbRank.find(x=>x.card.noCap&&x.card.id!==(best?.card.id));
                    const miRank=CARDS.filter(c=>c.type==="miles"||c.type==="both").map(c=>({card:c,rate:getMPD(c,s.id,vs,guru,moxTier)})).filter(x=>x.rate&&x.rate<50).sort((a,b)=>a.rate-b.rate);
                    const mBest=miRank[0];const mFb=miRank.find(x=>x.card.noCap&&x.card.id!==(mBest?.card.id));
                    return(
                      <div key={s.id} style={{background:"#fff",borderRadius:S.rad,overflow:"hidden",boxShadow:S.shadow}}>
                        <div style={{padding:"10px 14px",borderBottom:`1px solid ${S.sep}`,display:"flex",alignItems:"center",gap:8}}>
                          <span style={{fontSize:18}}>{s.emoji}</span>
                          <span style={{fontSize:14,fontWeight:700,color:S.dark}}>{s.label}</span>
                        </div>
                        <div style={{padding:14,display:"flex",flexDirection:"column",gap:10}}>
                          {/* Cashback combo */}
                          <div>
                            <p style={{fontSize:10,fontWeight:700,color:S.label,textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>💰 現金回贈</p>
                            <div style={{display:"flex",gap:8}}>
                              {best&&<div style={{flex:1,padding:"8px 10px",borderRadius:12,background:"rgba(52,199,89,0.06)",border:"1px solid rgba(52,199,89,0.15)",minWidth:0,overflow:"hidden"}}>
                                <p style={{fontSize:9,color:S.label}}>首選</p>
                                <p style={{fontSize:12,fontWeight:600,color:S.dark,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{best.card.name}</p>
                                <p style={{fontSize:13,fontWeight:700,color:S.green}}>{(best.rate*100).toFixed(1)}%</p>
                                <p style={{fontSize:8,color:best.card.capInfo?S.red:S.label,marginTop:2,lineHeight:1.3,display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>{best.card.capInfo||best.card.desc}</p>
                                {best.card.cond&&best.card.cond[s.id]&&<p style={{fontSize:8,color:"#FF9500",marginTop:1,lineHeight:1.3,display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>{best.card.cond[s.id]}</p>}
                                {own.includes(best.card.id)?<p style={{fontSize:8,color:S.green,marginTop:2}}>✓ 已持有</p>:<p style={{fontSize:8,color:"#FF9500",marginTop:2}}>未持有</p>}
                              </div>}
                              {fb&&fb.card.id!==best?.card.id&&<div style={{flex:1,padding:"8px 10px",borderRadius:12,background:S.bg,border:`1px solid ${S.sep}`,minWidth:0,overflow:"hidden"}}>
                                <p style={{fontSize:9,color:S.label}}>🛡️ 保底</p>
                                <p style={{fontSize:12,fontWeight:600,color:S.dark,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{fb.card.name}</p>
                                <p style={{fontSize:13,fontWeight:700,color:S.sec}}>{(fb.rate*100).toFixed(1)}%</p>
                                <p style={{fontSize:8,color:S.label,marginTop:2,lineHeight:1.3,display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>{fb.card.desc}</p>
                                {own.includes(fb.card.id)?<p style={{fontSize:8,color:S.green,marginTop:2}}>✓ 已持有</p>:<p style={{fontSize:8,color:"#FF9500",marginTop:2}}>未持有</p>}
                              </div>}
                            </div>
                          </div>
                          {/* Miles combo */}
                          {mBest&&<div>
                            <p style={{fontSize:10,fontWeight:700,color:S.label,textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>✈️ 飛行里數</p>
                            <div style={{display:"flex",gap:8}}>
                              <div style={{flex:1,padding:"8px 10px",borderRadius:12,background:"rgba(0,122,255,0.04)",border:"1px solid rgba(0,122,255,0.12)",minWidth:0,overflow:"hidden"}}>
                                <p style={{fontSize:9,color:S.label}}>首選</p>
                                <p style={{fontSize:12,fontWeight:600,color:S.dark,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{mBest.card.name}</p>
                                <p style={{fontSize:13,fontWeight:700,color:S.blue}}>${parseFloat(mBest.rate.toFixed(2))}/里</p>
                                <p style={{fontSize:8,color:mBest.card.capInfo?S.red:S.label,marginTop:2,lineHeight:1.3,display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>{mBest.card.capInfo||mBest.card.desc}</p>
                                {mBest.card.cond&&mBest.card.cond[s.id]&&<p style={{fontSize:8,color:"#FF9500",marginTop:1,lineHeight:1.3,display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>{mBest.card.cond[s.id]}</p>}
                                {own.includes(mBest.card.id)?<p style={{fontSize:8,color:S.green,marginTop:2}}>✓ 已持有</p>:<p style={{fontSize:8,color:"#FF9500",marginTop:2}}>未持有</p>}
                              </div>
                              {mFb&&mFb.card.id!==mBest.card.id&&<div style={{flex:1,padding:"8px 10px",borderRadius:12,background:S.bg,border:`1px solid ${S.sep}`,minWidth:0,overflow:"hidden"}}>
                                <p style={{fontSize:9,color:S.label}}>🛡️ 保底</p>
                                <p style={{fontSize:12,fontWeight:600,color:S.dark,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{mFb.card.name}</p>
                                <p style={{fontSize:13,fontWeight:700,color:S.sec}}>${parseFloat(mFb.rate.toFixed(2))}/里</p>
                                <p style={{fontSize:8,color:S.label,marginTop:2,lineHeight:1.3,display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>{mFb.card.desc}</p>
                                {own.includes(mFb.card.id)?<p style={{fontSize:8,color:S.green,marginTop:2}}>✓ 已持有</p>:<p style={{fontSize:8,color:"#FF9500",marginTop:2}}>未持有</p>}
                              </div>}
                            </div>
                          </div>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ):(<div>
              <div style={{background:"#fff",borderRadius:S.rad,overflow:"hidden",boxShadow:"0 1px 2px rgba(0,0,0,0.04)"}}>
                <div style={{padding:"12px 16px",borderBottom:`1px solid ${S.sep}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <span style={{fontSize:14,fontWeight:700,color:S.dark}}>{scenarioLabel?.emoji} {scenarioLabel?.label}</span>
                  <span style={{fontSize:11,fontWeight:600,color:S.label}}>{isCBG?"回贈率排名":"$/里 排名 (低=好)"}</span>
                </div>
                {ranked.length===0&&<div style={{padding:20,textAlign:"center",color:S.label,fontSize:13}}>此場景暫無適用卡片</div>}
                {ranked.slice(0,20).map((item,i)=>{
                  const isOwned=own.includes(item.card.id);
                  const isTop3=i<3;
                  const medal=i===0?"🥇":i===1?"🥈":i===2?"🥉":null;
                  return(
                    <div key={item.card.id} style={{display:"flex",alignItems:"center",gap:10,padding:isTop3?"14px 16px":"10px 16px",borderBottom:i<Math.min(ranked.length,20)-1?`1px solid ${S.bg}`:"none",background:isTop3?"rgba(0,122,255,0.02)":"#fff"}}>
                      <div style={{width:32,textAlign:"center",fontSize:medal?26:13,fontWeight:700,color:medal?undefined:S.label,flexShrink:0}}>{medal||`${i+1}`}</div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{display:"flex",alignItems:"center",gap:6}}>
                          <p style={{fontSize:isTop3?16:14,fontWeight:isTop3?700:500,color:S.dark,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",letterSpacing:-0.24}}>{item.card.name}</p>
                          {isOwned&&<div style={{width:16,height:16,borderRadius:8,background:S.green,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><Check size={9} color="#fff" strokeWidth={3}/></div>}
                        </div>
                        <p style={{fontSize:10,color:S.label,marginTop:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{item.card.desc}</p>
                        {item.card.capInfo&&<p style={{fontSize:9,color:S.red,marginTop:2}}>⚠️ {item.card.capInfo}</p>}
                        {item.card.cond&&item.card.cond[guideSc]&&<p style={{fontSize:9,color:"#FF9500",marginTop:2}}>{item.card.cond[guideSc]}</p>}
                        {(()=>{const ex=getExpiry(item.card);return ex?<p style={{fontSize:8,color:ex.color,marginTop:2}}>{ex.text}</p>:null;})()}
                        {(()=>{const vsCards=["hsbc_vs","hsbc_plat","hsbc_gold","hsbc_pulse","hsbc_easy","hsbc_student","hsbc_premier"];const vsMap={world:["onlineFX","physicalFX","travelJKSTA"],savour:["dining"],home:["supermarket"],lifestyle:["local"],shopping:["onlineHKD"]};if(vsCards.includes(item.card.id)&&vsMap[vs]?.includes(guideSc))return <p style={{fontSize:9,color:S.green,marginTop:2}}>✓ 命中最紅自主「{({world:"賞世界",savour:"賞滋味",home:"賞家居",lifestyle:"賞享受",shopping:"賞購物"})[vs]}」</p>;if(vsCards.includes(item.card.id))return <p style={{fontSize:9,color:S.label,marginTop:2}}>未命中最紅自主（此場景）</p>;return null;})()}
                      </div>
                      <div style={{textAlign:"right",flexShrink:0}}>
                        {isTop3?<div style={{padding:"6px 12px",borderRadius:12,background:isCBG?"linear-gradient(135deg, #34C759, #28A745)":"linear-gradient(135deg, #007AFF, #0056D6)",boxShadow:isCBG?"0 3px 8px rgba(52,199,89,0.25)":"0 3px 8px rgba(0,122,255,0.25)"}}>
                          <p style={{fontSize:16,fontWeight:700,color:"#fff",letterSpacing:-0.3}}>{isCBG?`${(item.rate*100).toFixed(1)}%`:`$${parseFloat(item.rate.toFixed(2))}/里`}</p>
                        </div>:<p style={{fontSize:15,fontWeight:500,color:S.sec,letterSpacing:-0.3}}>{isCBG?`${(item.rate*100).toFixed(1)}%`:`$${parseFloat(item.rate.toFixed(2))}/里`}</p>}
                        {!isOwned&&<p style={{fontSize:9,color:"#FF9F0A",marginTop:3}}>未持有</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
              {ranked.length>20&&<p style={{textAlign:"center",fontSize:11,color:S.label}}>顯示頭 20 張最佳卡片</p>}
              </div>)}

              <p style={{textAlign:"center",fontSize:10,color:"#C7C7CC",padding:16}}>© 2026 碌邊張 SwipeWhich · v1.4</p>
            </div>
          );
        })()}

        {tab==="tracker"&&(()=>{
          const[y,m]=histMonth.split("-").map(Number);
          const shiftMonth=(d)=>{const dt=new Date(y,m-1+d,1);setHistMonth(`${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,"0")}`);};
          const monthStart=new Date(y,m-1,cycleDay);
          const monthEnd=new Date(y,m,cycleDay);
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
              <div style={{background:"#fff",borderRadius:S.rad,padding:"10px 8px 14px",boxShadow:S.shadow,overflow:"hidden",position:"relative"}}
                onTouchStart={e=>{const t=e.currentTarget;t._sx=e.touches[0].clientX;t._moving=true;const inner=t.querySelector("[data-month-inner]");if(inner)inner.style.transition="none";}}
                onTouchMove={e=>{const t=e.currentTarget;if(!t._moving)return;const dx=e.touches[0].clientX-t._sx;const inner=t.querySelector("[data-month-inner]");if(inner){inner.style.transform=`translateX(${dx}px)`;inner.style.opacity=`${Math.max(0.2,1-Math.abs(dx)/250)}`;}}}
                onTouchEnd={e=>{const t=e.currentTarget;t._moving=false;const dx=e.changedTouches[0].clientX-t._sx;const inner=t.querySelector("[data-month-inner]");if(!inner)return;const threshold=60;if(Math.abs(dx)>threshold){const dir=dx>0?-1:1;const canGo=dir===1?(histMonth<curKey):true;if(canGo){inner.style.transition="transform 0.2s ease-out, opacity 0.2s ease-out";inner.style.transform=`translateX(${dx>0?200:-200}px)`;inner.style.opacity="0";setTimeout(()=>{shiftMonth(dir);inner.style.transition="none";inner.style.transform=`translateX(${dx>0?-200:200}px)`;inner.style.opacity="0";requestAnimationFrame(()=>{inner.style.transition="transform 0.25s ease-out, opacity 0.25s ease-out";inner.style.transform="translateX(0)";inner.style.opacity="1";});},220);}else{inner.style.transition="transform 0.3s ease, opacity 0.3s ease";inner.style.transform="translateX(0)";inner.style.opacity="1";}}else{inner.style.transition="transform 0.3s ease, opacity 0.3s ease";inner.style.transform="translateX(0)";inner.style.opacity="1";}}}
              >
                <div data-month-inner="" style={{display:"flex",alignItems:"center",gap:4}}>
                  <button onClick={()=>shiftMonth(-1)} style={{padding:8,background:"none",border:"none",cursor:"pointer",flexShrink:0}}><ChevronLeft size={20} color={S.sec}/></button>
                  <div style={{flex:1,textAlign:"center",userSelect:"none"}}>
                    <p style={{fontSize:18,fontWeight:700,color:S.dark,letterSpacing:-0.3}}>{y}年{m}月</p>
                    <p style={{fontSize:11,color:S.label}}>
                      截數日：
                      <input type="number" min={1} max={28} value={cycleDay} onChange={e=>setCycleDay(Math.min(28,Math.max(1,parseInt(e.target.value)||1)))} style={{width:28,background:"transparent",border:"none",outline:"none",textAlign:"center",fontSize:11,fontWeight:700,color:S.blue}}/>
                      號 · {monthLogs.length} 筆
                    </p>
                  </div>
                  <button onClick={()=>shiftMonth(1)} disabled={histMonth>=curKey} style={{padding:8,background:"none",border:"none",cursor:histMonth>=curKey?"default":"pointer",opacity:histMonth>=curKey?0.3:1,flexShrink:0}}><ChevronRight size={20} color={S.sec}/></button>
                </div>
                <div style={{width:36,height:4,borderRadius:2,background:"#E5E5EA",margin:"8px auto 0"}}/>
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
                <div style={{background:"linear-gradient(135deg, #fff 0%, #F0FFF4 100%)",borderRadius:S.rad,padding:16,boxShadow:S.shadow,border:"1px solid rgba(52,199,89,0.08)"}}>
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
                    <p style={{fontSize:9,color:S.label,marginBottom:3}}>💰 現金回贈</p>
                    <div style={{height:6,borderRadius:3,background:"rgba(52,199,89,0.1)",overflow:"hidden"}}>
                      <div style={{height:6,borderRadius:3,background:"linear-gradient(90deg, #34C759, #28A745)",width:`${cPct}%`,transition:"width 0.5s ease"}}/>
                    </div>
                    <div style={{display:"flex",justifyContent:"space-between",marginTop:3}}>
                      {[{a:100,l:"☕$100"},{a:300,l:"🥘$300"},{a:500,l:"🥩$500"},{a:1000,l:"🍣$1k"}].map(m=>(
                        <span key={m.a} style={{fontSize:9,color:monthRebate>=m.a?S.green:S.label,fontWeight:monthRebate>=m.a?700:400}}>{m.l}</span>
                      ))}
                    </div>
                  </div>}
                  {/* Miles progress */}
                  {monthMiles>0&&<div style={{marginTop:8}}>
                    <p style={{fontSize:9,color:S.label,marginBottom:3}}>✈️ 飛行里數</p>
                    <div style={{height:6,borderRadius:3,background:"rgba(0,122,255,0.08)",overflow:"hidden"}}>
                      <div style={{height:6,borderRadius:3,background:"linear-gradient(90deg, #007AFF, #0056D6)",width:`${mPct}%`,transition:"width 0.5s ease"}}/>
                    </div>
                    <div style={{display:"flex",justifyContent:"space-between",marginTop:3}}>
                      {[{a:2000,l:"🧳2k"},{a:5000,l:"🌏5k"},{a:10000,l:"🛫10k"},{a:20000,l:"✈️20k"}].map(m=>(
                        <span key={m.a} style={{fontSize:9,color:monthMiles>=m.a?S.blue:S.label,fontWeight:monthMiles>=m.a?700:400}}>{m.l}</span>
                      ))}
                    </div>
                  </div>}
                </div>);
              })()}

              {/* Manual entry button + form */}
              <div style={{background:"#fff",borderRadius:S.rad,overflow:"hidden",boxShadow:S.shadow}}>
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
                        <button key={t.k} onClick={()=>setManualType(t.k)} style={{flex:1,padding:"8px 4px",borderRadius:10,fontSize:11,fontWeight:600,border:manualType===t.k?`2px solid ${S.blue}`:`2px solid ${S.sep}`,background:manualType===t.k?"rgba(0,122,255,0.06)":"#fff",color:manualType===t.k?S.blue:S.label,cursor:"pointer"}}>{t.l}</button>
                      ))}
                    </div>
                    {/* Scenario picker */}
                    <div style={{display:"flex",gap:4,marginBottom:10,overflowX:"auto",paddingBottom:2}}>
                      {ALL_SCENARIOS.filter(s=>s.id!=="manual").map(s=>(
                        <button key={s.id} onClick={()=>setManualSc(s.id)} style={{padding:"5px 8px",borderRadius:8,fontSize:10,fontWeight:600,background:manualSc===s.id?"rgba(0,122,255,0.08)":"#fff",color:manualSc===s.id?S.blue:S.label,border:manualSc===s.id?`1px solid rgba(0,122,255,0.2)`:`1px solid ${S.sep}`,cursor:"pointer",whiteSpace:"nowrap",flexShrink:0}}>{s.emoji}{s.label}</button>
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
                    <button onClick={addManualLog} disabled={!manualAmt||parseFloat(manualAmt)<=0} style={{width:"100%",padding:12,borderRadius:14,background:(!manualAmt||parseFloat(manualAmt)<=0)?"#E5E5EA":S.blue,color:(!manualAmt||parseFloat(manualAmt)<=0)?S.label:"#fff",border:"none",fontSize:14,fontWeight:700,cursor:(!manualAmt||parseFloat(manualAmt)<=0)?"default":"pointer"}}>記錄</button>
                  </div>
                )}
              </div>

              {/* Recurring entries management */}
              <div style={{background:"#fff",borderRadius:S.rad,overflow:"hidden",boxShadow:S.shadow}}>
                <div style={{padding:"12px 16px",display:"flex",justifyContent:"space-between",alignItems:"center",borderBottom:(recurring.length>0||recForm)?`1px solid ${S.sep}`:"none"}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <span style={{fontSize:16}}>🔄</span>
                    <span style={{fontSize:14,fontWeight:600,color:S.dark}}>定期扣款</span>
                    {recurring.length>0&&<span style={{fontSize:11,color:S.label}}>{recurring.length} 項</span>}
                  </div>
                  <button onClick={()=>setRecForm(recForm?null:{memo:"",amount:"",day:"1",cardId:"",cardName:"",sc:"onlineHKD"})} style={{padding:"6px 12px",borderRadius:10,background:recForm?"rgba(255,59,48,0.06)":S.bg,border:"none",cursor:"pointer",fontSize:11,fontWeight:600,color:recForm?S.red:S.blue}}>{recForm?"取消":"＋ 新增"}</button>
                </div>
                {/* Inline add form */}
                {recForm&&(
                  <div style={{padding:"12px 16px",borderBottom:`1px solid ${S.sep}`,background:"rgba(0,122,255,0.02)"}}>
                    <div style={{display:"flex",gap:8,marginBottom:8}}>
                      <input type="text" value={recForm.memo} onChange={e=>setRecForm(p=>({...p,memo:e.target.value}))} placeholder="洗費 (e.g. YouTube)" style={{flex:1,padding:"8px 10px",borderRadius:10,border:`1px solid ${S.sep}`,fontSize:12,outline:"none",color:S.dark,background:"#fff",minWidth:0}}/>
                      <div style={{width:90,display:"flex",alignItems:"center",gap:2,background:"#fff",borderRadius:10,padding:"0 10px",border:`1px solid ${S.sep}`,flexShrink:0}}>
                        <span style={{fontSize:12,color:S.label}}>$</span>
                        <input type="number" value={recForm.amount} onChange={e=>setRecForm(p=>({...p,amount:e.target.value}))} placeholder="金額" style={{width:"100%",border:"none",outline:"none",fontSize:12,fontWeight:700,color:S.dark,background:"transparent"}}/>
                      </div>
                    </div>
                    <div style={{display:"flex",gap:8,marginBottom:8}}>
                      <div style={{display:"flex",alignItems:"center",gap:4,background:"#fff",borderRadius:10,padding:"6px 10px",border:`1px solid ${S.sep}`,flex:1}}>
                        <span style={{fontSize:11,color:S.label}}>每月</span>
                        <input type="number" min={1} max={28} value={recForm.day} onChange={e=>setRecForm(p=>({...p,day:e.target.value}))} style={{width:30,border:"none",outline:"none",fontSize:12,fontWeight:700,color:S.dark,textAlign:"center",background:"transparent"}}/>
                        <span style={{fontSize:11,color:S.label}}>號</span>
                      </div>
                      <select value={recForm.cardId||""} onChange={e=>{const c=CARDS.find(x=>x.id===e.target.value);setRecForm(p=>({...p,cardId:e.target.value,cardName:c?c.name:"未指定"}));}} style={{flex:2,padding:"6px 10px",borderRadius:10,border:`1px solid ${S.sep}`,fontSize:12,outline:"none",color:recForm.cardId?S.dark:S.label,background:"#fff",appearance:"auto"}}>
                        <option value="" disabled>揀你嘅卡</option>
                        {CARDS.filter(c=>own.includes(c.id)).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                    <div style={{display:"flex",gap:4,marginBottom:10,overflowX:"auto"}}>
                      {SCENARIOS.map(s=>(
                        <button key={s.id} onClick={()=>setRecForm(p=>({...p,sc:s.id}))} style={{padding:"4px 8px",borderRadius:8,fontSize:9,fontWeight:600,background:recForm.sc===s.id?"rgba(0,122,255,0.08)":"#fff",color:recForm.sc===s.id?S.blue:S.label,border:recForm.sc===s.id?`1px solid rgba(0,122,255,0.2)`:`1px solid ${S.sep}`,cursor:"pointer",whiteSpace:"nowrap",flexShrink:0}}>{s.emoji}{s.label}</button>
                      ))}
                    </div>
                    <button onClick={()=>{const a=parseFloat(recForm.amount);if(!recForm.memo||!a)return;setRecurring(p=>[...p,{id:Date.now(),cardId:recForm.cardId||"_recurring",cardName:recForm.cardName||"未指定",sc:recForm.sc,amount:a,memo:recForm.memo,dayOfMonth:Math.min(28,Math.max(1,parseInt(recForm.day)||1)),isMiles:false,rate:0}]);setRecForm(null);showToast("✅ 已新增定期扣款");}} disabled={!recForm.memo||!recForm.amount} style={{width:"100%",padding:10,borderRadius:12,background:(!recForm.memo||!recForm.amount)?"#E5E5EA":S.blue,color:(!recForm.memo||!recForm.amount)?S.label:"#fff",border:"none",fontSize:13,fontWeight:700,cursor:(!recForm.memo||!recForm.amount)?"default":"pointer"}}>新增定期扣款</button>
                  </div>
                )}
                {recurring.map(r=>(
                  <div key={r.id} style={{padding:"10px 16px",display:"flex",alignItems:"center",borderBottom:`1px solid rgba(0,0,0,0.04)`}}>
                    <div style={{flex:1,minWidth:0}}>
                      <p style={{fontSize:13,fontWeight:500,color:S.dark}}>{r.memo}</p>
                      <p style={{fontSize:11,color:S.label}}>{r.cardName} · 每月{r.dayOfMonth}號 · ${r.amount}</p>
                    </div>
                    <button onClick={()=>setRecurring(p=>p.filter(x=>x.id!==r.id))} style={{padding:6,background:"none",border:"none",cursor:"pointer"}}><X size={14} color={S.label}/></button>
                  </div>
                ))}
              </div>

              {/* View toggle */}
              {monthLogs.length>0&&(
                <div style={{display:"flex",gap:8,alignItems:"center"}}>
                  <div style={{position:"relative",display:"flex",padding:3,borderRadius:10,background:"rgba(118,118,128,0.12)",flex:1}}>
                    <div style={{position:"absolute",top:3,bottom:3,borderRadius:8,background:"#fff",boxShadow:"0 3px 8px rgba(0,0,0,0.12), 0 3px 1px rgba(0,0,0,0.04)",transition:"all 0.2s ease",width:"calc(25% - 2px)",left:trackerView==="card"?3:trackerView==="category"?"calc(25% + 1px)":trackerView==="daily"?"calc(50% + 1px)":"calc(75%)"}}/>
                    <button onClick={()=>setTrackerView("card")} style={{position:"relative",zIndex:2,flex:1,padding:"8px 0",borderRadius:8,fontSize:11,fontWeight:600,background:"none",border:"none",cursor:"pointer",color:trackerView==="card"?S.dark:S.label}}>💳 按卡</button>
                    <button onClick={()=>setTrackerView("category")} style={{position:"relative",zIndex:2,flex:1,padding:"8px 0",borderRadius:8,fontSize:11,fontWeight:600,background:"none",border:"none",cursor:"pointer",color:trackerView==="category"?S.dark:S.label}}>📊 場景</button>
                    <button onClick={()=>setTrackerView("daily")} style={{position:"relative",zIndex:2,flex:1,padding:"8px 0",borderRadius:8,fontSize:11,fontWeight:600,background:"none",border:"none",cursor:"pointer",color:trackerView==="daily"?S.dark:S.label}}>📅 日誌</button>
                    <button onClick={()=>setTrackerView("chart")} style={{position:"relative",zIndex:2,flex:1,padding:"8px 0",borderRadius:8,fontSize:11,fontWeight:600,background:"none",border:"none",cursor:"pointer",color:trackerView==="chart"?S.dark:S.label}}>🥧 圖表</button>
                  </div>
                  {(trackerView==="card"||trackerView==="category")&&<button onClick={()=>setTrackerSort(p=>p==="desc"?"asc":"desc")} style={{padding:"8px 10px",borderRadius:10,background:"#fff",border:`1px solid ${S.sep}`,cursor:"pointer",display:"flex",alignItems:"center",gap:3,flexShrink:0,boxShadow:S.shadow}}>
                    <span style={{fontSize:12}}>{trackerSort==="desc"?"↓":"↑"}</span>
                    <span style={{fontSize:10,fontWeight:600,color:S.sec}}>{trackerSort==="desc"?"高→低":"低→高"}</span>
                  </button>}
                </div>
              )}

              {/* Content based on view */}
              {monthLogs.length===0?(
                <div style={{background:"#fff",borderRadius:S.rad,padding:28,textAlign:"center",boxShadow:S.shadow}}>
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
                      <div key={cid} style={{background:"#fff",borderRadius:S.rad,overflow:"hidden",boxShadow:S.shadow}}>
                        <div style={{padding:"14px 16px",borderBottom:"1px solid rgba(0,0,0,0.06)"}}>
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
                            <div key={scKey} style={{padding:"10px 16px",borderBottom:"1px solid rgba(0,0,0,0.04)"}}>
                              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:cap?6:0}}>
                                <div>
                                  <span style={{fontSize:13,color:S.sec}}>{si?`${si.emoji} ${si.label}`:scKey}</span>
                                  {scData.rebate>0&&<span style={{fontSize:12,fontWeight:600,color:S.green,marginLeft:6}}>+${scData.rebate.toFixed(1)}</span>}
                                  {scData.miles>0&&<span style={{fontSize:11,fontWeight:600,color:"#5AC8FA",marginLeft:6}}>+{scData.miles.toLocaleString()}里</span>}
                                </div>
                                <span style={{fontSize:13,fontWeight:600,color:cap&&spent>=cap?S.red:S.dark}}>${spent.toLocaleString()}{cap?<span style={{fontSize:11,fontWeight:400,color:S.label}}> / ${cap.toLocaleString()}</span>:""}</span>
                              </div>
                              {cap&&<div style={{height:4,borderRadius:2,background:"#E5E5EA",overflow:"hidden"}}><div style={{height:4,borderRadius:2,background:pct>=100?S.red:pct>=80?"#FF9500":S.green,width:`${pct}%`,transition:"width 0.3s ease"}}/></div>}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              ):trackerView==="category"?(
                <div style={{background:"#fff",borderRadius:S.rad,overflow:"hidden",boxShadow:S.shadow}}>
                  {ALL_SCENARIOS.filter(s=>mCats[s.id]).sort((a,b)=>trackerSort==="desc"?mCats[b.id].spent-mCats[a.id].spent:mCats[a.id].spent-mCats[b.id].spent).map((s,i,arr)=>{
                    const d=mCats[s.id];
                    return(
                      <div key={s.id} style={{padding:"14px 16px",borderBottom:i<arr.length-1?"1px solid rgba(0,0,0,0.06)":"none"}}>
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
                      <div key={dayKey} style={{background:"#fff",borderRadius:S.rad,overflow:"hidden",boxShadow:S.shadow}}>
                        <div style={{padding:"10px 16px",borderBottom:"1px solid rgba(0,0,0,0.06)",background:"rgba(118,118,128,0.04)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                          <p style={{fontSize:14,fontWeight:600,color:S.dark}}>{dayKey}</p>
                          <p style={{fontSize:13,fontWeight:600,color:S.blue}}>${dayTotal.toLocaleString()}</p>
                        </div>
                        {dayLogs.map((l,i)=>{
                          const si=ALL_SCENARIOS.find(s=>s.id===l.scenario);
                          const d=new Date(l.date);
                          return(
                            <div key={l.id} style={{padding:"10px 16px",display:"flex",alignItems:"center",borderBottom:i<dayLogs.length-1?"1px solid rgba(0,0,0,0.04)":"none"}}>
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
                <div style={{background:"#fff",borderRadius:S.rad,padding:20,boxShadow:S.shadow}}>
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
                          {slices.map((s,i)=><path key={i} d={s.d} fill={s.color} stroke="#fff" strokeWidth={2}/>)}
                          <circle cx={90} cy={90} r={40} fill="#fff"/>
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

              <p style={{textAlign:"center",fontSize:10,color:"#C7C7CC",padding:8,lineHeight:1.5}}>所有資料保存喺你裝置本地瀏覽器<br/>清除瀏覽器數據會消失 · 建議定期匯出備份</p>
              <div style={{display:"flex",gap:8}}>
                <button onClick={()=>{try{const d=JSON.stringify({_v:2,own,logs,cycleDay,vs,guru,sMax,seen,quickAmts,mode,recurring,moxTier},null,2);const b=new Blob([d],{type:"application/json"});const u=URL.createObjectURL(b);const a=document.createElement("a");a.href=u;a.download=`swipewhich_backup_${new Date().toISOString().slice(0,10)}.json`;a.click();showToast("✅ 備份已下載");}catch(e){showToast("❌ 匯出失敗");}}} style={{flex:1,padding:12,borderRadius:S.rad,background:"#fff",border:"none",fontSize:12,fontWeight:600,color:S.blue,cursor:"pointer",boxShadow:S.shadow,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>📤 匯出備份</button>
                <label style={{flex:1,padding:12,borderRadius:S.rad,background:"#fff",border:"none",fontSize:12,fontWeight:600,color:S.green,cursor:"pointer",boxShadow:S.shadow,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>📥 匯入備份<input type="file" accept=".json" style={{display:"none"}} onChange={e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=ev=>{try{const d=JSON.parse(ev.target.result);if(d.own)setOwn(d.own);if(d.logs)setLogs(d.logs);if(d.cycleDay)setCycleDay(d.cycleDay);if(d.vs)setVs(d.vs);if(d.guru)setGuru(d.guru);if(d.sMax)setSMax(d.sMax);if(d.quickAmts)setQuickAmts(d.quickAmts);if(d.mode)setMode(d.mode);if(d.recurring)setRecurring(d.recurring);if(d.moxTier)setMoxTier(d.moxTier);showToast("✅ 備份已匯入");}catch(err){showToast("❌ 檔案格式錯誤");}};r.readAsText(f);e.target.value="";}}/></label>
              </div>
              {/* Triple-confirm reset */}
              {resetStep===0&&(
                <button onClick={()=>setResetStep(1)} style={{width:"100%",padding:12,borderRadius:S.rad,background:"#fff",border:"none",fontSize:12,fontWeight:600,color:S.red,cursor:"pointer",boxShadow:S.shadow}}>🗑️ 清除所有記帳記錄</button>
              )}
              {resetStep>=1&&(
                <div style={{background:"#fff",borderRadius:S.rad,padding:14,boxShadow:S.shadow,border:"1px solid rgba(255,59,48,0.15)"}}>
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
        <div style={{background:"#1C1C1E",color:"#fff",padding:"10px 18px",borderRadius:14,fontSize:13,fontWeight:600,boxShadow:"0 8px 24px rgba(0,0,0,0.3)",maxWidth:300,textAlign:"center",whiteSpace:"nowrap"}}>{toast}</div>
        <div style={{animation:"bounce 0.8s ease infinite",marginTop:2}}>
          <svg width="20" height="12" viewBox="0 0 20 12"><path d="M2 2L10 10L18 2" fill="none" stroke="#1C1C1E" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </div>
        <style>{`@keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(5px)}}`}</style>
      </div>}

      {/* Bottom Tabs */}
      <nav style={{position:"fixed",bottom:0,left:0,right:0,zIndex:9991,display:"flex",borderTop:"1px solid rgba(0,0,0,0.08)",background:"rgba(249,249,251,0.94)",backdropFilter:"blur(20px) saturate(180%)",paddingBottom:"env(safe-area-inset-bottom,8px)"}}>
        {[{k:"calc",l:"計算器",Ic:Calculator},{k:"cards",l:"Card Holder",Ic:Wallet},{k:"tracker",l:"記帳",Ic:ClipboardList},{k:"guide",l:"攻略",Ic:BookOpen}].map(t=>(
          <button key={t.k} onClick={()=>setTab(t.k)} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2,paddingTop:8,paddingBottom:4,background:"none",border:"none",cursor:"pointer",position:"relative",...(isHL("guidetab")&&t.k==="guide"?{zIndex:9990}:{}),...(isHL("trackertab")&&t.k==="tracker"?{zIndex:9990}:{}),...(toast&&t.k==="tracker"?{zIndex:9992}:{})}}>
            <div style={{...(toast&&t.k==="tracker"?{animation:"tabPulse 1s ease infinite",borderRadius:12,padding:4,background:"rgba(0,122,255,0.08)"}:{})}}>
              <t.Ic size={22} color={tab===t.k||toast&&t.k==="tracker"?S.blue:S.label}/>
            </div>
            <span style={{fontSize:10,fontWeight:500,color:tab===t.k||toast&&t.k==="tracker"?S.blue:S.label,letterSpacing:0.06}}>{t.l}</span>
            {t.k==="cards"&&noCards&&tut===0&&<div style={{position:"absolute",top:4,right:"25%",width:10,height:10,borderRadius:5,background:S.red,animation:"pulse 2s infinite"}}/>}
            {t.k==="tracker"&&cycleLogs.length>0&&<div style={{position:"absolute",top:2,right:"22%",minWidth:16,height:16,borderRadius:8,background:S.blue,display:"flex",alignItems:"center",justifyContent:"center"}}><span style={{fontSize:9,fontWeight:700,color:"#fff"}}>{cycleLogs.length}</span></div>}
          </button>
        ))}
      </nav>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}@keyframes tabPulse{0%,100%{transform:scale(1);box-shadow:0 0 0 0 rgba(0,122,255,0.3)}50%{transform:scale(1.1);box-shadow:0 0 12px 4px rgba(0,122,255,0.2)}}`}</style>
    </div>
  );
}
