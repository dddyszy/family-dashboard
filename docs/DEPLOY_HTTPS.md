# HTTPS 配置指南

本文是 [Docker Compose 部署指南](DEPLOY_DOCKER_COMPOSE.md) 的可选补充。请先完成基础部署，确认通过 `http://服务器内网IP:8686` 可以登录、编辑卡片和保存数据，再增加 HTTPS 入口。

配置继续使用 Compose，**不需要 `.env` 文件**。看板容器仍提供 HTTP，由反向代理处理证书和 TLS。增加 HTTPS 不需要重建账号或搬迁数据库；可以同时保留原来的 HTTP 内网入口。

本文以独立的 **Nginx Proxy Manager（NPM）Compose 项目**为例，使用固定版本 `2.16.0`。已有反向代理时，可以直接参考第 6 节，不必再部署 NPM。示例中的 `dash.example.com`、`192.168.1.10` 和文件路径都需要替换成自己的实际值。

## 目录

1. [HTTPS 能增加哪些能力](#1-https-能增加哪些能力)
2. [准备域名、网络和证书](#2-准备域名网络和证书)
3. [通过 Compose 启动 NPM](#3-通过-compose-启动-npm)
4. [申请证书并创建代理规则](#4-申请证书并创建代理规则)
5. [设置看板地址与双协议访问](#5-设置看板地址与双协议访问)
6. [已有反向代理的配置要求](#6-已有反向代理的配置要求)
7. [验收](#7-验收)
8. [续期、备份和更新](#8-续期备份和更新)
9. [常见问题](#9-常见问题)

## 1. HTTPS 能增加哪些能力

| 功能 | 普通内网 IP + HTTP | 可信 HTTPS 地址 |
| --- | --- | --- |
| 登录、日程、待办、购物、卡片编辑 | 可用 | 可用 |
| SSE 实时同步、大屏显示、页面内提醒 | 可用 | 可用 |
| Service Worker、断网后重新打开缓存页面 | 不可用 | 浏览器支持且缓存准备完成后可用 |
| 完整 PWA 安装体验 | 受限，部分浏览器可创建快捷方式 | 仍取决于浏览器是否支持及是否提供安装入口 |
| 浏览器自动保持屏幕常亮 | 不可用 | 浏览器支持且允许时可用，后台或省电模式可能暂停 |

HTTPS 是浏览器增强功能的必要条件之一，不是所有功能必定成功的保证。看板在「设置 → 个人 → 连接与浏览器功能」展示当前能力；大屏、超市模式会提示常亮不可用的原因。

补充说明：

- HTTPS 下离线查看仍只针对已缓存的页面和数据；修改及实时同步需要网络。
- 安装到桌面后，提醒声音仍可能需要先点击页面授权，页面也可能被系统暂停。
- 当前提醒是页面内提醒；配置 HTTPS 不会自动获得尚未实现的手机后台推送功能。
- 开发时的 `localhost` 通常被浏览器特殊信任，不能用它的表现推断普通内网 IP 的能力。
- 浏览器应无证书错误，页面的 `window.isSecureContext` 应为 `true`。不要把点击「忽略证书警告」当作配置完成。

## 2. 准备域名、网络和证书

### 2.1 访问链路

```text
HTTPS：手机 / 平板 → https://dash.example.com:443 → NPM → http://192.168.1.10:8686 → 看板容器
HTTP： 手机 / 平板 → http://192.168.1.10:8686 → 看板容器
```

两个入口访问同一个看板实例和数据目录。不要为了增加 HTTPS 再创建第二个看板容器。

### 2.2 仅在家庭局域网使用

需要一个自己能管理 DNS 的域名，例如 `dash.example.com`，并让家庭设备将它解析到服务器内网 IP。

- 可在路由器、家庭 DNS 服务中添加本地域名记录。
- 也可以让公网 DNS 返回内网 IP，但部分网络的 DNS 重绑定保护会拦截私网结果；遇到问题优先使用受控的家庭 DNS。
- 手机的私人 DNS、浏览器的安全 DNS 可能绕过家庭 DNS，验收时要确认客户端实际解析结果。
- 不需要为了内网访问开放公网入站端口。证书可以通过 **DNS-01** 验证申请：证明你控制域名，不要求验证服务器连接家中的 80 或 443 端口。

仅把域名解析到内网 IP 并不会自动生成证书。DNS 解析和证书签发是两个独立步骤。

### 2.3 需要从外部访问时

在基础功能已初始化、账号已配置好的前提下：

- 公网 DNS / DDNS 指向可访问的公网地址；路由器将公网 TCP 443 转发至 NPM 的 HTTPS 宿主机端口。
- 没有可入站公网地址时，仅设置 DDNS 无法打通访问，可使用已有 VPN 进入家庭网络。
- 有 AAAA 记录时，同时检查 IPv6 连接和防火墙；错误的 IPv6 记录可能让部分客户端连接失败。
- NPM 的管理端口和看板的 8686 端口不应作为公开入口；限制到可信网络。HTTPS 本身不提供成员准入控制：管理员打开「允许自助注册」期间，任何能访问入口的人都能注册普通账号，公网可访问时尤其应保持关闭，改由管理员在设置中添加成员。

### 2.4 选择证书方式

| 方式 | 适用条件 | 注意事项 |
| --- | --- | --- |
| DNS-01 | 可以通过 DNS 服务商添加验证 TXT 记录 | 适合纯内网部署；使用支持的 DNS API 可自动续期 |
| HTTP-01 | 域名解析及公网 TCP 80 能到达证书验证服务 | 必须是公网 80 可达，仅在本地开放 8080 不够 |
| 导入已有证书 | 已有覆盖实际域名的证书、完整证书链和私钥 | 需要自行安排更新、替换及到期检查 |
| 私有 CA | 所有客户端均能正确安装并信任该 CA | 每台手机、平板及相关浏览器都要信任；只导入服务器证书不一定足够 |

本文使用域名证书，不假定证书覆盖 NAS 内网 IP。为 `dash.example.com` 签发的证书，不能直接用于 `https://192.168.1.10`。

## 3. 通过 Compose 启动 NPM

### 3.1 单独建立项目目录

例如在 Linux 主机使用 `/opt/family-dashboard-proxy`，NAS 用户换成实际数据卷路径：

```bash
sudo mkdir -p /opt/family-dashboard-proxy/data
sudo mkdir -p /opt/family-dashboard-proxy/letsencrypt
cd /opt/family-dashboard-proxy
```

目录结构：

```text
family-dashboard-proxy/
├── docker-compose.yml
├── data/             # NPM 数据库与代理配置
└── letsencrypt/      # 证书与续期相关文件
```

这是新的代理项目目录，不是看板的 `data/`。不要混用两者的配置、数据库或挂载路径。

### 3.2 完整 Compose 配置

在此目录保存 `docker-compose.yml`：

```yaml
services:
  proxy:
    image: jc21/nginx-proxy-manager:2.16.0
    container_name: family-dashboard-proxy
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

该配置使用 NPM 自带的 SQLite 存储，不需要额外部署数据库。证书申请时的 DNS API 凭据在 NPM 界面中按所选服务商填写，不需要为此创建 `.env`。

启动前检查端口占用：

| 宿主机端口 | 用途 | 示例冲突处理 |
| --- | --- | --- |
| `80` | HTTP 入口、HTTP-01 验证 | 可改 `8080:80`；HTTP-01 仍要求公网 80 最终转发到容器 80 |
| `443` | HTTPS 入口 | 可改 `8443:443`，访问地址相应包含 `:8443` |
| `81` | NPM 管理界面 | 可改 `8181:81`，仅允许可信网络访问 |

DNS-01 不依赖 80 端口。如果只提供 HTTPS 代理入口，且没有 HTTP 重定向或 HTTP-01 需求，可以删除 `80:80` 这一行。

已有服务占用这些端口时，不要直接停止或覆盖它们。选择其他宿主机端口，或复用现有反向代理。

### 3.3 启动并初始化

在代理项目目录依次执行：

```bash
sudo docker compose config --quiet
sudo docker compose pull proxy
sudo docker compose up -d proxy
sudo docker compose ps
sudo docker compose logs --tail=100 proxy
```

镜像与服务启动成功后，打开 `http://服务器内网IP:81`，按 NPM 初始化界面创建管理员；如果映射到 8181，就使用该端口。不要套用其他版本教程中的默认密码。

此管理账号仅用于代理，不是家庭看板账号。完成初始化前不要将管理入口公开。

## 4. 申请证书并创建代理规则

### 4.1 申请 DNS-01 证书

在 NPM 的「SSL Certificates」中新增 Let's Encrypt 证书：

1. 域名填写实际访问名称，例如 `dash.example.com`。
2. 启用「Use a DNS Challenge」。
3. 选择域名对应的 DNS 服务商，按界面模板填写 API 凭据；凭据需要能修改相关区域的验证记录。
4. 按界面要求填写其他必要信息、同意条款，保存并等待签发成功。
5. 确认签发域名、证书有效期和状态正确。

DNS 服务商不在列表中时，不要随便选择其他服务商。可以使用支持该服务商的 ACME 客户端签发，再通过 NPM 的自定义证书功能导入；这种方案需要另外安排证书更新。

NPM 需要正常的 DNS 和出站网络。签发失败时先看错误是 DNS API 权限、记录传播、网络还是签发频率限制，不要连续反复申请。

如果使用 HTTP-01，则不勾选 DNS Challenge，并确保域名及公网 80 的完整访问链路正确。内网浏览器能打开管理页，不能证明外部验证服务器可以完成验证。

### 4.2 创建 Proxy Host

进入「Hosts → Proxy Hosts → Add Proxy Host」：

| 字段 | 示例值 |
| --- | --- |
| Domain Names | `dash.example.com` |
| Scheme | `http` |
| Forward Hostname / IP | 看板服务器的固定内网 IP，例如 `192.168.1.10` |
| Forward Port | 看板的宿主机端口，默认 `8686` |
| Cache Assets | 关闭 |
| Websockets Support | 关闭；本项目实时同步使用 SSE |

如果看板的端口映射是 `8690:8686`，这里填写 **8690**。

**不要把 Forward Hostname / IP 填成 `127.0.0.1` 或 `localhost`。** NPM 运行在容器中，这两个地址指向 NPM 容器自己。两个独立 Compose 项目默认也不共用网络，不能直接将目标主机名写成另一个项目里的服务名 `app`。

本文通过 NAS IP 和发布端口连接，因此看板应保留 `8686:8686` 映射，不能改成仅绑定 `127.0.0.1`。服务器防火墙需允许 NPM 容器网络连接看板端口。

### 4.3 为根路径设置转发头与 SSE

在这条 Proxy Host 的「Custom Locations」中新建路径 `/`，同样填写 `http`、看板服务器内网 IP 和看板宿主机端口。不要给目标地址附加 `/family-dashboard` 等子路径。

展开**这条自定义路径的高级配置**（通常为齿轮按钮），填写：

```nginx
proxy_set_header X-Forwarded-Host $http_host;
proxy_read_timeout 300s;
proxy_buffering off;
```

上述内容放在自定义路径的高级配置中，不是另建 `server` 或 `location` 块，也不是粘贴到看板 Compose 文件中。

本示例使用的 NPM `2.16.0` 自定义路径模板会设置 `X-Forwarded-Proto $scheme`，按客户端连接的实际协议转发；额外设置的 `X-Forwarded-Host $http_host` 用于保留外部主机名和非标准端口，并覆盖客户端传来的同名头。不要在同一层再次重复添加模板已有的协议头。

设置这几个参数的原因：

- 看板按真实访问协议设置登录 Cookie，不能把浏览器的 HTTPS 请求误报为 HTTP。
- 写接口会检查请求来源；主机名及端口需要与浏览器访问地址对应。
- `/api/stream` 是持续打开的 SSE 连接。关闭代理缓冲才能及时收到事件；读取超时需要长于服务端约 20 秒的心跳间隔。

如果 NPM 版本或配置界面不同，核对实际生成的 `location /` 配置是否具有上述效果，参考第 6 节。不要直接编辑 NPM 自动生成的文件，后续保存规则可能覆盖它们。

### 4.4 选择证书与重定向策略

在「SSL」页选择刚签发或导入的证书，可启用 HTTP/2。

- 如果希望这个域名统一通过 HTTPS 访问，可以启用 **Force SSL**。
- 如果还希望同一域名的 HTTP 代理入口也能访问，则关闭 Force SSL。
- 无论 Force SSL 是否开启，服务器 IP:8686 的 HTTP 直连不经过 NPM，因此不受这项重定向影响。
- 暂不启用 HSTS，先完成所有验收。HSTS 会让浏览器记住该域名只能使用 HTTPS，之后仅关闭 Force SSL 也不会马上恢复同域名的 HTTP 访问。

使用 `8443:443` 等非标准 HTTPS 映射时，先关闭 Force SSL，直接访问 `https://dash.example.com:8443` 验收。默认重定向通常指向 443，不能假定它会自动带上宿主机的 8443 端口。

保存后确认 Proxy Host 状态正常。

## 5. 设置看板地址与双协议访问

### 5.1 修改看板的 PUBLIC_URL

回到**看板项目目录**，不是 NPM 项目目录。编辑原有 `docker-compose.yml`，只修改 `services.app.environment.PUBLIC_URL`，保留原密钥、镜像、数据挂载和其他字段：

```yaml
      PUBLIC_URL: "https://dash.example.com"
```

如果客户端使用非标准端口：

```yaml
      PUBLIC_URL: "https://dash.example.com:8443"
```

填写完整协议、主机名和必要的端口，不添加 `/kiosk`、其他路径、查询参数或账号密码。不要填容器内部地址。

在看板项目目录执行：

```bash
sudo docker compose config --quiet
sudo docker compose up -d app
sudo docker compose ps
sudo docker compose logs --tail=100 app
```

普通 `restart` 不会加载 Compose 中修改的环境变量。也不要把第 3 节的 NPM Compose 文件覆盖到看板项目中。

### 5.1.1 可选：让登录限流识别真实客户端

看板按 TCP 连接的来源地址限制登录和注册频率，默认不信任客户端提交的 `X-Forwarded-For`，因为直连时任何人都可以伪造它。经反向代理访问时，看板看到的来源地址都是代理本身，所有经代理的请求会共用一个限流桶：功能正常，但有人连续输错密码时，其他经代理访问的家人也会被暂时拦住 1 分钟。

如需区分真实客户端，在看板的 `environment` 中填写代理连到看板时使用的来源 IP，多个用英文逗号分隔：

```yaml
      TRUSTED_PROXIES: "172.18.0.1"
```

代理与看板处在同一 Docker 网络时，填代理容器的 IP；代理经宿主机端口访问 `8686` 时，来源通常是对应 Docker 网络的网关地址。可以用 `sudo docker network inspect <网络名>` 查看。只填写确实属于代理的地址，并确保代理会把真实客户端地址写入或追加到 `X-Forwarded-For` 末尾（NPM 默认模板和第 4 节的 Nginx 示例都会这样做）。填错不会影响访问，只是限流仍按共用桶计算。

### 5.2 同时保留 HTTP 和 HTTPS

当前源码支持：

```text
http://192.168.1.10:8686
https://dash.example.com
```

两个地址共用账号和数据库，但登录 Cookie、浏览器缓存及本地设置受访问地址影响。切换入口后可能需要重新登录，大屏可能需要重新配对；无需重新创建管理员。

配置 HTTPS 的 `PUBLIC_URL` 不会关闭 HTTP 直连，也不再使 HTTP 响应强制带上 Secure Cookie。HTTP 和 HTTPS 使用不同名称的会话、设备 Cookie，避免同一主机下两种协议互相覆盖；新建的独立会话可以分别退出。

这一行为需要使用包含双协议修复的镜像。仅更新本地源码或推送 `dev` 不会更新已发布的 `latest`；旧版本仍可能在配置 HTTPS 地址后无法保留 HTTP 登录，请按 [版本与升级说明](DEPLOY_DOCKER_COMPOSE.md#8-镜像版本与升级)核对。

### 5.3 如果以后只使用 HTTPS

可以通过防火墙限制看板直连端口，只允许代理和必要的管理网络访问。本文 NPM 经服务器内网 IP 访问后端，因此不能直接将看板端口改为 `127.0.0.1:8686:8686`。

另一种方式是让 NPM 和看板加入同一个 Docker 网络，使用服务名访问并取消看板宿主机端口发布；这需要同时修改两个项目，参见 [NPM 官方 Docker 网络说明](https://nginxproxymanager.com/advanced-config/#best-practice-use-a-docker-network)。不要只取消端口发布而不调整代理目标。

## 6. 已有反向代理的配置要求

已运行反向代理时，无需重复部署 NPM。为看板创建专属域名，并满足以下要求：

| 项目 | 要求 |
| --- | --- |
| 外部地址 | 覆盖完整域名的可信证书，端口与实际访问地址一致 |
| 上游协议 | HTTP；看板容器的 8686 端口不直接提供 TLS |
| 上游地址 | 从代理所在环境能访问的看板地址；宿主机代理与容器代理的 `localhost` 含义不同 |
| Host | 保留浏览器访问的主机名和端口，或通过 `X-Forwarded-Host` 传递 |
| 协议头 | `X-Forwarded-Proto` 为浏览器实际使用的 `http` 或 `https` |
| 头部处理 | 入口代理覆盖客户端提交的协议、主机等转发头，不能无条件信任它们 |
| 实时连接 | 不缓冲或缓存 SSE，读取超时至少大于心跳间隔，本文使用 300 秒 |
| 路径 | 整站从 `/` 转发，包含 `/api/`、`/uploads/`、`/assets/`、`/sw.js` 和 manifest；不部署在子路径 |

以下是**直接接收客户端 TLS 的现有 Nginx**示例，放在 `http` 上下文包含的站点配置文件中。需要替换域名、已存在的证书路径及上游地址，不能直接粘贴进 NPM 的高级文本框：

```nginx
server {
    listen 443 ssl;
    server_name dash.example.com;

    ssl_certificate     /etc/nginx/certs/fullchain.pem;
    ssl_certificate_key /etc/nginx/certs/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;

    client_max_body_size 10m;

    location / {
        proxy_pass http://192.168.1.10:8686;
        proxy_http_version 1.1;
        proxy_set_header Host $http_host;
        proxy_set_header X-Forwarded-Host $http_host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header Connection "";
        proxy_read_timeout 300s;
        proxy_buffering off;
        proxy_cache off;
    }
}
```

先用实际运行的 Nginx 做语法检查，再按该服务的管理方式重新加载；宿主机 Nginx 常见命令为：

```bash
sudo nginx -t
sudo nginx -s reload
```

如果代理位于其他负载均衡器之后，`$scheme` 可能只代表代理间连接，需要按可信代理链正确传递最外层协议。不要原样照搬这个单层示例，也不要直接信任任意客户端提供的 `X-Forwarded-Proto`。

当前看板会读取转发头，未按代理源 IP 建立独立信任列表；后端直连端口应限制在可信网络，公网请求应通过正确覆盖头部的入口代理。

## 7. 验收

### 7.1 HTTPS 与证书

在实际客户端浏览器打开 `https://dash.example.com`，确认：

- 没有证书警告，证书域名、有效期和完整证书链正确。
- 地址保持为预期的域名和端口，没有重定向到服务器 IP 或错误端口。
- 浏览器开发者工具中运行 `window.isSecureContext` 返回 `true`。
- 请求没有跳到硬编码的 HTTP API；当前前端接口使用同源相对路径。

在可信任签发链的电脑上，也可检查健康接口：

```bash
curl -fsS https://dash.example.com/api/health
```

如果使用私有 CA，需要在该电脑安装信任链，或使用 `curl --cacert` 指定对应 CA；不要用 `curl -k` 的成功结果代替证书验证。非标准端口同步加入地址。

### 7.2 登录、写入与同步

1. 从 HTTPS 地址登录，刷新后仍保持登录。
2. 新增日程或购物条目，刷新后仍存在。
3. 在另一台设备打开同一 HTTPS 地址，检查共享内容实时同步。
4. 开发者工具中 `/api/stream` 返回 `200` 和 `text/event-stream`，持续收到事件和心跳；未登录时返回 `401` 正常。
5. 大屏通过 HTTPS 的 `/kiosk` 配对并显示。
6. 如果保留 HTTP 入口，再从原 IP + 端口登录、编辑卡片并刷新，确认两种方式都可用。

排查 Cookie 时，应在浏览器开发者工具中确认 HTTPS 登录设置了带 `Secure`、`HttpOnly`、`SameSite=Lax` 的 Cookie。当前源码的名称为 `__Secure-fd_session`、`__Secure-fd_device`；HTTP 使用 `fd_session_http`、`fd_device_http`。不要复制或公开 Cookie 值。

### 7.3 增强功能

- **离线打开**：进入设置页等待离线功能准备完成，先访问所需页面；刷新确认页面已被 Service Worker 控制，再暂时断网重开。只应期望看到已缓存内容，写操作不能在离线时完成。
- **安装到桌面**：查看浏览器菜单是否提供安装应用或添加到主屏幕。没有自动安装弹窗不代表 HTTPS 配置失败。
- **屏幕常亮**：打开大屏或超市模式并保持前台。浏览器可能因省电策略、权限或 API 不支持拒绝，页面会显示对应提示。
- **声音**：按提示点击启用提醒声音，HTTPS 不会绕过浏览器的自动播放限制。

## 8. 续期、备份和更新

### 证书续期

由 NPM 申请的证书会由其管理续期。保持 NPM 运行、DNS 凭据有效和出站网络可用；HTTP-01 还需持续满足公网 80 验证条件。定期检查证书到期时间和续期日志，不能只验证首次签发。

手动导入的证书需要自行更新。更新后重新连接页面，确认浏览器看到的是新证书。

### 代理项目备份

看板数据备份不包含 NPM 的配置和证书。应另外备份代理项目的 Compose 文件、`data/` 和 `letsencrypt/`，这些目录包含代理账号数据、证书私钥和可能保存的 DNS 凭据。

在代理项目目录执行停机备份：

```bash
sudo docker compose stop proxy
sudo tar -czpf "../family-dashboard-proxy-backup-$(date +%Y%m%d-%H%M%S).tar.gz" docker-compose.yml data letsencrypt
sudo docker compose start proxy
```

逐条确认成功并检查归档，将备份保存到独立存储并限制读取权限。代理停止期间 HTTPS 入口不可用；保留的看板 HTTP 直连仍可运行。

### 更新 NPM

先阅读目标版本发行说明、完成备份，再将代理 Compose 的 `image` 改为已发布的新版本，执行：

```bash
sudo docker compose config --quiet
sudo docker compose pull proxy
sudo docker compose up -d proxy
sudo docker compose logs --tail=100 proxy
```

本文固定 `2.16.0` 是为了使配置可复现，不代表应永久停留在此版本。升级后复查自定义路径、转发头、证书续期和 SSE。

## 9. 常见问题

| 现象 | 检查与处理 |
| --- | --- |
| `https://服务器IP:8686` 打不开 | 8686 是看板 HTTP 端口；HTTPS 应访问代理域名及代理端口 |
| 证书域名不匹配 | 浏览器地址必须包含证书覆盖的域名；不要用域名证书访问 IP |
| 证书已导入但手机仍警告 | 检查完整证书链、有效期、设备时间和客户端信任，尤其是私有 CA |
| DNS-01 签发失败 | 检查 DNS 服务商是否选对、API 权限、TXT 记录传播和服务器出站连接 |
| HTTP-01 签发失败 | 从公网确认域名及 TCP 80 可达验证服务，排查错误的 AAAA 记录和端口转发 |
| NPM 返回 502 | 上游使用 HTTP；核对 NAS IP、宿主机端口和防火墙；不要填容器内的 `localhost` |
| 打开了其他管理页面 | 检查域名解析、端口映射及该域名对应的代理规则；可能访问了原有的 443 服务 |
| 8443 打开正常，自动跳转失败 | 关闭默认 Force SSL，或另行正确配置带外部端口的跳转；`PUBLIC_URL` 也应包含端口 |
| 登录后刷新又回到登录页 | 核对实际转发协议、Cookie 属性、浏览器 Cookie 设置及镜像版本，配置变更后用 `up -d` 重建 |
| 写入提示「请求来源不被允许」 | 核对 `PUBLIC_URL`、浏览器的协议和端口、`X-Forwarded-Host` 及 `X-Forwarded-Proto`；普通重启不会加载新的 Compose 环境变量 |
| 实时更新延迟或连接频繁中断 | 检查 `/api/stream` 是否被中间层缓冲或缓存，以及读取超时；打开 WebSocket 支持不能替代 SSE 配置 |
| HTTPS 正常但离线功能失败 | 查看设置页提示，确认安全上下文、浏览器支持、Service Worker 注册和缓存准备状态 |
| 常亮或声音仍不可用 | 检查前台状态、省电策略、浏览器能力和声音授权；证书正常不代表这些限制自动消失 |
| 关闭 Force SSL 后浏览器仍强制跳 HTTPS | 检查此前是否启用 HSTS，包括父域名策略；可继续通过 NAS 内网 IP 访问 HTTP |
| HTTPS 配好后原 HTTP 登录失败 | 核对是否仍运行旧版镜像；当前源码支持双协议，需部署包含修复的版本 |
| 代理或看板更新后仍看到旧页面 | 检查实际镜像版本，使用页面更新提示或强制刷新；不要删除数据库来解决浏览器缓存问题 |

配置依据与参考：

- [NPM 官方安装说明](https://nginxproxymanager.com/setup/)
- [NPM 2.16.0 自定义路径模板](https://github.com/NginxProxyManager/nginx-proxy-manager/blob/v2.16.0/backend/templates/_location.conf)
- [Nginx 代理模块](https://nginx.org/en/docs/http/ngx_http_proxy_module.html)
- [Let's Encrypt 验证方式](https://letsencrypt.org/docs/challenge-types/)
- 本项目的 [认证与 Cookie 处理](../apps/server/src/lib/auth.ts)、[SSE 接口](../apps/server/src/routes/stream.ts)、[PWA 注册](../apps/web/src/pwa/register.ts)
