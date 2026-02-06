'use client';

import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Button } from '@/components/ui/button';
import { Sparkles, ChevronDown, Play, Pause, Filter } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

type LocationType = 'operations-sales' | 'export-only' | 'operations-only';

interface Location {
  name: string;
  coordinates: [number, number];
  type: LocationType;
  cultivationArea?: string;
  productionCapacity?: string;
  certifications?: string[];
  licensedPartner?: string;
  regulatoryBody?: string;
  medicalLicense?: boolean;
}

type CountryStatus = 'LIVE' | 'NEXT' | 'UPCOMING';

interface Country {
  name: string;
  center: [number, number];
  zoom: number;
  locations: Location[];
  status: CountryStatus;
  order: number;
  description: string;
}

// MapLibre GL doesn't require an access token for basic usage

// Stage-1 Countries in exact chronological order
const countries: Record<string, Country> = {
  southAfrica: {
    name: 'South Africa',
    center: [24.9916, -28.4793],
    zoom: 5,
    status: 'LIVE',
    order: 1,
    description: 'Licensed partner facility - Fully compliant medical cannabis operations',
    locations: [
      { 
        name: 'Cape Town', 
        coordinates: [18.4241, -33.9249], 
        type: 'operations-sales',
        cultivationArea: '15,000 m²',
        productionCapacity: '2,500 kg/year',
        certifications: ['GMP', 'EU-GMP', 'ISO 9001'],
        licensedPartner: 'South African Health Products Regulatory Authority',
        regulatoryBody: 'SAHPRA',
        medicalLicense: true
      },
      { 
        name: 'Johannesburg', 
        coordinates: [28.0473, -26.2041], 
        type: 'operations-only',
        cultivationArea: '8,000 m²',
        productionCapacity: '1,200 kg/year',
        certifications: ['GMP', 'ISO 9001'],
        licensedPartner: 'South African Health Products Regulatory Authority',
        regulatoryBody: 'SAHPRA',
        medicalLicense: true
      },
    ],
  },
  portugal: {
    name: 'Portugal',
    center: [-8.2245, 39.3999],
    zoom: 6,
    status: 'NEXT',
    order: 2,
    description: 'Licensed EU partner facility - Primary European medical cannabis hub with full regulatory compliance',
    locations: [
      { 
        name: 'Lisbon', 
        coordinates: [-9.1393, 38.7223], 
        type: 'operations-sales',
        cultivationArea: '12,000 m²',
        productionCapacity: '2,000 kg/year',
        certifications: ['EU-GMP', 'ISO 22000', 'Organic Certified'],
        licensedPartner: 'INFARMED - Portuguese Medicines Authority',
        regulatoryBody: 'INFARMED',
        medicalLicense: true
      },
      { 
        name: 'Porto', 
        coordinates: [-8.6291, 41.1579], 
        type: 'export-only',
        cultivationArea: 'N/A',
        productionCapacity: 'N/A',
        certifications: ['Export License', 'EU Distribution'],
        licensedPartner: 'INFARMED - Portuguese Medicines Authority',
        regulatoryBody: 'INFARMED',
        medicalLicense: true
      },
    ],
  },
  uk: {
    name: 'United Kingdom',
    center: [-3.4360, 55.3781],
    zoom: 5,
    status: 'UPCOMING',
    order: 3,
    description: 'Planned licensed partner facility - Subject to MHRA regulatory approval',
    locations: [
      { 
        name: 'London', 
        coordinates: [-0.1276, 51.5074], 
        type: 'operations-sales',
        cultivationArea: '10,000 m²',
        productionCapacity: '1,800 kg/year',
        certifications: ['GMP', 'MHRA Approved'],
        licensedPartner: 'UK Medicines and Healthcare products Regulatory Agency',
        regulatoryBody: 'MHRA',
        medicalLicense: true
      },
      { 
        name: 'Manchester', 
        coordinates: [-2.2426, 53.4808], 
        type: 'export-only',
        cultivationArea: 'N/A',
        productionCapacity: 'N/A',
        certifications: ['Export License', 'UK Distribution'],
        licensedPartner: 'UK Medicines and Healthcare products Regulatory Agency',
        regulatoryBody: 'MHRA',
        medicalLicense: true
      },
    ],
  },
};

