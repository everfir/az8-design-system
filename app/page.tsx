import Link from "next/link"
import { ArrowRight } from "lucide-react"

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-svh max-w-3xl flex-col gap-12 px-6 py-16">
      <header className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <span className="text-foreground text-2xl font-semibold tracking-tight">
            AZ8
          </span>
          <span className="text-sm tracking-wider text-muted-foreground uppercase">
            / design system
          </span>
        </div>
        <h1 className="text-4xl font-semibold tracking-tight">az8-ui</h1>
        <p className="text-muted-foreground max-w-xl">
          AZ8 设计系统的 shadcn/ui 兼容 registry。每个图标 / 组件都可被{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-sm">
            npx shadcn add
          </code>{" "}
          直接安装到任意项目。
        </p>
      </header>

      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-medium tracking-wide text-muted-foreground uppercase">
          Sections
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          <li>
            <Link
              href="/icons"
              className="group flex items-center justify-between rounded-lg border bg-card p-4 transition hover:border-foreground"
            >
              <div className="flex flex-col gap-1">
                <span className="font-medium">Icons</span>
                <span className="text-sm text-muted-foreground">
                  品牌图标库（自研 SVG）
                </span>
              </div>
              <ArrowRight
                className="size-5 text-muted-foreground transition group-hover:translate-x-1 group-hover:text-foreground"
              />
            </Link>
          </li>
        </ul>
      </section>

      <footer className="mt-auto text-xs text-muted-foreground">
        Tailwind v4 · Next.js 15 · shadcn registry v3
      </footer>
    </main>
  )
}
