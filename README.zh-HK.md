# Fluffy Memory

[English](README.md) · [简体中文](README.zh-CN.md) · **繁體中文（香港）**

Fluffy Memory 結合寵物護理、紀念及網上購物。你可以記錄寵物的日常，珍藏相伴的時光，亦可選購寵物用品及訂製紀念品。

**[公開主頁](https://fluffy-memory.tail0fcefb.ts.net/?lang=zh-HK)** · **[管理後台](https://fluffy-memory.tail0fcefb.ts.net/admin?lang=zh-HK)**

網站提供英文、簡體中文及香港繁體中文。你可以在導覽列切換語言，網站會記住上次的選擇。網上示範採用模擬付款。管理後台須使用管理員帳戶登入。

## 主要功能

- 為多隻貓狗建立檔案，查看適合其生命階段的護理建議。
- 用相片、故事和時間軸建立私人紀念頁，並透過可撤銷的連結與親友分享。
- 瀏覽及訂製商品，確認訂單前查看售價及運費，下單後查閱製作、送貨及退款進度。
- 在管理後台處理商品、庫存、護理內容、訂單及出貨。

## 執行及部署

在本機執行時，先複製設定範本，填寫資料庫及管理員登入資料，再啟動 Docker Compose。

```sh
cp deploy/.env.example deploy/.env
docker compose --env-file deploy/.env -f deploy/compose.yml up --build --wait
```

開發前端可在 `frontend` 執行 `npm ci` 及 `npm run dev`，再開啟 Vite 顯示的網址。後端使用 PostgreSQL 17，在 `backend` 執行 `./mvnw spring-boot:run`。NAS 的映像檔、資料卷、HTTPS、備份及更新步驟見部署手冊。 [NAS 容器部署手冊（簡體中文）](deploy/nas.zh-CN.md)

## 架構及驗證

前端使用 React 19、TypeScript 及 Vite，後端使用 Java 21 及 Spring Boot。PostgreSQL 儲存應用程式資料，Flyway 管理資料庫遷移，Caddy 提供前端及 API 轉發。GitHub Actions 自動執行前端建置、後端整合測試及容器基本功能測試。 [驗證紀錄](https://github.com/G-GortoN/fluffy-memory-platform/actions)
