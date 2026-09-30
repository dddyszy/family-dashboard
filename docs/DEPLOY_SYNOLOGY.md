# 群晖 Synology：Docker Compose 部署

适用于能安装 **Container Manager** 的群晖 NAS，图形界面以 DSM 7.2 及以上为参考。看板通过 Compose 部署单个容器，可通过内网 IP + 端口直接访问；需要 HTTPS 时再使用 DSM 反向代理。NAS 上无需安装 Bun、Node.js 或下载项目源码。

```text
直接访问：手机 / 平板 → HTTP NAS内网IP:8686 → 看板容器
可选 HTTPS：手机 / 平板 → HTTPS 域名:443 → DSM 反向代理 → HTTP 127.0.0.1:8686 → 看板容器
```

## 1. 检查环境，建立项目目录

1. 在套件中心安装、启动 Container Manager。不是所有群晖机型都支持该套件；只有旧版 Docker 套件时，本文的「项目」界面不适用，需自行确认是否有兼容的 Compose 命令。
2. 本项目镜像工作流发布 `linux/amd64` 和 `linux/arm64`，不支持 32 位 ARM。以 NAS 实际架构和镜像已发布的平台为准，不要强行指定其他 `platform`。
3. 在 File Station 的 `docker` 共享文件夹下建立 `family-dashboard`，再在里面建立 `data`。没有 `docker` 共享文件夹时先创建，也可以使用其他本地共享文件夹。
4. 在文件夹属性中确认完整系统路径。例如 File Station 中的 `docker/family-dashboard`，在 SSH 中通常是 `/volume1/docker/family-dashboard`；存储卷可能是 `volume2`，不能直接把显示路径 `/docker/...` 当成系统路径。

最终结构：

```text
/volume1/docker/family-dashboard/
├── docker-compose.yml
└── data/
```

需要命令行时，在「控制面板 → 终端机和 SNMP」启用 SSH，使用管理员账号连接，并执行：

```bash
sudo docker compose version
cd /volume1/docker/family-dashboard
```

本文使用 `docker compose`。若系统只提供 `docker-compose`，先用 `sudo docker-compose version` 确认，再将全文命令替换为该形式；不支持本文语法时应升级套件。路径必须替换成你的实际路径。

## 2. 保存并填写 Compose 文件

### 编写 `docker-compose.yml`

在项目目录保存以下内容，与仓库根目录的 [docker-compose.yml](../docker-compose.yml) 配置一致：

```yaml
# 使用 GitHub Actions 预先构建好的镜像，NAS 上无需源码和构建环境。
services:
  app:
    # 切换镜像源或固定版本时，直接修改此地址；镜像需已实际发布。
    image: ghcr.io/dddyszy/family-dashboard:latest
    container_name: family-dashboard
    restart: unless-stopped
    ports:
      - "8686:8686"
    volumes:
      - ./data:/app/data
    environment:
      # 必填：执行 openssl rand -hex 32，将输出粘贴到引号内；空值无法启动。
      APP_SECRET: ""
      # HTTPS 配置完成后填写，例如 "https://dash.example.com"。
      PUBLIC_URL: ""
      TZ: Asia/Shanghai
```

- `8686:8686` 左边是 NAS 端口，右边是容器端口。端口被占用时只改左边，例如 `8690:8686`，并同步修改后续访问和反向代理的目标端口。
- `./data` 相对于 Compose 文件所在目录解析。项目目录选错，会读到另一份空数据库，表现为重新要求初始化。
- 保持 `/app/data` 可写，并放在 NAS 本地存储空间，不要放在 SMB/NFS 远程挂载中；SQLite WAL 需要可靠的本地文件锁。
- 镜像已内置生产模式、8686 监听端口和健康检查，不需要额外数据库、`privileged`、host 网络或 Docker Socket 挂载。
- 当前看板镜像以 root 运行；不要照搬其他镜像的 `user: 1000:1000`、`PUID`、`PGID` 配置。后两者不是本项目支持的环境变量。

### 直接填写 Compose 配置

部署只需要 `docker-compose.yml`，不需要额外的环境变量文件。在 NAS 的 SSH 终端或自己的电脑执行：

```bash
openssl rand -hex 32
```

把输出的 **64 位十六进制字符串**粘贴到 `environment` 下 `APP_SECRET` 的双引号内。该字段不能留空，程序要求至少 32 个字符；升级时保留原值，不要使用公开示例作为密钥。

