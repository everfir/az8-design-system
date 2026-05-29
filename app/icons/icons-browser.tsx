"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { SearchIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { IconDetail } from "./icon-detail"

export interface IconMeta {
  registryName: string
  componentName: string
  viewBox: string
  /** JSX 形式的 SVG 内部，例：`<path d="..." strokeWidth={1.5} />` */
  inner: string
}

const SIZES = [16, 20, 24, 32] as const
type Size = (typeof SIZES)[number]

export function IconsBrowser({
  icons,
  baseUrl,
}: {
  icons: IconMeta[]
  baseUrl: string
}) {
  const [query, setQuery] = useState("")
  const [size, setSize] = useState<Size>(24)
  const [selected, setSelected] = useState<IconMeta | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Cmd/Ctrl + K 聚焦搜索；Esc 清空
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        inputRef.current?.focus()
        inputRef.current?.select()
      }
      if (e.key === "Escape" && document.activeElement === inputRef.current) {
        setQuery("")
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return icons
    return icons.filter(
      (i) =>
        i.registryName.toLowerCase().includes(q) ||
        i.componentName.toLowerCase().includes(q),
    )
  }, [query, icons])

  return (
    <>
      {/* 工具栏（搜索 + 尺寸切换）：sticky 跟随滚动 */}
      <div className="bg-background/80 sticky top-0 z-10 -mx-6 flex flex-col gap-3 border-b px-6 py-3 backdrop-blur sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <SearchIcon className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索图标…"
            className="border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring h-10 w-full rounded-md border pl-9 pr-16 text-sm focus-visible:ring-1 focus-visible:outline-none"
            // 自动聚焦让用户进入页面就能搜索
            autoFocus
          />
          <kbd className="text-muted-foreground border-input pointer-events-none absolute top-1/2 right-2 hidden -translate-y-1/2 rounded border px-1.5 py-0.5 text-[10px] font-medium sm:inline-block">
            ⌘K
          </kbd>
        </div>

        <div className="flex items-center gap-1 rounded-md border p-1">
          {SIZES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSize(s)}
              className={cn(
                "h-7 rounded px-2 text-xs font-medium transition",
                s === size
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* 图标网格 */}
      {filtered.length === 0 ? (
        <div className="text-muted-foreground flex flex-col items-center gap-2 py-20 text-sm">
          <span>没有匹配 &quot;{query}&quot; 的图标</span>
          <button
            type="button"
            onClick={() => setQuery("")}
            className="text-foreground underline-offset-4 hover:underline"
          >
            清除搜索
          </button>
        </div>
      ) : (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
          {filtered.map((icon) => (
            <li key={icon.registryName}>
              <button
                type="button"
                onClick={() => setSelected(icon)}
                className="group bg-card hover:border-foreground hover:bg-accent flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-lg border p-2 transition"
                aria-label={`查看 ${icon.componentName}`}
              >
                <SvgPreview
                  inner={icon.inner}
                  viewBox={icon.viewBox}
                  size={size}
                />
                <span className="text-muted-foreground group-hover:text-foreground line-clamp-1 text-[10px] transition">
                  {icon.registryName.replace(/^icon-/, "")}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="text-muted-foreground text-xs">
        共 {filtered.length} / {icons.length} 个图标
      </p>

      {/* 详情侧边栏 */}
      <Sheet
        open={!!selected}
        onOpenChange={(open) => !open && setSelected(null)}
      >
        <SheetContent
          side="right"
          className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-md"
        >
          {selected ? (
            <>
              <SheetHeader className="border-b">
                <SheetTitle className="font-mono text-base">
                  {selected.componentName}
                </SheetTitle>
                <SheetDescription className="font-mono text-xs">
                  {selected.registryName}
                </SheetDescription>
              </SheetHeader>
              <IconDetail icon={selected} baseUrl={baseUrl} />
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  )
}

/** 把 meta JSON 里的 JSX 字符串作为 SVG 渲染。
 *  注意：inner 来自我们自己 build 阶段的产物，不存在 XSS 风险。 */
function SvgPreview({
  inner,
  viewBox,
  size,
  className,
}: {
  inner: string
  viewBox: string
  size: number
  className?: string
}) {
  // 把 React JSX 形式的 attribute（如 width={18}、strokeWidth={1.5}）转成 HTML 形式
  const html = jsxInnerToHtml(inner)
  return (
    <svg
      viewBox={viewBox}
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={cn("text-foreground", className)}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

/** JSX 内部 → HTML 字符串。覆盖项目当前 SVG 实际用到的属性。 */
export function jsxInnerToHtml(jsx: string): string {
  return (
    jsx
      // {N} → "N"，{1.5} → "1.5"
      .replace(/=\{([^}]+)\}/g, (_, v) => `="${String(v).trim()}"`)
      // 驼峰 → 短横线（仅 SVG 常见属性）
      .replace(/strokeWidth=/g, "stroke-width=")
      .replace(/strokeLinecap=/g, "stroke-linecap=")
      .replace(/strokeLinejoin=/g, "stroke-linejoin=")
      .replace(/strokeDasharray=/g, "stroke-dasharray=")
      .replace(/strokeMiterlimit=/g, "stroke-miterlimit=")
      .replace(/fillRule=/g, "fill-rule=")
      .replace(/clipRule=/g, "clip-rule=")
      .replace(/clipPath=/g, "clip-path=")
  )
}
