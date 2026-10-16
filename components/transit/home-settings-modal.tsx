"use client";

import { useState } from "react";
import { DISTRICTS_BY_CITY } from "@/lib/transit/cwa-districts";
import { StationPickerModal } from "./station-picker-modal";
import { EditorSheet } from "./editor-sheet";
import { AddButton, DragHandle, EditorItemCard, EditorItemHeader, FieldLabel, FieldRow, SelectButton } from "./ui";
import { moveItem, useDragReorder } from "./use-drag-reorder";
import type { WeatherBlock } from "./weather-carousel";

export interface HomeDefaults {
  weatherBlocks: WeatherBlock[];
}

// 跟首頁 home-view.tsx 的 defaultWeatherBlocks() 同一組預設地區（桃園市中壢區、臺北市
// 南港區）——剛註冊、還沒設定過天氣地區的使用者打開這個彈窗時，直接看到這兩個區塊，
// 不要是空的；這個元件自己保底一份，不管呼叫端傳進來的 initial 是不是真的有兩組。
const DEFAULT_WEATHER_BLOCKS: WeatherBlock[] = [
  { id: "default-origin", city: "桃園市", district: "中壢區" },
  { id: "default-dest", city: "臺北市", district: "南港區" },
];

function newWeatherBlock(): WeatherBlock {
  const keys = Object.keys(DISTRICTS_BY_CITY);
  const city = keys[0];
  return { id: crypto.randomUUID(), city, district: DISTRICTS_BY_CITY[city][0] };
}

export function HomeSettingsModal({
  open,
  initial,
  onClose,
  onSave,
}: {
  open: boolean;
  initial: HomeDefaults;
  onClose: () => void;
  onSave: (defaults: HomeDefaults) => void;
}) {
  const [draft, setDraft] = useState<HomeDefaults>(
    initial.weatherBlocks.length > 0 ? initial : { weatherBlocks: DEFAULT_WEATHER_BLOCKS },
  );
  // 天氣地區改用跟首頁出發／抵達站同一顆 StationPickerModal（城市＋鄉鎮區雙欄彈窗），
  // 不用瀏覽器原生的 <select>；好幾個區塊共用同一顆彈窗實例，用這個 index 記住現在在
  // 編輯哪一個區塊，不用每個區塊各自掛一顆。
  const [blockEditIndex, setBlockEditIndex] = useState<number | null>(null);
  // 區塊順序就是首頁天氣卡左右並排的順序，拖曳改這個陣列、按儲存就生效。
  const drag = useDragReorder(
    draft.weatherBlocks.length,
    (from, to) => setDraft((d) => ({ ...d, weatherBlocks: moveItem(d.weatherBlocks, from, to) })),
    () => {},
  );

  function updateBlock(index: number, patch: Partial<WeatherBlock>) {
    setDraft((d) => ({ ...d, weatherBlocks: d.weatherBlocks.map((block, i) => (i === index ? { ...block, ...patch } : block)) }));
  }

  function removeBlock(index: number) {
    setDraft((d) => ({ ...d, weatherBlocks: d.weatherBlocks.filter((_, i) => i !== index) }));
  }

  const editingBlock = blockEditIndex !== null ? draft.weatherBlocks[blockEditIndex] : null;
  const editingSafeCity = editingBlock && DISTRICTS_BY_CITY[editingBlock.city] ? editingBlock.city : Object.keys(DISTRICTS_BY_CITY)[0];

  return (
    <EditorSheet open={open} title="首頁設定" onClose={onClose} onSave={() => onSave(draft)}>
      <div className="flex flex-col gap-3">
        <FieldLabel>天氣地區</FieldLabel>
        {/* 說明文字走 EditorSheet 的 description 太長（這一段是在解釋「區塊」這個概念
            怎麼變成首頁的卡片），放在欄位標籤底下，字級照設計系統的備註說明。 */}
        <p className="text-xs text-[#9C94C4]">
          每個區塊會自動展開成「今天」「明天」兩張首頁輪播卡，可新增多個區塊；按住左邊的握把可以拖曳調整順序。
        </p>

        {draft.weatherBlocks.map((block, i) => {
          const safeCity = DISTRICTS_BY_CITY[block.city] ? block.city : Object.keys(DISTRICTS_BY_CITY)[0];
          const districts = DISTRICTS_BY_CITY[safeCity] ?? [];
          const safeDistrict = districts.includes(block.district) ? block.district : districts[0];
          return (
            <div key={block.id} ref={drag.rowRef(i)} className={drag.rowClass(i)}>
              <EditorItemCard>
                <EditorItemHeader
                  index={i}
                  unit="區塊"
                  onDelete={draft.weatherBlocks.length > 1 ? () => removeBlock(i) : undefined}
                  dragHandle={<DragHandle label={`拖曳排序 第 ${i + 1} 區塊`} {...drag.handleProps(i)} />}
                />

                <FieldRow>
                  <SelectButton chevron={false} value={safeCity} onClick={() => setBlockEditIndex(i)} />
                  <SelectButton value={safeDistrict} onClick={() => setBlockEditIndex(i)} />
                </FieldRow>
              </EditorItemCard>
            </div>
          );
        })}

        <AddButton onClick={() => setDraft((d) => ({ ...d, weatherBlocks: [...d.weatherBlocks, newWeatherBlock()] }))}>新增區塊</AddButton>
      </div>

      <StationPickerModal
        key={blockEditIndex !== null ? `block-${blockEditIndex}` : "block-closed"}
        open={blockEditIndex !== null}
        title="選擇天氣地區"
        cities={DISTRICTS_BY_CITY}
        initialCity={editingSafeCity}
        initialStation={editingBlock?.district ?? ""}
        onClose={() => setBlockEditIndex(null)}
        onSave={(city, district) => {
          if (blockEditIndex !== null) updateBlock(blockEditIndex, { city, district });
          setBlockEditIndex(null);
        }}
      />
    </EditorSheet>
  );
}
