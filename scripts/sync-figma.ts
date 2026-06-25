/**
 * 从 Figma 文件拉取图标 → public/raw-svg/<name>.svg
 *
 * 扫描根的两种模式（二选一，FIGMA_NODE_ID 优先）：
 *   1. 按 node id：FIGMA_NODE_ID 指向一个 frame/section/page，从它开始递归收集
 *      所有 COMPONENT / COMPONENT_SET。推荐用法，能精确指向"标准版本"那个 frame，
 *      避免把同 page 下的旧版/草稿 component 也带进来。
 *   2. 按 page 名：FIGMA_PAGE_NAME（默认 "Icons"），从该 page 整体扫。
 *
 * component 的名字就是图标名。脚本会：
 *   - 取 "/" 之后最后一段作为图标名（兼容 "AZ8/Icon/Add" 这类带前缀的命名）
 *   - 做 kebab-case 归一化
 *
 * 环境变量：
 *   FIGMA_TOKEN     必填。Personal Access Token。
 *                   生成入口：Figma → Settings → Security → Personal access tokens
 *                   只需勾选 File content (read-only)
 *   FIGMA_FILE_KEY  必填。Figma 文件 key。
 *                   从 URL https://www.figma.com/design/<KEY>/<title> 中抠出 <KEY>
 *   FIGMA_NODE_ID   可选。指定扫描根 node id，如 "256:3152"。URL 里的 256-3152 形式也能识别。
 *   FIGMA_PAGE_NAME 可选。默认 "Icons"。仅在没设 FIGMA_NODE_ID 时生效。
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
const NAMING_REPORT = path.join(ROOT, "figma-icon-naming-issues.json");

/**
 * Figma 命名标准：component 名形如 "AZ8/Icon/<PascalCase>"。
 * 末段必须匹配 PascalCase（首字母大写、纯字母数字、无空格 / 连字符 / 下划线 /
 * 多级路径）。不符合的项不影响同步流程，但会在 sync 末尾输出原始命名清单，
 * 供设计侧统一修复。
 */
const PASCAL_RE = /^[A-Z][A-Za-z0-9]*$/;

function isStandardName(rawName: string) {
  const segs = rawName.split("/").filter(Boolean);
  if (segs.length > 3) return false;
  const last = segs[segs.length - 1]?.trim() ?? "";
  return PASCAL_RE.test(last);
}

const FIGMA_TOKEN = process.env.FIGMA_TOKEN;
const FIGMA_FILE_KEY = process.env.FIGMA_FILE_KEY;
const FIGMA_PAGE_NAME = process.env.FIGMA_PAGE_NAME ?? "Icons";
// Figma URL 里 node-id 用 `-` 分隔（256-3152），API 里用 `:`（256:3152），两种都接受
const FIGMA_NODE_ID = process.env.FIGMA_NODE_ID?.replace(/-/g, ":");

const args = new Set(process.argv.slice(2));
const DRY = args.has("--dry");
const PRUNE = args.has("--prune");

const ICON_COMPONENT_OVERRIDE_NAMES = new Set(["loading"]);

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

/**
 * Figma component 名 → 工程侧权威名。
 *
 * 规则极简：取 "/" 后最后一段、去掉非法字符，保留 PascalCase 不变。
 *   "AZ8/Icon/Model3D"             → "Model3D"
 *   "AZ8/Icon/StoryboardGrid25"    → "StoryboardGrid25"
 *
 * 不拆词、不归一化大小写。设计师在 Figma 写的就是工程里 import 的：
 *   import { IconModel3D } from "@/components/icons"
 *
 * 文件名也直接用它（如 IconModel3D.tsx）。registry slug（CLI 用的小写 id）
 * 在 build-icons 里再统一小写化，那是另一回事。
 */
