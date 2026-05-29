/**
 * 从 Figma 文件拉取图标 → public/raw-svg/<name>.svg
 *
 * 约定：
 *   - Figma 文件里有一个名为 "Icons" 的 page
 *   - 该 page 下所有 COMPONENT / COMPONENT_SET 都视为图标
 *   - component 的名字就是图标名（脚本会做 kebab-case 归一化）
 *
 * 环境变量：
 *   FIGMA_TOKEN     必填。Personal Access Token。
 *                   生成入口：Figma → Settings → Security → Personal access tokens
 *                   只需勾选 File content (read-only)
 *   FIGMA_FILE_KEY  必填。Figma 文件 key。
 *                   从 URL https://www.figma.com/design/<KEY>/<title> 中抠出 <KEY>
 *   FIGMA_PAGE_NAME 可选。默认 "Icons"。
 *
 * 使用：
 *   pnpm icons:sync           # 拉取 + 同步本地
 *   pnpm icons:sync --dry     # 只打印要做的变更，不写盘
 *   pnpm icons:sync --prune   # 同步时删除 Figma 已不存在的图标
 *
 * 拉完接 pnpm icons:build 即可。
 */
import { readdir, writeFile, unlink, mkdir } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(__dirname, "..");
const RAW_DIR = path.join(ROOT, "public/raw-svg");

const FIGMA_TOKEN = process.env.FIGMA_TOKEN;
const FIGMA_FILE_KEY = process.env.FIGMA_FILE_KEY;
const FIGMA_PAGE_NAME = process.env.FIGMA_PAGE_NAME ?? "Icons";

const args = new Set(process.argv.slice(2));
const DRY = args.has("--dry");
const PRUNE = args.has("--prune");

interface FigmaNode {
  id: string;
  name: string;
  type: string;
  children?: FigmaNode[];
}

interface FileResponse {
  document: { children: FigmaNode[] };
  name: string;
}

interface ImagesResponse {
  err: string | null;
  images: Record<string, string>;
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) {
    console.error(`\n❌ ${msg}\n`);
    process.exit(1);
  }
}

