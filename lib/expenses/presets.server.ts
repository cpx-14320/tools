import { MongoServerError, ObjectId } from "mongodb";
import { getDb } from "../mongodb";
import { PRESET_ACCOUNTS, PRESET_EXPENSE_CATEGORIES, PRESET_INCOME_CATEGORIES, expenseCategoryIcon, type PresetCategorySeed } from "./presets";
import type { CategoryKind } from "./categories";

/** 記錄「這個使用者的記帳本預設資料已經建過了」，順便搭兩個旗標判斷首頁的示範資料
 *  提示該不該出現（見下面的 shouldShowDemoDataNotice）。
 *
 *  不用「分類數量是 0 就建」來判斷：使用者可能是刻意把預設分類一個一個刪光的，那樣每次
 *  進頁面都會被重新建回來，等於刪不掉。用一筆獨立的標記文件記下「建過了」，之後不管使用者
 *  怎麼刪都不會再自動補。這筆標記不在「清除全部資料」的清除清單裡，所以清除之後也不會
 *  重新長出一份預設資料（預設資料本身也因為 isPreset 標記而不會被清掉）。 */
interface PresetMetaDoc {
  _id: ObjectId;
  userId: ObjectId;
  presetsSeededAt: Date;
  /** 使用者按過「清除所有消費紀錄」或「清除所有資料」——不管清的是哪個範圍，都代表
   *  這個人已經在認真打理自己的帳本，不該再被提醒「這是示範資料」。 */
  hasClearedData?: boolean;
  /** 使用者自己建過至少一筆交易／預算／存錢目標（手動新增、CSV 匯入、AI 記帳寫入都算，
   *  見 markHasOwnData 的呼叫端）。**刻意不會因為後來刪掉而重設回 false**——「新增過
   *  又刪掉」仍然代表這個人已經操作過真正的功能，不是還沒碰過的新帳號。 */
  hasOwnData?: boolean;
}

function metaCollection() {
  return getDb().then((db) => db.collection<PresetMetaDoc>("expenses.meta"));
}

/** 標記「清過資料」。reset route 不分 scope（只清紀錄／連設定一起清）都算，兩種都是
 *  使用者自己主動做的清理動作。 */
export async function markDataCleared(userId: ObjectId): Promise<void> {
  const meta = await metaCollection();
  await meta.updateOne({ userId }, { $set: { hasClearedData: true } }, { upsert: true });
}

/** 標記「自己建過真正的資料」。呼叫點刻意只選**使用者明確做了一個記帳動作**的那幾個
 *  函式（手動新增交易、CSV／AI 匯入交易、設定預算、新增存錢目標），不包含分類／帳戶
 *  這類結構性設定——建一個分類不代表「已經在用」，記下第一筆帳才算。 */
export async function markHasOwnData(userId: ObjectId): Promise<void> {
  const meta = await metaCollection();
  await meta.updateOne({ userId }, { $set: { hasOwnData: true } }, { upsert: true });
}

/** 首頁那個「目前是示範資料」的提示要不要出現：鋪過示範資料、使用者還沒清過、也還沒
 *  自己動手記過帳，三個條件同時成立才出現。沒有另外存一個「使用者關掉過提示」的旗標
 *  ——只要這三個條件還成立，代表帳本裡還是那份系統鋪的假資料，每次進首頁都該提醒，
 *  不是關掉一次就永遠不再講。 */
export async function shouldShowDemoDataNotice(userId: ObjectId): Promise<boolean> {
  const meta = await metaCollection();
  const doc = await meta.findOne({ userId });
  return !!doc?.presetsSeededAt && !doc.hasClearedData && !doc.hasOwnData;
}

/** 新帳號第一次進記帳本時，把預設的分類、帳戶類型、帳戶一次建好。
 *
 *  只會跑一次（靠 expenses.meta 的標記判斷），而且是「盡力而為」——這支失敗不該擋住頁面
 *  渲染，呼叫端（layout）會把錯誤吞掉。所有建立出來的文件都帶 isPreset: true，讓
 *  「清除全部資料」略過它們。 */
