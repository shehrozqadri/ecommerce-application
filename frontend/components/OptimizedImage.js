'use client';

import Image from 'next/image';

/**
 * OptimizedImage component wraps Next.js Image with sensible defaults for Cloudinary URLs.
 * Provides automatic optimization, lazy loading, and responsive sizing.
 */
export default function OptimizedImage({
  src,
  alt,
  width = 400,
  height = 600,
  className = '',
  priority = false,
  fill = false,
  sizes = '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw',
  ...props
}) {
  // Use optimized Cloudinary URL if it's a Cloudinary image
  let optimizedSrc = src;
  if (src && src.includes('cloudinary.com')) {
    // Cloudinary automatic optimization
    optimizedSrc = src.replace('image/upload/', 'image/upload/q_auto,f_auto/');
  }

  if (fill) {
    return (
      <Image
        src={optimizedSrc}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        className={className}
        {...props}
      />
    );
  }

  return (
    <Image
      src={optimizedSrc}
      alt={alt}
      width={width}
      height={height}
      priority={priority}
      sizes={sizes}
      className={className}
      {...props}
    />
  );
}
