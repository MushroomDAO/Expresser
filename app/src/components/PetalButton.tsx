import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  Path,
  RadialGradient,
  Stop,
} from 'react-native-svg';
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { palette, petalGeom } from '../theme/tokens';
import type { State } from '../types';

const AnimatedG = Animated.createAnimatedComponent(G);

// teardrop petal — port of `petalShapePath` in design_handoff_expresser/source/phone-app.jsx.
function petalShapePath(cx: number, cy: number, len: number, wid: number, angleDeg: number) {
  const N = 40;
  const pts: [number, number][] = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const x = t * len;
    const w = Math.sin(Math.pow(t, 0.55) * Math.PI) * wid * 0.5;
    pts.push([x, w]);
  }
  for (let i = N; i >= 0; i--) {
    const t = i / N;
    const x = t * len;
    const w = -Math.sin(Math.pow(t, 0.55) * Math.PI) * wid * 0.5;
    pts.push([x, w]);
  }
  const a = (angleDeg * Math.PI) / 180;
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  const moved = pts.map(([x, y]) => [cx + x * ca - y * sa, cy + x * sa + y * ca]);
  return (
    'M ' +
    moved
      .map(([x, y], i) => `${i === 0 ? '' : 'L '}${x.toFixed(2)} ${y.toFixed(2)}`)
      .join(' ') +
    ' Z'
  );
}

interface PetalButtonProps {
  state: State;
  color?: string;
  dark?: boolean;
}

const RECORDING_STATES: State[] = ['recording', 'recording_video'];
const CAMERA_STATES: State[] = ['camera', 'capturing', 'transition'];
const BUSY_STATES: State[] = ['processing', 'uploading'];
const IDLE_STATES: State[] = ['idle', 'pool'];

