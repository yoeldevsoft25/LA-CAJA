import * as React from "react"
import { cn } from "../../lib/utils"

/**
 * Magic UI - Shine Border
 */
interface ShineBorderProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'color'> {
    borderRadius?: number
    borderWidth?: number
    duration?: number
    color?: string | string[]
    children: React.ReactNode
}

export function ShineBorder({
    borderRadius,
    borderWidth = 1,
    duration = 14,
    color = "hsl(var(--primary))",
    className,
    children,
}: ShineBorderProps) {
    return (
        <div
            style={
                {
                    "--border-radius": borderRadius ? `${borderRadius}px` : `var(--radius)`,
                } as React.CSSProperties
            }
            className={cn(
                "relative w-full rounded-[var(--border-radius)] p-[2px] text-black dark:text-white",
                className,
            )}
        >
            <div
                style={
                    {
                        "--border-width": `${borderWidth}px`,
                        "--duration": `${duration}s`,
                        "--mask-linear-gradient": `linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)`,
                        "--background-radial-gradient": `radial-gradient(transparent,transparent, ${Array.isArray(color) ? color.join(",") : color
                            },transparent,transparent)`,
                    } as React.CSSProperties
                }
                className={`before:bg-shining-gradient pointer-events-none before:absolute before:inset-0 before:size-full before:rounded-[var(--border-radius)] before:p-[var(--border-width)] before:will-change-[background-position] before:content-[""] before:![-webkit-mask-composite:xor] before:![mask-composite:exclude] before:[-webkit-mask:var(--mask-linear-gradient)] before:[mask:var(--mask-linear-gradient)]`}
            ></div>
            {children}
        </div>
    )
}
