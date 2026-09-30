# 镜像自动构建（GitHub Actions）

当前版本：**v0.2.0**，变更见 [更新日志](../CHANGELOG.md)。版本号以 Git 标签为准；镜像构建成功后才可拉取。

仓库中的 `.github/workflows/docker.yml` 会在 GitHub 的服务器上自动构建 Docker 镜像，并推送到镜像仓库。NAS 上只需要拉取现成的镜像，不需要源码和构建环境。

## 什么时候构建

| 触发方式 | 生成的镜像标签 |
| --- | --- |
| 推送正式版本标签，例如 `v0.2.0` | `v0.2.0`、`0.2.0`、`0.2`、`latest`、`sha-<提交号>` |
| 推送预发布标签，例如 `v0.3.0-rc.1` | `v0.3.0-rc.1`、`0.3.0-rc.1`、`sha-<提交号>`；不更新 `latest` / `0.3` |
| 推送其他 `v*` 标签，例如 `vtest` | `vtest`、`sha-<提交号>`；不更新 `latest` |
| 推送到 `master` 或 `dev`、在 GitHub 手动发起新工作流 | 不构建；工作流只接受 `v*` 标签推送 |

建议采用 `v主版本.次版本.修订号` 格式发布，并使用 Docker 标签允许的字符（字母、数字、下划线、点、连字符），总长度不超过 128 个字符。避免 `+` 等字符，以确保镜像标签与 Git 标签完全一致。`latest` 跟随最近一次成功发布的正式版本，不比较版本号大小；发布旧版本标签也可能使它回退。已发布的版本标签不要移动或覆盖。

每次都会同时构建 `linux/amd64`（Intel / AMD 的 NAS 和服务器）和 `linux/arm64`（ARM 芯片的 NAS、树莓派等）两种架构，拉取时 Docker 会自动选择匹配的版本。首次构建约 10 – 20 分钟（ARM 版本需要模拟编译），之后有缓存会快很多。

构建进度在仓库页面的「Actions」标签中查看。

## 推送到哪里

- **GHCR**（GitHub Container Registry）：`ghcr.io/dddyszy/family-dashboard`，无需任何配置。
- **阿里云容器镜像服务**（可选）：配置下面的 Secrets 后自动同时推送，国内 NAS 拉取更快。不配置时只推 GHCR，工作流照常成功。

## 首次使用：把 GHCR 镜像设为公开

第一次构建成功后，镜像默认是私有的，NAS 拉取会提示无权限。设置一次即可：

1. 打开 GitHub 个人主页 →「Packages」→ `family-dashboard`。
2. 右侧「Package settings」→ 页面底部「Danger Zone」→「Change visibility」→ 选择「Public」并确认。

之后任何人都可以直接 `docker pull ghcr.io/dddyszy/family-dashboard:v0.2.0`。

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

配置好后，下一次推送版本标签会同时推送到 `registry.cn-hangzhou.aliyuncs.com/dddyszy/family-dashboard`，两个镜像仓库使用相同的标签。构建失败后可在对应 Actions 运行页面选择「Re-run jobs」重试，无需移动 Git 标签。

### 3. 选择已发布的镜像源

确认上述镜像已成功发布后，在 `docker-compose.yml` 中修改 `services.app.image`（下方仅展示该字段，保留其余配置）：

```yaml
    image: registry.cn-hangzhou.aliyuncs.com/dddyszy/family-dashboard:v0.2.0
```

## 发布流程

先在 `dev` 更新 README、部署指南、HTTPS 指南、技术设计和本文件的当前版本，以及根目录 Compose 默认标签，并在 `CHANGELOG.md` 记录变更与升级注意事项。Git 标签、文档和镜像引用保持一致。发布前运行 `bun run check` 与 `bun run build`，推送 `dev` 后再合并。

```bash
# 1. 在 dev 上开发并通过 bun run check，再合并稳定代码
git checkout master
git merge --no-ff dev
git push origin master          # 只更新源码，不构建镜像

# 2. 给当前稳定提交打一个尚未使用的版本标签
git tag -a v0.2.0 -m "Release v0.2.0"
git push origin v0.2.0          # 构建 v0.2.0、0.2.0、0.2、latest 和 sha-<提交号>
```

以上展示本次 `v0.2.0` 的发布过程，标签已存在时不要重复创建或覆盖。后续修复可发布 `v0.2.1`，新增功能可发布 `v0.3.0`；发布时替换成实际新版本。首次采用此流程时，先确保新的工作流已经合入待打标签的提交；GitHub 使用标签所指提交中的工作流配置。打标签可以指向任意提交，工作流不会自动检查它是否属于 `master`；正式发布请按上述流程从稳定分支打标签。

发布成功后，可以在 Compose 中固定到与 Git 标签相同的版本：

```yaml
    image: ghcr.io/dddyszy/family-dashboard:v0.2.0
```

构建时还会将 `v0.2.0-<短提交号>` 写入 `APP_VERSION`，用于前端缓存版本隔离。开发模式保留现有开发版本生成方式，无需手工修改各 workspace 的包版本。

如需测试预发布版，推送类似 `v0.3.0-rc.1` 的标签，并将 Compose 的 `image` 改成该标签；它不会影响使用 `latest` 的部署。

部署、升级、固定镜像版本及回退步骤统一见 [Docker Compose 部署指南](DEPLOY_DOCKER_COMPOSE.md)。等 Actions 成功推送镜像后再拉取；仅推送 `master` / `dev` 或只在本地打标签都不会发布镜像。
