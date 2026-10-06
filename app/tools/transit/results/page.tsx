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
  // 公車是路線優先（見 components/dream/bus-route-picker-modal.tsx），不是起訖站，網址帶的
  // 是縣市／路線／方向／站牌這四個參數，不是 origin/dest。
  const busCity = params.get("busCity") ?? "";
  const busRoute = params.get("busRoute") ?? "";
  const busDirection = params.get("busDirection") === "1" ? 1 : 0;
  const busStop = params.get("busStop") ?? "";
  // 從「我的行程」點「搜尋班次」進來時，返回按鈕要回到我的行程（而且會自動停在使用者
  // 離開前的那個分頁，見 trips-view.tsx 的 LAST_TAB_KEY），不是回到首頁；首頁搜尋進來的
  // 話維持原本回首頁的行為。
  const from = params.get("from") === "trips" ? "trips" : "home";
  return (
    <ResultsView
      origin={origin}
      dest={dest}
      mode={mode}
      date={date}
      time={time}
      startTime={startTime}
      endTime={endTime}
      busCity={busCity}
      busRoute={busRoute}
      busDirection={busDirection}
      busStop={busStop}
      from={from}
    />
  );
}
