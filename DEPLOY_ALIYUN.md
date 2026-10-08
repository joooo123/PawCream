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
