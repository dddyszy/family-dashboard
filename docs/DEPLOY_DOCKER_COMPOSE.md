# Docker Compose 部署指南

本文适用于支持 Docker 的 NAS、Linux 服务器和小主机。使用已发布镜像运行一个看板容器，通过 `http://服务器内网IP:8686` 访问。服务器上不需要安装 Bun、Node.js、外部数据库或下载项目源码。

所有配置都写在 **`docker-compose.yml`** 中，**不需要 `.env` 文件**。数据库、上传文件和应用备份保存在宿主机的 `data/` 目录，重建容器不会删除这些数据。

本文介绍 HTTP 内网直连。需要增加 HTTPS 入口时，请在完成基础部署后阅读独立的 [HTTPS 配置指南](DEPLOY_HTTPS.md)。

## 目录

1. [检查运行环境](#1-检查运行环境)
2. [准备持久化目录](#2-准备持久化目录)
3. [填写完整 Compose 配置](#3-填写完整-compose-配置)
4. [启动与健康检查](#4-启动与健康检查)
5. [首次使用与验收](#5-首次使用与验收)
6. [IP 直连的功能边界](#6-ip-直连的功能边界)
7. [日常管理与配置修改](#7-日常管理与配置修改)
8. [镜像版本与升级](#8-镜像版本与升级)
9. [备份](#9-备份)
10. [恢复与迁移](#10-恢复与迁移)
11. [常见问题](#11-常见问题)
12. [停止或移除项目](#12-停止或移除项目)

## 1. 检查运行环境

### Docker 与 Compose

先通过设备的软件管理界面或 [Docker 官方安装文档](https://docs.docker.com/engine/install/)安装 Docker Engine 和 Compose 插件，并启动 Docker 服务。NAS 应先确认机型及操作系统支持 Docker。

在服务器终端执行：

```bash
sudo docker version
sudo docker compose version
sudo docker info --format '{{.OSType}}/{{.Architecture}}'
```

- `docker version` 应能显示客户端和服务端信息。只有客户端信息或提示无法连接 daemon，说明 Docker 服务尚未就绪或当前用户没有访问权限。
- 本文使用 `docker compose` 命令。若设备只提供旧版 `docker-compose`，先运行 `sudo docker-compose version` 确认可用，再替换文中的命令；配置不兼容时应升级 Compose。
- 示例命令使用 `sudo`。以 root 登录或已具备 Docker 操作权限时，可以省略；不支持 `sudo` 的系统请使用设备提供的管理员终端。

### 系统与架构

镜像工作流的发布目标为：

| Docker 主机架构 | 对应镜像平台 |
| --- | --- |
| Intel / AMD 64 位，通常显示 `x86_64` 或 `amd64` | `linux/amd64` |
| ARM 64 位，通常显示 `aarch64` 或 `arm64` | `linux/arm64` |

不支持 32 位 ARM。Docker 会自动选择匹配的平台，不要为了绕过报错强行指定其他架构。实际可用平台以所选镜像标签已发布的内容为准。

### 网络与存储

- 服务器需要能拉取 `ghcr.io` 的镜像；天气功能还需要能访问 `api.open-meteo.com`。
- 客户端需要能访问服务器的内网 IP 和所映射的端口。
- 为项目选择稳定、可写的本地存储目录，预留镜像、数据库、上传文件及备份所需空间。
- 本文面向可信家庭局域网。HTTP 不加密登录凭据和数据，不要直接把看板端口转发到公网；首次初始化也应在可信网络中完成。

## 2. 准备持久化目录

在设备的本地数据卷上建立项目目录和 `data` 子目录。例如，Linux 主机可以使用 `/opt/family-dashboard`：

```bash
sudo mkdir -p /opt/family-dashboard/data
cd /opt/family-dashboard
```

**后续命令默认都在这个项目目录执行。** NAS 用户应把示例路径换成实际存储卷上的完整系统路径，不要把文件管理器中的显示名称当成系统路径，也不要选临时目录或易被系统更新清理的位置。

目录结构：

```text
family-dashboard/
├── docker-compose.yml
└── data/
    ├── app.db          # 首次启动时自动创建
    ├── app.db-wal      # SQLite 运行时可能存在
    ├── app.db-shm      # SQLite 运行时可能存在
    ├── uploads/        # 上传的图片等文件
    └── backups/        # 应用生成的数据库快照
```

注意事项：

- `data/` 使用本地磁盘或本地存储池，不要放在 SMB、NFS 等远程共享中。SQLite WAL 依赖可靠的本地文件锁。
- 当前镜像以 root 运行，以适配 NAS 上的目录权限。不要照搬其他项目的 `user: 1000:1000`、`PUID` 或 `PGID`；后两者不是本项目支持的配置项。
- NAS 的共享文件夹 ACL、只读挂载和存储空间仍会影响容器写入，root 并不能解决所有存储问题。
- 不要让两个运行中的容器读写同一个 `data/`。需要迁移时先停止旧实例。

## 3. 填写完整 Compose 配置

### 3.1 生成应用密钥

在服务器或自己的电脑终端执行：

```bash
openssl rand -hex 32
```

命令会生成 **64 位十六进制字符串**。复制输出，填入下一节的 `APP_SECRET`。

程序要求 `APP_SECRET` 至少 32 个字符。空字符串或长度不足会导致容器启动失败。不要使用公开示例作为密钥；升级、迁移时保留原值。生成的十六进制字符串也能避免 Compose 对 `$` 等特殊字符的解释问题。

### 3.2 保存 docker-compose.yml

使用文本编辑器，在项目目录保存以下文件。也可以复制仓库根目录的 [docker-compose.yml](../docker-compose.yml)，内容保持一致：

```yaml
# 使用已发布镜像，服务器上无需源码和构建环境。
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
      # 按本文通过内网 IP + 端口访问时，保持为空。
      PUBLIC_URL: ""
      TZ: Asia/Shanghai
```

保存前，把 `APP_SECRET: ""` 改为你的随机密钥。使用空格缩进，不要使用 Tab；文件名必须是 `docker-compose.yml`，避免编辑器自动添加 `.txt` 后缀。

填入密钥后的 Compose 文件属于敏感配置，不要公开文件或完整的 `docker compose config` 输出。下文使用 `config --quiet`，只校验而不打印密钥。

### 3.3 各字段如何填写

| 配置项 | 作用与修改方法 |
| --- | --- |
| `image` | 使用已发布镜像；默认跟随 `latest`。固定版本或换镜像源时直接修改这一行 |
| `container_name` | 容器名，默认 `family-dashboard`；同一主机上不能存在两个同名容器 |
| `restart: unless-stopped` | 容器异常退出或 Docker 重启后自动恢复；手动停止的容器不会因此自动启动 |
| `ports` | `宿主机端口:容器端口`；客户端访问左边的端口 |
| `volumes` | 将宿主机目录挂载到容器的 `/app/data`，保存所有持久化数据 |
| `APP_SECRET` | 必填随机密钥，至少 32 个字符，建议使用上面的生成结果 |
| `PUBLIC_URL` | 本文的 IP 直连配置留空即可 |
| `TZ` | 容器时区，默认 `Asia/Shanghai`；家庭日程时区仍需在应用设置中配置 |

镜像已内置生产模式、监听端口 `8686`、数据路径 `/app/data` 和健康检查。一般不要额外配置 `PORT`、`DATA_DIR`、`NODE_ENV`，也不需要独立数据库、`privileged`、host 网络或 Docker Socket 挂载。

### 3.4 端口被占用时

只修改 `ports` 左边的宿主机端口。例如改为：

```yaml
    ports:
      - "8690:8686"
```

之后使用 `http://服务器内网IP:8690`，健康检查地址相应改为 `http://127.0.0.1:8690/api/health`。容器内仍使用 `8686`，镜像自带的健康检查不需要修改。

默认端口映射可供其他设备访问。若写成 `127.0.0.1:8686:8686`，其他手机和平板将无法直连。

### 3.5 数据挂载路径

`./data` 相对于 Compose 文件所在目录解析。只要后续一直使用同一份文件和目录，就会继续读取原数据。

使用图形化 Compose 管理器，或希望固定挂载位置时，可以改为绝对路径：

```yaml
    volumes:
      - /opt/family-dashboard/data:/app/data
```

左边必须换成设备的真实路径，右边保持 `/app/data`。已有安装迁移配置时，要核对原容器的实际挂载位置，不能新建一个空目录后直接启动，否则页面会重新要求初始化。

## 4. 启动与健康检查

### 4.1 使用命令行

在项目目录按顺序执行：

```bash
sudo docker compose -f docker-compose.yml config --quiet
sudo docker compose -f docker-compose.yml pull app
sudo docker compose -f docker-compose.yml up -d app
sudo docker compose -f docker-compose.yml ps
sudo docker compose -f docker-compose.yml logs --tail=100 app
```

某一步失败时，先处理错误，不要继续执行后续步骤。

- `config --quiet` 只验证 Compose 配置语法，不会替你检查密钥是否足够长。
- `pull` 下载镜像，不会自动替换正在运行的容器。
- `up -d app` 创建或更新容器，并让它在后台运行。
- `ps` 应显示容器运行中；健康状态可能先是 `starting`，稍后变为 `healthy`。
- 日志应出现服务已启动的信息。日志中的 `localhost` 指服务自身，手机应使用服务器内网 IP。

检查本机接口：

```bash
curl -fsS http://127.0.0.1:8686/api/health
```

正常返回类似：

```json
{"ok":true,"time":1790000000000}
```

`time` 是当前服务器时间戳，不要求与示例一致。改过宿主机端口时同步修改命令。

查看容器健康状态与实际挂载目录：

```bash
sudo docker inspect family-dashboard --format '{{.State.Health.Status}}'
sudo docker inspect family-dashboard --format '{{range .Mounts}}{{println .Source "->" .Destination}}{{end}}'
```

健康检查只代表服务接口可响应，还需要完成后面的页面与数据验收。

### 4.2 使用图形化 Compose 管理器

不同系统的入口可能叫「项目」「编排」「Compose」或「Stacks」，一般操作为：

1. 新建 Compose 项目，名称填写 `family-dashboard`。
2. 选择之前建立的项目目录，导入该目录的 `docker-compose.yml`，或粘贴相同内容。
3. 确认密钥已填写、端口未冲突、数据挂载指向正确目录。如果管理器不明确相对路径的解析位置，使用上一节的绝对路径写法。
4. 创建并启动项目，查看镜像拉取结果、启动日志及健康状态。
5. 使用容器详情中的挂载信息，确认 `/app/data` 对应宿主机上预期的目录。

选择一种方式管理同一个项目，避免在另一个目录重复创建同名容器。命令行创建的项目不一定会被图形界面自动接管。

## 5. 首次使用与验收

### 5.1 打开看板

让电脑、手机或平板连接家庭局域网，在浏览器输入：

```text
http://服务器内网IP:8686
```

例如服务器地址为 `192.168.1.10`，访问 `http://192.168.1.10:8686`。不要在手机上输入 `localhost` 或 `127.0.0.1`，它们指向手机自己。

建议为服务器设置固定内网 IP 或 DHCP 地址保留。若使用访客 Wi-Fi，注意访客隔离可能阻止访问家庭设备；服务器防火墙也需要允许家庭网络访问映射端口。

### 5.2 初始化账号和家庭设置

1. 首次打开创建管理员账号；已有数据库时直接登录，不需要重新初始化。
2. 为家人添加账号有两种方式：管理员在「设置 → 家庭 → 家庭成员」中直接添加；或在同一处打开「允许自助注册」，家人在登录页选择「注册家庭成员」自行注册为普通成员。自助注册默认关闭——开放期间，任何能打开看板地址的人（包括连上家里 Wi‑Fi 的访客）都能注册并看到家庭共享的日程和清单，家人注册完成后请及时关闭。
3. 在「设置 → 家庭」配置家庭时区和天气位置。
4. 在「设置 → 外观」选择主题、壁纸；较旧设备可以打开性能模式。

容器的 `TZ` 不会覆盖数据库中的家庭时区。当前定时任务在启动时读取家庭时区，修改后执行 `sudo docker compose restart app`，使备份等定时任务重新按该时区安排。

镜像实际包含的功能取决于已发布版本。如果没有注册入口等新功能，请先核对第 8 节的版本说明。

### 5.3 配对挂墙大屏

1. 管理员在「设置 → 大屏」点击「添加设备」，生成配对码。
2. 平板浏览器打开 `http://服务器内网IP:8686/kiosk`，填写配对码和设备名称。
3. 配对后以只读设备身份显示家庭公共看板，不获得管理员权限。
4. 按页面提示启用提醒声音，并在设备系统中关闭自动锁屏或延长亮屏时间。
5. 不再使用的设备，可由管理员在大屏设置中吊销。

提醒依赖页面运行；将页面关闭或被系统暂停后，不能把它当作手机后台推送使用。

### 5.4 验收清单

- 创建管理员并登录，刷新后仍保持登录。
- 新增日程、待办或购物条目，刷新后数据仍存在。
- 在首页进入编辑，添加一张卡片，点击「完成」保存，刷新后仍保留。
- 使用另一台设备登录，确认家庭共享内容能实时同步。
- 打开 `/kiosk`，确认配对、显示及页面内提醒正常。
- 执行一次 `sudo docker compose restart app`，确认账号和数据保留。
- 查看 `data/` 下的数据库和目录，确认数据写入预期的宿主机位置。

实时连接使用 **SSE**。已登录时，浏览器开发者工具中的 `/api/stream` 应返回 `200`，响应类型为 `text/event-stream`，连接持续打开并收到约每 20 秒一次的心跳；未登录时返回 `401` 属于正常行为。

## 6. IP 直连的功能边界

| 功能 | 本文访问方式下的表现 |
| --- | --- |
| 初始化、登录、成员管理 | 可用，具体入口以镜像版本为准 |
| 日程、待办、购物清单、卡片编辑 | 可用 |
| 多设备实时同步 | 可用，需要网络连通 |
| 大屏显示、页面内提醒 | 可用，页面需保持运行；声音需要用户交互授权 |
| 页面暂时断网 | 可继续查看已加载的数据，恢复连接后才能修改和同步 |
| 断网后重新打开应用 | 不作为此部署方式支持的功能；浏览器缓存不能替代可用网络 |
| 自动保持屏幕常亮 | 此访问方式下不可用，请在设备系统中设置不自动锁屏 |
| 添加到桌面 | 依浏览器可创建书签或快捷方式，不等于获得离线运行能力 |

当前源码会在「设置 → 个人 → 连接与浏览器功能」展示能力说明；大屏和超市模式在自动常亮不可用时显示提示。基础功能不因这些浏览器限制而关闭。

## 7. 日常管理与配置修改

以下命令均在项目目录执行。命令中的 `app` 是 Compose 服务名，`family-dashboard` 是容器名，不要混淆。

| 操作 | 命令 |
| --- | --- |
| 查看运行状态 | `sudo docker compose ps` |
| 查看最近日志 | `sudo docker compose logs --tail=100 app` |
| 持续跟踪日志 | `sudo docker compose logs -f --tail=100 app`，按 Ctrl+C 结束查看，不会停止容器 |
| 重启现有容器 | `sudo docker compose restart app` |
| 暂时停止 | `sudo docker compose stop app` |
| 启动已停止的现有容器 | `sudo docker compose start app` |
| 创建容器或应用配置变更 | `sudo docker compose up -d app` |

修改端口、挂载路径、环境变量或镜像地址后，执行：

```bash
sudo docker compose config --quiet
sudo docker compose up -d app
sudo docker compose ps
sudo docker compose logs --tail=100 app
```

**普通 `restart` 不会加载新的 Compose 环境变量、端口或挂载配置，也不会切换到新镜像。** 图形管理器需要选择会重新读取配置并重建容器的操作；名称不明确时使用命令行。

如需确认实际使用的 Compose 文件，可以在所有命令中显式加上 `-f /实际项目路径/docker-compose.yml`。不要从另一个目录使用另一份配置启动项目。

## 8. 镜像版本与升级

### 8.1 latest、dev 与固定版本

- 只有推送 `v*` Git 标签才会构建镜像。正式版本（例如 `v1.2.3`）发布同名镜像标签 `v1.2.3`、版本别名 `1.2.3` / `1.2`，并更新 `latest`；预发布版本（例如 `v1.3.0-rc.1`）不更新 `latest`。
- 仅推送 `master` 或 `dev` **不会构建镜像或更新 `latest`**。合并代码后还需要推送版本标签；源码中的新功能不一定已包含在你拉取的镜像中。
- 版本标签和 `sha-<提交号>` 只有在对应工作流已成功构建并推送后才可拉取。不要假定存在 `:dev` 或任意示例版本。
- `latest` 可以指向不同构建。需要稳定复现时，在 `image` 中使用实际已发布的版本标签或仓库摘要。

版本信息与发布规则见 [镜像自动构建](CI_IMAGE.md)。换用其他镜像源时，也要先确认维护者已将所需版本发布到那个仓库，再修改 `services.app.image`；无需增加环境变量文件。

记录当前镜像：

```bash
sudo docker inspect family-dashboard --format '{{.Config.Image}} {{.Image}}'
```

第一项为配置的镜像引用，第二项为实际镜像 ID。查询当前运行镜像对应的仓库摘要：

```bash
dashboard_image_id=$(sudo docker inspect family-dashboard --format '{{.Image}}')
sudo docker image inspect "$dashboard_image_id" --format '{{json .RepoDigests}}'
```

本地自行构建的镜像可能没有仓库摘要。完整仓库摘要形如 `镜像仓库@sha256:摘要`，可以直接作为 Compose 的 `image` 值；不要把镜像 ID 当作仓库摘要。

### 8.2 升级步骤

先按第 9 节完成外部备份并记录当前镜像，再执行：

```bash
sudo docker compose pull app
sudo docker compose up -d app
sudo docker compose ps
sudo docker compose logs --tail=100 app
curl -fsS http://127.0.0.1:8686/api/health
```

确认 `pull` 成功后再执行 `up -d`。保留原 `APP_SECRET`、挂载路径和数据目录。

服务启动时自动执行数据库迁移；已有数据库且存在待执行迁移时，程序会先生成数据库快照。该快照仍在同一块数据盘，不能代替升级前的外部完整备份。

升级后重新检查登录、卡片、日程、购物清单和实时同步。浏览器仍显示旧界面时先刷新，必要时强制刷新；不要通过重建数据库解决前端缓存问题。

## 9. 备份

### 9.1 应用内数据库快照

应用按进程启动时读取的家庭时区，每天 02:00 生成数据库快照，保存在：

```text
data/backups/app-YYYYMMDD-HHMMSS.db
```

保留最近 **7 份**，不是保证保留最近 7 天；手动备份和迁移前备份也使用这套保留规则。程序停机期间不会生成定时备份。

管理员可在「设置 → 数据」中立即备份、下载数据库快照或导出 JSON。数据库快照使用 SQLite 的一致性备份方式，可在应用运行时生成。

| 备份内容 | 包含什么 | 不包含什么 |
| --- | --- | --- |
| 应用生成的 `.db` 快照 | 数据库中的账号、业务数据和设置 | 上传图片、Compose 配置 |
| 导出的 JSON | 用于阅读或迁移的业务数据 | 密码哈希、会话凭据；也不是可直接还原整个应用的备份 |
| 停机打包整个项目目录中的配置和 `data/` | 数据库、上传文件、已有快照及部署配置 | Docker 镜像本体，需另行记录对应版本 |

### 9.2 推荐：停机完整备份

在项目目录执行，先停止写入，再打包：

```bash
sudo docker compose stop app
sudo tar -czpf "../family-dashboard-backup-$(date +%Y%m%d-%H%M%S).tar.gz" docker-compose.yml data
sudo docker compose start app
```

逐条确认执行结果；如果打包失败，不要把残缺归档当作有效备份，应处理磁盘空间或权限问题后重新备份。恢复服务后检查 `docker compose ps`。

此示例针对 `./data:/app/data`。如果使用其他绝对路径挂载，必须备份那个真实目录，不能只打包项目下一个无关的 `data/`。

验证备份能列出内容，命令中的路径替换为刚生成的文件：

```bash
sudo tar -tzf /实际路径/family-dashboard-backup-时间戳.tar.gz
```

应包含 `docker-compose.yml`、`data/app.db` 和相关子目录。把完整备份与镜像版本记录复制到另一块盘或其他设备，并限制读取权限；其中包含账号数据和密钥。

**不要在应用运行时只复制 `data/app.db`。** 最新事务可能还在 `app.db-wal` 中，直接复制单个文件可能丢失数据或得到不一致的备份。

## 10. 恢复与迁移

### 10.1 从完整备份恢复

1. 在当前项目目录执行 `sudo docker compose stop app`，确认服务停止。
2. 在一个新的临时目录中解压备份，不要直接覆盖当前数据。先检查归档，再执行 `sudo tar -xzpf /实际路径/备份.tar.gz -C /实际路径/恢复临时目录`；`-C` 后的目录必须事先创建。
3. 确认解压结果包含 `docker-compose.yml` 和 `data/app.db`，并检查上传文件是否齐全。
4. 将当前的配置、整个 `data/` 目录改名保留，再把备份中的配置和整个数据目录放回。使用绝对挂载路径时同步核对真实位置，不要把旧数据库覆盖到还含有新 `app.db-wal`、`app.db-shm` 的目录里。
5. 在 Compose 中选择备份对应的镜像版本或仓库摘要，保留备份中的密钥。备份文件中的 `latest` 字样不能保证拿到当时的旧镜像。
6. 校验配置、拉取镜像并启动：

```bash
sudo docker compose config --quiet
sudo docker compose pull app
sudo docker compose up -d app
sudo docker compose ps
sudo docker compose logs --tail=100 app
```

确认账号、日程、清单、卡片和上传文件都恢复后，再决定如何处置之前保留的数据。回退升级应同时恢复配套数据库，不要直接用旧程序打开已经被新程序迁移的数据库。

### 10.2 只有数据库快照时

1. 停止应用，保留当前整个数据目录。
2. 创建新的数据目录，将 `.db` 快照复制为 `data/app.db`。
3. 从独立备份中恢复 `uploads/`，并恢复配套 Compose 配置和密钥。没有上传文件备份，就无法还原丢失的图片。
4. 使用兼容的镜像启动，程序会自动创建缺少的工作目录。

应用当前没有将导出 JSON 一键导入并完整恢复的功能，不能用 JSON 文件代替上述数据库恢复步骤。

### 10.3 迁移到另一台设备

在旧设备完成停机完整备份，把归档和版本记录复制到新设备。新设备按本文检查 Docker 与架构，恢复配置和数据，调整宿主机路径及端口后启动。

客户端改用新设备的内网 IP；浏览器可能需要重新登录，大屏可能需要重新配对。迁移过程中保持旧实例停止，避免家人在两份独立数据库上继续修改内容。

## 11. 常见问题

| 现象 | 检查与处理 |
| --- | --- |
| `docker: command not found` 或没有 `compose` 子命令 | 安装或启用 Docker 与 Compose 插件；只有旧版独立命令时先确认版本兼容 |
| 无法连接 Docker daemon | 检查 Docker 服务是否运行，以及当前用户权限 |
| `APP_SECRET` 未设置或长度不足 | 在实际使用的 Compose 文件中填写密钥，再用 `up -d app` 重建；只重启无效 |
| `port is already allocated` | 修改端口映射左边的宿主机端口，重建后使用新端口访问 |
| 容器名已被占用 | 检查是否已在另一个项目目录部署；找到原项目和数据，避免重复创建或误删 |
| `permission denied`、`readonly database` | 检查本地挂载路径、共享文件夹 ACL、磁盘空间及只读状态，移除误加的 `user:`；不要直接用 `chmod -R 777` 掩盖问题 |
| `database is locked` | 检查是否多个容器共用同一数据库，或数据位于网络文件系统 |
| 拉取镜像超时 | 检查服务器 DNS、出站网络和 Docker 守护进程的网络配置；电脑浏览器能访问 GitHub 不代表 Docker 能访问镜像仓库 |
| `denied` / `unauthorized` | 确认镜像是否公开、地址是否正确；镜像发布与可见性问题见 [CI_IMAGE.md](CI_IMAGE.md) |
| `manifest unknown` | 标签尚未发布或拼写错误；推送 `dev` 不会自动产生 `latest` 或 `dev` 镜像 |
| `no matching manifest` / `exec format error` | 核对主机架构和镜像平台，不要强制运行不匹配的架构 |
| 本机健康检查成功，手机打不开 | 检查服务器 IP、宿主机端口、防火墙、访客网络隔离，以及是否只绑定了 `127.0.0.1` |
| 容器持续重启或 `unhealthy` | 先看日志，检查密钥、挂载权限、磁盘空间和迁移错误；不要反复初始化或删除数据库 |
| 刷新后回到登录页 | 确认浏览器允许本站 Cookie，服务器时间正常，且始终访问同一个地址；更新到包含相关修复的版本后重新登录 |
| 页面重新要求创建管理员，原数据不见了 | 先停止操作并核对实际挂载源路径，常见原因是换了目录或错误地挂载了空目录 |
| 点击添加卡片无反应，提示 `crypto.randomUUID is not a function` | 旧版本问题；更新到包含 HTTP 添加卡片修复的镜像，重建容器并强制刷新页面 |
| 更新了源码，但拉取镜像没有变化 | 核对是否只更新了 `dev`，以及镜像工作流是否真正发布成功 |
| 天气加载失败 | 检查天气位置配置、服务器 DNS 以及到 `api.open-meteo.com` 的出站连接 |
| 购物或日程没有实时同步 | 确认记录是全家共享，检查登录状态和 `/api/stream` 是否返回 `200` 并持续有心跳 |
| 大屏自动熄屏或没有声音 | 在系统中关闭自动锁屏，保持页面运行，并点击启用提醒声音 |

### 推荐排查顺序

```bash
sudo docker compose ps
sudo docker compose logs --tail=200 app
curl -fsS http://127.0.0.1:8686/api/health
sudo docker inspect family-dashboard --format '{{range .Mounts}}{{println .Source "->" .Destination}}{{end}}'
```

确认容器与本机接口正常后，再从其他设备检查 `http://服务器内网IP:8686`。求助时提供镜像版本、主机架构、浏览器版本、经过脱敏的错误日志和发生步骤，不要公开密钥、Cookie 或完整数据库。

## 12. 停止或移除项目

暂时不用时执行 `sudo docker compose stop app`，以后可用 `start app` 恢复。

如果要移除容器和项目网络：

```bash
sudo docker compose down
```

本文使用宿主机目录挂载，`down` 不会删除项目目录中的 `docker-compose.yml` 和 `data/`；以后仍可通过 `up -d app` 重建。NAS 管理界面如果另有「删除项目文件 / 数据目录」选项，含义不同，应在确认外部备份有效后再选择。

本文配置依据：[Dockerfile](../docker/Dockerfile)、[环境配置](../apps/server/src/env.ts)、[备份实现](../apps/server/src/services/backup.ts)、[镜像构建工作流](../.github/workflows/docker.yml)。
