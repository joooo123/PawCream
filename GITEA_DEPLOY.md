# PawCream · Gitea + Nginx 内网 IP 部署

这套配置用于把 PawCream 从 GitHub Pages 迁移到自建 Gitea 服务器，并通过现有 Nginx 使用内网 IP 访问。

## 目标访问地址

默认配置使用：

```text
http://<服务器内网IP>:8088/
```

不需要域名，也不会占用 Gitea 当前使用的 80/443 端口。

## 1. 上传仓库到 Gitea

把当前仓库完整上传到 Gitea，保留 `public/assets`、`src`、`package-lock.json` 等文件。

Gitea 版本使用：

```bash
npm run build:gitea
```

它会用 `/` 作为 Vite base，因此所有 PawCream 静态资源会从 IP 根路径加载；原 GitHub 构建仍然使用 `/PawCream/`。

## 2. 首次部署静态文件

在 Gitea 服务器上进入仓库目录：

```bash
chmod +x scripts/deploy-gitea.sh
sudo mkdir -p /var/www/pawcream
sudo chown -R "$USER":"$USER" /var/www/pawcream
./scripts/deploy-gitea.sh
```

脚本会执行：

```text
npm ci
npm run build:gitea
dist/ -> /var/www/pawcream/
```

## 3. 增加 Nginx 静态站点

仓库内已经提供：

```text
deploy/nginx-pawcream-ip.conf
```

将其复制到当前 Nginx 配置目录。常见路径二选一：

```bash
sudo cp deploy/nginx-pawcream-ip.conf /etc/nginx/conf.d/pawcream.conf
```

或 Debian/Ubuntu 风格：

```bash
sudo cp deploy/nginx-pawcream-ip.conf /etc/nginx/sites-available/pawcream
sudo ln -s /etc/nginx/sites-available/pawcream /etc/nginx/sites-enabled/pawcream
```

然后检查并重载：

```bash
sudo nginx -t
sudo systemctl reload nginx
```

打开：

```text
http://<服务器内网IP>:8088/
```

## 4. 如果服务器启用了防火墙

Rocky/RHEL/CentOS 常见配置：

```bash
sudo firewall-cmd --permanent --add-port=8088/tcp
sudo firewall-cmd --reload
```

如果只在可信内网使用，也可以按你现有网段规则限制访问来源。

## 5. 后续更新

代码 push 到 Gitea 后，在服务器仓库目录执行：

```bash
git pull
./scripts/deploy-gitea.sh
```

即可更新网页。

仓库还包含 `.gitea/workflows/build.yml`。如果 Gitea Actions + act_runner 已启用，每次 push main 会自动执行 `npm ci` 和 `npm run build:gitea` 做构建检查。

> 当前 Actions 文件只做构建验证，不直接写 `/var/www/pawcream`，因为 Gitea runner 可能运行在 Docker 容器里。等确认你的 act_runner 是 Host 模式还是 Docker 模式后，再接自动发布最稳妥。

## 6. PawCream 功能变化

网页业务代码和素材没有为了 Gitea 重写。Home、Atelier、Light/LightOn、夜景磨砂、Message/Note、留言板、语言切换、电脑/手机布局和 localStorage 调试逻辑都保持现有实现。

变化只有部署层：

```text
GitHub Pages: /PawCream/
Gitea + Nginx: /
```
