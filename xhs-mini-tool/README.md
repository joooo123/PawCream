# PawCream × 小红书小工具（独立离线版本）

此目录是 PawCream 工作室的**离线小工具版本**，保留原站主要前端页面入口和装饰素材，与 PawCream 网站后端/阿里云部署相互独立。小红书容器不允许外网访问，所以云端页面为明确标注的离线 UI 预览，不会伪装成已登录或展示真实用户数据。

## 功能范围

- 选择真实 PawCream 原始透明相纸：粉白竖向、粉白横向、粉白四格。
- 点击任意相纸格，使用系统图片选择器选图或替换。
- 根据相纸透明区域自动寻找 1/4 个照片格；支持拖动和 100–220% 缩放。
- 使用 Canvas 2D 在设备端生成 PNG。
- 小红书容器支持时使用 `window.xhs.miniTool.writeTempFile`、`saveImageToPhotosAlbum` 和 `postNote`；能力缺失有提示或 PC 预览降级。
- 保留五个顶部页面入口：**制作拍立得、登录/注册、私人铁盒、留言墙、公共照片墙**。
- 登录/注册保留原站短纸/长纸打字机素材和输入框的视觉排版；表单为**不收集凭证的演示界面**。
- 私人铁盒保留原站铁盒 PNG 和姓名贴视觉；不读取账号或 OSS 中的私人照片。
- 留言墙保留原站便签卡片及「全部便签 / 我的便签 / 写一张便签」入口；示意便签全部明确标记，不冒充真实用户发言。
- 公共返图墙保留左侧大图 + 右侧磁吸相纸网格的结构和预览切换；展示空白相纸示意图，不冒充真实返图。
- 各云端入口保留醒目提示 **「更多功能见工作室网站」**，显示「更多功能见工作室网站」提示。由于项目尚未确认正式、可访问且支持云端功能的公网域名，目前不放一个可能无效的链接；后续获得正式域名后可以补充。
- 所有用户选图、合成均发生在本地；不联网、不收集密码、不上传原图。

**重要限制：** 登录、邀请码验证、私人云端同步、留言发布/点赞及公共照片墙实时数据均需要原站后端和 OSS，不能在离线小工具容器中提供。照片选取、编辑、保存和小红书官方接口发布仍可在小工具里运行，其他页面保留原站风格的离线 UI。

## 官方 Skill

目录 `../../.skill/minitool-zip-builder/` 来自官方提供的：

`https://fe-static.xhscdn.com/minitool/20260923133933/minitool-zip-builder-1.7.0.skill`

下载时 SHA-256：`8bd0f4fde976ec3e9784bebc9fd8d16270769c129b39098698fc58572716c305`。**注意：归档名为 1.7.0，但包内 SKILL.md metadata.version 为 1.6.0**，见 `../../.skill/OFFICIAL_SKILL_SOURCE.md`。

官方技能要求先访问 `https://miniapp-sandbox.xiaohongshu.com/minitool/doc`。当前自动环境不能可靠读取在线页面，因此本版 API 调用以官方归档内 `references/js-api.md` 快照为准，发布前需核对在线平台更新。

## 生成产物（Node 18+、Python 3、zip、libwebp / cwebp）

在仓库根目录运行：

```bash
node xhs-mini-tool/build.mjs
```

构建脚本从原网站 `public/assets` 中读取打字机、铁盒、姓名贴与便签 PNG，用 `cwebp` 转换为打包专用的 WebP 以控制体积；三张透明相纸使用无损 WebP 保留透明边界和颜色；不会覆盖或改变原素材。GitHub Actions 自动安装 `webp` 包。

输出：

- `xhs-mini-tool/dist/index.html`：离线包根入口
- `xhs-mini-tool/release/pawcream-xhs-mini-tool.zip`：上传小红书的 ZIP
- `xhs-mini-tool/release/validation-summary.json`：静态校验结果

GitHub Actions `XHS mini-tool official skill check` 会自动下载并解压 skill、校验 ZIP 完整性、运行构建与审计，把 ZIP 和 JSON 以名为 `pawcream-xhs-mini-tool` 的 Artifact 提供下载。

## 验证状态

自动检查范围：入口、相对资源引用、禁止内联脚本、禁止联网 API、经典 JS、ES2017 语法检查、ZIP 根目录、资源体积，以及官方 `audit_artifact.py` 的目录与 ZIP 审计。

**尚未验证：** 官方创服平台模拟器、Android 真机扫码、iOS 真机扫码，以及真实相册权限/笔记发布。不能用 PC 浏览器表现替代这些验证。必须将**同一个 ZIP**上传创服平台分别测试后才可发布。

## 不影响线上

本工具只在 `feat/xiaohongshu-mini-tool` 分支下开发；不合并、不部署到 `deploy/aliyun-oss-pawcream-studio`。
