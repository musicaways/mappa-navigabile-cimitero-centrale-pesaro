import React, { useState, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import SmartImage from './SmartImage';

interface LightboxProps {
  photos: string[];
  initialIndex: number;
  onClose: () => void;
  title: string;
}

const Lightbox: React.FC<LightboxProps> = ({ photos, initialIndex, onClose, title }) => {
  const [index, setIndex] = useState(initialIndex);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') setIndex(i => Math.max(0, i - 1));
      if (e.key === 'ArrowRight') setIndex(i => Math.min(photos.length - 1, i + 1));
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [photos, onClose]);

  // Preload adjacent images for instant navigation
  useEffect(() => {
      const preloadImage = (url: string) => {
          const img = new Image();
          // Construct the same optimized URL that SmartImage uses to hit cache
          img.src = `https://wsrv.nl/?url=${encodeURIComponent(url)}&w=1200&q=80&output=webp&il`;
      };

      if (index < photos.length - 1) preloadImage(photos[index + 1]);
      if (index > 0) preloadImage(photos[index - 1]);
  }, [index, photos]);

  if (!photos.length) return null;

  return (
    // Z-index increased to 5000
    <div className="fixed inset-0 z-[5000] bg-black/95 flex flex-col animate-in fade-in duration-200 backdrop-blur-sm">
      {/* Top Bar */}
      <div className="flex items-center justify-between p-4 text-white z-10">
        <span className="text-sm font-medium opacity-80">{index + 1} / {photos.length}</span>
        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full">
            <X className="w-6 h-6" />
        </button>
      </div>

      {/* Main Image Area */}
      <div className="flex-1 relative flex items-center justify-center p-4 overflow-hidden">
        <button 
            onClick={() => setIndex(Math.max(0, index - 1))}
            disabled={index === 0}
            className="absolute left-4 p-3 rounded-full bg-black/50 hover:bg-black/70 disabled:opacity-0 transition-all text-white z-20"
        >
            <ChevronLeft className="w-6 h-6" />
        </button>

        <div className="relative w-full h-full flex items-center justify-center">
            {/* 
                Key on index forces remount of SmartImage to trigger animation/loading state correctly 
                imgClassName="object-contain" ensures the image is not cropped.
                className="bg-transparent" removes the grey placeholder background from the wrapper.
            */}
            <SmartImage 
                key={index}
                src={photos[index]} 
                alt={`${title} photo ${index + 1}`} 
                className="w-full h-full bg-transparent shadow-none" 
                imgClassName="object-contain"
                width={1200}
                quality={85}
                priority={true} // Load eager
            />
        </div>

        <button 
            onClick={() => setIndex(Math.min(photos.length - 1, index + 1))}
            disabled={index === photos.length - 1}
            className="absolute right-4 p-3 rounded-full bg-black/50 hover:bg-black/70 disabled:opacity-0 transition-all text-white z-20"
        >
            <ChevronRight className="w-6 h-6" />
        </button>
      </div>

      {/* Caption / Thumbnails */}
      <div className="p-6 text-center z-10">
        <h3 className="text-white font-medium text-lg mb-4 truncate max-w-md mx-auto">{title}</h3>
        <div className="flex gap-2 overflow-x-auto justify-center pb-2 hide-scrollbar">
            {photos.map((p, i) => (
                <button 
                    key={i} 
                    onClick={() => setIndex(i)}
                    className={`relative w-12 h-12 flex-shrink-0 rounded-md overflow-hidden border-2 transition-all ${i === index ? 'border-white scale-110' : 'border-transparent opacity-50'}`}
                >
                     {/* Tiny thumbnails for the strip */}
                    <img 
                        src={`https://wsrv.nl/?url=${encodeURIComponent(p)}&w=100&q=50&output=webp`} 
                        alt="" 
                        className="w-full h-full object-cover" 
                        loading="lazy"
                    />
                </button>
            ))}
        </div>
      </div>
    </div>
  );
};

export default Lightbox;