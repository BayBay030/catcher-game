# 離線執行

這套遊戲**不需要網路**。MediaPipe 與字體都在 repo 裡，執行時不會對外連線。

## 驗證方法（任何改動後都值得跑一次）

### 1. 原始碼裡不該有外部 URL

```bash
grep -rn "https\?://" --include="*.html" --include="*.js" --include="*.css" \
  --exclude-dir=vendor --exclude-dir=node_modules --exclude-dir=.git . \
  | grep -vE "127\.0\.0\.1|localhost|w3\.org"
```

沒有輸出就是乾淨的。

### 2. 實際載入時不該有外部請求

開好遊戲後，在瀏覽器 Console 貼：

```js
performance.getEntriesByType('resource')
  .filter(r => !r.name.startsWith(location.origin) && !r.name.startsWith('data:'))
```

回傳空陣列就是真的沒連外。

### 3. 最硬的驗證

**把 Wi-Fi 關掉**，重開遊戲，確認手勢辨識正常。

## repo 裡放了什麼

### `public/vendor/mediapipe/hands/`（約 23 MB，版本記在 `VERSION`）

實測**這台機器實際會抓的**只有 7 個檔（約 12.4 MB）：

| 檔案 | 大小 |
|---|---|
| `hands_solution_simd_wasm_bin.wasm` | 5.9 MB |
| `hands_solution_packed_assets.data` | 4.2 MB |
| `hand_landmark_lite.tflite` | 2.0 MB |
| `hands_solution_simd_wasm_bin.js` | 270 KB |
| `hands.js` | 45 KB |
| `hands_solution_packed_assets_loader.js` | 8 KB |
| `hands.binarypb` | 1 KB |

另外三個是**保險**，平常不會載入，但砍掉就等於賭：

- `hands_solution_wasm_bin.{js,wasm}`（5.9 MB）— 非 SIMD 版。目前 Chrome / Safari 都支援 WASM SIMD 所以用不到，但換一台舊機器就可能需要
- `hand_landmark_full.tflite`（5.2 MB）— 只有 `modelComplexity: 1` 才會用。目前設 `0`（app.js 的 `initMediaPipe`），改設定就會需要它

要省 11 MB 就刪這三個；但刪了之後**離線環境下改設定會直接壞掉**，不會有提示。

### `public/vendor/fonts/`（200 KB）

Baloo 2，可變字體，4 個 woff2 檔涵蓋全部字重。

**繁體中文沒有打包** —— Noto Sans TC 的子集檔加起來約 16 MB（420 個檔）。
macOS 內建 PingFang TC，所以中文字走系統字體（見 `style.css` 的 `--font-main`）。
如果要跟線上版一模一樣，得把那 16 MB 也收進來。

## 改動時要注意

- `locateFile`（`app.js` 的 `initMediaPipe`）指向 `public/vendor/mediapipe/hands/`，**不要改回 CDN**
- 要加新字體 → 下載到 `public/vendor/fonts/`，不要用 `fonts.googleapis.com`
- `index.html` 一度同時用 `<link>` 和 `style.css` 的 `@import` 載同一份 Google Fonts，現在只剩本地那一份，別再加回來
