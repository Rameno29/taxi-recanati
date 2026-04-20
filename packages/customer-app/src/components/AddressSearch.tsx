import React, { useState, useRef, useCallback } from "react";
import {
  View,
  TextInput,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Keyboard,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors as staticColors, spacing, radii, shadows } from "../theme";
import { useThemeColors } from "../context/ThemeContext";
import type { SavedPlace } from "../services/savedPlaces";

export interface AddressSuggestion {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  address: {
    road?: string;
    house_number?: string;
    suburb?: string;
    city?: string;
    town?: string;
    village?: string;
    county?: string;
    state?: string;
    postcode?: string;
    country?: string;
  };
}

interface Props {
  placeholder: string;
  value: string;
  onChangeText: (text: string) => void;
  onSelect: (suggestion: AddressSuggestion) => void;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  autoFocus?: boolean;
  clearOnFocus?: boolean;
  /** Quick suggestion: show "La tua posizione" entry when query is empty. */
  showCurrentLocation?: boolean;
  currentLocationLabel?: string;
  onSelectCurrentLocation?: () => void;
  /** Quick suggestions: saved places shown when query is empty. */
  savedPlaces?: SavedPlace[];
  onSelectSavedPlace?: (place: SavedPlace) => void;
  onLongPressSavedPlace?: (place: SavedPlace) => void;
}

// Nominatim geocoding — free, no API key needed
// Biased toward Recanati / Marche region
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const VIEWBOX = "13.40,43.35,13.70,43.50"; // bounding box around Recanati area
const DEBOUNCE_MS = 400;

function formatAddress(item: AddressSuggestion): string {
  const a = item.address;
  const parts: string[] = [];

  // Street + number
  if (a.road) {
    parts.push(a.house_number ? `${a.road} ${a.house_number}` : a.road);
  }

  // Suburb / neighbourhood for extra detail
  if (a.suburb) parts.push(a.suburb);

  // City/town/village
  const locality = a.city || a.town || a.village;
  if (locality) parts.push(locality);

  // Postcode
  if (a.postcode) parts.push(a.postcode);

  // Province/county
  if (a.county) parts.push(a.county);

  if (parts.length === 0) {
    // Fallback: use the full display_name but trim country
    return item.display_name.replace(/, Italia$/i, "");
  }

  return parts.join(", ");
}

