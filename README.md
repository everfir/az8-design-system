# az8-ui

AZ8 设计系统。基于 shadcn/ui registry v3，每一个图标 / 组件都可以被 `npx shadcn add` 直接装进任意项目。

## 当前 Section

- **Icons** — 自研 SVG 图标库。源 SVG 放在 `public/raw-svg/`，由 `scripts/build-icons.ts` 编译成 React 组件并注入 `registry.json`。

## 工作流

### 添加新图标（手动）

1. 把 SVG 放到 `public/raw-svg/<name>.svg`（建议 24×24，描边色用 `#000`，会自动替换为 `currentColor`）
2. 跑 `pnpm icons:build`
   - 生成 `registry/icons/icon-<name>.tsx`（权威源，`shadcn add` 拉这个）
   - 镜像到 `components/icons/icon-<name>.tsx`（本仓库 docs 站使用）
   - 重写 `registry.json`
3. 跑 `pnpm shadcn build` 把 registry items 编译到 `public/r/*.json`（生产部署 / 本地预览都需要）

一行命令： `pnpm registry:build`（= icons:build + shadcn build）

### 从 Figma 同步（推荐）

设计稿改动后，跑一行：

```bash
pnpm icons:all          # = icons:sync + icons:build
```

或拆开看效果：

```bash
pnpm icons:sync --dry   # 干跑，看会增加/更新哪些
pnpm icons:sync         # 实际写入 public/raw-svg/
pnpm icons:sync --prune # 同步并删除 Figma 已不存在的图标
pnpm icons:build        # 重新生成组件 + registry.json
```

**首次配置**（一次性）：

1. **生成 Figma token**
   - 打开 https://www.figma.com → 头像 → Settings → Security
   - "Personal access tokens" → Generate new token
   - 权限只勾 **File content (read-only)**
   - 复制 token

2. **找文件 key**
   - 打开你的 Figma 文件，URL 形如：`https://www.figma.com/design/<KEY>/<title>?node-id=...`
   - 取 `<KEY>` 那一段（22 位字符）

3. **本地配置**：在项目根建 `.env.local`（已被 .gitignore 排除）

   ```env
   FIGMA_TOKEN=figd_xxxxxxxxxxxx
   FIGMA_FILE_KEY=ev0bf5CFakLPC2XGt7FftG
   # FIGMA_PAGE_NAME=Icons    # 默认就是 Icons，不写也行
   ```

   然后 `pnpm dlx dotenv -e .env.local -- pnpm icons:sync`，或把变量直接 `export` 出来。

4. **CI 配置**：仓库 Settings → Secrets and variables → Actions：
   - Secret `FIGMA_TOKEN`
   - Secret `FIGMA_FILE_KEY`
   - （可选）Variable `FIGMA_PAGE_NAME`

   配好之后 `.github/workflows/sync-figma.yml` 默认每周一自动跑一次，把变动以 PR 形式提给你 review。也可在 Actions 页手动触发。

**Figma 文件约定**：

- 必须有一个 page 叫 `Icons`（或你自己设 `FIGMA_PAGE_NAME` 指定）
- 该 page 下所有 component 都被当作图标
- component 名字会被 kebab-case 化（`Arrow Right` → `arrow-right`）
- 描边色用 `#000` 或 `black`，构建时会替换为 `currentColor`，让消费方用 Tailwind `text-*` 控色

### 本地预览 + 自测

```bash
# 1. 启动 dev
pnpm dev                         # http://localhost:3000

# 2. 用本地 URL 重新构建 registry items（生产部署时不需要）
REGISTRY_BASE_URL=http://localhost:3000 pnpm registry:build

# 3. 在另一个项目里安装
npx shadcn@latest add http://localhost:3000/r/icon-arrow-right.json
```

### 生产部署

部署到 Vercel / Cloudflare Pages，把 `REGISTRY_BASE_URL` 设成最终公网 URL（默认 `https://az8.design`）。
详见下文 "部署"。

## 目录约定

```
public/raw-svg/             ← 源 SVG（手画 / Figma 导出）
registry/
  lib/icon-base.tsx         ← IconBase 容器（权威源）
  icons/icon-*.tsx          ← 编译产物（权威源，shadcn add 拉这里）
components/icons/           ← 本仓库内部使用的镜像（自动生成）
app/                        ← 文档站
public/r/*.json             ← shadcn build 产物
registry.json               ← 自动生成，勿手改
scripts/build-icons.ts      ← 生成全流程
```

## API

```tsx
import { IconArrowRight } from "@/components/icons/icon-arrow-right"

<IconArrowRight />                                  // 默认 size-4
<IconArrowRight size="lg" />                        // size-5
<IconArrowRight className="size-8 text-primary" />  // 完全自定义
```

`IconBase` 暴露的 props：所有 `SVGProps<SVGSVGElement>` + 一个语义化 `size?: 'sm' | 'md' | 'lg' | 'xl'`。颜色用 `currentColor`，跟随 Tailwind `text-*`。

## 部署 — GitHub Pages

仓库自带 `.github/workflows/deploy.yml`，push 到 `main` 会自动构建并发布到 GitHub Pages。

**首次设置（一次性）**：

1. 在 GitHub 创建仓库，把项目推上去
2. 仓库 Settings → Pages → Source 选 **GitHub Actions**
3. 编辑 `.github/workflows/deploy.yml` 把 `PAGES_URL` 改成你的实际地址：
   - 不绑域名：`https://<owner>.github.io/az8-design-system`
   - 绑自定义域名：`https://ui.az8.design`，同时把 `BASE_PATH` 留空
4. push 触发部署，等 Actions 跑完即可访问

**为什么需要 `PAGES_URL` / `REGISTRY_BASE_URL`**：每个 registry item 的 `registryDependencies` 里嵌入了完整 URL（例如 `icon-arrow-right` 依赖 `<PAGES_URL>/r/icon-base.json`）。这些 URL 是构建期写死的，**换域名必须 rebuild**，所以正式发布前定下来。

**绑自定义域名**：在 Settings → Pages 加 CNAME 记录，同时改 workflow 里的 `BASE_PATH=""` 和 `PAGES_URL=https://your-domain`。

### 不用 GitHub Pages 也行

shadcn registry 本质是静态 JSON 文件，任何能托管静态文件 + 给 HTTPS URL 的地方都能跑：Vercel / Cloudflare Pages / Netlify / S3+CDN。换平台时只需改 `REGISTRY_BASE_URL` 重新构建即可。

## 路线图

- [x] Icons section
- [ ] 接 Figma API 自动同步 SVG
- [ ] Buttons / Forms / Layout primitives
- [ ] Theme tokens（颜色 / 排版）作为 `registry:theme`
