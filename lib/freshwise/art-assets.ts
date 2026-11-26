/** 有畫好插畫的品項代碼。素材平放在 `public/freshwise/item-<code>.webp`。
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
 * 檔名對不上 `item-<code>.webp` 的品項。
 *
 * 2026-11 這批插畫是照**農業部開放資料自己的作物代號**出圖的（`item-farm-<作物代號>.webp`、
 * 臺中零售欄位則是 `item-retail-<序號>.webp`），那組代號跟這個工具的目錄代號是兩回事。
 * 與其把同一張圖複製一份改名（兩份位元組，之後重畫一邊會過期），不如在這裡記一行
 * 「這個品項用哪一張圖」。
 *
 * 一個代號只會對到一張圖；同一張圖可以被多個代號共用（例如紅柿與水柿是同一種軟柿）。
 */
const ART_FILE_ALIAS: Record<string, string> = {
  FH1: "item-farm-FH3.webp", // 扁蒲（花蒲，量最大的品種）
  FH2: "item-farm-LN1.webp", // 油菜
  FH3: "item-farm-FM1.webp", // 菜豆（白色）
  FH4: "item-farm-FU1.webp", // 佛手瓜
  FH5: "item-farm-FU2.webp", // 龍鬚菜（隼人瓜-瓜苗）
  FH6: "item-farm-LK2.webp", // 芥藍菜
  FH7: "item-farm-SN1.webp", // 蓮藕
  FH8: "item-farm-SR1.webp", // 菱角（生菱角）
  FH9: "item-farm-SL1.webp", // 豆薯
  FJ1: "item-farm-FZ1.webp", // 花生（生）
  FJ2: "item-farm-MC1.webp", // 木耳
  FJ3: "item-farm-MI1.webp", // 秀珍菇
  FJ4: "item-farm-MK1.webp", // 鴻喜菇
  FJ5: "item-farm-MA1.webp", // 洋菇
  FJ6: "item-farm-SE5.webp", // 紅蔥頭
  FJ7: "item-farm-SV2.webp", // 蘆筍（綠蘆筍）
  FJ8: "item-farm-SI1.webp", // 菜心（萵苣莖）
  FJ9: "item-farm-SS0.webp", // 大心菜
  FK1: "item-farm-LT3.webp", // 水蓮（海菜-水蓮）
  FK2: "item-farm-SM1.webp", // 牛蒡
  GC7: "item-farm-V1.webp", // 甜瓜（美濃瓜）
  GC8: "item-farm-51.webp", // 百香果
  GC9: "item-farm-31.webp", // 釋迦
  GD1: "item-farm-M3.webp", // 楊桃
  GD2: "item-farm-H4.webp", // 葡萄柚（紅肉）
  GD3: "item-farm-Z1.webp", // 紅柿
  GD4: "item-retail-02.webp", // 桶柑
  GD5: "item-retail-03.webp", // 海梨柑
  GD6: "item-farm-469.webp", // 藍莓
  GD7: "item-farm-839.webp", // 櫻桃
  // 漁產第二批。這些是照漁產品交易行情的魚貨代號出圖的（item-aquatic-<代號>.webp）。
  HC5: "item-aquatic-2141.webp", // 土魠
  HC6: "item-aquatic-2091.webp", // 白鯧
  HC7: "item-aquatic-2051.webp", // 紅目鰱
  HC9: "item-aquatic-1023.webp", // 草魚
  HD1: "item-aquatic-1024.webp", // 大頭鰱
  HD2: "item-aquatic-1051.webp", // 烏魚
  HD4: "item-aquatic-2012.webp", // 赤鯮
  HD5: "item-aquatic-1181.webp", // 紅杉（黃臘鰺）
  HD7: "item-aquatic-2106.webp", // 吻仔魚
  HD8: "item-aquatic-2161.webp", // 魷魚
  HE1: "item-aquatic-3641.webp", // 扁鱈
  HC8: "item-aquatic-1073.webp", // 七星鱸
  HD3: "item-aquatic-1191.webp", // 香魚
  HD6: "item-aquatic-2142.webp", // 馬加
  HD9: "item-aquatic-4016.webp", // 蝦仁
  // 第三批蔬果。檔名照農業部作物代號（item-farm-<代號>.webp），同樣不複製位元組。
  FK3: "item-farm-SG1.webp", // 青蒜
  FK4: "item-farm-LI2.webp", // 結球萵苣
  FK5: "item-farm-LQ1.webp", // 紅鳳菜
  FK6: "item-farm-LS1.webp", // 茴香
  FK7: "item-farm-SF2.webp", // 韭黃
  FK8: "item-farm-SX2.webp", // 黃豆芽
  FK9: "item-farm-SZ8.webp", // 香茅
  FL1: "item-farm-LX1.webp", // 過貓
  FL2: "item-farm-FP1.webp", // 皇帝豆
  FL3: "item-farm-MF1.webp", // 鮑魚菇
  FL4: "item-farm-LV1.webp", // 巴西利
  FL5: "item-farm-LA94.webp", // 紫甘藍
  FL6: "item-farm-LZ2.webp", // 川七
  FL7: "item-farm-LX2.webp", // 山蘇
  FL8: "item-farm-MN1.webp", // 柳松菇
  FL9: "item-farm-ML1.webp", // 珊瑚菇
  FM1: "item-farm-MB1.webp", // 草菇
  FM2: "item-farm-SK1.webp", // 荸薺
  GD8: "item-farm-11.webp", // 椰子
  GD9: "item-farm-61.webp", // 甘蔗
  GE1: "item-farm-I4.webp", // 青木瓜
  GE2: "item-farm-859.webp", // 榴槤
  GE3: "item-farm-F4.webp", // 桔子
  GE4: "item-farm-G2.webp", // 黃金果
  GE5: "item-farm-H6.webp", // 西施柚
  GE6: "item-farm-F2.webp", // 金棗
  GE7: "item-farm-G1.webp", // 蛋黃果
  GE8: "item-farm-G7.webp", // 橄欖
  GE9: "item-farm-87.webp", // 紅毛丹
  GF1: "item-farm-849.webp", // 石榴
  GF2: "item-farm-G8.webp", // 栗子
  // 第四批蔬果。
  FM3: "item-farm-LK3.webp", // 芥藍芽
  FM4: "item-farm-SF3.webp", // 韭菜花
  FM5: "item-farm-FW2.webp", // 洛神花
  FM6: "item-farm-LL2.webp", // 山茼蒿
  FM7: "item-farm-OA1.webp", // 鹹菜
  FM8: "item-farm-LN2.webp", // 小松菜
  FM9: "item-farm-OB1.webp", // 雪裡紅
  FN1: "item-farm-FL5.webp", // 豌豆苗
  FN2: "item-farm-OD1.webp", // 蘿蔔乾
  FN3: "item-farm-FZ2.webp", // 熟花生
  FN4: "item-farm-LT2.webp", // 海帶
  FN5: "item-farm-OE2.webp", // 醃瓜
  FN6: "item-farm-LA6.webp", // 甘藍芽
  FN7: "item-farm-SA7.webp", // 甜菜根
  FN8: "item-farm-OI3.webp", // 筍片
  FN9: "item-farm-OI1.webp", // 筍乾
  FP1: "item-farm-OI2.webp", // 筍絲
  FP2: "item-farm-SU3.webp", // 樹薯
  FP3: "item-farm-SX4.webp", // 苜蓿芽
  FP4: "item-farm-SA4.webp", // 櫻桃蘿蔔
  FP5: "item-farm-SP5.webp", // 薑黃
  FP6: "item-farm-OL1.webp", // 朴菜
  FP7: "item-farm-SZ7.webp", // 晚香玉筍
  FP8: "item-farm-SZ3.webp", // 金針筍
  FP9: "item-farm-SZ1.webp", // 半天筍
  FQ1: "item-farm-OC1.webp", // 榨菜
  FQ2: "item-farm-LN3.webp", // 油菜花
  FQ3: "item-farm-FS1.webp", // 越瓜
  FQ4: "item-farm-SN2.webp", // 蓮子
  FQ5: "item-farm-SL2.webp", // 菊芋
  FQ6: "item-farm-FU3.webp", // 石蓮花
  FQ7: "item-farm-LY2.webp", // 龍葵
  FQ8: "item-farm-FX2.webp", // 虎豆
  FQ9: "item-farm-LU1.webp", // 菾菜
  FR1: "item-farm-FX1.webp", // 花豆
  FR2: "item-farm-LY4.webp", // 人參葉
  FR3: "item-farm-FW1.webp", // 金針花
  GF3: "item-farm-C6.webp", // 佛利蒙柑
  GF4: "item-farm-Z3.webp", // 柿餅
  GF5: "item-farm-C8.webp", // 珍珠柑
  GF6: "item-farm-K4.webp", // 龍眼乾
  GF7: "item-farm-R8.webp", // 芒果青
  GF8: "item-farm-G9.webp", // 波羅蜜
  GF9: "item-farm-C7.webp", // 豔陽柑
  GG1: "item-farm-B4.webp", // 鳳梨花
};

const ART_SET = new Set(ITEM_ART_CODES);

export function itemArtwork(code: string) {
  const alias = ART_FILE_ALIAS[code];
  if (alias) return { file: `/freshwise/${alias}` };
  return ART_SET.has(code) ? { file: `/freshwise/item-${code}.webp` } : undefined;
}
