# NAS 容器部署

NAS 使用 `deploy/compose.nas.yml`。Compose 项目名为 `fluffy-memory-nas`，数据库和媒体分别使用项目内的命名卷 `database` 和 `media`。Web 服务绑定宿主机 `127.0.0.1:18082`。外部 HTTPS 由宿主机入口终止并转发至该端口。

## 准备发布包

从 GitHub Actions 的成功运行下载 `nas-linux-amd64-<commit>` 产物。它包含经容器测试的 Web 和 API 镜像、SHA-256 校验文件，以及使用完整提交 SHA 标记镜像的 `images.env`。将发布包解压到 NAS 的独立发布目录，同时复制同次提交的 `deploy/compose.nas.yml` 和 `deploy/.env.nas.example`。

在发布目录校验后，将镜像导入已有 Docker 引擎。

```sh
sha256sum -c SHA256SUMS
sudo docker image load --input fluffy-memory-images.tar.gz
```

数据库默认使用 `postgres:17-alpine`。如果 NAS 已缓存经核实的 PostgreSQL 17 镜像，可以在私有环境文件中通过 `DB_IMAGE` 指定该标签或摘要。首次启动使用独立的数据库密码和管理员密码。管理员密码至少 12 个字符，应用在初次启动时创建账号。

```sh
umask 077
cp deploy/.env.nas.example deploy/.env
chmod 600 deploy/.env
# 编辑 deploy/.env，填写本机保存的数据库和后台凭据。
```

## 启动与验证

在含 `deploy/` 的 NAS 部署目录运行。将示例发布目录替换为实际解包路径，并保留当前生效的发布目录。

```sh
release_dir='releases/your-commit-sha'
sudo docker compose --env-file deploy/.env --env-file "$release_dir/images.env" \
  -f deploy/compose.nas.yml up -d --no-build --wait --wait-timeout 120
sudo docker compose --env-file deploy/.env --env-file "$release_dir/images.env" \
  -f deploy/compose.nas.yml ps
curl -fsS http://127.0.0.1:18082/healthz
curl -fsS http://127.0.0.1:18082/api/products
```

将公开入口配置为可信 HTTPS 域名，转发到 `http://127.0.0.1:18082` 并保留原始主机名。使用外部网络验证 HTTPS 证书、`/healthz`、首页、商城和受保护 API。浏览器登录后检查 `FLUFFY_SESSION` 带 `Secure`、`HttpOnly` 和 `SameSite=Lax`。使用测试账号核对宠物照护、纪念分享撤销和模拟订单。当前演示使用 `APP_SIMULATED_PAYMENTS=true`，不会收取真实款项。

### 通过 Tailscale Funnel 提供公网入口

在私有环境文件中设置 `TAILSCALE_IMAGE`，指向已核对的官方 Tailscale 镜像标签或摘要。使用 Funnel 时，始终在 Compose 命令中同时传入 `-f deploy/compose.nas.yml -f deploy/compose.nas-funnel.yml`。这会启动独立设备 `fluffy-memory` 使用的侧车容器。侧车共享 Web 容器的网络命名空间，并把登录和 Funnel 配置保存在独立 `funnel_state` 卷中。首次启动后，用相同的 Compose 文件及环境文件执行以下命令。

```sh
docker compose ... exec -T funnel tailscale up --hostname=fluffy-memory
docker compose ... exec -T funnel tailscale funnel --bg --https=443 http://127.0.0.1:8080
docker compose ... exec -T funnel tailscale funnel status
```

首条命令会给出设备授权页面，由 tailnet 管理员完成授权。Funnel 需要该设备具备公网分享权限，启动后以 `funnel status` 输出的 HTTPS 地址为准。使用 `docker compose ... exec -T funnel tailscale funnel --https=443 off` 可关闭该设备的公网入口。 [Tailscale 容器用户空间模式](https://tailscale.com/docs/concepts/userspace-networking) · [Funnel 命令参考](https://tailscale.com/docs/reference/tailscale-cli/funnel)

## 更新与恢复

更新前备份数据库、媒体和私有环境文件。`pg_dump -Fc` 可通过 `docker compose exec -T db pg_dump -U fluffy_memory -Fc fluffy_memory` 输出到受限目录。媒体位于 API 容器的 `/app/media`，可通过 `docker compose exec -T api tar -C /app/media -czf - .` 归档。备份后校验数据库归档和媒体归档的完整性，再按需复制到 NAS 之外。

新版本使用新发布目录。校验并加载新镜像后，用新的 `images.env` 执行 `up -d --no-build --wait`。应用启动前核对数据库迁移的兼容性。若需要回退，使用上一个可兼容版本的 `images.env` 和已保留的镜像重启。需要还原数据库时，先在独立卷上验证备份，再切换。停服使用 `docker compose ... down`，此命令保留数据库和媒体卷。
