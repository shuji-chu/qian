# qian · 晴天社区静态商品数据

前端直接 `fetch` 本仓库的 JSON 文件即可，**不需要任何鉴权**（仓库为 public）。
数据由 `晴天社区主站` 每小时自动导出并推送一次。

## 文件清单

| 文件 | 条数 | 说明 |
|---|---|---|
| `nodes.json` | 135 | 节点套餐：9 种协议 × 15 个档位 |
| `accounts.json` | 1861 | 大号商账号商品（含价格 / 库存 / 类目封面） |
| `traffic.json` | 4482 | 引流商品（含单价、起订量、平台分类） |
| `servers.json` | 6 | 接入点（地区选择用，辅助文件） |
| `manifest.json` | — | 元信息：条数 / 字节 / sha256 / 类目统计 / 更新时间 |
| `covers/*.svg` | 39 | 类目封面图（`accounts.json` 的 `cover_url` 指向自有 CDN 同款文件） |

**三个主文件都是「纯 JSON 数组」**，`await res.json()` 直接拿到 list，无外层包装。

## 调用地址

```js
const BASE = "https://raw.githubusercontent.com/shuji-chu/qian/main";
const nodes    = await (await fetch(`${BASE}/nodes.json`)).json();
const accounts = await (await fetch(`${BASE}/accounts.json`)).json();
const traffic  = await (await fetch(`${BASE}/traffic.json`)).json();
```

国内网络拉 `raw.githubusercontent.com` 会慢或超时，用自有镜像（推荐，秒级生效）：

```js
const BASE = "https://api.lynli.me/static/qian";     // nodes.json / accounts.json / traffic.json
```

## 字段约定

### 价格（三套文件统一）

```jsonc
"price_yuan": 135.0,      // 元，前端直接展示
"price_cents": 13500,     // 分，整数，用于避免浮点误差
"price_unit": "yuan",     // 固定值
"currency": "CNY"         // 或者 USDT（仅 traffic.json，见下）
```

- `nodes.json` / `accounts.json`：`price_yuan = price_cents / 100`，恒等。
- `traffic.json`：上游以 **USDT** 计价，另有 `price_usdt` / `unit_price_usdt` 保留原值，
  `price_yuan` 为按固定展示汇率（manifest 中注明，当前 7.2）折算后的人民币。
  `price_yuan` 是**起订金额**（`min_qty × unit_price_yuan`），展示「¥X 起」用它；单价用 `unit_price_yuan`。

### 图片

```jsonc
"image_url": "https://api.lynli.me/static/cloned/xxx.webp",  // 真实商品图，可能为 null
"cover_url": "https://api.lynli.me/static/qian/covers/telegram.svg",  // 类目封面，恒有值
"image_source": "product" | "category_cover"
```

`accounts.json` 中仅 3 条有真实商品图，其余 `image_url` 为 `null`，请用 `cover_url` 兜底。

### 分类 / 平台（已清洗）

`traffic.json` 的 `platform`、`category` 已去掉 emoji、竖线、换行，可直接渲染；
原始文案保留在 `category_raw` 供搜索。`accounts.json` 提供 `category_zh` / `category_en` / `category_slug`。

### 库存

`stock` 为可售数量，另给 `in_stock` / `sold_out` 两个布尔，前端不必自己判断 `stock <= 0`。

## 更新节奏

- 每小时第 5 分钟自动导出（cron），仅当数据变化时才产生新 commit。
- `raw.githubusercontent.com` 有约 5 分钟 CDN 缓存；`api.lynli.me` 镜像为实时文件，无缓存延迟。
- `manifest.json` 的 `generated_at_str` 可用于前端显示「数据更新时间」；`files.*.sha256` 可用于本地比对是否变更。
