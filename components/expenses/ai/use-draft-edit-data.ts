"use client";

import { useEffect, useState } from "react";
import type { CategoryDTO } from "@/lib/expenses/categories";
import type { AccountDTO } from "@/lib/expenses/accounts";
import type { AccountTypeDTO } from "@/lib/expenses/account-types";
import type { TransactionDTO } from "@/lib/expenses/transactions";
import type { TransferDTO } from "@/lib/expenses/transfers";

/** 編輯一筆 AI 草稿時，新增／編輯彈窗要用到的那幾份資料。
 *
 *  **為什麼是用抓的、不是從伺服器傳下來**：設定頁的 Server Component 本來只讀分類跟
 *  草稿（整頁約 25KB）。把交易、轉帳也一起傳下來的話每次進設定頁都會變成約 105KB——
 *  只為了一個多數時候不會被打開的彈窗。改成真的打開才抓，設定頁維持輕量。
 *
 *  首頁跟明細頁不走這一支：那兩頁本來就讀好這些資料了，直接用 prop 傳進去就好。
 *
 *  `enabled` 轉成 true 時抓一次就好，之後不再重抓——彈窗開著的那幾十秒內資料不會變，
 *  而且使用者自己在彈窗裡新增的分類會由 setCategories 就地更新。 */
export function useDraftEditData(enabled: boolean, initialCategories: CategoryDTO[]) {
  const [categories, setCategories] = useState<CategoryDTO[]>(initialCategories);
  const [accounts, setAccounts] = useState<AccountDTO[]>([]);
  const [accountTypes, setAccountTypes] = useState<AccountTypeDTO[]>([]);
  const [transactions, setTransactions] = useState<TransactionDTO[]>([]);
  const [transfers, setTransfers] = useState<TransferDTO[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!enabled || loaded) return;
    let cancelled = false;
    Promise.all([
      fetch("/api/expenses/accounts").then((r) => r.json()),
      fetch("/api/expenses/account-types").then((r) => r.json()),
      fetch("/api/expenses/transactions").then((r) => r.json()),
      fetch("/api/expenses/transfers").then((r) => r.json()),
    ])
      .then(([a, t, tx, tr]: [{ accounts?: AccountDTO[] }, { accountTypes?: AccountTypeDTO[] }, { transactions?: TransactionDTO[] }, { transfers?: TransferDTO[] }]) => {
        if (cancelled) return;
        setAccounts(a.accounts ?? []);
        setAccountTypes(t.accountTypes ?? []);
        setTransactions(tx.transactions ?? []);
        setTransfers(tr.transfers ?? []);
        setLoaded(true);
      })
      .catch(() => {
        // 抓不到就讓彈窗用空清單開著：分類、金額、日期照樣改得了，只有帳戶那一欄會是空的。
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, loaded]);

  return { categories, setCategories, accounts, accountTypes, transactions, transfers, loaded };
}
