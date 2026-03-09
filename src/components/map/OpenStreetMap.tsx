import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix default marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

interface MapMarker {
  lat: number;
  lng: number;
  label?: string;
  color?: 'blue' | 'red' | 'green' | 'orange';
  popup?: string;
}

interface RouteLine {
  from: { lat: number; lng: number };
  to: { lat: number; lng: number };
  color?: string;
  dashed?: boolean;
}

interface OpenStreetMapProps {
  center?: { lat: number; lng: number };
  zoom?: number;
  markers?: MapMarker[];
  routes?: RouteLine[];
  className?: string;
  onMapClick?: (lat: number, lng: number) => void;
  showUserLocation?: boolean;
  userPosition?: { lat: number; lng: number } | null;
}

const MARKER_COLORS: Record<string, string> = {
  blue: '#2563eb',
  red: '#dc2626',
  green: '#16a34a',
  orange: '#ea580c',
};

function createColoredIcon(color: string) {
  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="background:${color};width:24px;height:24px;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);"></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12],
  });
}

export default function OpenStreetMap({
  center,
  zoom = 13,
  markers = [],
  routes = [],
  className = 'h-[300px] w-full rounded-lg',
  onMapClick,
  showUserLocation = false,
  userPosition,
}: OpenStreetMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);

  const defaultCenter = center || userPosition || { lat: 18.4861, lng: -69.9312 };

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const map = L.map(mapRef.current).setView([defaultCenter.lat, defaultCenter.lng], zoom);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    markersLayerRef.current = L.layerGroup().addTo(map);

    if (onMapClick) {
      map.on('click', (e: L.LeafletMouseEvent) => {
        onMapClick(e.latlng.lat, e.latlng.lng);
      });
    }

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update markers and routes
  useEffect(() => {
    if (!markersLayerRef.current) return;
    markersLayerRef.current.clearLayers();

    // User location marker
    if (showUserLocation && userPosition) {
      const userIcon = L.divIcon({
        className: 'user-location-marker',
        html: `<div style="background:hsl(220,85%,57%);width:16px;height:16px;border-radius:50%;border:3px solid white;box-shadow:0 0 0 4px rgba(37,99,235,0.3),0 2px 8px rgba(0,0,0,0.3);animation:pulse 2s infinite;"></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });
      L.marker([userPosition.lat, userPosition.lng], { icon: userIcon })
        .bindPopup('📍 Votre position')
        .addTo(markersLayerRef.current);
    }

    // Draw route lines
    routes.forEach((route) => {
      const polyline = L.polyline(
        [[route.from.lat, route.from.lng], [route.to.lat, route.to.lng]],
        {
          color: route.color || '#2563eb',
          weight: 4,
          opacity: 0.7,
          dashArray: route.dashed ? '10, 10' : undefined,
        }
      );
      polyline.addTo(markersLayerRef.current!);
    });

    // Draw markers
    markers.forEach((m) => {
      const icon = m.color ? createColoredIcon(MARKER_COLORS[m.color] || MARKER_COLORS.blue) : undefined;
      const marker = icon
        ? L.marker([m.lat, m.lng], { icon })
        : L.marker([m.lat, m.lng]);
      
      if (m.popup || m.label) {
        marker.bindPopup(m.popup || m.label || '');
      }
      marker.addTo(markersLayerRef.current!);
    });

    // Fit bounds if multiple markers
    const allPoints: [number, number][] = markers.map((m) => [m.lat, m.lng]);
    if (showUserLocation && userPosition) {
      allPoints.push([userPosition.lat, userPosition.lng]);
    }
    routes.forEach((r) => {
      allPoints.push([r.from.lat, r.from.lng]);
      allPoints.push([r.to.lat, r.to.lng]);
    });
    if (allPoints.length > 1 && mapInstanceRef.current) {
      mapInstanceRef.current.fitBounds(allPoints, { padding: [40, 40] });
    }
  }, [markers, routes, userPosition, showUserLocation]);

  // Recenter when center changes
  useEffect(() => {
    if (center && mapInstanceRef.current) {
      mapInstanceRef.current.setView([center.lat, center.lng], zoom);
    }
  }, [center?.lat, center?.lng]);

  return <div ref={mapRef} className={className} />;
}
