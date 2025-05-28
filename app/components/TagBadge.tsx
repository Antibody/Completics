// app/components/TagBadge.tsx
'use client';

import React from 'react';

export interface TagBadgeProps {
  id: string;
  name: string;
  color: string | null; // Expecting hex color like #RRGGBB
  // Optionally, add onClick or other interaction props if needed in the future
}

const TagBadge: React.FC<TagBadgeProps> = ({ name, color }) => {
  const defaultColor = '#808080'; // Grey, or use a CSS variable
  const backgroundColor = color || defaultColor;

  // Basic function to determine if a color is "light" to decide text color
  // This is a simple heuristic and might need refinement for better accuracy
  const isLightColor = (hexColor: string): boolean => {
    if (!hexColor.startsWith('#')) return false;
    const hex = hexColor.replace('#', '');
    if (hex.length !== 3 && hex.length !== 6) return false;
    
    const r = parseInt(hex.length === 3 ? hex.substring(0,1).repeat(2) : hex.substring(0,2), 16);
    const g = parseInt(hex.length === 3 ? hex.substring(1,2).repeat(2) : hex.substring(2,4), 16);
    const b = parseInt(hex.length === 3 ? hex.substring(2,3).repeat(2) : hex.substring(4,6), 16);
    
    // Using YIQ formula for perceived brightness
    const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    return yiq >= 128; // Threshold for "light" color
  };

  const textColor = isLightColor(backgroundColor) ? 'text-black' : 'text-white';

  return (
    <span
      style={{ backgroundColor: backgroundColor }}
      className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold mr-1 mb-1 ${textColor}`}
      title={name} // Show full name on hover if it's truncated
    >
      {name}
    </span>
  );
};

export default TagBadge;
