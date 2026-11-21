"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { CenterToast } from "./center-toast";
import { defaultBasket, toggleBasket as toggleBasketPure, type BasketState } from "@/lib/freshwise/basket";
import { venueDefaultUnit } from "@/lib/freshwise/catalog";
import { loadBasket, saveBasket } from "@/lib/freshwise/storage";
import { writePrefsCookie } from "@/lib/freshwise/prefs-cookie";
import type { FreshwisePrefs, VenueKey } from "@/lib/freshwise/types";
import { copy } from "./theme";

/**
 * 整個工具的客戶端狀態：使用者偏好、我的菜籃、置中提示。
 *
 * ## 偏好為什麼從伺服器來
 *
 * 價格是伺服器端從 MongoDB 整理出來的（真實開放資料），所以伺服器必須在算繪時就知道
 * 「要算哪個場所、哪個市場」。偏好因此存在 cookie 裡、由 layout 讀出來傳進這個 Provider
 * 當 `initialPrefs`——第一次畫面就是使用者真正的設定，不會先顯示預設值再跳走。
 *
 * 改偏好的時候分兩種：
 * - **會改變數字的**（場所、市場）：寫 cookie ＋ `router.refresh()`，讓伺服器用新的偏好
 *   重算一份價格。不呼叫 refresh 的話畫面上的場所分頁換了、數字卻還是舊場所的。
 * - **只影響顯示的**（單位、首頁建議開關、提醒門檻）：只寫 cookie 與本地狀態，不重新
 *   跟伺服器要資料——單位換算是前端做的（見 price-text.tsx），沒必要為它跑一趟。
 *
 * ## 菜籃還在 localStorage
 *
 * 菜籃是會成長的清單，不適合放 cookie（每個請求都要帶）。它仍然是瀏覽器端狀態，所以
 * `basketReady` 這個旗標還留著：localStorage 要等掛載後才讀得到，讀完之前不要畫「菜籃是
 * 空的」（會閃一下）。等菜籃搬進資料庫之後這個旗標就可以拿掉。
 */
interface FreshwiseStore {
  prefs: FreshwisePrefs;
  /** 只改顯示相關的偏好（不重新向伺服器要資料）。 */
  setPrefs: (patch: Partial<FreshwisePrefs>) => void;
  /** 換場所。會一併換成該場所的慣用單位、清掉市場選擇，並重新取資料。 */
  setVenue: (venue: VenueKey) => void;
  /** 換市場。會重新取資料。 */
  setMarket: (marketCode: string) => void;
  basket: BasketState;
  /** localStorage 讀完了沒。 */
  basketReady: boolean;
  setBasket: (next: BasketState) => void;
  /** 行情頁那顆星星：不在菜籃裡就加進第一個分類，已經在裡面就整個移除。 */
  toggleBasket: (code: string, itemName: string) => void;
  toast: (message: string) => void;
}

const StoreContext = createContext<FreshwiseStore | null>(null);

