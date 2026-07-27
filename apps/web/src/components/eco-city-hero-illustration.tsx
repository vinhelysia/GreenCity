import type { SVGProps } from "react";

export function EcoCityHeroIllustration(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 540 400"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="h-full w-full select-none"
      aria-hidden="true"
      {...props}
    >
      <defs>
        <linearGradient id="skyGrad" x1="270" y1="0" x2="270" y2="400" gradientUnits="userSpaceOnUse">
          <stop stopColor="#EAF6EF" stopOpacity="0.8" />
          <stop offset="1" stopColor="#F7F8F4" stopOpacity="0.4" />
        </linearGradient>

        <linearGradient id="hillGrad1" x1="0" y1="200" x2="540" y2="400" gradientUnits="userSpaceOnUse">
          <stop stopColor="#176B4D" stopOpacity="0.12" />
          <stop offset="1" stopColor="#DDEFE5" stopOpacity="0.4" />
        </linearGradient>

        <linearGradient id="hillGrad2" x1="0" y1="260" x2="540" y2="400" gradientUnits="userSpaceOnUse">
          <stop stopColor="#176B4D" stopOpacity="0.25" />
          <stop offset="1" stopColor="#10543C" stopOpacity="0.15" />
        </linearGradient>

        <linearGradient id="buildingGrad1" x1="120" y1="120" x2="120" y2="340" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#EAF6EF" />
        </linearGradient>

        <linearGradient id="buildingGrad2" x1="240" y1="90" x2="240" y2="340" gradientUnits="userSpaceOnUse">
          <stop stopColor="#176B4D" />
          <stop offset="1" stopColor="#10543C" />
        </linearGradient>

        <linearGradient id="sunGrad" x1="430" y1="70" x2="430" y2="150" gradientUnits="userSpaceOnUse">
          <stop stopColor="#F2C94C" />
          <stop offset="1" stopColor="#F26B4A" stopOpacity="0.8" />
        </linearGradient>
      </defs>

      {/* Background ground & atmosphere */}
      <rect width="540" height="400" rx="16" fill="url(#skyGrad)" />

      {/* Eco Sun / Clean Energy Aura */}
      <circle cx="430" cy="85" r="45" fill="url(#sunGrad)" opacity="0.85" />
      <circle cx="430" cy="85" r="58" stroke="#F2C94C" strokeWidth="1.5" strokeDasharray="4 6" opacity="0.5" />

      {/* Decorative Organic Waves / Rays */}
      <path d="M-20 220 Q 150 160, 320 220 T 560 180 V 400 H -20 Z" fill="url(#hillGrad1)" />
      <path d="M-20 280 Q 200 230, 380 290 T 560 260 V 400 H -20 Z" fill="url(#hillGrad2)" />

      {/* Modern Eco City Buildings */}
      {/* Building 1 (Glass Eco Tower) */}
      <g>
        <rect x="70" y="140" width="70" height="200" rx="6" fill="url(#buildingGrad1)" stroke="#DCE6E0" strokeWidth="2" />
        <rect x="82" y="160" width="18" height="14" rx="2" fill="#176B4D" opacity="0.15" />
        <rect x="110" y="160" width="18" height="14" rx="2" fill="#176B4D" opacity="0.15" />
        <rect x="82" y="185" width="18" height="14" rx="2" fill="#176B4D" opacity="0.25" />
        <rect x="110" y="185" width="18" height="14" rx="2" fill="#F2C94C" opacity="0.6" />
        <rect x="82" y="210" width="18" height="14" rx="2" fill="#176B4D" opacity="0.15" />
        <rect x="110" y="210" width="18" height="14" rx="2" fill="#176B4D" opacity="0.2" />
        {/* Rooftop Garden */}
        <path d="M66 140 C 66 125, 144 125, 144 140 Z" fill="#176B4D" opacity="0.8" />
        <circle cx="85" cy="132" r="7" fill="#2D9CDB" opacity="0.6" />
      </g>

      {/* Building 2 (Main Emerald Sustainable Hub) */}
      <g>
        <rect x="160" y="90" width="95" height="250" rx="8" fill="url(#buildingGrad2)" />
        {/* Vertical Garden Strips */}
        <rect x="175" y="110" width="12" height="190" rx="4" fill="#EAF6EF" opacity="0.25" />
        <rect x="202" y="110" width="12" height="190" rx="4" fill="#EAF6EF" opacity="0.4" />
        <rect x="229" y="110" width="12" height="190" rx="4" fill="#EAF6EF" opacity="0.25" />
        {/* Solar Panel Array on roof */}
        <path d="M165 90 L 195 72 L 250 72 L 250 90 Z" fill="#2D9CDB" />
        <line x1="195" y1="72" x2="195" y2="90" stroke="#FFFFFF" strokeWidth="1" opacity="0.6" />
        <line x1="222" y1="72" x2="222" y2="90" stroke="#FFFFFF" strokeWidth="1" opacity="0.6" />
      </g>

      {/* Building 3 (Mid-size Community Center) */}
      <g>
        <rect x="270" y="170" width="75" height="170" rx="6" fill="#FFFFFF" stroke="#DCE6E0" strokeWidth="2" />
        <rect x="282" y="190" width="51" height="8" rx="2" fill="#F26B4A" opacity="0.8" />
        <rect x="282" y="210" width="51" height="8" rx="2" fill="#176B4D" opacity="0.2" />
        <rect x="282" y="230" width="51" height="8" rx="2" fill="#176B4D" opacity="0.3" />
        <rect x="282" y="250" width="51" height="8" rx="2" fill="#F2C94C" opacity="0.5" />
      </g>

      {/* Wind Turbine / Clean Power Motif */}
      <g stroke="#176B4D" strokeWidth="2" strokeLinecap="round" opacity="0.7">
        <line x1="390" y1="170" x2="390" y2="290" strokeWidth="3" />
        <path d="M390 170 L 370 145 M390 170 L 415 160 M390 170 L 385 195" strokeWidth="2.5" />
        <circle cx="390" cy="170" r="4" fill="#176B4D" />
      </g>

      {/* Recycling Loop Badge Motif in Foreground */}
      <g transform="translate(340, 220)">
        <rect width="140" height="90" rx="14" fill="#FFFFFF" stroke="#DCE6E0" strokeWidth="2" />
        <circle cx="45" cy="45" r="24" fill="#EAF6EF" />
        {/* Green Recycling Arrows */}
        <path
          d="M45 28 L49 34 H41 L45 28 Z M45 32 A 13 13 0 0 1 57 45 M57 45 L61 41 V49 H53 M55 46 A 13 13 0 0 1 35 52 M35 50 L31 54 H39"
          fill="#176B4D"
          stroke="#176B4D"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <text x="82" y="42" fill="#18302A" fontSize="13" fontWeight="700" fontFamily="sans-serif">Tái chế</text>
        <text x="82" y="58" fill="#F26B4A" fontSize="11" fontWeight="600" fontFamily="sans-serif">+50 Điểm</text>
      </g>

      {/* Foreground Urban Trees & Greenery */}
      {/* Tree 1 */}
      <path d="M45 340 V 270" stroke="#66756F" strokeWidth="4" strokeLinecap="round" />
      <circle cx="45" cy="255" r="25" fill="#176B4D" />
      <circle cx="35" cy="245" r="16" fill="#27AE60" opacity="0.9" />

      {/* Tree 2 */}
      <path d="M150 350 V 290" stroke="#66756F" strokeWidth="3" strokeLinecap="round" />
      <circle cx="150" cy="275" r="20" fill="#10543C" />
      <circle cx="160" cy="268" r="14" fill="#176B4D" />

      {/* Tree 3 */}
      <path d="M500 350 V 280" stroke="#66756F" strokeWidth="4" strokeLinecap="round" />
      <circle cx="500" cy="265" r="28" fill="#176B4D" />
      <circle cx="488" cy="255" r="18" fill="#F2C94C" opacity="0.4" />

      {/* Foreground Road/Path Hairline */}
      <path d="M-10 340 H 550" stroke="#176B4D" strokeWidth="3" opacity="0.3" />
      <path d="M-10 348 H 550" stroke="#F26B4A" strokeWidth="2" strokeDasharray="12 12" opacity="0.4" />
    </svg>
  );
}
