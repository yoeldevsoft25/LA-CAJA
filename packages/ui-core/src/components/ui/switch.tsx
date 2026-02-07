import * as React from "react"
import * as SwitchPrimitives from "@radix-ui/react-switch"

import { cn } from "../../lib/utils"

const Switch = React.forwardRef<
    React.ElementRef<typeof SwitchPrimitives.Root>,
    React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
    <SwitchPrimitives.Root
        className={cn(
            "peer inline-flex h-7 w-14 shrink-0 cursor-pointer items-center rounded-full p-[2px] transition-all duration-300 ease-in-out",
            "data-[state=checked]:bg-primary data-[state=unchecked]:bg-slate-200 dark:data-[state=unchecked]:bg-slate-700",
            "data-[state=checked]:shadow-lg data-[state=checked]:shadow-primary/25",
            "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20",
            "active:scale-95 disabled:cursor-not-allowed disabled:opacity-50",
            className
        )}
        {...props}
        ref={ref}
    >
        <SwitchPrimitives.Thumb
            className={cn(
                "pointer-events-none block h-[24px] w-[24px] rounded-full bg-white shadow-md ring-0 transition-all duration-300 ease-in-out",
                "data-[state=unchecked]:translate-x-0 data-[state=checked]:translate-x-[28px]"
            )}
        />
    </SwitchPrimitives.Root>
))
Switch.displayName = SwitchPrimitives.Root.displayName

export { Switch }
