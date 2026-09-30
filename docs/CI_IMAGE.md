# 镜像自动构建（GitHub Actions）

仓库中的 `.github/workflows/docker.yml` 会在 GitHub 的服务器上自动构建 Docker 镜像，并推送到镜像仓库。NAS 上只需要拉取现成的镜像，不需要源码和构建环境。

## 什么时候构建

| 触发方式 | 生成的镜像标签 |
| --- | --- |
| 推送到 `master`（例如把 `dev` 合并过去） | `latest`、`sha-<提交号>` |
| 推送版本标签，例如 `v0.1.0` | `0.1.0`、`0.1`、`sha-<提交号>` |
| 在 GitHub 的 Actions 页面手动运行 | `sha-<提交号>` |

每次都会同时构建 `linux/amd64`（Intel / AMD 的 NAS 和服务器）和 `linux/arm64`（ARM 芯片的 NAS、树莓派等）两种架构，拉取时 Docker 会自动选择匹配的版本。首次构建约 10 – 20 分钟（ARM 版本需要模拟编译），之后有缓存会快很多。

构建进度在仓库页面的「Actions」标签中查看。

## 推送到哪里

- **GHCR**（GitHub Container Registry）：`ghcr.io/dddyszy/family-dashboard`，无需任何配置。
- **阿里云容器镜像服务**（可选）：配置下面的 Secrets 后自动同时推送，国内 NAS 拉取更快。不配置时只推 GHCR，工作流照常成功。

## 首次使用：把 GHCR 镜像设为公开

第一次构建成功后，镜像默认是私有的，NAS 拉取会提示无权限。设置一次即可：

1. 打开 GitHub 个人主页 →「Packages」→ `family-dashboard`。
2. 右侧「Package settings」→ 页面底部「Danger Zone」→「Change visibility」→ 选择「Public」并确认。

之后任何人都可以直接 `docker pull ghcr.io/dddyszy/family-dashboard:latest`。

## 配置阿里云镜像（可选）

### 1. 开通并创建命名空间

1. 登录阿里云，打开「容器镜像服务 ACR」，创建「个人实例」（免费），选择离你近的地域，例如华东 1（杭州）。
2. 在个人实例中「命名空间」→「创建命名空间」，例如 `dddyszy`。
3. 在命名空间的设置中，把「自动创建仓库」打开，「默认仓库类型」设为「公开」。这样首次推送时会自动创建公开仓库，NAS 拉取无需登录。
4. 在「访问凭证」中设置固定密码。页面上会显示登录用的用户名和仓库地址（形如 `registry.cn-hangzhou.aliyuncs.com`）。

### 2. 在 GitHub 中添加 Secrets

仓库页面 →「Settings」→「Secrets and variables」→「Actions」→「New repository secret」，添加四项：

| 名称 | 值（示例） |
| --- | --- |
| `ALIYUN_REGISTRY` | `registry.cn-hangzhou.aliyuncs.com` |
| `ALIYUN_NAMESPACE` | `dddyszy` |
| `ALIYUN_USERNAME` | 访问凭证页面显示的用户名 |
| `ALIYUN_PASSWORD` | 第 1 步设置的固定密码 |

配置好后，下一次构建会同时推送到 `registry.cn-hangzhou.aliyuncs.com/dddyszy/family-dashboard`。也可以在「Actions」页面选择「Docker image」→「Run workflow」手动触发一次。

### 3. 选择已发布的镜像源

确认上述镜像已成功发布后，在 `docker-compose.yml` 中修改 `services.app.image`（下方仅展示该字段，保留其余配置）：

```yaml
    image: registry.cn-hangzhou.aliyuncs.com/dddyszy/family-dashboard:latest
```

## 发布流程

```bash
# 1. 在 dev 上开发并验证
git checkout master
git merge dev
git push origin master          # 构建 latest

# 2. 需要固定版本时打标签
git tag v0.1.0
git push origin v0.1.0          # 构建 0.1.0 和 0.1
```

部署、升级、固定镜像版本及回退步骤统一见 [Docker Compose 部署指南](DEPLOY_DOCKER_COMPOSE.md)。版本标签必须已实际发布；仅推送 `dev` 不会自动发布 `latest` 或 `dev` 镜像。
