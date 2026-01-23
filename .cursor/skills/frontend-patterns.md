# Frontend Patterns - LA-CAJA

## React Architecture

### Component Structure
- Feature-based organization: `pages/`, `components/`, `services/`, `stores/`
- Use TypeScript strict mode
- Functional components with hooks
- Lazy loading for routes

### State Management
- **Zustand** for global state (`stores/`)
- **React Query** (`@tanstack/react-query`) for server state
- Local state with `useState` for component-specific state

### Services Pattern
```typescript
// services/products.service.ts
export const productsService = {
  async search(query: string): Promise<ProductSearchResponse> {
    // Handle offline/online scenarios
    if (!isOnline) {
      return productsCacheService.search(query)
    }
    // API call
  }
}
```

## Offline-First Patterns

### Cache Service
- `productsCacheService` - Local cache for offline access
- IndexedDB for persistent storage
- Sync service for bidirectional sync

### Online/Offline Detection
```typescript
import { useOnline } from '@/hooks/use-online'

const { isOnline } = useOnline()
// Use cached data when offline
```

### Sync Service
- Automatic sync when online
- Queue operations when offline
- Conflict resolution with CRDT

## React Query Patterns

### Query Hooks
```typescript
const { data, isLoading, error } = useQuery({
  queryKey: ['products', searchQuery],
  queryFn: () => productsService.search(searchQuery),
  staleTime: 5 * 60 * 1000, // 5 minutes
  cacheTime: 10 * 60 * 1000, // 10 minutes
})
```

### Mutations
```typescript
const mutation = useMutation({
  mutationFn: productsService.create,
  onSuccess: () => {
    queryClient.invalidateQueries(['products'])
    toast.success('Producto creado')
  },
  onError: (error) => {
    toast.error('Error al crear producto')
  }
})
```

## Component Patterns

### Page Components
- Located in `pages/`
- Use lazy loading: `lazy(() => import('./pages/ProductsPage'))`
- Wrap with `Suspense` for loading states

### UI Components
- Located in `components/ui/`
- Use shadcn/ui components
- Reusable, composable components

### Feature Components
- Located in `components/{feature}/`
- ProductFormModal, CheckoutModal, etc.
- Encapsulate feature-specific logic

## Styling

### Tailwind CSS
- Utility-first approach
- Use `cn()` utility for conditional classes
- Responsive design: mobile-first

### UI Components
- shadcn/ui component library
- Consistent design system
- Accessible components

## Performance Optimization

### Code Splitting
- Lazy load routes
- Dynamic imports for heavy components
- Split vendor bundles

### Memoization
```typescript
const MemoizedComponent = React.memo(Component, (prev, next) => {
  return prev.id === next.id
})
```

### Virtualization
- Use `react-window` or `react-virtual` for long lists
- Pagination for large datasets

## PWA Patterns

### Service Worker
- Offline support
- Cache strategies
- Background sync

### Install Prompt
- Prompt users to install PWA
- Handle install events

### Push Notifications
- Use `usePushNotifications` hook
- Handle notification permissions

## Form Handling

### React Hook Form
- Use for complex forms
- Validation with `zod` or `yup`
- Error handling

### Controlled Components
- Use for simple forms
- State management with `useState`

## Error Handling

```typescript
try {
  await operation()
} catch (error) {
  toast.error(error.message || 'Error desconocido')
  // Log to error tracking service
}
```

## Best Practices

1. **Immutability**: Never mutate state directly
2. **Small components**: Extract reusable pieces
3. **Type safety**: TypeScript strict mode
4. **Accessibility**: Use semantic HTML, ARIA labels
5. **Performance**: Memoize expensive computations
6. **Offline-first**: Always handle offline scenarios
7. **Error boundaries**: Catch and display errors gracefully
