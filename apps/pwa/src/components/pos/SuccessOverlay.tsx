"use client"

import { motion, AnimatePresence } from "framer-motion"
import { Check } from "lucide-react"
import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"

interface SuccessOverlayProps {
    isOpen: boolean
    onAnimationComplete?: () => void
    message?: string
}

export function SuccessOverlay({
    isOpen,
    onAnimationComplete,
    message = "¡Venta Procesada!"
}: SuccessOverlayProps) {
    // Generar partículas aleatorias solo una vez al montar o abrir
    const [particles, setParticles] = useState<Array<{ x: number; y: number; color: string; size: number }>>([])

    useEffect(() => {
        if (isOpen) {
            // Generar 20 partículas con distribución radial
            const newParticles = Array.from({ length: 20 }).map(() => {
                const angle = Math.random() * Math.PI * 2
                const distance = Math.random() * 100 + 80 // Radio de explosión
                return {
                    x: Math.cos(angle) * distance,
                    y: Math.sin(angle) * distance,
                    color: Math.random() > 0.5 ? "bg-primary" : (Math.random() > 0.5 ? "bg-white" : "bg-primary/60"),
                    size: Math.random() * 4 + 2
                }
            })
            setParticles(newParticles)

            const timer = setTimeout(() => {
                onAnimationComplete?.()
            }, 2800) // Un poco más largo para disfrutar la animación
            return () => clearTimeout(timer)
        }
    }, [isOpen, onAnimationComplete])

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0, transition: { duration: 0.5 } }}
                    className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none"
                >
                    {/* Fondo Backdrop Luminoso */}
                    <div className="absolute inset-0 bg-white/60 backdrop-blur-xl pointer-events-auto" />

                    {/* Spotlight de fondo sutil */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: 1, scale: 1.5 }}
                        className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(var(--primary),0.15)_0,transparent_70%)] pointer-events-none"
                    />

                    {/* Radial Sweep Beam */}
                    <motion.div
                        initial={{ rotate: 0, opacity: 0 }}
                        animate={{ rotate: 360, opacity: [0, 0.5, 0] }}
                        transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                        className="absolute inset-0 bg-[conic-gradient(from_0deg,transparent_0,rgba(var(--primary),0.1)_20deg,transparent_40deg)] pointer-events-none"
                    />

                    <div className="relative flex flex-col items-center justify-center p-8 z-10 w-full max-w-sm mx-4 pointer-events-none">

                        {/* Contenedor Principal de la Animación */}
                        <div className="relative mb-10 pointer-events-auto">
                            {/* Partículas (Colores vibrantes sobre blanco) */}
                            {particles.map((p, i) => (
                                <motion.div
                                    key={i}
                                    initial={{ x: 0, y: 0, scale: 0, opacity: 0 }}
                                    animate={{
                                        x: p.x,
                                        y: p.y,
                                        scale: [0, 1, 0],
                                        opacity: [0, 1, 0]
                                    }}
                                    transition={{
                                        duration: 1.2,
                                        ease: "easeOut",
                                        delay: 0.3
                                    }}
                                    className={cn("absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full shadow-sm", p.color)}
                                    style={{ width: p.size, height: p.size }}
                                />
                            ))}

                            {/* Círculo Glow Detrás (Azul suave) */}
                            <motion.div
                                initial={{ scale: 0, opacity: 0 }}
                                animate={{ scale: [0.8, 1.2, 1], opacity: [0, 0.4, 0.2] }}
                                transition={{ duration: 2, repeat: Infinity, repeatType: "reverse" }}
                                className="absolute inset-0 -m-8 bg-primary/20 rounded-full blur-2xl"
                            />

                            {/* Botón/Círculo del Check */}
                            <motion.div
                                initial={{ scale: 0, rotate: -90 }}
                                animate={{ scale: 1, rotate: 0 }}
                                transition={{
                                    type: "spring",
                                    stiffness: 260,
                                    damping: 20,
                                    delay: 0.1
                                }}
                                className="relative flex items-center justify-center w-28 h-28 rounded-full bg-primary shadow-[0_20px_40px_-5px_hsl(var(--primary)/0.4)] border-4 border-white overflow-hidden"
                            >
                                {/* Lens Flare Effect */}
                                <motion.div
                                    animate={{ x: [-100, 200] }}
                                    transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 2 }}
                                    className="absolute inset-0 w-1/2 h-full bg-gradient-to-r from-transparent via-white/40 to-transparent -skew-x-45"
                                />

                                <motion.div
                                    initial={{ pathLength: 0, opacity: 0, scale: 0.5 }}
                                    animate={{ pathLength: 1, opacity: 1, scale: 1 }}
                                    transition={{ duration: 0.4, delay: 0.35, ease: "backOut" }}
                                >
                                    <Check className="w-14 h-14 text-white drop-shadow-md stroke-[4px]" />
                                </motion.div>
                            </motion.div>
                        </div>

                        {/* Tarjeta Glassmorphism Blanca */}
                        <motion.div
                            initial={{ y: 20, opacity: 0, scale: 0.95 }}
                            animate={{ y: 0, opacity: 1, scale: 1 }}
                            transition={{ delay: 0.5, type: "spring", stiffness: 150 }}
                            className="relative overflow-hidden rounded-2xl bg-white/80 backdrop-blur-md border border-white/60 p-6 w-full text-center shadow-xl shadow-slate-200/50 pointer-events-auto"
                        >
                            <div className="absolute inset-0 bg-gradient-to-b from-white/40 to-transparent pointer-events-none" />

                            <h2 className="text-2xl font-bold tracking-tight text-slate-800 mb-1">
                                ¡Venta Exitosa!
                            </h2>

                            <div className="flex items-center justify-center gap-2 mt-2">
                                <span className={cn(
                                    "px-3 py-1 rounded-full text-sm font-bold tracking-wider shadow-sm border",
                                    message?.includes('OFFLINE')
                                        ? "bg-amber-50 border-amber-100 text-amber-700"
                                        : "bg-primary/10 border-primary/20 text-primary"
                                )}>
                                    {message?.includes('OFFLINE') ? 'ALMACENADO OFFLINE' : (message?.includes('#') ? message.split('#')[1].split(' ')[0] : 'PROCESADO')}
                                </span>
                            </div>

                            <p className="mt-4 text-sm text-slate-500 font-medium leading-relaxed">
                                {message?.includes('OFFLINE')
                                    ? 'La venta se ha guardado localmente y se sincronizará cuando retorne la conexión.'
                                    : 'La transacción ha sido registrada correctamente en el sistema.'}
                            </p>
                        </motion.div>

                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}
