/**
 * GeolocationManager - Manage browser geolocation spoofing
 */

import { Page } from 'playwright-core';
import { ActionResult } from '../types';
import { formatSuccess, formatError } from '../utils/responseFormatter';

export interface GeolocationCoordinates {
  /** Latitude in decimal degrees (-90 to 90) */
  latitude: number;
  /** Longitude in decimal degrees (-180 to 180) */
  longitude: number;
  /** Accuracy in meters (optional) */
  accuracy?: number;
}

export interface GeolocationOptions extends GeolocationCoordinates {
  /** Altitude in meters (optional) */
  altitude?: number;
  /** Altitude accuracy in meters (optional) */
  altitudeAccuracy?: number;
  /** Heading in degrees (0-360, optional) */
  heading?: number;
  /** Speed in meters per second (optional) */
  speed?: number;
}

export interface LocationPreset {
  name: string;
  coordinates: GeolocationCoordinates;
  timezone?: string;
  locale?: string;
}

export class GeolocationManager {
  private currentLocation: GeolocationOptions | null = null;
  
  // Common location presets for testing
  private readonly presets: Map<string, LocationPreset> = new Map([
    ['new-york', {
      name: 'New York, USA',
      coordinates: { latitude: 40.7128, longitude: -74.0060, accuracy: 10 },
      timezone: 'America/New_York',
      locale: 'en-US'
    }],
    ['london', {
      name: 'London, UK',
      coordinates: { latitude: 51.5074, longitude: -0.1278, accuracy: 10 },
      timezone: 'Europe/London',
      locale: 'en-GB'
    }],
    ['tokyo', {
      name: 'Tokyo, Japan',
      coordinates: { latitude: 35.6762, longitude: 139.6503, accuracy: 10 },
      timezone: 'Asia/Tokyo',
      locale: 'ja-JP'
    }],
    ['paris', {
      name: 'Paris, France',
      coordinates: { latitude: 48.8566, longitude: 2.3522, accuracy: 10 },
      timezone: 'Europe/Paris',
      locale: 'fr-FR'
    }],
    ['sydney', {
      name: 'Sydney, Australia',
      coordinates: { latitude: -33.8688, longitude: 151.2093, accuracy: 10 },
      timezone: 'Australia/Sydney',
      locale: 'en-AU'
    }],
    ['san-francisco', {
      name: 'San Francisco, USA',
      coordinates: { latitude: 37.7749, longitude: -122.4194, accuracy: 10 },
      timezone: 'America/Los_Angeles',
      locale: 'en-US'
    }],
    ['beijing', {
      name: 'Beijing, China',
      coordinates: { latitude: 39.9042, longitude: 116.4074, accuracy: 10 },
      timezone: 'Asia/Shanghai',
      locale: 'zh-CN'
    }],
    ['mumbai', {
      name: 'Mumbai, India',
      coordinates: { latitude: 19.0760, longitude: 72.8777, accuracy: 10 },
      timezone: 'Asia/Kolkata',
      locale: 'hi-IN'
    }],
    ['moscow', {
      name: 'Moscow, Russia',
      coordinates: { latitude: 55.7558, longitude: 37.6173, accuracy: 10 },
      timezone: 'Europe/Moscow',
      locale: 'ru-RU'
    }],
    ['dubai', {
      name: 'Dubai, UAE',
      coordinates: { latitude: 25.2048, longitude: 55.2708, accuracy: 10 },
      timezone: 'Asia/Dubai',
      locale: 'ar-AE'
    }]
  ]);

  /**
   * Set geolocation for a page
   */
  async setGeolocation(
    page: Page,
    location: GeolocationOptions | string
  ): Promise<ActionResult> {
    try {
      let coordinates: GeolocationOptions;
      
      // Check if location is a preset name
      if (typeof location === 'string') {
        const preset = this.presets.get(location.toLowerCase());
        if (!preset) {
          return formatError(`Unknown location preset: ${location}. Available: ${Array.from(this.presets.keys()).join(', ')}`, 'setGeolocation');
        }
        coordinates = preset.coordinates;
      } else {
        coordinates = location;
      }

      // Validate coordinates
      const validation = this.validateCoordinates(coordinates);
      if (!validation.valid) {
        return formatError(validation.error!, 'setGeolocation');
      }

      // Set geolocation permission
      const context = page.context();
      await context.grantPermissions(['geolocation']);
      
      // Set the geolocation
      await context.setGeolocation({
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
        accuracy: coordinates.accuracy
      });

      this.currentLocation = coordinates;

      return formatSuccess('setGeolocation', {
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
        accuracy: coordinates.accuracy || 0,
        preset: typeof location === 'string' ? location : undefined
      });
    } catch (error) {
      return formatError(`Failed to set geolocation: ${(error as Error).message}`, 'setGeolocation');
    }
  }

