// 帳本共享／邀請成員是下一階段才做的功能（見 members/page.tsx、app/tools/expenses/ledgers/page.tsx），
// 這次記帳本資料層全面改接真的 MongoDB 之後，分類／薪資／消費/目標都已經不再是假資料了，
// 只剩「帳本」「成員」這兩個概念還停在純展示用的假資料階段，先留在這個獨立檔案裡。

export interface Member {
  id: string;
  name: string;
  role: "owner" | "member";
}

export const ledger = {
  name: "我的帳本",
  inviteCode: "HM3K9X",
};

export const members: Member[] = [{ id: "m1", name: "我", role: "owner" }];