export async function seedExpensesPresets(userId: ObjectId): Promise<void> {
  const meta = await metaCollection();
  // upsert 當成「只做一次」的閘門：第一個進來的請求才會拿到 upsertedId，第二個會因為
  // 文件已存在而拿到 null，不會建出兩份預設資料。
  //
  // **這道閘門靠的是 expenses.meta 上 userId 的 unique index**（見 lib/mongodb.ts）。
  // 沒有那個索引的話 upsert 擋不住併發：兩個請求可以都判定「找不到」然後各插一筆、
  // 各自拿到 upsertedId，整份預設資料就建兩遍。新帳號第一次進記帳本剛好最容易併發
  // （layout 與 page 平行算繪，底部導覽列五個連結又各自被 prefetch）。
  //
  // 有索引之後，輸掉的那一邊會收到 E11000（重複鍵）。那不是錯誤，是「別人已經建過了」，
  // 所以吞掉直接 return——往上拋會讓那個平行的請求整個 500。
  let result;
  try {
    result = await meta.updateOne({ userId }, { $setOnInsert: { userId, presetsSeededAt: new Date() } }, { upsert: true });
  } catch (error) {
    if (error instanceof MongoServerError && error.code === 11000) return;
    throw error;
  }
  if (!result.upsertedId) return;

  const db = await getDb();
  const now = new Date();

  // ── 分類（含子分類）──────────────────────────────────────────────────────
  // 父分類跟子分類一起組好再一次 insertMany：子分類的 parentId 要指向父分類，所以父的
  // _id 先自己產生（new ObjectId()），不用等資料庫回傳。order 直接用陣列索引，跟畫面上
  // 想要的排列順序一致。
  const categoryDocs: Record<string, unknown>[] = [];
  const pushCategories = (seeds: PresetCategorySeed[], kind: CategoryKind) => {
    seeds.forEach((seed, index) => {
      const parentId = new ObjectId();
      categoryDocs.push({
        _id: parentId,
        userId,
        name: seed.name,
        icon: seed.icon,
        color: seed.color,
        kind,
        parentId: null,
        order: index,
        createdAt: now,
        isPreset: true,
      });
      seed.children?.forEach((childName, childIndex) => {
        categoryDocs.push({
          _id: new ObjectId(),
          userId,
          name: childName,
          // 圖示跟顏色都沿用父分類——子分類不會有自己的一組（見 categories.server.ts 的
          // createCategory，使用者自己新增時也是直接複製父分類的）。
          icon: seed.icon,
          color: seed.color,
          kind,
          parentId,
          order: childIndex,
          createdAt: now,
          isPreset: true,
        });
      });
    });
  };
  pushCategories(PRESET_EXPENSE_CATEGORIES, "支出");
  pushCategories(PRESET_INCOME_CATEGORIES, "收入");
  if (categoryDocs.length > 0) await db.collection("expenses.categories").insertMany(categoryDocs);

  // ── 帳戶類型（＋部分類型配一個同名帳戶）────────────────────────────────
  // 資產、負債兩邊的常見類型都先建好，省得每個人都要自己補一輪。只有 withAccount 的
  // 那幾個（現金錢包、銀行帳戶）會順便建一個期初餘額 0 的同名帳戶，使用者一進資產頁
  // 就有現成帳戶可以掛交易；其餘的只建類型，要用的時候再自己開帳戶。
  //
  // order 要在「同一個 kind 裡面」從 0 開始數（listAccountTypes 是 sort({ kind, order })），
  // 直接用整個陣列的 index 會讓負債那幾個的 order 從 5 起跳，之後重排時對不起來。
  const accountTypeDocs: Record<string, unknown>[] = [];
  const accountDocs: Record<string, unknown>[] = [];
  const orderByKind: Record<string, number> = {};
  PRESET_ACCOUNTS.forEach((seed) => {
    const typeId = new ObjectId();
    const order = orderByKind[seed.kind] ?? 0;
    orderByKind[seed.kind] = order + 1;
    accountTypeDocs.push({
      _id: typeId,
      userId,
      name: seed.name,
      icon: seed.icon,
      kind: seed.kind,
      color: seed.color,
      order,
      createdAt: now,
      isPreset: true,
    });
    if (!seed.withAccount) return;
    accountDocs.push({
      _id: new ObjectId(),
      userId,
      name: seed.name,
      accountTypeId: typeId,
      openingBalance: 0,
      createdAt: now,
      isPreset: true,
    });
  });
  if (accountTypeDocs.length > 0) await db.collection("expenses.accountTypes").insertMany(accountTypeDocs);
  if (accountDocs.length > 0) await db.collection("expenses.accounts").insertMany(accountDocs);

  await seedDemoTransactions(db, userId, categoryDocs, accountDocs, now);
}

