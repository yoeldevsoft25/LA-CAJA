import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * Magic UI - Shine Border
 * https://magicui.design/docs/components/shine-border
 */

interface ShineBorderProps extends React.HTMLAttributes<HTMLDivElement> {
    borderRadius?: number
    borderWidth?: number
    duration?: number
    shineColor?: string | string[]
    children: React.ReactNode
}

export function ShineBorder({
    borderRadius = 12,
    borderWidth = 1,
    duration = 14,
    shineColor = "#000000",
    className,
    children,
}: ShineBorderProps) {
    return (
        <div
            style={
                {
                    "--border-radius": `${borderRadius}px`,
                } as React.CSSProperties
            }
            className={cn(
                "relative min-h-[60px] w-fit min-w-[300px] place-items-center rounded-[var(--border-radius)] bg-white p-3 text-black dark:bg-black dark:text-white",
                className,
            )}
        >
            <div
                style={
                    {
                        "--border-width": `${borderWidth}px`,
                        "--duration": `${duration}s`,
                        "--mask-linear-gradient": `linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)`,
                        "--background-radial-gradient": `radial-gradient(transparent,transparent, ${Array.isArray(shineColor) ? shineColor.join(",") : shineColor
                            },transparent,transparent)`,
                    } as React.CSSProperties
                }
                className={`before:bg-shining-gradient pointer-events-none before:absolute before:inset-0 before:size-full before:rounded-[var(--border-radius)] before:p-[var(--border-width)] before:will-change-[background-position] before:content-[""] before:![-webkit-mask-composite:xor] before:![mask-composite:exclude] before:[-webkit-mask:var(--mask-linear-gradient)] before:[mask:var(--mask-linear-gradient)]`}
            ></div>
            {children}
        </div>
    )
}
