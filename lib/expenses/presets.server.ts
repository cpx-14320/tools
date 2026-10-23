import { ObjectId } from "mongodb";
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
  // upsert 當成「只做一次」的閘門：第一個進來的請求才會拿到 upsertedId，同一個使用者
  // 連續開兩個分頁同時觸發時，第二個會因為文件已存在而拿到 null，不會建出兩份預設資料。
  const result = await meta.updateOne(
    { userId },
    { $setOnInsert: { userId, presetsSeededAt: new Date() } },
    { upsert: true },
  );
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

  // ── 帳戶類型 + 同名帳戶 ──────────────────────────────────────────────────
  // 每個預設類型都配一個期初餘額 0 的同名帳戶，使用者一進資產頁就有現成帳戶可以掛交易，
  // 不用先建類型再建帳戶兩道手續。
  const accountTypeDocs: Record<string, unknown>[] = [];
  const accountDocs: Record<string, unknown>[] = [];
  PRESET_ACCOUNTS.forEach((seed, index) => {
    const typeId = new ObjectId();
    accountTypeDocs.push({
      _id: typeId,
      userId,
      name: seed.name,
      icon: seed.icon,
      kind: "asset",
      color: seed.color,
      order: index,
      createdAt: now,
      isPreset: true,
    });
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
}
