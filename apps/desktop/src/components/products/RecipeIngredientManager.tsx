import { useState, useMemo } from 'react'
import { Trash2, Search, Utensils } from 'lucide-react'
import { Product, RecipeIngredient } from '@/services/products.service'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'

interface RecipeIngredientManagerProps {
    ingredients: Partial<RecipeIngredient>[]
    onIngredientsChange: (ingredients: Partial<RecipeIngredient>[]) => void
    onSearchProduct: (query: string) => Promise<Product[]>
}

export function RecipeIngredientManager({
    ingredients,
    onIngredientsChange,
    onSearchProduct,
}: RecipeIngredientManagerProps) {
    const [searchQuery, setSearchQuery] = useState('')
    const [searchResults, setSearchResults] = useState<Product[]>([])
    const [isSearching, setIsSearching] = useState(false)

    const handleSearch = async (query: string) => {
        setSearchQuery(query)
        if (query.length < 2) {
            setSearchResults([])
            return
        }
        setIsSearching(true)
        try {
            const results = await onSearchProduct(query)
            setSearchResults(results)
        } finally {
            setIsSearching(false)
        }
    }

    const addIngredient = (product: Product) => {
        if (ingredients.some(i => i.ingredient_product_id === product.id)) return

        const newIngredient: Partial<RecipeIngredient> = {
            ingredient_product_id: product.id,
            ingredient_product: product,
            qty: 1,
            unit: product.is_weight_product ? (product.weight_unit || 'kg') : 'unidad',
        }
        onIngredientsChange([...ingredients, newIngredient])
        setSearchQuery('')
        setSearchResults([])
    }

    const removeIngredient = (productId: string) => {
        onIngredientsChange(ingredients.filter(i => i.ingredient_product_id !== productId))
    }

    const updateQty = (productId: string, qty: number) => {
        onIngredientsChange(
            ingredients.map(i =>
                i.ingredient_product_id === productId ? { ...i, qty } : i
            )
        )
    }

    const totalCostUsd = useMemo(() => {
        return ingredients.reduce((total, i) => {
            const cost = Number(i.ingredient_product?.cost_usd || 0)
            return total + (cost * (i.qty || 0))
        }, 0)
    }, [ingredients])

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Utensils className="w-5 h-5 text-primary" />
                    <h3 className="text-lg font-semibold">Ingredientes de la Receta</h3>
                </div>
                <Badge variant="outline" className="text-sm">
                    Costo Total: ${totalCostUsd.toFixed(2)}
                </Badge>
            </div>

            <div className="relative">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                        placeholder="Buscar producto para añadir..."
                        value={searchQuery}
                        onChange={(e) => handleSearch(e.target.value)}
                        className="pl-9"
                    />
                    {isSearching && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                            <div className="animate-spin w-4 h-4 border-2 border-primary border-t-transparent rounded-full" />
                        </div>
                    )}
                </div>

                {searchResults.length > 0 && (
                    <Card className="absolute z-10 w-full mt-1 shadow-lg max-h-60 overflow-auto">
                        <CardContent className="p-0">
                            {searchResults.map((product) => (
                                <button
                                    key={product.id}
                                    onClick={() => addIngredient(product)}
                                    className="w-full text-left px-4 py-2 hover:bg-accent flex items-center justify-between"
                                >
                                    <span className="font-medium">{product.name}</span>
                                    <span className="text-xs text-muted-foreground">${product.cost_usd}</span>
                                </button>
                            ))}
                        </CardContent>
                    </Card>
                )}
            </div>

            <div className="space-y-2">
                {ingredients.length === 0 ? (
                    <p className="text-sm text-center text-muted-foreground py-4 border border-dashed rounded-lg">
                        No hay ingredientes añadidos. Busque uno arriba para comenzar.
                    </p>
                ) : (
                    ingredients.map((ingredient) => (
                        <div
                            key={ingredient.ingredient_product_id}
                            className="flex items-center gap-4 p-3 border rounded-lg bg-card"
                        >
                            <div className="flex-1">
                                <p className="font-medium">{ingredient.ingredient_product?.name}</p>
                                <p className="text-xs text-muted-foreground">
                                    Costo unit: ${ingredient.ingredient_product?.cost_usd}
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <Input
                                    type="number"
                                    value={ingredient.qty}
                                    onChange={(e) => updateQty(ingredient.ingredient_product_id!, Number(e.target.value))}
                                    className="w-20 h-8"
                                    min={0}
                                    step={0.001}
                                />
                                <span className="text-sm text-muted-foreground w-12">
                                    {ingredient.unit || 'uds'}
                                </span>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-destructive"
                                    onClick={() => removeIngredient(ingredient.ingredient_product_id!)}
                                >
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    )
}
