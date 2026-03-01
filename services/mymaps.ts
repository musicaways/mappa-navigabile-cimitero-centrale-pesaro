
import { Feature, FeatureCollection, Geometry } from 'geojson';
import { kml } from '@tmcw/togeojson';
import { MyMapsData, TrailData } from '../types';

const PRIMARY_PROXY = 'https://corsproxy.io/?';
const BACKUP_PROXY = 'https://api.allorigins.win/raw?url=';

const extractCoordinates = (feature: Feature<Geometry>): { lat: number; lng: number } | undefined => {
  if (!feature.geometry) return undefined;

  try {
    if (feature.geometry.type === 'Point') {
      const [lng, lat] = feature.geometry.coordinates;
      return { lat, lng };
    }

    if (feature.geometry.type === 'LineString') {
      const first = feature.geometry.coordinates[0];
      if (!first) return undefined;
      return { lat: first[1], lng: first[0] };
    }

    if (feature.geometry.type === 'Polygon') {
      const first = feature.geometry.coordinates[0]?.[0];
      if (!first) return undefined;
      return { lat: first[1], lng: first[0] };
    }

    if (feature.geometry.type === 'MultiPolygon') {
      const first = feature.geometry.coordinates[0]?.[0]?.[0];
      if (!first) return undefined;
      return { lat: first[1], lng: first[0] };
    }
  } catch (error) {
    console.warn('Coordinate parsing failed:', error);
  }

  return undefined;
};

const parseDescriptionAndPhotos = (
  rawDescription: string,
  mediaLinks: unknown
): { description: string; photos: string[] } => {
  const htmlParser = new DOMParser();
  const htmlDoc = htmlParser.parseFromString(rawDescription, 'text/html');
  const body = htmlDoc.body;
  const photos = new Set<string>();

  const imgTags = Array.from(body.getElementsByTagName('img'));
  for (const img of imgTags) {
    if (img.src && !img.src.includes('icon')) {
      photos.add(img.src);
    }
    img.remove();
  }

  if (typeof mediaLinks === 'string') {
    for (const link of mediaLinks.split(' ')) {
      if (link.startsWith('http')) {
        photos.add(link);
      }
    }
  }

  for (const br of Array.from(body.getElementsByTagName('br'))) {
    br.replaceWith('\n');
  }

  const blockElements = body.querySelectorAll('div, p, h1, h2, h3, h4, h5, h6, ul, ol, li, tr');
  for (const element of Array.from(blockElements)) {
    element.after(document.createTextNode('\n'));
  }

  let description = (body.textContent || '').trim();
  if (description === '[object Object]') {
    description = '';
  }

  return {
    description,
    photos: Array.from(photos),
  };
};

const buildKeywords = (name: string, description: string): string[] => {
  const combined = `${name} ${description}`.toLowerCase();
  const keywords = new Set<string>();

  if (combined.includes('parcheggio')) keywords.add('parcheggio');
  if (combined.includes('cancello')) keywords.add('cancello');
  if (combined.includes('padiglione')) keywords.add('padiglione');
  if (combined.includes('campo')) keywords.add('campo');
  if (combined.includes('blocco')) keywords.add('blocco');

  return Array.from(keywords);
};

const fetchKmlText = async (googleUrl: string): Promise<string> => {
  let primaryStatus: number | null = null;
  try {
    const primaryRes = await fetch(`${PRIMARY_PROXY}${encodeURIComponent(googleUrl)}`);
    if (primaryRes.ok) {
      return primaryRes.text();
    }
    primaryStatus = primaryRes.status;
  } catch (primaryError) {
    console.warn('Primary proxy failed:', primaryError);
  }

  try {
    const backupRes = await fetch(`${BACKUP_PROXY}${encodeURIComponent(googleUrl)}`);
    if (!backupRes.ok) {
      throw new Error(
        `Proxy response not ok (primary=${primaryStatus ?? 'network-error'}, backup=${backupRes.status})`
      );
    }
    return backupRes.text();
  } catch (backupError) {
    throw new Error('Impossibile scaricare i dati della mappa dai proxy disponibili.', {
      cause: backupError instanceof Error ? backupError : new Error(String(backupError)),
    });
  }
};

export const fetchMapData = async (mapId: string): Promise<MyMapsData> => {
  try {
    const timestamp = Date.now();
    const googleUrl = `https://www.google.com/maps/d/kml?mid=${mapId}&forcekml=1&t=${timestamp}`;
    const kmlText = await fetchKmlText(googleUrl);

    const kmlParser = new DOMParser();
    const kmlDom = kmlParser.parseFromString(kmlText, 'text/xml');
    const parseError = kmlDom.querySelector('parsererror');
    if (parseError) {
      throw new Error('Il file KML ricevuto non e valido.');
    }
    const geojson = kml(kmlDom) as FeatureCollection<Geometry>;

    const trails: TrailData[] = [];
    const idMap: Record<string, TrailData> = {};
    const featureMap: Record<string, Feature<Geometry>> = {};

    geojson.features.forEach((feature, index) => {
      if (!feature.geometry) return;

      if (!feature.id) {
        feature.id = `feature-${index}`;
      }

      const featureId = String(feature.id);
      const props = feature.properties || {};
      const name = typeof props.name === 'string' && props.name.trim().length > 0
        ? props.name.trim()
        : 'Punto senza nome';

      const isWall = /muro/i.test(name) && !/pad\.\s*c\s*&\s*d/i.test(name);
      feature.properties = {
        ...props,
        isWall,
      };

      featureMap[featureId] = feature;
      if (isWall) return;

      const rawDescription =
        (typeof props.description === 'string' && props.description) ||
        (typeof props.desc === 'string' && props.desc) ||
        (typeof props.content === 'string' && props.content) ||
        '';

      const { description, photos } = parseDescriptionAndPhotos(rawDescription, props.gx_media_links);
      const coordinates = extractCoordinates(feature);
      const lowerDescription = description.toLowerCase();

      const trail: TrailData = {
        id: featureId,
        name,
        description,
        distance: '',
        duration: '',
        difficulty: lowerDescription.includes('difficile')
          ? 'Difficile'
          : lowerDescription.includes('facile')
            ? 'Facile'
            : 'Medio',
        photos,
        elevation: '',
        keywords: buildKeywords(name, description),
        color: typeof props.stroke === 'string' ? props.stroke : '#16a34a',
        coordinates,
      };

      trails.push(trail);
      idMap[featureId] = trail;
    });

    trails.sort((a, b) => a.name.localeCompare(b.name, 'it'));

    return {
      geojson,
      trails,
      idMap,
      featureMap,
    };
  } catch (error) {
    throw new Error('Errore durante il caricamento dei dati mappa.', {
      cause: error instanceof Error ? error : new Error(String(error)),
    });
  }
};
