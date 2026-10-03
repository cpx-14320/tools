import type { Metadata } from "next";
import { TimetableView } from "./timetable-view";

export const metadata: Metadata = { title: "時刻表查詢" };

export default function TimetablePage() {
  return <TimetableView />;
}
