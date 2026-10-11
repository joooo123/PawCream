# PawCream 管理后台（第一版 /admin）

本功能目前在 **`deploy/aliyun-oss-pawcream-studio` 部署分支** 的 PR 中开发，不会自行部署到轻量应用服务器。请先通过 GitHub Actions 的后台集成测试，再部署。

## 已实现的功能

- `/admin` 独立管理界面，使用现有邮箱/密码登录。
- 后端对所有 `/api/admin/*` 检查 **当前数据库中的角色**，普通用户和未登录用户不能访问。
- 用户列表/搜索、封禁/解除封禁（管理员账号受保护）；封禁后原有登录 Session 立即失效，公开留言和返图同步从公共查询中过滤。
- 留言审核：查看、隐藏、恢复；公开留言读取/点赞均不显示隐藏内容。
- 返图审核：查看、隐藏、恢复；隐藏后公开返图墙和公开图片原地址均不可读取；管理员图片预览只能走鉴权 API。
- 统计概览、可分页审计日志（操作者、操作、时间、对象、原因）。写操作与审计记录同一个 PostgreSQL 事务。
- 管理后台写请求校验来源 Origin 以减少 CSRF 风险。输出不包含 AccessKey、用户密码哈希、Session 内容或私有铁盒图片。

**尚未实现：** 用户自助注销、密码找回、邮件验证码、举报工单、批量审核、OSS 彻底清理、内容自动识别、可配置审核队列。出于防止删除数据库及 OSS 内容不一致的考虑，本版不提供永久删除用户按钮。

## 数据库升级（必须在重启 API 之前）

重要：**已经运行的 PostgreSQL volume 不会重新执行 /docker-entrypoint-initdb.d 脚本**。不要删除 Docker volume，也不要执行 `docker compose down -v`！

登录服务器后执行：

```bash
cd /opt/pawcream/source
git pull --ff-only

# 数据备份到独立目录，不写入 Git 仓库
install -d -m 700 /opt/pawcream/backups
umask 077
docker compose exec -T db pg_dump -U pawcream -d pawcream \
  > "/opt/pawcream/backups/pre-admin-$(date +%Y%m%d-%H%M%S).sql"

# 先迁移 004，再重启 API，保证新代码需要的字段已经存在
docker compose exec -T db psql -v ON_ERROR_STOP=1 -U pawcream -d pawcream \
  < backend/sql/004_admin_console.sql

docker compose exec -T db psql -U pawcream -d pawcream -c \
  "SELECT column_name FROM information_schema.columns WHERE table_name='users' AND column_name='is_disabled';"
```

## 创建第一个管理员

先在目前 PawCream 登录页面使用你的真实邮箱和邀请码**注册一个账号**。注意：现在的 SSH 隧道是 HTTP 预览，`COOKIE_SECURE=true`，浏览器可能不会保存登录 Session；即使页面未显示持续登录，注册请求仍可能已在数据库写入账号。不要因此反复注册；先检查数据库是否存在该邮箱。

查看账号（只显示邮箱、角色）：

```bash
docker compose exec -T db psql -U pawcream -d pawcream -c \
  "SELECT email,role FROM users ORDER BY created_at DESC LIMIT 10;"
```

使用 **交互式 psql** 操作，避免把邮箱 SQL 参数拼接命令而造成特殊字符问题：

```bash
docker compose exec db psql -U pawcream -d pawcream
```

在 psql 交互界面中，将示例邮箱替换为你的真实管理员邮箱：

```sql
UPDATE users
SET role='admin'
WHERE email='your-registered-email@example.com'
RETURNING email, role;
```

**必须看到且仅看到 1 行**返回值，然后输入 `\q` 退出。不要给所有用户设置管理员角色，不要公开管理员的注册邀请码和登录密码。

## 后端启动与前端构建

数据库升级完成之后：

```bash
cd /opt/pawcream/source
docker compose up -d --build api
curl -fsS http://127.0.0.1:8787/api/health
bash scripts/deploy-local-preview.sh
```

若已经启动独立本机预览 Nginx `127.0.0.1:8080`，它会直接使用更新后的 `/opt/pawcream/dist`，无需重启。测试：

```bash
curl -I http://127.0.0.1:8080/admin
curl -fsS http://127.0.0.1:8080/api/health
```

**当前 SSH 隧道 HTTP 环境并不适合作为最终管理员会话验收环境**：生产 `COOKIE_SECURE=true` 必须配合 HTTPS。不要为了测试就把正式站的 Cookie 安全属性长期关闭。正式域名在 ICP 备案允许上线且 HTTPS 证书配置完成后，再通过 `https://pawcream.studio/admin` 实测完整登录与权限。

## 安全核验

1. 未登录调用 `/api/admin/users` 应返回 401。
2. 普通账号登录后访问应返回 403。
3. 管理员登录后可以看到概览和用户数据，但不能封禁自己或其他管理员。
4. 隐藏的照片应从 `/api/photos` 消失，且 `/api/photos/:id/image` 返回 404；仅管理员图片 API 还能查看。
5. 封禁后被封账号原有 Session 应立即失效。
6. 所有成功执行的封禁、解禁、隐藏和恢复都应在审计日志可查。
7. 还需独立核对数据备份恢复、合规性、内容审核职责，才能对外开放公众注册和上传。

## 回退

前端可以重新构建旧版或恢复 `/opt/pawcream/dist.prev`，API 可以切回原 Docker 镜像并重启。004 迁移新增的字段/审计表可保留（向前兼容），**不要为了回退直接删除字段或清空表**。用数据库备份恢复前必须明确备份时点，避免覆盖后续真实用户数据。
