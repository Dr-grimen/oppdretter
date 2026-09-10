/**
 * Geometri på opne data. Alt er EPSG:4326 (lon, lat) — verifisert: alle 29
 * WFS-laga hos BarentsWatch og Fiskeridirektoratet sine tenester har 4326 som
 * native projeksjon. Ingen reprojeksjon trengst.
 */

export type Pos = [number, number]; // [lon, lat]
export type Ring = Pos[];
export type Geometri =
  | { type: "Polygon"; coordinates: Ring[] }
  | { type: "MultiPolygon"; coordinates: Ring[][] }
  | { type: "Point"; coordinates: Pos }
  | { type: string; coordinates: unknown };

/** Ray casting. Punkt nøyaktig på kanten er ikkje definert — det er greitt her. */
function iRing(lon: number, lat: number, ring: Ring): boolean {
  let inne = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i];
    const b = ring[j];
    if (!a || !b) continue;
    const [xi, yi] = a;
    const [xj, yj] = b;
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inne = !inne;
    }
  }
  return inne;
}

/** Første ring er ytterkant, resten er hol. */
function iPolygon(lon: number, lat: number, ringar: Ring[]): boolean {
  const ytre = ringar[0];
  if (!ytre || !iRing(lon, lat, ytre)) return false;
  for (let i = 1; i < ringar.length; i++) {
    const hol = ringar[i];
    if (hol && iRing(lon, lat, hol)) return false;
  }
  return true;
}

export function iGeometri(lon: number, lat: number, g: Geometri): boolean {
  if (g.type === "Polygon") return iPolygon(lon, lat, g.coordinates as Ring[]);
  if (g.type === "MultiPolygon") {
    return (g.coordinates as Ring[][]).some((p) => iPolygon(lon, lat, p));
  }
  return false;
}

const JORDRADIUS_M = 6_371_008.8;

/** Avstand i meter mellom to punkt. God nok for nærleik under nokre titals km. */
export function haversineM(a: Pos, b: Pos): number {
  const [lon1, lat1] = a;
  const [lon2, lat2] = b;
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * JORDRADIUS_M * Math.asin(Math.min(1, Math.sqrt(s)));
}

/** Grov boks først — sparar 99 % av ray casting-arbeidet. */
export type MedBoks<T> = { verdi: T; geometri: Geometri; boks: [number, number, number, number] };

export function lagBoks<T>(verdi: T, geometri: Geometri): MedBoks<T> {
  let minLon = Infinity, minLat = Infinity, maxLon = -Infinity, maxLat = -Infinity;
  const sjekk = (r: Ring): void => {
    for (const p of r) {
      const lon = p[0], lat = p[1];
      if (lon < minLon) minLon = lon;
      if (lon > maxLon) maxLon = lon;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }
  };
  if (geometri.type === "Polygon") (geometri.coordinates as Ring[]).forEach(sjekk);
  else if (geometri.type === "MultiPolygon") {
    (geometri.coordinates as Ring[][]).forEach((p) => p.forEach(sjekk));
  }
  return { verdi, geometri, boks: [minLon, minLat, maxLon, maxLat] };
}

export function finnFoerste<T>(lon: number, lat: number, kandidatar: MedBoks<T>[]): T | null {
  for (const k of kandidatar) {
    const [a, b, c, d] = k.boks;
    if (lon < a || lon > c || lat < b || lat > d) continue;
    if (iGeometri(lon, lat, k.geometri)) return k.verdi;
  }
  return null;
}