  /**
   * Clear geolocation (disable spoofing)
   */
  async clearGeolocation(page: Page): Promise<ActionResult> {
    try {
      const context = page.context();
      await context.setGeolocation(null);
      this.currentLocation = null;
      
      return formatSuccess('clearGeolocation', {
        message: 'Geolocation spoofing disabled'
      });
    } catch (error) {
      return formatError(`Failed to clear geolocation: ${(error as Error).message}`, 'clearGeolocation');
    }
  }

  /**
   * Get current geolocation setting
   */
  getCurrentLocation(): GeolocationOptions | null {
    return this.currentLocation;
  }

  /**
   * Grant or deny geolocation permission
   */
  async setGeolocationPermission(
    page: Page,
    permission: 'grant' | 'deny'
  ): Promise<ActionResult> {
    try {
      const context = page.context();
      
      if (permission === 'grant') {
        await context.grantPermissions(['geolocation']);
      } else {
        await context.clearPermissions();
      }
      
      return formatSuccess('setGeolocationPermission', {
        permission,
        message: `Geolocation permission ${permission === 'grant' ? 'granted' : 'denied'}`
      });
    } catch (error) {
      return formatError(`Failed to set permission: ${(error as Error).message}`, 'setGeolocationPermission');
    }
  }

  /**
   * Watch position changes (simulate movement)
   */
  async simulateMovement(
    page: Page,
    waypoints: GeolocationOptions[],
    intervalMs: number = 1000
  ): Promise<ActionResult> {
    try {
      if (waypoints.length === 0) {
        return formatError('No waypoints provided', 'simulateMovement');
      }

      const context = page.context();
      await context.grantPermissions(['geolocation']);
      
      for (const waypoint of waypoints) {
        const validation = this.validateCoordinates(waypoint);
        if (!validation.valid) {
          return formatError(`Invalid waypoint: ${validation.error}`, 'simulateMovement');
        }
        
        await context.setGeolocation({
          latitude: waypoint.latitude,
          longitude: waypoint.longitude,
          accuracy: waypoint.accuracy
        });
        
        this.currentLocation = waypoint;
        
        // Wait before next movement
        if (intervalMs > 0) {
          await new Promise(resolve => setTimeout(resolve, intervalMs));
        }
      }
      
      return formatSuccess('simulateMovement', {
        waypoints: waypoints.length,
        totalTime: waypoints.length * intervalMs,
        finalLocation: waypoints[waypoints.length - 1]
      });
    } catch (error) {
      return formatError(`Movement simulation failed: ${(error as Error).message}`, 'simulateMovement');
    }
  }

  /**
   * Set location with timezone
   */
  async setLocationWithTimezone(
    page: Page,
    preset: string
  ): Promise<ActionResult> {
    try {
      const location = this.presets.get(preset.toLowerCase());
      if (!location) {
        return formatError(`Unknown location preset: ${preset}`, 'setLocationWithTimezone');
      }

      // Set geolocation
      const geoResult = await this.setGeolocation(page, preset);
      if (!geoResult.success) {
        return geoResult;
      }

      // Set timezone if available
      if (location.timezone) {
        // Note: Playwright doesn't directly support timezone override after context creation
        // This would need to be set when creating the browser context
        // We'll return the timezone info for the user to handle
      }

      return formatSuccess('setLocationWithTimezone', {
        location: location.name,
        coordinates: location.coordinates,
        timezone: location.timezone,
        locale: location.locale,
        note: 'Timezone must be set when creating browser context'
      });
    } catch (error) {
      return formatError(`Failed to set location with timezone: ${(error as Error).message}`, 'setLocationWithTimezone');
    }
  }

  /**
   * Get available location presets
   */
  getPresets(): LocationPreset[] {
    return Array.from(this.presets.values());
  }

