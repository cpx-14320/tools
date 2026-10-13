"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Card, CardBody, Button, ButtonLink, PageHeader } from "@/components/ui";
import { parseTransactionsCSV, type ImportRowResult } from "@/lib/expenses/csv";
import type { CategoryDTO } from "@/lib/expenses/categories";

type Stage = "pick" | "preview" | "done";

export function ImportView() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [categories, setCategories] = useState<CategoryDTO[]>([]);
  const [stage, setStage] = useState<Stage>("pick");
  const [fileName, setFileName] = useState("");
  const [results, setResults] = useState<ImportRowResult[]>([]);
  const [importedCount, setImportedCount] = useState(0);
  const [duplicateCount, setDuplicateCount] = useState(0);
  const [parseError, setParseError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/expenses/categories")
      .then((res) => res.json())
      .then((data: { categories?: CategoryDTO[] }) => setCategories(data.categories ?? []))
      .catch(() => {});
  }, []);

  const validCount = results.filter((r) => r.ok).length;
  const invalidResults = results.filter((r) => !r.ok);

  async function handleFile(file: File) {
    setParseError(null);
    setFileName(file.name);
    try {
      const text = await file.text();
      const { results } = parseTransactionsCSV(text, categories);
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
    const rows = results.filter((r) => r.ok && r.transaction).map((r) => r.transaction);
    const data: { count?: number; duplicates?: number } = await fetch("/api/expenses/transactions/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows }),
    })
      .then((res) => res.json())
      .catch(() => ({}));
    setImportedCount(data.count ?? 0);
    setDuplicateCount(data.duplicates ?? 0);
    setStage("done");
  }

  function reset() {
    setStage("pick");
    setResults([]);
    setFileName("");
    setParseError(null);
    setDuplicateCount(0);
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div>
      <Link href="/tools/expenses/more" className="mb-3 inline-block text-xs font-medium text-muted hover:text-ink">
        ← 更多
      </Link>
      <PageHeader title="匯入資料" description="上傳 CSV 檔案，批次新增消費紀錄" />

      {stage === "pick" && (
        <Card>
          <CardBody className="flex flex-col items-center gap-4 py-10 text-center">
            <span className="text-3xl">📥</span>
            <div>
              <p className="font-medium">選擇 CSV 檔案</p>
              <p className="mt-1 text-xs text-muted">
                欄位順序比照匯出格式：日期,分類,金額,備註
                <br />
                分類欄可以填完整路徑（例如「網購 › 服飾美妝」）或只填分類名稱
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
            {parseError && <p className="text-sm text-negative">{parseError}</p>}
          </CardBody>
        </Card>
      )}

      {stage === "preview" && (
        <div className="flex flex-col gap-4">
          <Card>
            <CardBody>
              <p className="truncate text-sm font-medium">{fileName}</p>
              <div className="mt-3 flex gap-4 text-sm">
                <p>
                  可匯入 <span className="font-semibold text-positive">{validCount}</span> 筆
                </p>
                {invalidResults.length > 0 && (
                  <p>
                    有問題 <span className="font-semibold text-negative">{invalidResults.length}</span> 筆
                  </p>
                )}
              </div>
            </CardBody>
          </Card>

          {invalidResults.length > 0 && (
            <Card>
              <CardBody>
                <p className="text-sm font-semibold text-negative">以下列會被略過，不會匯入</p>
                <ul className="mt-2 flex flex-col divide-y divide-line">
                  {invalidResults.map((r) => (
                    <li key={r.row} className="py-2 text-sm">
                      <span className="font-medium">第 {r.row} 列</span>
                      <span className="text-muted">　{r.error}</span>
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
              確認匯入 {validCount} 筆
            </Button>
          </div>
        </div>
      )}

      {stage === "done" && (
        <Card>
          <CardBody className="flex flex-col items-center gap-3 py-10 text-center">
            <span className="text-3xl">✅</span>
            <p className="font-medium">已匯入 {importedCount} 筆消費紀錄</p>
            {duplicateCount > 0 && <p className="text-xs text-muted">其中 {duplicateCount} 筆跟現有紀錄完全相同，已自動略過</p>}
            <div className="mt-2 flex gap-3">
              <Button variant="secondary" onClick={reset}>
                再匯入一次
              </Button>
              <ButtonLink href="/tools/expenses/transactions">查看消費紀錄</ButtonLink>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
