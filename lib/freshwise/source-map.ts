// 品項目錄 ↔ 開放資料的對應表。純資料，沒有伺服器端依賴。
//
// ## 為什麼是「比對名稱」而不是「寫死代號」
//
// 農業部的交易行情每一列都帶著作物代號與作物名稱，而同一樣菜在資料裡是分成很多個品種的：
// 甘藍有 LA1 初秋、LA2 改良種、LA7 改良尖、LA4 紫色…光是「甘藍」就七八個代號。寫死代號
// 的話，(1) 要維護八十幾個品項 × 好幾個品種的清單，(2) 農業部新增一個品種代號我們就漏掉
// 那一筆，(3) 代號本身也會改。
//
// 所以這裡存的是**比對「作物名稱」的關鍵字**，實際取價時把所有命中的品種用交易量加權平均
// 起來——那本來就是「今天甘藍大概多少錢」最誠實的答案，比挑其中一個品種更有代表性。
//
// `exclude` 是必要的：基底名稱相同但根本是不同東西的要排掉。真實踩過的例子：
//   - 「蘿蔔」底下有「蘿蔔-甜菜根」（甜菜根！）跟「蘿蔔-櫻桃」（櫻桃蘿蔔），價格差很多。
//   - 「甘藍」底下有「甘藍-甘藍芽」（芽菜，上百元）。
//   - 「虱目魚」底下有「虱目魚肚」「虱目魚頭」（部位，價格完全不同）。
//   - 「鮭魚」底下有「鮭魚頭/尾」「鮭魚(凍)」「鮭魚片」。
//
// ## 各類別的資料覆蓋率差很多（這會決定畫面上哪個數字是推估的）
//
// | 類別 | 批發 | 傳統市場零售 |
// | --- | --- | --- |
// | 蔬菜、水果 | ✅ 農業部農產品交易行情（全國 22 市場） | 只有臺中市公有零售市場有訪價 |
// | 漁產 | ✅ 農業部漁產品交易行情（18 市場） | 臺中有 7 種 |
// | 肉類 | ❌ **完全沒有**（毛豬拍賣價是整頭豬的均價，不能當豬肉零售價） | 臺中有豬牛雞鴨 |
// | 蛋品 | 只有雞蛋的「產地價」（不是批發市場拍賣） | 臺中有雞蛋、鴨蛋 |
//
// 所以「這個數字是實際訪價還是推估」不是看場所就能決定的，要看這個品項在那個場所有沒有
// 來源——見 lib/freshwise/prices.server.ts 的 deriveQuote。

/** 比對規則：名稱裡含有 `match` 任一個關鍵字、且不含 `exclude` 任一個關鍵字。 */
export interface NameMatch {
  match: string[];
  exclude?: string[];
}

export interface SourceRef {
  /** 農業部「農產品交易行情」的作物名稱（蔬菜、水果）。元/公斤。 */
  farm?: NameMatch;
  /** 農業部「漁產品交易行情」的魚貨名稱。元/公斤。 */
  aquatic?: NameMatch;
  /** 臺中市公有零售市場每日蔬果價格的欄位名稱。元/台斤。可以給多個（例如鳳梨有三個品種
   *  各一欄），取有價那幾欄的平均。 */
  taichung?: string[];
  /** 農業部「家禽交易行情」的欄位名稱。元/台斤。 */
  poultry?: string;
  /** 農業部「糧價」的欄位後綴（例如 `japt` 是蓬萊米）。零售是 `pt_1<後綴>_price`
   *  （元/公斤）、批發是 `pt_2<後綴>_price`（元/100 公斤）。
   *  **這是唯一一個全國各縣市都有每日零售價的來源。** */
  rice?: string;
}

