export interface ParsedDeepLink {
  focusId: string | null;
  openPrint: boolean;
  routeFrom?: { lat: number; lng: number };
  stopIds?: string[];
}

export const parseDeepLink = (search: string): ParsedDeepLink => {
  const params = new URLSearchParams(search);
  const fromParam = params.get('from');
  let routeFrom: { lat: number; lng: number } | undefined;
  if (fromParam) {
    const [lat, lng] = fromParam.split(',').map(Number);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      routeFrom = { lat, lng };
    }
  }
  const stopsParam = params.get('stops');
  const stopIds = stopsParam
    ? stopsParam.split(',').map((s) => s.trim()).filter(Boolean)
    : undefined;

  return {
    focusId: params.get('focus'),
    openPrint: params.get('open') === 'print',
    routeFrom,
    stopIds,
  };
};

export const buildDeepLink = (
  featureId: string,
  options?: {
    openPrint?: boolean;
    from?: { lat: number; lng: number };
    stops?: string[];
  }
): string => {
  if (typeof window === 'undefined') {
    return `?focus=${encodeURIComponent(featureId)}${options?.openPrint ? '&open=print' : ''}`;
  }

  const url = new URL(window.location.href);
  url.search = '';
  url.searchParams.set('focus', featureId);
  if (options?.openPrint) url.searchParams.set('open', 'print');
  if (options?.from) {
    url.searchParams.set(
      'from',
      `${options.from.lat.toFixed(6)},${options.from.lng.toFixed(6)}`
    );
  }
  if (options?.stops && options.stops.length > 0) {
    url.searchParams.set('stops', options.stops.join(','));
  }
  return url.toString();
};