async function figma<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { "X-Figma-Token": FIGMA_TOKEN! },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Figma API ${res.status} ${url}\n${body}`);
  }
  return (await res.json()) as T;
}

function toKebab(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[\s_/]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/** 在文档树里找指定名字的 page。Figma 顶层 children 都是 CANVAS（即 page） */
function findPage(doc: FileResponse["document"], pageName: string) {
  return doc.children.find(
    (n) => n.type === "CANVAS" && n.name === pageName,
  );
}

/** 递归收集 page 下所有 COMPONENT / COMPONENT_SET */
function collectIcons(
  node: FigmaNode,
  acc: Array<{ id: string; name: string }> = [],
) {
  // COMPONENT_SET 通常代表 variants（如 size=24/16），目前只取 set 自己的名字
  // 如果以后要按 variant 拆，把这里换成遍历它的 children
  if (node.type === "COMPONENT" || node.type === "COMPONENT_SET") {
    acc.push({ id: node.id, name: node.name });
    return acc;
  }
  for (const child of node.children ?? []) collectIcons(child, acc);
  return acc;
}

async function main() {
  assert(FIGMA_TOKEN, "缺少环境变量 FIGMA_TOKEN");
  assert(FIGMA_FILE_KEY, "缺少环境变量 FIGMA_FILE_KEY");

  console.log(`📄 fetching file ${FIGMA_FILE_KEY} ...`);
  // depth=4 通常足够覆盖 page → frame/section → component_set → component
  // 如果你的图标埋得更深，调大或去掉 depth 参数
  const file = await figma<FileResponse>(
    `https://api.figma.com/v1/files/${FIGMA_FILE_KEY}?depth=4`,
  );
  console.log(`   file: "${file.name}"`);

  const page = findPage(file.document, FIGMA_PAGE_NAME);
  assert(
    page,
    `在文件里找不到名为 "${FIGMA_PAGE_NAME}" 的 page。请检查 Figma 文件里是否有这个 page，或设置 FIGMA_PAGE_NAME`,
  );

  const icons = collectIcons(page!);
  assert(
    icons.length > 0,
    `page "${FIGMA_PAGE_NAME}" 里没有 COMPONENT。请把图标转成 component（选中 → ⌥⌘K）`,
  );

  // 处理同名（kebab 归一化后）冲突
  const byName = new Map<string, { id: string; rawName: string }>();
  for (const it of icons) {
    const kebab = toKebab(it.name);
    if (!kebab) {
      console.warn(`   ⚠ 跳过空名 component (id=${it.id})`);
      continue;
    }
    if (byName.has(kebab)) {
      console.warn(
        `   ⚠ 名字冲突: "${it.name}" 和 "${byName.get(kebab)!.rawName}" 都映射为 "${kebab}"，用前者`,
      );
      continue;
    }
    byName.set(kebab, { id: it.id, rawName: it.name });
  }

  console.log(`🎯 found ${byName.size} icons in page "${FIGMA_PAGE_NAME}"`);

  // Figma /v1/images 一次最多支持几百个 ids，单批就够
  const ids = [...byName.values()].map((v) => v.id);
  console.log(`🖼  requesting SVG render URLs ...`);
  const images = await figma<ImagesResponse>(
    `https://api.figma.com/v1/images/${FIGMA_FILE_KEY}?ids=${ids.join(",")}&format=svg&svg_simplify_stroke=true`,
  );
  assert(!images.err, `Figma /images 出错: ${images.err}`);

  await mkdir(RAW_DIR, { recursive: true });
  const existing = new Set(
    (await readdir(RAW_DIR)).filter((f) => f.endsWith(".svg")),
  );

  const tasks: Array<Promise<void>> = [];
  const written = new Set<string>();
  let added = 0;
  let updated = 0;

  for (const [kebab, meta] of byName) {
    const url = images.images[meta.id];
    if (!url) {
      console.warn(`   ⚠ "${kebab}" 没拿到 SVG URL，跳过`);
      continue;
    }
    const filename = `${kebab}.svg`;
    written.add(filename);

    tasks.push(
      (async () => {
        const r = await fetch(url);
        if (!r.ok) {
          console.warn(`   ⚠ 下载失败 ${kebab}: ${r.status}`);
          return;
        }
        const svg = await r.text();
        const target = path.join(RAW_DIR, filename);

        const isNew = !existing.has(filename);
        // 只比较 Figma 这次的产物和磁盘上的差异，实际写入由 dry 控制
        if (DRY) {
          console.log(`   ${isNew ? "+" : "~"} ${filename}`);
          if (isNew) added++;
          else updated++;
          return;
        }
        await writeFile(target, svg, "utf8");
        if (isNew) {
          added++;
          console.log(`   + ${filename}`);
        } else {
          updated++;
          // 不打印 unchanged 噪音，但 updated 计数会包含 "字节相同的覆写"
        }
      })(),
    );
  }

  await Promise.all(tasks);

  // prune：Figma 删了的图标本地也删
  let removed = 0;
  if (PRUNE) {
    for (const f of existing) {
      if (!written.has(f)) {
        if (DRY) {
          console.log(`   - ${f}`);
        } else {
          await unlink(path.join(RAW_DIR, f));
        }
        removed++;
      }
    }
  } else {
    const orphans = [...existing].filter((f) => !written.has(f));
    if (orphans.length > 0) {
      console.log(
        `\n   ℹ ${orphans.length} 个本地 SVG 在 Figma 已不存在（加 --prune 自动删除）：`,
      );
      for (const o of orphans) console.log(`     - ${o}`);
    }
  }

  console.log(
    `\n✅ ${DRY ? "[dry] " : ""}sync done · added ${added} · updated ${updated}${PRUNE ? ` · removed ${removed}` : ""}`,
  );
  console.log(`\n下一步：pnpm icons:build`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
