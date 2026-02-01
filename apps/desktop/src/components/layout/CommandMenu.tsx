import * as React from "react"
import { useNavigate } from "react-router-dom"
import {
    CreditCard,
    ShoppingCart,
    Zap,
    Package,
    Boxes,
    Users,
    BarChart3,
} from "lucide-react"

import {
    CommandDialog,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator,
    CommandShortcut,
} from "@/components/ui/command"

export function CommandMenu() {
    const [open, setOpen] = React.useState(false)
    const navigate = useNavigate()

    React.useEffect(() => {
        const down = (e: KeyboardEvent) => {
            if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                setOpen((open) => !open)
            }
        }

        document.addEventListener("keydown", down)
        return () => document.removeEventListener("keydown", down)
    }, [])

    const runCommand = React.useCallback((command: () => void) => {
        setOpen(false)
        command()
    }, [])

    return (
        <CommandDialog open={open} onOpenChange={setOpen}>
            <CommandInput placeholder="Type a command or search..." />
            <CommandList>
                <CommandEmpty>No results found.</CommandEmpty>
                <CommandGroup heading="Ventas">
                    <CommandItem onSelect={() => runCommand(() => navigate("/app/pos"))}>
                        <ShoppingCart className="mr-2 h-4 w-4" />
                        <span>Punto de Venta (POS)</span>
                        <CommandShortcut>⌘P</CommandShortcut>
                    </CommandItem>
                    <CommandItem onSelect={() => runCommand(() => navigate("/app/fast-checkout"))}>
                        <Zap className="mr-2 h-4 w-4" />
                        <span>Caja Rápida</span>
                    </CommandItem>
                    <CommandItem onSelect={() => runCommand(() => navigate("/app/sales"))}>
                        <CreditCard className="mr-2 h-4 w-4" />
                        <span>Ver Ventas</span>
                    </CommandItem>
                </CommandGroup>
                <CommandSeparator />
                <CommandGroup heading="Inventario">
                    <CommandItem onSelect={() => runCommand(() => navigate("/app/products"))}>
                        <Package className="mr-2 h-4 w-4" />
                        <span>Productos</span>
                    </CommandItem>
                    <CommandItem onSelect={() => runCommand(() => navigate("/app/inventory"))}>
                        <Boxes className="mr-2 h-4 w-4" />
                        <span>Control de Stock</span>
                    </CommandItem>
                </CommandGroup>
                <CommandSeparator />
                <CommandGroup heading="Otros">
                    <CommandItem onSelect={() => runCommand(() => navigate("/app/reports"))}>
                        <BarChart3 className="mr-2 h-4 w-4" />
                        <span>Reportes y Gráficos</span>
                    </CommandItem>
                    <CommandItem onSelect={() => runCommand(() => navigate("/app/customers"))}>
                        <Users className="mr-2 h-4 w-4" />
                        <span>Gestión de Clientes</span>
                    </CommandItem>
                </CommandGroup>
            </CommandList>
        </CommandDialog>
    )
}