type LayerFilter = 'all' | 'operations-sales' | 'export-only' | 'operations-only';

interface InteractiveMapProps {
  selectedCountry: string | null;
  onCountrySelect?: (countryId: string) => void;
}

const InteractiveMap = ({ selectedCountry, onCountrySelect }: InteractiveMapProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markers = useRef<maplibregl.Marker[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [activeLayer, setActiveLayer] = useState<LayerFilter>('all');
  const [isCardExpanded, setIsCardExpanded] = useState(false);
  const [selectedCertifications, setSelectedCertifications] = useState<string[]>([]);
  const [showCertFilter, setShowCertFilter] = useState(false);
  const [isAutoTourActive, setIsAutoTourActive] = useState(false);
  const [currentTourIndex, setCurrentTourIndex] = useState(0);
  const tourIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!mapContainer.current) return;
    
    // Create a custom style with OSM tiles
    const mapStyle = {
      version: 8,
      sources: {
        'osm-tiles': {
          type: 'raster',
          tiles: [
            'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
            'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f2/Tiled_web_map_numbering.png/320px-Tiled_web_map_numbering.png',
            'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png'
          ],
          tileSize: 256,
          attribution: '© OpenStreetMap contributors',
          maxzoom: 19
        }
      },
      layers: [
        {
          id: 'osm-tiles',
          type: 'raster',
          source: 'osm-tiles',
          minzoom: 0,
          maxzoom: 22
        }
      ]
    };
    
    // Start zoomed into South Africa (first live location)
    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: mapStyle as any,
      center: [24.9916, -28.4793], // South Africa center
      zoom: 5,
    });

    const navControl = new maplibregl.NavigationControl({
      visualizePitch: false,
      showCompass: false,
    });
    map.current.addControl(navControl, 'top-right');
    
    // Add custom z-index to navigation control
    const navControlContainer = document.querySelector('.maplibregl-ctrl-top-right');
    if (navControlContainer) {
      (navControlContainer as HTMLElement).style.zIndex = '25';
    }

    map.current.on('load', () => {
      setIsLoaded(true);
    });

    return () => {
      markers.current.forEach(marker => marker.remove());
      markers.current = [];
      map.current?.remove();
      if (tourIntervalRef.current) {
        clearInterval(tourIntervalRef.current);
      }
    };
  }, []);

  // Auto-tour functionality
  useEffect(() => {
    if (!isAutoTourActive || !isLoaded) {
      if (tourIntervalRef.current) {
        clearInterval(tourIntervalRef.current);
        tourIntervalRef.current = null;
      }
      return;
    }

    // Collect all locations from all countries
    const allLocations: Array<{ location: Location; country: Country }> = [];
    Object.values(countries).forEach(country => {
      country.locations.forEach(location => {
        allLocations.push({ location, country });
      });
    });

    if (allLocations.length === 0) return;

    // Start tour
    const cycleTour = () => {
      setCurrentTourIndex(prev => {
        const nextIndex = (prev + 1) % allLocations.length;
        const { location, country } = allLocations[nextIndex];
        
        if (map.current) {
          map.current.flyTo({
            center: location.coordinates,
            zoom: 7,
            duration: 2000,
            curve: 1.2,
            essential: true,
          });
        }
        
        return nextIndex;
      });
    };

    // Initial location
    const { location } = allLocations[currentTourIndex];
    if (map.current) {
      map.current.flyTo({
        center: location.coordinates,
        zoom: 7,
        duration: 2000,
        curve: 1.2,
        essential: true,
      });
    }

    tourIntervalRef.current = setInterval(cycleTour, 4000);

    return () => {
      if (tourIntervalRef.current) {
        clearInterval(tourIntervalRef.current);
        tourIntervalRef.current = null;
      }
    };
  }, [isAutoTourActive, isLoaded, currentTourIndex]);

  const toggleAutoTour = () => {
    setIsAutoTourActive(!isAutoTourActive);
    if (isAutoTourActive) {
      setCurrentTourIndex(0);
    }
  };

  const availableCertifications = ['GMP', 'EU-GMP', 'ISO 9001', 'ISO 22000', 'Organic Certified'];

  const toggleCertification = (cert: string) => {
    setSelectedCertifications(prev => 
      prev.includes(cert) 
        ? prev.filter(c => c !== cert)
        : [...prev, cert]
    );
  };

  useEffect(() => {
    if (!map.current || !isLoaded) return;

    const country = selectedCountry ? countries[selectedCountry] : null;
    
    if (country) {
      map.current.flyTo({
        center: country.center,
        zoom: country.zoom,
        duration: 1500,
        essential: true,
        curve: 1.42,
      });
    } else {
      map.current.flyTo({
        center: [20, 20],
        zoom: 2,
        duration: 1500,
      });
    }

    // Remove old markers
    markers.current.forEach(marker => marker.remove());
    markers.current = [];

    // Add markers for all or selected country
    const countriesToShow = selectedCountry 
      ? [countries[selectedCountry]]
      : Object.values(countries);

    countriesToShow.forEach((countryData) => {
      countryData.locations.forEach((location, idx) => {
        // Filter by active layer
        if (activeLayer !== 'all' && location.type !== activeLayer) return;

        // Filter by certifications
        if (selectedCertifications.length > 0) {
          const hasCertification = selectedCertifications.some(cert => 
            location.certifications?.some(locationCert => 
              locationCert.includes(cert) || cert.includes(locationCert)
            )
          );
          if (!hasCertification) return;
        }

        const el = document.createElement('div');
        el.className = 'marker';
        el.style.width = '32px';
        el.style.height = '32px';
        el.style.borderRadius = '50%';
        el.style.cursor = 'pointer';
        el.style.transition = 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)';
        el.style.boxShadow = '0 4px 20px rgba(0,0,0,0.15), 0 1px 3px rgba(0,0,0,0.1), 0 0 0 3px white';
        
        // Design system colors for markers
        const colorMap: Record<LocationType, string> = {
          'operations-sales': 'hsl(142, 76%, 36%)',   // Primary green
          'export-only': 'hsl(160, 84%, 39%)',        // Teal accent
          'operations-only': 'hsl(173, 58%, 39%)',    // Secondary teal
        };
        
        el.style.backgroundColor = colorMap[location.type];
        
        // Staggered entrance animation
        setTimeout(() => {
          el.style.opacity = '1';
          el.style.transform = 'scale(1)';
        }, idx * 100);
        
        el.style.opacity = '0';
        el.style.transform = 'scale(0)';

        // Quick stats tooltip
        const quickTooltip = new maplibregl.Popup({ 
          offset: 15,
          className: 'map-quick-tooltip',
          closeButton: false,
          maxWidth: '220px',
          closeOnClick: false,
        })
          .setHTML(`
            <div style="padding: 8px 12px; font-family: 'Inter', system-ui, -apple-system, sans-serif; background: rgba(0, 0, 0, 0.9); backdrop-blur-md; border-radius: 10px; box-shadow: 0 10px 30px rgba(0,0,0,0.3);">
              <div style="font-weight: 700; font-size: 12px; margin-bottom: 4px; color: ${colorMap[location.type]}; letter-spacing: -0.2px;">${location.name}</div>
              <div style="font-size: 10px; color: rgba(255, 255, 255, 0.7); margin-bottom: 6px;">${countryData.name}</div>
              ${location.cultivationArea ? `
                <div style="display: flex; justify-content: space-between; font-size: 9px; margin-bottom: 3px;">
                  <span style="color: rgba(255, 255, 255, 0.6);">Area:</span>
                  <span style="color: white; font-weight: 600;">${location.cultivationArea}</span>
                </div>
              ` : ''}
              ${location.productionCapacity ? `
                <div style="display: flex; justify-content: space-between; font-size: 9px; margin-bottom: 3px;">
                  <span style="color: rgba(255, 255, 255, 0.6);">Capacity:</span>
                  <span style="color: white; font-weight: 600;">${location.productionCapacity}</span>
                </div>
              ` : ''}
              ${location.certifications && location.certifications.length > 0 ? `
                <div style="margin-top: 6px; padding-top: 6px; border-top: 1px solid rgba(255, 255, 255, 0.1);">
                  <div style="font-size: 8px; color: rgba(255, 255, 255, 0.5); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 3px;">Certifications</div>
                  <div style="display: flex; flex-wrap: wrap; gap: 3px;">
                    ${location.certifications.slice(0, 3).map(cert => 
                      `<span style="display: inline-block; background: ${colorMap[location.type]}; color: white; padding: 2px 6px; border-radius: 4px; font-size: 8px; font-weight: 600;">${cert}</span>`
                    ).join('')}
                  </div>
                </div>
              ` : ''}
            </div>
          `);
        
        el.addEventListener('mouseenter', () => {
          el.style.transform = 'scale(1.4) translateY(-4px)';
          el.style.boxShadow = `0 0 40px ${colorMap[location.type]}, 0 12px 32px rgba(0,0,0,0.3), 0 0 0 4px white`;
          el.style.zIndex = '1000';
          quickTooltip.addTo(map.current!);
          
          // Smooth fly to the hovered marker
          if (!isAutoTourActive) {
            map.current?.flyTo({
              center: location.coordinates,
              zoom: Math.max(map.current.getZoom(), 6),
              duration: 800,
              curve: 1.2,
              essential: true,
            });
          }
        });
        
        el.addEventListener('mouseleave', () => {
          el.style.transform = 'scale(1)';
          el.style.boxShadow = '0 4px 20px rgba(0,0,0,0.15), 0 1px 3px rgba(0,0,0,0.1), 0 0 0 3px white';
          el.style.zIndex = 'auto';
          quickTooltip.remove();
        });
        
        el.addEventListener('click', () => {
          if (onCountrySelect) {
            const countryId = Object.keys(countries).find(
              key => countries[key].name === countryData.name
            );
            if (countryId) onCountrySelect(countryId);
          }
        });

        const typeLabels: Record<LocationType, string> = {
          'operations-sales': 'Operations & Sales',
          'export-only': 'Export Sales Only',
          'operations-only': 'Operations Only',
        };

        const certificationsHtml = location.certifications && location.certifications.length > 0
          ? location.certifications.map(cert => 
              `<span style="display: inline-block; background: hsl(142, 76%, 96%); color: hsl(142, 76%, 36%); padding: 4px 10px; border-radius: 6px; font-size: 10px; font-weight: 600; border: 1px solid hsl(142, 76%, 88%); margin-right: 4px; margin-bottom: 4px;">${cert}</span>`
            ).join('')
          : '<span style="font-size: 12px; color: hsl(215, 16%, 47%); font-style: italic;">None specified</span>';

        const isMobile = window.innerWidth < 640;
        const popup = new maplibregl.Popup({ 
          offset: isMobile ? 25 : 35, 
          className: 'map-popup',
          closeButton: false,
          maxWidth: isMobile ? '280px' : '380px',
          closeOnClick: false,
        })
          .setHTML(`
            <div style="padding: ${isMobile ? '14px 16px' : '20px 22px'}; font-family: 'Inter', system-ui, -apple-system, sans-serif; background: hsl(0, 0%, 100%); border-radius: ${isMobile ? '12px' : '16px'}; box-shadow: 0 20px 60px rgba(0,0,0,0.15), 0 0 1px rgba(0,0,0,0.1);">
              <!-- Licensed Partner Badge -->
              <div style="display: inline-flex; align-items: center; gap: ${isMobile ? '4px' : '6px'}; font-size: ${isMobile ? '8px' : '9px'}; color: hsl(160, 84%, 39%); background: hsl(160, 84%, 96%); padding: ${isMobile ? '3px 8px' : '4px 10px'}; border-radius: 6px; text-transform: uppercase; letter-spacing: 0.8px; font-weight: 700; margin-bottom: ${isMobile ? '8px' : '10px'}; border: 1px solid hsl(160, 84%, 88%);">
                <svg width="${isMobile ? '8' : '10'}" height="${isMobile ? '8' : '10'}" viewBox="0 0 10 10" fill="none" style="flex-shrink: 0;">
                  <path d="M5 0L6.12257 3.45492H9.75528L6.81636 5.59017L7.93893 9.04508L5 6.90983L2.06107 9.04508L3.18364 5.59017L0.244718 3.45492H3.87743L5 0Z" fill="hsl(160, 84%, 39%)"/>
                </svg>
                Licensed Partner
              </div>
              
              <div style="font-weight: 700; font-size: ${isMobile ? '15px' : '18px'}; margin-bottom: ${isMobile ? '4px' : '6px'}; color: hsl(142, 76%, 36%); letter-spacing: -0.4px; line-height: 1.2;">${countryData.name}</div>
              <div style="font-size: ${isMobile ? '13px' : '15px'}; color: hsl(215, 16%, 47%); margin-bottom: ${isMobile ? '10px' : '14px'}; font-weight: 500;">${location.name}</div>
              <div style="display: inline-flex; align-items: center; gap: ${isMobile ? '4px' : '6px'}; font-size: ${isMobile ? '9px' : '11px'}; color: hsl(142, 76%, 36%); background: hsl(142, 76%, 96%); padding: ${isMobile ? '4px 10px' : '6px 12px'}; border-radius: ${isMobile ? '6px' : '8px'}; text-transform: uppercase; letter-spacing: 0.6px; font-weight: 700; margin-bottom: ${isMobile ? '10px' : '14px'}; border: 1px solid hsl(142, 76%, 88%);">
                <div style="width: ${isMobile ? '5px' : '6px'}; height: ${isMobile ? '5px' : '6px'}; border-radius: 50%; background: hsl(142, 76%, 36%);"></div>
                ${typeLabels[location.type]}
              </div>
              
              ${location.licensedPartner ? `
              <div style="margin-bottom: ${isMobile ? '8px' : '10px'}; padding-bottom: ${isMobile ? '8px' : '10px'}; border-bottom: 1.5px solid hsl(215, 20%, 94%);">
                <div style="font-size: ${isMobile ? '9px' : '10px'}; color: hsl(215, 16%, 47%); font-weight: 600; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: ${isMobile ? '3px' : '4px'};">Regulatory Authority</div>
                <div style="font-size: ${isMobile ? '11px' : '12px'}; color: hsl(222.2, 84%, 4.9%); font-weight: 600; line-height: 1.4;">${location.licensedPartner}</div>
                ${location.regulatoryBody ? `<div style="font-size: ${isMobile ? '9px' : '10px'}; color: hsl(160, 84%, 39%); font-weight: 700; margin-top: 2px;">${location.regulatoryBody}</div>` : ''}
              </div>
              ` : ''}
              
              ${location.cultivationArea ? `
              <div style="margin-bottom: ${isMobile ? '8px' : '10px'}; padding-bottom: ${isMobile ? '8px' : '10px'}; border-bottom: 1.5px solid hsl(215, 20%, 94%);">
                <div style="font-size: ${isMobile ? '9px' : '10px'}; color: hsl(215, 16%, 47%); font-weight: 600; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: ${isMobile ? '3px' : '4px'};">Cultivation Area</div>
                <div style="font-size: ${isMobile ? '13px' : '14px'}; color: hsl(222.2, 84%, 4.9%); font-weight: 700;">${location.cultivationArea}</div>
              </div>
              ` : ''}
              
              ${location.productionCapacity ? `
              <div style="margin-bottom: ${isMobile ? '8px' : '10px'}; padding-bottom: ${isMobile ? '8px' : '10px'}; border-bottom: 1.5px solid hsl(215, 20%, 94%);">
                <div style="font-size: ${isMobile ? '9px' : '10px'}; color: hsl(215, 16%, 47%); font-weight: 600; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: ${isMobile ? '3px' : '4px'};">Production Capacity</div>
                <div style="font-size: ${isMobile ? '13px' : '14px'}; color: hsl(222.2, 84%, 4.9%); font-weight: 700;">${location.productionCapacity}</div>
              </div>
              ` : ''}
              
              <div style="margin-bottom: ${isMobile ? '8px' : '10px'}; padding-bottom: ${isMobile ? '8px' : '10px'}; border-bottom: 1.5px solid hsl(215, 20%, 94%);">
                <div style="font-size: ${isMobile ? '9px' : '10px'}; color: hsl(215, 16%, 47%); font-weight: 600; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: ${isMobile ? '4px' : '6px'};">Certifications</div>
                <div style="display: flex; flex-wrap: wrap; gap: ${isMobile ? '3px' : '4px'};">
                  ${certificationsHtml}
                </div>
              </div>
              
              ${location.medicalLicense ? `
              <div style="margin-bottom: ${isMobile ? '8px' : '10px'}; padding: ${isMobile ? '6px 10px' : '8px 12px'}; background: hsl(173, 58%, 96%); border-radius: ${isMobile ? '6px' : '8px'}; border: 1px solid hsl(173, 58%, 88%);">
                <div style="font-size: ${isMobile ? '9px' : '10px'}; color: hsl(173, 58%, 39%); font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px;">✓ Medical License Active</div>
              </div>
              ` : ''}
              
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: ${isMobile ? '8px' : '0'};">
                <span style="font-size: ${isMobile ? '10px' : '11px'}; color: hsl(215, 16%, 47%); font-weight: 600; text-transform: uppercase; letter-spacing: 0.8px;">Status</span>
                <span style="font-size: ${isMobile ? '12px' : '13px'}; color: hsl(142, 76%, 36%); font-weight: 700; letter-spacing: 0.2px;">${countryData.status}</span>
              </div>
              
              ${!isMobile ? `
              <!-- Compliance Disclaimer -->
              <div style="margin-top: 12px; padding-top: 12px; border-top: 1.5px solid hsl(215, 20%, 94%); font-size: 9px; color: hsl(215, 16%, 47%); line-height: 1.5; font-style: italic;">
                All operations conducted by licensed partners. Digital Key holders do not handle or sell cannabis products directly. Blockchain-verified seed-to-sale traceability ensures regulatory compliance.
              </div>
              ` : ''}
            </div>
          `);

        const marker = new maplibregl.Marker(el)
          .setLngLat(location.coordinates)
          .setPopup(popup)
          .addTo(map.current!);
        
        marker.getElement().dataset.tooltip = 'true';

        markers.current.push(marker);
      });
    });
  }, [selectedCountry, isLoaded, activeLayer, selectedCertifications, isAutoTourActive]);

  return (
    <div className="relative w-full h-full">
      {/* Compliance Disclaimer Banner - Positioned Below Zoom Controls */}
      <div className="absolute top-28 right-4 sm:right-6 z-20 max-w-xs hidden sm:block">
        {/* Glass card with enhanced glossy effect and pulsing glow */}
        <div 
          className="relative bg-gradient-to-br from-white/30 via-white/20 to-white/10 dark:from-white/20 dark:via-white/10 dark:to-white/5 backdrop-blur-2xl rounded-2xl shadow-[0_8px_32px_0_rgba(31,38,135,0.37),0_2px_8px_0_rgba(0,0,0,0.1)] border border-white/50 dark:border-white/30 p-4 overflow-hidden cursor-pointer transition-all duration-300 hover:shadow-[0_8px_32px_0_rgba(31,38,135,0.5),0_2px_8px_0_rgba(0,0,0,0.2)] animate-pulse-glow"
          onClick={() => setIsCardExpanded(!isCardExpanded)}
        >
          {/* Top glossy highlight */}
          <div className="absolute inset-0 bg-gradient-to-b from-white/40 via-white/10 to-transparent pointer-events-none rounded-2xl" />
          
          {/* Shimmer effect */}
          <div className="absolute inset-0 bg-gradient-to-br from-transparent via-white/20 to-transparent pointer-events-none rounded-2xl opacity-60" style={{ transform: 'translateX(-100%)', animation: 'shimmer 3s infinite' }} />
          
          {/* Content */}
          <div className="relative z-10">
            <div className="flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-teal-400 flex-shrink-0 mt-0.5 drop-shadow-[0_0_8px_rgba(20,184,166,0.6)] animate-pulse" />
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="text-xs font-bold text-white drop-shadow-md">Licensed Partner Network</div>
                  <ChevronDown 
                    className={`w-4 h-4 text-white/80 transition-transform duration-300 ${isCardExpanded ? 'rotate-180' : ''}`}
                  />
                </div>
                <p className="text-[10px] text-white/90 leading-relaxed drop-shadow-md">
                  All facilities operate under licensed partners with full regulatory compliance. Digital Key holders earn blockchain-verified rewards without handling cannabis products.
                </p>
              </div>
            </div>
            
            {/* Expanded content */}
            <div className={`overflow-hidden transition-all duration-500 ease-in-out ${isCardExpanded ? 'max-h-96 opacity-100 mt-4' : 'max-h-0 opacity-0'}`}>
              <div className="pt-4 border-t border-white/30 space-y-3">
                <div>
                  <div className="text-[10px] font-bold text-white/80 mb-1.5 uppercase tracking-wide drop-shadow-md">Key Features</div>
                  <ul className="space-y-1.5 text-[10px] text-white/90 drop-shadow-md">
                    <li className="flex items-start gap-2">
                      <span className="text-teal-400 mt-0.5">•</span>
                      <span>Blockchain-verified seed-to-sale traceability</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-teal-400 mt-0.5">•</span>
                      <span>Licensed partners in multiple regulated markets</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-teal-400 mt-0.5">•</span>
                      <span>GMP & EU-GMP certified facilities</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-teal-400 mt-0.5">•</span>
                      <span>Full regulatory compliance in all jurisdictions</span>
                    </li>
                  </ul>
                </div>
                
                <div>
                  <div className="text-[10px] font-bold text-white/80 mb-1.5 uppercase tracking-wide drop-shadow-md">Active Regions</div>
                  <div className="flex flex-wrap gap-1.5">
                    <span className="px-2 py-1 bg-white/20 text-white text-[9px] rounded-md font-semibold backdrop-blur-sm border border-white/30">South Africa</span>
                    <span className="px-2 py-1 bg-white/20 text-white text-[9px] rounded-md font-semibold backdrop-blur-sm border border-white/30">Portugal</span>
                    <span className="px-2 py-1 bg-white/20 text-white text-[9px] rounded-md font-semibold backdrop-blur-sm border border-white/30">UK (Coming)</span>
                  </div>
                </div>
                
                <div className="pt-2 text-[9px] text-white/70 italic leading-relaxed drop-shadow-md">
                  Digital Key NFT holders participate in revenue-sharing without direct product handling. All operations maintained by fully licensed entities.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Auto-Tour Control */}
      <div className="absolute bottom-4 left-4 sm:bottom-6 sm:left-6 z-30">
        <Button
          size="lg"
          onClick={toggleAutoTour}
          className="gap-2 font-semibold shadow-2xl hover:shadow-[0_0_30px_rgba(77,191,161,0.4)] transition-all duration-300"
        >
          {isAutoTourActive ? (
            <>
              <Pause className="w-5 h-5" />
              <span className="hidden sm:inline">Stop Tour</span>
            </>
          ) : (
            <>
              <Play className="w-5 h-5" />
              <span className="hidden sm:inline">Auto Tour</span>
            </>
          )}
        </Button>
      </div>

      {/* Layer Toggle Controls */}
      <div className="absolute top-4 left-4 sm:top-6 sm:left-6 z-30 bg-background backdrop-blur-md rounded-2xl shadow-2xl border border-border/60 p-3">
        <div className="flex flex-col gap-2">
          <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1 px-2">
            Filter Locations
          </div>
          <Button
            size="sm"
            variant={activeLayer === 'all' ? 'default' : 'ghost'}
            onClick={() => setActiveLayer('all')}
            className="justify-start text-sm font-semibold h-9"
          >
            All Locations
          </Button>
          <Button
            size="sm"
            variant={activeLayer === 'operations-sales' ? 'default' : 'ghost'}
            onClick={() => setActiveLayer('operations-sales')}
            className="justify-start text-sm h-9"
          >
            <div 
              className="w-3 h-3 rounded-full mr-2.5 border-2 shadow-sm" 
              style={{ 
                backgroundColor: activeLayer === 'operations-sales' ? 'hsl(var(--primary-foreground))' : 'hsl(142, 76%, 36%)',
                borderColor: activeLayer === 'operations-sales' ? 'hsl(var(--primary-foreground))' : 'hsl(142, 76%, 36%)',
              }} 
            />
            <span className="hidden sm:inline">Operations & Sales</span>
            <span className="sm:hidden">Ops & Sales</span>
          </Button>
          <Button
            size="sm"
            variant={activeLayer === 'export-only' ? 'default' : 'ghost'}
            onClick={() => setActiveLayer('export-only')}
            className="justify-start text-sm h-9"
          >
            <div 
              className="w-3 h-3 rounded-full mr-2.5 border-2 shadow-sm" 
              style={{ 
                backgroundColor: activeLayer === 'export-only' ? 'hsl(var(--primary-foreground))' : 'hsl(160, 84%, 39%)',
                borderColor: activeLayer === 'export-only' ? 'hsl(var(--primary-foreground))' : 'hsl(160, 84%, 39%)',
              }} 
            />
            <span className="hidden sm:inline">Export Only</span>
            <span className="sm:hidden">Export</span>
          </Button>
          <Button
            size="sm"
            variant={activeLayer === 'operations-only' ? 'default' : 'ghost'}
            onClick={() => setActiveLayer('operations-only')}
            className="justify-start text-sm h-9"
          >
            <div 
              className="w-3 h-3 rounded-full mr-2.5 border-2 shadow-sm" 
              style={{ 
                backgroundColor: activeLayer === 'operations-only' ? 'hsl(var(--primary-foreground))' : 'hsl(173, 58%, 39%)',
                borderColor: activeLayer === 'operations-only' ? 'hsl(var(--primary-foreground))' : 'hsl(173, 58%, 39%)',
              }} 
            />
            <span className="hidden sm:inline">Operations Only</span>
            <span className="sm:hidden">Operations</span>
          </Button>
          
          {/* Certification Filter Toggle */}
          <div className="mt-3 pt-3 border-t border-border/40">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowCertFilter(!showCertFilter)}
              className="justify-between text-sm h-9 w-full"
            >
              <span className="flex items-center gap-2">
                <Filter className="w-3.5 h-3.5" />
                Certifications
              </span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showCertFilter ? 'rotate-180' : ''}`} />
            </Button>
            
            {/* Certification Badges */}
            <div className={`overflow-hidden transition-all duration-300 ${showCertFilter ? 'max-h-64 opacity-100 mt-2' : 'max-h-0 opacity-0'}`}>
              <div className="flex flex-col gap-1.5 px-2">
                {availableCertifications.map(cert => (
                  <Badge
                    key={cert}
                    variant={selectedCertifications.includes(cert) ? 'default' : 'outline'}
                    className="cursor-pointer justify-center text-xs py-1.5 transition-all hover:scale-105"
                    onClick={() => toggleCertification(cert)}
                  >
                    {cert}
                  </Badge>
                ))}
                {selectedCertifications.length > 0 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setSelectedCertifications([])}
                    className="text-xs h-7 mt-1"
                  >
                    Clear All
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div 
        ref={mapContainer} 
        className="absolute inset-0 rounded-3xl overflow-hidden ring-1 ring-border/40"
      />
      
      {!isLoaded && (
        <div className="absolute inset-0 bg-background/95 backdrop-blur-sm rounded-3xl flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 border-[3px] border-primary/20 border-t-primary rounded-full animate-spin"></div>
            <p className="text-muted-foreground text-base font-medium tracking-wide">
              Loading map...
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export { countries };
export type { Country, CountryStatus };
export default InteractiveMap;