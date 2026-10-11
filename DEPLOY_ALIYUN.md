# PawCream（泡泡筒）· 阿里云 ECS + OSS 部署

正式品牌域名：pawcream.studio。代码仓库：joooo123/PawCream。

> **备案尚在审核时，不要通过 pawcream.studio 或北京 ECS 公网 IP 对外提供正式网站服务。**
> 可以先进行 ECS 本机回环地址测试、Docker/数据库部署和 ECS → OSS 内网联调。等 ICP 备案审核通过后，再开放域名、80/443 和 HTTPS。

## 目标架构

- 静态 React/Vite 页面：ECS 系统 Nginx，根目录 `/opt/pawcream/dist`
- API：Docker 中的 Node.js，主机仅监听 `127.0.0.1:8787`
- 数据库：Docker 中的 PostgreSQL 16，**不对公网暴露 5432**
- 公开返图墙图片：一个**私有 OSS Bucket**，ECS 通过北京同地域内网 Endpoint 访问
- 用户的私人铁盒：目前仍属于浏览器端本地存储，**不是云端同步功能**

前端维持同源 `/api`，无需把 OSS 签名或者凭据发送给浏览器。OSS 使用 ECS 实例 RAM 角色，不使用永久 AccessKey。用户撤回公开返图时，会删除相应 OSS 对象；关闭了 OSS 版本控制的 Bucket 不会保留该对象的历史版本。

## 0. 首次确认

1. ECS 与 OSS Bucket 同为华北 2（北京）。
2. Bucket 保持 **私有读写**、**阻止公共访问**、**版本控制关闭**。
3. 根据业务需要，确认是否启用了标准存储、LRS 或 ZRS、SSE-OSS；这些配置不由代码控制。
4. ECS 系统中可运行 `docker compose version` 和 `nginx -v`。以下命令按照 Ubuntu 系统示例编写，其他发行版请调整安装命令。
5. 服务器开放 SSH 仅给可信地址；**备案前不要开放正式网站的公网访问**。

## 1. 拉取仓库并启动数据库/API

在 ECS 登录后（安装 Docker Engine + Compose 插件、Nginx、Git 等依赖后）：

```bash
sudo mkdir -p /opt/pawcream
sudo chown "$USER":"$USER" /opt/pawcream
git clone https://github.com/joooo123/PawCream.git /opt/pawcream/source
cd /opt/pawcream/source

cp backend/.env.example backend/.env
```

在服务器上创建根目录 `/opt/pawcream/source/.env`（仅供 Compose 展开数据库密码）：

```bash
umask 077
openssl rand -hex 32
# 将生成的随机值填写为 /opt/pawcream/source/.env 的 POSTGRES_PASSWORD
```

`/opt/pawcream/source/.env` 的内容格式为：

```ini
POSTGRES_PASSWORD=此处填刚生成的随机密码
```

编辑 `backend/.env`：

- `SESSION_SECRET`：独立生成至少 32 字节的随机值，例如 `openssl rand -hex 32`
- `INVITE_CODE`：自行设定的注册邀请码（正式开放注册前推荐启用）
- `CORS_ORIGIN=https://pawcream.studio,https://www.pawcream.studio`
- `COOKIE_SAME_SITE=lax` 和 `COOKIE_SECURE=true`（HTTPS 正式站点）
- `PHOTO_STORAGE=database`：首次启动、数据库迁移和 RAM 角色未配置前先保持该模式

不要将 `.env`、`backend/.env`、密钥或用户照片提交到 GitHub。

```bash
docker compose up -d --build
docker compose ps
curl --fail http://127.0.0.1:8787/api/health
```

全新 PostgreSQL 数据卷会自动执行 `backend/sql/001_init.sql`、`002_public_photos.sql`、`003_oss_photos.sql`。

**已有数据库不能删除 volume 来强制初始化！** 应备份数据库后手动执行新增迁移：

```bash
docker compose exec -T db pg_dump -U pawcream pawcream > pawcream-before-oss.sql
docker compose exec -T db psql -v ON_ERROR_STOP=1 -U pawcream -d pawcream < backend/sql/003_oss_photos.sql
```

如果已有数据库尚未执行 002，应先执行 002，再执行 003。

## 2. 创建并绑定 ECS RAM 角色

阿里云控制台操作：

1. RAM 访问控制 → 身份管理 → 角色 → 创建**阿里云服务 ECS**可信角色。
2. 自定义权限策略：把示例中的 `pawcream-photo` 替换为实际 Bucket 名称。
3. 给该角色授予这份**仅允许指定对象前缀**的策略。
4. ECS 控制台 → 实例 → 实例 RAM 角色 → 绑定到北京 ECS。
5. 如需明确角色名，在 `backend/.env` 中设置 `OSS_ECS_ROLE_NAME`。

```json
{
  "Version": "1",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "oss:PutObject",
        "oss:GetObject",
        "oss:DeleteObject"
      ],
      "Resource": [
        "acs:oss:*:*:pawcream-photo/public/*"
      ]
    }
  ]
}
```

