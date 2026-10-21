import type { Metadata } from "next";
import { CategoriesView } from "./categories-view";

export const metadata: Metadata = { title: "收支分類" };

export default function CategoriesPage() {
  return <CategoriesView />;
}
