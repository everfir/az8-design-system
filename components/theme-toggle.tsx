"use client"

import { useTheme } from "next-themes"
import { useEffect, useState } from "react"
import { MoonIcon, SunIcon } from "lucide-react"
import { cn } from "@/lib/utils"

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  // 避免水合不匹配：服务端不知道客户偏好
  useEffect(() => setMounted(true), [])

  const isDark = mounted && resolvedTheme === "dark"

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "切换到亮色" : "切换到暗色"}
      className={cn(
        "inline-flex size-9 items-center justify-center rounded-md border bg-background transition hover:bg-accent",
        className,
      )}
    >
      {mounted ? (
        isDark ? (
          <MoonIcon className="size-4" />
        ) : (
          <SunIcon className="size-4" />
        )
      ) : (
        // 占位：避免水合时尺寸跳动
        <span className="size-4" />
      )}
    </button>
  )
}
