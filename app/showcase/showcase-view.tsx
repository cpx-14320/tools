import type { ReactNode } from "react";
import Link from "next/link";
import { Card, CardBody, Badge, ButtonLink } from "@/components/ui";

const NAV_ITEMS = [
  { id: "intro", label: "專案總覽" },
  { id: "stack", label: "技術棧" },
  { id: "home", label: "首頁與本機記憶" },
  { id: "bus", label: "公車查詢設計" },
  { id: "rail", label: "火車・高鐵・捷運" },
  { id: "trips", label: "行程・備忘錄・天氣" },
  { id: "api", label: "API 串接與快取" },
  { id: "expenses", label: "記帳本模組" },
  { id: "uiux", label: "UI/UX 設計系統" },
  { id: "highlights", label: "專案特色" },
] as const;

function Section({ id, index, title, lead, children }: { id: string; index: string; title: string; lead?: ReactNode; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24">
      <div className="mb-4 flex items-baseline gap-3">
        <span className="font-mono text-xs font-bold tracking-widest text-violet">{index}</span>
        <h2 className="text-xl font-bold tracking-tight text-ink">{title}</h2>
      </div>
      {lead && <p className="mb-5 max-w-3xl text-sm leading-relaxed text-muted">{lead}</p>}
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}

/** 深色技術筆記卡——用品牌深紫當背景，跟整頁的淺色馬卡龍基調拉出對比，標記「這是技術
 *  細節／架構決策」的段落，閱讀時一眼就能跟一般說明文字分開。 */
function TechNote({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-[1.5rem] bg-brand p-5 text-brand-fg">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-violet">{title}</p>
      <div className="text-sm leading-relaxed text-white/90">{children}</div>
    </div>
  );
}

function SubCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card>
      <CardBody>
        <h3 className="mb-2 font-semibold text-ink">{title}</h3>
        <div className="flex flex-col gap-2 text-sm leading-relaxed text-muted">{children}</div>
      </CardBody>
    </Card>
  );
}

function KeyCapRow({ keys }: { keys: { label: string; tone?: string }[] }) {
  const TONE: Record<string, string> = {
    紅: "bg-[#FBE1EA] text-[#D1517E]",
    藍: "bg-[#DCEAFC] text-[#3B6FD1]",
    綠: "bg-[#DFF4EB] text-[#2FAE82]",
    棕: "bg-[#F1E4D8] text-[#9C6B3E]",
    橘: "bg-[#FDE7D8] text-[#D97A3D]",
    黃: "bg-[#FBF2D2] text-[#C99A1E]",
  };
  return (
    <div className="flex flex-wrap gap-1.5">
      {keys.map((k, i) => (
        <span
          key={i}
          className={`inline-flex min-w-[2rem] items-center justify-center rounded-lg px-2 py-1 text-xs font-semibold ${TONE[k.tone ?? ""] ?? "bg-surface-2 text-ink"}`}
        >
          {k.label}
        </span>
      ))}
    </div>
  );
}

