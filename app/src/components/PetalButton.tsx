import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  FeGaussianBlur,
  Filter,
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
  withDelay,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { palette, petalGeom } from '../theme/tokens';
import type { State, Variant } from '../types';

const AnimatedG = Animated.createAnimatedComponent(G);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// ── Teardrop petal path ──────────────────────────────────────────────────
function petalShapePath(cx: number, cy: number, len: number, wid: number, angleDeg: number) {
  const N = 40;
  const pts: [number, number][] = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    pts.push([t * len, Math.sin(Math.pow(t, 0.55) * Math.PI) * wid * 0.5]);
  }
  for (let i = N; i >= 0; i--) {
    const t = i / N;
    pts.push([t * len, -Math.sin(Math.pow(t, 0.55) * Math.PI) * wid * 0.5]);
  }
  const a = (angleDeg * Math.PI) / 180;
  const ca = Math.cos(a), sa = Math.sin(a);
  return (
    'M ' +
    pts.map(([x, y]) => `${(cx + x * ca - y * sa).toFixed(2)} ${(cy + x * sa + y * ca).toFixed(2)}`).join(' L ') +
    ' Z'
  );
}

// ── Rainbow: 60 smooth pie segments via HSL interpolation ────────────────
function buildRainbowPaths(cx: number, cy: number, r: number, n = 60) {
  const paths: { d: string; fill: string }[] = [];
  for (let i = 0; i < n; i++) {
    const s = (i / n) * 360;
    const e = ((i + 1.2) / n) * 360; // slight overlap to avoid gaps
    const sa = (s * Math.PI) / 180, ea = (e * Math.PI) / 180;
    const x1 = cx + r * Math.cos(sa), y1 = cy + r * Math.sin(sa);
    const x2 = cx + r * Math.cos(ea), y2 = cy + r * Math.sin(ea);
    const hue = Math.round((i / n) * 360);
    paths.push({
      d: `M ${cx} ${cy} L ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z`,
      fill: `hsl(${hue}, 85%, 70%)`,
    });
  }
  return paths;
}

// ── OrbButton — 168px circle (rainbow / siri / glass) ────────────────────
const ORB = 168;
const ORB_R = ORB / 2;
const RAINBOW_PATHS = buildRainbowPaths(ORB_R, ORB_R, ORB_R);

