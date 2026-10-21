import type { Metadata } from "next";
import { PetView } from "./pet-view";

export const metadata: Metadata = { title: "養成" };

export default function PetPage() {
  return <PetView />;
}
