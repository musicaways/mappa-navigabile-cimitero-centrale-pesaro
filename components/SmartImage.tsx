import React, { useState, useEffect } from 'react';
import { cn } from '../utils';
import { ImageOff } from 'lucide-react';

interface SmartImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  className?: string; // Class for the wrapper div
  imgClassName?: string; // Class for the inner img element
  alt: string;
  width?: number; // Request width
  quality?: number; // JPEG/WEBP quality (1-100)
  priority?: boolean; // If true, loads eagerly
}

const loadedImageCache = new Set<string>();

export const getOptimizedImageUrl = (src: string, width = 400, quality = 80): string => {
  if (!src.startsWith('http')) return src;
  return `https://wsrv.nl/?url=${encodeURIComponent(src)}&w=${width}&q=${quality}&output=webp&il`;
};

export const preloadImagePreview = (src: string, width = 300, quality = 60): void => {
  const optimized = getOptimizedImageUrl(src, width, quality);
  if (loadedImageCache.has(optimized)) return;

  const img = new Image();
  img.decoding = 'async';
  img.src = optimized;
  img.onload = () => loadedImageCache.add(optimized);
};

const SmartImage: React.FC<SmartImageProps> = ({ 
  src, 
  className, 
  imgClassName,
  alt, 
  width = 400, 
  quality = 80,
  priority = false,
  ...props 
}) => {
  const [currentSrc, setCurrentSrc] = useState<string>(getOptimizedImageUrl(src, width, quality));
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    const optimized = getOptimizedImageUrl(src, width, quality);
    setCurrentSrc(optimized);
    setError(false);
    setLoaded(loadedImageCache.has(optimized) || loadedImageCache.has(src));
  }, [src, width, quality]);

  return (
    <div className={cn("relative overflow-hidden bg-neutral-100", className)}>
      {!loaded && !error && (
        <div className="absolute inset-0 animate-pulse bg-neutral-200" />
      )}
      
      {error ? (
        <div className="flex h-full w-full items-center justify-center bg-neutral-100 text-neutral-400">
          <ImageOff className="h-6 w-6" />
        </div>
      ) : (
        <img
          src={currentSrc}
          alt={alt}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          onLoad={() => {
            loadedImageCache.add(currentSrc);
            setLoaded(true);
          }}
          onError={() => {
            if (currentSrc !== src) {
              setCurrentSrc(src);
              return;
            }
            setError(true);
          }}
          className={cn(
            "h-full w-full object-cover transition-opacity duration-300",
            loaded ? "opacity-100" : "opacity-0",
            imgClassName
          )}
          {...props}
        />
      )}
    </div>
  );
};

export default SmartImage;
