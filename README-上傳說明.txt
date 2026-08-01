股票資產 PWA v4.9｜每日線上匯率版

上傳方式：
1. 解壓縮 ZIP。
2. 回到 GitHub Repository 最外層。
3. 將下列內容全部覆蓋上傳：
   - index.html
   - manifest.webmanifest
   - service-worker.js
   - .nojekyll
   - assets 資料夾
   - icons 資料夾
4. 等待 GitHub Pages 部署完成。
5. 網頁出現「股票資產已有新版」時，按「套用新版」。

本版新增：
- 每天第一次開啟 App，自動檢查並更新一次 USD/TWD。
- 頁首重整股價時也會檢查今日匯率；同一天已嘗試過就不重複連線。
- 匯率更新失敗時沿用上一次成功匯率，不影響 IB 策略與股價更新。
- 市場資料狀態頁顯示目前匯率、更新時間、錯誤原因與「立即更新」按鈕。
- 每日資產快照保存當日匯率；歷史圖切換 NT$ 時使用各日期快照匯率。
- 舊快照沒有匯率時才使用目前匯率估算。
- 保留手動修改 USD/TWD。
- 匯率資料來源：ExchangeRate-API（每日更新；App 內含來源標示）。
- IB 主策略的 Risk-On／Off、HOT、DCA 與目標交易股數完全未修改。

重要：不要只上傳 ZIP；要先解壓縮，並保留 assets/ 與 icons/ 資料夾結構。
