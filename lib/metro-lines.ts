// 全台目前有營運的捷運／輕軌系統真實站點清單，從 TDX v2/Rail/Metro/StationOfLine/{系統代碼} 查回來
// 寫死——路線站序幾乎不會變動，不需要每次都打 API。
//
// 左欄的 key 用「系統名稱」不是嚴格的行政區：捷運路線常常橫跨好幾個縣市（例如桃園機場捷運從台北
// 車站一路經新北市才到桃園市），硬塞成單一縣市反而不準確；系統名稱＋站名前綴（路線代碼＋站碼）
// 已經足夠讓使用者分辨站點所在區域，兩層選單沿用跟火車／公車一樣的 CityStationPicker／
// StationPickerModal，不用為捷運另外做一套 UI。
// 出發站／抵達站可以跨系統選的範圍：北北基桃目前可互通的捷運／輕軌系統，並包含淡海輕軌與
// 台北捷運紅樹林站的轉乘關係。真正哪些站可以轉乘，統一由 METRO_TRANSFER_HUBS 管理；
// 其他系統（台中捷運／高雄捷運／高雄輕軌）維持只能查同系統。
export const METRO_CROSS_CITY_GROUP = ["台北捷運", "新北捷運", "桃園機場捷運", "淡海輕軌"];

// 系統名稱對應 TDX 的 RouteSystemID，查真實票價／站間行車時間（lib/metro-routing.ts）要用
// 這個代碼打 /v2/Rail/Metro/ODFare、/v2/Rail/Metro/S2STravelTime。
export const METRO_SYSTEM_CODE: Record<string, string> = {
  台北捷運: "TRTC",
  新北捷運: "NTMC",
  淡海輕軌: "NTDLRT",
  桃園機場捷運: "TYMC",
  台中捷運: "TMRT",
  高雄捷運: "KRTC",
  高雄輕軌: "KLRT",
};