export function ShowcaseView() {
  return (
    <div className="min-h-screen">
      {/* 頂部固定導覽：橫向排列＋手機上可以左右滑，不用為手機另外刻一套折疊選單。 */}
      <header className="sticky top-0 z-10 border-b border-line bg-surface/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-5 py-3">
          <Link href="/" className="shrink-0 text-sm font-bold tracking-tight text-ink">
            搭車咻一下
          </Link>
          <nav className="flex min-w-0 flex-1 gap-4 overflow-x-auto text-xs text-muted [scrollbar-width:none]">
            {NAV_ITEMS.map((item) => (
              <a key={item.id} href={`#${item.id}`} className="shrink-0 whitespace-nowrap py-1 hover:text-ink">
                {item.label}
              </a>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto flex max-w-5xl flex-col gap-14 px-5 py-10">
        {/* Hero */}
        <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-2xl">
            <Badge tone="brand">技術作品介紹</Badge>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-ink sm:text-4xl">搭車咻一下</h1>
            <p className="mt-3 text-base leading-relaxed text-muted">
              整合公車、火車、捷運與高鐵的個人化交通查詢平台，從即時到站、誤點時刻表到票價試算一次查齊；
              另外內建「我的行程」「備忘錄」「天氣」等個人化工具，記住每個使用者的查詢習慣，減少每次重新選站的麻煩。
              這個頁面以前端工程師的角度，逐一說明每個功能背後的技術決策與踩過的坑。
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {["Next.js (App Router)", "React", "TypeScript", "Tailwind CSS", "MongoDB", "TDX 交通資料"].map((t) => (
                <Badge key={t}>{t}</Badge>
              ))}
            </div>
            <div className="mt-6 flex gap-2.5">
              <ButtonLink href="/">回工具首頁</ButtonLink>
              <ButtonLink href="#intro" variant="secondary">
                開始閱讀 ↓
              </ButtonLink>
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            {["/transit/mode-bus.png", "/transit/mode-train.png", "/transit/mode-metro.png", "/transit/mode-thsr.png"].map((src) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={src} src={src} alt="" className="size-16 object-contain sm:size-20" />
            ))}
          </div>
        </div>

        {/* 01 專案總覽 */}
        <Section
          id="intro"
          index="01"
          title="專案總覽"
          lead="一個人開發、一個人用的工具，但刻意照正式產品的規格做：有帳號系統、有工具權限管控，每個功能都串接真實資料，不是能動的靜態頁面。"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <SubCard title="為什麼要做這個">
              每天通勤要分別開好幾個 App 查公車、查火車誤點、查高鐵票價，資訊分散又重複輸入站名。
              「搭車咻一下」把四種交通工具整合進同一套查詢流程，並記住常用路線與查詢習慣，
              目標是「打開就能查，查完就走」，不是另一個要重新學習操作的 App。
            </SubCard>
            <SubCard title="涵蓋範圍">
              <p>
                <strong className="text-ink">交通查詢：</strong>公車路線／即時到站、火車時刻表與誤點、高鐵班次與票價、捷運轉乘試算。
              </p>
              <p>
                <strong className="text-ink">個人化工具：</strong>我的行程（常用路線分類管理）、備忘錄、天氣輪播、記帳本。
              </p>
              <p>
                <strong className="text-ink">帳號系統：</strong>登入驗證＋逐工具的使用權限（RBAC-lite），不是整站公開或整站私有這種二元權限。
              </p>
            </SubCard>
          </div>
        </Section>

        {/* 02 技術棧 */}
        <Section id="stack" index="02" title="技術棧" lead="前端框架、型別系統、樣式方案跟資料庫的選擇，以及為什麼這樣分層。">
          <div className="grid gap-4 sm:grid-cols-2">
            <SubCard title="Next.js App Router ・ Server／Client 分工">
              每個頁面固定拆成兩層：<code className="rounded bg-surface-2 px-1 py-0.5 text-xs">page.tsx</code> 留在 Server
              Component，只負責 metadata 跟掛載畫面；真正有互動、會呼叫 API、會用到 <code className="rounded bg-surface-2 px-1 py-0.5 text-xs">localStorage</code>{" "}
              的邏輯，拆到旁邊掛 <code className="rounded bg-surface-2 px-1 py-0.5 text-xs">&quot;use client&quot;</code> 的{" "}
              <code className="rounded bg-surface-2 px-1 py-0.5 text-xs">-view.tsx</code>。兩層關注點分開，之後要加 SEO
              metadata 或改互動邏輯都不會動到另一邊。
            </SubCard>
            <SubCard title="TypeScript 全專案型別">
              每個資料來源都先定義介面再寫邏輯：TDX 回應型別（<code className="rounded bg-surface-2 px-1 py-0.5 text-xs">OdFareEntry</code>、
              <code className="rounded bg-surface-2 px-1 py-0.5 text-xs">TrainTimetableEntry</code> 等）、資料庫文件型別（
              <code className="rounded bg-surface-2 px-1 py-0.5 text-xs">XxxDoc</code>）跟前端用的 DTO 分開定義，避免把資料庫欄位
              （例如 <code className="rounded bg-surface-2 px-1 py-0.5 text-xs">ObjectId</code>）意外洩漏到前端。
            </SubCard>
            <SubCard title="Tailwind CSS 4 ・ 設計 Token 驅動">
              色彩不是寫死在元件裡的 hex 碼，而是在 <code className="rounded bg-surface-2 px-1 py-0.5 text-xs">globals.css</code>{" "}
              用 CSS 變數定義一份（品牌色、分類色、正負向色各一組），再透過{" "}
              <code className="rounded bg-surface-2 px-1 py-0.5 text-xs">@theme inline</code> 接進 Tailwind 的色票系統，
              全站的 <code className="rounded bg-surface-2 px-1 py-0.5 text-xs">bg-brand</code>／
              <code className="rounded bg-surface-2 px-1 py-0.5 text-xs">text-cat-a-fg</code> 這類 class 都從同一個源頭出來，改一處視覺就全站一致。
            </SubCard>
            <SubCard title="MongoDB ・ 原生 Driver">
              不透過 ORM，直接用 MongoDB 原生 driver。<code className="rounded bg-surface-2 px-1 py-0.5 text-xs">lib/mongodb.ts</code>{" "}
              統一管理連線池，掛載時順便把所有索引（唯一索引、TTL 索引）一次建好，新增集合只要在這裡補一行，
              不用另外寫 migration 腳本。
            </SubCard>
          </div>
        </Section>

        {/* 03 首頁與本機記憶 */}
        <Section
          id="home"
          index="03"
          title="首頁與本機記憶"
          lead="交通查詢首頁要同時服務公車／火車／捷運／高鐵四種完全不同的查詢模型，而且使用者多半每天查同一條路線——重點是「記住」，不是每次都要重新選。"
        >
          <SubCard title="localStorage 記住的東西">
            <ul className="list-disc space-y-1 pl-5">
              <li>上次切到哪個車種分頁，下次打開直接停在同一個分頁</li>
              <li>公車上次選的縣市，不用每次重新挑</li>
              <li>火車／高鐵／捷運上次查詢的起訖站，掛載後自動回填</li>
              <li>「我的行程」清單上次切到哪個車種分類</li>
            </ul>
          </SubCard>
          <TechNote title="Hydration 安全模式">
            Next.js 會先在伺服器端渲染一次頁面，伺服器端沒有 <code className="opacity-90">localStorage</code>
            ，如果 React 初始 state 直接讀取它，伺服器端渲染結果跟瀏覽器端重新計算的結果會不一致，觸發
            hydration mismatch 警告。這裡的作法是：所有會讀 <code className="opacity-90">localStorage</code>{" "}
            的 state，初始值一律先給 SSR 安全的固定值（<code className="opacity-90">0</code> 或{" "}
            <code className="opacity-90">null</code>），掛載後再用一個 <code className="opacity-90">useEffect</code>{" "}
            讀取並套用真正的記憶值——骨架數量、表單預設值、分頁選取狀態全部走這個模式，
            畫面上看起來只是「資料晚一瞬間回填」，不會有 React 警告或畫面閃爍。
          </TechNote>
        </Section>

        {/* 04 公車查詢設計 */}
        <Section
          id="bus"
          index="04"
          title="公車查詢設計"
          lead="公車跟火車／捷運最大的不同：沒有固定的「起訖站」概念，是「路線優先」——使用者通常知道要搭哪條路線或站在哪個站牌，而不是輸入兩個站點查路徑。這也是整個專案裡在互動細節上花最多心思的一塊。"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <SubCard title="不讓彈窗一開就打 API">
              查詢彈窗一打開，輸入框是空字串——這時完全不送出任何請求，要先選縣市、再輸入站名或路線關鍵字
              才會觸發查詢。每打一個字會 debounce 200ms 再查，同一個「縣市＋關鍵字」組合在短時間內查過
              就直接吃快取，不重複打 API。這三層（空字串擋、debounce、快取）疊在一起，一次查詢流程下來
              真正打到 TDX 的次數可能只有一兩次，不是每個按鍵都是一次請求。
            </SubCard>
            <SubCard title="附近站牌：GPS 定位搜尋">
              定位後不是只查目前選的縣市，而是把全部縣市的站點都抓回來再依距離排序——理由是使用者的位置
              可能剛好在兩個縣市交界，只查單一縣市會漏掉其實比較近的站牌。
              <br />
              <br />
              這裡也踩過一個真實的坑：同一支實體站牌常常同時被兩個相鄰縣市的公車系統各登記一次（例如台北車站周邊，
              台北市、新北市的公車都有停，TDX 兩邊各自算一筆），原本用「縣市＋站名」去重只能擋掉同縣市內的重複，
              擋不住跨縣市重複登記的同一支站牌，結果 20 筆的顯示上限裡有將近一半是看起來內容相同的重複項目。
              後來改成純粹用站名去重（清單本身已經先按距離排序，留下的一定是最近的那筆），才真正解決。
            </SubCard>
          </div>

          <Card>
            <CardBody>
              <h3 className="mb-3 font-semibold text-ink">依縣市客製化的數字／色塊鍵盤</h3>
              <p className="mb-4 text-sm leading-relaxed text-muted">
                公車路線編號常常是「數字＋顏色字」的組合（例如「紅 29」），用手機原生鍵盤切換中英文輸入很慢。
                這裡做了一套自訂鍵盤，數字鍵固定，額外的快速鍵依縣市真實路線命名習慣客製——不是憑印象配色，
                是逐一把 TDX 真實路線資料抓下來比對每個縣市的命名規律才決定要放哪些鍵：
              </p>
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="w-20 shrink-0 text-xs font-medium text-muted">台北／新北</span>
                  <KeyCapRow
                    keys={[
                      { label: "紅", tone: "紅" },
                      { label: "藍", tone: "藍" },
                      { label: "綠", tone: "綠" },
                      { label: "棕", tone: "棕" },
                      { label: "橘", tone: "橘" },
                      { label: "黃", tone: "黃" },
                      { label: "F" },
                      { label: "小" },
                      { label: "幹線" },
                    ]}
                  />
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="w-20 shrink-0 text-xs font-medium text-muted">桃園市</span>
                  <KeyCapRow keys={[{ label: "F" }, { label: "紅線", tone: "紅" }, { label: "黃線", tone: "黃" }, { label: "綠線", tone: "綠" }]} />
                  <span className="text-xs text-muted">顏色字是整條線名稱，不是前綴</span>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="w-20 shrink-0 text-xs font-medium text-muted">基隆市</span>
                  <KeyCapRow keys={[]} />
                  <span className="text-xs text-muted">85 條路線完全沒有顏色開頭，只留純數字鍵</span>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="w-20 shrink-0 text-xs font-medium text-muted">新竹市</span>
                  <KeyCapRow keys={[{ label: "藍", tone: "藍" }, { label: "綠", tone: "綠" }, { label: "甲" }, { label: "線" }]} />
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="w-20 shrink-0 text-xs font-medium text-muted">台中市</span>
                  <KeyCapRow keys={[{ label: "延" }, { label: "副" }, { label: "區" }]} />
                  <span className="text-xs text-muted">「105 延」「14 副」「152 區1」這類後綴沒有對應顏色</span>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="w-20 shrink-0 text-xs font-medium text-muted">台南市</span>
                  <KeyCapRow keys={[{ label: "紅", tone: "紅" }, { label: "左" }, { label: "右" }]} />
                  <span className="text-xs text-muted">「紅1」~「紅15」真的存在；左／右是方向後綴</span>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="w-20 shrink-0 text-xs font-medium text-muted">高雄市</span>
                  <KeyCapRow keys={[{ label: "A" }, { label: "B" }, { label: "D" }, { label: "E" }]} />
                  <span className="text-xs text-muted">「16A」「217D」這類英文字母後綴很常見</span>
                </div>
              </div>
              <p className="mt-4 text-sm leading-relaxed text-muted">
                查不到規律的縣市（新竹縣、彰化縣）就乾脆只給純數字鍵，不硬湊幾顆用不到的快速鍵；
                完全沒有數字的純文字命名路線（像「東山咖啡線」），鍵盤本來就打不出來，額外提供一個
                「瀏覽文字命名路線」入口用點選的方式找。
              </p>
            </CardBody>
          </Card>
        </Section>

        {/* 05 火車・高鐵・捷運 */}
        <Section
          id="rail"
          index="05"
          title="火車・高鐵・捷運"
          lead="這三種是標準的「起訖站」查詢模型，技術重點在時刻表＋即時誤點的疊圖，以及一次真實的票價除錯故事。"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <SubCard title="時刻表疊即時誤點">
              火車時刻表（<code className="rounded bg-surface-2 px-1 py-0.5 text-xs">DailyTrainTimetable/OD</code>）跟即時到站誤點
              （<code className="rounded bg-surface-2 px-1 py-0.5 text-xs">StationLiveBoard</code>）是兩個獨立的 TDX API，
              前端看到的「準點／誤點 N 分」是查完時刻表後，再用車次號額外併查一次誤點資料，兩份結果依車次號對應疊上去。
            </SubCard>
            <SubCard title="車種分類頁籤的比對順序坑">
              頁籤依「區間／區間快／莒光／自強／普悠瑪」分類，用車次名稱的字首去比對車種——但比對順序跟顯示順序是
              兩件事：「區間快」一定要排在「區間」前面比對，否則「區間快 2005 次」會先被較短的「區間」前綴誤判掉。
              沒列進比對清單的車種不會從列表消失，只是不會歸進特定分類頁籤，只能在「全部」看到。
            </SubCard>
          </div>

          <TechNote title="除錯實錄：全票價差了一倍">
            台鐵 ODFare 回應裡，同一個 <code className="opacity-90">TicketType=1</code>（全票）底下其實有五種
            <code className="opacity-90"> FareClass</code>，一開始靠文件猜測選了 <code className="opacity-90">FareClass 3</code>
            ，因為它在不同車種等級之間的數字看起來很一致。結果使用者回報中壢到台北區間車全票應該是
            NT$85，畫面卻顯示 NT$43。直接把 TDX 的原始回應整包印出來比對才發現：
            <code className="opacity-90"> FareClass 1</code> 才是官方公告的真正全票價，
            <code className="opacity-90"> FareClass 3／4／5／7</code> 全部剛好是 FareClass 1 的一半，
            推測是給轉乘分段試算用的半價基準，不是乘客真正會買到的票價。這次直接改用真實 API 回應驗證、
            不是憑文件字面猜測，順手把程式裡的註解也一併改成記錄這個實測結論，避免下次又被同一個坑絆到。
          </TechNote>

          <SubCard title="捷運：系統名稱分類＋跨系統轉乘">
            捷運站點清單用「系統名稱」（台北捷運／新北捷運／桃園機場捷運…）分類，不是用行政區——因為路線常常橫跨
            好幾個縣市（機場捷運從台北車站一路到桃園），硬塞成單一縣市反而不準確。北北基桃目前可互通的系統
            （台北捷運／新北捷運／桃園機場捷運／淡海輕軌）之間的轉乘站另外用一份對照表統一管理，其他系統
            （台中捷運、高雄捷運／輕軌）維持只能查同系統內的站點，不過度延伸成看似支援、實際上資料不存在的功能。
          </SubCard>
        </Section>

        {/* 06 我的行程・備忘錄・天氣 */}
        <Section id="trips" index="06" title="我的行程・備忘錄・天氣" lead="把常用的交通查詢、待辦提醒、天氣資訊收斂成可以自訂、可以重複使用的個人化清單。">
          <div className="grid gap-4 sm:grid-cols-2">
            <SubCard title="我的行程：自訂分類＋整批同步">
              常用路線不是寫死「啟程／返程」兩種，分類本身也能自訂（上班、接送小孩、週末出遊…）。
              編輯一個分類底下的清單時，是把整份清單一次送到後端做 diff 同步——比對哪些要刪除、哪些要更新、
              哪些是新增，一次處理完，不是每新增或刪除一筆路線就各打一次 API。
            </SubCard>
            <SubCard title="天氣：可自訂地區＋左右滑動切換今明兩天">
              使用者可以自己新增任意多個「縣市＋行政區」區塊（例如同時關注住家跟公司所在地的天氣）。
              輪播的那一層是「今天／明天」，每一張輪播卡會把當下所有區塊的資料並排顯示在同一張卡上，
              左右滑動切換的是日期，不是切換到別的地區。
            </SubCard>
          </div>
        </Section>

        {/* 07 API 串接與快取策略 */}
        <Section
          id="api"
          index="07"
          title="API 串接與快取策略"
          lead="TDX（交通部資料平台）這個帳號額度是每分鐘 5 次，一次查詢卻可能同時打時刻表、誤點、票價三個不同的 path——快取策略是這個專案能跑起來的關鍵。"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <SubCard title="兩層快取">
              <p>
                <strong className="text-ink">Process 記憶體層：</strong>存的是 Promise 不是值，同一個 function instance
                內多個併發請求打同一個 path 時，大家等同一個 Promise，不會真的各自打一次 TDX。
              </p>
              <p>
                <strong className="text-ink">MongoDB 持久層：</strong>正式環境是 Vercel serverless，function instance
                會被回收，記憶體快取冷啟動後就沒了；Mongo 這層在冷啟動後還在，用 TTL 索引
                （<code className="rounded bg-surface-2 px-1 py-0.5 text-xs">expireAfterSeconds</code>）自動清過期資料，不用額外寫排程清理。
              </p>
            </SubCard>
            <SubCard title="快取時間依資料特性調整">
              即時性要求高的資料（到站倒數、誤點分鐘數）快取 60 秒，剛好對齊額度重置週期；幾乎不會變動的資料
              （站名清單、票價表）快取拉長到 24 小時，不浪費額度重複查同樣的答案。失敗的請求不留快取，
              下次會重新嘗試，不會因為一次失敗就卡住整個快取週期。
            </SubCard>
          </div>
          <TechNote title="Access Token 也是一種快取">
            TDX 用 OAuth2 client_credentials 換 token，token 本身設定提前 60 秒視為過期，避免卡在剛好過期那一刻
            送出請求導致整批查詢失敗。這個 token 快取跟上面的資料快取是分開的兩層，各自管各自的生命週期。
          </TechNote>
        </Section>

        {/* 08 記帳本模組 */}
        <Section
          id="expenses"
          index="08"
          title="記帳本模組"
          lead="跟交通查詢模組並列的第二個工具，近期才把畫面從假資料換成真正串接 MongoDB——同一套帳號系統、同一套權限模型、同一套視覺語言。"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <SubCard title="pure／.server 兩份檔案的分工">
              每個資料領域（分類、交易、薪資、目標）在 <code className="rounded bg-surface-2 px-1 py-0.5 text-xs">lib/expenses/</code>{" "}
              底下都拆成兩份：不帶 <code className="rounded bg-surface-2 px-1 py-0.5 text-xs">.server</code> 後綴的是純函式
              （格式化、分類顏色、金額試算），不碰資料庫，可以被掛
              <code className="rounded bg-surface-2 px-1 py-0.5 text-xs">&quot;use client&quot;</code> 的元件直接 import；
              帶 <code className="rounded bg-surface-2 px-1 py-0.5 text-xs">.server.ts</code> 後綴的才是真正碰 MongoDB 的
              CRUD，只能在 API route 裡匯入。這樣分的理由很直接：MongoDB driver 用了
              <code className="rounded bg-surface-2 px-1 py-0.5 text-xs"> tls</code>／
              <code className="rounded bg-surface-2 px-1 py-0.5 text-xs">net</code> 這些 Node-only 模組，一旦被瀏覽器端程式碼
              import 到就會直接打包失敗。
            </SubCard>
            <SubCard title="API 層的權限閘門">
              每支 <code className="rounded bg-surface-2 px-1 py-0.5 text-xs">/api/expenses/*</code> route 開頭都呼叫一次{" "}
              <code className="rounded bg-surface-2 px-1 py-0.5 text-xs">requireTool(&quot;expenses&quot;)</code>，一行判斷同時確認「有登入」
              跟「有這個工具的權限」，兩個條件沒過直接回傳成形的 401／403 NextResponse，呼叫端只要
              <code className="rounded bg-surface-2 px-1 py-0.5 text-xs"> if (user instanceof NextResponse) return user;</code>{" "}
              就能把錯誤丟回去，不用在每支 route 重複寫同樣的檢查邏輯。
            </SubCard>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <SubCard title="功能範圍">
              <ul className="list-disc space-y-1 pl-5">
                <li>Dashboard：收入／支出／結餘 KPI 卡，附「較上期 ±%」漲跌徽章</li>
                <li>分類管理：父子兩層分類結構，可自訂排序</li>
                <li>交易紀錄：CRUD ＋ CSV 匯入匯出</li>
                <li>薪資：項目類型管理＋每月紀錄，一人一月一筆（唯一索引擋重複新增）</li>
                <li>存錢目標：目標金額、進度與期限試算</li>
              </ul>
            </SubCard>
            <SubCard title="視覺語言跨模組共用">
              記帳分類的六組配色（<code className="rounded bg-surface-2 px-1 py-0.5 text-xs">cat-a</code> ~{" "}
              <code className="rounded bg-surface-2 px-1 py-0.5 text-xs">cat-f</code>）跟交通模組的路線色塊、即時到站狀態色
              是同一組設計 token，不是另外為記帳本配的新顏色——換工具但視覺語言不中斷。
              <br />
              <br />
              「成員」頁的邀請碼與多人共用介面目前還是先用假資料做出畫面，實際的多人協作資料層還在規劃中，
              現階段記帳本是單人範圍，誠實標示目前的完成度而不是假裝已經做完。
            </SubCard>
          </div>
        </Section>

        {/* 09 UI/UX 設計系統 */}
        <Section id="uiux" index="09" title="UI/UX 設計系統" lead="視覺上走明亮可愛的馬卡龍色調，技術上則是用共用元件跟資料驅動的細節，撐起兩個差異很大的工具模組。">
          <div className="grid gap-4 sm:grid-cols-2">
            <SubCard title="卡片式設計＋刻意不跟系統深色模式">
              全站用統一的圓角卡片（圓角 1.5rem）＋淺紫邊線＋柔和陰影，背景疊了兩層粉彩漸層光斑。
              這個調性需要淺色底才撐得起馬卡龍色塊跟粉彩漸層，硬套一份深色版只會讓整體看起來厚重、不討喜，
              所以目前刻意只維護淺色這一套，不是忘了做深色模式。
            </SubCard>
            <SubCard title="會「猜」列數的 Skeleton Loading">
              使用者自己增減的清單（備忘錄、行程、主視覺橫幅…）筆數會變動，骨架畫面不能寫死固定幾列——不然
              資料回來那一刻，骨架列數跟實際內容數量對不上，畫面高度會跳一下。做法是用
              <code className="rounded bg-surface-2 px-1 py-0.5 text-xs"> localStorage</code> 記住「上次成功載入時的實際筆數」，
              下次還沒抓到資料前先用這個數字猜骨架列數，猜對的機率比寫死一個數字高很多；完全沒存過時才退回
              預設值，並設上限（8 筆）避免抓到異常大的數字。
            </SubCard>
          </div>
          <SubCard title="共用元件化">
            站點選擇、日期／時間選擇、列表骨架、分類色塊、卡片／按鈕／徽章這些重複出現的 UI 跟操作流程，
            全部拆成 <code className="rounded bg-surface-2 px-1 py-0.5 text-xs">components/</code> 底下的共用元件
            （交通模組與記帳模組各自有一份，但遵循同一套設計 token），不同頁面之間維持一致的互動手感，
            新增頁面時也不用重新決定「這顆按鈕該長怎樣」。
          </SubCard>
        </Section>

        {/* 10 專案特色 */}
        <Section id="highlights" index="10" title="專案特色">
          <Card>
            <CardBody>
              <div className="flex flex-wrap gap-2">
                {[
                  "多交通工具整合",
                  "真實第三方 API 串接",
                  "雙層快取策略",
                  "CRUD 資料管理",
                  "個人化行程與記憶",
                  "Local Storage 偏好記憶",
                  "共用元件系統",
                  "自適應 Skeleton Loading",
                  "依地區客製化互動元件",
                  "資料驅動的設計 Token",
                ].map((t) => (
                  <Badge key={t} tone="brand">
                    {t}
                  </Badge>
                ))}
              </div>
              <p className="mt-4 text-sm leading-relaxed text-muted">
                這個專案最在意的不是「串了多少個 API」，而是每個互動細節背後有沒有想清楚使用情境——公車查詢
                要先選縣市才給鍵盤，是因為公車是路線優先而不是起訖站；鍵盤依縣市客製化，是先去查真實資料而不是
                憑印象配色；票價算錯了，是直接拿 TDX 原始回應比對官方公告才抓出根因。把交通查詢跟個人化行程
                管理整合在同一個平台上，讓日常通勤查詢更快、更直覺，同時也是一次把「資料驅動設計」「快取策略」
                「SSR／CSR 一致性」這些前端工程細節走過一輪的練習。
              </p>
            </CardBody>
          </Card>
        </Section>

        <footer className="border-t border-line pt-6 text-center text-xs text-muted">搭車咻一下 · 個人開發的交通查詢與記帳整合平台</footer>
      </main>
    </div>
  );
}
