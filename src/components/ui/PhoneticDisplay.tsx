import React from 'react';
import { SpeechAccent } from '../../types';
import { getPhoneticForAccent, PhoneticFields } from '../../utils/phoneticUtils';

interface PhoneticDisplayProps {
  item: PhoneticFields;
  accent?: SpeechAccent;
  className?: string;
  labelClassName?: string;
}

export const PhoneticDisplay: React.FC<PhoneticDisplayProps> = ({
  item,
  accent = 'en-US',
  className = 'text-sm font-mono text-slate-500 dark:text-slate-400 font-medium',
  labelClassName = 'text-slate-400 dark:text-slate-500 text-xs',
}) => {
  const result = getPhoneticForAccent(item, accent);
  if (!result) return null;

  return (
    <div className={className}>
      <span>
        <span className={labelClassName}>{result.label}</span> {result.value}
      </span>
    </div>
  );
};
