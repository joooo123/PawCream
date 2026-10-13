# PawCream 轻量应用服务器本机预览（ICP备案审核期间）

适用：已经在阿里云**轻量应用服务器**上使用 Docker Compose 启动了 PostgreSQL + Node.js API，`127.0.0.1:8787/api/health` 返回 `{"ok":true}`，且 OSS `pawcream-photo` 的上传/读取/删除测试都通过。

这是一套**本机预览**部署：Nginx 仅绑定回环地址 `127.0.0.1:8080`（HTTP）和 `127.0.0.1:8443`（HTTPS），不会开放公网 80/443，也不会激活正式域名。项目正式上线必须先完成 ICP 备案及 HTTPS 等配置。

## 1. 获取已审核的部署代码

```bash
cd /opt/pawcream/source
git pull --ff-only
```

确认分支是 `deploy/aliyun-oss-pawcream-studio`，不要擅自删除当前 `.env`、`backend/.env`、PostgreSQL volume。

## 2. 安装用于**构建前端**的本机软件

```bash
apt-get update
apt-get install -y webp file python3-fonttools python3-brotli
```

Node.js 22 已通过 Amazon ECR Public 下载到 Docker，可以直接使用；不必在 Ubuntu 主机上另装 npm。

## 3. 在服务器本机构建前端

```bash
cd /opt/pawcream/source
bash scripts/deploy-local-preview.sh
```

这个脚本会：

1. 只复制 **src、public、scripts 和前端配置**到 `/opt/pawcream` 下的临时构建目录；
2. 不复制 `backend/.env`、根目录 `.env`、数据库文件、Git 历史、用户照片；
3. 把图片优化成 WebP、字体转换为 WOFF2；
4. 在 Node.js 22 Docker 镜像中使用国内 npm 镜像安装前端依赖，`VITE_API_BASE_URL=/api`，构建根路径的生产前端；
5. 将 `dist` 发布到 `/opt/pawcream/dist`，保留旧前端于 `/opt/pawcream/dist.prev`。

这个脚本**不启动 Nginx 或修改防火墙**，因此不提供公网服务。

> 首次构建会耗费几分钟并临时使用磁盘空间（服务器为 2GB RAM / 40GB 磁盘）。不要同时跑多份构建。

## 4. 启动仅本机可见的 Nginx（先生成 HTTPS 预览证书）

原本关闭的 `nginx.service` 继续保持禁用。使用**独立预览配置**，不加载 `/etc/nginx/sites-enabled/default`：

```bash
bash scripts/setup-local-https-preview.sh
```

检查：

```bash
ss -lntp | grep -E ':(8080|8443)'
curl -I http://127.0.0.1:8080/
curl -kI https://127.0.0.1:8443/admin
curl -kfsS https://127.0.0.1:8443/api/health
```

预期只看到 `127.0.0.1:8080` 和 `127.0.0.1:8443` 的 Nginx 回环监听，前端 HEAD 请求成功，API 返回 `{"ok":true}`。

预览控制：

```bash
nginx -s reload -c /opt/pawcream/source/nginx/pawcream-preview.conf
nginx -s stop -c /opt/pawcream/source/nginx/pawcream-preview.conf
```

上述 `nginx -s stop` 停止**预览 Nginx 实例**，不触碰 Node.js API、数据库和 OSS。

## 5. 从自己电脑查看（可选）

如果本地电脑能通过 SSH 登录服务器，可以在本地终端（不是云服务器 SSH 里）建立端口转发：

```bash
ssh -N -L 8080:127.0.0.1:8080 root@你的轻量服务器公网IP
```

再在自己的浏览器打开 `http://127.0.0.1:8080/`。它通过 SSH 隧道访问远程服务器回环端口，无需开放轻量服务器的 8080/80/443 公网防火墙。

**认证请使用 HTTPS 预览（SSH 隧道）：**

```bash
# 在自己的 Windows PowerShell 打开一个新窗口，不是在云服务器中：
ssh -N -L 18443:127.0.0.1:8443 root@你的轻量服务器公网IP
```

在 Windows 浏览器打开 `https://127.0.0.1:18443/admin`。**浏览器 URL 端口 18443 与服务器监听端口 8443 不同**，Node.js 的安全 Cookie 不受这个端口变化影响，但 `CORS_ORIGIN` 必须加入实际的浏览器 Origin：`https://127.0.0.1:18443`。

在更新 `backend/.env` 的 `CORS_ORIGIN=` 这一行时，**保留所有原有值**，在逗号后附加 `https://127.0.0.1:18443`。不要改动 `COOKIE_SECURE=true`、`SESSION_SECRET` 或 OSS 配置。然后执行 `docker compose up -d --no-deps --force-recreate api` 使新环境变量生效。

这个证书由服务器本地生成、仅用于 SSH 隧道预览，是自签名证书，**Chrome 会显示证书不受信任**。仅当地址栏确实为本机 `127.0.0.1`、且 SSH 隧道由你自己建立时，才可在 Chrome 中选择“高级 → 继续访问”；不要将该证书用于公网正式域名。

注意：本地页面 URL 是 `https://127.0.0.1:18443`，后端 `app.set('trust proxy',1)` 从 Nginx 转发的 `X-Forwarded-Proto: https` 判断 TLS，从而发送 Secure Cookie。浏览器刷新 `https://127.0.0.1:18443/api/auth/me` 可确认 Session。

HTTP `http://127.0.0.1:8080` 仍可用于不登录的视觉检查。**不要经 HTTP 输入管理员密码**。证书只保存在服务器 `/etc/nginx/pawcream-preview-{cert,key}.pem`，不会提交进 Git。证书有效期 90 天，到期应重新生成；正式上线必须使用可信 CA 证书。

## 6. 后续正式上线

不要在备案审批期间把 `nginx/pawcream.conf`（监听公网 80）作为当前的预览配置。

取得备案号并确认个人备案经营/用户上传内容合规性后，使用正式 Nginx HTTPS 配置和证书，放开安全组 80/443。上线前需要备份数据库，验证用户登录、公共返图墙发布/撤回、用户间隔离、图片审核和安全控制。
