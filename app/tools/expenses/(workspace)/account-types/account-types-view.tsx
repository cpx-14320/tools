"use client";

import { useEffect, useState } from "react";
import { SectionedListSkeleton } from "@/components/expenses/skeleton";
import { useSkeletonShape, useSkeletonReady } from "@/components/expenses/skeleton-count";
import { PageHeader } from "@/components/expenses/page-header";
import { FloatingAddButton } from "@/components/expenses/floating-add-button";
import { text } from "@/components/expenses/theme";
import { AccountTypeModal, type AccountTypeModalDraft } from "@/components/expenses/account-type-modal";
import { AccountTypeBatchModal, type AccountTypeBatchItem } from "@/components/expenses/account-type-batch-modal";
import { ConfirmModal } from "@/components/expenses/confirm-modal";
import { SelectionBar, SelectionDot, SelectionToggle, useSelection } from "@/components/expenses/selection-bar";
import { ListCard, ListRow } from "@/components/expenses/list-row";
import { accountTypesByKind, type AccountTypeDTO } from "@/lib/expenses/account-types";
import { categoryColorClass } from "@/lib/expenses/categories";

export function AccountTypesView() {
  const [accountTypes, setAccountTypes] = useState<AccountTypeDTO[]>([]);
  const skeletonReady = useSkeletonReady();
  // 交易、轉帳、分類都不用了——金額的部分整塊搬去資產總表（見下面 section 的說明）。
  // 帳戶還是要抓一份，但不是為了顯示筆數，而是為了知道「這個類型底下還有沒有帳戶」：
  // 有的話編輯彈窗裡的資產/負債要鎖住（見 account-type-modal.tsx）。
  const [accounts, setAccounts] = useState<{ accountTypeId: string }[]>([]);
  const [ready, setReady] = useState(false);
  const [modal, setModal] = useState<AccountTypeDTO | null>(null);
  const [batchOpen, setBatchOpen] = useState(false);
  // 擋下來的理由（刪不掉、或資產/負債換不了）直接存成一句話——兩種情況的說明不一樣，
  // 存 inUseCount 再在畫面上拼字串的話只能講刪除那一種。
  const [blockedInfo, setBlockedInfo] = useState<{ message: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/expenses/account-types").then((res) => res.json()),
      fetch("/api/expenses/accounts").then((res) => res.json()),
    ])
      .then(([data, accountsData]: [{ accountTypes?: AccountTypeDTO[] }, { accounts?: { accountTypeId: string }[] }]) => {
        if (cancelled) return;
        setAccountTypes(data.accountTypes ?? []);
        setAccounts(accountsData.accounts ?? []);
        setReady(true);
      })
      .catch(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSave(draft: AccountTypeModalDraft) {
    if (!modal) return;
    const data: { accountTypes?: AccountTypeDTO[]; error?: string } = await fetch("/api/expenses/account-types", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: modal.id, ...draft }),
    })
      .then((res) => res.json())
      .catch(() => ({}));
    // 伺服器會擋下「底下還有帳戶卻想換資產/負債」，把理由顯示出來、彈窗留著讓人改回去。
    if (data.error) {
      setBlockedInfo({ message: data.error });
      return;
    }
    if (data.accountTypes) setAccountTypes(data.accountTypes);
    setModal(null);
  }

  // 刪除類型沒有「未分類」這種通用歸宿可以自動改掛（見 account-types.server.ts 的
  // 說明），所以這裡不是問「要不要強制刪除」，查到還有帳戶在用就直接擋下、告知筆數，
  // 使用者要先把那些帳戶改到別的類型才能刪除。
  async function tryDeleteTypes(ids: string[]) {
    let latest = accountTypes;
    let totalInUse = 0;
    let blockedCount = 0;
    for (const id of ids) {
      const res = await fetch(`/api/expenses/account-types?id=${id}`, { method: "DELETE" }).catch(() => null);
      if (!res) continue;
      const data: { accountTypes?: AccountTypeDTO[]; inUseCount?: number } = await res.json().catch(() => ({}));
      if (res.status === 409) {
        blockedCount++;
        totalInUse += data.inUseCount ?? 0;
      } else if (data.accountTypes) {
        latest = data.accountTypes;
      }
    }
    setAccountTypes(latest);
    return { blockedCount, totalInUse };
  }

  async function handleDelete() {
    if (!modal) return;
    const { blockedCount, totalInUse } = await tryDeleteTypes([modal.id]);
    setModal(null);
    if (blockedCount > 0) setBlockedInfo({ message: `還有 ${totalInUse} 個帳戶掛著選取的類型，無法刪除。請先把這些帳戶改成別的類型，再回來刪除。` });
  }

  async function handleBulkDelete() {
    const { blockedCount, totalInUse } = await tryDeleteTypes([...selection.selectedIds]);
    selection.exit();
    if (blockedCount > 0) setBlockedInfo({ message: `還有 ${totalInUse} 個帳戶掛著選取的類型，無法刪除。請先把這些帳戶改成別的類型，再回來刪除。` });
  }

  // 批次新增：逐筆依序 POST（不是 Promise.all 併發），理由跟分類批次新增一樣——
  // createAccountType 的 order 是用當下已存在筆數算出來的，併發送出會拿到同一個 order。
  async function handleBatchSave(items: AccountTypeBatchItem[]) {
    let latest = accountTypes;
    for (const item of items) {
      const data: { accountTypes?: AccountTypeDTO[] } = await fetch("/api/expenses/account-types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item),
      })
        .then((res) => res.json())
        .catch(() => ({}));
      if (data.accountTypes) latest = data.accountTypes;
    }
    setAccountTypes(latest);
    setBatchOpen(false);
  }

  const assetTypes = accountTypesByKind(accountTypes, "asset");
  const liabilityTypes = accountTypesByKind(accountTypes, "liability");
  const selection = useSelection(accountTypes.map((t) => t.id));
  // 載入中畫骨架。這一頁是「資產一段、負債一段」，各自有小標題跟一張清單卡，所以記的是
  // 兩段各有幾列，不是一個總數——只記總數會畫成一張大卡，少掉中間那個小標跟段落間距。
  const skeletonShape = useSkeletonShape(
    "cpx-tools:expenses-skeleton:account-types",
    [3, 2],
    ready ? [assetTypes.length, liabilityTypes.length] : undefined,
  );

  /** 資產／負債各一段：小標、清單，每一列是「類型名稱＋底下掛了幾個帳戶」。 */
  function section(title: string, types: AccountTypeDTO[]) {
    if (types.length === 0) return null;
    return (
      <div>
        <p className={`mb-2 px-1 ${text.sectionHeading}`}>{title}</p>
        {/* 只有圖示跟名稱，右邊不掛任何數字：這一頁是管理類型本身（名稱、圖示、顏色、
            資產還是負債），那是跟月份無關的定義。「這個類型有多少錢、佔多少比例」是
            分析，在資產總表看（那裡有月份、佔比進度條，還連著底下是哪幾個帳戶）。 */}
        <ListCard>
          {types.map((t) => (
            <ListRow
              key={t.id}
              icon={t.icon}
              iconClassName={categoryColorClass[t.color]}
              name={t.name}
              leading={selection.selecting ? <SelectionDot selected={selection.selectedIds.has(t.id)} /> : undefined}
              onClick={() => (selection.selecting ? selection.toggle(t.id) : setModal(t))}
            />
          ))}
        </ListCard>
      </div>
    );
  }

  return (
    <div>
      {/* 標題列只留「選取」——新增搬到右下角的浮動按鈕（跟首頁新增交易同一招），
          按鈕一多擠一列在手機上會換行成兩排，很難看也很難點。常見類型現在是第一次進
          記帳本時就自動建好的（見 lib/expenses/presets.server.ts），不再需要套用按鈕。 */}
      <PageHeader
        title="帳戶類型"
        // 這一頁現在是從「設定」進來的，標題列不再掛「返回資產總表」那顆箭頭——
        // 指回一個不是上一頁的地方只會讓人迷路，要回去按瀏覽器/系統的返回就好。
        actions={<SelectionToggle selecting={selection.selecting} onToggle={selection.toggleMode} />}
      />

      <FloatingAddButton onClick={() => setBatchOpen(true)} label="新增帳戶類型" />

      <AccountTypeModal
        key={modal ? modal.id : "closed"}
        open={modal !== null}
        initial={modal ?? undefined}
        accountTypes={accountTypes}
        kind={modal?.kind ?? "asset"}
        inUseCount={modal ? accounts.filter((a) => a.accountTypeId === modal.id).length : 0}
        excludeId={modal?.id}
        onClose={() => setModal(null)}
        onSave={handleSave}
        onDelete={handleDelete}
      />
      <AccountTypeBatchModal open={batchOpen} onClose={() => setBatchOpen(false)} onSave={handleBatchSave} accountTypes={accountTypes} />

      <ConfirmModal
        open={blockedInfo !== null}
        title="這個類型還有帳戶在用"
        // 兩種情況共用這個彈窗：刪不掉、以及資產/負債換不了。訊息由各自的呼叫端組好。
        message={blockedInfo?.message ?? ""}
        onlyAcknowledge
        onClose={() => setBlockedInfo(null)}
      />

      {selection.selecting && (
        <SelectionBar
          count={selection.selectedIds.size}
          total={selection.total}
          onToggleAll={selection.toggleAll}
          onCancel={selection.exit}
          onDelete={handleBulkDelete}
        />
      )}

      {!skeletonReady ? null : !ready ? (
        <SectionedListSkeleton counts={skeletonShape} />
      ) : accountTypes.length === 0 ? (
        <p className={text.faint}>還沒有任何帳戶類型，點右下角的＋新增</p>
      ) : (
        <div className="flex flex-col gap-5">
          {section("資產", assetTypes)}
          {section("負債", liabilityTypes)}
        </div>
      )}
    </div>
  );
}
