import { readFile } from "node:fs/promises"
import path from "node:path"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"
import { IconsBrowser, type IconMeta } from "./icons-browser"

export const dynamic = "force-static"

interface RegistryItem {
  name: string
  type: string
}

async function loadIcons(): Promise<IconMeta[]> {
  const [registryRaw, metaRaw] = await Promise.all([
    readFile(path.join(process.cwd(), "registry.json"), "utf8"),
    readFile(
      path.join(process.cwd(), "components/icons-meta.json"),
      "utf8",
    ),
  ])
  const registry = JSON.parse(registryRaw) as { items: RegistryItem[] }
  const meta = JSON.parse(metaRaw) as { icons: IconMeta[] }

  // 用 registry items 顺序作为权威排序（registry.json 里是字母序）
  const inRegistry = new Set(
    registry.items
      .filter((i) => i.name.startsWith("icon-") && i.name !== "icon-base")
      .map((i) => i.name),
  )
  return meta.icons.filter((i) => inRegistry.has(i.registryName))
}

export default async function IconsPage() {
  const icons = await loadIcons()
  const baseUrl =
    process.env.NEXT_PUBLIC_REGISTRY_BASE_URL?.replace(/\/$/, "") ||
    "http://localhost:3000"

  return (
    <main className="mx-auto flex min-h-svh max-w-6xl flex-col gap-8 px-6 py-10">
      <div className="flex items-start justify-between gap-4">
        <Link
          href="/"
          className="text-muted-foreground hover:text-foreground flex w-fit items-center gap-1.5 text-sm"
        >
          <ArrowLeft className="size-4" />
          Back
        </Link>
        <ThemeToggle />
      </div>

      <header className="flex flex-col gap-3">
        <span className="text-muted-foreground text-sm tracking-wider uppercase">
          az8-ui / icons
        </span>
        <h1 className="text-3xl font-semibold tracking-tight">Icon Library</h1>
        <p className="text-muted-foreground max-w-2xl">
          {icons.length} 个图标。搜索、切换尺寸、点击查看详情与复制选项。
        </p>
      </header>

      <IconsBrowser icons={icons} baseUrl={baseUrl} />
    </main>
  )
}
