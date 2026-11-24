/** 有畫好插畫的品項代碼。素材平放在 `public/freshwise/item-<code>.png`。
 *
 *  這份清單只回答「這個代碼的圖叫什麼檔名」。**沒有列在這裡的品項不會畫任何圖**——
 *  以前會退回分類的通用圖示，結果一排新加的蔬菜長得一模一樣，比留白更難用
 *  （見 item-icon.tsx）。待補的清單用 `npx tsx scripts/freshwise-missing-art.mts`。
 *
 *  以前這裡是「四張圖集各自管一批代碼」的結構，圖集後來拆成單張 PNG，分組就沒有意義了。
 */
export const ITEM_ART_CODES: readonly string[] = [
  "FA1",
  "FA2",
  "FA3",
  "FA4",
  "FA5",
  "FA6",
  "FA7",
  "FA8",
  "FA9",
  "FB1",
  "FB2",
  "FB3",
  "FB4",
  "FB5",
  "FB6",
  "FB7",
  "FB8",
  "FB9",
  "FC2",
  "FC3",
  "FC4",
  "FC5",
  "FC6",
  "FC7",
  "FC8",
  "FC9",
  "FD1",
  "FD2",
  "FD3",
  "FD4",
  "FD5",
  "FD6",
  "FD7",
  "FD8",
  "FD9",
  "FE1",
  "FE2",
  "FE3",
  "FE4",
  "GA1",
  "GA2",
  "GA3",
  "GA4",
  "GA5",
  "GA6",
  "GA7",
  "GA8",
  "GA9",
  "GB1",
  "GB2",
  "GB3",
  "GB4",
  "GB5",
  "GB6",
  "GB7",
  "GB8",
  "GB9",
  "GC1",
  "GC2",
  "GC3",
  "GC4",
  "GC5",
  "GC6",
  "HA1",
  "HA2",
  "HA3",
  "HA4",
  "HA5",
  "HA6",
  "HA7",
  "HA8",
  "HB1",
  "HB2",
  "HB3",
  "HB4",
  "HB5",
  "HB6",
  "HB7",
  "MA1",
  "MA2",
  "MA3",
  "MB1",
  "MB2",
  "MB3",
  "MC4",
  "MC5",
  "MC6",
  "MC7",
  "EA1",
  "EA3",
  "RA1",
  "RA2",
  "RA3",
  "RA4",
  "RA5",
  "FC1",
  "MA4",
  "MA5",
  "MA6",
  "MB4",
  "MC1",
  "MC2",
  "MC3",
  "EA2",
  "EA4",
  "EA5",
  "EA6",
  "FF1",
  "FF2",
  "FF3",
  "FF4",
  "FF5",
  "FF6",
  "FF7",
  "FF8",
  "FF9",
  "FG1",
  "FG2",
  "FG3",
  "FG4",
  "FG5",
  "HA9",
  "HB8",
  "HB9",
  "HC1",
  "HC2",
  "HC4",
];

/** @deprecated 舊的分組結構，只剩測試腳本在用。 */
export const ITEM_ART_GROUPS: readonly { codes: readonly string[] }[] = [{ codes: ITEM_ART_CODES }];

/**
 * 檔名對不上 `item-<code>.png` 的品項。
 *
 * 2026-11 這批插畫是照**農業部開放資料自己的作物代號**出圖的（`item-farm-<作物代號>.png`、
 * 臺中零售欄位則是 `item-retail-<序號>.png`），那組代號跟這個工具的目錄代號是兩回事。
 * 與其把同一張圖複製一份改名（兩份位元組，之後重畫一邊會過期），不如在這裡記一行
 * 「這個品項用哪一張圖」。
 *
 * 一個代號只會對到一張圖；同一張圖可以被多個代號共用（例如紅柿與水柿是同一種軟柿）。
 */