export default function AddressSearch({
  placeholder,
  value,
  onChangeText,
  onSelect,
  icon,
  iconColor = staticColors.primaryBlue,
  autoFocus = false,
  clearOnFocus = false,
  showCurrentLocation = false,
  currentLocationLabel = "La tua posizione",
  onSelectCurrentLocation,
  savedPlaces = [],
  onSelectSavedPlace,
  onLongPressSavedPlace,
}: Props) {
  const colors = useThemeColors();
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const searchAddress = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSuggestions([]);
      return;
    }

    setLoading(true);
    try {
      // Use street-level query biased to Recanati area
      // Adding "Recanati" to short queries helps get local results
      const enrichedQuery = query.length < 6 && !query.toLowerCase().includes("recanati")
        ? `${query}, Recanati`
        : query;

      const params = new URLSearchParams({
        q: enrichedQuery,
        format: "json",
        addressdetails: "1",
        limit: "8",
        viewbox: VIEWBOX,
        bounded: "0",
        countrycodes: "it",
        "accept-language": "it",
        dedupe: "1",
      });

      const res = await fetch(`${NOMINATIM_URL}?${params}`, {
        headers: {
          "User-Agent": "TaxiRecanatiApp/1.0",
        },
      });

      if (res.ok) {
        const data: AddressSuggestion[] = await res.json();
        // Prioritize street-level results (have a road) over cities/regions
        const sorted = data.sort((a, b) => {
          const aHasRoad = a.address?.road ? 0 : 1;
          const bHasRoad = b.address?.road ? 0 : 1;
          return aHasRoad - bHasRoad;
        });
        setSuggestions(sorted.slice(0, 6));
      }
    } catch {
      // silently fail — user can keep typing
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChangeText = (text: string) => {
    onChangeText(text);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchAddress(text), DEBOUNCE_MS);
  };

  const handleSelect = (item: AddressSuggestion) => {
    const formatted = formatAddress(item);
    onChangeText(formatted);
    setSuggestions([]);
    Keyboard.dismiss();
    onSelect(item);
  };

  const handleClear = () => {
    onChangeText("");
    setSuggestions([]);
  };

  const queryEmpty = value.trim().length === 0;
  const hasQuickSuggestions =
    queryEmpty &&
    ((showCurrentLocation && !!onSelectCurrentLocation) || savedPlaces.length > 0);
  const showSuggestions = isFocused && (suggestions.length > 0 || hasQuickSuggestions);

  const handleSelectCurrent = () => {
    setSuggestions([]);
    Keyboard.dismiss();
    onSelectCurrentLocation?.();
  };

  const handleSelectSaved = (p: SavedPlace) => {
    onChangeText(p.address);
    setSuggestions([]);
    Keyboard.dismiss();
    onSelectSavedPlace?.(p);
  };

  return (
    <View style={styles.wrapper}>
      <View
        style={[
          styles.inputRow,
          { backgroundColor: colors.inputBg },
          isFocused && { borderColor: colors.primaryBlue, backgroundColor: colors.white },
        ]}
      >
        <Ionicons name={icon} size={20} color={iconColor} style={styles.icon} />
        <TextInput
          style={[styles.input, { color: colors.dark }]}
          placeholder={placeholder}
          placeholderTextColor={colors.bodyText + "88"}
          value={value}
          onChangeText={handleChangeText}
          onFocus={() => {
            setIsFocused(true);
            if (clearOnFocus && value.length > 0) {
              onChangeText("");
              setSuggestions([]);
            }
          }}
          onBlur={() => {
            // Small delay so tap on suggestion registers before blur hides list
            setTimeout(() => setIsFocused(false), 200);
          }}
          autoFocus={autoFocus}
          returnKeyType="search"
          autoCorrect={false}
        />
        {loading && <ActivityIndicator size="small" color={colors.primaryBlue} />}
        {value.length > 0 && !loading && (
          <TouchableOpacity onPress={handleClear} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close-circle" size={18} color={colors.bodyText + "99"} />
          </TouchableOpacity>
        )}
      </View>

      {showSuggestions && (
        <View style={[styles.suggestionsContainer, { backgroundColor: colors.white }]}>
          {hasQuickSuggestions && (
            <View>
              {showCurrentLocation && onSelectCurrentLocation && (
                <TouchableOpacity
                  style={[
                    styles.suggestionItem,
                    styles.suggestionBorder,
                    { borderBottomColor: colors.border },
                  ]}
                  onPress={handleSelectCurrent}
                  activeOpacity={0.6}
                >
                  <View
                    style={[
                      styles.iconBubble,
                      { backgroundColor: colors.primaryBlue + "18" },
                    ]}
                  >
                    <Ionicons name="locate" size={18} color={colors.primaryBlue} />
                  </View>
                  <View style={styles.suggestionText}>
                    <Text style={[styles.mainText, { color: colors.dark }]} numberOfLines={1}>
                      {currentLocationLabel}
                    </Text>
                  </View>
                </TouchableOpacity>
              )}

              {savedPlaces.map((p, i) => {
                const last = i === savedPlaces.length - 1 && suggestions.length === 0;
                return (
                  <TouchableOpacity
                    key={p.id}
                    style={[
                      styles.suggestionItem,
                      !last && [
                        styles.suggestionBorder,
                        { borderBottomColor: colors.border },
                      ],
                    ]}
                    onPress={() => handleSelectSaved(p)}
                    onLongPress={() => onLongPressSavedPlace?.(p)}
                    delayLongPress={400}
                    activeOpacity={0.6}
                  >
                    <View
                      style={[
                        styles.iconBubble,
                        { backgroundColor: staticColors.accentCoral + "18" },
                      ]}
                    >
                      <Ionicons
                        name={(p.icon || "bookmark") as any}
                        size={18}
                        color={staticColors.accentCoral}
                      />
                    </View>
                    <View style={styles.suggestionText}>
                      <Text style={[styles.mainText, { color: colors.dark }]} numberOfLines={1}>
                        {p.label}
                      </Text>
                      <Text
                        style={[styles.secondaryText, { color: colors.bodyText }]}
                        numberOfLines={1}
                      >
                        {p.address}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          <FlatList
            data={suggestions}
            keyExtractor={(item) => String(item.place_id)}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item, index }) => {
              const addr = item.address;
              // Main text: street + number, or first meaningful part of display_name
              const mainText = addr.road
                ? addr.house_number
                  ? `${addr.road} ${addr.house_number}`
                  : addr.road
                : item.display_name.split(",")[0];
              // Secondary: suburb, city, postcode, county — as much detail as possible
              const locality = addr.city || addr.town || addr.village || "";
              const secondaryParts = [
                addr.suburb,
                locality,
                addr.postcode,
                addr.county,
              ].filter(Boolean);
              const secondary = secondaryParts.join(", ");

              return (
                <TouchableOpacity
                  style={[
                    styles.suggestionItem,
                    index < suggestions.length - 1 && [
                      styles.suggestionBorder,
                      { borderBottomColor: colors.border },
                    ],
                  ]}
                  onPress={() => handleSelect(item)}
                  activeOpacity={0.6}
                >
                  <Ionicons
                    name="location-outline"
                    size={18}
                    color={colors.primaryBlue}
                    style={styles.suggestionIcon}
                  />
                  <View style={styles.suggestionText}>
                    <Text style={[styles.mainText, { color: colors.dark }]} numberOfLines={1}>
                      {mainText}
                    </Text>
                    {secondary ? (
                      <Text style={[styles.secondaryText, { color: colors.bodyText }]} numberOfLines={1}>
                        {secondary}
                      </Text>
                    ) : null}
                  </View>
                </TouchableOpacity>
              );
            }}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    zIndex: 10,
    overflow: Platform.OS === "android" ? undefined : "visible",
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: staticColors.inputBg,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 2,
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  icon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: staticColors.dark,
    paddingVertical: 12,
  },
  suggestionsContainer: {
    position: "absolute",
    top: "100%",
    left: 0,
    right: 0,
    backgroundColor: staticColors.white,
    borderRadius: radii.md,
    marginTop: 4,
    maxHeight: 280,
    ...shadows.card,
    shadowOpacity: 0.15,
    elevation: 10,
    zIndex: 999,
  },
  suggestionItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  suggestionBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: staticColors.border,
  },
  suggestionIcon: {
    marginRight: 10,
  },
  iconBubble: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  suggestionText: {
    flex: 1,
  },
  mainText: {
    fontSize: 15,
    color: staticColors.dark,
    fontWeight: "500",
  },
  secondaryText: {
    fontSize: 13,
    color: staticColors.bodyText,
    marginTop: 2,
  },
});
