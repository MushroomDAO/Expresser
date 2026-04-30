import { palette } from './tokens';

export * from './tokens';

export interface Theme {
  bg: string;
  fg: string;
  fgSub: string;
  card: string;
  primary: string;
  primaryLight: string;
  recRed: string;
  success: string;
  warn: string;
  dark: boolean;
}

export const lightTheme: Theme = {
  bg: palette.bg,
  fg: palette.fg,
  fgSub: palette.fgSub,
  card: palette.card,
  primary: palette.primary,
  primaryLight: palette.primaryLight,
  recRed: palette.recRed,
  success: palette.success,
  warn: palette.warn,
  dark: false,
};

export const darkTheme: Theme = {
  bg: palette.bgDark,
  fg: palette.fgDark,
  fgSub: palette.fgSubDark,
  card: palette.cardDark,
  primary: palette.primary,
  primaryLight: palette.primaryLight,
  recRed: palette.recRed,
  success: palette.success,
  warn: palette.warn,
  dark: true,
};

export const themeFor = (dark: boolean): Theme => (dark ? darkTheme : lightTheme);
