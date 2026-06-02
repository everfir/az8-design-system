# az8-ui

AZ8 设计系统。基于 shadcn/ui registry v3，每个图标 / 组件都能被 `npx shadcn add` 直接装进任意项目。

图标源头是 Figma；GitHub Action 每天自动同步并以 PR 形式提交变更。

## 当前 Sections

- **Icons** — 58 个产品图标，由 Figma 「AZ8 Studio Design System / icon / final版本」 frame 自动同步。
  - SVG 源：`public/raw-svg/<Name>.svg`
  - 组件产物：`registry/icons/Icon<Name>.tsx`
  - 镜像：`components/icons/Icon<Name>.tsx`（仓库内 docs 站使用）

## 给消费方：怎么用图标

设计师在 Figma 写的 component 名（PascalCase）就是工程里 import 的名字 —— **零翻译**。

```tsx
import { IconAdd, IconModel3D, IconStoryboardGrid25 } from "@/components/icons"

<IconAdd />                                       // 默认 size="md"（size-4）
<IconModel3D size="lg" />                          // size-5
<IconStoryboardGrid25 className="size-8 text-primary" />  // 完全自定义
```

`IconBase` 暴露的 props：所有 `SVGProps<SVGSVGElement>` + 语义化 `size?: 'sm' | 'md' | 'lg' | 'xl'`。颜色走 `currentColor`，跟随 Tailwind `text-*`。

### 通过 shadcn CLI 装到外部项目

az8-ui 是一个标准 shadcn registry，所有图标都通过 `npx shadcn add` 安装。每个图标是一个独立 item，互不依赖（共同依赖的 `IconBase` 由 CLI 自动一并装上）。

#### 前置：你的项目还没接入 shadcn

跟着 shadcn 官方一次性 init 即可：

```bash
npx shadcn@latest init
```

（按提示选 Tailwind 配置、`components.json` 路径等。已经接过的项目跳过这一步。）

#### 装单个图标

registry slug 规则：`icon-` + 图标名小写。

| Figma name | Component | 安装命令 |
|---|---|---|
| `Add` | `IconAdd` | `npx shadcn@latest add https://everfir.github.io/az8-design-system/r/icon-add.json` |
| `Model3D` | `IconModel3D` | `npx shadcn@latest add https://everfir.github.io/az8-design-system/r/icon-model3d.json` |
| `StoryboardGrid25` | `IconStoryboardGrid25` | `npx shadcn@latest add https://everfir.github.io/az8-design-system/r/icon-storyboardgrid25.json` |

执行后 CLI 会把这些文件落到你的项目里：

```
components/icons/
  icon-base.tsx       ← 第一次装任何图标时自动带上
  IconAdd.tsx
```

然后直接 import 用：

```tsx
import { IconAdd } from "@/components/icons/IconAdd"

<IconAdd className="size-5 text-primary" />
```

#### 一次装多个

shadcn add 支持多个 URL 串在一起：

```bash
npx shadcn@latest add \
  https://everfir.github.io/az8-design-system/r/icon-add.json \
  https://everfir.github.io/az8-design-system/r/icon-delete.json \
  https://everfir.github.io/az8-design-system/r/icon-edit.json
```

#### 把所有 az8-ui 图标都装上

适合 dogfood 或想做"图标墙"页的场景。在你的项目里跑：

```bash
# 抓 registry index → 提取所有 icon-xxx → 一次 shadcn add
curl -s https://everfir.github.io/az8-design-system/r/registry.json \
  | jq -r '.items[] | select(.name | startswith("icon-") and . != "icon-base") | .name' \
  | xargs -I{} echo "https://everfir.github.io/az8-design-system/r/{}.json" \
  | xargs npx shadcn@latest add
```

#### 升级 / 重新拉取最新版

`shadcn add` 默认会**询问是否覆盖**已存在的文件。要静默覆盖加 `-o` / `--overwrite`：

```bash
npx shadcn@latest add --overwrite https://everfir.github.io/az8-design-system/r/icon-add.json
```

或干脆把对应 `components/icons/Icon*.tsx` 删掉再 `add`。

> 注：升级是手动的——shadcn 是 "copy-paste" 模型，没有版本管理。如果想锁定某个时间点的实现，把生成的文件直接 commit 进项目即可。

### 浏览全量列表

https://everfir.github.io/az8-design-system/icons 搜索、查看 SVG、复制安装命令和 import 语句。

## 命名约定

| 维度 | 来源 | 示例 |
|---|---|---|
| Figma component name | 设计师 | `Model3D` |
| 组件名 / 文件名 | `Icon` + Figma name | `IconModel3D.tsx` |
| registry slug（CLI 用） | Figma name 全小写 | `icon-model3d` |

不拆词、不转 kebab。设计师改名直接生效，不用维护映射表。

## 工作流

### 自动：每天从 Figma 同步

`.github/workflows/sync-figma.yml` 每天 02:00 UTC（北京时间 10:00）跑：

1. 拉取 Figma node `256:3152`（"final版本" frame）下所有 component 的 SVG
2. 写入 `public/raw-svg/`，删除 Figma 已不存在的图标
3. 重新生成组件文件 + `registry.json` + `public/r/*.json`
4. 有变动 → 开 PR；无变动 → 跳过

