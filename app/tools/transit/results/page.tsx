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
  return <ResultsView origin={origin} dest={dest} mode={mode} />;
}