/**
 * 對應表。key 是 lib/freshwise/catalog.ts 的品項代碼。
 *
 * **沒有出現在這張表裡的品項代表「目前沒有任何免費資料來源」**，畫面上不會列出來
 * （見 catalog.ts 的 TRACKED_CATALOG）。被排除的有：山藥、鬼頭刀、豬梅花／絞肉／小排、
 * 牛肉火鍋片、雞胸肉／雞腿／雞翅、洗選蛋、鵪鶉蛋、皮蛋、鹹鴨蛋。
 * 雞肉的部位（胸、腿、翅）是最可惜的一批——臺中的訪價只到「肉雞／土雞／仿雞」整隻，
 * 沒有分部位，而家禽交易行情給的是毛雞的產地價，不是分切肉的零售價。
 */
export const SOURCE_MAP: Record<string, SourceRef> = {
  /* ── 蔬菜 ───────────────────────────────────────────── */
  FA1: { farm: { match: ["甘藍"], exclude: ["甘藍芽", "進口"] }, taichung: ["甘藍（平地高麗菜）"] },
  FA2: { farm: { match: ["包心白"], exclude: ["進口", "冬白芽"] }, taichung: ["結球白菜(山東白)"] },
  FA3: { farm: { match: ["小白菜"], exclude: ["水耕"] } },
  FA4: { farm: { match: ["青江白菜"] }, taichung: ["青江白菜"] },
  FA5: { farm: { match: ["蕹菜"] }, taichung: ["蕹菜(空心菜)"] },
  FA6: { farm: { match: ["菠菜"] } },
  FA7: { farm: { match: ["甘薯葉"] } },
  FA8: { farm: { match: ["莧菜"] } },
  FA9: { farm: { match: ["芹菜"], exclude: ["進口", "西洋芹菜"] } },
  FB1: { farm: { match: ["韭菜-白頭", "韭菜-青頭"] } },
  FB2: { farm: { match: ["蘿蔔-矸仔", "蘿蔔-梅花", "蘿蔔-白玉蘿蔔"] }, taichung: ["蘿蔔"] },
  FB3: { farm: { match: ["胡蘿蔔"], exclude: ["進口"] }, taichung: ["胡蘿蔔"] },
  FB4: { farm: { match: ["青蔥"], exclude: ["紅蔥頭"] }, taichung: ["青蔥"] },
  FB5: { farm: { match: ["洋蔥"] }, taichung: ["洋蔥(內銷)"] },
  FB6: { farm: { match: ["大蒜-蒜頭", "大蒜-蒜仁", "大蒜-蒜瓣"] }, taichung: ["蒜頭"] },
  FB7: { farm: { match: ["薑-老薑", "薑-嫩薑", "薑-粉薑"] } },
  FB8: { farm: { match: ["馬鈴薯"] } },
  FB9: { farm: { match: ["甘薯-"], exclude: ["甘薯葉"] } },
  // 開放資料裡山藥的作物名稱是「薯蕷-」（薯蕷-白薯蕷／紅薯蕷／粉薯／樹薯…），
  // **沒有「山藥」兩個字**——原本的 match:["山藥"] 命中 0 列，這一項從加進目錄那天起
  // 就一直沒有價格。排除樹薯（16 元，是做粉圓的原料，不是餐桌上的山藥）。
  FC1: { farm: { match: ["薯蕷"], exclude: ["進口", "樹薯"] } },
  FC2: { farm: { match: ["竹筍"] } },
  FC3: { farm: { match: ["番茄-牛番茄", "番茄-黑柿"] } },
  FC4: { farm: { match: ["小番茄"] }, taichung: ["小番茄_玉女", "小番茄_聖女"] },
  FC5: { farm: { match: ["絲瓜"] }, taichung: ["絲瓜"] },
  FC6: { farm: { match: ["胡瓜-"], exclude: ["花胡瓜"] }, taichung: ["胡瓜"] },
  FC7: { farm: { match: ["花胡瓜"] }, taichung: ["花胡瓜"] },
  FC8: { farm: { match: ["苦瓜"] } },
  FC9: { farm: { match: ["茄子"] } },
  FD1: { farm: { match: ["甜椒-青椒"] } },
  FD2: { farm: { match: ["甜椒-彩色種", "甜椒-水果彩椒"] } },
  // 花椰菜（白色的）跟青花菜（綠色的 broccoli）在農業部的資料裡是同一個基底名稱的兩個
  // 品種：「花椰菜-白梗」與「花椰菜-青梗」。不分開的話兩個完全不同的菜會共用一個價格。
  FD3: { farm: { match: ["花椰菜-白梗"] }, taichung: ["花椰菜"] },
  FD4: { farm: { match: ["花椰菜-青梗"] } },
  FD5: { farm: { match: ["玉米-"], exclude: ["玉米筍"] } },
  FD6: { farm: { match: ["敏豆"] } },
  FD7: { farm: { match: ["毛豆"] } },
  FD8: { farm: { match: ["芽菜類-綠豆芽"] } },
  FD9: { farm: { match: ["金絲菇"] } },
  FE1: { farm: { match: ["濕香菇"] } },
  FE2: { farm: { match: ["杏鮑菇"] } },
  FE3: { farm: { match: ["九層塔"] } },
  FE4: { farm: { match: ["芫荽"], exclude: ["進口"] } },
  /* 第二批：市場常見、原本查不到的。**用基底名稱收整個品種群**——菜攤上只說「南瓜」，
     不會說「南瓜-木瓜型 阿成」。進口的一律排掉（跟既有品項同一個規則）。 */
  FF1: { farm: { match: ["南瓜-"], exclude: ["進口"] } },
  // 山茼蒿（FM6）是另一種菜，拆出去之後這裡要排掉，不然同一筆成交會餵兩個品項。
  FF2: { farm: { match: ["茼蒿"], exclude: ["進口", "山茼蒿"] } },
  // 「菊芋-雪蓮薯」含「芋-」會被誤抓，但菊芋（FQ5）跟芋頭是完全不同的東西。
  FF3: { farm: { match: ["芋-"], exclude: ["進口", "芋頭蕃薯", "菊芋"] } },
  FF4: { farm: { match: ["萵苣菜-"], exclude: ["進口", "結球萵"] } },
  FF5: { farm: { match: ["辣椒-"], exclude: ["進口", "乾"] } },
  FF6: { farm: { match: ["冬瓜-"], exclude: ["進口"] } },
  FF7: { farm: { match: ["黃秋葵"] } },
  FF8: { farm: { match: ["茭白筍"] } },
  FF9: { farm: { match: ["青花苔"], exclude: ["進口"] } },
  FG1: { farm: { match: ["芥菜-"], exclude: ["進口", "芥菜心"] } },
  FG2: { farm: { match: ["豌豆-"], exclude: ["進口", "豌豆苗"] } },
  FG3: { farm: { match: ["玉米-玉米筍"], exclude: ["進口"] } },
  FG4: { farm: { match: ["芹菜-西洋芹菜"], exclude: ["進口"] } },
  FG5: { farm: { match: ["皇宮菜"] } },

  /* ── 第二批蔬菜（2026-11 加入）─────────────────────────
   * 排除規則的理由都寫在旁邊，不要「看起來多餘」就刪掉：
   *   - 菇類的「盒裝」是按盒報價不是按公斤，鴻喜菇散裝 53 元、盒裝 191 元，混在一起
   *     會把均價拉高三倍多。
   *   - 「芽」「苗」「去殼」「蓮子」都是同一個基底名稱底下的不同產品。
   */
  FH1: { farm: { match: ["扁蒲"] } },
  FH2: { farm: { match: ["油菜"], exclude: ["油菜花", "小松菜"] } },
  FH3: { farm: { match: ["菜豆"] } },
  FH4: { farm: { match: ["隼人瓜"], exclude: ["瓜苗"] } },
  FH5: { farm: { match: ["隼人瓜-瓜苗"] } },
  FH6: { farm: { match: ["芥藍菜"], exclude: ["芥藍芽"] } },
  FH7: { farm: { match: ["蓮藕"], exclude: ["蓮子"] } },
  FH8: { farm: { match: ["菱角"], exclude: ["去殼"] } },
  FH9: { farm: { match: ["豆薯"] } },
  FJ1: { farm: { match: ["落花生"], exclude: ["熟"] } },
  FJ2: { farm: { match: ["濕木耳"], exclude: ["盒裝"] } },
  FJ3: { farm: { match: ["秀珍菇"], exclude: ["盒裝"] } },
  FJ4: { farm: { match: ["鴻喜菇"], exclude: ["盒裝"] } },
  FJ5: { farm: { match: ["洋菇"], exclude: ["盒裝"] } },
  FJ6: { farm: { match: ["青蔥-紅蔥頭"] } },
  FJ7: { farm: { match: ["蘆筍"], exclude: ["進口", "蘆筍花"] } },
  FJ8: { farm: { match: ["萵苣莖"] } },
  FJ9: { farm: { match: ["大心菜"] } },
  FK1: { farm: { match: ["海菜-水蓮"] } },
  // 牛蒡是這份對照表裡**唯一不排除進口**的品項：本土牛蒡一天只有 200 公斤，進口有
  // 1,250 公斤，而且攤位上賣的就是進口的。排掉進口會讓這一項十二天裡有四天查不到價。
  FK2: { farm: { match: ["牛蒡"] } },

  /* ── 第三批蔬菜（2026-11 加入）───────────────────────── */
  // 「硬梗／軟梗」是蒜苗（青蒜）的兩種梗性，不是蒜頭——蒜頭／蒜仁／蒜瓣在 FB6，
  // 價格也差一截（青蒜 65～66、蒜頭 106）。
  FK3: { farm: { match: ["大蒜-硬梗", "大蒜-軟梗"] } },
  // FF4 萵苣刻意排除結球萵，因為葉菜跟結球的用途與價格都不同；這裡把它收成自己一項。
  FK4: { farm: { match: ["萵苣菜-結球萵"], exclude: ["進口"] } },
  FK5: { farm: { match: ["紅鳳菜"] } },
  FK6: { farm: { match: ["茴香"] } },
  FK7: { farm: { match: ["韭菜-韭菜黃"] } },
  FK8: { farm: { match: ["芽菜類-黃豆芽"] } },
  FK9: { farm: { match: ["香茅"] } },
  FL1: { farm: { match: ["蕨菜-過貓"] } },
  FL2: { farm: { match: ["萊豆"] } },
  FL3: { farm: { match: ["蠔菇-鮑魚菇"] } },
  FL4: { farm: { match: ["巴西利"] } },
  FL5: { farm: { match: ["甘藍-進口 紫色"] } },
  FL6: { farm: { match: ["藤川七"] } },
  FL7: { farm: { match: ["蕨菜-山蘇"] } },
  FL8: { farm: { match: ["柳松菇"] } },
  FL9: { farm: { match: ["珊瑚菇"], exclude: ["盒裝"] } },
  FM1: { farm: { match: ["草菇"] } },
  FM2: { farm: { match: ["荸薺"], exclude: ["加工"] } },

  /* ── 第四批蔬菜（2026-11 加入）───────────────────────── */
  FM3: { farm: { match: ["芥藍菜-芥藍芽"] } },
  FM4: { farm: { match: ["韭菜-韭菜花"] } },
  FM5: { farm: { match: ["洛神花"] } },
  FM6: { farm: { match: ["茼蒿-山茼蒿"] } },
  FM7: { farm: { match: ["鹹菜"] } },
  FM8: { farm: { match: ["油菜-小松菜"] } },
  FM9: { farm: { match: ["雪里紅"] } },
  FN1: { farm: { match: ["豌豆-豌豆苗", "芽菜類-豌豆芽"] } },
  FN2: { farm: { match: ["蘿蔔乾"] } },
  FN3: { farm: { match: ["落花生-熟"] } },
  FN4: { farm: { match: ["海菜-海帶"] } },
  FN5: { farm: { match: ["醃瓜"] } },
  FN6: { farm: { match: ["甘藍-甘藍芽"] } },
  FN7: { farm: { match: ["蘿蔔-甜菜根"] } },
  FN8: { farm: { match: ["筍片"] } },
  FN9: { farm: { match: ["筍乾"] } },
  FP1: { farm: { match: ["筍絲"] } },
  FP2: { farm: { match: ["薯蕷-樹薯"] } },
  FP3: { farm: { match: ["芽菜類-苜蓿芽"] } },
  FP4: { farm: { match: ["蘿蔔-櫻桃"] } },
  FP5: { farm: { match: ["薑-薑黃"] } },
  FP6: { farm: { match: ["朴菜"] } },
  FP7: { farm: { match: ["晚香玉筍"] } },
  FP8: { farm: { match: ["金針筍"] } },
  FP9: { farm: { match: ["半天筍"] } },
  FQ1: { farm: { match: ["榨菜"] } },
  FQ2: { farm: { match: ["油菜-油菜花"] } },
  FQ3: { farm: { match: ["越瓜"] } },
  FQ4: { farm: { match: ["蓮藕-蓮子"] } },
  FQ5: { farm: { match: ["菊芋"] } },
  FQ6: { farm: { match: ["石蓮花"] } },
  FQ7: { farm: { match: ["黑甜仔菜"] } },
  FQ8: { farm: { match: ["虎豆"] } },
  FQ9: { farm: { match: ["菾菜"] } },
  FR1: { farm: { match: ["花豆"] } },
  FR2: { farm: { match: ["人參葉"] } },
  FR3: { farm: { match: ["金針花"] } },

  /* ── 水果 ───────────────────────────────────────────── */
  GA1: { farm: { match: ["香蕉"], exclude: ["芭蕉", "旦蕉", "越旦"] }, taichung: ["香蕉(內銷)"] },
  GA2: { farm: { match: ["鳳梨-金鑽鳳梨"] }, taichung: ["鳳梨(金鑽17號)", "鳳梨(開英)", "鳳梨(四號)"] },
  GA3: { farm: { match: ["西瓜-大西瓜"] }, taichung: ["西瓜(大粒)"] },
  GA4: { farm: { match: ["木瓜-網室紅肉", "木瓜-一般紅肉"] }, taichung: ["木瓜"] },
  GA5: { farm: { match: ["番石榴"] }, taichung: ["番石榴(珍珠)"] },
  GA6: { farm: { match: ["蘋果"] } },
  GA7: { farm: { match: ["甜橙-柳橙"] }, taichung: ["柳橙"] },
  GA8: { farm: { match: ["椪柑"] }, taichung: ["椪柑"] },
  GA9: { farm: { match: ["茂谷柑"] }, taichung: ["茂谷柑"] },
  GB1: { farm: { match: ["葡萄-巨峰"] } },
  GB2: { farm: { match: ["紅龍果"] }, taichung: ["火龍果(紅肉)", "火龍果(白肉)"] },
  GB3: { farm: { match: ["芒果"], exclude: ["芒果青"] }, taichung: ["芒果(愛文)", "芒果"] },
  GB4: { farm: { match: ["荔枝"] }, taichung: ["荔枝(黑葉)"] },
  GB5: { farm: { match: ["龍眼-十月眼"] } },
  GB6: { farm: { match: ["蓮霧"] }, taichung: ["蓮霧"] },
  GB7: { farm: { match: ["棗子"] }, taichung: ["棗子"] },
  // 「梨」要排掉鳳梨、酪梨、葡萄柚、梨子蒲——基底名稱比對在這一項最容易誤命中。
  GB8: { farm: { match: ["梨-"], exclude: ["鳳梨", "酪梨", "葡萄", "梨子蒲"] }, taichung: ["新興梨", "新世紀梨", "橫山梨"] },
  GB9: { farm: { match: ["柿子-甜柿"] }, taichung: ["甜柿"] },
  GC1: { farm: { match: ["文旦"] }, taichung: ["文旦"] },
  GC2: { farm: { match: ["雜柑-檸檬", "雜柑-無子檸檬"] }, taichung: ["檸檬"] },
  GC3: { farm: { match: ["草莓"], exclude: ["藍莓"] } },
  GC4: { farm: { match: ["洋香瓜"] } },
  GC5: { farm: { match: ["奇異果"] } },
  GC6: { farm: { match: ["酪梨"] } },

  /* ── 第二批水果（2026-11 加入）───────────────────────── */
  // 溫室吊瓜是 144 元/公斤的精品瓜，美濃瓜 30 元——差 4.8 倍，混進來「甜瓜多少錢」
  // 就沒有意義了。
  GC7: { farm: { match: ["甜瓜"], exclude: ["進口", "溫室吊瓜"] } },
  GC8: { farm: { match: ["百香果"] } },
  GC9: { farm: { match: ["釋迦"], exclude: ["鳳梨釋迦"] } },
  GD1: { farm: { match: ["楊桃"] } },
  GD2: { farm: { match: ["葡萄柚"] } },
  // 紅柿與水柿是同一種軟柿（臺中的欄位就叫「紅柿(軟柿)」），合起來才有夠穩的量；
  // 甜柿是 GB9，別跟這個搞混（85 元 vs 26 元）。
  GD3: { farm: { match: ["柿子-紅柿", "柿子-水柿"] }, taichung: ["紅柿(軟柿)"] },
  GD4: { farm: { match: ["桶柑"], exclude: ["進口"] }, taichung: ["桶柑"] },
  GD5: { farm: { match: ["海梨"], exclude: ["進口"] }, taichung: ["海梨柑"] },
  GD6: { farm: { match: ["藍莓"] } },
  // 「蘿蔔-櫻桃」是櫻桃蘿蔔，不是櫻桃——基底名稱不同但關鍵字會命中，一定要排掉。
  GD7: { farm: { match: ["櫻桃"], exclude: ["蘿蔔"] } },

  /* ── 第三批水果（2026-11 加入）───────────────────────── */
  GD8: { farm: { match: ["椰子"], exclude: ["剝殼"] } },
  GD9: { farm: { match: ["甘蔗"] } },
  GE1: { farm: { match: ["木瓜-青木瓜"] } },
  GE2: { farm: { match: ["榴槤"] } },
  GE3: { farm: { match: ["雜柑-桔子"] } },
  GE4: { farm: { match: ["黃金果"] } },
  GE5: { farm: { match: ["柚子-西施柚"] } },
  GE6: { farm: { match: ["雜柑-金棗"] } },
  GE7: { farm: { match: ["蛋黃果"] } },
  GE8: { farm: { match: ["橄欖"] } },
  GE9: { farm: { match: ["紅毛丹"] } },
  // 「番石榴」含「石榴」兩個字，會被誤抓——而且它是 GA5，量差 50 倍
  //（番石榴 101,728 公斤 vs 石榴 1,860 公斤），混進來這一項就整個變成芭樂價。
  GF1: { farm: { match: ["石榴"], exclude: ["番石榴"] } },
  // 同理：「南瓜-栗子」是栗子南瓜，量比真正的栗子多 14 倍。
  GF2: { farm: { match: ["栗子"], exclude: ["南瓜"] } },

  /* ── 第四批水果（2026-11 加入）───────────────────────── */
  GF3: { farm: { match: ["佛利蒙"] } },
  GF4: { farm: { match: ["柿子-柿餅"] } },
  GF5: { farm: { match: ["珍珠柑"] } },
  GF6: { farm: { match: ["龍眼-龍眼乾", "龍眼-龍眼肉"] } },
  GF7: { farm: { match: ["芒果-芒果青"] } },
  GF8: { farm: { match: ["波蘿蜜"] } },
  GF9: { farm: { match: ["豔陽柑"] } },
  GG1: { farm: { match: ["鳳梨-鳳梨花"] } },

  /* ── 漁產 ───────────────────────────────────────────── */
  HA1: { aquatic: { match: ["吳郭魚", "其他吳郭"] }, taichung: ["吳郭魚"] },
  HA2: { aquatic: { match: ["虱目魚"], exclude: ["魚肚", "魚頭"] }, taichung: ["虱目魚"] },
  HA3: { aquatic: { match: ["金目鱸"] }, taichung: ["金目鱸"] },
  HA4: { aquatic: { match: ["珍珠龍膽/龍虎斑"] }, taichung: ["龍虎斑"] },
  HA5: { aquatic: { match: ["午仔魚"] }, taichung: ["午仔魚"] },
  HA6: { aquatic: { match: ["白帶魚"], exclude: ["凍"] } },
  HA7: { aquatic: { match: ["鯖魚"], exclude: ["熟", "凍"] } },
  HA8: { aquatic: { match: ["秋刀"] } },
  HB1: { aquatic: { match: ["旗魚肉"] } },
  HB2: { aquatic: { match: ["鮭魚"], exclude: ["頭", "尾", "凍", "片"] } },
  HB3: { aquatic: { match: ["白蝦"] }, taichung: ["白蝦"] },
  HB4: { aquatic: { match: ["文蛤"] }, taichung: ["文蛤"] },
  HB5: { aquatic: { match: ["牡蠣"] } },
  // 這一項的名字是「透抽」，來源本來卻比對「小卷」——開放資料裡那是兩筆不同的魚貨
  // （透抽 230 元/公斤、4,403 公斤；小卷 183 元/公斤、922 公斤），價格與體型都不一樣。
  // 名字叫透抽就要報透抽的價。小卷不另外開一項：對買菜的人來說那是同一攤的東西。
  HB6: { aquatic: { match: ["透抽"], exclude: ["凍"] } },
  HB7: { aquatic: { match: ["花枝"], exclude: ["凍"] } },
  // 目錄本來就有鬼頭刀，只是一直沒有來源對應（CSV 的 A 組），補上。
  HA9: { aquatic: { match: ["鬼頭刀"], exclude: ["凍", "加工"] } },
  HB8: { aquatic: { match: ["肉魚"], exclude: ["凍"] } },
  HB9: { aquatic: { match: ["黃花"], exclude: ["凍", "加工"] } },
  HC1: { aquatic: { match: ["黑鯧"], exclude: ["凍"] } },
  HC2: { aquatic: { match: ["四破"], exclude: ["凍", "加工"] } },
  // 虱目魚肚本來被 HA2 的 exclude 擋掉（那是為了不讓魚肚混進整尾虱目魚的均價）。
  // 現在它自己是一個品項——魚攤上「虱目魚」跟「虱目魚肚」是分開賣、價差很大的兩樣東西。
  HC4: { aquatic: { match: ["虱目魚肚"] } },

  /* ── 第二批漁產（2026-11 加入）─────────────────────────
   * 一律排除「凍」：冷凍品是另一個價格帶（土魠 350 vs 土魠(凍) 173，差一倍），
   * 混在一起算出來的均價哪一種都不是。
   */
  HC5: { aquatic: { match: ["土魠"], exclude: ["凍", "鯊"] } },
  HC6: { aquatic: { match: ["白鯧"], exclude: ["凍"] } },
  HC7: { aquatic: { match: ["紅目鰱"] } },
  HC8: { aquatic: { match: ["七星鱸"] } },
  HC9: { aquatic: { match: ["草魚"] } },
  HD1: { aquatic: { match: ["大頭鰱"] } },
  HD2: { aquatic: { match: ["烏仔魚"] } },
  HD3: { aquatic: { match: ["香魚"], exclude: ["凍"] } },
  // 「盤仔」是赤鯮的另一個攤商叫法，兩筆合起來才是這個品項當天的全部成交。
  HD4: { aquatic: { match: ["赤宗", "盤仔"] } },
  HD5: { aquatic: { match: ["黃臘鰺"] } },
  // 「馬加鯊」是鯊魚不是馬加，名字很像但價格差四倍（222 vs 50）。
  HD6: { aquatic: { match: ["馬加"], exclude: ["鯊"] } },
  HD7: { aquatic: { match: ["勿仔"], exclude: ["凍"] } },
  HD8: { aquatic: { match: ["魷魚"], exclude: ["凍"] } },
  HD9: { aquatic: { match: ["蝦仁"] } },
  // 「比目魚片」是切片的加工品（169 元），整尾的「比目魚、扁鱈」是 282 元。
  HE1: { aquatic: { match: ["比目魚"], exclude: ["片"] } },

  /* ── 肉類（只有臺中的零售訪價，沒有任何批發來源）────── */
  MA1: { taichung: ["里肌肉"] },
  MA2: { taichung: ["後腿肉"] },
  MA3: { taichung: ["五花肉"] },
  MB1: { taichung: ["牛腱(冷凍牛肉)"] },
  MB2: { taichung: ["腩肉(冷凍牛肉)"] },
  MB3: { taichung: ["腿肉(冷凍牛肉)"] },
  MC4: { taichung: ["肉雞"], poultry: "白肉雞(2.0Kg以上)" },
  MC5: { taichung: ["土雞"] },
  MC6: { taichung: ["鴨子(土番鴨)"] },
  MC7: { taichung: ["仿雞"] },

  /* ── 蛋品 ───────────────────────────────────────────── */
  EA1: { taichung: ["雞蛋"], poultry: "雞蛋(產地價)" },
  EA3: { taichung: ["鴨蛋"] },

  /* ── 糧食（米）───────────────────────────────────────── */
  RA1: { rice: "japt" },
  RA2: { rice: "tsait" },
  RA3: { rice: "sangt" },
  RA4: { rice: "glutrt" },
  RA5: { rice: "glutlt" },
};