不要使用主账号 AccessKey，也不要把 RAM 长期 AccessKey 放在服务器文件或 GitHub。当前实现使用 ECS IMDSv2 的临时凭据自动刷新。如果 Docker 网络无法访问 ECS 实例元数据服务，应先排查 ECS IMDSv2、实例角色和容器网络配置，不能为了绕过问题而在前端填写 AccessKey。

## 3. 切换 OSS

在 `backend/.env` 中设置：

```ini
PHOTO_STORAGE=oss
OSS_BUCKET=pawcream-photo
OSS_REGION=oss-cn-beijing
OSS_ENDPOINT=https://oss-cn-beijing-internal.aliyuncs.com
OSS_ECS_ROLE_NAME=你绑定的ECS角色名称
```

如果 Bucket 不在北京，先停下来核对，不能直接沿用北京内网地址。

```bash
cd /opt/pawcream/source
docker compose up -d --build api
docker compose logs --tail=100 api
curl --fail http://127.0.0.1:8787/api/health
```

注意健康检查只确认 API/数据库可用，**不代表 OSS 上传已经成功**。还要用测试账号进行「公开返图 → 在 OSS 控制台看到 `public/` 对象 → 其他浏览器读取 → 撤回返图 → OSS 对象消失」的端到端测试。

为兼容既有数据，旧 `image_data` 照片仍可从 PostgreSQL 读取；新上传使用 `oss_key` 指向 OSS，不再向数据库写入原图。不要立即删掉旧字段和历史照片。当前 3MB 图片上传仍通过 ECS API 转发（并非浏览器直传）；等正式备案和 HTTPS 域名配置完成后，可以再优化成短期签名直传。

**本阶段无须在 OSS 上配置 CORS**，因为浏览器只请求同源 `/api`，OSS 请求由 Node.js 后端在内网完成。请继续保持 Bucket 私有。

## 4. 前端构建 + Nginx

示例 Nginx 配置：`nginx/pawcream.conf`。它将 `/api/` 转发到 `127.0.0.1:8787`，静态根目录是 `/opt/pawcream/dist`。

```bash
sudo cp nginx/pawcream.conf /etc/nginx/conf.d/pawcream.conf
sudo nginx -t
sudo systemctl enable --now nginx
sudo systemctl reload nginx
```

如果系统启用默认站点（`default_server`），应确认它不会抢占 PawCream 的 Host 匹配规则。备案之前，不要向公网开放 80/443，仅在 ECS 本地使用：

```bash
curl -H 'Host: pawcream.studio' http://127.0.0.1/api/health
```

前端用仓库现有的 `deploy.sh` 构建部署。该脚本需要源码 ZIP 文件、Docker、Python、WebP/字体工具；可以从 GitHub 仓库的 Code → Download ZIP 下载，并传到 ECS，例如 `/home/admin/PawCream-main.zip`：

```bash
sudo bash /opt/pawcream/source/deploy.sh /home/admin/PawCream-main.zip
```

它会在 `/opt/pawcream/dist` 生成正式网站的根路径构建，自动保留上一版本 `dist.prev`。已支持重新加载系统 Nginx，无需额外的 `web` Docker 服务。

## 5. 备案通过后再执行

1. 在阿里云云解析 DNS 配置 `@`、`www` 到 ECS 公网 IP。
2. 安全组按需要开放 80/443；保留 8787、5432 仅本机/容器网络访问。
3. 用 Certbot 或合规证书管理方案签发和配置 HTTPS：`pawcream.studio`、`www.pawcream.studio`。
4. 确认 Nginx 80 → 443 跳转、证书自动续期和 `COOKIE_SECURE=true`。
5. 真实账号测试登录/退出、留言、公开返图、撤回、用户访问隔离。
6. **个人 ICP 备案是否允许提供公共用户投稿/返图墙，需要在对外开放前确认**，并落实内容审核、举报、隐私政策与数据删除流程。
7. 考虑 PostgreSQL 加密备份、容量/流量账单预警、图片尺寸和用户上传配额。图片删除后无法恢复是一项产品规则，不等于数据库和业务无需备份。

## 6. 常见误区

- OSS 可以放在阿里云，但域名不是必须在同一家公司购买（当前 pawcream.studio 已在阿里云）。
- 阿里云 OSS 默认公网 Endpoint 对新用户的中国内地数据 API 存在限制；本阶段用 ECS 内网 Endpoint 避免依赖尚未备案的 OSS 自定义域名。
- 私有 Bucket 不应对所有互联网用户开启公共读；以后图片直传须签名/限定目录与大小。
- 上线后如果准备开启 `img.pawcream.studio`，应另行绑定 OSS 自定义域名、完成 HTTPS 配置并设计私有原图的访问鉴权。
- 个人独立站与小红书离线小工具是两个发布目标；小工具版不能假定能调用独立站 API。