合并 PR 后 `deploy.yml` 自动发布到 GitHub Pages。

也可在 Actions 页手动触发（`workflow_dispatch`）。

### 手动同步

```bash
# 一行搞定（拉 SVG + 生成所有产物）
pnpm icons:all

# 拆开看每步
pnpm icons:sync --dry      # 干跑，只打印变更
pnpm icons:sync            # 拉 SVG → public/raw-svg/
pnpm icons:sync --prune    # 顺手删掉 Figma 已不存在的图标
pnpm icons:build           # 生成 React 组件 + registry.json
pnpm registry:build        # = icons:build + shadcn build（也写 public/r/*.json）
```

需要环境变量：

```env
FIGMA_TOKEN=figd_xxxxxxxxxxxxxxxxxxxxxx
FIGMA_FILE_KEY=ev0bf5CFakLPC2XGt7FftG
FIGMA_NODE_ID=256:3152
```

放到 `.env.local`（已 gitignore）后用 `pnpm dlx dotenv -e .env.local -- pnpm icons:all`，或直接 `export`。

### 添加非 Figma 图标（应急用）

把 SVG 直接丢进 `public/raw-svg/<PascalCase>.svg`（24×24，stroke 用 `#000`），跑 `pnpm registry:build`。**注意**：下次定时同步若开了 `--prune`，这个图标会被 Figma 视为孤儿删掉。所以正确做法仍然是先在 Figma 加 component。

## Figma 端约定

- 文件 key（URL 里 `/design/<KEY>/`）：写到 secret `FIGMA_FILE_KEY`
- 扫描根：用 node id（URL 里 `?node-id=256-3152`，写到 variable `FIGMA_NODE_ID` 时换成 `256:3152` 或 `256-3152`，脚本两种都接受）
  - 推荐用 node id 而不是 page name：精确指向"标准版本"那个 frame，避免扫到同 page 下的旧版/草稿 component
- 该 node 下所有 `COMPONENT` / `COMPONENT_SET` 都视为图标
- component 命名 PascalCase（`AZ8/Icon/Model3D` 也接受，脚本只取最后一段）
- 描边色用 `#000` / `black`，构建时替换为 `currentColor`，让消费方用 Tailwind `text-*` 控色

## 目录结构

```
public/raw-svg/<Name>.svg      ← 源 SVG（自动同步，勿手改）
registry/
  lib/icon-base.tsx            ← IconBase 容器（权威源，所有图标依赖它）
  icons/Icon<Name>.tsx         ← 编译产物（shadcn add 拉这里）
components/icons/Icon<Name>.tsx ← 仓库内 docs 站使用的镜像（自动生成）
app/                           ← Next.js 文档站
public/r/*.json                ← shadcn build 产物（消费方实际下载这个）
registry.json                  ← 自动生成，勿手改
scripts/
  sync-figma.ts                ← Figma → SVG
  build-icons.ts               ← SVG → 组件 + registry items
.github/workflows/
  sync-figma.yml               ← 每天定时同步
  deploy.yml                   ← push main 自动发布到 Pages
```

## 一次性配置

### Figma token + 仓库 secrets

1. 打开 https://www.figma.com → 头像 → Settings → Security
2. "Personal access tokens" → Generate new token
3. 权限只勾 **File content (read-only)**
4. 在仓库 Settings → Secrets and variables → Actions：
   - Secret `FIGMA_TOKEN` ← 上面生成的 token
   - Secret `FIGMA_FILE_KEY` ← Figma 文件 URL 里的 `<KEY>`
   - Variable `FIGMA_NODE_ID` ← 标准版本 frame 的 node id（如 `256:3152`）

### GitHub Pages

1. 仓库 Settings → Pages → Source 选 **GitHub Actions**
2. 编辑 `.github/workflows/deploy.yml`，把 `PAGES_URL` 改成你的实际地址：
   - 不绑域名：`https://<owner>.github.io/<repo>`（默认是 `https://everfir.github.io/az8-design-system`）
   - 绑自定义域名：`https://ui.az8.design`，同时把 `BASE_PATH` 留空
3. push `main` 触发部署

每个 registry item 的 `registryDependencies` 里嵌入了完整 URL（如 `icon-add` 依赖 `<PAGES_URL>/r/icon-base.json`）。这些 URL 在构建期写死，**换域名必须 rebuild**。

### 不用 GitHub Pages 也行

shadcn registry 本质是静态 JSON 文件，任何能托管静态文件 + 提供 HTTPS 的平台都能跑：Vercel / Cloudflare Pages / Netlify / S3+CDN。换平台时改 `REGISTRY_BASE_URL` 重 build 即可。

## 本地预览

```bash
# 启动 dev
pnpm dev                         # http://localhost:3000

# 用本地 URL 重新构建 registry items（让 registryDependencies 指向 localhost）
REGISTRY_BASE_URL=http://localhost:3000 pnpm registry:build

# 在另一个项目里测安装
npx shadcn@latest add http://localhost:3000/r/icon-add.json
```

## 路线图

- [x] Icons：58 个 + 自动同步
- [ ] Theme tokens（颜色 / 排版 / 间距）作为 `registry:theme`
- [ ] Buttons / Forms / Layout primitives
- [ ] Figma Variables 直接同步成 CSS 变量
