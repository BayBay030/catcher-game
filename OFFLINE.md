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

Baloo 2 與 Noto Sans TC，共 **109 個 woff2 檔、4.4 MB**。

兩個都是**可變字體** —— 一個 unicode 子集一個檔，涵蓋全部字重。所以雖然
`fonts.css` 裡有 440 個 `@font-face`，實際檔案只有 109 個。
（別被字重數量誤導：420 個 @font-face 不代表 420 個檔案。）

中文字體已打包，所以 **macOS 和 Windows 的外觀一致**。堆疊裡後面的
PingFang TC / Microsoft JhengHei 只是萬一 woff2 載入失敗時的保險。

### 要重新產生 fonts.css

用桌機版 User-Agent 重抓 css2 網址 → 把每個 woff2 下載到 `files/` →
把每個 `url()` 改寫成 `files/<檔名>`。

## 改動時要注意

- `locateFile`（`app.js` 的 `initMediaPipe`）指向 `public/vendor/mediapipe/hands/`，**不要改回 CDN**
- 要加新字體 → 下載到 `public/vendor/fonts/`，不要用 `fonts.googleapis.com`
- `index.html` 一度同時用 `<link>` 和 `style.css` 的 `@import` 載同一份 Google Fonts，現在只剩本地那一份，別再加回來
