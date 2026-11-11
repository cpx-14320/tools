"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Button } from "./button";
import { text } from "./theme";
import { TRASH_RESTORE_NOTE } from "@/lib/expenses/trash";
import { useAsyncAction } from "./use-async-action";
import { useBusy } from "./busy";

// placeholder 的顏色寫在這裡，不要讓瀏覽器自己配灰色：同一列裡常常一邊是真 input、
// 一邊是假成輸入框的 SelectField（它的提示文字是自己畫的 #B3ABD4，見 select-field.tsx），
// 兩種灰擺在一起會看得出不是同一種欄位。
export const fieldInputClass =
  "w-full rounded-2xl border border-[#ECE4FA] bg-white px-4 py-2.5 text-sm text-[#4A3B7C] outline-none placeholder:text-[#B3ABD4] focus:border-[#6F5FD6]";

/** 表單欄位的標籤＋內容。
 *
 *  必填的欄位傳 `required`，標籤後面補一顆紅色星號。中文表單的慣例是「標必填」而不是
 *  「標選填」——以前是反過來的（「帳戶（可不填）」「備註（可不填）」），結果每個可選
 *  欄位都拖著三個字的尾巴，真正非填不可的那幾欄反而沒有任何記號。 */
/** 必填記號。判斷標準只有一個：**這一欄沒填會讓「儲存」按不下去**（也就是它出現在那個
 *  彈窗的 canSave 條件裡）。
 *
 *  所以切換鈕（收支類型、資產／負債、頻率）一律不標——它們一開始就有值，沒有「沒填」
 *  這個狀態，標了反而像是在要求使用者做什麼。有預設值、留空也能存的（備註、帳戶、
 *  循環次數、顏色）同樣不標。
 *
 *  獨立出來是因為不是每個必填欄位都包在 Field 裡：分類格子、圖示挑選器、「項目」那一排
 *  都是自己手刻的標籤，要用同一顆記號才不會兩種顏色兩種間距。 */
export function RequiredMark() {
  return (
    <span aria-hidden className="ml-0.5 text-[#D1517E]">
      *
    </span>
  );
}

export function Field({ label, children, required = false }: { label: string; children: ReactNode; required?: boolean }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className={text.label}>
        {label}
        {required && <RequiredMark />}
      </span>
      {children}
    </label>
  );
}

/** 記帳本共用彈窗外殼，比照搭乘車的 BottomSheetModal（components/transit/bottom-sheet-modal.tsx）：
 *  用 createPortal 掛到 document.body，不是直接畫在呼叫端的 DOM 位置——ExpensesMobileShell
 *  的卡片容器本身有 transform（見 expenses-mobile-nav.tsx 的說明），fixed 子孫的疊圖順序在
 *  部分行動裝置瀏覽器上不可靠，掛到 document.body 之後完全脫離那個脈絡，不會再被牽連。
 *  手機寬度從底部彈出（rounded-t-[1.75rem]），桌面寬度跟卡片容器一起置中，寬度對齊
 *  ExpensesMobileShell 的 max-w-[430px]。 */
