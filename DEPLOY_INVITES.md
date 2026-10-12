# PawCream 一次性邀请码与邮箱验证（005）

## 设计

- 邀请码统一为 `PC-XXXX-XXXX`，例如 `PC-H7KD-T4QW`（仅格式示意，**并非有效邀请码**）。生成使用操作系统加密安全随机数，不采用顺序编号，以防根据一个邀请码推断下一个。
- 只有登录管理员才能在 `/admin → 邀请码` 生成（每批 1–20 个）、查看使用状态、撤销未使用邀请码。
- **完整邀请码只在生成时返回一次**。数据库只保存 SHA-256 哈希及后 4 位；管理员列表不会再显示完整码。请管理员复制后私下分发，切勿公开到网站。
- 注册阶段：填写邮箱、密码、邀请码 → 发送 6 位邮箱验证码 → 10 分钟内填写验证码 → 原子事务创建用户并消耗邀请码。
- 一张码最多创建一个用户。并发注册通过 PostgreSQL 行级锁串行处理，邮箱验证码与邮箱和邀请码绑定。验证码只存储服务器密钥衍生的 HMAC，不以明文入库。
- 同一邮箱发送冷却 60 秒、每小时最多 5 次；验证码错误最多 5 次。另有 IP 级接口访问频率限制。
- 以前注册的用户及管理员可以照常登录；原来的 `INVITE_CODE` 不再授予注册权限。
- 未配置 SMTP 时发验证码接口返回 HTTP 503 并说明邮件服务尚未配置，**不会绕过邮箱校验**。

## SMTP 邮件发信

需要你自己使用一个经过授权的邮件发信服务，例如阿里云邮件推送、QQ 邮箱、163 邮箱或企业邮箱，并取得对应的 SMTP 服务地址及**SMTP 授权码**。注意：有的邮箱不允许普通登录密码用于 SMTP，有的云服务需要先验证域名/发信地址或批准用量。

修改服务器本地 `/opt/pawcream/source/backend/.env` （不要贴给任何人，也不要提交 Git）：

```dotenv
SMTP_HOST=由发信服务商提供的地址
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=由服务商提供的发信账号
SMTP_PASS=由服务商提供的SMTP授权码或凭据
SMTP_FROM="PawCream <已验证的发信地址>"
```

以上仅为示意。若服务商要求 587/STARTTLS，则一般用 `SMTP_PORT=587`、`SMTP_SECURE=false`；**绝不能随意把生产邮件的 TLS 关闭而用明文发信**。

保留已有 `CORS_ORIGIN`、`SESSION_SECRET`、`COOKIE_SECURE=true`、数据库和 OSS 配置不变。不要将真实 SMTP 用户名、密码、授权码或验证码发到聊天或截图中。

邮件模板为纯文本，验证码只发送到目标邮箱，不通过注册 API 返回，也不写日志。正式使用前需要确保测试邮箱能实际收到邮件，包括垃圾邮件箱。

## 数据库升级（必须先于新后端）

原 PostgreSQL volume 不会自动重跑初始化 SQL。**禁止 `docker compose down -v`！**

```bash
cd /opt/pawcream/source
git pull --ff-only

install -d -m 700 /opt/pawcream/backups
umask 077
docker compose exec -T db pg_dump -U pawcream -d pawcream \
  > "/opt/pawcream/backups/pre-invites-$(date +%Y%m%d-%H%M%S).sql"

# 确认备份非空且尾部具有 PostgreSQL database dump complete 标记。
# 再执行 005 迁移；脚本支持重复执行。
docker compose exec -T db psql -X -v ON_ERROR_STOP=1 -U pawcream -d pawcream \
  < backend/sql/005_signup_verification.sql
```

确认：
```bash
docker compose exec -T db psql -U pawcream -d pawcream \
  -c "SELECT to_regclass('public.registration_invites'), to_regclass('public.registration_email_codes');"
```

然后在 SMTP 服务参数正确配置且邮件发送功能可用后：

```bash
docker compose up -d --no-deps --build api
curl -fsS http://127.0.0.1:8787/api/health
bash scripts/deploy-local-preview.sh
```

原有回环 Nginx + SSH 隧道不变。认证请从 `https://127.0.0.1:18443/` 打开，避免 HTTP 端口的安全 Cookie 问题。实际服务商 SMTP 凭据未准备好之前建议暂缓更新 API，因为新代码禁止再用旧的通用邀请码注册。

## 端到端验收

管理员使用 HTTPS 登录 `/admin`，切换「邀请码」，生成并立即复制一次性邀请码，然后从私密渠道分发；打开新的浏览器会话，通过 HTTPS 打开网站→注册，填写邀请与真实邮箱→发送邮件→输入 6 位数字→注册成功并登录；同一邀请码第二次注册必须被拒绝。确认管理员邀请码列表显示“已使用”、关联用户邮箱，并且操作审计里有生成记录；撤销的邀请码不能注册。

回退时不要清理 005 表，不要丢弃数据备份。下一次正式网站开放注册之前，仍需确认邮件服务运营许可、隐私说明、内容发布合规和异常监控。
