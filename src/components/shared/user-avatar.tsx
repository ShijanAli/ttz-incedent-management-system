import { useState } from 'react';
import { getInitials } from '@/lib/shared-utils';
import { cn } from '@/lib/utils';

interface UserAvatarProps {
  name: string;
  color: string;
  image?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const SIZE_CLASSES = {
  xs: 'h-6 w-6 text-[10px]',
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
  xl: 'h-20 w-20 text-2xl',
};

export function UserAvatar({ name, color, image, size = 'sm', className }: UserAvatarProps) {
  // Photo URLs are signed and expire; fall back to initials when one fails to load
  const [failedImage, setFailedImage] = useState<string | null>(null);

  if (image && image !== failedImage) {
    return (
      <img
        src={image}
        alt={name}
        title={name}
        onError={() => setFailedImage(image)}
        className={cn('shrink-0 rounded-full object-cover', SIZE_CLASSES[size], className)}
      />
    );
  }

  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full font-bold text-white',
        SIZE_CLASSES[size],
        className
      )}
      style={{ backgroundColor: color }}
      title={name}
    >
      {getInitials(name)}
    </div>
  );
}
