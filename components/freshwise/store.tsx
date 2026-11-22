"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { CenterToast } from "./center-toast";
import { defaultBasket, toggleBasket as toggleBasketPure, type BasketState } from "@/lib/freshwise/basket";
import { venueDefaultUnit } from "@/lib/freshwise/catalog";
import { takeLegacyDeviceData } from "@/lib/freshwise/storage";
import type { FreshwisePrefs, VenueKey } from "@/lib/freshwise/types";
import { copy } from "./theme";

/**
 * 整個工具的客戶端狀態：使用者偏好、我的菜籃、置中提示。
 *
 * ## 三種資料都跟著帳號
 *
 * 偏好、菜籃（這裡）與夥伴進度（companion-store.tsx）都存在 MongoDB、綁使用者 id。
 * 本來偏好在 cookie、菜籃在 localStorage，那是「跟著這台瀏覽器」而不是「跟著這個人」：
 * 手機上把菜籃清空、換電腦登入同一個帳號，舊的菜籃還在。
 *
 * 兩者都由 layout（伺服器端）讀好傳進來當初始值，所以第一次算繪就是使用者真正的設定
 * 與菜籃——不會先顯示預設值再跳走，也不會閃一下「菜籃是空的」。
 *
 * 改偏好的時候分兩種：
 * - **會改變數字的**（場所、市場）：**先等伺服器存好**再 `router.refresh()`，讓伺服器
 *   用新的偏好重算一份價格。順序不能反——refresh 比寫入早到的話，伺服器讀到的還是舊
 *   偏好，畫面上的場所分頁換了、數字卻是舊場所的。
 * - **只影響顯示的**（單位、提醒門檻）：寫回去就好，不重新跟伺服器要資料——單位換算是
 *   前端做的（見 price-text.tsx），沒必要為它跑一趟。
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
  /** 菜籃是不是已經是真實資料。伺服器已經讀好傳進來，所以永遠是 true；保留這個欄位
   *  是為了呼叫端不用一次全改（它們用它決定要不要畫「載入中」）。 */
  basketReady: boolean;
  setBasket: (next: BasketState) => void;
  /** 行情頁那顆星星：不在菜籃裡就加進第一個分類，已經在裡面就整個移除。 */
  toggleBasket: (code: string, itemName: string, groupId?: string) => void;
  toast: (message: string) => void;
}

const StoreContext = createContext<FreshwiseStore | null>(null);

const API = "/api/freshwise/user-data";

export function FreshwiseProvider({
  initialPrefs,
  initialBasket,
  children,
}: {
  initialPrefs: FreshwisePrefs;
  initialBasket: BasketState | null;
  children: ReactNode;
}) {
  const router = useRouter();
  const [prefs, setPrefsState] = useState<FreshwisePrefs>(initialPrefs);
  const [basket, setBasketState] = useState<BasketState>(() => initialBasket ?? defaultBasket());
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

  // 伺服器送下來的菜籃同樣要跟上（router.refresh() 之後）。
  const serializedBasket = JSON.stringify(initialBasket);
  const [lastBasket, setLastBasket] = useState(serializedBasket);
  if (serializedBasket !== lastBasket) {
    setLastBasket(serializedBasket);
    if (initialBasket) setBasketState(initialBasket);
  }

  // 一次性搬家：這台裝置上還留著舊版的 localStorage 菜籃／cookie 偏好，而帳號底下
  // 還是全新的，就把它交給伺服器。只在「雲端真的還沒有資料」時才送——否則在 A 裝置
  // 整理好的菜籃，會被 B 裝置上的舊資料蓋掉。搬完就把本機那份清掉。
  useEffect(() => {
    const legacy = takeLegacyDeviceData();
    if (!legacy) return;
    void (async () => {
      try {
        const res = await fetch(API);
        if (!res.ok) return;
        const current = (await res.json()) as { fresh?: boolean };
        if (!current.fresh) return;
        await fetch(API, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(legacy),
        });
        router.refresh();
      } catch {
        /* 搬不過去就算了，下次再試；本機那份已經清掉，使用者看到的是帳號裡的資料 */
      }
    })();
  }, [router]);

  /** 存回伺服器。失敗就提示一次——靜靜失敗的話使用者會以為設定有存到。 */
  const persist = useCallback(
    async (payload: Record<string, unknown>) => {
      try {
        const res = await fetch(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        if (!res.ok) throw new Error(String(res.status));
        return true;
      } catch {
        return false;
      }
    },
    [],
  );

  const applyPrefs = useCallback(
    (patch: Partial<FreshwisePrefs>, refetch: boolean) => {
      const next = { ...prefs, ...patch };
      // 畫面先更新（樂觀），再寫回伺服器。會改變數字的那種一定要**等存好**才 refresh，
      // 不然伺服器重算時讀到的還是舊偏好。
      setPrefsState(next);
      void (async () => {
        const ok = await persist({ prefs: next });
        if (!ok) setToastMessage("設定沒有存起來，請檢查網路後再試一次");
        if (refetch) router.refresh();
      })();
    },
    [persist, prefs, router],
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

  const setBasket = useCallback(
    (next: BasketState) => {
      setBasketState(next);
      void persist({ basket: next });
    },
    [persist],
  );

  const toast = useCallback((message: string) => {
    // 同一則提示連按兩次要能重新計時。先清掉再設定，CenterToast 會重新掛載一次。
    setToastMessage(null);
    requestAnimationFrame(() => setToastMessage(message));
  }, []);

  /** `groupId` 有給就加到那個分類，沒給就沿用原本的行為（第一個分類）。 */
  const toggleBasket = useCallback(
    (code: string, itemName: string, groupId?: string) => {
      setBasketState((current) => {
        const next = toggleBasketPure(current, code, groupId);
        void persist({ basket: next });
        // 提示要講清楚是哪一項——清單上一次可以按很多顆星星，只說「已加入菜籃」的話
        // 使用者不確定自己剛剛點到的是哪一列。
        const added = next.entries.some((e) => e.code === code);
        toast(`${itemName}${added ? copy.addedToBasket : copy.removedFromBasket}`);
        return next;
      });
    },
    [persist, toast],
  );

  const value = useMemo<FreshwiseStore>(
    () => ({ prefs, setPrefs, setVenue, setMarket, basket, basketReady: true, setBasket, toggleBasket, toast }),
    [prefs, setPrefs, setVenue, setMarket, basket, setBasket, toggleBasket, toast],
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
