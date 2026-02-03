import { Button } from '@la-caja/ui-core'
import { cn } from '@la-caja/ui-core'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useRef, useEffect, useState } from 'react'

interface CategoryTabsProps {
  categories: string[]
  selectedCategory: string | null
  onSelectCategory: (category: string | null) => void
}

export default function CategoryTabs({
  categories,
  selectedCategory,
  onSelectCategory,
}: CategoryTabsProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [showLeftArrow, setShowLeftArrow] = useState(false)
  const [showRightArrow, setShowRightArrow] = useState(false)

  const checkScrollButtons = () => {
    if (!scrollContainerRef.current) return
    const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current
    setShowLeftArrow(scrollLeft > 0)
    setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 10)
  }

  useEffect(() => {
    checkScrollButtons()
    const container = scrollContainerRef.current
    if (container) {
      container.addEventListener('scroll', checkScrollButtons)
      window.addEventListener('resize', checkScrollButtons)
      return () => {
        container.removeEventListener('scroll', checkScrollButtons)
        window.removeEventListener('resize', checkScrollButtons)
      }
    }
  }, [categories])

  const scroll = (direction: 'left' | 'right') => {
    if (!scrollContainerRef.current) return
    const scrollAmount = 200
    scrollContainerRef.current.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    })
  }

  return (
    <div className="relative w-full overflow-hidden mb-2 px-3 sm:px-0">
      {/* Botón izquierdo con glassmorphism - optimizado para móvil */}
      {showLeftArrow && (
        <button
          onClick={() => scroll('left')}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-background/90 backdrop-blur-md rounded-full p-1.5 sm:p-2 shadow-xl active:bg-background border border-border/50 active:scale-95 transition-all duration-300 touch-manipulation min-h-[36px] min-w-[36px]"
          aria-label="Scroll izquierda"
        >
          <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>
      )}

      {/* Contenedor scrollable */}
      <div
        ref={scrollContainerRef}
        className="flex gap-2 sm:gap-3 overflow-x-auto px-1 sm:px-2 py-2 sm:py-3 scroll-smooth [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] w-full touch-pan-x"
      >
        <Button
          variant={selectedCategory === null ? 'default' : 'outline'}
          size="lg"
          onClick={() => onSelectCategory(null)}
          className={cn(
            'shrink-0 px-4 sm:px-6 py-2.5 sm:py-3 text-sm sm:text-base font-bold rounded-full transition-all duration-300',
            'backdrop-blur-sm border-2',
            'touch-manipulation min-h-[40px] sm:min-h-[44px]',
            selectedCategory === null
              ? 'bg-primary text-primary-foreground shadow-lg active:shadow-xl scale-105 border-primary/50'
              : 'active:bg-primary/10 active:scale-105 border-border/50 active:border-primary/30'
          )}
        >
          Todas
        </Button>
        {categories.map((category) => (
          <Button
            key={category}
            variant={selectedCategory === category ? 'default' : 'outline'}
            size="lg"
            onClick={() => onSelectCategory(category)}
            className={cn(
              'shrink-0 px-4 sm:px-6 py-2.5 sm:py-3 text-sm sm:text-base font-bold rounded-full transition-all duration-300',
              'backdrop-blur-sm border-2',
              'touch-manipulation min-h-[40px] sm:min-h-[44px]',
              selectedCategory === category
                ? 'bg-primary text-primary-foreground shadow-lg active:shadow-xl scale-105 border-primary/50'
                : 'active:bg-primary/10 active:scale-105 border-border/50 active:border-primary/30'
            )}
          >
            <span className="whitespace-nowrap">{category}</span>
          </Button>
        ))}
      </div>

      {/* Botón derecho con glassmorphism - optimizado para móvil */}
      {showRightArrow && (
        <button
          onClick={() => scroll('right')}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-background/90 backdrop-blur-md rounded-full p-1.5 sm:p-2 shadow-xl active:bg-background border border-border/50 active:scale-95 transition-all duration-300 touch-manipulation min-h-[36px] min-w-[36px]"
          aria-label="Scroll derecha"
        >
          <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>
      )}
    </div>
  )
}
