# AGENTS.md

家庭大屏看板：部署在 NAS 上、全家共用的可拖拽卡片看板。Bun + Hono + SQLite 单进程后端，React + Vite 前端，Liquid Glass 主题。架构与接口以 [`docs/TECH_DESIGN.md`](docs/TECH_DESIGN.md) 为准；本文件约束代码怎么写。

## 常用命令

```bash
bun install              # 安装依赖
bun dev                  # 同时启动前端（Vite）与后端（热重载）
bun run check            # biome check + tsc --noEmit + bun test，提交前必须通过
bun run fix              # biome 自动修复格式与 import 顺序
bun test                 # 仅运行测试
bun run db:generate      # 修改 schema 后生成迁移
bun run db:migrate       # 应用迁移（服务启动时也会自动执行）
bun run build            # 构建前端产物
bun run preview          # 以生产模式预览（启用 Service Worker）
docker compose up -d     # 本地以容器方式运行
```

## 目录约定

- `apps/web`：React SPA；`apps/server`：Hono 服务；`packages/shared`：前后端共用的 zod schema、类型和常量
- 前后端之间的数据结构只在 `packages/shared` 定义一次，两端都从这里导入，禁止各写一份
- 前端模块固定结构：

  ```
  apps/web/src/modules/<name>/
    pages/  components/  widgets/  drawer/
    api.ts  queries.ts  index.ts
  ```

- 后端：`routes/<module>.ts` 只做参数解析、调用 service、返回响应；业务逻辑放在 `services/<module>.ts`；数据库只在 service 中访问

## 命名

- 文件名：kebab-case（`shopping-item-row.tsx`）
- React 组件、类型：PascalCase；变量、函数：camelCase；常量：UPPER_SNAKE_CASE
- 数据库列名：snake_case，Drizzle 中映射为 camelCase
- 只用具名导出，不用默认导出（路由懒加载入口和配置文件除外）
- 导入路径：前端用 `@/`，共用包用 `@shared/`，禁止出现三层以上的 `../../../`
- 代码标识符和提交信息用英文；界面文案用中文

## TypeScript

- 禁止 `any`；类型不确定时用 `unknown` 再收窄
- 禁止非空断言 `!`，除非紧邻处有注释说明为什么一定非空
- 优先用 `type`；只有需要声明合并时才用 `interface`
- 外部输入（请求体、查询参数、localStorage、SSE 消息）必须经过 zod 解析后再使用

## 前端

- 只写函数组件和 hooks
- 服务端数据一律通过 TanStack Query 获取；query key 只能来自各模块 `queries.ts` 的工厂函数
- Zustand 只存 UI 状态（抽屉开关、编辑模式等），不存服务端数据
- 写操作使用乐观更新，失败时回滚并提示
- 样式只用 Tailwind 工具类和主题 CSS 变量，禁止硬编码颜色、模糊值和圆角
- 玻璃效果统一使用 `<Glass>` 组件，不要在业务组件里手写 `backdrop-filter`
- 新卡片必须通过 `registerWidget` 注册，声明 `sizes` 和 `configSchema`；卡片内部错误由 `WidgetFrame` 兜底，不要让单张卡片拖垮首页
- 实时消息统一通过 `lib/realtime.ts` 订阅，禁止自行新建 `EventSource`
- Service Worker 缓存规则只写在 `src/pwa/cache-rules.ts`；新增不应缓存的接口（流式、鉴权、敏感数据）必须同步更新该文件
- 新依赖需考虑首屏体积（gzip 后首屏 JS 预算 150KB），大依赖只能在懒加载路由中引入

## 后端

- 所有请求参数用 `packages/shared` 中的 zod schema 校验
- 错误统一抛出 `AppError(code, message, status)`，由全局中间件转换为 `{ error: { code, message } }`；`message` 用中文，可直接展示给用户
- 所有涉及用户数据的查询都必须经过 `lib/visibility.ts` 的过滤函数，禁止手写可见性条件
- 时间一律以 UTC 毫秒时间戳存储和传输；只在展示层按家庭时区格式化
- 写操作成功后调用 `realtime.broadcast()` 发送对应的 SSE 事件；修改日程或待办后必须重新生成提醒
- 主键使用 `Bun.randomUUIDv7()`
- 外部 HTTP 调用（天气等）必须设置超时并缓存结果，不能阻塞用户请求

## 数据库

- 修改 `db/schema.ts` 后必须运行 `bun run db:generate` 生成迁移，并一并提交
- 禁止修改已经提交的迁移文件；需要调整时新增一个迁移
- 优先使用 Drizzle 查询构造器；确需原生 SQL 时使用参数化查询
- 每张表都要有 `created_at`、`updated_at`

## 测试

- 使用 `bun test`，测试文件与源文件同目录，命名为 `*.test.ts`
- 以下逻辑必须有单元测试：重复事件展开与三种修改范围、提醒生成与状态流转、快捷录入解析、可见性过滤、购物条目数量与单位拆分
- 测试使用内存 SQLite（`:memory:`），不依赖外部服务

## 注释

- 注释只写代码本身表达不了的约束或原因（例如浏览器限制、时区陷阱）
- 不写复述代码的注释，不写修改记录，不保留注释掉的代码

## 提交

- 遵循 Conventional Commits：`feat:`、`fix:`、`refactor:`、`style:`、`test:`、`docs:`、`chore:`
- 作用域用模块名，例如 `feat(shopping): support batch paste`
- 一次提交只做一件事

## 完成定义

一项改动只有同时满足以下条件才算完成：

1. `bun run check` 通过
2. 涉及 UI 的改动，在 `liquid-glass-light` 和 `liquid-glass-dark` 两个主题、手机与平板两种宽度下都检查过
3. 新增或修改了接口、表结构、技术选型时，已同步更新 `docs/TECH_DESIGN.md`