export const METRO_STATIONS_BY_CITY: Record<string, string[]> = {
  台北捷運: [
    "BL01頂埔", "BL02永寧", "BL03土城", "BL04海山", "BL05亞東醫院", "BL06府中", "BL07板橋",
    "BL08新埔", "BL09江子翠", "BL10龍山寺", "BL11西門", "BL12台北車站", "BL13善導寺",
    "BL14忠孝新生", "BL15忠孝復興", "BL16忠孝敦化", "BL17國父紀念館", "BL18市政府", "BL19永春",
    "BL20後山埤", "BL21昆陽", "BL22南港", "BL23南港展覽館",
    "BR01動物園", "BR02木柵", "BR03萬芳社區", "BR04萬芳醫院", "BR05辛亥", "BR06麟光",
    "BR07六張犁", "BR08科技大樓", "BR09大安", "BR10忠孝復興", "BR11南京復興", "BR12中山國中",
    "BR13松山機場", "BR14大直", "BR15劍南路", "BR16西湖", "BR17港墘", "BR18文德", "BR19內湖",
    "BR20大湖公園", "BR21葫洲", "BR22東湖", "BR23南港軟體園區", "BR24南港展覽館",
    "G01新店", "G02新店區公所", "G03七張", "G03A小碧潭", "G04大坪林", "G05景美", "G06萬隆",
    "G07公館", "G08台電大樓", "G09古亭", "G10中正紀念堂", "G11小南門", "G12西門", "G13北門",
    "G14中山", "G15松江南京", "G16南京復興", "G17台北小巨蛋", "G18南京三民", "G19松山",
    "O01南勢角", "O02景安", "O03永安市場", "O04頂溪", "O05古亭", "O06東門", "O07忠孝新生",
    "O08松江南京", "O09行天宮", "O10中山國小", "O11民權西路", "O12大橋頭", "O13台北橋",
    "O14菜寮", "O15三重", "O16先嗇宮", "O17頭前庄", "O18新莊", "O19輔大", "O20丹鳳",
    "O21迴龍", "O50三重國小", "O51三和國中", "O52徐匯中學", "O53三民高中", "O54蘆洲",
    "R01廣慈/奉天宮", "R02象山", "R03台北101/世貿", "R04信義安和", "R05大安", "R06大安森林公園", "R07東門",
    "R08中正紀念堂", "R09台大醫院", "R10台北車站", "R11中山", "R12雙連", "R13民權西路",
    "R14圓山", "R15劍潭", "R16士林", "R17芝山", "R18明德", "R19石牌", "R20唭哩岸",
    "R21奇岩", "R22北投", "R22A新北投", "R23復興崗", "R24忠義", "R25關渡", "R26竹圍",
    "R27紅樹林", "R28淡水",
  ],
  // 環狀線＋三鶯線，跟台北捷運是不同營運公司（新北大眾捷運股份有限公司），站點集中在
  // 中和／新莊／三峽／鶯歌一帶，跟淡海輕軌所在的淡水區是新北市內相距很遠的兩塊區域，
  // 分開列比較好分辨，不會混在一起。
  新北捷運: [
    "Y07大坪林", "Y08十四張", "Y09秀朗橋", "Y10景平", "Y11景安", "Y12中和", "Y13橋和",
    "Y14中原", "Y15板新", "Y16板橋", "Y17新埔民生", "Y18頭前庄", "Y19幸福", "Y20新北產業園區",
    "LB01頂埔", "LB02媽祖田", "LB03長壽山", "LB04橫溪", "LB05龍埔", "LB06三峽", "LB07台北大學",
    "LB08鶯歌車站", "LB09陶瓷老街", "LB10國華", "LB11永吉公園", "LB12鶯桃福德",
  ],
  淡海輕軌: [
    "V01紅樹林", "V02竿蓁林", "V03淡金鄧公", "V04淡江大學", "V05淡金北新", "V06新市一路",
    "V07淡水行政中心", "V08濱海義山", "V09濱海沙崙", "V10淡海新市鎮", "V11崁頂",
    "V26淡水漁人碼頭", "V27沙崙", "V28台北海洋大學",
  ],
  桃園機場捷運: [
    "A1台北車站", "A2三重站", "A3新北產業園區站", "A4新莊副都心站", "A5泰山站", "A6泰山貴和站",
    "A7體育大學站", "A8長庚醫院站", "A9林口站", "A10山鼻站", "A11坑口站", "A12機場第一航廈站",
    "A13機場第二航廈站", "A14a機場旅館站", "A15大園站", "A16橫山站", "A17領航站",
    "A18高鐵桃園站", "A19桃園體育園區站", "A20興南站", "A21環北站", "A22老街溪站",
  ],
  台中捷運: [
    "G0北屯總站", "G3舊社", "G4松竹", "G5四維國小", "G6文心崇德", "G7文心中清", "G8文華高中",
    "G8a文心櫻花", "G9市政府", "G10水安宮", "G10a文心森林公園", "G11南屯", "G12豐樂公園",
    "G13大慶", "G14九張犁", "G15九德", "G16烏日", "G17高鐵臺中站",
  ],
  高雄捷運: [
    "O1哈瑪星", "O2鹽埕埔", "O4前金", "O5美麗島", "O6信義國小", "O7文化中心", "O8五塊厝",
    "O9苓雅運動園區", "O10衛武營", "O11鳳山西站", "O12鳳山", "O13大東", "O14鳳山國中", "OT1大寮",
    "R3小港", "R4高雄國際機場", "R4A草衙", "R5前鎮高中", "R6凱旋", "R7獅甲", "R8三多商圈",
    "R9中央公園", "R10美麗島", "R11高雄車站", "R12後驛", "R13凹子底", "R14巨蛋", "R15生態園區",
    "R16左營", "R17世運", "R18油廠國小", "R19楠梓科技園區", "R20後勁", "R21都會公園",
    "R22青埔", "R22A橋頭糖廠", "R23橋頭火車站", "R24岡山高醫", "RK1岡山車站",
  ],
  高雄輕軌: [
    "C1籬仔內", "C2凱旋瑞田", "C3前鎮之星", "C4凱旋中華", "C5夢時代", "C6經貿園區", "C7軟體園區",
    "C8高雄展覽館", "C9旅運中心", "C10光榮碼頭", "C11真愛碼頭", "C12駁二大義", "C13駁二蓬萊",
    "C14哈瑪星", "C15壽山公園站", "C16文武聖殿站", "C17鼓山區公所站", "C18鼓山", "C19馬卡道",
    "C20臺鐵美術館", "C21美術館", "C21A內惟藝術中心", "C22聯合醫院", "C23龍華國小", "C24愛河之心",
    "C25新上國小", "C26大順民族", "C27灣仔內(大順鼎山)", "C28高雄高工", "C29樹德家商", "C30科工館",
    "C31聖功醫院", "C32凱旋公園站", "C33衛生局站", "C34五權國小站", "C35凱旋武昌站",
    "C36凱旋二聖站", "C37輕軌機廠站",
  ],
};

