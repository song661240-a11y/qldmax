股票資產 PWA v6.0｜系統健康捷徑＋統一操作視窗

【重要】本版 Firestore Rules 沒有修改。
如果你已經把 v5.8 的 Revision Rules 在 Firebase Console Publish 完成，升 v6.0 不需要再貼 Rules。

本版重點：
- 系統健康異常直接顯示「更新 200SMA／更新 FT／查看自動快照／查看 QQQI 配息」等捷徑，點一下直接進正確設定頁。
- 系統健康詳細四格也可直接點進市場資料、FT 設定、SMA、QQQI 配息。
- 全部瀏覽器原生 prompt／confirm／alert 改成 App 內統一視窗。
- 快速更新、帳戶明細、回收區改成固定底部操作列的手機 Bottom Sheet。
- v5.9 相同值不算衝突與手機衝突視窗完整保留。
- dataRevision、Firestore Transaction、一鍵復原與 QQQI E2E 全部保留。
- 雲端同步頁修正 Firestore 真實路徑顯示。

部署方式：
1. 解壓縮完整 ZIP。
2. 將內容覆蓋上傳到 GitHub Repository 根目錄。
3. 等 Actions 的 pages build and deployment 綠勾。
4. 手機 App 若出現「發現新版 v6.0」，按「立即更新」。
5. 開首頁「系統健康」確認狀態；若有需處理項目，直接按該項捷徑即可。

如果只用「必要更新檔」，請完整保留裡面的資料夾層級後覆蓋，不要只上傳單一 app.js。


v6.0 重點：首頁「系統健康」出現需處理項目時，直接點該項即可跳到對應設定的實際按鈕／區塊並短暫標示；雲端自動化頁亦提供 GitHub Actions 直接連結。
