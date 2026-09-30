# 飞牛 NAS（fnOS）部署指南

本文适用于飞牛私有云 fnOS。fnOS 基于 Debian，自带 Docker，因此部署方式与普通 Linux 主机基本一致：用 Docker Compose 启动看板，再用一个反向代理容器提供 HTTPS。

> fnOS 的界面随版本更新变化较快，文中的菜单名称以 fnOS 1.x 为参考，如与你的界面不一致，按意思找对应入口即可。所有步骤都提供了 SSH 命令行做法作为兜底。

整体结构：

```
手机 / 平板 / 电脑  ──HTTPS 443──▶  Nginx Proxy Manager 容器  ──HTTP 8686──▶  family-dashboard 容器
```

HTTPS 是必需的：PWA 安装、离线缓存和大屏的屏幕常亮都只在 HTTPS 下可用。

---

## 第 1 步：准备配置文件

镜像由 GitHub Actions 预先构建好（见 [镜像自动构建](CI_IMAGE.md)），NAS 上不需要源码，只需要两个文件。

1. 确认已在 fnOS 中创建存储空间，并在「应用中心」安装了 **Docker**。
2. 在「文件管理」中新建文件夹，例如 `docker/family-dashboard`。它在系统中的实际路径类似 `/vol1/1000/docker/family-dashboard`，可以在文件管理中右键文件夹 →「详细信息」查看。
3. 把仓库中的 [`docker-compose.yml`](../docker-compose.yml) 和 [`.env.example`](../.env.example) 放进这个文件夹（在 GitHub 上打开文件 →「Download raw file」下载后上传即可），并把 `.env.example` 改名为 `.env`。
   SSH 用户也可以直接下载：

   ```bash
   cd /vol1/1000/docker/family-dashboard
   curl -fsSLO https://raw.githubusercontent.com/dddyszy/family-dashboard/master/docker-compose.yml
   curl -fsSL -o .env https://raw.githubusercontent.com/dddyszy/family-dashboard/master/.env.example
   ```

4. 编辑 `.env`，按注释填写：

   ```bash
   # 至少 32 位的随机字符串，可在任意电脑上执行 openssl rand -hex 32 生成
   APP_SECRET=请替换为随机字符串
   # 第 3 步配置好的访问地址，先留空也可以
   PUBLIC_URL=https://dash.example.com
   # 国内拉取 ghcr.io 慢时，改用阿里云镜像（地址见 CI_IMAGE.md）
   # IMAGE=registry.cn-hangzhou.aliyuncs.com/dddyszy/family-dashboard:latest
   ```

## 第 2 步：启动看板

### 方式 A：Docker 应用图形界面

1. 打开 Docker 应用 →「Compose」→「新增项目」。
2. 项目名称填 `family-dashboard`，路径选择第 1 步的文件夹。界面会识别到文件夹中的 `docker-compose.yml`，直接使用即可。
3. 勾选「创建项目后立即启动」并确认。首次需要下载镜像（约 100MB），可以在项目日志中查看进度。

### 方式 B：SSH 命令行

```bash
cd /vol1/1000/docker/family-dashboard
sudo docker compose up -d
sudo docker compose logs -f   # 看到「家庭看板已启动」后按 Ctrl+C 退出日志
```

### 验证

在浏览器访问 `http://NAS的IP:8686`，能看到「欢迎使用家庭看板」即表示启动成功。先不要创建账号，完成 HTTPS 配置后再用正式地址访问。

数据全部保存在项目文件夹下的 `data/` 目录中：`app.db` 是数据库，`uploads/` 是头像和壁纸，`backups/` 是自动备份。

> fnOS 自己的管理页面默认使用 5666 / 5667 端口，与看板的 8686 不冲突。如果 8686 被其他容器占用，把 `docker-compose.yml` 中的 `"8686:8686"` 左边改成其他端口即可，例如 `"8690:8686"`。

## 第 3 步：配置 HTTPS

