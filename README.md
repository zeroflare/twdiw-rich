# twdiw-rich

基於 Cloudflare Workers 的 Web 應用，整合 OIDC 認證、D1 資料庫和 KV 儲存。

## 📋 目錄

- [專案概述](#專案概述)
- [快速開始](#快速開始)
- [D1 和 KV 設定](#d1-和-kv-設定)
- [OIDC 認證整合](#oidc-認證整合)
- [專案架構](#專案架構)
- [開發與部署](#開發與部署)
- [常用命令](#常用命令)
- [故障排除](#故障排除)

## 專案概述

此專案是一個整合數位憑證皮夾的身價計算系統前端應用，使用：

- **運行環境**: Cloudflare Workers
- **Web 框架**: Hono
- **認證**: OpenID Connect (OIDC)
- **資料庫**: Cloudflare D1 (SQLite)
- **儲存**: Cloudflare KV (Session 管理)
- **語言**: TypeScript

## 快速開始

### 安裝依賴

```bash
npm install
```

### 啟動開發伺服器

```bash
npm run dev
```

應用會運行在 `http://localhost:8787`

## D1 和 KV 設定

### 1. 創建 D1 資料庫

```bash
# 使用 npx（推薦）
npx wrangler d1 create twdiw-rich-db

# 記下輸出的 database_id，例如：4892e8d2-3ffa-4963-b72b-43ebfb8baed2
```

### 2. 創建 KV Namespace

```bash
# 創建生產環境的 KV namespace
npx wrangler kv namespace create "SESSIONS"

# 創建預覽環境的 KV namespace（用於本地開發）
npx wrangler kv namespace create "SESSIONS" --preview

# 記下輸出的 id 和 preview_id
```

### 3. 更新 wrangler.jsonc

將獲得的 ID 更新到 `wrangler.jsonc`：

```jsonc
"d1_databases": [
  {
    "binding": "DB",
    "database_name": "twdiw-rich-db",
    "database_id": "your-database-id-here"  // 替換為實際的 database_id
  }
],
"kv_namespaces": [
  {
    "binding": "SESSIONS",
    "id": "your-kv-namespace-id",           // 生產環境 ID
    "preview_id": "your-preview-namespace-id" // 預覽環境 ID
  }
]
```

### 4. 初始化資料庫

```bash
# 本地開發環境
npm run db:init

# 或使用完整命令
npx wrangler d1 execute twdiw-rich-db --local --file=./db/schema.sql

# 生產環境（部署後）
npm run db:init:prod
```

### 資料庫結構

專案包含以下資料表：

- **users** - 使用者基本資訊
- **assets** - 資產資料（現金、證券、不動產、車輛）
- **liabilities** - 負債資料（房貸、個人貸款、學貸、車貸、信用卡債務）
- **rank_certificates** - 財富階層憑證記錄

詳細結構請參考 `db/schema.sql`

## OIDC 認證整合

此專案已整合 OpenID Connect (OIDC) 認證功能。

### 配置資訊

- **Well-known URL**: `https://twdiw-sso.zeroflare.tw/.well-known/openid-configuration`
- **Client ID**: `10acc91c-76d5-4bbd-84c9-61a7ccbd08f3`
- **Redirect URI**: `http://localhost:8787/redirect`

### 環境變數設定

在生產環境中，使用 Cloudflare Workers 的 secrets 功能來儲存 Client Secret：

```bash
npx wrangler secret put OIDC_CLIENT_SECRET
```

### 路由說明

- `GET /` - 淨資產儀表板（需要認證）
- `GET /login` - 登入頁面（重定向到 OIDC 授權端點）
- `GET /redirect` - OIDC 回調處理路由
- `GET /logout` - 登出
- `GET /api/user` - 獲取當前使用者資訊（需要認證）
- `GET /message` - 測試路由（不需要認證）

### 使用方式

1. 啟動開發伺服器：`npm run dev`
2. 訪問 `http://localhost:8787/`，系統會自動重定向到登入頁面
3. 完成 OIDC 認證後，會自動返回淨資產儀表板並顯示使用者資訊

## 專案架構

本專案採用 MVC（Model-View-Controller）架構，以提高代碼的可維護性和可擴展性。

### 目錄結構

```
src/
├── types/              # 類型定義層
│   └── index.ts        # 集中管理所有類型定義
├── models/             # Model 層 - 資料庫操作
│   ├── database.ts     # 資料庫工具函數
│   ├── User.ts         # User 模型
│   ├── Asset.ts        # Asset 模型
│   ├── Liability.ts    # Liability 模型
│   └── RankCertificate.ts  # Rank Certificate 模型
├── services/           # Service 層 - 業務邏輯
│   ├── AuthService.ts      # 認證業務邏輯
│   ├── OidcService.ts     # OIDC 業務邏輯
│   ├── SessionService.ts   # Session 管理業務邏輯
│   └── NetWorthService.ts  # 淨值計算業務邏輯
├── controllers/        # Controller 層 - 請求處理
│   ├── AuthController.ts   # 認證控制器
│   └── UserController.ts   # 使用者控制器
├── middleware/         # Middleware 層 - 中間件
│   └── auth.middleware.ts  # 認證中間件
├── routes/             # Routes 層 - 路由定義
│   ├── auth.routes.ts      # 認證路由
│   └── api.routes.ts       # API 路由
├── utils.ts            # 工具函數
├── constants.ts        # 常數定義
└── index.ts            # 主入口文件
```

### 架構層級說明

#### 1. Types（類型定義層）

- **位置**: `src/types/`
- **職責**: 集中管理所有 TypeScript 類型定義
- **包含**: User, Asset, Liability, RankCertificate, Session, NetWorthSummary, OidcEnv 等

#### 2. Models（模型層）

- **位置**: `src/models/`
- **職責**: 處理資料庫操作（CRUD）
- **特點**:
  - 每個模型對應一個資料表
  - 使用靜態方法，無需實例化
  - 只負責資料存取，不包含業務邏輯

#### 3. Services（服務層）

- **位置**: `src/services/`
- **職責**: 處理業務邏輯
- **特點**:
  - 組合多個 Model 的操作
  - 處理複雜的業務規則
  - 可被多個 Controller 重用

#### 4. Controllers（控制器層）

- **位置**: `src/controllers/`
- **職責**: 處理 HTTP 請求，調用 Service，返回響應
- **特點**:
  - 接收請求參數
  - 調用對應的 Service
  - 返回 HTTP 響應

#### 5. Middleware（中間件層）

- **位置**: `src/middleware/`
- **職責**: 處理請求前後的邏輯（如認證檢查）
- **特點**: 可重用的請求處理邏輯

#### 6. Routes（路由層）

- **位置**: `src/routes/`
- **職責**: 定義路由和對應的 Controller
- **特點**: 將路由定義與業務邏輯分離

### 資料流向

```
Request → Routes → Middleware → Controller → Service → Model → Database
                                                      ↓
Response ← Routes ← Middleware ← Controller ← Service ← Model ← Database
```

### 範例：獲取使用者資訊

1. **Route** (`routes/api.routes.ts`): 定義路由 `/api/user`
2. **Middleware** (`middleware/auth.middleware.ts`): 檢查認證狀態
3. **Controller** (`controllers/UserController.ts`): 處理請求
4. **Service** (`services/SessionService.ts`): 獲取 session 資料
5. **Response**: 返回 JSON 格式的使用者資訊

### 擴展指南

#### 添加新的功能模組

1. **定義類型** (`types/index.ts`): 添加相關的 TypeScript 類型
2. **創建 Model** (`models/`): 實現資料庫操作
3. **創建 Service** (`services/`): 實現業務邏輯
4. **創建 Controller** (`controllers/`): 處理 HTTP 請求
5. **定義路由** (`routes/`): 將路由與 Controller 連接
6. **註冊路由** (`index.ts`): 在主入口文件中註冊新路由

#### 範例：添加 Asset API

```typescript
// 1. types/index.ts (已存在 Asset 類型)

// 2. models/Asset.ts (已存在)

// 3. services/AssetService.ts (新建)
export class AssetService {
  static async createAsset(c: Context, data: CreateAssetDto) {
    // 業務邏輯
    return AssetModel.create(c, data);
  }
}

// 4. controllers/AssetController.ts (新建)
export class AssetController {
  static async create(c: Context) {
    const data = await c.req.json();
    const asset = await AssetService.createAsset(c, data);
    return c.json(asset);
  }
}

// 5. routes/api.routes.ts (添加路由)
app.post("/api/assets", requireAuth, AssetController.create);

// 6. index.ts (已自動註冊，無需修改)
```

### 架構優勢

1. **關注點分離**: 每個層級都有明確的職責
2. **可維護性**: 代碼結構清晰，易於理解和修改
3. **可測試性**: 各層級可獨立測試
4. **可擴展性**: 添加新功能時只需在對應層級添加代碼
5. **可重用性**: Service 層的邏輯可被多個 Controller 重用

## 開發與部署

### 開發

```bash
# 啟動開發伺服器
npm run dev

# 初始化本地資料庫
npm run db:init

# 查詢本地資料庫
npm run db:query -- --command="SELECT * FROM users;"
```

### 部署

```bash
# 部署到 Cloudflare
npm run deploy

# 初始化生產資料庫（首次部署後）
npm run db:init:prod
```

### 類型生成

生成 TypeScript 類型定義：

```bash
npm run cf-typegen
```

### 代碼品質工具

本專案使用 Prettier 和 ESLint 來確保代碼品質和一致性。

#### Prettier（代碼格式化）

```bash
# 格式化所有代碼
npm run format

# 檢查代碼格式（不修改）
npm run format:check
```

#### ESLint（代碼檢查）

```bash
# 檢查代碼問題
npm run lint

# 自動修復可修復的問題
npm run lint:fix

# 同時檢查格式和 lint
npm run check
```

#### 配置檔案

- **Prettier**: `.prettierrc.json` - 代碼格式化規則
- **ESLint**: `.eslintrc.json` - 代碼檢查規則
- **忽略檔案**: `.prettierignore`, `.eslintignore`

#### 編輯器整合

建議在編輯器中安裝以下擴展：

- **VS Code**:
  - [Prettier - Code formatter](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)
  - [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint)

啟用「儲存時自動格式化」功能，可以自動應用 Prettier 格式化。

## 常用命令

### D1 資料庫操作

```bash
# 列出所有資料庫
npx wrangler d1 list

# 執行 SQL 查詢（本地）
npx wrangler d1 execute twdiw-rich-db --local --command="SELECT * FROM users;"

# 執行 SQL 檔案（本地）
npx wrangler d1 execute twdiw-rich-db --local --file=./db/schema.sql

# 匯出資料庫
npx wrangler d1 export twdiw-rich-db --output=backup.sql
```

### KV 操作

```bash
# 列出所有 KV namespaces
npx wrangler kv namespace list

# 列出 keys（需要 namespace-id）
npx wrangler kv key list --namespace-id=your-namespace-id

# 讀取 key
npx wrangler kv key get "session:abc123" --namespace-id=your-namespace-id
```

### NPM Scripts

```bash
npm run dev              # 啟動開發伺服器
npm run deploy           # 部署到 Cloudflare
npm run cf-typegen       # 生成類型定義
npm run db:init          # 初始化本地資料庫
npm run db:init:prod     # 初始化生產資料庫
npm run db:query         # 查詢本地資料庫
npm run lint             # 檢查代碼問題
npm run lint:fix         # 自動修復代碼問題
npm run format           # 格式化代碼
npm run format:check     # 檢查代碼格式
npm run check            # 同時檢查格式和 lint
```

## 故障排除

### D1 資料庫連接失敗

```bash
# 檢查資料庫是否存在
npx wrangler d1 list

# 檢查 wrangler.jsonc 配置
# 確認 database_id 正確
```

### KV Namespace 連接失敗

```bash
# 檢查 namespace 是否存在
npx wrangler kv namespace list

# 檢查 wrangler.jsonc 配置
# 確認 id 和 preview_id 正確
```

### 本地開發資料遺失

本地開發資料儲存在 `.wrangler/state/` 中，如果資料遺失：

1. 重新執行 schema：`npm run db:init`
2. 檢查 `.wrangler` 目錄是否存在

### wrangler 命令找不到

使用 `npx` 執行 wrangler 命令：

```bash
# ✅ 正確
npx wrangler d1 create twdiw-rich-db

# ❌ 錯誤
wrangler d1 create twdiw-rich-db
```

### 命令格式錯誤

Wrangler 4.x 使用空格分隔命令，不是冒號：

```bash
# ✅ 正確
npx wrangler kv namespace create "SESSIONS"

# ❌ 錯誤（舊格式）
npx wrangler kv:namespace create "SESSIONS"
```

## 注意事項

1. **本地開發**: 首次執行 `npm run dev` 前，需要先執行 `npm run db:init`
2. **生產部署**: 部署前確保：
   - D1 資料庫已創建並配置正確的 `database_id`
   - KV namespace 已創建並配置正確的 `id` 和 `preview_id`
   - 執行 `npm run db:init:prod` 初始化生產資料庫
3. **命令格式**: Wrangler 4.x 使用空格分隔命令（如 `kv namespace create`），不是冒號（如 `kv:namespace create`）
4. **資料備份**: 定期備份生產環境的資料庫
5. **Session 儲存**: Session 使用 KV 儲存，Key 格式為 `session:{sessionId}`，TTL 為 24 小時

## 📚 相關文件

- [Cloudflare D1 文件](https://developers.cloudflare.com/d1/)
- [Cloudflare KV 文件](https://developers.cloudflare.com/kv/)
- [Wrangler CLI 文件](https://developers.cloudflare.com/workers/wrangler/)
