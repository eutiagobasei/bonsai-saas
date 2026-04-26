# Frontend Patterns

React/Next.js patterns used in My-SaaS.

## Component Organization

```
components/
├── ui/           # Primitive components (Button, Input, Modal)
├── crud/         # CRUD-specific components
├── icons/        # Icon components (centralized)
└── layout/       # Layout components (Sidebar, Header)
```

## Icons

Import from centralized library:

```tsx
import { PlusIcon, EditIcon, TrashIcon } from '@/components/icons';
```

Available icons: Plus, Edit, Trash, Folder, Cube, Close, Check, Search, Filter

## Styling

Use Tailwind CSS with `cn()` utility for conditional classes:

```tsx
import { cn } from '@/lib/utils';

<div className={cn(
  'base-classes',
  condition && 'conditional-classes',
  !active && 'opacity-60'
)} />
```

## Form Handling

Use controlled components with formData state:

```tsx
const [formData, setFormData] = useState<CreateData>({
  name: '',
  description: '',
});

<Input
  value={formData.name}
  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
/>
```

## Loading States

Standard loading spinner:

```tsx
if (isLoading) {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
    </div>
  );
}
```

## Empty States

Use consistent empty state pattern:

```tsx
<div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border">
  <IconComponent className="w-12 h-12 mx-auto text-gray-400" />
  <h3 className="mt-2 text-sm font-medium">No items</h3>
  <p className="mt-1 text-sm text-gray-500">Description</p>
  <div className="mt-6">
    <Button onClick={onCreate}>Create</Button>
  </div>
</div>
```

## Modals

Use Modal component for forms and confirmations:

```tsx
<Modal
  isOpen={isModalOpen}
  onClose={() => setIsModalOpen(false)}
  title="Modal Title"
  size="md" // sm, md, lg
>
  {/* Content */}
</Modal>
```
