"use client"

import { useState } from "react"
import { CheckIcon, CopyIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { LoadingPreview, jsxInnerToHtml, type IconMeta } from "./icons-browser"

export function IconDetail({
  icon,
  baseUrl,
}: {
  icon: IconMeta
  baseUrl: string
}) {
  const installCmd = `npx shadcn@latest add ${baseUrl}/r/${icon.registryName}.json`
  const importStmt = `import { ${icon.componentName} } from "@/components/icons/${icon.registryName}"`
  const usageJsx = `<${icon.componentName} size="md" className="text-primary" />`
  const standaloneSvg = renderStandaloneSvg(icon)

  return (
    <div className="flex flex-1 flex-col gap-6 p-4">
      {/* 亮 / 暗 双栏预览 —— 强制各自的主题，独立于全局 toggle */}
      <div className="grid grid-cols-2 gap-2">
        <ThemeFrame
          mode="light"
          inner={icon.inner}
          viewBox={icon.viewBox}
          preview={icon.preview}
        />
        <ThemeFrame
          mode="dark"
          inner={icon.inner}
          viewBox={icon.viewBox}
          preview={icon.preview}
        />
      </div>

      <Block label="安装" content={installCmd} />
      <Block label="Import" content={importStmt} />
      <Block label="用法" content={usageJsx} />
      <Block label="SVG" content={standaloneSvg} multiline />
    </div>
  )
}

function ThemeFrame({
  mode,
  inner,
  viewBox,
  preview,
}: {
  mode: "light" | "dark"
  inner: string
  viewBox: string
  preview?: IconMeta["preview"]
}) {
  // 预览框用具体色而非主题变量，确保两边在任何全局主题下都呈现各自的对比
  const isDark = mode === "dark"
  return (
    <div
      className={cn(
        "flex aspect-square flex-col items-center justify-center gap-2 rounded-lg border",
        isDark
          ? "border-zinc-800 bg-zinc-950 text-zinc-50"
          : "border-zinc-200 bg-white text-zinc-900",
      )}
    >
      {preview === "loading" ? (
        <LoadingPreview size={48} />
      ) : (
        <svg
          viewBox={viewBox}
          width={48}
          height={48}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          dangerouslySetInnerHTML={{ __html: jsxInnerToHtml(inner) }}
        />
      )}
      <span
        className={cn(
          "text-[10px] uppercase tracking-wider",
          isDark ? "text-zinc-500" : "text-zinc-400",
        )}
      >
        {mode}
      </span>
    </div>
  )
}

function Block({
  label,
  content,
  multiline,
}: {
  label: string
  content: string
  multiline?: boolean
}) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
          {label}
        </span>
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard.writeText(content)
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
          }}
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs transition"
        >
          {copied ? (
            <>
              <CheckIcon className="size-3" /> 已复制
            </>
          ) : (
            <>
              <CopyIcon className="size-3" /> 复制
            </>
          )}
        </button>
      </div>
      <pre
        className={cn(
          "bg-muted overflow-x-auto rounded-md p-3 font-mono text-xs",
          multiline ? "whitespace-pre" : "whitespace-pre-wrap break-all",
        )}
      >
        {content}
      </pre>
    </div>
  )
}

/** 拼出独立可粘贴使用的 SVG 字符串，颜色保持图标节点自身声明。 */
function renderStandaloneSvg(icon: IconMeta): string {
  if (icon.preview === "loading") {
    return `<IconLoading size="xl" className="text-primary" />`
  }

  const inner = jsxInnerToHtml(icon.inner)
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${icon.viewBox}" width="24" height="24" fill="none" stroke-linecap="round" stroke-linejoin="round">
  ${inner}
</svg>`
}