const ART_FILE_ALIAS: Record<string, string> = {
  FH1: "item-farm-FH3.png", // 扁蒲（花蒲，量最大的品種）
  FH2: "item-farm-LN1.png", // 油菜
  FH3: "item-farm-FM1.png", // 菜豆（白色）
  FH4: "item-farm-FU1.png", // 佛手瓜
  FH5: "item-farm-FU2.png", // 龍鬚菜（隼人瓜-瓜苗）
  FH6: "item-farm-LK2.png", // 芥藍菜
  FH7: "item-farm-SN1.png", // 蓮藕
  FH8: "item-farm-SR1.png", // 菱角（生菱角）
  FH9: "item-farm-SL1.png", // 豆薯
  FJ1: "item-farm-FZ1.png", // 花生（生）
  FJ2: "item-farm-MC1.png", // 木耳
  FJ3: "item-farm-MI1.png", // 秀珍菇
  FJ4: "item-farm-MK1.png", // 鴻喜菇
  FJ5: "item-farm-MA1.png", // 洋菇
  FJ6: "item-farm-SE5.png", // 紅蔥頭
  FJ7: "item-farm-SV2.png", // 蘆筍（綠蘆筍）
  FJ8: "item-farm-SI1.png", // 菜心（萵苣莖）
  FJ9: "item-farm-SS0.png", // 大心菜
  FK1: "item-farm-LT3.png", // 水蓮（海菜-水蓮）
  FK2: "item-farm-SM1.png", // 牛蒡
  GC7: "item-farm-V1.png", // 甜瓜（美濃瓜）
  GC8: "item-farm-51.png", // 百香果
  GC9: "item-farm-31.png", // 釋迦
  GD1: "item-farm-M3.png", // 楊桃
  GD2: "item-farm-H4.png", // 葡萄柚（紅肉）
  GD3: "item-farm-Z1.png", // 紅柿
  GD4: "item-retail-02.png", // 桶柑
  GD5: "item-retail-03.png", // 海梨柑
  GD6: "item-farm-469.png", // 藍莓
  GD7: "item-farm-839.png", // 櫻桃
  // 漁產第二批。這些是照漁產品交易行情的魚貨代號出圖的（item-aquatic-<代號>.png）。
  HC5: "item-aquatic-2141.png", // 土魠
  HC6: "item-aquatic-2091.png", // 白鯧
  HC7: "item-aquatic-2051.png", // 紅目鰱
  HC9: "item-aquatic-1023.png", // 草魚
  HD1: "item-aquatic-1024.png", // 大頭鰱
  HD2: "item-aquatic-1051.png", // 烏魚
  HD4: "item-aquatic-2012.png", // 赤鯮
  HD5: "item-aquatic-1181.png", // 紅杉（黃臘鰺）
  HD7: "item-aquatic-2106.png", // 吻仔魚
  HD8: "item-aquatic-2161.png", // 魷魚
  HE1: "item-aquatic-3641.png", // 扁鱈
  HC8: "item-aquatic-1073.png", // 七星鱸
  HD3: "item-aquatic-1191.png", // 香魚
  HD6: "item-aquatic-2142.png", // 馬加
  HD9: "item-aquatic-4016.png", // 蝦仁
  // 第三批蔬果。檔名照農業部作物代號（item-farm-<代號>.png），同樣不複製位元組。
  FK3: "item-farm-SG1.png", // 青蒜
  FK4: "item-farm-LI2.png", // 結球萵苣
  FK5: "item-farm-LQ1.png", // 紅鳳菜
  FK6: "item-farm-LS1.png", // 茴香
  FK7: "item-farm-SF2.png", // 韭黃
  FK8: "item-farm-SX2.png", // 黃豆芽
  FK9: "item-farm-SZ8.png", // 香茅
  FL1: "item-farm-LX1.png", // 過貓
  FL2: "item-farm-FP1.png", // 皇帝豆
  FL3: "item-farm-MF1.png", // 鮑魚菇
  FL4: "item-farm-LV1.png", // 巴西利
  FL5: "item-farm-LA94.png", // 紫甘藍
  FL6: "item-farm-LZ2.png", // 川七
  FL7: "item-farm-LX2.png", // 山蘇
  FL8: "item-farm-MN1.png", // 柳松菇
  FL9: "item-farm-ML1.png", // 珊瑚菇
  FM1: "item-farm-MB1.png", // 草菇
  FM2: "item-farm-SK1.png", // 荸薺
  GD8: "item-farm-11.png", // 椰子
  GD9: "item-farm-61.png", // 甘蔗
  GE1: "item-farm-I4.png", // 青木瓜
  GE2: "item-farm-859.png", // 榴槤
  GE3: "item-farm-F4.png", // 桔子
  GE4: "item-farm-G2.png", // 黃金果
  GE5: "item-farm-H6.png", // 西施柚
  GE6: "item-farm-F2.png", // 金棗
  GE7: "item-farm-G1.png", // 蛋黃果
  GE8: "item-farm-G7.png", // 橄欖
  GE9: "item-farm-87.png", // 紅毛丹
  GF1: "item-farm-849.png", // 石榴
  GF2: "item-farm-G8.png", // 栗子
  // 第四批蔬果。
  FM3: "item-farm-LK3.png", // 芥藍芽
  FM4: "item-farm-SF3.png", // 韭菜花
  FM5: "item-farm-FW2.png", // 洛神花
  FM6: "item-farm-LL2.png", // 山茼蒿
  FM7: "item-farm-OA1.png", // 鹹菜
  FM8: "item-farm-LN2.png", // 小松菜
  FM9: "item-farm-OB1.png", // 雪裡紅
  FN1: "item-farm-FL5.png", // 豌豆苗
  FN2: "item-farm-OD1.png", // 蘿蔔乾
  FN3: "item-farm-FZ2.png", // 熟花生
  FN4: "item-farm-LT2.png", // 海帶
  FN5: "item-farm-OE2.png", // 醃瓜
  FN6: "item-farm-LA6.png", // 甘藍芽
  FN7: "item-farm-SA7.png", // 甜菜根
  FN8: "item-farm-OI3.png", // 筍片
  FN9: "item-farm-OI1.png", // 筍乾
  FP1: "item-farm-OI2.png", // 筍絲
  FP2: "item-farm-SU3.png", // 樹薯
  FP3: "item-farm-SX4.png", // 苜蓿芽
  FP4: "item-farm-SA4.png", // 櫻桃蘿蔔
  FP5: "item-farm-SP5.png", // 薑黃
  FP6: "item-farm-OL1.png", // 朴菜
  FP7: "item-farm-SZ7.png", // 晚香玉筍
  FP8: "item-farm-SZ3.png", // 金針筍
  FP9: "item-farm-SZ1.png", // 半天筍
  FQ1: "item-farm-OC1.png", // 榨菜
  FQ2: "item-farm-LN3.png", // 油菜花
  FQ3: "item-farm-FS1.png", // 越瓜
  FQ4: "item-farm-SN2.png", // 蓮子
  FQ5: "item-farm-SL2.png", // 菊芋
  FQ6: "item-farm-FU3.png", // 石蓮花
  FQ7: "item-farm-LY2.png", // 龍葵
  FQ8: "item-farm-FX2.png", // 虎豆
  FQ9: "item-farm-LU1.png", // 菾菜
  FR1: "item-farm-FX1.png", // 花豆
  FR2: "item-farm-LY4.png", // 人參葉
  FR3: "item-farm-FW1.png", // 金針花
  GF3: "item-farm-C6.png", // 佛利蒙柑
  GF4: "item-farm-Z3.png", // 柿餅
  GF5: "item-farm-C8.png", // 珍珠柑
  GF6: "item-farm-K4.png", // 龍眼乾
  GF7: "item-farm-R8.png", // 芒果青
  GF8: "item-farm-G9.png", // 波羅蜜
  GF9: "item-farm-C7.png", // 豔陽柑
  GG1: "item-farm-B4.png", // 鳳梨花
};

const ART_SET = new Set(ITEM_ART_CODES);

export function itemArtwork(code: string) {
  const alias = ART_FILE_ALIAS[code];
  if (alias) return { file: `/freshwise/${alias}` };
  return ART_SET.has(code) ? { file: `/freshwise/item-${code}.png` } : undefined;
}
