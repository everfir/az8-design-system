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
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
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
