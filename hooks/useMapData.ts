import { useEffect, useMemo, useRef, useState } from 'react';
import { fetchMapData } from '../services/mymaps';
import { Pathfinder } from '../services/pathfinder';
import { MyMapsData, TrailData } from '../types';

interface UseMapDataResult {
  data: MyMapsData | null;
  gates: TrailData[];
  loading: boolean;
  error: string | null;
  pathfinder: Pathfinder | null;
}

export const useMapData = (mapId: string): UseMapDataResult => {
  const [data, setData] = useState<MyMapsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pathfinderRef = useRef<Pathfinder | null>(null);

  useEffect(() => {
    let isCancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const mapData = await fetchMapData(mapId);
        if (isCancelled) return;

        setData(mapData);
        pathfinderRef.current = new Pathfinder(mapData.geojson);

        const hasFeatures = mapData.geojson.features.length > 0;
        const hasTrails = mapData.trails.length > 0;
        if (!hasFeatures || !hasTrails) {
          setError('Mappa caricata, ma non contiene dati navigabili al momento.');
        }
      } catch (err) {
        console.error(err);
        if (!isCancelled) {
          const defaultMessage = 'Errore durante il caricamento della mappa. Controlla connessione e disponibilita del servizio dati.';
          const message = err instanceof Error && err.message ? `${defaultMessage} (${err.message})` : defaultMessage;
          setError(message);
          setData(null);
          pathfinderRef.current = null;
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      isCancelled = true;
    };
  }, [mapId]);

  const gates = useMemo(() => {
    if (!data) return [];
    return data.trails
      .filter((trail) => /cancello\s*[1-3]/i.test(trail.name))
      .sort((a, b) => a.name.localeCompare(b.name, 'it'));
  }, [data]);

  return {
    data,
    gates,
    loading,
    error,
    pathfinder: pathfinderRef.current,
  };
};
