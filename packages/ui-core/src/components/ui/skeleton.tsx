import { motion, HTMLMotionProps } from "framer-motion"
import { cn } from "../../lib/utils"

function Skeleton({
    className,
    ...props
}: HTMLMotionProps<"div">) {
    return (
        <motion.div
            animate={{
                opacity: [0.5, 1, 0.5],
            }}
            transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut",
            }}
            className={cn("rounded-md bg-muted", className)}
            {...props}
        />
    )
}

export { Skeleton }
