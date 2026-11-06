import type { Metadata } from "next";
import { PetView } from "./pet-view";
import { expensesPetState } from "@/lib/expenses/page-data.server";

export const metadata: Metadata = { title: "養成" };
export const dynamic = "force-dynamic";

export default async function PetPage() {
  // 養成頁要的是 expensesPetState() 那一次結算的結果，不是自己再結算一次：獎勵是
  // 「發過就不再發」的，自己再跑一次 settlePetRewards 的話 justEarned 會是空的，
  // 「獲得 N 顆星星幣」那句提示就永遠不會出現（cache 過，layout 先跑也是同一批）。
  //
  // 帳戶／交易／轉帳那幾份不再讀了：它們以前只拿來算淨資產、顯示「理財段位」那一行，
  // 那行字拿掉之後這一頁已經跟記帳資料無關，卻還是每次都把整份交易紀錄撈出來。
  const pet = await expensesPetState();
  return <PetView initialPet={pet} />;
}
