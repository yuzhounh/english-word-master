import React from 'react';
import { Volume2 } from 'lucide-react';

interface SpeakerIconProps {
  isSpeaking?: boolean;
  className?: string;
}

export const SpeakerIcon: React.FC<SpeakerIconProps> = ({ isSpeaking = false, className = 'w-5 h-5' }) => {
  return (
    <span className="relative inline-flex items-center justify-center shrink-0">
      {isSpeaking && (
        <span className="absolute -inset-1 rounded-md bg-slate-100/90 animate-pulse border border-slate-200/60" />
      )}
      <Volume2
        className={`relative transition-colors duration-150 ${
          isSpeaking ? 'text-slate-500 animate-pulse' : ''
        } ${className}`}
      />
    </span>
  );
};

