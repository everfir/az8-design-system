import { type CSSProperties, type HTMLAttributes } from "react"
import { type IconProps } from "@/components/icons/icon-base"
import { cn } from "@/lib/utils"

const sizeClass: Record<NonNullable<IconProps["size"]>, string> = {
  sm: "size-3.5",
  md: "size-4",
  lg: "size-5",
  xl: "size-6",
}

// 24px 基准：外径 18px、线宽 1.5px、端点圆直径 1.5px。
// 全部用百分比表达，确保 size 变化时线宽和端点一起缩放。
const ringInset = "12.5%"
const ringMask =
  "radial-gradient(farthest-side, transparent 83.333333%, #000 83.333333%)"
const capSize = "6.25%"
const capLeft = "46.875%"
const capTop = "81.25%"
const gradient = "conic-gradient(from 180deg, currentColor 0deg, transparent 360deg)"

export function IconLoading({
  className,
  size,
  style,
  ...props
}: IconProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "relative inline-block shrink-0",
        size ? sizeClass[size] : "size-4",
        className,
      )}
      style={
        {
          ...style,
        } as CSSProperties
      }
      {...(props as HTMLAttributes<HTMLSpanElement>)}
    >
      <span
        aria-hidden="true"
        className="absolute rounded-full"
        style={{
          inset: ringInset,
          color: "inherit",
          background: gradient,
          mask: ringMask,
          WebkitMask: ringMask,
        }}
      />
      <span
        aria-hidden="true"
        className="absolute rounded-full"
        style={{
          width: capSize,
          height: capSize,
          left: capLeft,
          top: capTop,
          color: "inherit",
          backgroundColor: "currentColor",
        }}
      />
    </span>
  )
}

IconLoading.displayName = "IconLoading"
