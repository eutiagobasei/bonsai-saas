'use client';

import { cn } from '@/lib/utils';

interface BadgeProps {
  children: React.ReactNode;
  color?: string;
  variant?: 'solid' | 'outline';
  className?: string;
}

export function Badge({ children, color, variant = 'solid', className }: BadgeProps) {
  const bgColor = color ? color : '#6b7280';

  const styles = variant === 'solid'
    ? { backgroundColor: bgColor, color: getContrastColor(bgColor) }
    : { borderColor: bgColor, color: bgColor };

  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
        variant === 'outline' && 'border',
        className
      )}
      style={styles}
    >
      {children}
    </span>
  );
}

function getContrastColor(hexColor: string): string {
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  return luminance > 0.5 ? '#000000' : '#ffffff';
}
