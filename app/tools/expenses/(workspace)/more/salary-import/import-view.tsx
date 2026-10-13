"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Card, CardBody } from "@/components/expenses/card";
import { Button, ButtonLink } from "@/components/expenses/button";
import { PageHeader } from "@/components/expenses/page-header";
import { text } from "@/components/expenses/theme";
import { parseSalaryItemsCSV, groupSalaryItemsByMonth, type ImportSalaryRowResult } from "@/lib/expenses/csv";
import type { SalaryItemTypeDTO } from "@/lib/expenses/salary-types";

type Stage = "pick" | "preview" | "done";

export function SalaryImportView() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [types, setTypes] = useState<SalaryItemTypeDTO[]>([]);
  const [stage, setStage] = useState<Stage>("pick");
  const [fileName, setFileName] = useState("");
  const [results, setResults] = useState<ImportSalaryRowResult[]>([]);
  const [created, setCreated] = useState<string[]>([]);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/expenses/salary-types")
      .then((res) => res.json())
      .then((data: { types?: SalaryItemTypeDTO[] }) => setTypes(data.types ?? []))
      .catch(() => {});
  }, []);

  const validCount = results.filter((r) => r.ok).length;
  const invalidResults = results.filter((r) => !r.ok);

  async function handleFile(file: File) {
    setParseError(null);
    setFileName(file.name);
    try {
      const text = await file.text();
      const { results } = parseSalaryItemsCSV(text, types);
      if (results.length === 0) {
        setParseError("這個檔案裡沒有找到可以解析的資料列，確認一下是不是匯出時用的同一種格式。");
        return;
      }
      setResults(results);
      setStage("preview");
    } catch {
      setParseError("讀取檔案失敗，確認一下是不是 CSV 文字檔。");
    }
  }

  async function handleConfirmImport() {
    const items = results.filter((r) => r.ok && r.item).map((r) => r.item!);
    const records = groupSalaryItemsByMonth(items);
    const data: { created?: string[]; skipped?: string[] } = await fetch("/api/expenses/salary-records/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ records }),
    })
      .then((res) => res.json())
      .catch(() => ({}));
    setCreated(data.created ?? []);
    setSkipped(data.skipped ?? []);
    setStage("done");
  }

  function reset() {
    setStage("pick");
    setResults([]);
    setFileName("");
    setParseError(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div>
      <Link href="/tools/expenses/more" className={`mb-3 inline-block font-medium ${text.muted} hover:text-[#6F5FD6]`}>
        ← 更多
      </Link>
      <PageHeader title="匯入薪資紀錄" description="上傳 CSV 檔案，批次新增薪資紀錄" />

      {stage === "pick" && (
        <Card>
          <CardBody className="flex flex-col items-center gap-4 py-10 text-center">
            <span className="text-3xl">📥</span>
            <div>
              <p className="font-medium text-[#4A3B7C]">選擇 CSV 檔案</p>
              <p className={`mt-1 ${text.muted}`}>
                欄位順序比照匯出格式：月份,類型,金額
                <br />
                月份格式 YYYY-MM；類型欄填「薪資明細類型」頁設定好的名稱
                <br />
                同一個月份有好幾個項目就填好幾列，匯入時會自動合併成一筆紀錄
              </p>
            </div>
            <Button onClick={() => fileRef.current?.click()}>選擇檔案</Button>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
            />
            {parseError && <p className="text-sm text-[#D1517E]">{parseError}</p>}
          </CardBody>
        </Card>
      )}

      {stage === "preview" && (
        <div className="flex flex-col gap-4">
          <Card>
            <CardBody>
              <p className="truncate text-sm font-medium text-[#4A3B7C]">{fileName}</p>
              <div className="mt-3 flex gap-4 text-sm">
                <p className="text-[#4A3B7C]">
                  可匯入 <span className="font-semibold text-[#2FAE82]">{validCount}</span> 筆
                </p>
                {invalidResults.length > 0 && (
                  <p className="text-[#4A3B7C]">
                    有問題 <span className="font-semibold text-[#D1517E]">{invalidResults.length}</span> 筆
                  </p>
                )}
              </div>
            </CardBody>
          </Card>

          {invalidResults.length > 0 && (
            <Card>
              <CardBody>
                <p className="text-sm font-semibold text-[#D1517E]">以下列會被略過，不會匯入</p>
                <ul className="mt-2 flex flex-col divide-y divide-[#F2EEFA]">
                  {invalidResults.map((r) => (
                    <li key={r.row} className="py-2 text-sm text-[#4A3B7C]">
                      <span className="font-medium">第 {r.row} 列</span>
                      <span className={text.muted}>　{r.error}</span>
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          )}

          <div className="flex gap-3">
            <Button variant="secondary" onClick={reset} className="flex-1">
              重新選擇
            </Button>
            <Button onClick={handleConfirmImport} disabled={validCount === 0} className="flex-1">
              確認匯入
            </Button>
          </div>
        </div>
      )}

      {stage === "done" && (
        <div className="flex flex-col gap-4">
          <Card>
            <CardBody className="flex flex-col items-center gap-3 py-10 text-center">
              <span className="text-3xl">✅</span>
              <p className="font-medium text-[#4A3B7C]">已新增 {created.length} 個月份的薪資紀錄</p>
              {skipped.length > 0 && (
                <p className={text.muted}>以下月份已經有紀錄，略過未匯入：{skipped.join("、")}</p>
              )}
              <div className="mt-2 flex gap-3">
                <Button variant="secondary" onClick={reset}>
                  再匯入一次
                </Button>
                <ButtonLink href="/tools/expenses/salary">查看薪資紀錄</ButtonLink>
              </div>
            </CardBody>
          </Card>
        </div>
      )}
    </div>
  );
}
