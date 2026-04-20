import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "@taxirecanati/saved_places/v1";

export interface SavedPlace {
  id: string;
  label: string;       // user-chosen label, e.g. "Casa", "Lavoro"
  address: string;     // human-readable address (display)
  lat: number;
  lng: number;
  icon?: string;       // optional Ionicons name override
  created_at: number;  // epoch ms
}

function genId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export async function getSavedPlaces(): Promise<SavedPlace[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as SavedPlace[];
  } catch {
    return [];
  }
}

async function writeAll(places: SavedPlace[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(places));
}

export async function addSavedPlace(input: {
  label: string;
  address: string;
  lat: number;
  lng: number;
  icon?: string;
}): Promise<SavedPlace> {
  const places = await getSavedPlaces();

  // De-dupe: if a place with the same coords (~10m) already exists, replace it.
  const COORD_EPS = 0.0001; // ~11m
  const dupeIdx = places.findIndex(
    (p) =>
      Math.abs(p.lat - input.lat) < COORD_EPS &&
      Math.abs(p.lng - input.lng) < COORD_EPS
  );

  const place: SavedPlace = {
    id: dupeIdx >= 0 ? places[dupeIdx].id : genId(),
    label: input.label.trim(),
    address: input.address,
    lat: input.lat,
    lng: input.lng,
    icon: input.icon,
    created_at: Date.now(),
  };

  if (dupeIdx >= 0) {
    places[dupeIdx] = place;
  } else {
    places.unshift(place); // newest first
  }

  await writeAll(places);
  return place;
}

export async function removeSavedPlace(id: string): Promise<void> {
  const places = await getSavedPlaces();
  await writeAll(places.filter((p) => p.id !== id));
}

export async function updateSavedPlace(
  id: string,
  updates: Partial<Pick<SavedPlace, "label" | "address" | "lat" | "lng" | "icon">>
): Promise<SavedPlace | null> {
  const places = await getSavedPlaces();
  const idx = places.findIndex((p) => p.id === id);
  if (idx < 0) return null;
  places[idx] = { ...places[idx], ...updates };
  await writeAll(places);
  return places[idx];
}

/** Suggest an icon based on the label (Italian common keywords). */
export function suggestIcon(label: string): string {
  const l = label.toLowerCase().trim();
  if (/casa|home/.test(l)) return "home";
  if (/lavoro|ufficio|work|office/.test(l)) return "briefcase";
  if (/scuola|università|school/.test(l)) return "school";
  if (/gym|palestra/.test(l)) return "barbell";
  if (/aeroporto|airport/.test(l)) return "airplane";
  if (/stazione|station/.test(l)) return "train";
  if (/ospedale|hospital/.test(l)) return "medkit";
  return "bookmark";
}
