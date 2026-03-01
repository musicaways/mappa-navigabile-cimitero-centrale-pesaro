# Roadmap Tecnica

## Fase 2 completata in questo ciclo
- Refactor parziale della mappa in moduli dedicati:
  - `components/leaflet-map/map-core.ts`
  - `components/leaflet-map/layers.ts`
  - `components/leaflet-map/navigation.ts`
  - `components/leaflet-map/print.ts`
- Pipeline CSS build-time deterministica con Tailwind + PostCSS.
- Hardening Service Worker con:
  - TTL cache per tipologia risorsa
  - limiti massimi entry cache
  - fallback offline HTML dedicato
  - versione SW incrementata (`v4`)

## Migrazione dati (Fase successiva)

### Obiettivo
Rimuovere dipendenze runtime da proxy CORS e da endpoint KML esterni, passando a GeoJSON versionato e self-hosted.

### Passi consigliati
1. Definire schema GeoJSON stabile con campi `properties` necessari all'app (`name`, `isWall`, `stroke`, media, metadati).
2. Introdurre un processo ETL offline:
   - input: KML MyMaps
   - output: `public/data/cimitero.geojson`
   - validazione schema + deduplica feature id.
3. Aggiornare `fetchMapData` con priorita:
   - `public/data/cimitero.geojson` (primario)
   - fallback KML proxy (temporaneo).
4. Versionare i dataset (es. hash filename o campo `datasetVersion`) e usare invalidazione SW coerente.
5. Eliminare il fallback proxy quando il dataset self-hosted e stabile.

### Criteri di uscita
- Nessuna richiesta runtime ai proxy CORS in condizioni normali.
- Caricamento mappa deterministico e ripetibile offline/online.

## Backlog funzionale suggerito
1. Ricerca avanzata con sinonimi e normalizzazione termini.
2. Deep-link/QR code per cancelli, padiglioni e settori.
3. Modalita accessibilita (alto contrasto, font scaling, target touch maggiorati).
4. Percorsi multi-destinazione (itinerario sequenziale).
5. Mini pannello amministrativo per aggiornamento dati informativi e contatti.
