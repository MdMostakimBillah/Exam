"use client";
import { useEffect, useState } from "react";

export function EducationIllustration({ isDark }: { isDark: boolean }) {
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const textPrimary = isDark ? "#E4E4E7" : "#18181B";
  const textSecondary = isDark ? "#71717A" : "#71717A";
  const accentBlue = isDark ? "#60A5FA" : "#3B82F6";
  const accentPurple = isDark ? "#A78BFA" : "#8B5CF6";
  const accentGreen = isDark ? "#4ADE80" : "#22C55E";
  const accentAmber = isDark ? "#FCD34D" : "#F59E0B";
  const accentPink = isDark ? "#F472B6" : "#EC4899";
  const cardBg = isDark ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.8)";
  const cardBorder = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)";

  return (
    <div className="relative w-full h-full flex items-center justify-center">
      {/* Background glow */}
      <div 
        className="absolute inset-0 rounded-full blur-3xl opacity-30"
        style={{
          background: `radial-gradient(circle at center, ${accentBlue}20 0%, ${accentPurple}10 50%, transparent 70%)`
        }}
      />

      <style jsx>{`
        @keyframes float1 {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-12px) rotate(1deg); }
        }
        @keyframes float2 {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-8px) rotate(-1deg); }
        }
        @keyframes float3 {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
        @keyframes fadeInUp {
          0% { opacity: 0; transform: translateY(20px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse-soft {
          0%, 100% { opacity: 0.4; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(1.1); }
        }
        @keyframes drawLine {
          0% { stroke-dashoffset: 200; }
          100% { stroke-dashoffset: 0; }
        }
        .float-1 { animation: float1 5s ease-in-out infinite; }
        .float-2 { animation: float2 4.5s ease-in-out infinite 0.3s; }
        .float-3 { animation: float3 5.5s ease-in-out infinite 0.6s; }
        .float-4 { animation: float1 4.8s ease-in-out infinite 0.9s; }
        .float-5 { animation: float2 5.2s ease-in-out infinite 0.2s; }
        .fade-in-up { animation: fadeInUp 0.8s ease-out forwards; }
        .pulse-soft { animation: pulse-soft 3s ease-in-out infinite; }
        .line-draw { stroke-dasharray: 200; animation: drawLine 2s ease-out forwards 1s; }
      `}</style>

      {/* Main SVG */}
      <svg
        viewBox="0 0 600 500"
        className="w-full h-auto max-w-xl relative z-10"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="blueGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={accentBlue} />
            <stop offset="100%" stopColor={accentPurple} />
          </linearGradient>
          <linearGradient id="greenGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#22C55E" />
            <stop offset="100%" stopColor="#10B981" />
          </linearGradient>
          <linearGradient id="amberGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#F59E0B" />
            <stop offset="100%" stopColor="#D97706" />
          </linearGradient>
          <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="8" stdDeviation="12" floodOpacity={isDark ? "0.3" : "0.1"}/>
          </filter>
          <filter id="cardShadow" x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="0" dy="4" stdDeviation="6" floodOpacity={isDark ? "0.2" : "0.08"}/>
          </filter>
        </defs>

        {/* Central Dashboard Card */}
        <g filter="url(#softShadow)" className="fade-in-up">
          <rect 
            x="150" y="120" 
            width="300" 
            height="200" 
            rx="16"
            fill={isDark ? "#121214" : "#FFFFFF"}
            stroke={cardBorder}
            strokeWidth="1"
          />
          {/* Dashboard header */}
          <rect x="150" y="120" width="300" height="40" rx="16" fill={isDark ? "#1C1C1F" : "#F9FAFB"} />
          <rect x="150" y="144" width="300" height="16" fill={isDark ? "#1C1C1F" : "#F9FAFB"} />
          {/* Window dots */}
          <circle cx="170" cy="140" r="5" fill="#EF4444" opacity="0.8" />
          <circle cx="185" cy="140" r="5" fill="#F59E0B" opacity="0.8" />
          <circle cx="200" cy="140" r="5" fill="#22C55E" opacity="0.8" />
          
          {/* Stats row */}
          <rect x="170" y="175" width="60" height="50" rx="8" fill={cardBg} stroke={cardBorder} />
          <rect x="240" y="175" width="60" height="50" rx="8" fill={cardBg} stroke={cardBorder} />
          <rect x="310" y="175" width="60" height="50" rx="8" fill={cardBg} stroke={cardBorder} />
          <rect x="380" y="175" width="60" height="50" rx="8" fill={cardBg} stroke={cardBorder} />
          
          {/* Mini chart */}
          <rect x="170" y="240" width="260" height="60" rx="8" fill={cardBg} stroke={cardBorder} />
          <path 
            d="M185 280 L210 265 L235 275 L260 250 L285 260 L310 240 L335 255 L360 235 L385 250 L410 230"
            stroke="url(#blueGrad)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          <path 
            d="M185 280 L210 265 L235 275 L260 250 L285 260 L310 240 L335 255 L360 235 L385 250 L410 230 L410 290 L185 290 Z"
            fill="url(#blueGrad)"
            opacity="0.15"
          />
        </g>

        {/* Left side - Document/Certificate */}
        <g className="float-1" filter="url(#cardShadow)">
          <rect 
            x="60" y="150" 
            width="80" 
            height="100" 
            rx="8"
            fill={isDark ? "#121214" : "#FFFFFF"}
            stroke={cardBorder}
            strokeWidth="1"
          />
          <rect x="72" y="165" width="56" height="4" rx="2" fill={accentAmber} opacity="0.6" />
          <rect x="72" y="175" width="40" height="3" rx="1.5" fill={textSecondary} opacity="0.4" />
          <rect x="72" y="183" width="48" height="3" rx="1.5" fill={textSecondary} opacity="0.3" />
          <rect x="72" y="191" width="35" height="3" rx="1.5" fill={textSecondary} opacity="0.3" />
          <circle cx="100" cy="225" r="12" fill={accentGreen} opacity="0.9" />
          <path d="M95 225 L98 228 L106 220" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </g>

        {/* Left side - Book */}
        <g className="float-2" filter="url(#cardShadow)">
          <rect 
            x="70" y="280" 
            width="70" 
            height="90" 
            rx="4"
            fill={accentBlue}
          />
          <rect x="76" y="286" width="58" height="78" rx="2" fill={isDark ? "#1E3A5F" : "#DBEAFE"} />
          <rect x="82" y="292" width="46" height="4" rx="2" fill={accentBlue} opacity="0.5" />
          <rect x="82" y="302" width="30" height="2" rx="1" fill={textSecondary} opacity="0.4" />
          <rect x="82" y="308" width="24" height="2" rx="1" fill={textSecondary} opacity="0.3" />
          <rect x="82" y="314" width="28" height="2" rx="1" fill={textSecondary} opacity="0.3" />
        </g>

        {/* Right side - Chart */}
        <g className="float-3" filter="url(#cardShadow)">
          <rect 
            x="460" y="140" 
            width="90" 
            height="100" 
            rx="8"
            fill={isDark ? "#121214" : "#FFFFFF"}
            stroke={cardBorder}
            strokeWidth="1"
          />
          <rect x="478" y="200" width="12" height="25" rx="2" fill={accentBlue} opacity="0.7" />
          <rect x="494" y="190" width="12" height="35" rx="2" fill={accentPurple} opacity="0.7" />
          <rect x="510" y="180" width="12" height="45" rx="2" fill={accentGreen} opacity="0.7" />
          <rect x="526" y="165" width="12" height="60" rx="2" fill={accentAmber} opacity="0.7" />
          <path 
            d="M475 210 L490 200 L505 185 L520 170"
            stroke={accentGreen}
            strokeWidth="2"
            strokeLinecap="round"
            className="line-draw"
          />
          <circle cx="520" cy="170" r="4" fill={accentGreen} />
        </g>

        {/* Right side - User */}
        <g className="float-4" filter="url(#cardShadow)">
          <rect 
            x="470" y="270" 
            width="80" 
            height="80" 
            rx="12"
            fill={isDark ? "#121214" : "#FFFFFF"}
            stroke={cardBorder}
            strokeWidth="1"
          />
          <circle cx="510" cy="300" r="16" fill={cardBg} stroke={accentBlue} strokeWidth="2" />
          <circle cx="510" cy="296" r="6" fill={accentBlue} opacity="0.6" />
          <path d="M496 316 Q510 308 524 316" stroke={accentBlue} strokeWidth="3" strokeLinecap="round" fill="none" opacity="0.6" />
          <circle cx="530" cy="340" r="10" fill={accentGreen} />
          <path d="M530 335 L530 345 M525 340 L535 340" stroke="white" strokeWidth="2" strokeLinecap="round" />
        </g>

        {/* Bottom left - Globe */}
        <g className="float-5">
          <circle cx="120" cy="420" r="40" fill={accentBlue} opacity="0.1" />
          <circle cx="120" cy="420" r="30" fill="none" stroke={accentBlue} strokeWidth="1.5" opacity="0.5" />
          <ellipse cx="120" cy="420" rx="30" ry="12" fill="none" stroke={accentBlue} strokeWidth="1" opacity="0.4" />
          <ellipse cx="120" cy="420" rx="12" ry="30" fill="none" stroke={accentBlue} strokeWidth="1" opacity="0.4" />
          <path d="M95 410 Q120 420 145 410" stroke={accentBlue} strokeWidth="1" opacity="0.4" fill="none" />
          <path d="M90 425 Q120 435 150 425" stroke={accentBlue} strokeWidth="1" opacity="0.4" fill="none" />
        </g>

        {/* Bottom right - Graduation cap */}
        <g className="float-2">
          <ellipse cx="480" cy="430" rx="35" ry="8" fill={isDark ? "#27272A" : "#E4E4E7"} />
          <path d="M445 415 L480 400 L515 415 L480 430 Z" fill={isDark ? "#3F3F46" : "#D4D4D8"} />
          <path d="M445 415 Q480 395 515 415 Q480 435 445 415" fill={isDark ? "#52525B" : "#A1A1AA"} />
          <circle cx="480" cy="400" r="4" fill={isDark ? "#71717A" : "#71717A"} />
          <path d="M480 400 L510 420" stroke={accentAmber} strokeWidth="2" />
          <circle cx="512" cy="422" r="6" fill={accentAmber} />
        </g>

        {/* Top decorative elements */}
        <circle cx="300" cy="60" r="8" fill={accentBlue} opacity="0.2" className="pulse-soft" />
        <circle cx="320" cy="45" r="4" fill={accentPurple} opacity="0.3" className="pulse-soft" style={{ animationDelay: '0.5s' }} />
        <circle cx="280" cy="50" r="5" fill={accentGreen} opacity="0.25" className="pulse-soft" style={{ animationDelay: '1s' }} />

        {/* Floating particles */}
        <circle cx="200" cy="100" r="3" fill={accentBlue} className="pulse-soft" />
        <circle cx="400" cy="90" r="4" fill={accentPurple} className="pulse-soft" style={{ animationDelay: '0.3s' }} />
        <circle cx="150" cy="420" r="3" fill={accentGreen} className="pulse-soft" style={{ animationDelay: '0.6s' }} />
        <circle cx="450" cy="400" r="4" fill={accentAmber} className="pulse-soft" style={{ animationDelay: '0.9s' }} />
        <circle cx="80" cy="240" r="3" fill={accentPink} className="pulse-soft" style={{ animationDelay: '0.4s' }} />
        <circle cx="530" cy="250" r="3" fill={accentBlue} className="pulse-soft" style={{ animationDelay: '0.7s' }} />

        {/* Connection lines */}
        <path d="M140 200 Q180 180 200 200" stroke={accentBlue} strokeWidth="1" strokeDasharray="4 4" opacity="0.2" fill="none" />
        <path d="M400 180 Q430 160 460 180" stroke={accentPurple} strokeWidth="1" strokeDasharray="4 4" opacity="0.2" fill="none" />
        <path d="M120 340 Q150 320 170 340" stroke={accentGreen} strokeWidth="1" strokeDasharray="4 4" opacity="0.2" fill="none" />
        <path d="M430 340 Q460 320 480 340" stroke={accentAmber} strokeWidth="1" strokeDasharray="4 4" opacity="0.2" fill="none" />
      </svg>

      {/* Subtle grid pattern overlay */}
      <div 
        className="absolute inset-0 opacity-5"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, ${textSecondary} 1px, transparent 0)`,
          backgroundSize: '32px 32px'
        }}
      />
    </div>
  );
}
