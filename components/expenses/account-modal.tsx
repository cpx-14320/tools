"use client";

import { useState } from "react";
import { SegmentedControl } from "./button";
import { Modal, Field, RequiredMark, fieldInputClass, ModalFooter } from "./modal";
import { OptionGrid } from "./option-grid";
import { AmountKeypad, evaluateExpr } from "./amount-keypad";
import { AccountTypeBatchModal, type AccountTypeBatchItem } from "./account-type-batch-modal";
import { ConfirmModal } from "./confirm-modal";
import { text } from "./theme";
import { accountNameTaken, type AccountDTO } from "@/lib/expenses/accounts";
import { accountTypesByKind, type AccountKind, type AccountTypeDTO } from "@/lib/expenses/account-types";
import { categoryColorClass } from "@/lib/expenses/categories";

export interface AccountModalDraft {
  name: string;
  accountTypeId: string;
  openingBalance: number;
}

export function AccountModal({
  open,
  accounts,
  accountTypes,
  initial,
  excludeId,
  onClose,
  onSave,
  onDelete,
  onAccountTypesChange,
}: {
  open: boolean;
  /** 現有的所有帳戶，用來擋名稱重複。 */
  accounts: AccountDTO[];
  accountTypes: AccountTypeDTO[];
  initial?: AccountModalDraft;
  /** 編輯既有帳戶時傳自己的 id，重複檢查才不會把自己判定成跟自己撞名。 */
  excludeId?: string;
  onClose: () => void;
  onSave: (draft: AccountModalDraft) => void;
  onDelete?: () => void;
  /** 「＋新增」帳戶類型當場建好、或在這裡直接刪除類型後，把最新的類型清單回報給呼叫端
   *  更新自己的狀態。 */
  onAccountTypesChange: (accountTypes: AccountTypeDTO[]) => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [accountTypeId, setAccountTypeId] = useState(initial?.accountTypeId ?? "");
  // 使用者自己打過名稱之後就不要再被類型蓋掉（見 chooseType）。編輯既有帳戶時名稱
  // 本來就是他當初取的，一開始就算「動過」。
  const [nameTouched, setNameTouched] = useState(!!initial?.name);
  // 期初餘額改用彈窗下方那個固定小鍵盤輸入（跟新增交易一致），存的是算式字串。
  const [openingBalanceExpr, setOpeningBalanceExpr] = useState(initial ? String(initial.openingBalance) : "");
  const [typeBatchOpen, setTypeBatchOpen] = useState(false);
  // 類型格子改成資產／負債分頁切換，不是兩個全部攤開的格子疊在一起——類型一多，兩份
  // 都攤開會很雜。編輯既有帳戶時預設停在那個帳戶原本所屬的分頁。
  const [typeKindTab, setTypeKindTab] = useState<AccountKind>(
    () => accountTypes.find((t) => t.id === initial?.accountTypeId)?.kind ?? "asset",
  );
  // 編輯既有帳戶時，資產／負債要打字確認才換得了——那是一個會追溯改寫歷史的動作，
  // 不該跟「改個名字」一樣順手（理由見下面確認彈窗的說明）。按確認之後這個 state 轉成
  // 要切去的那一邊，實際的切換在使用者打完字按下去時才發生。新增帳戶不受限制：還沒有
  // 任何交易掛在上面，愛怎麼切都沒有後果。
  const isEdit = !!initial;
  const [pendingKind, setPendingKind] = useState<AccountKind | null>(null);

  const balanceNum = evaluateExpr(openingBalanceExpr);
  const isDuplicateName = accountNameTaken(accounts, name, excludeId);
  const canSave = name.trim() && accountTypeId && Number.isFinite(balanceNum) && balanceNum >= 0 && !isDuplicateName;
  const visibleTypes = accountTypesByKind(accountTypes, typeKindTab);
  const selectedKind = accountTypes.find((t) => t.id === accountTypeId)?.kind;

  /** 選類型時順便把名稱帶出來。
   *
   *  絕大多數人一個類型底下就一個帳戶（「銀行帳戶」類型底下一個叫「銀行帳戶」的帳戶），
   *  選完類型再把同一個詞打一次是多餘的一步。所以選到類型時名稱自動帶上類型名稱，
   *  要分辨同類型的兩個帳戶（兩張信用卡、兩個銀行戶頭）時再自己改掉就好——名稱欄位
   *  留著不拿掉，正是為了這種情況；全部拿掉的話那兩個帳戶在清單、帳戶選擇彈窗裡會
   *  變成一模一樣的兩列，分不出誰是誰。
   *
   *  已經自己打過名稱就不覆蓋，不然打到一半換個類型，打好的字會不見。 */
  function chooseType(id: string, types: AccountTypeDTO[] = accountTypes) {
    setAccountTypeId(id);
    if (nameTouched) return;
    const typeName = types.find((t) => t.id === id)?.name ?? "";
    // 類型名稱已經被某個帳戶用掉了就不帶，省得一選就跳出「名稱重複」的紅字。
    setName(typeName && !accountNameTaken(accounts, typeName, excludeId) ? typeName : "");
  }

  function switchTypeKindTab(kind: AccountKind) {
    if (kind === typeKindTab) return;
    // 編輯既有帳戶：先問過再換。
    if (isEdit) {
      setPendingKind(kind);
      return;
    }
    applyTypeKindTab(kind);
  }

  function applyTypeKindTab(kind: AccountKind) {
    setTypeKindTab(kind);
    // 切分頁之後畫面上看到的格子換了一批，原本選的類型（屬於另一個分頁）不該繼續悄悄
    // 生效——逼使用者在目前這個分頁裡重新選一次，不然會變成「畫面顯示資產分頁，存檔
    // 卻存成負債帳戶」這種看不出來的落差。
    setAccountTypeId("");
    // 名稱是上一個類型自動帶出來的話一起清掉，不然會留著「現金錢包」卻在負債分頁。
    if (!nameTouched) setName("");
  }

  // 逐筆依序 POST，理由跟其他批次新增一樣：新類型的 order 是用當下已存在筆數算出來的，
  // 併發送出會拿到同一個 order。建好之後直接選進這個帳戶，不用使用者關掉彈窗後再選一次。
  async function handleCreateTypes(items: AccountTypeBatchItem[]) {
    let latest = accountTypes;
    let firstNewId: string | undefined;
    for (const item of items) {
      const data: { accountType?: AccountTypeDTO; accountTypes?: AccountTypeDTO[] } = await fetch("/api/expenses/account-types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item),
      })
        .then((res) => res.json())
        .catch(() => ({}));
      if (data.accountTypes) {
        latest = data.accountTypes;
        if (!firstNewId && data.accountType) firstNewId = data.accountType.id;
      }
    }
    onAccountTypesChange(latest);
    // 用 chooseType 而不是只設 id：剛建好的類型選進來時名稱也要跟著帶出來。latest 要
    // 傳進去——setAccountTypes 要等重繪才生效，這一刻 accountTypes 裡還沒有這個新類型。
    if (firstNewId) chooseType(firstNewId, latest);
    setTypeBatchOpen(false);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? "編輯帳戶" : "新增帳戶"}
      // 滿版：類型格子本身就有 260px 的捲動高度，再加名稱欄跟底下固定的小鍵盤，卡在
      // 80% 高度時格子只剩兩排，要選個類型得在兩層捲動之間來回。跟新增交易一致。
      fullHeight
      stickyBottom={
        <AmountKeypad
          expr={openingBalanceExpr}
          onExprChange={setOpeningBalanceExpr}
          // 還沒選類型時（剛轉換完類別、或剛切分頁）用分頁那一邊，不要退回「期初餘額」
          // ——人已經切到負債那一頁了，標籤卻還寫餘額，看起來像沒切成功。
          label={(selectedKind ?? typeKindTab) === "liability" ? "期初欠款（輸入正數）" : "期初餘額"}
        />
      }
      footer={
        <ModalFooter
          onClose={onClose}
          onConfirm={() => onSave({ name: name.trim(), accountTypeId, openingBalance: balanceNum })}
          confirmDisabled={!canSave}
          onDelete={onDelete}
        />
      }
    >
      {/* 資產／負債自己一列：它是「先決定要建哪一種帳戶」的分流，不是「類型」這個欄位的
          附屬選項，擠在欄位標籤旁邊會看起來像是類型的某種屬性。
          編輯既有帳戶時這兩顆照樣能按，只是會先跳確認——做成灰掉按不動的話，使用者
          只會覺得壞了，不知道其實有路可以走。 */}
      <div className="flex flex-col gap-1.5">
        <SegmentedControl
          className="self-start"
          value={typeKindTab}
          onChange={switchTypeKindTab}
          options={[
            { value: "asset", label: "資產" },
            { value: "liability", label: "負債" },
          ]}
        />
        {isEdit && <p className={text.faint}>換成另一邊會改寫這個帳戶過去的所有數字，需要打字確認。</p>}
      </div>

      {/* 轉換類別——資產⇄負債。
       *
       *  為什麼要打字確認：帳戶是資產還是負債不是存在帳戶身上，是跟著它的「帳戶類型」
       *  走的（見 lib/expenses/accounts.ts 的 accountKind）。所以換過去那一刻，這個帳戶
       *  底下每一筆既有交易跟轉帳的正負號全部翻轉——資產的支出是扣錢，負債的支出是
       *  欠款增加；轉進資產是加錢，轉進負債是還款。期初金額的意思也從「期初餘額」變成
       *  「期初欠款」。淨資產會一次跳動這個帳戶餘額的兩倍，而且因為報表都是從全部交易
       *  即時重算的，連過去每一個月的淨資產數字都會跟著改——但現實上那幾個月什麼都
       *  沒發生。
       *
       *  這些全部是靜默的、沒有復原機制，所以比照「清除全部資料」用打字確認擋一次。 */}
      <ConfirmModal
        open={pendingKind !== null}
        title={`轉換成${pendingKind === "liability" ? "負債" : "資產"}帳戶`}
        danger
        message={
          <>
            這個帳戶底下所有既有的交易與轉帳，正負號會整個反過來算：
            {pendingKind === "liability"
              ? "原本的支出會變成「欠款增加」，原本轉進來的錢會變成「還款」，期初餘額會變成期初欠款。"
              : "原本的「欠款增加」會變回支出，原本的還款會變回轉入，期初欠款會變成期初餘額。"}
            淨資產會跳動這個帳戶餘額的兩倍，報表裡<span className="font-semibold text-[#4A3B7C]">過去每一個月</span>的淨資產也會跟著改寫。這個動作沒有復原機制。
          </>
        }
        confirmLabel="確定轉換"
        requireText="轉換類別"
        onConfirm={() => {
          if (pendingKind) applyTypeKindTab(pendingKind);
        }}
        onClose={() => setPendingKind(null)}
      />

      <div>
        <span className="mb-2 block text-xs font-medium text-[#9C94C4]">
          類型
          <RequiredMark />
        </span>
        {/* 跟新增消費紀錄的分類格子完全一樣：同一個 OptionGrid、同樣的捲動高度上限，
            而且同樣只有「＋新增」沒有刪除——類型要刪一律去「設定 › 帳戶類型」，跟分類
            只能在「設定 › 收支分類」刪是同一個規則。 */}
        <div className="max-h-[260px] overflow-y-auto">
          <OptionGrid
            options={visibleTypes.map((t) => ({ id: t.id, name: t.name, icon: t.icon, colorClass: categoryColorClass[t.color] }))}
            value={accountTypeId}
            onChange={chooseType}
            onAddClick={() => setTypeBatchOpen(true)}
          />
        </div>
      </div>

      {/* 選了類型就自動帶上同名（見 chooseType），一般情況不用動它；同一個類型底下有
          好幾個帳戶時才需要改成「台新」「國泰」這種分得出來的名字。 */}
      <Field label="名稱" required>
        <input
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setNameTouched(true);
          }}
          className={fieldInputClass}
        />
      </Field>
      {isDuplicateName && <p className="text-xs text-[#D1517E]">已經有同樣名稱的帳戶了，換一個名稱吧。</p>}

      <AccountTypeBatchModal
        open={typeBatchOpen}
        lockedKind={typeKindTab}
        accountTypes={accountTypes}
        onClose={() => setTypeBatchOpen(false)}
        onSave={handleCreateTypes}
      />
    </Modal>
  );
}
