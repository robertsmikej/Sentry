import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { Encounter } from '../types'

// Fix Leaflet default marker icon issue with bundlers
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
})

// Custom marker icons for different experiences
const createMarkerIcon = (color: string) => {
  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="
      width: 24px;
      height: 24px;
      background-color: ${color};
      border: 3px solid white;
      border-radius: 50%;
      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
    "></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12],
  })
}

const experienceColors = {
  good: '#22c55e',    // green-500
  neutral: '#eab308', // yellow-500
  bad: '#ef4444',     // red-500
}

interface EncounterMapProps {
  encounters: Encounter[]
  height?: string
  className?: string
  onMarkerClick?: (encounter: Encounter) => void
  showPlaceholder?: boolean // Show placeholder when no location data (default: false)
}

export function EncounterMap({
  encounters,
  height = '200px',
  className = '',
  onMarkerClick,
  showPlaceholder = false
}: EncounterMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<L.Map | null>(null)

  // Filter to only encounters with GPS data
  const encountersWithLocation = encounters.filter(e => e.location)

  useEffect(() => {
    if (!mapRef.current || encountersWithLocation.length === 0) return

    // Initialize map if not already done
    if (!mapInstanceRef.current) {
      mapInstanceRef.current = L.map(mapRef.current, {
        zoomControl: false, // Hide zoom controls for compact view
        attributionControl: false, // Hide attribution for compact view
      })

      // Add OpenStreetMap tiles
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
      }).addTo(mapInstanceRef.current)
    }

    const map = mapInstanceRef.current

    // Clear existing markers
    map.eachLayer((layer) => {
      if (layer instanceof L.Marker) {
        map.removeLayer(layer)
      }
    })

    // Add markers for each encounter
    const markers: L.Marker[] = []
    encountersWithLocation.forEach((encounter) => {
      if (!encounter.location) return

      const color = experienceColors[encounter.experience || 'neutral']
      const marker = L.marker(
        [encounter.location.latitude, encounter.location.longitude],
        { icon: createMarkerIcon(color) }
      )

      // Add popup with plate info
      const popupContent = `
        <div style="font-family: ui-monospace, monospace; font-weight: bold;">
          ${encounter.plateCode}
        </div>
        <div style="font-size: 12px; color: #666;">
          ${new Date(encounter.timestamp).toLocaleDateString()}
        </div>
      `
      marker.bindPopup(popupContent)

      if (onMarkerClick) {
        marker.on('click', () => onMarkerClick(encounter))
      }

      marker.addTo(map)
      markers.push(marker)
    })

    // Fit map to show all markers
    if (markers.length > 0) {
      const group = L.featureGroup(markers)
      map.fitBounds(group.getBounds(), { padding: [20, 20], maxZoom: 15 })
    }

    return () => {
      // Cleanup on unmount
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }
    }
  }, [encountersWithLocation, onMarkerClick])

  // Hide or show placeholder if no encounters have location data
  if (encountersWithLocation.length === 0) {
    if (!showPlaceholder) return null

    return (
      <div
        className={`bg-base-100 rounded-lg flex items-center justify-center shadow-md border border-base-300 ${className}`}
        style={{ height }}
      >
        <div className="text-center text-base-content/50 p-4">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" className="w-8 h-8 mx-auto mb-2 opacity-50">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
          </svg>
          <p className="text-sm">No location data yet</p>
          <p className="text-xs mt-1">Encounters with coordinates will appear here</p>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={mapRef}
      className={`rounded-lg overflow-hidden shadow-md border border-base-300 ${className}`}
      style={{ height }}
    />
  )
}
