import { useState, useEffect, useRef } from 'react'

/**
 * useSmoothLoading
 * 
 * Ensures that a loading state lasts for at least a minimum duration
 * to prevent visual flickering of skeletons/loaders.
 * 
 * @param isLoading The raw loading state (e.g. from useQuery)
 * @param minDuration Minimum duration in milliseconds (default: 800ms)
 * @returns A boolean representing the "smoothed" loading state
 */
export function useSmoothLoading(isLoading: boolean, minDuration: number = 800): boolean {
    const [smoothLoading, setSmoothLoading] = useState(isLoading)
    const startTimeRef = useRef<number | null>(null)
    const timeoutRef = useRef<NodeJS.Timeout | null>(null)

    useEffect(() => {
        // When raw loading starts
        if (isLoading) {
            if (timeoutRef.current) clearTimeout(timeoutRef.current)
            startTimeRef.current = Date.now()
            setSmoothLoading(true)
        }
        // When raw loading ends
        else if (smoothLoading) {
            const currentTime = Date.now()
            const startTime = startTimeRef.current ?? currentTime
            const elapsed = currentTime - startTime
            const remaining = Math.max(0, minDuration - elapsed)

            if (remaining > 0) {
                timeoutRef.current = setTimeout(() => {
                    setSmoothLoading(false)
                    startTimeRef.current = null
                }, remaining)
            } else {
                setSmoothLoading(false)
                startTimeRef.current = null
            }
        }

        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current)
        }
    }, [isLoading, minDuration, smoothLoading])

    return smoothLoading
}
