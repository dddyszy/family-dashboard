# 飞牛 fnOS：Docker Compose 部署

适用于已安装 Docker 应用的飞牛私有云 fnOS。先用 Compose 启动看板，再按需用独立的 Nginx Proxy Manager（NPM）Compose 项目提供 HTTPS。已有可用的 HTTPS 反向代理时可复用，无需重复安装 NPM。NAS 上无需 Bun、Node.js 或项目源码。

```text
直接访问：手机 / 平板 → HTTP NAS内网IP:8686 → 看板容器
可选 HTTPS：手机 / 平板 → HTTPS 域名:443 → NPM 容器 → HTTP NAS内网IP:8686 → 看板容器
```

fnOS 各版本的界面名称可能不同，下面同时给出 Compose 文件与 SSH 命令；以项目工作目录、实际端口和命令输出为准。

## 1. 检查环境，建立项目目录

1. 在 fnOS 中建立本地存储空间，在应用中心安装、启动 Docker 应用。
2. 工作流的镜像发布目标是 `linux/amd64` 和 `linux/arm64`，不含 32 位 ARM；以实际 NAS 架构及已发布镜像为准。
3. 在文件管理中新建 `docker/family-dashboard` 和其中的 `data`。从文件属性或终端确认实际系统路径。`/vol1/1000/docker/family-dashboard` **只是示例**，存储空间编号、用户 ID 和共享目录均可能不同。

最终结构：

```text
/实际路径/docker/family-dashboard/
├── docker-compose.yml
└── data/
```

在 fnOS 设置中启用 SSH，用有管理权限的账号连接，确认 Compose 可用后进入实际目录：

```bash
sudo docker compose version
cd /vol1/1000/docker/family-dashboard
```

后面的路径都要替换为实际路径。若系统只有 `docker-compose`，先运行 `sudo docker-compose version`，再把全文命令替换成该形式；不支持本文语法时升级 Docker 应用。

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

在 Docker 应用的 Compose / 项目功能中新增项目，项目名填 `family-dashboard`，将工作目录指定到刚才的文件夹，使用其中的 `docker-compose.yml` 并启动。也可以在界面中粘贴完整 YAML，并直接填写其中的密钥和访问地址；确认保存目录与数据挂载路径正确。

同一个项目选择界面或 SSH 管理即可，不要在其他目录重复创建同名容器。SSH 创建的项目不一定自动显示为图形界面管理的项目。

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


## 5. 可选：用 Compose 配置 HTTPS

### 准备域名

选择你控制的域名，例如 `dash.example.com`，并让客户端能解析到正确地址：

- 仅在家里访问：在家庭 DNS 中将域名解析到 NAS 内网 IP。也可在公共 DNS 中填写私网 IP，但部分 DNS/路由器的重绑定保护会拦截；应仅为自己的域名配置例外，或使用家庭 DNS。
- 外网访问：公网 DNS / DDNS 指向可入站的公网地址，路由器将 TCP 443 转到 NAS 的 NPM HTTPS 端口；无可入站公网地址时可使用已有 VPN。检查 A/AAAA 记录，避免客户端优先使用了不可达的 IPv6 地址。

下面优先采用 DNS-01 申请证书，可用于纯内网服务，不要求公网能连接 NAS。DNS 服务商必须在 NPM 当前版本中受支持，且你能管理该域名的验证记录。普通 HTTP-01 方式则要求公网 TCP 80 可达，不能用局域网访问成功来替代这一条件。

### 新建 NPM 项目

在另一个目录（例如 `/vol1/1000/docker/npm`）创建 `data`、`letsencrypt` 和以下 `docker-compose.yml`。示例使用 NPM 官方安装文档列出的 `2.16.0` 标签；以后升级请先阅读它的发布说明。

```yaml
services:
  npm:
    image: jc21/nginx-proxy-manager:2.16.0
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
      - "81:81"
    environment:
      TZ: Asia/Shanghai
    volumes:
      - ./data:/data
      - ./letsencrypt:/etc/letsencrypt
```

这是独立的 Compose 项目，默认使用 NPM 自己的 SQLite，不需要额外 MariaDB。按前面的图形界面方法启动，或在 **NPM 目录**执行：

```bash
sudo docker compose config --quiet
sudo docker compose pull
sudo docker compose up -d
sudo docker compose logs --tail=100 npm
```

NPM 首次初始化可能需要几分钟。打开 `http://NAS内网IP:81`，按首次设置页面创建管理员。NPM 的 `81` 是管理端口，仅允许可信内网访问，不要在路由器上转发到公网；看板的 `8686` 也只需供内网/代理访问。

