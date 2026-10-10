# PawCream 阿里云部署

当前仓库继续由 GitHub Pages 负责前端预览；真实账号和公共留言需要运行本仓库中的 Node.js + PostgreSQL 后端。

## 目录

- `src/`：React/Vite 前端
- `backend/`：PawCream API
- `backend/sql/001_init.sql`：PostgreSQL 初始化结构
- `docker-compose.yml`：PostgreSQL + API
- `nginx/pawcream.conf`：正式站点反向代理示例

## 首次部署后端

在阿里云 ECS 安装 Docker 与 Docker Compose，然后在仓库根目录执行：

```bash
cp backend/.env.example backend/.env
```

修改 `backend/.env`，至少替换：

- `SESSION_SECRET`：随机长字符串
- `INVITE_CODE`：PawCream 注册邀请码
- `CORS_ORIGIN`：GitHub Pages 预览地址，正式同域后可删除
- GitHub Pages 跨域预览时保持 `COOKIE_SECURE=true`、`COOKIE_SAME_SITE=none`

另外在 shell 或服务器环境文件中设置数据库密码：

```bash
export POSTGRES_PASSWORD='replace-with-a-strong-password'
docker compose up -d --build
```

API 默认只绑定到服务器本机 `127.0.0.1:8787`，PostgreSQL 不开放公网端口。

健康检查：

```bash
curl http://127.0.0.1:8787/api/health
```

## 前端连接真实 API

GitHub Pages 预览阶段，可在 Actions 构建环境加入：

```text
VITE_API_BASE_URL=https://你的-api-域名/api
```

正式迁到同一域名后推荐：

```text
VITE_API_BASE_URL=/api
```

未配置 `VITE_API_BASE_URL` 时，GitHub Pages 会进入明确标注的便签预览模式，不会把浏览器本地数据伪装成公共留言。

## Nginx

把 `nginx/pawcream.conf` 中的 `pawcream.example.com` 改成正式域名，将 Vite 的 `dist/` 内容部署到：

```text
/var/www/pawcream
```

然后使用 Certbot 或阿里云证书配置 HTTPS。正式生产环境只需要对公网开放 80/443；不要开放 PostgreSQL 5432。


## 公共返图墙（People）

公共照片与本地铁盒相互独立：只有登录用户在铁盒展开视图中点击「公开到返图墙」并确认后，才会上传服务器。撤回公开会删除服务器中的图片，不会删除本地铁盒原件。其他访客无需登录即可浏览已公开照片。

公共照片存储在 PostgreSQL 的 `public_photos` 表中，每张图片限制 3MB（PNG/JPEG/WebP），公开操作需要真实账号会话。照片不使用预览假数据。

**已有数据库务必手动执行新增迁移：**

```bash
docker compose exec -T db psql -U pawcream -d pawcream < backend/sql/002_public_photos.sql
docker compose up -d --build api
```

新建的空 PostgreSQL 数据卷会自动执行 `backend/sql/002_public_photos.sql`。不要删除现有数据库卷，也不要为此重新初始化已有的数据库。

GitHub Pages 是静态前端，不运行 PostgreSQL 或 API。要让 GitHub Pages 预览也连接真实返图墙，在仓库 **Settings → Secrets and variables → Actions → Variables** 中新增：

```text
PAWCREAM_API_BASE_URL=https://你部署的-API-域名/api
```

然后重新运行 GitHub Pages 工作流。后端的 `CORS_ORIGIN` 要包含 `https://joooo123.github.io`，跨站会话使用 HTTPS、`COOKIE_SAME_SITE=none` 与 `COOKIE_SECURE=true`。如果 GitHub Pages 未配置此变量，返图墙会清楚显示未连接服务器，不会用 IndexedDB 假装是跨用户的公共墙。

同域名正式部署时使用 `VITE_API_BASE_URL=/api`，并让 Nginx 转发至现有的 PawCream API。发布后通过两个不同账号和不同浏览器验证：仅主动公开的照片可见，撤回后公共墙无法再访问该图片，本地铁盒不受影响。
