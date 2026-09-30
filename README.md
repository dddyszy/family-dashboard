# 家庭看板 Family Dashboard

当前版本：**v0.2.0**。功能变更和升级说明见 [更新日志](CHANGELOG.md)。

部署在家用 NAS 或小服务器上、全家共用的信息大屏：可拖拽的小卡片首页、家庭日程与提醒、实时同步的购物清单，液态玻璃（Liquid Glass）风格，手机、平板、电脑和挂墙大屏共用一套页面。

![首页](docs/images/home-light.jpg)

| 深色主题 | 挂墙大屏 |
| --- | --- |
| ![深色主题](docs/images/home-dark.jpg) | ![挂墙大屏](docs/images/kiosk.jpg) |

| 日程 | 手机首页 | 手机购物清单 |
| --- | --- | --- |
| ![日程](docs/images/calendar.jpg) | ![手机首页](docs/images/mobile-home.jpg) | ![手机购物清单](docs/images/mobile-shopping.jpg) |

## 功能

- **卡片首页**：iOS 风格的小卡片，可拖拽排序、切换 S / M / L / XL 尺寸、从卡片库添加；全家共用一个布局，挂墙平板显示的也是它。点击卡片从右侧抽屉快速操作
- **日程与待办**：月 / 周 / 日 / 列表四种视图，重复日程支持「仅此一次 / 此次及以后 / 全部」三种修改范围；按成员着色和筛选；待办可指派、可重复
- **一句话添加**：输入「明天下午3点 家长会 提前1小时 @妈妈」自动识别时间、提醒和参与人，本地规则解析，不依赖大模型
- **提醒**：到点后在打开的页面和挂墙大屏上弹窗并响铃，支持「稍后 10 分钟」；离线期间错过的提醒重新打开后补齐
- **购物清单**：多个清单、自动归类、常买联想、批量粘贴、左滑删除；多台设备实时同步；超市模式大字号，浏览器支持时保持屏幕常亮
- **多用户**：首次创建管理员，由管理员添加家人账号；也可以临时打开「允许自助注册」，让家人在登录页自行注册为普通成员（默认关闭）。日程、待办、清单都可设为「全家共享」或「私有」
- **挂墙大屏模式**：配对码登录的只读设备，浏览器支持时保持屏幕常亮、夜间调暗或只显示大时钟、每晚自动刷新
- **主题**：液态玻璃浅色 / 深色、经典、极简、大屏高对比五套主题，可换壁纸，夜间自动切深色，低端平板可开性能模式
- **PWA**：在浏览器及访问环境支持时，可安装到桌面并离线查看缓存数据；IP 直连的功能边界见部署指南
- **天气卡片**：Open-Meteo 免费数据，无需申请密钥

## 技术栈

- 后端：[Bun](https://bun.sh) + [Hono](https://hono.dev) + SQLite（[Drizzle ORM](https://orm.drizzle.team)），单进程、单数据库文件，不依赖 Redis 等外部服务
- 前端：React 19 + Vite + Tailwind CSS v4 + TanStack Query + wouter，首屏 JS 约 138KB（gzip）
- 实时：SSE（Server-Sent Events）
- 部署：单个 Docker 容器，GitHub Actions 自动构建多架构镜像（GHCR / 阿里云），通过内网 IP + 端口访问

详细设计见 [技术设计文档](docs/TECH_DESIGN.md)。

## 部署

完整步骤统一见 [Docker Compose 部署指南](docs/DEPLOY_DOCKER_COMPOSE.md)，包含环境准备、完整配置、账号与大屏初始化、升级、备份恢复及故障排查。

需要配置 HTTPS 时，另见 [HTTPS 配置指南](docs/DEPLOY_HTTPS.md)，包含独立代理 Compose、证书、双协议访问及功能验收。

需要一台能运行 Docker 的 NAS 或 Linux 主机。镜像发布目标为 amd64 和 arm64，服务器上只需要一个 `docker-compose.yml`，不需要 `.env` 文件：

```bash
mkdir family-dashboard && cd family-dashboard
mkdir data
curl -fsSLO https://raw.githubusercontent.com/dddyszy/family-dashboard/v0.2.0/docker-compose.yml
# 编辑 docker-compose.yml，在 environment 中填写 APP_SECRET（openssl rand -hex 32 生成）
# PUBLIC_URL 保持为空
docker compose config --quiet
docker compose pull app
docker compose up -d
```

启动后访问 `http://服务器内网IP:8686`。升级前先按部署指南备份，再拉取镜像并重建容器。默认固定到 `ghcr.io/dddyszy/family-dashboard:v0.2.0`，升级版本或切换镜像源时直接修改 Compose 的 `image`；镜像需已实际发布，见 [镜像自动构建](docs/CI_IMAGE.md)。只有推送 `v*` 标签才会构建镜像；推送 `master` 或 `dev` 都不会构建。

IP 直连支持登录、日程、购物、卡片编辑和实时同步。自动常亮及离线重新打开受访问环境限制，具体表现和系统设置建议见统一部署指南。

数据保存在 `data/` 目录中。程序运行时每天凌晨 2 点自动生成数据库快照，保留最近 7 份；完整备份还需保存上传文件和 Compose 配置。管理员可以在「设置 → 数据」中手动备份、导出 JSON，或重置数据（执行前自动备份）。

## 本地开发

先安装 [Bun](https://bun.sh)（1.4 以上）。

```bash
bun install
bun dev          # 前端 http://localhost:5288 ，后端 http://localhost:8686
bun run check    # 格式检查 + 类型检查 + 单元测试，提交前必须通过
```

第一次打开会引导创建管理员账号。开发模式下 Service Worker 默认关闭，需要调试 PWA 时使用 `bun run preview`（http://localhost:8686）。

更多命令和代码规范见 [AGENTS.md](AGENTS.md)。

## 目录结构

```
apps/
  server/     Hono 服务：路由、业务逻辑、数据库、定时任务、SSE
  web/        React 单页应用：首页卡片、日程、购物清单、设置、大屏模式
packages/
  shared/     前后端共用的 zod schema、类型、时区与重复规则工具
docker/       Dockerfile
.github/      镜像自动构建工作流
docs/         技术设计、部署指南、截图
```

## 路线图

第一期（v0.2.0）已完成上面列出的功能。第二期计划：

- 手机推送（ntfy / Web Push）、每日日程摘要、免打扰时段
- 会员订阅：各网站和 App 的会员有效期、到期提醒、花销统计
- 大模型 Token 用量：OpenAI、Anthropic、DeepSeek 等的用量与余额
- 跨模块汇总卡片：会员总花销、Token 总用量
- 周视图和日视图中拖拽调整日程时间

## 分支

- `master`：稳定版本
- `dev`：日常开发，功能完成并验证后合并到 `master`
- `v*` 标签：从稳定提交发布镜像；当前版本为 `v0.2.0`。合并或推送分支本身不会构建镜像
