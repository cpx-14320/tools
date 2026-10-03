import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { NewRouteView } from "./new-route-view";

export const metadata: Metadata = { title: "新增監控路線" };

export default function NewRoutePage() {
  return (
    <div>
      <PageHeader title="新增監控路線" description="選運輸工具後，欄位會依類型調整" />
      <NewRouteView />
    </div>
  );
}