export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  /** 內容很多的彈窗（例如新增交易：分類格子＋小鍵盤＋一堆欄位）可以撐到滿版高度，
   *  不要卡在 80% 讓可視區太短。 */
  fullHeight = false,
  /** 固定在內容區下方、不跟著捲動的那一塊（新增交易的小鍵盤用）——放在這裡而不是
   *  children 裡面，使用者捲動上面的資訊時鍵盤才會一直留在原地。 */
  stickyBottom,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children?: ReactNode;
  footer?: ReactNode;
  fullHeight?: boolean;
  stickyBottom?: ReactNode;
}) {
  // createPortal 需要 document 存在，伺服器端渲染時還沒有，掛載後才真的 portal 出去，
  // 避免 SSR／CSR 的輸出不一致——跟 BottomSheetModal 同一招。
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    /* eslint-disable-next-line react-hooks/set-state-in-effect */
    setMounted(true);
  }, []);

  if (!open || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-50" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30" />
      <div className="relative flex h-full w-full justify-center px-0 py-0 sm:px-4 sm:py-6">
        {/* max-h-dvh：sm 以上固定 850px 高是為了模擬手機卡片，但瀏覽器視窗比 850 矮時
            （筆電常見）彈窗會長到畫面外、「儲存」按不到，而且外層沒有捲軸可以捲下去。 */}
        <div className="flex h-dvh max-h-dvh w-full max-w-[430px] items-end sm:h-[850px]">
          <div
            // 滿版的彈窗不要上圓角：圓角切掉的那兩個角會透出底下那層的顏色，看起來像
            // 沒蓋滿。只有半高的彈窗需要圓角，那是它「從下面滑上來」的視覺。
            className={`flex w-full flex-col overflow-hidden bg-white ${fullHeight ? "h-full max-h-full" : "max-h-[80%] rounded-t-[1.75rem]"}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-[#ECE4FA] px-5 py-4">
              <p className="font-semibold text-[#4A3B7C]">{title}</p>
              <button
                type="button"
                onClick={onClose}
                aria-label="關閉"
                className="grid size-8 place-items-center rounded-full text-[#9C94C4] hover:bg-[#F3EFFC]"
              >
                ✕
              </button>
            </div>

            {/* 標題、stickyBottom 跟 footer 固定不動，只有這一段內容自己捲動——不然表單一長，
                連「取消／儲存」都會被捲出畫面外。

                `[&>*]:shrink-0` 不能拿掉：這一段是 flex column，而 flex 子項目預設
                `flex-shrink: 1`。螢幕矮、內容又長的時候（手機開「日期範圍」那 12 列），
                瀏覽器會先把子項目的「盒子」壓到塞得下，裡面的內容卻不會跟著縮——結果
                盒子的高度等於可視高度，捲動區算出來的 scrollHeight 就跟 clientHeight
                一樣，overflow-y-auto 判定「沒有東西溢出、不用捲」，可是超出去的那幾列
                早就被外層的 overflow-hidden 切掉了。畫面上就是：最後幾個選項看不到，
                而且怎麼滑都滑不出來。禁止子項目被壓縮，內容才會真的溢出、捲軸才會生效。 */}
            {/* 沒有內容時整塊不渲染：它有 py-5 的留白，空著的話標題跟底下那條（鍵盤或
                按鈕列）中間會多出一段沒有東西的空白，看起來像少載了什麼。存入金額那個
                彈窗就是這種——輸入完全在底下的數字鍵盤上完成。 */}
            {children ? <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-5 [&>*]:shrink-0">{children}</div> : null}

            {stickyBottom && <div className="shrink-0 border-t border-[#ECE4FA] px-5 py-3">{stickyBottom}</div>}

            {footer && <div className="flex shrink-0 items-center justify-between gap-2 border-t border-[#ECE4FA] px-5 py-4">{footer}</div>}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** 彈窗底部那排按鈕：左邊（可選）刪除、右邊取消＋主要動作。
 *
 *  記帳本十幾個彈窗本來各自手刻同一段「onDelete ? 刪除 : <span />，右邊再放取消跟儲存」，
 *  連紅色刪除字的色碼都是各自複製的。集中成這一個，之後要調整按鈕順序或樣式只要改一次。
 *
 *  儲存鍵自己防連點：onConfirm 多半是「打 API →（成功才）關彈窗」的非同步流程，在回應
 *  回來之前按鈕還是能按的，手快點兩下就會送出兩筆一模一樣的資料。這裡在送出期間把它
 *  鎖住——用 ref 擋同一個 tick 內的第二次點擊（state 要等重繪才生效，擋不住），state
 *  只負責讓按鈕變成不能按的樣子。 */
export function ModalFooter({
  onClose,
  onConfirm,
  confirmLabel = "儲存",
  confirmDisabled = false,
  disabledHint,
  onDelete,
  deleteLabel = "刪除",
  deleteConfirm,
  secondary,
}: {
  onClose: () => void;
  /** 回傳 Promise 的話（呼叫端的 onSave 是 async function 就會是），送出期間儲存鍵會
   *  鎖住，等它結束才解鎖。 */
  onConfirm: () => void | Promise<unknown>;
  confirmLabel?: string;
  confirmDisabled?: boolean;
  /** 儲存鍵為什麼不能按——只在 confirmDisabled 而且沒有刪除鍵時顯示，佔的就是刪除鍵
   *  那個位置（新增用的彈窗本來就空在那裡）。灰掉的按鈕不講原因，使用者只會反覆點它。 */
  disabledHint?: ReactNode;
  /** 有給才顯示左下角的刪除；新增用的彈窗不給，位置用空元素佔著維持左右分佈。 */
  onDelete?: () => void | Promise<unknown>;
  deleteLabel?: string;
  /** 刪除前的二次確認。
   *
   *  **預設一定會問**。這顆按鈕就在「儲存」的同一排、離輸入欄位很近，刪掉的又是使用者
   *  自己一筆一筆記的資料——實際發生過：編輯一筆交易時手滑點到刪除，當下根本不知道刪了
   *  什麼。現在刪掉的東西會進垃圾桶（還救得回來），所以這一關的作用是「讓人看清楚自己
   *  要刪什麼」，不是嚇阻。
   *
   *  傳 false 代表呼叫端自己已經有一套更清楚的確認（例如刪分類要先講「底下五個子分類
   *  會一起不見」），不要再疊第二層。 */
  deleteConfirm?: false | { title?: string; message?: ReactNode };
  /** 左下角那個位置的**非破壞性**動作（篩選彈窗的「清除條件」這種）。
   *
   *  不要為了借位置而改用 onDelete：那顆是紅字、而且預設會跳一次「確定要刪除嗎、東西會
   *  先進最近刪除」的二次確認——把「取消勾選」講成刪除資料，使用者會不敢按。 */
  secondary?: { label: string; onClick: () => void };
}) {
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const runBusy = useBusy();
  // 刪除也要擋連點，理由同 confirm-modal.tsx。
  //
  // 「進行中」統一由共用的處理中遮罩表示（見 busy.tsx），按鈕文字不換：以前有的按鈕按下去
  // 會變成「處理中…」、有的不會，同一個 app 裡兩種回饋方式只會讓人懷疑沒變字的那顆是不是
  // 沒按到。遮罩蓋住整張卡片，而且每一條會跑一陣子的路徑（存檔、刪除、還原、批次）都是
  // 同一個樣子。
  const deleteAction = useAsyncAction(async () => {
    await runBusy("刪除中…", async () => {
      await onDelete?.();
    });
    setConfirmingDelete(false);
  });

  async function handleConfirm() {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      await runBusy("儲存中…", async () => {
        await onConfirm();
      });
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  return (
    <>
      {onDelete ? (
        <Button
          variant="ghost"
          className="text-[#D1517E] hover:text-[#D1517E]"
          onClick={() => (deleteConfirm === false ? onDelete() : setConfirmingDelete(true))}
        >
          {deleteLabel}
        </Button>
      ) : secondary ? (
        <Button variant="ghost" onClick={secondary.onClick}>
          {secondary.label}
        </Button>
      ) : confirmDisabled && disabledHint ? (
        <p className={`min-w-0 flex-1 pr-2 ${text.muted}`}>{disabledHint}</p>
      ) : (
        <span />
      )}
      <div className="flex items-center gap-2">
        <Button variant="ghost" onClick={onClose}>
          取消
        </Button>
        <Button disabled={confirmDisabled || saving} onClick={handleConfirm}>
          {confirmLabel}
        </Button>
      </div>

      {/* 確認用的小彈窗直接用 Modal 自己組，不是沿用 ConfirmModal——後者 import 這個檔案，
          反過來 import 它會變成循環相依。這裡只要一句話加兩顆按鈕，不值得為它冒那個險。 */}
      {onDelete && deleteConfirm !== false && (
        <Modal
          open={confirmingDelete}
          onClose={() => setConfirmingDelete(false)}
          title={deleteConfirm?.title ?? `確定要${deleteLabel}嗎？`}
          footer={
            <div className="flex w-full items-center justify-end gap-2">
              <Button variant="ghost" onClick={() => setConfirmingDelete(false)}>
                取消
              </Button>
              <Button
                className="!shadow-none"
                style={{ background: "#D1517E" }}
                disabled={deleteAction.busy}
                onClick={deleteAction.run}
              >
                {deleteLabel}
              </Button>
            </div>
          }
        >
          <p className={`${text.body} leading-relaxed`}>{deleteConfirm?.message ?? TRASH_RESTORE_NOTE}</p>
        </Modal>
      )}
    </>
  );
}
