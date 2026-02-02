import * as React from "react"
import * as SwitchPrimitives from "@radix-ui/react-switch"

import { cn } from "@/lib/utils"

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cn(
      // Switch con proporciones premium (estilo iOS/Flowbite mejorado)
      // h-7 (28px) y w-14 (56px) para ese look "estirado" solicitado
      "peer inline-flex h-7 w-14 shrink-0 cursor-pointer items-center rounded-full p-[2px] transition-all duration-300 ease-in-out",
      // Colores y sombras
      "data-[state=checked]:bg-primary data-[state=unchecked]:bg-slate-200 dark:data-[state=unchecked]:bg-slate-700",
      "data-[state=checked]:shadow-lg data-[state=checked]:shadow-primary/25",
      // Focus
      "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20",
      // Feedback táctil
      "active:scale-95 disabled:cursor-not-allowed disabled:opacity-50",
      className
    )}
    {...props}
    ref={ref}
  >
    <SwitchPrimitives.Thumb
      className={cn(
        // Tamaño del círculo blanco ajustado (24px)
        // Ocupa casi todo el alto (28px - 4px de padding total = 24px)
        "pointer-events-none block h-[24px] w-[24px] rounded-full bg-white shadow-md ring-0 transition-all duration-300 ease-in-out",
        // Recorrido calculado para el ancho de 56px:
        // Ancho total (56) - Thumb (24) - Paddings (4) = 28px de movimiento
        "data-[state=unchecked]:translate-x-0 data-[state=checked]:translate-x-[28px]"
      )}
    />
  </SwitchPrimitives.Root>
))
Switch.displayName = SwitchPrimitives.Root.displayName

export { Switch }