export function FreshwiseProvider({ initialPrefs, children }: { initialPrefs: FreshwisePrefs; children: ReactNode }) {
  const router = useRouter();
  const [prefs, setPrefsState] = useState<FreshwisePrefs>(initialPrefs);
  const [basket, setBasketState] = useState<BasketState>(() => defaultBasket());
  const [basketReady, setBasketReady] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // 伺服器重新算繪時（換場所、換市場之後的 router.refresh()）cookie 的內容會跟著變，
  // 本地狀態要跟上——以伺服器送下來的為準，它跟畫面上的數字是同一套。
  //
  // 用「算繪期間調整 state」而不是 useEffect：effect 要等算繪完才跑，中間會先用舊的偏好
  // 畫一次（場所分頁閃一下舊的選擇）。比較的是序列化後的字串而不是物件本身——每次伺服器
  // 算繪都會給一個新物件，用 identity 比會每次都判定成「變了」。
  const serializedInitial = JSON.stringify(initialPrefs);
  const [lastInitial, setLastInitial] = useState(serializedInitial);
  if (serializedInitial !== lastInitial) {
    setLastInitial(serializedInitial);
    setPrefsState(initialPrefs);
  }

  // 掛載後讀菜籃。這是「把外部儲存（localStorage）讀進 state」的一次性初始化，不是在
  // 訂閱什麼會變的東西，也不會連鎖觸發其他 effect——是這個 lint 規則容許的例外情況。
  useEffect(() => {
    const stored = loadBasket();
    // 完全沒存過（第一次使用）才給預設菜籃；存過但是空的要尊重那個空的狀態，不然使用者
    // 把菜籃清空、重新整理一次，預設的那幾樣菜又全部回來，看起來像刪不掉。
    /* eslint-disable-next-line react-hooks/set-state-in-effect */
    setBasketState(stored ?? defaultBasket());
    setBasketReady(true);
  }, []);

  const applyPrefs = useCallback(
    (patch: Partial<FreshwisePrefs>, refetch: boolean) => {
      const next = { ...prefs, ...patch };
      // Cookie 與路由更新都在事件處理期間執行，避免 React 重跑 state updater
      // 時觸發 Router 更新。伺服器重新整理前必須先寫好 cookie。
      writePrefsCookie(next);
      setPrefsState(next);
      if (refetch) router.refresh();
    },
    [prefs, router],
  );

  const setPrefs = useCallback((patch: Partial<FreshwisePrefs>) => applyPrefs(patch, false), [applyPrefs]);

  /**
   * 換場所。順便把顯示單位換成那個場所的慣用單位——批發行情的世界講元/公斤、傳統市場講
   * 元/台斤，切到批發卻還顯示台斤，數字跟使用者在別處看到的批發報價對不上。
   * 市場選擇也要清掉：市場清單是分場所的，留著上一個場所的市場代號會變成選了一個不存在
   * 於新場所的市場，畫面會變成空的。
   */
  const setVenue = useCallback(
    (venue: VenueKey) => applyPrefs({ venue, unit: venueDefaultUnit(venue), marketCode: "" }, true),
    [applyPrefs],
  );

  const setMarket = useCallback((marketCode: string) => applyPrefs({ marketCode }, true), [applyPrefs]);

  const setBasket = useCallback((next: BasketState) => {
    setBasketState(next);
    saveBasket(next);
  }, []);

  const toast = useCallback((message: string) => {
    // 同一則提示連按兩次要能重新計時。先清掉再設定，CenterToast 會重新掛載一次。
    setToastMessage(null);
    requestAnimationFrame(() => setToastMessage(message));
  }, []);

  const toggleBasket = useCallback(
    (code: string, itemName: string) => {
      setBasketState((current) => {
        const next = toggleBasketPure(current, code);
        saveBasket(next);
        // 提示要講清楚是哪一項——清單上一次可以按很多顆星星，只說「已加入菜籃」的話
        // 使用者不確定自己剛剛點到的是哪一列。
        const added = next.entries.some((e) => e.code === code);
        toast(`${itemName}${added ? copy.addedToBasket : copy.removedFromBasket}`);
        return next;
      });
    },
    [toast],
  );

  const value = useMemo<FreshwiseStore>(
    () => ({ prefs, setPrefs, setVenue, setMarket, basket, basketReady, setBasket, toggleBasket, toast }),
    [prefs, setPrefs, setVenue, setMarket, basket, basketReady, setBasket, toggleBasket, toast],
  );

  return (
    <StoreContext.Provider value={value}>
      {children}
      {toastMessage && <CenterToast message={toastMessage} onDone={() => setToastMessage(null)} />}
    </StoreContext.Provider>
  );
}

export function useFreshwise(): FreshwiseStore {
  const store = useContext(StoreContext);
  // 丟例外而不是回傳預設值：忘記包 Provider 是程式寫錯，靜靜地用預設值會變成「設定改了
  // 沒反應」這種很難查的症狀。
  if (!store) throw new Error("useFreshwise 必須在 FreshwiseProvider 裡面使用");
  return store;
}
