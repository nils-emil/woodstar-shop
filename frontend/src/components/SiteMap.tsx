import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { PublicSite } from '@/api/types'

type Located = PublicSite & { lat: number; lng: number }

const hasCoords = (s: PublicSite): s is Located => s.lat !== null && s.lng !== null

export function sitesOnMap(sites: PublicSite[]): Located[] {
  return sites.filter(hasCoords)
}

function pin(name: string, selected: boolean) {
  const label = name.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)
  return L.divIcon({
    className: '',
    html: `<span class="map-pin${selected ? ' is-selected' : ''}"><span class="map-pin-dot"></span><span class="map-pin-name">${label}</span></span>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  })
}

/**
 * OpenStreetMap with one pin per location; clicking a pin selects that location.
 * Only locations with coordinates are shown (set them in admin under Asukohad).
 */
export function SiteMap({
  sites,
  selectedId,
  onSelect,
  label,
}: {
  sites: PublicSite[]
  selectedId?: string
  onSelect: (id: string) => void
  label: string
}) {
  const el = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const layer = useRef<L.LayerGroup | null>(null)
  const located = sitesOnMap(sites)
  const key = located.map((s) => `${s.id}:${s.lat}:${s.lng}`).join('|')
  // the container only exists once at least one location has coordinates
  const ready = located.length > 0

  useEffect(() => {
    if (!el.current || map.current) return
    const m = L.map(el.current, {
      scrollWheelZoom: false,
      dragging: !L.Browser.mobile,
      attributionControl: true,
    })
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(m)
    layer.current = L.layerGroup().addTo(m)
    map.current = m
    return () => {
      m.remove()
      map.current = null
      layer.current = null
    }
  }, [ready])

  // Frame all locations whenever the set of locations changes.
  useEffect(() => {
    const m = map.current
    if (!m || !ready) return
    const bounds = L.latLngBounds(located.map((s) => [s.lat, s.lng] as [number, number]))
    // pin labels sit to the right of the pin, so leave more room on that side (less on a phone)
    const right = Math.min(170, m.getSize().x * 0.35)
    m.fitBounds(bounds, { paddingTopLeft: [30, 40], paddingBottomRight: [right, 40], maxZoom: 13 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, ready])

  // Redraw pins when the selection changes.
  useEffect(() => {
    const group = layer.current
    if (!group) return
    group.clearLayers()
    for (const s of located) {
      L.marker([s.lat, s.lng], {
        icon: pin(s.name, s.id === selectedId),
        title: s.name,
        keyboard: true,
        zIndexOffset: s.id === selectedId ? 1000 : 0,
      })
        .on('click', () => onSelect(s.id))
        .addTo(group)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, selectedId, ready])

  if (!ready) return null
  return <div ref={el} className="site-map" data-ui role="region" aria-label={label} />
}
