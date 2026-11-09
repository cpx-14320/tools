import { MongoServerError, ObjectId } from "mongodb";
import { getDb } from "../mongodb";
import { PRESET_ACCOUNTS, PRESET_EXPENSE_CATEGORIES, PRESET_INCOME_CATEGORIES, type PresetCategorySeed } from "./presets";
import type { CategoryKind } from "./categories";

/** 記錄「這個使用者的記帳本預設資料已經建過了」。
 *
 *  不用「分類數量是 0 就建」來判斷：使用者可能是刻意把預設分類一個一個刪光的，那樣每次
 *  進頁面都會被重新建回來，等於刪不掉。用一筆獨立的標記文件記下「建過了」，之後不管使用者
 *  怎麼刪都不會再自動補。這筆標記不在「清除全部資料」的清除清單裡，所以清除之後也不會
 *  重新長出一份預設資料（預設資料本身也因為 isPreset 標記而不會被清掉）。 */
interface PresetMetaDoc {
  _id: ObjectId;
  userId: ObjectId;
  presetsSeededAt: Date;
}

function metaCollection() {
  return getDb().then((db) => db.collection<PresetMetaDoc>("expenses.meta"));
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

/** 新帳號的示範資料——近兩個月的幾筆收支，讓第一次打開的人看到的是一份「長得像在用」的
 *  帳本，而不是四張寫著「還沒有任何資料」的空卡。
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

  /** 今天往前第 n 天。示範資料跟著「現在」走，不是寫死日期——不然幾個月後新註冊的人
   *  看到的會是一份一年前的帳本，報表上近六個月全是空的。 */
  const dayBefore = (n: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() - n);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  const seeds: { daysAgo: number; category: string; amount: number; note: string; account?: ObjectId }[] = [
    { daysAgo: 0, category: "早餐", amount: 55, note: "豆漿蛋餅", account: cash },
    { daysAgo: 0, category: "大眾交通", amount: 32, note: "捷運", account: cash },
    { daysAgo: 1, category: "午餐", amount: 125, note: "便當", account: cash },
    { daysAgo: 1, category: "零食", amount: 68, note: "手搖飲", account: cash },
    { daysAgo: 2, category: "日用品", amount: 342, note: "衛生紙、洗髮精", account: bank },
    { daysAgo: 3, category: "晚餐", amount: 268, note: "跟同事吃飯", account: cash },
    { daysAgo: 5, category: "服務訂閱", amount: 390, note: "串流月費", account: bank },
    { daysAgo: 8, category: "衣服", amount: 1280, note: "換季買的外套", account: bank },
    { daysAgo: 12, category: "醫療", amount: 450, note: "看牙", account: bank },
    { daysAgo: 15, category: "電話費", amount: 599, note: "", account: bank },
    { daysAgo: 18, category: "娛樂", amount: 760, note: "看電影", account: cash },
    { daysAgo: 22, category: "薪水", amount: 52000, note: "", account: bank },
    { daysAgo: 25, category: "房租", amount: 15000, note: "", account: bank },
    { daysAgo: 34, category: "午餐", amount: 110, note: "", account: cash },
    { daysAgo: 40, category: "大眾交通", amount: 1280, note: "月票", account: bank },
    { daysAgo: 45, category: "利息", amount: 213, note: "活存利息", account: bank },
    { daysAgo: 52, category: "薪水", amount: 52000, note: "", account: bank },
  ];

  const txDocs = seeds.flatMap((seed) => {
    const categoryId = idOf(categoryDocs, seed.category);
    if (!categoryId) return [];
    return [
      {
        _id: new ObjectId(),
        userId,
        categoryId,
        accountId: seed.account,
        amount: seed.amount,
        date: dayBefore(seed.daysAgo),
        note: seed.note || undefined,
        createdAt: now,
      },
    ];
  });
  if (txDocs.length > 0) await db.collection("expenses.transactions").insertMany(txDocs);

  // 一筆轉帳：從銀行領錢到錢包。沒有這一筆的話，資產總表的「轉帳明細」一開始是空的，
  // 使用者不會知道那一區是做什麼的。
  if (cash && bank) {
    await db.collection("expenses.transfers").insertOne({
      _id: new ObjectId(),
      userId,
      fromAccountId: bank,
      toAccountId: cash,
      amount: 3000,
      date: dayBefore(6),
      note: "領現金",
      createdAt: now,
    });
  }
}