这里使用 [Nginx Proxy Manager](https://nginxproxymanager.com/)（以下简称 NPM）：它是一个带图形界面的反向代理容器，能自动申请和续期 Let's Encrypt 免费证书，与 NAS 系统无关，fnOS 社区也普遍使用。

### 3.1 准备域名

需要一个自己的域名（例如在阿里云、腾讯云购买，一年几十元）。添加一条 A 记录：

- 主机记录：`dash`（得到 `dash.example.com`）
- 记录值：
  - **只在家里用**：填 NAS 的内网 IP，例如 `192.168.1.10`
  - **需要外网访问**：填家里的公网 IP（或配合 DDNS），并在路由器上把 443 端口转发到 NAS

> 把域名直接解析到内网 IP 是完全可行的做法：配合下面的 DNS 验证方式申请证书，不需要对外开放任何端口。少数路由器开启了「DNS 重绑定保护」会拦截这类解析，遇到时在路由器中把该域名加入白名单即可。

### 3.2 启动 Nginx Proxy Manager

在「文件管理」中新建文件夹 `docker/npm`，在其中创建 `docker-compose.yml`：

```yaml
services:
  npm:
    image: jc21/nginx-proxy-manager:latest
    container_name: nginx-proxy-manager
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
      - "81:81"
    volumes:
      - ./data:/data
      - ./letsencrypt:/etc/letsencrypt
```

然后按第 2 步的方式 A 或方式 B 启动它（SSH 下为 `cd /vol1/1000/docker/npm && sudo docker compose up -d`）。

浏览器打开 `http://NAS的IP:81` 进入 NPM 管理界面，按提示设置管理员邮箱和密码。

### 3.3 申请证书

NPM 管理界面 →「SSL Certificates」→「Add SSL Certificate」→「Let's Encrypt」：

- Domain Names：`dash.example.com`
- 打开「Use a DNS Challenge」，DNS Provider 选择你的域名服务商（阿里云选 `Aliyun`，腾讯云选 `DNSPod`，Cloudflare 选 `Cloudflare`），按提示填写服务商后台生成的 API 密钥
- 同意条款后保存，等待约 1 分钟证书签发完成

DNS 验证方式通过服务商接口证明域名归你所有，所以即使域名解析到内网 IP、NAS 没有开放任何端口，也能拿到正式证书，并且会自动续期。

### 3.4 添加反向代理

「Hosts」→「Proxy Hosts」→「Add Proxy Host」：

- **Details** 页
  - Domain Names：`dash.example.com`
  - Scheme：`http`
  - Forward Hostname / IP：NAS 的内网 IP（例如 `192.168.1.10`）
  - Forward Port：`8686`
  - 勾选「Block Common Exploits」和「Websockets Support」
- **SSL** 页
  - SSL Certificate：选择 3.3 申请的证书
  - 勾选「Force SSL」和「HTTP/2 Support」
- **Advanced** 页，在 Custom Nginx Configuration 中填入：

  ```nginx
  proxy_read_timeout 300s;
  proxy_buffering off;
  ```

  这两行保证实时同步用的长连接不会被缓冲或超时断开。服务端也已经带上了 `X-Accel-Buffering: no` 和每 20 秒一次的心跳，这里是双保险。

保存后，把第 1 步 `.env` 中的 `PUBLIC_URL` 改为 `https://dash.example.com`，然后重启看板容器：

- Docker 应用：在项目中点「重启」
- SSH：`cd /vol1/1000/docker/family-dashboard && sudo docker compose up -d`

## 第 4 步：初始化与添加设备

1. 用 `https://dash.example.com` 打开，创建管理员账号。
2. 「设置」→「家庭」：添加家庭成员，设置天气城市。
3. 手机上用 Safari 或 Chrome 打开网址，选择「添加到主屏幕」或「安装应用」。
4. 挂墙平板：
   - 管理员在「设置」→「大屏」中点击「添加设备」，得到 6 位配对码。
   - 平板打开 `https://dash.example.com/kiosk`，输入配对码。
   - 添加到主屏幕后从图标启动，即为无地址栏的全屏大屏。
   - 在大屏上点一次「启用提醒声音」，之后提醒到来时才会响铃（浏览器限制）。

**iPad 额外建议**：iOS 18.4 之前，主屏幕应用中的屏幕常亮功能不稳定。请在「设置」→「显示与亮度」中把「自动锁定」设为「永不」，并在「辅助功能」→「引导式访问」中开启，把平板锁定在本应用。

**安卓平板额外建议**：如需开机自动打开、防止被误退出，可以使用 Fully Kiosk Browser 一类的专用浏览器打开 `/kiosk`。

## 部署自检清单

- [ ] 浏览器地址栏显示锁标志，证书域名正确
- [ ] Chrome 开发者工具 → Application：Manifest 无报错，Service Worker 状态为 activated
- [ ] 手机可以「添加到主屏幕」，打开后没有地址栏
- [ ] 两台设备同时打开同一个购物清单，一边勾选，另一边 1 秒内同步
- [ ] 大屏放置 10 分钟不熄屏
- [ ] 新建一个 2 分钟后开始、提醒为「准时」的日程，到点时大屏弹窗并响铃

## 备份与升级

- 每天凌晨 2 点自动备份数据库到 `data/backups/`，保留最近 7 份；「设置」→「数据」中可以手动备份和下载。
- 建议用 fnOS 的备份功能（或任意同步工具）把 `docker/family-dashboard/data` 定期备份到其他硬盘或云端。
- 升级：

  ```bash
  cd /vol1/1000/docker/family-dashboard
  sudo docker compose pull
  sudo docker compose up -d
  ```

  启动时如果有数据库结构变更，会先自动备份一次再升级。用图形界面的话，在 Docker 应用的项目中先「拉取」再「重新启动」。想固定在某个版本，把 `.env` 中的 `IMAGE` 写成带版本号的地址（见 [镜像自动构建](CI_IMAGE.md)）。

## 常见问题

**拉取镜像很慢或失败**
国内访问 `ghcr.io` 不稳定。在 `.env` 中把 `IMAGE` 改为阿里云镜像地址后重新执行 `sudo docker compose pull`（阿里云镜像的配置见 [镜像自动构建](CI_IMAGE.md)）。

**提示 `denied` 或无权限拉取镜像**
GHCR 上的镜像还没有设为公开，按 [镜像自动构建](CI_IMAGE.md) 中「把 GHCR 镜像设为公开」操作一次即可。

**NPM 启动失败，提示 80 或 443 端口被占用**
说明 NAS 上已有其他服务占用了这两个端口。可以停掉占用的服务，或者把 NPM 的端口映射改为 `"8443:443"` 等，访问地址相应变为 `https://dash.example.com:8443`（`PUBLIC_URL` 也要带上端口）。

**购物清单不能实时同步 / 页面提示「正在重新连接」**
检查 3.4 中是否勾选了「Websockets Support」，以及 Advanced 页的两行配置是否已保存。

**登录后刷新又回到登录页**
确认 `.env` 中的 `PUBLIC_URL` 与浏览器地址栏中的地址完全一致（包括 `https://` 和端口），修改后需要重启看板容器。

**天气一直显示「暂时无法获取」**
NAS 需要能访问 `api.open-meteo.com`。可以在 SSH 中执行 `curl -I https://api.open-meteo.com` 检查网络。

**提醒没有声音**
浏览器要求页面被点击过才能发声。手机和电脑上点一下页面任意位置即可；大屏上点一次「启用提醒声音」。
