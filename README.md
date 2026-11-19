# Fluffy Memory

面向猫狗主人的照护、纪念与自营商城。用户可管理多宠档案、查看日常照护建议、布置私密回忆角，以及购买主粮、喂食碗、定制相框和纪念用品。结算前会校验所选商品的库存，并显示商品小计、运费和合计。运营后台管理商品、照护内容、订单、定制进度和售后。

[首期实施方案](implementation-plan.zh-CN.md)

## 本地运行

准备 Docker Compose，复制示例配置并填入本地数据库密码和后台账号。后台密码至少 12 个字符。模拟支付用于开发验收。

```sh
cp deploy/.env.example deploy/.env
docker compose --env-file deploy/.env -f deploy/compose.yml up --build --wait
```

在浏览器打开 [Fluffy Memory](http://127.0.0.1:8087)。前台可注册普通账号。使用配置中的后台邮箱和密码登录后，访问 `/admin`。

应用由 `web`、`api`、`db` 三个服务组成。Caddy 提供前端页面并将 `/api` 转发给 Java API。PostgreSQL 和上传图片分别保存在独立卷中。部署到受控 HTTPS 入口时设 `APP_COOKIE_SECURE=true`。使用 `docker compose ... down` 可停止服务并保留数据卷。

### 分开开发前端与后端

准备 Java 21、Node.js 24 和 PostgreSQL 17，创建名为 `fluffy_memory` 的数据库和可连接的数据库用户。将 `DATABASE_URL`、`DATABASE_USERNAME`、`DATABASE_PASSWORD`、`APP_ADMIN_EMAIL` 和 `APP_ADMIN_PASSWORD` 写入本地环境。Flyway 在首次启动时创建业务表和样例数据。

```sh
cd backend
SPRING_PROFILES_ACTIVE=local ./mvnw spring-boot:run
```

在另一终端运行前端。

```sh
cd frontend
npm ci
npm run dev
```

Vite 显示本地访问地址，默认将 `/api` 代理到 `http://127.0.0.1:8093`。本地 API 端口可通过 `PORT` 指定，前端代理地址可通过 `API_PROXY_TARGET` 指定。

## 验证与发布

GitHub Actions 运行 Maven 验证、前端构建和 Compose 冒烟检查。真实收款前需要接入支付渠道并完成付款、退款和对账验收。样例商品、实物寄样及线下告别服务按[首期实施方案](implementation-plan.zh-CN.md)管理。首次正式发布前，通过商品后台核对样例商品的上架状态。

项目使用 Java 21、Spring Boot 4、Spring Security、JDBC、PostgreSQL 17 和 Flyway。前端使用 React 19、TypeScript、Vite 8、React Router、TanStack Query 和 Ant Design 6。

## 演示图像

`frontend/public/images/` 内的 WebP 由内置 ImageGen 生成。场景包括同卧亚麻沙发的金毛和虎斑猫、在陶瓷水碗旁的虎斑猫，以及有金毛照片和花瓶的橡木纪念角。商品图采用统一棚拍布光，分别展示陶瓷碗、宠物相框、主粮、骨灰盒、挂饰和保健品。