/** 每個月都會發生的那幾筆示範資料。`day` 是當月第幾天，金額會依月份小幅浮動（見
 *  `varied`），不要每個月都一模一樣——整年十二個月長得一樣，報表的趨勢圖會是一條直線，
 *  使用者看不出那些圖會動。 */
const MONTHLY_SEEDS: { day: number; category: string; amount: number; note: string; account: "cash" | "bank" }[] = [
  { day: 1, category: "房租", amount: 15000, note: "", account: "bank" },
  { day: 3, category: "行動電話", amount: 599, note: "", account: "bank" },
  { day: 5, category: "月薪", amount: 52000, note: "", account: "bank" },
  { day: 6, category: "服務訂閱", amount: 390, note: "串流月費", account: "bank" },
  { day: 8, category: "早餐", amount: 55, note: "豆漿蛋餅", account: "cash" },
  { day: 9, category: "定期票", amount: 1280, note: "月票", account: "bank" },
  { day: 12, category: "午餐", amount: 125, note: "便當", account: "cash" },
  { day: 14, category: "手搖飲", amount: 68, note: "", account: "cash" },
  { day: 17, category: "日用品", amount: 342, note: "衛生紙、洗髮精", account: "bank" },
  { day: 21, category: "晚餐", amount: 268, note: "跟同事吃飯", account: "cash" },
  { day: 24, category: "電費", amount: 1180, note: "", account: "bank" },
  { day: 27, category: "甜食", amount: 85, note: "", account: "cash" },
];

/** 一年只來幾次的那些。`month` 是 1–12。擺進來是為了讓報表不要每個月都一個樣：
 *  年終在一月、所得稅在五月，年度對照表才看得出「某些月份就是特別多」。 */
const YEARLY_SEEDS: { month: number; day: number; category: string; amount: number; note: string; account: "cash" | "bank" }[] = [
  { month: 1, day: 20, category: "年終", amount: 86000, note: "", account: "bank" },
  { month: 2, day: 14, category: "電影", amount: 760, note: "", account: "cash" },
  { month: 3, day: 18, category: "上衣", amount: 1280, note: "換季買的", account: "bank" },
  { month: 4, day: 11, category: "加油費", amount: 1050, note: "", account: "cash" },
  { month: 5, day: 25, category: "所得稅", amount: 18600, note: "", account: "bank" },
  { month: 6, day: 15, category: "獎金", amount: 12000, note: "端午獎金", account: "bank" },
  { month: 7, day: 9, category: "線上課程", amount: 2400, note: "", account: "bank" },
  { month: 8, day: 22, category: "3C電器", amount: 8900, note: "換鍵盤跟螢幕", account: "bank" },
  { month: 9, day: 6, category: "利息", amount: 213, note: "活存利息", account: "bank" },
  { month: 10, day: 19, category: "高鐵", amount: 1490, note: "回老家", account: "bank" },
  { month: 11, day: 28, category: "鞋子", amount: 2180, note: "", account: "bank" },
  { month: 12, day: 24, category: "獎金", amount: 9000, note: "聖誕獎金", account: "bank" },
];

/** 每個月各分類的預算。只設最常花、而且月月都有的那幾個主分類——預算頁一次列出十七個
 *  分類要使用者自己填，多數人會直接跳過，有幾個現成的才看得出那張卡在幹嘛。 */
const BUDGET_SEEDS: { category: string; amount: number }[] = [
  { category: "飲食", amount: 8000 },
  { category: "飲料", amount: 1200 },
  { category: "交通", amount: 2000 },
  { category: "住家", amount: 3500 },
  { category: "日用品", amount: 1500 },
  { category: "服務訂閱", amount: 600 },
];

