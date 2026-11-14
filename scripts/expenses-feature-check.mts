/** 記帳本功能回歸測試——每次改完 lib/expenses/* 之後可以跑一次，取代手動重新點一遍整個
 *  App。直接呼叫 server 端函式（跟 API route 背後用的是同一份邏輯），不透過 HTTP，
 *  所以不需要開著 `npm run dev`。
 *
 *  會在 `users` collection 裡建一個真的測試帳號（密碼用 bcrypt 雜湊、拿到跟真的註冊
 *  一樣的預設工具權限——跟 lib/auth.ts 的 createUser 同一套邏輯，只是不透過 HTTP route，
 *  因為那支路由會呼叫 next/headers 的 cookies()，只能在 Next 的請求情境裡跑），依序跑過：
 *    新帳號預設資料 → 分類（含子分類、刪除/還原、強制刪除改掛未分類）→ 帳戶類型／帳戶
 *    （含刪除被擋）→ 交易（含拆明細）→ 轉帳（含手續費）→ 預算 → 存錢目標（含連動固定收支）
 *    → 固定收支（含待確認／略過／轉帳規則／帳戶刪除後暫停）→ 垃圾桶機制（撞名改名、
 *    永久刪除、清空垃圾桶）。
 *
 *  不管中間有沒有測試失敗，最後一定會把這個測試帳號本身跟它在 expenses.* 底下留下的
 *  所有資料清乾淨（finally 區塊），不會在資料庫裡留下測試垃圾、也不會留著一個可登入
 *  的帳號。
 *
 *  用法：
 *    npx tsx scripts/expenses-feature-check.mts
 *    npm run check:expenses
 *
 *  結束碼：全部通過是 0，有任何一項失敗是 1（可以接 CI 或 pre-push hook）。
 *  詳細報告另外寫一份到 scripts/.feature-check-report.txt（已在 .gitignore 裡，不會進版控）。
 */
import { readFileSync, writeFileSync } from "node:fs";
import bcrypt from "bcryptjs";

