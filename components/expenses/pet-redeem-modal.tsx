"use client";

import { useState } from "react";
import { PetModal, PetModalButton } from "./pet-modal";

/** 活動序號——從狀態列那個星星幣框點進來，輸入序號換星星幣。
 *
 *  **為什麼入口是星星幣框**：使用者想到「我要更多星星幣」的時候，眼睛本來就在那個數字上。
 *  另外在場地上多開一顆「活動」按鈕，平常九成九的時間都用不到，卻要一直佔著版面。
 *
 *  輸錯不清空輸入框：多半是打錯一個字，整串被清掉就得重打。成功才清空，方便連續輸入
 *  同一組（目前這組是可以重複換的，見 pet.server.ts 的 redeemCode）。 */
export function PetRedeemModal({
  open,
  onClose,
  onRedeem,
}: {
  open: boolean;
  onClose: () => void;
  /** 回傳錯誤訊息（null ＝ 成功）。實際的兌換在呼叫端打 API。 */
  onRedeem: (code: string) => Promise<string | null>;
}) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!code.trim() || busy) return;
    setBusy(true);
    setError(null);
    setDone(null);
    const failed = await onRedeem(code.trim());
    setBusy(false);
    if (failed) {
      setError(failed);
      return;
    }
    setDone("兌換成功，星星幣已經加上去了");
    setCode("");
  }

  function close() {
    setCode("");
    setError(null);
    setDone(null);
    onClose();
  }

  return (
    <PetModal
      open={open}
      onClose={close}
      title="序號兌換"
      subtitle="輸入序號，領取獎勵"
      footer={
        <PetModalButton disabled={busy || code.trim().length === 0} onClick={submit}>
          {busy ? "兌換中…" : "兌換"}
        </PetModalButton>
      }
    >
      <input
        value={code}
        onChange={(e) => {
          setCode(e.target.value);
          setError(null);
          setDone(null);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") void submit();
        }}
        placeholder="請輸入序號"
        autoComplete="off"
        spellCheck={false}
        className="w-full rounded-2xl border-2 border-[#E3D4F5] bg-white/85 px-4 py-2.5 text-center text-sm font-bold tracking-wider text-[#5B3B8C] outline-none placeholder:font-normal placeholder:tracking-normal placeholder:text-[#B9A6D6] focus:border-[#9B7BD6]"
      />

      {error && <p className="text-center text-xs font-medium text-[#D1517E]">{error}</p>}
      {done && <p className="text-center text-xs font-medium text-[#2FAE82]">{done}</p>}
    </PetModal>
  );
}