/** 示範用的存錢目標——首頁「存錢目標」那個區塊跟設定頁的「存錢目標」入口都是空的話，
 *  使用者根本不會知道記帳本裡有這個功能（它不像分類、預算那樣是進首頁就會看到的東西）。
 *  三筆刻意涵蓋三種常見狀態：有期限（看得到試算）、已經達成（看得到「已達成」徽章）、
 *  沒有期限（開放式存錢）。icon 都是 EXPENSE_ICON_OPTIONS 裡挑得到的圖，之後在編輯彈窗
 *  打開也能正常對應選到那一張，不是一個使用者挑不到的孤兒路徑。
 *
 *  都是手動記錄模式（不綁帳戶）：示範資料本來就不是真的錢，綁一個帳戶反而會讓人誤以為
 *  資產總表那几個帳戶裡有一筆錢是「準備拿去旅遊」而被特別圈起來。 */
const GOAL_SEEDS: { name: string; icon: string; targetAmount: number; currentAmount: number; monthsFromNow?: number }[] = [
  { name: "旅遊基金", icon: expenseCategoryIcon("flight-ticket"), targetAmount: 50000, currentAmount: 21500, monthsFromNow: 6 },
  { name: "新手機", icon: expenseCategoryIcon("electronics"), targetAmount: 30000, currentAmount: 30000 },
  { name: "緊急備用金", icon: expenseCategoryIcon("bill"), targetAmount: 100000, currentAmount: 42000 },
];

/** 新帳號的示範資料——讓第一次打開的人看到的是一份「長得像在用」的帳本，而不是一整排
 *  寫著「還沒有任何資料」的空卡。
 *
 *  **為什麼要鋪滿三年（去年、今年、明年）**：報表頁有「支出年度對照」，只鋪近兩個月的話
 *  那張表兩欄都是 0，使用者永遠不會知道有這個功能；而且註冊的時間點不固定，一月註冊的人
 *  如果只鋪「往前兩個月」，今年的圖表幾乎整年空白。鋪滿前後各一年，不管什麼時候註冊，
 *  月份切換、趨勢圖、年度對照一打開就有東西可看。
 *
 *  **收入跟預算也要有**：首頁的「收入來源」「預算支出」兩張卡本來一進來就是空的——有
 *  支出卻沒有收入，等於示範了一份只會扣錢的帳本。現在每個月都有月薪，另外鋪了年終、
 *  獎金、利息，預算也先設好六個最常花的分類。
 *
 *  刻意**不**帶 isPreset：示範資料就是要被清掉的。使用者想認真記帳時，設定頁的
 *  「清除所有消費紀錄」會把這些連同轉帳一起刪乾淨，而分類、帳戶、預算那些設定都留著
 *  （見 app/api/expenses/reset/route.ts 的 RECORD_COLLECTIONS）。
 *
 *  金額刻意抓得零碎（185、1,250 這種），不要用 100、500 這種整數——整數看起來就是
 *  假資料，零碎的數字才像真的在記帳，使用者也才看得出報表那些百分比是會動的。 */
