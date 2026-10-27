# 智芽阿里云后端部署

本目录把智芽的 Node.js AI 网关与 Python 脑洞放映厅服务打进同一个 Docker 镜像。公网只暴露一个 HTTPS 域名：

- `/api/*`：AI 伙伴、成长建议、拍照识别、语音和创造模块 API。
- `/brain/api/*`：脑洞放映厅、影片、作品和相关模型 API。

SQLite、成片与运行日志全部写入宿主机 `/opt/zhiya/data`。模型密钥只保存在服务器 `/opt/zhiya/secrets/zhiya.env`，不会打入镜像、网页或 APK。

## 1. 购买与网络

在阿里云轻量应用服务器中购买中国香港 Ubuntu 24.04 实例，建议至少 2 vCPU、2 GB 内存、40 GB 系统盘，并覆盖比赛演示所需的两个月周期。

防火墙只开放：

- `80/TCP`：Caddy 申请和续期 HTTPS 证书。
- `443/TCP`：APK 的唯一公网入口。
- `22/TCP`：仅允许管理员当前公网 IP，部署完成后不要向所有地址开放。

为 API 子域名添加 A 记录，指向服务器公网 IPv4。例如 `api.example.com`。等待 DNS 生效后再启动 Caddy。

## 2. 安装 Docker 与 Caddy

登录服务器后，按 Docker 官方 Ubuntu 仓库方式安装 Docker Engine 与 Compose 插件，按 Caddy 官方 Debian/Ubuntu 仓库方式安装 Caddy。验证：

```bash
docker version
docker compose version
caddy version
```

创建受保护目录：

```bash
sudo mkdir -p /opt/zhiya/app /opt/zhiya/data /opt/zhiya/secrets
sudo chown -R "$USER":"$USER" /opt/zhiya/app /opt/zhiya/data
sudo chown root:root /opt/zhiya/secrets
sudo chmod 700 /opt/zhiya/secrets
```

把 Git 仓库克隆到 `/opt/zhiya/app`。不要上传本机 `.env`、`.env.local`、keystore 或签名密码文件。

## 3. 轮换并填写密钥

项目开发期使用过的密钥都必须先在相应平台撤销并重新生成。不要复制本机旧 `.env` 的值。

以本目录 `.env.example` 为字段清单，在服务器创建：

```bash
sudo install -m 600 -o root -g root /dev/null /opt/zhiya/secrets/zhiya.env
sudoedit /opt/zhiya/secrets/zhiya.env
```

必须由你亲自在服务器中填写以下新密钥：

```text
DEEPSEEK_API_KEY
VISION_API_KEY
ZHIPU_API_KEY
ARK_API_KEY
VIDEO_API_KEY
VOICE_API_KEY
```

保留 `.env.example` 中的模型、限额、`DATA_DIR=/data` 和 `ALLOWED_ORIGINS` 配置。云服务器不要设置本机 `HTTPS_PROXY` 或 `HTTP_PROXY`。

确认权限与 Git 状态：

```bash
sudo stat -c '%a %U %G %n' /opt/zhiya/secrets/zhiya.env
cd /opt/zhiya/app
git status --short
```

第一条应显示 `600 root root`；第二条不能出现密钥文件。

## 4. 构建并启动容器

```bash
cd /opt/zhiya/app/deploy/aliyun
sudo docker compose build --pull
sudo docker compose up -d
sudo docker compose ps
curl --fail http://127.0.0.1:8080/api/health
curl --fail http://127.0.0.1:8080/brain/api/health
```

应用端口只绑定宿主机 `127.0.0.1:8080`，不能绕过 Caddy 直接从公网访问。

## 5. 配置固定域名 HTTPS

复制本目录 `Caddyfile`：

```bash
sudo cp /opt/zhiya/app/deploy/aliyun/Caddyfile /etc/caddy/Caddyfile
sudo systemctl edit caddy
```

在 systemd override 中写入真实域名（只写域名，不含 `https://` 或路径）：

```ini
[Service]
Environment=ZHIYA_API_DOMAIN=api.example.com
```

然后：

```bash
sudo systemctl daemon-reload
sudo systemctl restart caddy
sudo systemctl status caddy --no-pager
curl --fail https://api.example.com/api/health
curl --fail https://api.example.com/brain/api/health
```

只有这两个公网健康检查都返回 `ok: true` 后，才能把 `https://api.example.com` 作为 APK 的 `ZHIYA_PRODUCTION_API_ORIGIN`。

## 6. 持久化与更新

备份时停止容器或先复制 SQLite 快照，然后备份整个 `/opt/zhiya/data`。更新源码后：

```bash
cd /opt/zhiya/app
git pull --ff-only
cd deploy/aliyun
sudo docker compose build --pull
sudo docker compose up -d
```

容器重建不会删除 `/opt/zhiya/data`。更新后再次检查两个 HTTPS 健康端点，并进行一次 AI 伙伴、拍照识别、影片和语音的有限调用。

## 7. 安全检查

- `sudo ss -lntp`：公网仅应看到 80、443 和受限 SSH；8080 只监听 `127.0.0.1`。
- `sudo docker compose logs --tail=200`：日志中不得出现密钥值、Authorization 请求头或学生上传正文。
- 非白名单 Origin 不应得到 `access-control-allow-origin`。
- 过大的请求应返回 413，短时间突发请求应返回 429。
- `/opt/zhiya/data/bh.db`、`films/`、`server.log`、`runtime.log` 应在重启后保留。

删除临时验收作品时，只删除验收过程中创建且已确认 ID 的记录，不要清空整个数据目录。
