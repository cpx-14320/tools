import { cache } from "react";
import { ObjectId } from "mongodb";
import { redirect } from "next/navigation";
import { getSessionUser, hasToolAccess } from "../auth";
import { seedExpensesPresets } from "./presets.server";
import { settlePetRewards, todayInTaipei, type PetStateDTO } from "./pet.server";

/** 記帳本頁面在伺服器端讀資料前要先過的這一關：確認有登入、把新帳號的預設資料建好，
 *  然後回傳要用的 userId。
 *
 *  為什麼 page 自己也要建預設資料、而不是靠 layout——**Next 的 layout 跟 page 是平行
 *  算繪的**。layout 的 redirect 還沒生效時 page 已經在跑了，它 await 的 seedExpensesPresets
 *  更不會擋住 page 去讀資料。所以如果只在 layout 建預設分類，新帳號第一次進來會賽跑：
 *  page 可能在預設分類寫進去之前就讀完了，畫面上是一本空帳本，要重新整理才看得到東西。
 *
 *  用 cache() 包起來，一個請求只會真的跑一次：layout 跟每一頁都呼叫同一支。
 *
 *  沒登入用 redirect 而不是 throw：throw 會在每一個未登入的請求留下一筆錯誤堆疊，
 *  redirect 丟的是 Next 自己認得的訊號，跟 layout 導到同一個地方。
 *
 *  工具權限不在這裡擋——layout 的 hasToolAccess 檢查沒過時會用 ToolAccessDenied 取代
 *  children，page 算出來的東西整個被丟掉，所以不會外流；而且讀的本來就是這個 userId
 *  自己的資料。 */
export const expensesUserId = cache(async (): Promise<ObjectId> => {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const userId = new ObjectId(user.id);
  // 建預設資料是一個帳號一輩子一次的事，但它擋在每一頁讀資料的前面，所以要盡量不花
  // 時間。seedExpensesPresets 自己雖然會用 expenses.meta 的標記判斷「已經建過了」，
  // 那個判斷本身就是一趟 DB 來回（量到約 130ms，資料庫是遠端的）——每一次頁面算繪都
  // 付這個錢只為了得到「不用做」的答案太貴。這裡在行程記憶體裡記一份已經處理過的
  // userId，同一個 server 跑起來之後就只做第一次。
  //
  // 這個快取只會「漏掉該做的事」而不會「做錯事」：重開 server 就重新問一次（多一趟
  // 來回，然後還是什麼都不做），而標記一旦寫下去就不會再變回去，所以不存在快取過期
  // 的問題。
  // 沒有記帳本權限的人不建預設資料：layout 的 hasToolAccess 沒過時會用 ToolAccessDenied
  // 取代 children，這一頁算出來的東西整個被丟掉——但 seed 是**寫入**，丟不掉。不擋的話
  // 一個沒權限的人只要打開記帳本的網址，資料庫裡就會多出一整套他用不到的分類跟帳戶。
  if (!seeded.has(user.id) && hasToolAccess(user, "expenses")) {
    // 盡力而為：這一支失敗不該擋住頁面渲染——所以只有真的成功才記下來，失敗的話
    // 下一次請求會再試一次。
    await seedExpensesPresets(userId)
      .then(() => seeded.add(user.id))
      .catch(() => {});
  }
  return userId;
});

/** 這個 server 行程裡已經確認建過預設資料的 userId。 */
const seeded = new Set<string>();

/** 養成獎勵的結算（每記一筆、每日簽到、守住預算）。
 *
 *  刻意**不**放進 expensesUserId：沒有任何頁面讀的資料取決於結算結果（只有養成頁要），
 *  把它擋在每一頁的資料讀取前面，等於每一次頁面算繪都先多花一輪 DB 來回。改成由 layout
 *  去跑——layout 跟 page 是平行算繪的，所以它不會拖慢頁面——養成頁自己 await 這一支拿
 *  結算結果。
 *
 *  cache() 在這裡是必要的，不只是省時間：結算是「發過就不再發」的，兩邊各跑一次的話
 *  justEarned 會被先跑完的那一邊吃掉，「獲得 N 顆星星幣」那句提示就不會出現。包起來
 *  之後兩邊拿到的是同一個 promise、同一批 justEarned。
 *
 *  先 await expensesUserId() 是為了順序確定：新帳號的示範交易是 seed 建的，結算要在
 *  那之後跑，不然「每記一筆 ＋100」會因為先後順序不同而時有時無。
 *
 *  日期用台北時間，跟 pet.server.ts 內部的判斷同一套——用伺服器本地時間的話，部署在
 *  別的時區時會跟養成頁自己算的日期差一天，簽到連續天數就會對不上。 */
export const expensesPetState = cache(async (): Promise<PetStateDTO | null> => {
  const userId = await expensesUserId();
  return settlePetRewards(userId, todayInTaipei()).catch(() => null);
});