async function seedDemoTransactions(
  db: Awaited<ReturnType<typeof getDb>>,
  userId: ObjectId,
  categoryDocs: Record<string, unknown>[],
  accountDocs: Record<string, unknown>[],
  now: Date,
): Promise<void> {
  /** 用名稱找剛建好的那筆分類／帳戶的 _id。找不到就跳過那一筆，不要讓示範資料擋住流程。 */
  const idOf = (docs: Record<string, unknown>[], name: string) => docs.find((d) => d.name === name)?._id as ObjectId | undefined;
  const cash = idOf(accountDocs, "現金錢包");
  const bank = idOf(accountDocs, "銀行帳戶");
  const accountOf = (key: "cash" | "bank") => (key === "cash" ? cash : bank);

  // 今年 ＋ 往前兩年。**不鋪到明年**：帳本是記已經花掉的錢，月份往前切看到未來的帳
  // 會讓人以為資料錯了。往前三年則剛好餵得飽報表——年度對照有兩個可比的年份、趨勢圖的
  // 近 24 個月也不會有空段。
  const thisYear = now.getFullYear();
  const years = [thisYear - 2, thisYear - 1, thisYear];
  const iso = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

  /** 金額依「第幾個月」小幅浮動（±12% 以內），但同一個帳號每次算出來都一樣——用的是
   *  月份本身當種子，不是亂數，所以之後要重現某個畫面不會每次都不同。 */
  const varied = (amount: number, monthIndex: number, salt: number) => {
    const wave = Math.sin(monthIndex * 1.7 + salt) * 0.12;
    return Math.max(1, Math.round(amount * (1 + wave)));
  };

  const txDocs: Record<string, unknown>[] = [];
  const transferDocs: Record<string, unknown>[] = [];

  years.forEach((year, yearIndex) => {
    for (let month = 1; month <= 12; month++) {
      const monthIndex = yearIndex * 12 + month;

      for (const [i, seed] of MONTHLY_SEEDS.entries()) {
        const categoryId = idOf(categoryDocs, seed.category);
        if (!categoryId) continue;
        txDocs.push({
          _id: new ObjectId(),
          userId,
          categoryId,
          accountId: accountOf(seed.account),
          amount: varied(seed.amount, monthIndex, i),
          date: iso(year, month, seed.day),
          note: seed.note || undefined,
          createdAt: now,
        });
      }

      for (const seed of YEARLY_SEEDS.filter((s) => s.month === month)) {
        const categoryId = idOf(categoryDocs, seed.category);
        if (!categoryId) continue;
        txDocs.push({
          _id: new ObjectId(),
          userId,
          categoryId,
          accountId: accountOf(seed.account),
          amount: varied(seed.amount, monthIndex, seed.day),
          date: iso(year, month, seed.day),
          note: seed.note || undefined,
          createdAt: now,
        });
      }

      // 每季一筆「從銀行領現金」：沒有轉帳的話資產總表那一區一開始是空的，使用者不會
      // 知道那裡是做什麼的；每個月都來一筆又太吵。
      if (cash && bank && month % 3 === 1) {
        transferDocs.push({
          _id: new ObjectId(),
          userId,
          fromAccountId: bank,
          toAccountId: cash,
          amount: 3000,
          date: iso(year, month, 10),
          note: "領現金",
          createdAt: now,
        });
      }
    }
  });

  if (txDocs.length > 0) await db.collection("expenses.transactions").insertMany(txDocs);
  if (transferDocs.length > 0) await db.collection("expenses.transfers").insertMany(transferDocs);

  // 預算規則：從最早那一年的一月起生效，所以不管使用者把月份切到哪一年都看得到預算。
  // 「從某個月起每月多少」只要一筆，之後的月份會沿用（見 lib/expenses/budgets.ts）。
  const budgetDocs = BUDGET_SEEDS.flatMap((seed) => {
    const categoryId = idOf(categoryDocs, seed.category);
    if (!categoryId) return [];
    return [
      {
        _id: new ObjectId(),
        userId,
        categoryId,
        effectiveFrom: `${years[0]}-01`,
        amount: seed.amount,
        createdAt: now,
      },
    ];
  });
  if (budgetDocs.length > 0) await db.collection("expenses.budgets").insertMany(budgetDocs);

  // 存錢目標：跟交易、預算不一樣的是這幾筆完全不需要分類／帳戶才能建，不用查 idOf。
  const goalDocs = GOAL_SEEDS.map((seed) => ({
    _id: new ObjectId(),
    userId,
    name: seed.name,
    icon: seed.icon,
    targetAmount: seed.targetAmount,
    currentAmount: seed.currentAmount,
    startDate: iso(years[0], 1, 1),
    ...(seed.monthsFromNow ? { targetDate: isoMonthsFromNow(now, seed.monthsFromNow) } : {}),
    createdAt: now,
  }));
  await db.collection("expenses.goals").insertMany(goalDocs);
}

/** 從 `base` 這個時間點往後推 `months`個月，算成 `YYYY-MM-DD`（取當天的日）。
 *  示範目標的「還差幾個月到期」要看起來像「現在開始算」，不管帳號是什麼時候註冊的都一樣
 *  新鮮，所以用建立時間當基準，不是寫死某個日期。 */
function isoMonthsFromNow(base: Date, months: number): string {
  const d = new Date(base.getFullYear(), base.getMonth() + months, base.getDate());
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
