import { Skeleton } from "./skeleton"
import { StaggerContainer, StaggerItem } from "./motion-wrapper"

export function InventorySkeleton() {
    return (
        <StaggerContainer className="p-4 space-y-6">
            <StaggerItem className="flex items-center justify-between">
                <Skeleton className="h-10 w-[200px] rounded-lg" />
                <Skeleton className="h-10 w-[120px] rounded-lg" />
            </StaggerItem>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...Array(6)].map((_, i) => (
                    <StaggerItem key={i} className="p-5 border border-border/60 bg-card/30 rounded-2xl space-y-4 shadow-sm">
                        <Skeleton className="h-40 w-full rounded-xl" />
                        <div className="space-y-2">
                            <Skeleton className="h-5 w-3/4 rounded-md" />
                            <Skeleton className="h-4 w-1/2 rounded-md" />
                        </div>
                    </StaggerItem>
                ))}
            </div>
        </StaggerContainer>
    )
}

export function SalesSkeleton() {
    return (
        <StaggerContainer className="p-4 space-y-4">
            <StaggerItem>
                <Skeleton className="h-12 w-full rounded-xl" />
            </StaggerItem>

            <div className="space-y-3">
                {[...Array(8)].map((_, i) => (
                    <StaggerItem key={i} className="flex items-center justify-between p-4 border border-border/40 rounded-xl bg-card/20 shadow-sm">
                        <div className="flex items-center gap-4">
                            <Skeleton className="size-12 rounded-2xl" />
                            <div className="space-y-2">
                                <Skeleton className="h-4 w-40 rounded-md" />
                                <Skeleton className="h-3 w-24 rounded-md" />
                            </div>
                        </div>
                        <Skeleton className="h-8 w-20 rounded-lg" />
                    </StaggerItem>
                ))}
            </div>
        </StaggerContainer>
    )
}

export function ReportSkeleton() {
    return (
        <StaggerContainer className="p-6 space-y-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => (
                    <StaggerItem key={i} className="p-4 border border-border/60 rounded-2xl bg-card/30 shadow-sm">
                        <Skeleton className="h-4 w-24 mb-3 rounded-md" />
                        <Skeleton className="h-10 w-20 rounded-lg" />
                    </StaggerItem>
                ))}
            </div>

            <StaggerItem>
                <Skeleton className="h-[350px] w-full rounded-3xl" />
            </StaggerItem>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <StaggerItem>
                    <Skeleton className="h-[250px] w-full rounded-2xl" />
                </StaggerItem>
                <StaggerItem>
                    <Skeleton className="h-[250px] w-full rounded-2xl" />
                </StaggerItem>
            </div>
        </StaggerContainer>
    )
}