function OrbButton({ state, variant, color, dark }: { state: State; variant: Variant; color: string; dark: boolean }) {
  const pressed = state === 'recording' || state === 'recording_video';
  const busy    = state === 'processing' || state === 'uploading';
  const done    = state === 'published';
  const idle    = state === 'idle' || state === 'pool';

  // Idle breathing rings
  const breathe1 = useSharedValue(0);
  const breathe2 = useSharedValue(0);
  React.useEffect(() => {
    breathe1.value = withRepeat(withTiming(1, { duration: 3000, easing: Easing.inOut(Easing.ease) }), -1, true);
    breathe2.value = withDelay(400, withRepeat(withTiming(1, { duration: 3600, easing: Easing.inOut(Easing.ease) }), -1, true));
  }, [breathe1, breathe2]);
  const ring1Style = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + breathe1.value * 0.18 }],
    opacity: idle ? Math.max(0, 0.55 - breathe1.value * 0.55) : 0,
  }));
  const ring2Style = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + breathe2.value * 0.32 }],
    opacity: idle ? Math.max(0, 0.4 - breathe2.value * 0.4) : 0,
  }));

  // Recording rings
  const rec1 = useSharedValue(0);
  const rec2 = useSharedValue(0);
  React.useEffect(() => {
    if (pressed) {
      rec1.value = withRepeat(withTiming(1, { duration: 1600, easing: Easing.out(Easing.ease) }), -1, false);
      rec2.value = withDelay(600, withRepeat(withTiming(1, { duration: 1600, easing: Easing.out(Easing.ease) }), -1, false));
    } else {
      rec1.value = 0; rec2.value = 0;
    }
  }, [pressed, rec1, rec2]);
  const rec1Style = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + rec1.value * 0.6 }],
    opacity: pressed ? 0.6 * (1 - rec1.value) : 0,
  }));
  const rec2Style = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + rec2.value * 0.6 }],
    opacity: pressed ? 0.6 * (1 - rec2.value) : 0,
  }));

  // Busy dots
  const dot1 = useSharedValue(0), dot2 = useSharedValue(0), dot3 = useSharedValue(0);
  React.useEffect(() => {
    const opts = { duration: 600, easing: Easing.inOut(Easing.ease) };
    dot1.value = withRepeat(withTiming(1, opts), -1, true);
    dot2.value = withDelay(180, withRepeat(withTiming(1, opts), -1, true));
    dot3.value = withDelay(360, withRepeat(withTiming(1, opts), -1, true));
  }, [dot1, dot2, dot3]);
  const dotStyle = (v: SharedValue<number>) =>
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useAnimatedStyle(() => ({ transform: [{ scale: 0.6 + v.value * 0.4 }], opacity: 0.4 + v.value * 0.6 }));
  const d1 = dotStyle(dot1), d2 = dotStyle(dot2), d3 = dotStyle(dot3);

  // Press scale
  const pressV = useSharedValue(1);
  React.useEffect(() => {
    pressV.value = withTiming(pressed ? 0.94 : done ? 1.04 : 1, { duration: 180 });
  }, [pressed, done, pressV]);
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: pressV.value }] }));

  // Siri plasma animation values
  const s1v = useSharedValue(0), s2v = useSharedValue(0), s3v = useSharedValue(0);
  React.useEffect(() => {
    s1v.value = withRepeat(withTiming(1, { duration: 4000, easing: Easing.inOut(Easing.ease) }), -1, true);
    s2v.value = withRepeat(withTiming(1, { duration: 4600, easing: Easing.inOut(Easing.ease) }), -1, true);
    s3v.value = withRepeat(withTiming(1, { duration: 5200, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [s1v, s2v, s3v]);
  const siri1Props = useAnimatedProps(() => ({
    cx: ORB_R + (s1v.value - 0.5) * ORB_R * 0.3,
    cy: ORB_R + (s1v.value - 0.5) * ORB_R * 0.2,
    r:  ORB_R * (0.55 + s1v.value * 0.08),
    opacity: 0.85 + s1v.value * 0.15,
  }));
  const siri2Props = useAnimatedProps(() => ({
    cx: ORB_R - (s2v.value - 0.5) * ORB_R * 0.3,
    cy: ORB_R - (s2v.value - 0.5) * ORB_R * 0.2,
    r:  ORB_R * (0.52 + s2v.value * 0.1),
    opacity: 0.8 + s2v.value * 0.2,
  }));
  const siri3Props = useAnimatedProps(() => ({
    cx: ORB_R,
    cy: ORB_R + (s3v.value - 0.5) * ORB_R * 0.3,
    r:  ORB_R * (0.58 - s3v.value * 0.1),
    opacity: 0.75 + s3v.value * 0.25,
  }));

  const glassColor = color + 'bb';

  return (
    <View style={orbStyles.wrap}>
      {/* Breathing ripple rings */}
      <Animated.View style={[orbStyles.ring, { borderColor: color + '55' }, ring1Style]} />
      <Animated.View style={[orbStyles.ring, { borderColor: color + '33' }, ring2Style]} />
      {/* Recording rings */}
      <Animated.View style={[orbStyles.ring, { borderColor: 'rgba(255,77,90,0.7)' }, rec1Style]} />
      <Animated.View style={[orbStyles.ring, { borderColor: 'rgba(255,77,90,0.7)' }, rec2Style]} />

      {/* Orb body */}
      <Animated.View style={[
        orbStyles.orb,
        variant === 'glass' && { backgroundColor: glassColor },
        pressStyle,
      ]}>
        <Svg width={ORB} height={ORB} style={StyleSheet.absoluteFill}>
          <Defs>
            {/* Siri blur filter */}
            <Filter id="blur" x="-30%" y="-30%" width="160%" height="160%">
              <FeGaussianBlur stdDeviation="12" />
            </Filter>
            {/* Glass radial highlight */}
            <RadialGradient id="glHL" cx="25%" cy="22%" r="45%">
              <Stop offset="0%" stopColor="#fff" stopOpacity="0.85" />
              <Stop offset="100%" stopColor="#fff" stopOpacity="0" />
            </RadialGradient>
            <RadialGradient id="glBR" cx="78%" cy="78%" r="28%">
              <Stop offset="0%" stopColor="#fff" stopOpacity="0.4" />
              <Stop offset="100%" stopColor="#fff" stopOpacity="0" />
            </RadialGradient>
          </Defs>

          {/* Rainbow: 60 pie slices */}
          {variant === 'rainbow' && (
            <G>
              {RAINBOW_PATHS.map((p, i) => (
                <Path key={i} d={p.d} fill={p.fill} />
              ))}
              {/* Inner semi-transparent overlay */}
              <Circle cx={ORB_R} cy={ORB_R} r={ORB_R - 10}
                fill={dark ? 'rgba(15,15,20,0.92)' : 'rgba(253,252,250,0.94)'} />
            </G>
          )}

          {/* Siri: 3 blurred plasma blobs */}
          {variant === 'siri' && (
            <G>
              <Circle cx={ORB_R} cy={ORB_R} r={ORB_R} fill="rgba(20,20,35,0.85)" />
              <AnimatedCircle fill="#5ec5ff" filter="url(#blur)" animatedProps={siri1Props} />
              <AnimatedCircle fill="#ff6dd0" filter="url(#blur)" animatedProps={siri2Props} />
              <AnimatedCircle fill="#c290ff" filter="url(#blur)" animatedProps={siri3Props} />
            </G>
          )}

          {/* Glass: highlight overlays */}
          {variant === 'glass' && (
            <G>
              <Circle cx={ORB_R} cy={ORB_R} r={ORB_R} fill="url(#glHL)" />
              <Circle cx={ORB_R} cy={ORB_R} r={ORB_R} fill="url(#glBR)" />
              <Circle cx={ORB_R} cy={ORB_R} r={ORB_R} fill="none"
                stroke="rgba(255,255,255,0.5)" strokeWidth="1" />
            </G>
          )}

          {/* Busy dots (all variants) */}
          {busy && (
            <G>
              <Circle cx={ORB_R - 14} cy={ORB_R} r={5} fill="#fff" opacity={0.95} />
              <Circle cx={ORB_R}      cy={ORB_R} r={5} fill="#fff" opacity={0.7} />
              <Circle cx={ORB_R + 14} cy={ORB_R} r={5} fill="#fff" opacity={0.45} />
            </G>
          )}

          {/* Checkmark */}
          {done && (
            <Path d={`M ${ORB_R - 20} ${ORB_R + 2} L ${ORB_R - 6} ${ORB_R + 16} L ${ORB_R + 22} ${ORB_R - 12}`}
              fill="none" stroke="#fff" strokeWidth="6"
              strokeLinecap="round" strokeLinejoin="round" />
          )}
        </Svg>

        {/* Animated busy dots overlay for correct scale animation */}
        {busy && (
          <View style={orbStyles.busyRow}>
            <Animated.View style={[orbStyles.busyDot, d1]} />
            <Animated.View style={[orbStyles.busyDot, d2]} />
            <Animated.View style={[orbStyles.busyDot, d3]} />
          </View>
        )}
      </Animated.View>
    </View>
  );
}

const orbStyles = StyleSheet.create({
  wrap: {
    width: ORB + 40, height: ORB + 40,
    alignItems: 'center', justifyContent: 'center',
  },
  orb: {
    width: ORB, height: ORB, borderRadius: ORB_R,
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  ring: {
    position: 'absolute',
    width: ORB, height: ORB, borderRadius: ORB_R,
    borderWidth: 2,
  },
  busyRow: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  busyDot: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.95)',
  },
});

// ── PetalVariant — full SVG petal flower ─────────────────────────────────
function PetalVariant({ state, color, dark }: { state: State; color: string; dark: boolean }) {
  const pressed = state === 'recording' || state === 'recording_video';
  const camera  = state === 'camera' || state === 'capturing' || state === 'transition';
  const busy    = state === 'processing' || state === 'uploading';
  const done    = state === 'published';
  const ctd     = state === 'countdown';
  const idle    = state === 'idle' || state === 'pool';

  const { size, petalLen, petalWid, petalCount: N } = petalGeom;
  const cx = size / 2, cy = size / 2;
  const orbR = Math.round(size * 0.405);

  const lightTint = `${color}cc`;

  // Sway
  const sway = useSharedValue(0);
  React.useEffect(() => {
    if (idle) {
      sway.value = withRepeat(withTiming(1, { duration: 9000, easing: Easing.inOut(Easing.ease) }), -1, true);
    } else { sway.value = 0; }
  }, [idle, sway]);
  const swayBack  = useAnimatedProps(() => ({ transform: `rotate(${((sway.value - 0.5) * 6).toFixed(2)} ${cx} ${cy})` }));
  const swayFront = useAnimatedProps(() => ({ transform: `rotate(${((0.5 - sway.value) * 4).toFixed(2)} ${cx} ${cy})` }));

  // Breathing pollen
  const breathe = useSharedValue(0);
  React.useEffect(() => {
    breathe.value = withRepeat(withTiming(1, { duration: 2800, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [breathe]);
  const pollenProps = useAnimatedProps(() => ({
    opacity: 0.85 - breathe.value * 0.45,
    r: 4 + breathe.value * 1.6,
  }));

  // Recording rings
  const recA = useSharedValue(0), recB = useSharedValue(0);
  React.useEffect(() => {
    if (pressed) {
      recA.value = withRepeat(withTiming(1, { duration: 1600, easing: Easing.out(Easing.ease) }), -1, false);
      recB.value = withDelay(600, withRepeat(withTiming(1, { duration: 1600, easing: Easing.out(Easing.ease) }), -1, false));
    } else { recA.value = 0; recB.value = 0; }
  }, [pressed, recA, recB]);
  const recRing1 = useAnimatedProps(() => ({
    r: 14 + recA.value * 44, opacity: pressed ? 0.7 * (1 - recA.value) : 0,
  }));
  const recRing2 = useAnimatedProps(() => ({
    r: 14 + recB.value * 44, opacity: pressed ? 0.7 * (1 - recB.value) : 0,
  }));

  // Press scale
  const pressV = useSharedValue(1);
  React.useEffect(() => {
    pressV.value = withTiming(pressed ? 0.94 : done ? 1.04 : 1, { duration: 180 });
  }, [pressed, done, pressV]);
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: pressV.value }] }));

  return (
    <Animated.View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, pressStyle]}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Defs>
          <RadialGradient id="pet" cx="80%" cy="50%" r="70%">
            <Stop offset="0%"   stopColor={color}     stopOpacity="0.95" />
            <Stop offset="55%"  stopColor={lightTint} stopOpacity="0.85" />
            <Stop offset="100%" stopColor="#ffffff"   stopOpacity={dark ? 0.4 : 0.95} />
          </RadialGradient>
          <RadialGradient id="orb" cx="38%" cy="32%" r="82%">
            <Stop offset="0%"   stopColor={dark ? '#2a2026' : '#ffffff'} stopOpacity={dark ? 0.85 : 1} />
            <Stop offset="42%"  stopColor={dark ? '#1a1418' : '#fff4ea'} stopOpacity="1" />
            <Stop offset="78%"  stopColor={dark ? '#0e0a0d' : '#fbe4d6'} stopOpacity="1" />
            <Stop offset="100%" stopColor={dark ? '#070406' : '#f0c8b8'} stopOpacity="1" />
          </RadialGradient>
          <RadialGradient id="rim" cx="50%" cy="50%" r="50%">
            <Stop offset="86%"  stopColor="#000" stopOpacity="0" />
            <Stop offset="100%" stopColor="#000" stopOpacity={dark ? 0.55 : 0.22} />
          </RadialGradient>
          <RadialGradient id="gloss" cx="50%" cy="22%" r="42%">
            <Stop offset="0%"   stopColor="#ffffff" stopOpacity={dark ? 0.35 : 0.85} />
            <Stop offset="60%"  stopColor="#ffffff" stopOpacity="0.15" />
            <Stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="glow" cx="50%" cy="50%" r="50%">
            <Stop offset="55%"  stopColor={color} stopOpacity="0" />
            <Stop offset="72%"  stopColor={color} stopOpacity={pressed ? 0.32 : 0.18} />
            <Stop offset="100%" stopColor={color} stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="stamen" cx="40%" cy="35%" r="70%">
            <Stop offset="0%"   stopColor="#fff5c2" />
            <Stop offset="55%"  stopColor="#f5c454" />
            <Stop offset="100%" stopColor="#b97a1f" />
          </RadialGradient>
        </Defs>

        {/* ambient glow halo */}
        <Circle cx={cx} cy={cy} r={orbR + 28} fill="url(#glow)" />

        {/* glassy orb base */}
        <Circle cx={cx} cy={cy + 2} r={orbR} fill="url(#orb)" />
        <Circle cx={cx} cy={cy + 2} r={orbR} fill="url(#rim)" />
        <Circle cx={cx} cy={cy + 2} r={orbR} fill="none"
          stroke={dark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.95)'}
          strokeWidth="1.2" />
        <Ellipse cx={cx} cy={cy - 22} rx={orbR * 0.78} ry={orbR * 0.46} fill="url(#gloss)" />

        {/* back petals */}
        <AnimatedG animatedProps={swayBack} opacity={0.55}>
          {Array.from({ length: N }).map((_, i) => (
            <Path key={`b${i}`}
              d={petalShapePath(cx, cy, petalLen + 6, petalWid + 6, (i / N) * 360 + 180 / N)}
              fill="url(#pet)" opacity={0.7} />
          ))}
        </AnimatedG>

        {/* front petals with edge highlight */}
        <AnimatedG animatedProps={swayFront}>
          {Array.from({ length: N }).map((_, i) => {
            const d = petalShapePath(cx, cy, petalLen, petalWid, (i / N) * 360);
            return (
              <G key={`f${i}`}>
                <Path d={d} fill="url(#pet)"
                  stroke={dark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.7)'}
                  strokeWidth="0.8" />
                <Path d={d} fill="none"
                  stroke="#ffffff" strokeOpacity={dark ? 0.15 : 0.55} strokeWidth="1.2" />
              </G>
            );
          })}
        </AnimatedG>

        {/* stamen */}
        <Circle cx={cx} cy={cy} r={14} fill="url(#stamen)"
          stroke="rgba(120,80,20,0.3)" strokeWidth="0.6" />
        {[0, 60, 120, 180, 240, 300].map((a) => {
          const x = cx + Math.cos((a * Math.PI) / 180) * 8;
          const y = cy + Math.sin((a * Math.PI) / 180) * 8;
          return <Circle key={a} cx={x} cy={y} r={1.4} fill="#7a4e10" opacity={0.6} />;
        })}

        {/* breathing pollen (idle) */}
        {idle && <AnimatedCircle cx={cx - 3} cy={cy - 3} fill="#fff8d8" animatedProps={pollenProps} />}

        {/* 2 staggered recording rings */}
        {pressed && (
          <>
            <AnimatedCircle cx={cx} cy={cy} fill="none" stroke="#ff4d6a" strokeWidth="2" animatedProps={recRing1} />
            <AnimatedCircle cx={cx} cy={cy} fill="none" stroke="#ff4d6a" strokeWidth="2" animatedProps={recRing2} />
            <Circle cx={cx} cy={cy} r={6} fill="#ff4d6a" />
          </>
        )}

        {/* countdown ring */}
        {ctd && <Circle cx={cx} cy={cy} r={34} fill="none" stroke={color} strokeWidth={3} opacity={0.85} />}

        {/* busy dots */}
        {busy && (
          <G transform={`translate(${cx - 14}, ${cy})`}>
            <Circle cx={0}  cy={0} r={3} fill="#fff" opacity={0.95} />
            <Circle cx={14} cy={0} r={3} fill="#fff" opacity={0.7} />
            <Circle cx={28} cy={0} r={3} fill="#fff" opacity={0.45} />
          </G>
        )}

        {/* checkmark */}
        {done && (
          <Path d={`M ${cx - 16} ${cy + 1} L ${cx - 4} ${cy + 13} L ${cx + 18} ${cy - 9}`}
            stroke={palette.success} strokeWidth={5}
            strokeLinecap="round" strokeLinejoin="round" fill="none" />
        )}

        {/* camera lens overlay */}
        {camera && (
          <G>
            <Circle cx={cx} cy={cy} r={petalLen + 4} fill="#0a0a0c" opacity={0.86} />
            <Circle cx={cx} cy={cy} r={petalLen / 1.6} fill="#1d2842" />
            <Circle cx={cx} cy={cy} r={petalLen / 2.6} fill="#5e80c2" />
            <Circle cx={cx - 8} cy={cy - 6} r={6} fill="#fff" opacity={0.85} />
          </G>
        )}
      </Svg>
    </Animated.View>
  );
}

// ── Public export — routes to correct sub-component ──────────────────────
// Kept as separate components so hooks are never called after a conditional
// return (Rules of Hooks).
interface PetalButtonProps {
  state: State;
  variant?: Variant;
  color?: string;
  dark?: boolean;
}

export function PetalButton({ state, variant = 'petal', color = palette.primary, dark = false }: PetalButtonProps) {
  if (variant === 'petal') {
    return <PetalVariant state={state} color={color} dark={dark} />;
  }
  return <OrbButton state={state} variant={variant} color={color} dark={dark} />;
}

export { petalShapePath };

const styles = StyleSheet.create({});
void styles;
