"use client";

import { useSearchParams } from "next/navigation";
import { ResultsView, type Mode } from "./results-view";

const VALID_MODES: Mode[] = ["bus", "train", "metro", "thsr"];

export default function ResultsPage() {
  const params = useSearchParams();
  const origin = params.get("origin") ?? "台北站";
  const dest = params.get("dest") ?? "台中站";
  const modeParam = params.get("mode");
  const mode: Mode = VALID_MODES.includes(modeParam as Mode) ? (modeParam as Mode) : "train";
  const date = params.get("date") ?? "";
  const time = params.get("time") ?? "";
  // 從「我的行程」的常用行程卡片點「搜尋班次」進來時才會帶這兩個參數（卡片本身設定的
  // 時段區間）；首頁搜尋只有單一出發時間，不會帶這兩個參數，維持顯示全部結果的行為。
  const startTime = params.get("startTime") ?? "";
  const endTime = params.get("endTime") ?? "";
  return <ResultsView origin={origin} dest={dest} mode={mode} date={date} time={time} startTime={startTime} endTime={endTime} />;
}
