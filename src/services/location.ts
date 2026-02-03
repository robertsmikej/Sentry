import type { GeoLocation } from '../types';
import { getSettings } from './storage';

export interface LocationOptions {
  enableHighAccuracy?: boolean; // GPS vs network location
  timeout?: number; // Max wait time (ms)
  maximumAge?: number; // Accept cached position up to N ms old
}

/**
 * Get current location using the Geolocation API.
 * Returns null if geolocation is not available or permission denied.
 */
export async function getCurrentLocation(
  options: LocationOptions = {}
): Promise<GeoLocation | null> {
  // Check if geolocation is supported
  if (!navigator.geolocation) {
    console.warn('[Location] Geolocation not supported');
    return null;
  }

  // Check if location is enabled in settings
  const settings = await getSettings();
  if (!settings?.locationEnabled) {
    return null;
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const location: GeoLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          altitude: position.coords.altitude ?? undefined,
          timestamp: new Date(position.timestamp),
        };

        // Apply precision reduction if configured
        const reducedLocation = reduceLocationPrecision(
          location,
          settings?.locationPrecision || 'exact'
        );

        resolve(reducedLocation);
      },
      (error) => {
        console.warn('[Location] Geolocation error:', error.message);
        resolve(null); // Fail gracefully
      },
      {
        enableHighAccuracy: options.enableHighAccuracy ?? false,
        timeout: options.timeout ?? 10000,
        maximumAge: options.maximumAge ?? 60000, // Accept 1-minute old cache
      }
    );
  });
}

/**
 * Reduce location precision for privacy.
 * - exact: Full precision (6 decimal places, ~0.1m)
 * - neighborhood: 3 decimal places (~100m)
 * - city: 2 decimal places (~1km)
 */
export function reduceLocationPrecision(
  location: GeoLocation,
  precision: 'exact' | 'neighborhood' | 'city'
): GeoLocation {
  if (precision === 'exact') return location;

  // Neighborhood: round to ~100m (3 decimal places)
  // City: round to ~1km (2 decimal places)
  const decimals = precision === 'neighborhood' ? 3 : 2;

  return {
    ...location,
    latitude: Number(location.latitude.toFixed(decimals)),
    longitude: Number(location.longitude.toFixed(decimals)),
    accuracy: undefined, // Remove accuracy when reducing precision
  };
}

/**
 * Check if user has granted location permission.
 * Returns 'granted', 'denied', or 'prompt' (not yet asked).
 */
export async function checkLocationPermission(): Promise<
  'granted' | 'denied' | 'prompt'
> {
  if (!navigator.permissions) return 'prompt';

  try {
    const result = await navigator.permissions.query({ name: 'geolocation' });
    return result.state;
  } catch {
    return 'prompt';
  }
}

/**
 * Check if location tracking is enabled in settings.
 */
export async function isLocationEnabled(): Promise<boolean> {
  const settings = await getSettings();
  return settings?.locationEnabled === true;
}

/**
 * Format a location for display.
 */
export function formatLocation(location: GeoLocation): string {
  return `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`;
}

/**
 * Generate a Google Maps URL for a location.
 */
export function getGoogleMapsUrl(location: GeoLocation): string {
  return `https://www.google.com/maps?q=${location.latitude},${location.longitude}`;
}

/**
 * Calculate distance between two locations in meters (Haversine formula).
 */
export function calculateDistance(
  loc1: GeoLocation,
  loc2: GeoLocation
): number {
  const R = 6371000; // Earth's radius in meters
  const lat1 = (loc1.latitude * Math.PI) / 180;
  const lat2 = (loc2.latitude * Math.PI) / 180;
  const deltaLat = ((loc2.latitude - loc1.latitude) * Math.PI) / 180;
  const deltaLon = ((loc2.longitude - loc1.longitude) * Math.PI) / 180;

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(deltaLon / 2) *
      Math.sin(deltaLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}
