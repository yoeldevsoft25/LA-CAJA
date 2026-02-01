import { motion, HTMLMotionProps } from "framer-motion"
import { ReactNode } from "react"

interface MotionWrapperProps extends HTMLMotionProps<"div"> {
    children: ReactNode
}

/**
 * FadeInUp: Standard entrance animation for cards and sections
 */
export const FadeInUp = ({ children, className, ...props }: MotionWrapperProps) => (
    <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className={className}
        {...props}
    >
        {children}
    </motion.div>
)

/**
 * StaggerContainer: Parent for staggered list animations
 */
export const StaggerContainer = ({ children, delay = 0.1, ...props }: MotionWrapperProps & { delay?: number }) => (
    <motion.div
        initial="hidden"
        animate="show"
        variants={{
            hidden: { opacity: 0 },
            show: {
                opacity: 1,
                transition: {
                    staggerChildren: delay,
                },
            },
        }}
        {...props}
    >
        {children}
    </motion.div>
)

/**
 * StaggerItem: Child for staggered list animations
 */
export const StaggerItem = ({ children, className, ...props }: MotionWrapperProps) => (
    <motion.div
        variants={{
            hidden: { opacity: 0, y: 10 },
            show: { opacity: 1, y: 0 },
        }}
        transition={{ duration: 0.3 }}
        className={className}
        {...props}
    >
        {children}
    </motion.div>
)

/**
 * TapFeedback: Wrapper for elements that should react to touch/clicks
 */
export const TapFeedback = ({ children, className, ...props }: MotionWrapperProps) => (
    <motion.div
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.98 }}
        transition={{ type: "spring", stiffness: 400, damping: 17 }}
        className={className}
        {...props}
    >
        {children}
    </motion.div>
)