const env = readFileSync(".env.local", "utf8");
const uriMatch = /^MONGODB_URI=(.*)$/m.exec(env);
const uri = (uriMatch ? uriMatch[1] : "").trim().replace(/^["']|["']$/g, "");
if (!uri) throw new Error("在 .env.local 找不到 MONGODB_URI");
process.env.MONGODB_URI = uri;

// 動態 import：一定要等上面把 MONGODB_URI 塞進 process.env 之後才能載入這些模組，
// 不然 lib/mongodb.ts 的 getDb() 第一次被呼叫時會抓不到連線字串。
const { getDb } = await import("../lib/mongodb");
const presets = await import("../lib/expenses/presets.server");
const categoriesLib = await import("../lib/expenses/categories");
const categoriesSrv = await import("../lib/expenses/categories.server");
const accountsSrv = await import("../lib/expenses/accounts.server");
const accountTypesSrv = await import("../lib/expenses/account-types.server");
const transactionsSrv = await import("../lib/expenses/transactions.server");
const transfersSrv = await import("../lib/expenses/transfers.server");
const budgetsSrv = await import("../lib/expenses/budgets.server");
const goalsSrv = await import("../lib/expenses/goals.server");
const recurringSrv = await import("../lib/expenses/recurring-rules.server");
const trashSrv = await import("../lib/expenses/trash.server");

// ── 建一個真的測試帳號（users collection）───────────────────────────────────
// 跟 lib/auth.ts 的 createUser 做一樣的事：雜湊密碼、從 toolsRegistry 撈目前所有工具
// 給它權限。不直接 import createUser 是因為 lib/auth.ts 頂層會 import next/headers，
// 那個模組只能在 Next 的請求情境裡用，standalone 腳本 import 就會炸。
const db0 = await getDb();
const testUsername = `qa-expenses-check-${Date.now()}`;
const testPassword = "feature-check-only"; // 只是個佔位密碼，測完帳號就刪了，沒人會用它登入
const passwordHash = await bcrypt.hash(testPassword, 10);
const tools = await db0.collection("toolsRegistry").find().map((t) => t.toolId as string).toArray();
const userInsert = await db0.collection("users").insertOne({
  username: testUsername,
  passwordHash,
  name: "功能測試帳號（可安全刪除）",
  tools,
  isAdmin: false,
});
const userId = userInsert.insertedId;

// ── 小小的測試工具 ──────────────────────────────────────────────────────────
const lines: string[] = [];
let passCount = 0;
let failCount = 0;

function log(s: string) {
  lines.push(s);
  console.log(s);
}

function section(name: string) {
  log(`\n■ ${name}`);
}

function check(label: string, cond: unknown, detail?: string) {
  if (cond) {
    passCount++;
    log(`  ✅ ${label}`);
  } else {
    failCount++;
    log(`  ❌ ${label}${detail ? `（${detail}）` : ""}`);
  }
}

/** 包住一整個區塊：區塊裡丟出例外不會讓整支腳本中斷，記成一項失敗，繼續跑下一段。
 *  不然前面一個功能真的壞掉，後面十幾段的驗證結果就全部看不到了。 */
async function run(name: string, fn: () => Promise<void>) {
  section(name);
  try {
    await fn();
  } catch (error) {
    failCount++;
    log(`  ❌ 整段拋出例外：${(error as Error).message}`);
  }
}

const todayISO = (() => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
})();
function daysAgoISO(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// 存著跑完這一段之後要用到下一段的 id，不然每段都要重新查一次。
const ids: Record<string, string> = {};

try {
  // ── 一、新帳號第一次進記帳本：預設資料 ─────────────────────────────────────
  await run("新帳號預設資料（seedExpensesPresets）", async () => {
    await presets.seedExpensesPresets(userId);
    const [cats, accountTypes, accounts, txs, transfers] = await Promise.all([
      categoriesSrv.listCategories(userId),
      accountTypesSrv.listAccountTypes(userId),
      accountsSrv.listAccounts(userId),
      transactionsSrv.listTransactions(userId),
      transfersSrv.listTransfers(userId),
    ]);
    check("建出預設分類", cats.length > 0, `實際 ${cats.length} 筆`);
    check("建出預設帳戶類型", accountTypes.length > 0, `實際 ${accountTypes.length} 筆`);
    check("建出預設帳戶（現金錢包／銀行帳戶）", accounts.length >= 2, `實際 ${accounts.length} 筆`);
    check("建出示範交易", txs.length > 0, `實際 ${txs.length} 筆`);
    check("建出示範轉帳", transfers.length > 0, `實際 ${transfers.length} 筆`);
    // 「未分類」刻意不在預設資料裡（跟「手續費」一樣是第一次真的用到才建，見
    // categories.server.ts 的 ensureUncategorized／presets.server.ts 開頭的說明），
    // 所以這裡反過來驗證它還沒被提前建出來。
    check("新帳號還沒有「未分類」分類（要等第一次強制刪除分類才會建）", !cats.some((c) => c.isUncategorized));

    // 重複呼叫要是冪等的（layout 跟 page 平行算繪時會同時打進來，見 presets.server.ts 的說明）。
    await presets.seedExpensesPresets(userId);
    const catsAgain = await categoriesSrv.listCategories(userId);
    check("重複呼叫預設資料不會建兩份", catsAgain.length === cats.length, `原本 ${cats.length}，重跑後 ${catsAgain.length}`);
  });

  // ── 二、分類 ────────────────────────────────────────────────────────────
  await run("分類：新增／子分類／重複名稱擋下", async () => {
    const created = await categoriesSrv.createCategory(userId, { name: "W-飲食測試", icon: "🧪", color: "a", kind: "支出" });
    check("新增主分類成功", "category" in created);
    if (!("category" in created)) return;
    ids.categoryMain = created.category.id;

    const dup = await categoriesSrv.createCategory(userId, { name: "W-飲食測試", icon: "🧪", color: "a", kind: "支出" });
    check("重複名稱被擋下", "error" in dup);

    const sub = await categoriesSrv.createCategory(userId, { name: "W-子分類測試", icon: "🧪", color: "a", kind: "支出", parentId: ids.categoryMain });
    check("新增子分類成功", "category" in sub);
    if ("category" in sub) {
      ids.categorySub = sub.category.id;
      check("子分類跟著父分類的收支類型／圖示／顏色", sub.category.kind === "支出" && sub.category.icon === "🧪" && sub.category.color === "a");
    }
  });

  await run("分類：編輯／排序", async () => {
    const renamed = await categoriesSrv.updateCategory(userId, ids.categorySub, { name: "W-子分類改名" });
    const after = "categories" in renamed ? renamed.categories.find((c) => c.id === ids.categorySub) : undefined;
    check("編輯分類名稱生效", after?.name === "W-子分類改名", `實際 ${after?.name}`);

    const second = await categoriesSrv.createCategory(userId, { name: "W-飲食測試二", icon: "🧪", color: "b", kind: "支出" });
    if (!("category" in second)) return check("建第二個主分類失敗，跳過排序測試", false);
    ids.categoryMain2 = second.category.id;

    const before = await categoriesSrv.listCategories(userId);
    const topExpense = categoriesLib.topLevelCategories(before, "支出").filter((c) => !categoriesLib.isSystemCategory(c));
    const idxMain = topExpense.findIndex((c) => c.id === ids.categoryMain);
    const idxMain2 = topExpense.findIndex((c) => c.id === ids.categoryMain2);
    const swapped = [...topExpense.map((c) => c.id)];
    [swapped[idxMain], swapped[idxMain2]] = [swapped[idxMain2], swapped[idxMain]];
    const reordered = await categoriesSrv.reorderCategories(userId, swapped);
    const topAfter = categoriesLib.topLevelCategories(reordered, "支出").filter((c) => !categoriesLib.isSystemCategory(c));
    check("重排後順序符合送出的陣列", topAfter.map((c) => c.id).join(",") === swapped.join(","));
  });

  await run("分類：刪除（乾淨）→ 垃圾桶 → 還原", async () => {
    const del = await categoriesSrv.deleteCategory(userId, ids.categorySub);
    check("乾淨的子分類可以直接刪除", "trashId" in del && !!del.trashId);
    if (!("trashId" in del) || !del.trashId) return;
    ids.trashCategorySub = del.trashId;

    const afterDelete = await categoriesSrv.listCategories(userId);
    check("刪除後分類列表不再有它", !afterDelete.some((c) => c.id === ids.categorySub));

    const restored = await trashSrv.restoreFromTrash(userId, ids.trashCategorySub);
    check("還原成功", restored.ok, restored.error);
    const afterRestore = await categoriesSrv.listCategories(userId);
    const back = afterRestore.find((c) => c.name === "W-子分類改名");
    check("還原後分類回來，父分類關係正確", !!back && back.parentId === ids.categoryMain);
    if (back) ids.categorySub = back.id;
  });

  await run("分類：強制刪除（有交易在用）→ 改掛未分類 → 還原改回來", async () => {
    const txCreated = await transactionsSrv.createTransaction(userId, { categoryId: ids.categorySub, amount: 77, date: todayISO, note: "W-測試交易-強刪" });
    ids.txForForceDelete = txCreated.transaction.id;

    const blocked = await categoriesSrv.deleteCategory(userId, ids.categorySub);
    check("有交易在用時，不帶 force 會被擋下", "error" in blocked && blocked.inUseCount > 0, "error" in blocked ? `inUseCount=${blocked.inUseCount}` : "");

    const forced = await categoriesSrv.deleteCategory(userId, ids.categorySub, { force: true });
    check("帶 force 可以刪除", "trashId" in forced && !!forced.trashId);
    if (!("trashId" in forced) || !forced.trashId) return;
    ids.trashCategorySubForced = forced.trashId;

    // 「未分類」是強制刪除時第一次真的用到才建的（見上面的說明），所以要在強刪「之後」
    // 才去找它，強刪之前它本來就不存在。
    const catsAfterForce = await categoriesSrv.listCategories(userId);
    const uncategorized = catsAfterForce.find((c) => c.isUncategorized);
    check("強刪之後自動建出「未分類」分類", !!uncategorized);
    if (!uncategorized) return;

    const txAfterDelete = await transactionsSrv.listTransactions(userId);
    const tx = txAfterDelete.find((t) => t.id === ids.txForForceDelete);
    check("交易被改掛到「未分類」", tx?.categoryId === uncategorized.id, `實際 categoryId=${tx?.categoryId}`);

    const restored = await trashSrv.restoreFromTrash(userId, ids.trashCategorySubForced);
    check("強刪的分類可以還原", restored.ok, restored.error);
    const txAfterRestore = await transactionsSrv.listTransactions(userId);
    const txRestored = txAfterRestore.find((t) => t.id === ids.txForForceDelete);
    check("還原分類後，交易改回原本的子分類（不是留在未分類）", txRestored?.categoryId !== uncategorized.id);

    // 清掉這筆只是為了測強刪用的交易，刪掉本身也驗一下。
    await transactionsSrv.deleteTransaction(userId, ids.txForForceDelete);
  });

  // ── 三、帳戶類型／帳戶 ──────────────────────────────────────────────────────
  await run("帳戶類型／帳戶：新增、刪除類型被擋下、刪帳戶再刪類型", async () => {
    const type = await accountTypesSrv.createAccountType(userId, { name: "W-測試類型", icon: "🧪", kind: "asset", color: "a" });
    check("新增帳戶類型成功", "accountType" in type);
    if (!("accountType" in type)) return;
    ids.accountType = type.accountType.id;

    const account = await accountsSrv.createAccount(userId, { name: "W-測試帳戶", accountTypeId: ids.accountType, openingBalance: 1000 });
    check("新增帳戶成功", "account" in account);
    if (!("account" in account)) return;
    ids.account = account.account.id;

    const blockedType = await accountTypesSrv.deleteAccountType(userId, ids.accountType);
    check("類型底下還有帳戶時，刪除被擋下", "error" in blockedType && blockedType.inUseCount === 1, "error" in blockedType ? `inUseCount=${blockedType.inUseCount}` : "");

    const delAccount = await accountsSrv.deleteAccount(userId, ids.account);
    check("帳戶刪除成功並進垃圾桶", !!delAccount.trashId);
    if (delAccount.trashId) ids.trashAccount = delAccount.trashId;

    const delType = await accountTypesSrv.deleteAccountType(userId, ids.accountType);
    check("帳戶刪掉之後，類型可以刪除了", "trashId" in delType && !!delType.trashId);
    if ("trashId" in delType && delType.trashId) ids.trashAccountType = delType.trashId;
  });

  await run("帳戶類型／帳戶：還原", async () => {
    if (ids.trashAccountType) {
      const r = await trashSrv.restoreFromTrash(userId, ids.trashAccountType);
      check("帳戶類型還原成功", r.ok, r.error);
    }
    if (ids.trashAccount) {
      const r = await trashSrv.restoreFromTrash(userId, ids.trashAccount);
      check("帳戶還原成功", r.ok, r.error);
    }
    const accounts = await accountsSrv.listAccounts(userId);
    check("還原後帳戶列表裡找得到", accounts.some((a) => a.name === "W-測試帳戶"));
  });

  // ── 四、交易（含拆明細）──────────────────────────────────────────────────────
  await run("交易：新增、拆明細淨額、編輯、刪除/還原（含分類路徑快照）", async () => {
    const cats = await categoriesSrv.listCategories(userId);
    const foodParent = cats.find((c) => c.name === "飲食" && !c.parentId);
    const lunch = cats.find((c) => c.name === "午餐" && c.parentId === foodParent?.id);
    check("預設資料裡找得到「飲食 › 午餐」", !!lunch);
    if (!lunch) return;
    ids.lunchCategory = lunch.id;

    const simple = await transactionsSrv.createTransaction(userId, { categoryId: lunch.id, amount: 100, date: todayISO, note: "W-簡單交易" });
    ids.txSimple = simple.transaction.id;
    check("新增簡單交易成功", simple.transaction.amount === 100);

    const breakdownTx = await transactionsSrv.createTransaction(userId, {
      categoryId: lunch.id,
      amount: 0, // 有明細時這個值會被忽略，實際淨額由明細算
      date: todayISO,
      note: "W-拆明細交易",
      breakdown: [
        { label: "主餐", kind: "加項", amount: 80 },
        { label: "折價券", kind: "扣項", amount: 10 },
      ],
    });
    check("拆明細交易的金額＝加項－扣項", breakdownTx.transaction.amount === 70, `實際 ${breakdownTx.transaction.amount}`);
    ids.txBreakdown = breakdownTx.transaction.id;

    const updated = await transactionsSrv.updateTransaction(userId, ids.txSimple, { categoryId: lunch.id, amount: 120, date: todayISO, note: "W-簡單交易-改過" });
    const afterUpdate = updated.find((t) => t.id === ids.txSimple);
    check("編輯交易金額生效", afterUpdate?.amount === 120, `實際 ${afterUpdate?.amount}`);

    const del = await transactionsSrv.deleteTransaction(userId, ids.txSimple);
    check("刪除交易進垃圾桶", !!del.trashId);
    if (del.trashId) {
      const trashItems = await trashSrv.listTrash(userId);
      const item = trashItems.find((t) => t.id === del.trashId);
      check("垃圾桶項目存了分類路徑快照（飲食 › 午餐）", item?.categoryPath === "飲食 › 午餐", `實際 ${item?.categoryPath}`);
      check("垃圾桶項目存了標題（備註）", item?.label === "W-簡單交易-改過", `實際 ${item?.label}`);

      const restored = await trashSrv.restoreFromTrash(userId, del.trashId);
      check("還原交易成功", restored.ok, restored.error);
      const afterRestore = await transactionsSrv.listTransactions(userId);
      check("還原後交易回到列表裡", afterRestore.some((t) => t.id === ids.txSimple));
    }

    await transactionsSrv.deleteTransaction(userId, ids.txBreakdown);
  });

  // ── 五、轉帳（含手續費）──────────────────────────────────────────────────────
  await run("轉帳：手續費自動建交易、改成 0 自動刪除、刪轉帳連手續費一起進垃圾桶再一起還原", async () => {
    const accounts = await accountsSrv.listAccounts(userId);
    const cash = accounts.find((a) => a.name === "現金錢包");
    const bank = accounts.find((a) => a.name === "銀行帳戶");
    check("預設資料裡找得到現金錢包／銀行帳戶", !!cash && !!bank);
    if (!cash || !bank) return;

    const created = await transfersSrv.createTransfer(userId, { fromAccountId: bank.id, toAccountId: cash.id, amount: 500, date: todayISO, note: "W-測試轉帳", fee: 15 });
    ids.transfer = created.transfer.id;
    const txAfterCreate = await transactionsSrv.listTransactions(userId);
    const feeTx = txAfterCreate.find((t) => t.note === "轉帳手續費" && t.amount === 15);
    check("填了手續費會自動產生一筆手續費支出", !!feeTx);

    await transfersSrv.updateTransfer(userId, ids.transfer, { fromAccountId: bank.id, toAccountId: cash.id, amount: 500, date: todayISO, note: "W-測試轉帳", fee: 0 });
    const txAfterZeroFee = await transactionsSrv.listTransactions(userId);
    check("手續費改成 0 之後，那筆手續費交易自動消失", !txAfterZeroFee.some((t) => t.note === "轉帳手續費" && t.amount === 15));

    await transfersSrv.updateTransfer(userId, ids.transfer, { fromAccountId: bank.id, toAccountId: cash.id, amount: 500, date: todayISO, note: "W-測試轉帳", fee: 20 });
    const del = await transfersSrv.deleteTransfer(userId, ids.transfer);
    check("刪除轉帳進垃圾桶", !!del.trashId);
    if (!del.trashId) return;

    const txAfterDeleteTransfer = await transactionsSrv.listTransactions(userId);
    check("刪轉帳的同時，手續費那筆交易也一起消失", !txAfterDeleteTransfer.some((t) => t.note === "轉帳手續費" && t.amount === 20));

    const restored = await trashSrv.restoreFromTrash(userId, del.trashId);
    check("還原轉帳成功", restored.ok, restored.error);
    const transfersAfter = await transfersSrv.listTransfers(userId);
    const restoredTransfer = transfersAfter.find((t) => t.id === ids.transfer);
    check("還原後轉帳的手續費欄位保留", restoredTransfer?.fee === 20, `實際 ${restoredTransfer?.fee}`);
    const txAfterRestoreTransfer = await transactionsSrv.listTransactions(userId);
    check("還原轉帳後，手續費那筆交易也一起回來", txAfterRestoreTransfer.some((t) => t.note === "轉帳手續費" && t.amount === 20));

    await transfersSrv.deleteTransfer(userId, ids.transfer);
  });

  // ── 六、預算 ────────────────────────────────────────────────────────────
  await run("預算：設定、列表、刪除", async () => {
    if (!ids.lunchCategory) return check("找不到午餐分類，跳過", false);
    const thisMonth = todayISO.slice(0, 7);
    await budgetsSrv.upsertBudgetRule(userId, { categoryId: ids.lunchCategory, effectiveFrom: thisMonth, amount: 3000 });
    const rules = await budgetsSrv.listBudgetRules(userId);
    const rule = rules.find((r) => r.categoryId === ids.lunchCategory && r.effectiveFrom === thisMonth);
    check("預算規則設定成功", rule?.amount === 3000, `實際 ${rule?.amount}`);
    if (!rule) return;

    // 同月再設一次是「改掉」不是「疊加」。
    await budgetsSrv.upsertBudgetRule(userId, { categoryId: ids.lunchCategory, effectiveFrom: thisMonth, amount: 5000 });
    const rulesAfter = await budgetsSrv.listBudgetRules(userId);
    const same = rulesAfter.filter((r) => r.categoryId === ids.lunchCategory && r.effectiveFrom === thisMonth);
    check("同月同分類再設一次是覆蓋，不是疊加成兩筆", same.length === 1 && same[0].amount === 5000, `實際 ${same.length} 筆，金額 ${same[0]?.amount}`);

    await budgetsSrv.deleteBudgetRule(userId, rule.id);
    const rulesFinal = await budgetsSrv.listBudgetRules(userId);
    check("刪除預算規則成功", !rulesFinal.some((r) => r.id === rule.id));
  });

  // ── 七、存錢目標 ─────────────────────────────────────────────────────────
  await run("存錢目標：手動記錄、綁定帳戶、刪除時解除固定收支連動", async () => {
    const manual = await goalsSrv.createGoal(userId, { name: "W-手動目標", icon: "🧪", targetAmount: 1000, currentAmount: 0 });
    ids.goalManual = manual.goal.id;
    const afterContribute = await goalsSrv.contributeToGoal(userId, ids.goalManual, 300);
    const g = afterContribute.find((x) => x.id === ids.goalManual);
    check("手動存入後 currentAmount 增加", g?.currentAmount === 300, `實際 ${g?.currentAmount}`);

    const accounts = await accountsSrv.listAccounts(userId);
    const cash = accounts.find((a) => a.name === "現金錢包");
    if (cash) {
      const bound = await goalsSrv.createGoal(userId, { name: "W-綁定目標", icon: "🧪", targetAmount: 1000, currentAmount: 0, accountId: cash.id });
      ids.goalBound = bound.goal.id;
      const withProgress = await goalsSrv.listGoalsWithProgress(userId);
      const bg = withProgress.find((x) => x.id === ids.goalBound);
      check("綁定帳戶的目標，進度來自帳戶餘額（不是存進去的 currentAmount）", bg?.currentAmount !== undefined);
    }

    const cats = await categoriesSrv.listCategories(userId);
    const income = cats.find((c) => c.kind === "收入" && !c.parentId);
    if (income) {
      const rule = await recurringSrv.createRecurringRule(userId, {
        categoryId: income.id,
        amount: 100,
        frequencyUnit: "month",
        interval: 1,
        startDate: todayISO,
        linkedGoalId: ids.goalManual,
      });
      ids.recurringLinkedToGoal = rule.rule.id;
      check("固定收支規則連動存錢目標", rule.rule.linkedGoalId === ids.goalManual);

      await goalsSrv.deleteGoal(userId, ids.goalManual);
      const rulesAfter = await recurringSrv.listRecurringRules(userId);
      const ruleAfter = rulesAfter.find((r) => r.id === ids.recurringLinkedToGoal);
      check("刪除目標後，固定收支規則的連動被解除（linkedGoalId 消失）", !ruleAfter?.linkedGoalId);

      await recurringSrv.deleteRecurringRule(userId, ids.recurringLinkedToGoal);
    } else {
      await goalsSrv.deleteGoal(userId, ids.goalManual);
    }
    if (ids.goalBound) await goalsSrv.deleteGoal(userId, ids.goalBound);
  });

  // ── 八、固定收支 ─────────────────────────────────────────────────────────
  await run("固定收支：待確認／略過／轉帳規則／刪帳戶後暫停", async () => {
    if (!ids.lunchCategory) return check("找不到午餐分類，跳過", false);

    const rule = await recurringSrv.createRecurringRule(userId, {
      categoryId: ids.lunchCategory,
      amount: 199,
      note: "W-固定支出測試",
      frequencyUnit: "month",
      interval: 1,
      startDate: daysAgoISO(40), // 夠久以前，確保已經有一期到期
    });
    ids.recurringExpense = rule.rule.id;

    const pendingBefore = await recurringSrv.listPendingOccurrences(userId);
    const minePending = pendingBefore.filter((p) => p.ruleId === ids.recurringExpense);
    check("有到期但還沒確認的期數", minePending.length > 0, `實際 ${minePending.length} 期`);
    if (minePending.length === 0) return;

    const firstDate = minePending[0].date;
    await recurringSrv.confirmOccurrences(userId, [{ ruleId: ids.recurringExpense, date: firstDate }]);
    const txs = await transactionsSrv.listTransactions(userId);
    const confirmedTx = txs.find((t) => t.sourceRuleId === ids.recurringExpense && t.date === firstDate);
    check("確認後寫出一筆交易，帶 sourceRuleId", !!confirmedTx);
    ids.txFromRecurring = confirmedTx?.id ?? "";

    const pendingAfterConfirm = await recurringSrv.listPendingOccurrences(userId);
    check("確認過的那一期不會再出現在待確認清單", !pendingAfterConfirm.some((p) => p.ruleId === ids.recurringExpense && p.date === firstDate));

    const stillPending = pendingAfterConfirm.filter((p) => p.ruleId === ids.recurringExpense);
    if (stillPending.length > 0) {
      const skipDate = stillPending[0].date;
      await recurringSrv.skipOccurrences(userId, [{ ruleId: ids.recurringExpense, date: skipDate }]);
      const pendingAfterSkip = await recurringSrv.listPendingOccurrences(userId);
      check("略過的那一期不會再出現在待確認清單，也沒有變成交易", !pendingAfterSkip.some((p) => p.ruleId === ids.recurringExpense && p.date === skipDate));
    } else {
      log("  （只有一期到期，沒有第二期可以測略過，略過這項）");
    }

    // 轉帳型規則。
    const accounts = await accountsSrv.listAccounts(userId);
    const cash = accounts.find((a) => a.name === "現金錢包");
    const bank = accounts.find((a) => a.name === "銀行帳戶");
    if (cash && bank) {
      const transferRule = await recurringSrv.createRecurringRule(userId, {
        categoryId: "",
        transfer: { fromAccountId: bank.id, toAccountId: cash.id, fee: 5 },
        amount: 300,
        frequencyUnit: "month",
        interval: 1,
        startDate: daysAgoISO(40),
      });
      ids.recurringTransfer = transferRule.rule.id;

      const pendingTransfer = await recurringSrv.listPendingOccurrences(userId);
      const mineTransfer = pendingTransfer.filter((p) => p.ruleId === ids.recurringTransfer);
      if (mineTransfer.length > 0) {
        await recurringSrv.confirmOccurrences(userId, [{ ruleId: ids.recurringTransfer, date: mineTransfer[0].date }]);
        const transfersAfter = await transfersSrv.listTransfers(userId);
        check("轉帳型規則確認後寫出一筆轉帳，帶 sourceRuleId", transfersAfter.some((t) => t.sourceRuleId === ids.recurringTransfer));
      }

      // 刪掉規則指到的帳戶 → 規則要被自動暫停；還原帳戶 → 規則仍是暫停（刻意，不自動恢復）。
      const delBank = await accountsSrv.deleteAccount(userId, bank.id);
      const rulesAfterDeleteAccount = await recurringSrv.listRecurringRules(userId);
      const pausedRule = rulesAfterDeleteAccount.find((r) => r.id === ids.recurringTransfer);
      check("刪掉轉帳規則指到的帳戶後，規則被自動暫停", pausedRule?.active === false);

      if (delBank.trashId) {
        await trashSrv.restoreFromTrash(userId, delBank.trashId);
        const rulesAfterRestore = await recurringSrv.listRecurringRules(userId);
        const stillPausedRule = rulesAfterRestore.find((r) => r.id === ids.recurringTransfer);
        check("還原帳戶後，規則仍是暫停狀態（不自動恢復，刻意）", stillPausedRule?.active === false);
      }

      await recurringSrv.deleteRecurringRule(userId, ids.recurringTransfer);
    } else {
      log("  （找不到現金錢包／銀行帳戶，跳過轉帳型固定收支測試）");
    }

    await recurringSrv.deleteRecurringRule(userId, ids.recurringExpense);
  });

  // ── 九、垃圾桶機制：撞名改名、永久刪除、清空垃圾桶 ────────────────────────────
  await run("垃圾桶：還原撞名自動改名、永久刪除、清空垃圾桶", async () => {
    const first = await categoriesSrv.createCategory(userId, { name: "W-撞名測試", icon: "🧪", color: "a", kind: "支出" });
    if (!("category" in first)) return check("建分類失敗，跳過", false);
    const del = await categoriesSrv.deleteCategory(userId, first.category.id);
    if (!("trashId" in del) || !del.trashId) return check("刪除失敗，跳過", false);

    // 刪掉之後，用同一個名字再建一個——這時候垃圾桶裡那個如果還原，會撞名。
    const second = await categoriesSrv.createCategory(userId, { name: "W-撞名測試", icon: "🧪", color: "a", kind: "支出" });
    if (!("category" in second)) return check("建第二個同名分類失敗，跳過", false);

    const preview = await trashSrv.previewRestore(userId, [del.trashId]);
    check("還原前預覽，偵測到會撞名", preview.length === 1 && preview[0].renamedTo !== "W-撞名測試", JSON.stringify(preview));

    const restored = await trashSrv.restoreFromTrash(userId, del.trashId);
    check("撞名還原仍然成功（自動改名）", restored.ok, restored.error);
    check("還原回傳的 renamedTo 帶著新名字", !!restored.renamedTo, restored.renamedTo);

    const cats = await categoriesSrv.listCategories(userId);
    const renamedCat = cats.find((c) => c.name === restored.renamedTo);
    check("改名後的分類真的存在於清單中", !!renamedCat);

    // 永久刪除：刪掉之後不能再還原。
    const toPurge = await categoriesSrv.createCategory(userId, { name: "W-永久刪除測試", icon: "🧪", color: "a", kind: "支出" });
    if ("category" in toPurge) {
      const delForPurge = await categoriesSrv.deleteCategory(userId, toPurge.category.id);
      if ("trashId" in delForPurge && delForPurge.trashId) {
        await trashSrv.purgeTrashItem(userId, delForPurge.trashId);
        const restoreAfterPurge = await trashSrv.restoreFromTrash(userId, delForPurge.trashId);
        check("永久刪除後的項目無法再還原", !restoreAfterPurge.ok);
      }
    }

    // 清掉這一段測試自己建出來的分類，不靠最後的整批清除（順便驗證清空垃圾桶）。
    if (second.category) await categoriesSrv.deleteCategory(userId, second.category.id, { force: true }).catch(() => {});
    if (renamedCat) await categoriesSrv.deleteCategory(userId, renamedCat.id, { force: true }).catch(() => {});
    const countBefore = await trashSrv.countTrash(userId);
    const emptied = await trashSrv.emptyTrash(userId);
    check("清空垃圾桶回傳的筆數跟清空前的數量一致", emptied === countBefore, `countBefore=${countBefore}, emptied=${emptied}`);
    const countAfter = await trashSrv.countTrash(userId);
    check("清空垃圾桶後筆數歸零", countAfter === 0, `實際 ${countAfter}`);
  });
} finally {
  // ── 清乾淨：不管前面測試結果如何，把這個測試帳號跟它留下的所有 expenses 資料清掉 ──────
  section("清理測試資料");
  const db = await getDb();
  const COLLECTIONS = [
    "expenses.meta",
    "expenses.categories",
    "expenses.transactions",
    "expenses.transfers",
    "expenses.accounts",
    "expenses.accountTypes",
    "expenses.recurringRules",
    "expenses.goals",
    "expenses.budgets",
    "expenses.trash",
  ];
  let totalDeleted = 0;
  for (const coll of COLLECTIONS) {
    const result = await db.collection(coll).deleteMany({ userId });
    totalDeleted += result.deletedCount;
  }
  const userDeleted = await db.collection("users").deleteOne({ _id: userId });
  const sessionsDeleted = await db.collection("sessions").deleteMany({ userId });
  log(`  共清掉 ${totalDeleted} 筆 expenses 測試資料 ＋ ${userDeleted.deletedCount} 個測試帳號 ＋ ${sessionsDeleted.deletedCount} 筆 session（userId=${userId.toHexString()}）`);

  // 不用 process.exit，讓 MongoClient 的連線自然關閉——getDb() 用的是 global 快取的
  // client，這支腳本跑完進程就結束了，不用特地呼叫 close()。

  log(`\n──────────────────────────────`);
  log(`通過 ${passCount} 項，失敗 ${failCount} 項。`);
  writeFileSync("scripts/.feature-check-report.txt", lines.join("\n"), "utf8");
  log(`完整報告已寫到 scripts/.feature-check-report.txt`);
  process.exitCode = failCount > 0 ? 1 : 0;
}

// getDb() 的連線快取在 globalThis 上、故意不主動關閉（理由見 lib/mongodb.ts：Next.js
// 裡要讓同一個還熱著的 function instance 重複用）。但這支是跑完就該結束的一次性腳本，
// 連線不關的話 Node 事件迴圈會被那條還開著的 socket 卡住，進程永遠不會自己結束。
// 明講 process.exit 了事，不要去改 lib/mongodb.ts 配合這支腳本。
process.exit(process.exitCode ?? 0);
