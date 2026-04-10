import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'cimitero-favorites-v1';

export interface FavoriteItem {
  id: string;
  name: string;
  addedAt: number;
}

function load(): FavoriteItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as FavoriteItem[];
  } catch {
    return [];
  }
}

function save(items: FavoriteItem[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch { /* quota */ }
}

export function useFavorites() {
  const [favorites, setFavorites] = useState<FavoriteItem[]>(load);

  useEffect(() => {
    save(favorites);
  }, [favorites]);

  const isFavorite = useCallback(
    (id: string) => favorites.some((f) => f.id === id),
    [favorites]
  );

  const toggleFavorite = useCallback((id: string, name: string) => {
    setFavorites((prev) => {
      if (prev.some((f) => f.id === id)) {
        return prev.filter((f) => f.id !== id);
      }
      return [{ id, name, addedAt: Date.now() }, ...prev];
    });
  }, []);

  const removeFavorite = useCallback((id: string) => {
    setFavorites((prev) => prev.filter((f) => f.id !== id));
  }, []);

  return { favorites, isFavorite, toggleFavorite, removeFavorite };
}