`PUBLIC_URL` 使用内网 IP + HTTP 访问时保持 `""`，配置 HTTPS 后填写最终访问地址，例如 `"https://dash.example.com"`；使用非标准端口时包含端口，不添加 `/kiosk` 等路径。保持 YAML 缩进，字符串放在引号内。

切换镜像源或固定版本，直接修改 `services.app.image`。阿里云地址只有仓库维护者实际发布后才可用，[镜像构建文档](CI_IMAGE.md) 中的地址是配置示例，不能据此认定已有公共镜像。固定版本时也必须选择实际已发布的标签或镜像摘要。

如果此前已按旧文档部署，把原配置中的 `APP_SECRET`、`PUBLIC_URL` 原值迁入 `environment`，使用过自定义镜像的也迁入 `image`，并保留原来的数据挂载路径。填好密钥后的 Compose 文件含敏感信息，不要公开它或完整的 `docker compose config` 输出。

## 3. 创建项目并检查启动

### Container Manager 界面

1. 打开「项目 → 新增」，项目名填 `family-dashboard`。
2. 路径选择刚才的项目文件夹，选择使用已有 `docker-compose.yml` 的来源方式；确认实际使用的是该目录中的文件。
3. 若向导询问 Web Station / Web Portal 设置，不必为本应用启用；可以直接访问看板端口，或按第 5 节配置 DSM 反向代理。
4. 创建并启动项目，在项目日志中检查镜像下载和启动情况。如果提示密钥未设置，检查项目实际使用的 YAML 中是否已经填写 `APP_SECRET`。

同一个项目选择界面或 SSH 管理即可，不要在另一个目录再部署一份同名容器。使用 SSH 新建的项目不一定被套件界面自动接管。

### 启动与检查

以下命令都在含有 `docker-compose.yml` 的项目目录执行：

```bash
sudo docker compose -f docker-compose.yml config --quiet
sudo docker compose -f docker-compose.yml pull
sudo docker compose -f docker-compose.yml up -d
sudo docker compose -f docker-compose.yml ps
sudo docker compose -f docker-compose.yml logs --tail=100 app
curl -fsS http://127.0.0.1:8686/api/health
```

按顺序执行，某一步失败时先排错，不要继续。`config --quiet` 只校验 Compose 配置，不会检查密钥是否已填写或足够长；空密钥或少于 32 个字符会被应用在启动时拒绝。健康接口应返回类似 `{"ok":true,"time":...}`，容器通常需要几十秒才变为 `healthy`。

再用浏览器打开 `http://NAS内网IP:8686`，检查初始化页是否出现。仅在可信家庭局域网使用时，可以按下一节直接创建管理员并使用；需要 HTTPS 的功能时，再完成第 5 节的可选配置。不要让尚未初始化的服务暴露在公网。

## 4. 直接通过 IP + 端口访问

无需域名、证书或反向代理，使用第 2 节的完整 Compose 配置即可：保留 `"8686:8686"` 端口映射、已填写的随机 `APP_SECRET`，将 `services.app.environment.PUBLIC_URL` 保持为空字符串：

```yaml
      PUBLIC_URL: ""
```

如果之前填过 HTTPS 地址，清空后在看板项目目录执行以下命令，让容器重新加载配置；只点「重启」不会加载修改：

```bash
sudo docker compose -f docker-compose.yml up -d app
```

手机、平板或电脑连接同一局域网，打开 `http://NAS内网IP:8686`，例如 `http://192.168.1.10:8686`，即可创建管理员、登录和使用。大屏地址是 `http://NAS内网IP:8686/kiosk`。如果映射改为 `"8690:8686"`，访问端口也改为 `8690`。

确保 NAS 防火墙允许家庭网络访问该端口，且没有只将端口绑定到 `127.0.0.1`。建议给 NAS 设置固定内网 IP 或 DHCP 地址保留。容器 8686 提供的是 HTTP，不能直接改用 `https://NAS内网IP:8686`。

