@AGENTS.md

# cpx-tools — 一個帳號，底下五個各自獨立的小工具

**動任何工具之前，先讀那個工具的 `docs/<工具>/rules.md`。** 不要為了查一條規則去讀
`history.md`（那是只增不減的決策紀錄，菜鳥買菜記那份有 2900 行）。

| 工具 | 程式 | 規則 | 色票與版面 |
| --- | --- | --- | --- |
| 菜鳥買菜記 | `*/freshwise` | [rules](docs/freshwise/rules.md) | [design](docs/freshwise/design.md) |
| 記帳本 | `*/expenses` | [rules](docs/expenses/rules.md) | [design](docs/expenses/design.md) |
| 搭乘車查詢 | `*/transit` | [rules](docs/transit/rules.md) | [design](docs/transit/design.md) |
| 圖片壓縮 | `*/compress` | [rules](docs/compress/rules.md) | 走 hub 那套 |
| 入口與帳號 | `app/page.tsx`、`app/login`、`app/register`、`app/admin`、`components/ui.tsx` | [rules](docs/hub/rules.md) | [design](docs/hub/design.md) |

每個工具四份文件：`rules.md`（規則，動程式前讀這份）、`design.md`（**色票、字級、間距——
改任何顏色或尺寸之前讀這份**）、`status.md`（待確認與未處理）、`history.md`（已完成紀錄，
只在 rules 回答不了「當初為什麼這樣決定」時才翻）。

**色票是依工具分家的**：四套 token 互不相同（菜鳥買菜記綠、記帳本紫、搭乘車紫、入口另一套），
**不要互相 import，也不要為了改一個顏色把四份都讀過**——只讀你要動的那個工具那一份。

跨工具共通的規則與六支測試腳本的總表在 [docs/README.md](docs/README.md)。

**做新小工具時，回歸測試腳本與那四份文件要一起做**，不是之後再補——完整清單（註冊、權限、
刪帳號、文件、測試）在 [docs/README.md](docs/README.md) 的「新增一個小工具時，要一起做的事」。

改完一輪的標準順序：

```
npx tsc --noEmit
npx eslint app components lib scripts
npm run check:freshwise    # 或 check:expenses / check:transit，看動到哪個工具
```

回覆與文件一律用中文（含標題與小結），不要中英混用的標籤。
