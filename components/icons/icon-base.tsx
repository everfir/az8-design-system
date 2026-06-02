import { forwardRef, type SVGProps } from "react"
import { cn } from "@/lib/utils"

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, "ref"> {
  /**
   * 图标尺寸的语义化别名。
   * - 'sm' = 14px / 'md' = 16px / 'lg' = 20px / 'xl' = 24px
   * 直接传 className="size-5" 也可以，二者择一即可。
   */
  size?: "sm" | "md" | "lg" | "xl"
}

const sizeClass: Record<NonNullable<IconProps["size"]>, string> = {
  sm: "size-3.5",
  md: "size-4",
  lg: "size-5",
  xl: "size-6",
}

export const IconBase = forwardRef<SVGSVGElement, IconProps>(function IconBase(
  { className, size, viewBox = "0 0 24 24", children, ...props },
  ref,
) {
  return (
    <svg
      ref={ref}
      viewBox={viewBox}
      // 默认 fill="none"：避免没声明 fill 的 path 被 SVG 默认黑填充
      // 但**不**外层声明 stroke / strokeWidth：
      //   - 全 fill 形状（占主流，az8 当前 58 个图标里大多数）只设 fill="currentColor"，外层不该叠加 stroke 一圈描边
      //   - 含真 stroke 的混合 icon（如 Add.svg 里的圆圈）path 自身已带 stroke 和 stroke-width，外层不要覆盖
      // 之前外层硬塞 stroke="currentColor" + strokeWidth=1.5，会让纯 fill 的 path 多套一圈 1.5px 描边，
      // 这是"看着比 Figma 粗"的根因。
      // strokeLinecap/Linejoin 给 round 是无害兜底，对显式带 stroke 的子 path 改善端点视觉。
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={cn(
        "shrink-0",
        size ? sizeClass[size] : "size-4",
        className,
      )}
      {...props}
    >
      {children}
    </svg>
  )
})