| 功能 | 内网 IP + HTTP |
| --- | --- |
| 管理员初始化、登录、日程、待办、购物清单 | 可用 |
| 多设备 SSE 实时同步 | 可用，不需要 WebSocket 或 HTTPS |
| 已有卡片展示、大屏查看、页面内提醒 | 可用；声音仍需用户交互授权，页面需保持运行 |
| 新增首页卡片 | 当前实现依赖仅在安全上下文可用的 `crypto.randomUUID()`，普通 HTTP 内网 IP 下不可用；需通过 HTTPS 操作 |
| Service Worker、离线缓存 | 不可用 |
| 浏览器自动保持屏幕常亮（Wake Lock） | 不可用；可以在平板系统中设置不自动锁屏 |
| PWA 安装 | 受浏览器限制；部分浏览器仍可创建桌面快捷方式，但不因此获得离线和常亮能力 |

这里的限制针对普通 NAS 内网 IP 的 HTTP 地址；开发时的 `localhost` 属于浏览器特殊信任的地址，不能据此判断 NAS 的 HTTP 功能是否完整。HTTP 不加密登录凭据和数据，本方案用于可信家庭局域网，不应直接把 8686 转发到公网。

选择直接访问时，可跳过下面的 HTTPS 配置，继续阅读「初始化与验收」。以后切换到 HTTPS 不需要重建账号或数据，但浏览器可能需要重新登录，大屏可能需要重新配对。


## 5. 可选：配置域名、证书与 DSM 反向代理

### 域名和证书

使用一个专属域名，例如 `dash.example.com`。没有自己的域名时，可以在「控制面板 → 外部访问 → DDNS」申请 Synology 域名，例如 `dash-zhang.synology.me`。证书必须覆盖实际访问的完整域名；不要把 `dash-zhang.synology.me` 和 `dash.zhang.synology.me` 混用。

- **仅局域网使用**：让家庭 DNS 将该域名解析到 NAS 内网 IP，不需要为应用设置路由器端口转发。所有访问设备都应使用能解析这条记录的 DNS。
- **需要外网访问**：配置公网 DNS / DDNS 和路由器转发，将公网 TCP 443 转到 NAS 的反向代理端口。没有可入站的公网地址时，单靠 DDNS 不能打通访问，可使用已有 VPN。不要把 8686 或 DSM 管理端口作为看板公网入口。

在「控制面板 → 安全性 → 证书」管理证书。Synology DDNS 的证书申请可按 DSM 自带向导操作；自己的域名若使用普通 HTTP 验证，验证机构必须能从公网 TCP 80 访问验证服务。无公网或不开放 80 时，使用支持该 DNS 服务商的 ACME 客户端进行 DNS-01 验证，再导入 DSM，并配置续期后的自动部署。**仅把域名解析到内网 IP 不会自动解决证书签发问题。**

也可以导入已有证书。自签名证书只有被每台客户端系统/浏览器正确信任后，才能作为可靠的 HTTPS 使用；不要把「忽略证书错误」当成完成配置。

### 创建反向代理

「控制面板 → 登录门户 → 高级 → 反向代理」（名称随 DSM 版本略有差异）新增规则：

| 字段 | 来源 | 目的地 |
| --- | --- | --- |
| 协议 | HTTPS | HTTP |
| 主机名 | 实际域名，例如 `dash.example.com` | `127.0.0.1` |
| 端口 | `443` | `8686`（或你修改后的 NAS 端口） |

可启用 HTTP/2；在可用的高级设置中将代理读取超时设为 `300` 秒。无需添加 WebSocket 的 `Upgrade` / `Connection` 标头。服务端的 SSE 响应已带 `X-Accel-Buffering: no`，每 20 秒发送心跳。

在「安全性 → 证书 → 设置」中，为这条规则分配对应域名证书。允许家庭网络访问 HTTPS 端口；域名根路径 `/` 应完整转发给看板，不要部署成 `/family-dashboard/` 子路径。

### 设置 HTTPS 地址并重建

在 `docker-compose.yml` 的 `services.app.environment` 中，将 `PUBLIC_URL` 改成实际 HTTPS 地址（保留其他字段）：

```yaml
      PUBLIC_URL: "https://dash.example.com"
```

在看板项目目录执行：

```bash
sudo docker compose -f docker-compose.yml up -d app
```

然后只使用这个 HTTPS 地址初始化和登录。若来源改用 `8443`，则浏览器地址与 `PUBLIC_URL` 都应为 `https://dash.example.com:8443`。同一 NAS 的 DSM 代理可以通过 `127.0.0.1` 访问宿主机端口；这与飞牛文档中代理运行在容器里的情况不同。

HTTPS 验收后，如不需要其他设备直接访问 HTTP，可将看板端口映射改为 `"127.0.0.1:8686:8686"` 并重建。此时 NAS 自己的健康检查与 DSM 代理仍可访问，其他设备应统一走 HTTPS。

