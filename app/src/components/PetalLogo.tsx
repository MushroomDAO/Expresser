import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';
import { palette } from '../theme/tokens';
import { petalShapePath } from './PetalButton';

interface PetalLogoProps {
  size?: number;
  color?: string;
}

export function PetalLogo({ size = 14, color = palette.primary }: PetalLogoProps) {
  const cx = size / 2;
  const cy = size / 2;
  const len = size * 0.42;
  const wid = size * 0.32;
  const N = 6;
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {Array.from({ length: N }).map((_, i) => {
        const a = (i / N) * 360;
        return <Path key={i} d={petalShapePath(cx, cy, len, wid, a)} fill={color} opacity={0.85} />;
      })}
      <Circle cx={cx} cy={cy} r={size * 0.13} fill={palette.stamen2} />
    </Svg>
  );
}