export function PetalButton({ state, color = palette.primary, dark = false }: PetalButtonProps) {
  const pressed = RECORDING_STATES.includes(state);
  const camera = CAMERA_STATES.includes(state);
  const busy = BUSY_STATES.includes(state);
  const done = state === 'published';
  const ctd = state === 'countdown';
  const idle = IDLE_STATES.includes(state);

  const { size, petalLen, petalWid, petalCount: N } = petalGeom;
  const cx = size / 2;
  const cy = size / 2;

  // ── sway animation (idle only) ──
  const sway = useSharedValue(0);
  React.useEffect(() => {
    if (idle) {
      sway.value = withRepeat(
        withTiming(1, { duration: 9000, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      );
    } else {
      sway.value = 0;
    }
  }, [idle, sway]);

  const swayPropsFront = useAnimatedProps(() => {
    const deg = (sway.value - 0.5) * 12; // ±6deg
    return { transform: `rotate(${deg.toFixed(2)} ${cx} ${cy})` };
  });
  const swayPropsBack = useAnimatedProps(() => {
    const deg = (0.5 - sway.value) * 12;
    return { transform: `rotate(${deg.toFixed(2)} ${cx} ${cy})` };
  });

  // ── recording red ring (expanding) ──
  const ringScale = useSharedValue(1);
  const ringOpacity = useSharedValue(0);
  React.useEffect(() => {
    if (pressed) {
      ringOpacity.value = 1;
      ringScale.value = withRepeat(
        withTiming(2.4, { duration: 1600, easing: Easing.out(Easing.ease) }),
        -1,
        false,
      );
    } else {
      ringOpacity.value = 0;
      ringScale.value = 1;
    }
  }, [pressed, ringScale, ringOpacity]);
  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ringScale.value }],
    opacity: ringOpacity.value * (1 - (ringScale.value - 1) / 1.4),
  }));

  const lightTint = `${color}cc`;
  const deepTint = color;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Defs>
          <RadialGradient id="pet" cx="80%" cy="50%" r="70%">
            <Stop offset="0%" stopColor={deepTint} stopOpacity="0.95" />
            <Stop offset="55%" stopColor={lightTint} stopOpacity="0.85" />
            <Stop offset="100%" stopColor="#ffffff" stopOpacity={dark ? 0.4 : 0.95} />
          </RadialGradient>
          <RadialGradient id="stamen" cx="40%" cy="35%" r="70%">
            <Stop offset="0%" stopColor={palette.stamen1} />
            <Stop offset="55%" stopColor={palette.stamen2} />
            <Stop offset="100%" stopColor={palette.stamen3} />
          </RadialGradient>
          <RadialGradient id="glow" cx="50%" cy="55%" r="50%">
            <Stop offset="0%" stopColor={color} stopOpacity={pressed ? 0.45 : 0.22} />
            <Stop offset="100%" stopColor={color} stopOpacity="0" />
          </RadialGradient>
        </Defs>

        {/* base disk — affordance */}
        <Ellipse
          cx={cx}
          cy={cy + 4}
          rx={petalLen + 18}
          ry={petalLen + 10}
          fill={dark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.55)'}
          stroke={dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'}
          strokeWidth={1}
        />
        <Circle cx={cx} cy={cy} r={petalLen + 22} fill="url(#glow)" />

        {/* back petal layer */}
        <AnimatedG animatedProps={swayPropsBack} opacity={0.55}>
          {Array.from({ length: N }).map((_, i) => {
            const a = (i / N) * 360 + 180 / N;
            return (
              <Path
                key={`b${i}`}
                d={petalShapePath(cx, cy, petalLen + 6, petalWid + 6, a)}
                fill="url(#pet)"
                opacity={0.7}
              />
            );
          })}
        </AnimatedG>

        {/* front petal layer */}
        <AnimatedG animatedProps={swayPropsFront}>
          {Array.from({ length: N }).map((_, i) => {
            const a = (i / N) * 360;
            const d = petalShapePath(cx, cy, petalLen, petalWid, a);
            return (
              <Path
                key={`f${i}`}
                d={d}
                fill="url(#pet)"
                stroke={dark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.7)'}
                strokeWidth={0.8}
              />
            );
          })}
        </AnimatedG>

        {/* center stamen */}
        <Circle cx={cx} cy={cy} r={14} fill="url(#stamen)" />
        {[0, 60, 120, 180, 240, 300].map((a) => {
          const r = 8;
          const x = cx + Math.cos((a * Math.PI) / 180) * r;
          const y = cy + Math.sin((a * Math.PI) / 180) * r;
          return <Circle key={a} cx={x} cy={y} r={1.4} fill={palette.stamen3} opacity={0.6} />;
        })}

        {/* recording dot */}
        {pressed && <Circle cx={cx} cy={cy} r={6} fill={palette.recRed} />}

        {/* countdown ring */}
        {ctd && (
          <Circle
            cx={cx}
            cy={cy}
            r={34}
            fill="none"
            stroke={color}
            strokeWidth={3}
            opacity={0.85}
          />
        )}

        {/* check on publish */}
        {done && (
          <Path
            d={`M ${cx - 16} ${cy + 1} L ${cx - 4} ${cy + 13} L ${cx + 18} ${cy - 9}`}
            stroke={palette.success}
            strokeWidth={5}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        )}

        {/* lens overlay in camera mode */}
        {camera && (
          <G>
            <Circle cx={cx} cy={cy} r={petalLen + 4} fill="#0a0a0c" opacity={0.86} />
            <Circle cx={cx} cy={cy} r={petalLen / 1.6} fill="#1d2842" />
            <Circle cx={cx} cy={cy} r={petalLen / 2.6} fill="#5e80c2" />
            <Circle cx={cx - 8} cy={cy - 6} r={6} fill="#fff" opacity={0.85} />
          </G>
        )}

        {/* busy dots in stamen */}
        {busy && (
          <G>
            <Circle cx={cx - 14} cy={cy} r={3} fill="#fff" opacity={0.95} />
            <Circle cx={cx} cy={cy} r={3} fill="#fff" opacity={0.7} />
            <Circle cx={cx + 14} cy={cy} r={3} fill="#fff" opacity={0.45} />
          </G>
        )}
      </Svg>

      {/* recording red ring overlay (DOM, animated by RN) */}
      {pressed && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.ring,
            {
              borderColor: palette.recRed,
              width: 28,
              height: 28,
              borderRadius: 14,
              left: cx - 14,
              top: cy - 14,
            },
            ringStyle,
          ]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  ring: {
    position: 'absolute',
    borderWidth: 2,
  },
});

// Re-export the path helper so the small header logo can reuse it.
export { petalShapePath };