## 初始化与验收

1. 从选定的访问地址进入：直接访问用 `http://NAS内网IP:8686`，已配置代理则用 HTTPS 域名。首次使用创建管理员，已有账号直接登录，刷新页面确认仍保持登录。
2. 在「设置」中添加家庭成员、设置家庭时区和天气城市。容器的 `TZ` 不会覆盖应用中的家庭时区；修改家庭时区后重启 `app`，使定时任务重新加载时区。
3. 在「设置」的「大屏设备」区域添加设备，平板在同一访问地址后加上 `/kiosk`，输入配对码。
4. 按浏览器支持情况添加到主屏幕或创建快捷方式。大屏按页面提示启用提醒声音。HTTP 下通过平板系统设置不自动锁屏；HTTPS 下的 Wake Lock 仍受浏览器版本、页面前台状态和系统省电影响。

验收时检查：

- 在实际访问地址后加 `/api/health`，应返回 `ok: true`；使用 HTTPS 时浏览器应无证书警告。
- 创建一条日程或购物条目后刷新仍存在；另一台登录设备能及时同步。
- 浏览器开发者工具中 `/api/stream` 返回 `200`、类型为 `text/event-stream`，连接持续打开并收到心跳。未登录时返回 `401` 是正常行为。
- 使用 HTTPS 且浏览器支持时，验证 PWA 安装和 Service Worker 激活；HTTP 访问不要求这两项。
- 保持大屏在前台，验证提醒声音；按访问方式检查系统不锁屏设置或 Wake Lock。容器重建后原账号和数据仍在。

## 升级、备份与恢复

以下命令在看板项目目录执行；采用了非默认 Compose 文件名时，继续显式传入 `-f`。

### 先备份，再升级

应用会按**进程启动时读取的家庭时区**在每天 02:00 备份数据库，文件位于 `data/backups/app-YYYYMMDD-HHMMSS.db`，保留最近 7 份。手动备份和迁移前备份也计入这 7 份，不是保证保留 7 天。停机期间不会执行定时备份。

「设置 → 备份与导出 → 立即备份」生成的是一致性数据库快照，**不包含头像、壁纸和 Compose 配置**；导出 JSON 也不是可直接恢复的完整备份。重要升级前建议停机备份整个目录：

```bash
# 记录当前镜像标识，方便之后选择对应的旧版本
sudo docker inspect family-dashboard --format '{{.Config.Image}} {{.Image}}'
# 从上一步输出取得镜像 ID 后，可查询仓库摘要（本地构建的镜像可能没有摘要）
# sudo docker image inspect <镜像ID> --format '{{json .RepoDigests}}'

sudo docker compose stop app
sudo tar -czpf "../family-dashboard-backup-$(date +%Y%m%d-%H%M%S).tar.gz" docker-compose.yml data
sudo docker compose start app
```

确认打包成功，再把备份复制到另一块盘或其他设备，并保存对应的镜像版本/摘要。备份中有账号数据和密钥，应限制读取权限。不要在应用运行时只复制 `data/app.db`：SQLite WAL 模式下，最新数据可能仍在 `app.db-wal`。群晖 Hyper Backup 或 fnOS 的备份工具可以保存停机快照；在线备份至少使用应用生成的数据库快照，并单独保存上传文件和配置。

随后升级：

```bash
sudo docker compose pull app
sudo docker compose up -d app
sudo docker compose ps
sudo docker compose logs --tail=100 app
```

`pull` 成功后再执行 `up -d`，Compose 才会使用新镜像重建容器。`restart` 或图形界面的普通「重启」不会切换镜像，也不会加载修改后的环境变量。修改 `docker-compose.yml` 后同样执行 `up -d app`；图形界面操作应选择会重新读取配置、重建容器的功能，名称不确定时使用上述命令。

启动时会自动执行数据库迁移；已有数据库且存在待执行迁移时，会先尝试自动备份。该备份仍在同一数据盘，不能代替外部完整备份。升级后重新检查登录、数据与同步；前端提示有新版本时刷新页面。

### 恢复与回退

