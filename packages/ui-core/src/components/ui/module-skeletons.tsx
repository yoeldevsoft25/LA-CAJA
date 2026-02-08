import { Skeleton } from "./skeleton"
import { cn } from "../../lib/utils"

export function InventorySkeleton() {
    return (
        <div className="space-y-4 p-4">
            <div className="flex items-center justify-between">
                <Skeleton className="h-8 w-[150px]" />
                <Skeleton className="h-8 w-[100px]" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[...Array(6)].map((_, i) => (
                    <div key={i} className="p-4 border border-border rounded-[var(--radius)] space-y-3">
                        <Skeleton className="h-32 w-full" />
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-4 w-1/2" />
                    </div>
                ))}
            </div>
        </div>
    )
}

export function SalesSkeleton() {
    return (
        <div className="space-y-4 p-4">
            <Skeleton className="h-10 w-full" />
            <div className="space-y-2">
                {[...Array(8)].map((_, i) => (
                    <div key={i} className="flex items-center justify-between p-3 border-b border-border/50">
                        <div className="flex items-center gap-3">
                            <Skeleton className="size-10 rounded-full" />
                            <div className="space-y-1">
                                <Skeleton className="h-4 w-32" />
                                <Skeleton className="h-3 w-20" />
                            </div>
                        </div>
                        <Skeleton className="h-6 w-16" />
                    </div>
                ))}
            </div>
        </div>
    )
}

export function ReportSkeleton() {
    return (
        <div className="space-y-6 p-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => (
                    <div key={i} className="p-4 border border-border rounded-[var(--radius)]">
                        <Skeleton className="h-4 w-24 mb-2" />
                        <Skeleton className="h-8 w-16" />
                    </div>
                ))}
            </div>
            <Skeleton className="h-[300px] w-full rounded-[var(--radius)]" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Skeleton className="h-[200px] w-full" />
                <Skeleton className="h-[200px] w-full" />
            </div>
        </div>
    )
}