/**
 * 明確定義的實體捷運轉乘節點。
 *
 * 每個 Station ID 仍然是獨立站點；只有列在同一個 hub 裡的站，
 * 才允許建立 transfer edge。不要再用「站名相同」自動推導跨系統轉乘。
 */
export interface MetroTransferHub {
  id: string;
  name: string;
  stations: string[];
}

export const METRO_TRANSFER_HUBS: MetroTransferHub[] = [
  // 台北捷運內部轉乘
  { id: "XI_MEN", name: "西門", stations: ["BL11西門", "G12西門"] },
  { id: "TAIPEI_MAIN", name: "台北車站", stations: ["BL12台北車站", "R10台北車站", "A1台北車站"] },
  { id: "ZHONGXIAO_XINSHENG", name: "忠孝新生", stations: ["BL14忠孝新生", "O07忠孝新生"] },
  { id: "ZHONGXIAO_FUXING", name: "忠孝復興", stations: ["BL15忠孝復興", "BR10忠孝復興"] },
  { id: "NANGANG_EXHIBITION", name: "南港展覽館", stations: ["BL23南港展覽館", "BR24南港展覽館"] },
  { id: "DAAN", name: "大安", stations: ["BR09大安", "R05大安"] },
  { id: "NANJING_FUXING", name: "南京復興", stations: ["BR11南京復興", "G16南京復興"] },
  { id: "GUTING", name: "古亭", stations: ["G09古亭", "O05古亭"] },
  { id: "ZHONGZHENG_MEMORIAL", name: "中正紀念堂", stations: ["G10中正紀念堂", "R08中正紀念堂"] },
  { id: "ZHONGSHAN", name: "中山", stations: ["G14中山", "R11中山"] },
  { id: "SONGJIANG_NANJING", name: "松江南京", stations: ["G15松江南京", "O08松江南京"] },
  { id: "DONGMEN", name: "東門", stations: ["O06東門", "R07東門"] },
  { id: "MINQUAN_WEST", name: "民權西路", stations: ["O11民權西路", "R13民權西路"] },

  // 台北捷運 ↔ 新北捷運
  { id: "DAPINGLIN", name: "大坪林", stations: ["G04大坪林", "Y07大坪林"] },
  { id: "JINGAN", name: "景安", stations: ["O02景安", "Y11景安"] },
  { id: "BANQIAO", name: "板橋", stations: ["BL07板橋", "Y16板橋"] },
  { id: "TOUQIANZHUANG", name: "頭前庄", stations: ["O17頭前庄", "Y18頭前庄"] },
  { id: "DINGPU", name: "頂埔", stations: ["BL01頂埔", "LB01頂埔"] },

  // 台北捷運 ↔ 桃園機場捷運
  { id: "SANCHONG", name: "三重", stations: ["O15三重", "A2三重站"] },

  // 新北捷運 ↔ 桃園機場捷運
  { id: "NEW_TAIPEI_INDUSTRIAL", name: "新北產業園區", stations: ["Y20新北產業園區", "A3新北產業園區站"] },

  // 台北捷運 ↔ 淡海輕軌
  { id: "HONGSHULIN", name: "紅樹林", stations: ["R27紅樹林", "V01紅樹林"] },
];

// 跨系統只使用上面的明確轉乘 Hub，不再用「同名站」猜測。
// 例如「三重」與「三重站」、「新北產業園區」與「新北產業園區站」也能正確對應。

// 站名（去掉開頭的路線代碼＋站碼），有同名站就是轉乘點（例如紅樹林同時是台北捷運 R27 跟
// 淡海輕軌... 這裡實際上是新北捷運／桃園機場捷運那幾個系統）。純字串比對，不用打 TDX，
// 前端（首頁／常用行程）就能直接顯示「需在◯◯轉乘」，不用等後端算完整條路徑。
/** 站點顯示字串（例如「BL07板橋」）屬於哪個捷運系統。 */
export function metroSystemOf(station: string): string | undefined {
  return Object.keys(METRO_STATIONS_BY_CITY).find((system) => METRO_STATIONS_BY_CITY[system].includes(station));
}

export function findCrossSystemTransferStation(originSystem: string, destSystem: string): string | undefined {
  if (originSystem === destSystem) return undefined;

  const hub = METRO_TRANSFER_HUBS.find((candidate) => {
    const systems = new Set(
      candidate.stations
        .map((station) => metroSystemOf(station))
        .filter((system): system is string => Boolean(system)),
    );

    return systems.has(originSystem) && systems.has(destSystem);
  });

  return hub?.name;
}