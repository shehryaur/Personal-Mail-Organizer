import React from 'react';

interface IconProps {
  name: string;
  size?: number;
  fill?: boolean;
  className?: string;
  style?: React.CSSProperties;
  title?: string;
}

/** Google Material Symbols Outlined, the icon set Gmail uses */
export const Icon: React.FC<IconProps> = ({ name, size = 20, fill = false, className = '', style, title }) => (
  <span
    aria-hidden={title ? undefined : true}
    title={title}
    className={`material-symbols-outlined select-none shrink-0 leading-none ${className}`}
    style={{
      fontSize: size,
      width: size,
      height: size,
      fontVariationSettings: `'FILL' ${fill ? 1 : 0}, 'wght' 400, 'GRAD' 0, 'opsz' ${Math.min(48, Math.max(20, size))}`,
      ...style,
    }}
  >
    {name}
  </span>
);
