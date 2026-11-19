# Fluffy Memory

[English](README.md) · **简体中文** · [繁體中文（香港）](README.zh-HK.md)

Fluffy Memory 是一个集宠物照护、纪念和购物于一体的平台。用户可以记录宠物的日常，珍藏一起度过的时光，并选购宠物用品和定制纪念品。

**[打开简体中文公网首页](https://fluffy-memory.tail0fcefb.ts.net/?lang=zh-CN)**

网站支持英文、简体中文和香港繁体中文，在导航栏可随时切换，并记住上次选择。线上演示使用模拟支付。

## 主要功能

- 为多只猫狗创建档案，查看符合生命阶段的照护建议。
- 用照片、故事和时间线创建私密纪念页，并通过可撤销的链接与亲友分享。
- 浏览和定制商品，确认订单前查看价格及运费，下单后跟踪制作、发货和退款。
- 在运营后台管理商品、库存、照护内容、订单和履约进度。

## 运行与部署

本地运行时，复制示例配置，设置数据库与管理员凭据，再启动 Docker Compose。

```sh
cp deploy/.env.example deploy/.env
docker compose --env-file deploy/.env -f deploy/compose.yml up --build --wait
```

前端开发在 `frontend` 执行 `npm ci` 和 `npm run dev`，访问 Vite 打印的地址。后端使用 PostgreSQL 17，在 `backend` 执行 `./mvnw spring-boot:run`。NAS 的镜像、数据卷、HTTPS、备份和更新步骤见部署手册。 [NAS 容器部署手册](deploy/nas.zh-CN.md)

## 架构与验证

前端使用 React 19、TypeScript 和 Vite，后端使用 Java 21 和 Spring Boot。业务数据存储在 PostgreSQL 中，Flyway 管理迁移，Caddy 提供前端与 API 代理。GitHub Actions 自动运行前端构建、后端集成测试和容器冒烟测试。 [验证记录](https://github.com/G-GortoN/fluffy-memory-platform/actions)
