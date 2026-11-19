# Fluffy Memory

**English** · [简体中文](README.zh-CN.md) · [繁體中文（香港）](README.zh-HK.md)

Fluffy Memory is a place to care for your pets, keep their memories close, and shop for everyday essentials and personalised keepsakes.

**[Live homepage](https://fluffy-memory.tail0fcefb.ts.net/?lang=en)** · **[Admin dashboard](https://fluffy-memory.tail0fcefb.ts.net/admin?lang=en)**

The site supports English, Simplified Chinese, and Hong Kong Traditional Chinese. Change the language from the navigation bar. The site remembers your choice. Payments on the live demo are simulated. The dashboard requires an administrator account.

## What you can do

- Create profiles for multiple cats and dogs and read care guidance matched to their life stage.
- Build a private memory page with photos, a story, and a timeline. Share it with a link you can revoke.
- Browse the shop, personalise eligible items, see the price and delivery charge before placing an order, and track production, delivery, and refunds.
- Manage products, stock, published care guidance, orders, and fulfilment in the admin area.

## Run or deploy

For a local container environment, copy the example configuration, set the database and admin credentials, and start Docker Compose.

```sh
cp deploy/.env.example deploy/.env
docker compose --env-file deploy/.env -f deploy/compose.yml up --build --wait
```

For frontend development, run `npm ci` and `npm run dev` from `frontend` and use the URL printed by Vite. The API runs from `backend` with `./mvnw spring-boot:run` and PostgreSQL 17. The NAS guide covers verified images, persistent volumes, HTTPS, backups, and updates. [NAS deployment guide (Simplified Chinese)](deploy/nas.zh-CN.md)

## Architecture and checks

React 19, TypeScript, and Vite power the web app. Java 21 and Spring Boot power the API. PostgreSQL stores application data, Flyway manages schema changes, and Caddy serves the frontend and routes API requests. GitHub Actions runs the frontend build, backend integration tests, and a container smoke test. [Checks](https://github.com/G-GortoN/fluffy-memory-platform/actions)