先确认 80、443、81 未被 NAS 的现有服务占用。冲突时可改左边端口，例如 `8080:80`、`8443:443`、`8181:81`；浏览器访问地址随之变为 `http://NAS内网IP:8181` 和 `https://dash.example.com:8443`。不需要 HTTP 入口且使用 DNS-01 时，也可以去掉 `80:80`，但要直接使用 HTTPS。HTTP-01 仍要求公网 80 最终转发到 NPM 的容器 80。

### 签发证书

在 NPM 中进入「SSL Certificates → Add SSL Certificate → Let's Encrypt」：

1. Domain Names 填实际域名 `dash.example.com`。
2. 启用「Use a DNS Challenge」，选择当前版本支持的 DNS 服务商，按界面模板填写有权限修改验证记录的 API 凭据。
3. 同意条款并保存，等待签发成功。NAS 需要正常的出站 DNS/HTTPS 连接，验证记录传播也需要时间。

DNS-01 可以在不开放任何公网入站端口时申请、续期证书。若服务商未出现在列表中，不要随便选择其他服务商；可用兼容的 ACME 客户端签发后导入，并自行安排续期更新。保护好 `npm/data` 和 `npm/letsencrypt`，其中包含管理配置、证书私钥等数据。

### 添加代理规则

「Hosts → Proxy Hosts → Add Proxy Host」：

| 字段 | 值 |
| --- | --- |
| Domain Names | `dash.example.com` |
| Scheme | `http` |
| Forward Hostname / IP | NAS 的固定内网 IP，例如 `192.168.1.10` |
| Forward Port | `8686`，或看板映射左边的 NAS 端口 |
| Cache Assets | 关闭，避免缓存 API 和实时连接 |
| Websockets Support | 不需要；看板实时同步使用 SSE |

**不要填写 `127.0.0.1` / `localhost`**，它们在 NPM 容器中指向 NPM 自己。两个独立 Compose 项目默认不共用网络，也不能直接填写另一个项目的服务名 `app`。本方案通过 NAS 内网地址和已发布端口连接，因此看板应保留 `"8686:8686"`，不能改成只绑定 `127.0.0.1`。NAS 防火墙需允许 NPM 容器网络访问这个端口。

在 SSL 页选择刚申请的证书，启用 Force SSL，可启用 HTTP/2。在 Advanced 页添加：

```nginx
proxy_read_timeout 300s;
proxy_buffering off;
```

保留 NPM 正常的 Host / 转发协议处理。服务端同时提供 `X-Accel-Buffering: no` 和每 20 秒一次的 SSE 心跳；不要在其他代理或 CDN 层缓存、缓冲 `/api/stream`。不要给应用加 `/family-dashboard/` 子路径，使用专属域名根路径。

已有共享 Docker 网络的用户也可以按 [NPM 官方网络方案](https://nginxproxymanager.com/advanced-config/#best-practice-use-a-docker-network)连接容器，并取消看板的宿主机端口发布；这是另一种网络方案，需要同时调整两个项目，不能只把这里的 NAS IP 改为服务名。

### 设置看板 HTTPS 地址

编辑**看板目录**的 `docker-compose.yml`，修改 `services.app.environment.PUBLIC_URL`（保留其他字段）：

```yaml
      PUBLIC_URL: "https://dash.example.com"
```

若实际访问 `https://dash.example.com:8443`，这里也要包含 `:8443`。地址以浏览器最终使用的地址为准，不是容器内部端口。切回看板目录重建：

```bash
cd /vol1/1000/docker/family-dashboard
sudo docker compose -f docker-compose.yml up -d app
```

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

NPM 是单独的项目，也要备份它的 Compose 文件、`data/`、`letsencrypt/`。需要一致的完整备份时，在 NPM 项目目录停机打包；更新看板的命令不会更新或备份 NPM。

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

**NPM 返回 502**：先检查 `http://NAS内网IP:8686/api/health`，确认目标协议是 HTTP，端口是看板在宿主机发布的端口。再检查 NPM 日志、NAS 防火墙和容器到 NAS 内网 IP 的连通性。NAS 自己访问成功，不代表 NPM 容器一定能访问。

**证书申请或续期失败**：检查 NPM 日志、域名与 DNS 服务商、API 凭据权限、验证记录传播和 NAS 出站网络。DNS-01 不依赖路由器开放 80；HTTP-01 则必须从公网验证 80 的可达性。

参考：[NPM 官方安装文档](https://nginxproxymanager.com/setup/)、[NPM 高级配置](https://nginxproxymanager.com/advanced-config/)、[Docker Compose environment 配置](https://docs.docker.com/reference/compose-file/services/#environment)。应用行为以仓库 [Dockerfile](../docker/Dockerfile)、[环境配置](../apps/server/src/env.ts)、[认证处理](../apps/server/src/lib/auth.ts) 和 [备份实现](../apps/server/src/services/backup.ts) 为依据。
