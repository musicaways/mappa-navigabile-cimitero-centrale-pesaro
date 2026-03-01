export interface ParsedDeepLink {
  focusId: string | null;
  openPrint: boolean;
  uiDebug: boolean;
}

export const parseDeepLink = (search: string): ParsedDeepLink => {
  const params = new URLSearchParams(search);
  return {
    focusId: params.get('focus'),
    openPrint: params.get('open') === 'print',
    uiDebug: params.get('uiDebug') === '1',
  };
};

export const buildDeepLink = (
  featureId: string,
  options?: { openPrint?: boolean }
): string => {
  if (typeof window === 'undefined') {
    return `?focus=${encodeURIComponent(featureId)}${options?.openPrint ? '&open=print' : ''}`;
  }

  const url = new URL(window.location.href);
  url.search = '';
  url.searchParams.set('focus', featureId);
  if (options?.openPrint) {
    url.searchParams.set('open', 'print');
  }
  return url.toString();
};