function normalizeName(rawName: string) {
  const last = rawName.split("/").pop() ?? "";
  // 只保留字母数字，剔除空格 / 标点；首字符若是数字就加下划线占位（避免 IconBase 写不出 component 名）
  const cleaned = last.trim().replace(/[^A-Za-z0-9]/g, "");
  if (!cleaned) return "";
  return /^[0-9]/.test(cleaned) ? `_${cleaned}` : cleaned;
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

  let rootNode: FigmaNode;
  let rootLabel: string;

  if (FIGMA_NODE_ID) {
    // 模式 1：按 node id。/v1/files/<KEY>/nodes 返回的就是以这个 node 为根的子树
    console.log(
      `📄 fetching file ${FIGMA_FILE_KEY} node ${FIGMA_NODE_ID} ...`,
    );
    const data = await figma<{
      name: string;
      nodes: Record<string, { document: FigmaNode } | null>;
    }>(
      `https://api.figma.com/v1/files/${FIGMA_FILE_KEY}/nodes?ids=${encodeURIComponent(FIGMA_NODE_ID)}&depth=4`,
    );
    console.log(`   file: "${data.name}"`);
    const entry = data.nodes[FIGMA_NODE_ID];
    assert(
      entry?.document,
      `在文件里找不到 node "${FIGMA_NODE_ID}"。请检查 FIGMA_NODE_ID 是否正确（URL 里的 node-id=256-3152 对应 256:3152）`,
    );
    rootNode = entry.document;
    rootLabel = `node "${rootNode.name}" (${FIGMA_NODE_ID})`;
  } else {
    // 模式 2：按 page name 兜底
    console.log(`📄 fetching file ${FIGMA_FILE_KEY} ...`);
    const file = await figma<FileResponse>(
      `https://api.figma.com/v1/files/${FIGMA_FILE_KEY}?depth=4`,
    );
    console.log(`   file: "${file.name}"`);
    const page = findPage(file.document, FIGMA_PAGE_NAME);
    assert(
      page,
      `在文件里找不到名为 "${FIGMA_PAGE_NAME}" 的 page。请检查 Figma 文件里是否有这个 page，或设置 FIGMA_PAGE_NAME / FIGMA_NODE_ID`,
    );
    rootNode = page;
    rootLabel = `page "${FIGMA_PAGE_NAME}"`;
  }

  const icons = collectIcons(rootNode);
  assert(
    icons.length > 0,
    `${rootLabel} 里没有 COMPONENT。请把图标转成 component（选中 → ⌥⌘K）`,
  );

  // 命名标准检查：不阻塞同步，仅把不符合标准的原始命名输出给设计侧
  const nonstandard = icons
    .filter((it) => !isStandardName(it.name))
    .map((it) => it.name)
    .sort();
  const namingReport = {
    rule: 'Figma component 名必须形如 "AZ8/Icon/<PascalCase>"',
    total: icons.length,
    standard: icons.length - nonstandard.length,
    nonstandard: nonstandard.length,
    names: nonstandard,
  };
  if (!DRY) {
    await writeFile(
      NAMING_REPORT,
      JSON.stringify(namingReport, null, 2) + "\n",
      "utf8",
    );
  }
  console.log(
    `🔎 naming: ${namingReport.standard}/${namingReport.total} 规范，${namingReport.nonstandard} 个待修复${
      DRY ? "" : ` → ${path.relative(ROOT, NAMING_REPORT)}`
    }`,
  );
  for (const name of nonstandard) console.log(`   • ${name}`);

  // 同名冲突：去掉非法字符后大小写敏感地比较
  const byName = new Map<string, { id: string; rawName: string }>();
  for (const it of icons) {
    const name = normalizeName(it.name);
    if (!name) {
      console.warn(`   ⚠ 跳过空名 component (id=${it.id})`);
      continue;
    }
    if (ICON_COMPONENT_OVERRIDE_NAMES.has(name.toLowerCase())) {
      console.log(`   ◆ 跳过组件覆盖图标 "${name}"，使用工程侧覆盖组件`);
      continue;
    }
    if (byName.has(name)) {
      console.warn(
        `   ⚠ 名字冲突: "${it.name}" 和 "${byName.get(name)!.rawName}" 都映射为 "${name}"，用前者`,
      );
      continue;
    }
    byName.set(name, { id: it.id, rawName: it.name });
  }

  console.log(`🎯 found ${byName.size} icons in ${rootLabel}`);

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
  // 在 case-insensitive 的 APFS / Windows 文件系统上，"add.svg" 和 "Add.svg" 是同一个文件。
  // 没有这个映射的话：会先 writeFile("Add.svg") 实际覆写 "add.svg" 但保留原 case；
  // 紧接着 prune 把不在 written 集合里的 "add.svg" 当孤儿删掉，刚写好的内容就没了。
  const existingByLower = new Map<string, string>(
    [...existing].map((f) => [f.toLowerCase(), f]),
  );

  const tasks: Array<Promise<void>> = [];
  const written = new Set<string>();
  let added = 0;
  let updated = 0;

  for (const [name, meta] of byName) {
    const url = images.images[meta.id];
    if (!url) {
      console.warn(`   ⚠ "${name}" 没拿到 SVG URL，跳过`);
      continue;
    }
    const filename = `${name}.svg`;
    written.add(filename);

    tasks.push(
      (async () => {
        const r = await fetch(url);
        if (!r.ok) {
          console.warn(`   ⚠ 下载失败 ${name}: ${r.status}`);
          return;
        }
        const svg = await r.text();
        const target = path.join(RAW_DIR, filename);

        const existingCase = existingByLower.get(filename.toLowerCase());
        const isNew = !existingCase;
        const caseChanged = existingCase && existingCase !== filename;

        if (DRY) {
          console.log(
            `   ${isNew ? "+" : caseChanged ? "↻" : "~"} ${filename}${caseChanged ? `  (was ${existingCase})` : ""}`,
          );
          if (isNew) added++;
          else updated++;
          return;
        }

        // case 变化时（add.svg → Add.svg）必须先 unlink，否则 case-insensitive
        // 文件系统会保留旧 case 当做覆写，prune 会把这个文件错杀
        if (caseChanged) {
          await unlink(path.join(RAW_DIR, existingCase!)).catch(() => {});
        }
        await writeFile(target, svg, "utf8");
        if (isNew) {
          added++;
          console.log(`   + ${filename}`);
        } else if (caseChanged) {
          updated++;
          console.log(`   ↻ ${existingCase} → ${filename}`);
        } else {
          updated++;
        }
      })(),
    );
  }

  await Promise.all(tasks);

  // prune：Figma 删了的图标本地也删
  // 用大小写不敏感比对：写入阶段已经把 case 变更（add.svg → Add.svg）当 update 处理掉了，
  // 这里只清理"在 Figma 完全找不到对应名字"的真孤儿
  const writtenLower = new Set([...written].map((f) => f.toLowerCase()));
  let removed = 0;
  if (PRUNE) {
    for (const f of existing) {
      if (
        ICON_COMPONENT_OVERRIDE_NAMES.has(
          f.replace(/\.svg$/i, "").toLowerCase(),
        )
      ) {
        continue;
      }
      if (!writtenLower.has(f.toLowerCase())) {
        if (DRY) {
          console.log(`   - ${f}`);
        } else {
          await unlink(path.join(RAW_DIR, f)).catch(() => {});
        }
        removed++;
      }
    }
  } else {
    const orphans = [...existing].filter(
      (f) =>
        !writtenLower.has(f.toLowerCase()) &&
        !ICON_COMPONENT_OVERRIDE_NAMES.has(
          f.replace(/\.svg$/i, "").toLowerCase(),
        ),
    );
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