1. 执行 `sudo docker compose stop app`，确认看板停止，避免同时写入数据库。
2. 把完整备份解压到一个新的临时目录，检查 `docker-compose.yml`、`data/` 是否齐全。将当前项目的 `data/` 改名保留，再把备份中的整个 `data/` 放回项目目录，同时恢复配套配置。不要把旧库覆盖到仍含新 `app.db-wal`、`app.db-shm` 的目录中。
3. 回退升级时，将 `docker-compose.yml` 的 `services.app.image` 设为备份对应的已发布旧版本或 `镜像地址@sha256:摘要`。备份中的 `latest` 字样不代表旧镜像；不要直接用旧程序打开已经迁移过的新库。
4. 执行 `sudo docker compose pull app` 和 `sudo docker compose up -d app`，检查日志、健康状态、账号与数据。

如果只有应用生成的 `.db` 快照：停止容器后，将当前整个 `data/` 移到别处保留，创建新的 `data/`，把快照复制为 `data/app.db`，再从单独的备份恢复 `uploads/`。使用配套 Compose 配置和兼容的镜像启动。此方式无法找回未单独备份的头像、壁纸。

不要同时启动多个看板容器读写同一份 `data/`。卸载项目前确认数据目录和配置已另行备份。

## 常见问题

| 现象 | 检查方法 |
| --- | --- |
| `APP_SECRET` 未设置或不足 32 位 | 检查实际使用的 Compose 中 `environment.APP_SECRET` 是否填写至少 32 个字符的随机值，修改后用 `up -d app` 重建 |
| `permission denied`、`readonly database`、无法创建目录 | 检查看板项目的本地路径、共享文件夹 ACL、磁盘空间与只读状态，移除照搬的 `user:`；不要用 `chmod -R 777` 代替定位权限问题 |
| 镜像拉取超时 | 检查 NAS 的 DNS、出站网络以及 Docker 守护进程的代理配置；浏览器能访问 GitHub 不代表 Docker 能访问 GHCR |
| `denied` / `unauthorized` / `manifest unknown` | 分别检查镜像是否公开、是否需要登录、标签是否真实存在；只有维护者能修改包可见性，参见 [CI_IMAGE.md](CI_IMAGE.md) |
| `no matching manifest` / `exec format error` | 核实 NAS 架构与镜像平台是否匹配；本项目发布目标是 `linux/amd64` 和 `linux/arm64`，不含 32 位 ARM |
| `port is already allocated` | 修改 Compose 端口映射左边的宿主机端口，重建后同步调整代理目标和检查命令 |
| 登录后刷新又回到登录页 | HTTP 直连时将 `PUBLIC_URL` 清空并用 `up -d app` 重建，再登录；填写 HTTPS 地址时必须从该 HTTPS 地址登录，HTTP 下不会发送 Secure Cookie。仍失败时检查 Cookie 和代理配置 |
| 写入提示「请求来源不被允许」 | 检查 `PUBLIC_URL` 是否为最终访问地址，代理是否正确传递原始 Host（或 `X-Forwarded-Host`） |
| HTTP 下点击添加卡片无反应，控制台提示 `crypto.randomUUID is not a function` | 当前新增卡片依赖安全上下文，请使用 HTTPS 添加；已有卡片展示不依赖此操作 |
| 数据突然为空、出现初始化页 | 检查 Compose 项目目录和实际挂载源路径；先找回原来的 `data/`，不要继续初始化覆盖排查线索 |
| 天气获取失败 | 检查容器到 `api.open-meteo.com` 的 DNS/HTTPS 出站连接以及家庭天气位置设置 |

排查实时同步时，应检查 `/api/stream` 的登录状态、响应类型、代理缓冲和读取超时。该接口使用 **SSE，不是 WebSocket**；打开 WebSocket 支持不能修复 SSE 缓冲问题。

**DSM 代理返回 502**：先在 NAS 上请求 `http://127.0.0.1:8686/api/health`。检查容器是否健康、映射端口是否正确，目的地协议必须是 HTTP。若打开的是 DSM 页面，检查域名解析、规则主机名和来源端口是否匹配。

参考：[Synology Container Manager 项目帮助](https://kb.synology.com/zh-cn/DSM/help/ContainerManager/docker_project?version=7)、[Docker Compose environment 配置](https://docs.docker.com/reference/compose-file/services/#environment)。本文的应用行为以仓库 [Dockerfile](../docker/Dockerfile)、[环境配置](../apps/server/src/env.ts)、[认证处理](../apps/server/src/lib/auth.ts) 和 [备份实现](../apps/server/src/services/backup.ts) 为依据。
