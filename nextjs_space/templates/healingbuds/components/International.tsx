'use client';

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import InteractiveMap, { countries, type Country, type CountryStatus } from './InteractiveMap';
import { MapPin, Building2, TrendingUp } from "lucide-react";

export default function International() {
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);

  // Get countries in Stage-1 order
  const sortedCountries = Object.entries(countries)
    .sort(([, a], [, b]) => a.order - b.order)
    .map(([id, data]) => ({ id, ...data }));

  const getStatusColor = (status: CountryStatus) => {
    switch (status) {
      case 'LIVE':
        return 'bg-gradient-to-r from-emerald-500/20 to-emerald-600/20 text-emerald-700 border-emerald-300/50 shadow-emerald-200/50';
      case 'NEXT':
        return 'bg-gradient-to-r from-primary/20 to-primary-dark/20 text-primary border-primary/30 shadow-primary/20';
      case 'UPCOMING':
        return 'bg-gradient-to-r from-slate-500/20 to-slate-600/20 text-slate-700 border-slate-300/50 shadow-slate-200/50';
    }
  };

  return (
    <div className="px-2 mt-8">
      <section className="relative py-16 sm:py-20 md:py-24 overflow-hidden rounded-2xl sm:rounded-3xl border border-white/10 bg-primary text-primary-foreground">
        <div className="absolute inset-0 bg-gradient-to-br from-black/[0.1] via-transparent to-black/[0.2] pointer-events-none" />

        <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="w-full max-w-7xl mx-auto">
            <div className="text-center mb-12 sm:mb-16 relative z-10">
              <h2 className="text-4xl sm:text-5xl md:text-6xl font-bold text-white mb-4 tracking-tight">
                Global Presence
              </h2>
              <p className="text-lg sm:text-xl text-primary-foreground/90 max-w-2xl mx-auto leading-relaxed">
                Strategic expansion across three countries, building a comprehensive medical cannabis network
              </p>
            </div>

            {/* Interactive Map */}
            <div className="relative h-[450px] sm:h-[500px] md:h-[600px] mb-12 sm:mb-16 rounded-2xl overflow-hidden shadow-2xl border border-white/10">
              <InteractiveMap
                selectedCountry={selectedCountry}
                onCountrySelect={setSelectedCountry}
              />
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6 relative z-10">
              {sortedCountries.map((country, idx) => (
                <button
                  key={country.id}
                  onClick={() => setSelectedCountry(selectedCountry === country.id ? null : country.id)}
                  className={`
                    group relative p-6 rounded-2xl border transition-all duration-500 overflow-hidden
                    ${selectedCountry === country.id
                      ? 'border-primary/60 shadow-2xl scale-[1.03] bg-gradient-to-br from-card via-card to-primary/5'
                      : 'border-border/30 bg-gradient-to-br from-card to-card/95 hover:border-primary/50 hover:shadow-xl hover:scale-[1.02] hover:-translate-y-1'
                    }
                  `}
                >
                  <div className={`absolute inset-0 bg-gradient-to-br transition-opacity duration-500 ${selectedCountry === country.id
                    ? 'from-primary/10 via-transparent to-secondary/10 opacity-100'
                    : 'from-primary/5 via-transparent to-secondary/5 opacity-0 group-hover:opacity-100'
                    }`} />

                  <div className="relative z-10">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className={`
                          w-14 h-14 rounded-xl flex items-center justify-center transition-all duration-500 shadow-lg
                          ${selectedCountry === country.id
                            ? 'bg-gradient-to-br from-primary to-primary/80 scale-110 rotate-3'
                            : 'bg-gradient-to-br from-muted to-muted/80 group-hover:from-primary/20 group-hover:to-primary/10 group-hover:scale-105'
                          }
                        `}>
                          <MapPin
                            className={`w-7 h-7 transition-all duration-500 ${selectedCountry === country.id
                              ? 'text-white'
                              : 'text-muted-foreground group-hover:text-primary'
                              }`}
                            strokeWidth={2.5}
                          />
                        </div>
                        <div className="text-left">
                          <h3 className="text-xl font-bold text-foreground mb-1">
                            {country.name}
                          </h3>
                          <Badge className={`text-[10px] font-bold tracking-wider ${getStatusColor(country.status)}`}>
                            {country.status}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    <p className="text-muted-foreground mb-4 leading-relaxed">
                      {country.description}
                    </p>

                    <div className="flex items-center gap-4 text-sm text-muted-foreground/70">
                      <div className="flex items-center gap-1.5">
                        <Building2 className="w-4 h-4" />
                        <span>{country.locations.length} {country.locations.length === 1 ? 'location' : 'locations'}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <TrendingUp className="w-4 h-4" />
                        <span>{country.status === 'LIVE' ? 'Growing' : country.status === 'NEXT' ? 'Expanding' : 'Planning'}</span>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}