/**
 * 糧價那支回的 `CityName` 是內政部的行政區代碼，不是名稱。二十個縣市（沒有金門、連江、
 * 嘉義縣以外的外島）。
 */
export const RICE_CITIES: Record<string, string> = {
  "63000": "臺北市",
  "64000": "高雄市",
  "65000": "新北市",
  "66000": "臺中市",
  "67000": "臺南市",
  "68000": "桃園市",
  "10002": "宜蘭縣",
  "10004": "新竹縣",
  "10005": "苗栗縣",
  "10007": "彰化縣",
  "10008": "南投縣",
  "10009": "雲林縣",
  "10010": "嘉義縣",
  "10013": "屏東縣",
  "10014": "臺東縣",
  "10015": "花蓮縣",
  "10016": "澎湖縣",
  "10017": "基隆市",
  "10018": "新竹市",
  "10020": "嘉義市",
};

export function sourceOf(code: string): SourceRef | undefined {
  return SOURCE_MAP[code];
}

/** 名稱比對。資料裡的名稱是「甘藍-初秋」這種「基底-品種」格式，所以用包含比對，
 *  不是完全相等。 */
export function matchesName(name: string, rule: NameMatch): boolean {
  if (rule.exclude?.some((keyword) => name.includes(keyword))) return false;
  return rule.match.some((keyword) => name.includes(keyword));
}
