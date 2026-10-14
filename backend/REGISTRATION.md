# 注册邀请码与邮箱验证

所有新用户注册都需要 **一次性邀请码** 和 **邮箱收到的 6 位验证码**。旧的 `INVITE_CODE` 环境变量不再生效；已经注册的用户不受影响。

## 已有服务器升级（不会清空现有账号或照片）

在与已部署的管理后台代码合并并核对后，先备份数据库，再从仓库根目录运行：

```bash
docker compose exec -T db psql -U pawcream -d pawcream < backend/sql/004_invite_email_verification.sql
docker compose up -d --build api
```

**不要删除现有 PostgreSQL 数据卷**。如果服务器代码含有尚未推送到 GitHub 的后台改动，不要直接用此分支的旧版 `backend/src/server.js` 覆盖服务器文件，先合并代码。

## SMTP 配置

在服务器的 `backend/.env` 添加并替换为自己的邮件服务商信息：

```dotenv
SMTP_HOST=smtp.example.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=sender@example.com
SMTP_PASS=your-smtp-app-password
SMTP_FROM="PawCream <sender@example.com>"
```

邮箱服务商通常要求 SMTP 授权码而不是网页登录密码。请使用可发送邮件的账户，生产环境使用 HTTPS，不要把 `.env` 提交到 GitHub。未配置 SMTP 时发送验证码返回 503，不能绕过验证进行注册。

## 生成邀请码

升级 API 后运行（直接在运行中的 API 容器执行）：

```bash
docker compose exec -T api node scripts/create-invites.mjs 10
```

每次会打印 10 个例如 `PC-ABCD-2345` 的唯一随机邀请码。完整邀请码存于 PostgreSQL `invite_codes` 表；每个只允许成功注册一个账号。生成命令可重复执行，新的邀请码不影响旧邀请码。

## 注册安全规则

- 必须先填写邮箱和邀请码，点击「发送验证码」，然后从邮箱复制 6 位数字并注册。
- 验证码 10 分钟有效，连续输错最多 5 次，单邮箱 60 秒内只能发送一次、每小时最多 5 次；发送接口另设每 IP 15 分钟 5 次限制。
- 注册成功后，邀请码在同一个数据库事务中被标记为已使用，验证码同时失效；并发注册不会重复消费同一个邀请码。
- 旧账号可继续正常登录，无需重新邮箱验证。