  /**
   * Get preset by name
   */
  getPreset(name: string): LocationPreset | undefined {
    return this.presets.get(name.toLowerCase());
  }

  /**
   * Add custom preset
   */
  addPreset(key: string, preset: LocationPreset): void {
    this.presets.set(key.toLowerCase(), preset);
  }

  /**
   * Calculate distance between two coordinates (in meters)
   */
  calculateDistance(from: GeolocationCoordinates, to: GeolocationCoordinates): number {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = from.latitude * Math.PI / 180;
    const φ2 = to.latitude * Math.PI / 180;
    const Δφ = (to.latitude - from.latitude) * Math.PI / 180;
    const Δλ = (to.longitude - from.longitude) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
  }

  /**
   * Generate random coordinates within a radius
   */
  generateRandomLocation(
    center: GeolocationCoordinates,
    radiusMeters: number
  ): GeolocationCoordinates {
    // Convert radius from meters to degrees
    const radiusInDegrees = radiusMeters / 111320;
    
    // Random angle
    const u = Math.random();
    const v = Math.random();
    const w = radiusInDegrees * Math.sqrt(u);
    const t = 2 * Math.PI * v;
    
    const x = w * Math.cos(t);
    const y = w * Math.sin(t);
    
    // Adjust for latitude
    const newLat = center.latitude + y;
    const newLng = center.longitude + (x / Math.cos(center.latitude * Math.PI / 180));
    
    return {
      latitude: Math.max(-90, Math.min(90, newLat)),
      longitude: Math.max(-180, Math.min(180, newLng)),
      accuracy: center.accuracy || 10
    };
  }

  /**
   * Validate coordinates
   */
  private validateCoordinates(coords: GeolocationCoordinates): { valid: boolean; error?: string } {
    if (coords.latitude < -90 || coords.latitude > 90) {
      return { valid: false, error: `Invalid latitude: ${coords.latitude}. Must be between -90 and 90` };
    }
    
    if (coords.longitude < -180 || coords.longitude > 180) {
      return { valid: false, error: `Invalid longitude: ${coords.longitude}. Must be between -180 and 180` };
    }
    
    if (coords.accuracy !== undefined && coords.accuracy < 0) {
      return { valid: false, error: `Invalid accuracy: ${coords.accuracy}. Must be positive` };
    }
    
    return { valid: true };
  }

  /**
   * Create a path between two points with intermediate waypoints
   */
  generatePath(
    from: GeolocationCoordinates,
    to: GeolocationCoordinates,
    steps: number = 10
  ): GeolocationCoordinates[] {
    const path: GeolocationCoordinates[] = [];
    
    for (let i = 0; i <= steps; i++) {
      const fraction = i / steps;
      const lat = from.latitude + (to.latitude - from.latitude) * fraction;
      const lng = from.longitude + (to.longitude - from.longitude) * fraction;
      
      path.push({
        latitude: lat,
        longitude: lng,
        accuracy: from.accuracy || 10
      });
    }
    
    return path;
  }

  /**
   * Test geolocation API on current page
   */
  async testGeolocation(page: Page): Promise<ActionResult> {
    try {
      // Check if geolocation is available
      const hasGeo = await page.evaluate(() => {
        return 'geolocation' in navigator;
      });
      
      if (!hasGeo) {
        return formatError('Geolocation API not available in browser', 'testGeolocation');
      }
      
      // Try to get current position
      const position = await page.evaluate(() => {
        return new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => resolve({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              accuracy: pos.coords.accuracy,
              altitude: pos.coords.altitude,
              altitudeAccuracy: pos.coords.altitudeAccuracy,
              heading: pos.coords.heading,
              speed: pos.coords.speed
            }),
            (err) => reject(err.message),
            { timeout: 5000 }
          );
        });
      }).catch(err => ({ error: err }));
      
      if (position && typeof position === 'object' && 'error' in position) {
        return formatSuccess('testGeolocation', {
          available: true,
          permission: 'denied',
          error: (position as any).error
        });
      }
      
      return formatSuccess('testGeolocation', {
        available: true,
        permission: 'granted',
        position
      });
    } catch (error) {
      return formatError(`Geolocation test failed: ${(error as Error).message}`, 'testGeolocation');
    }
  }
}