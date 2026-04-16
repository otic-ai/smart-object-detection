/**
 * SYNTHETIC_EYE — App Theme
 *
 * Dark-only design system based on the otic-mobile useAppTheme() pattern.
 * Single typed token object — import useAppTheme() in every component.
 *
 * Primary:   #00FFA3 (neon green)
 * Secondary: #00E3FD (cyan)
 */

export type AppThemeTokens = {
  // Backgrounds
  background: string;
  surface: string;
  surfaceElevated: string;

  // Text
  primaryText: string;
  secondaryText: string;
  mutedText: string;

  // Brand accents
  primary: string;       // neon green  #00FFA3
  secondary: string;     // cyan        #00E3FD
  amber: string;         // warning     #FFB800
  error: string;         // error red   #FF4D4D

  // Borders & dividers
  border: string;
  divider: string;

  // Navigation bar
  navBackground: string;
  navBorder: string;

  // Inputs
  inputBackground: string;
  inputBorder: string;
  inputText: string;
  inputPlaceholder: string;

  // Misc
  shadowColor: string;
};

export const darkTheme: AppThemeTokens = {
  background:       '#0E0E0E',
  surface:          '#1A1A1A',
  surfaceElevated:  '#242424',

  primaryText:      '#F0F0F0',
  secondaryText:    '#A0A0A0',
  mutedText:        '#505050',

  primary:          '#00FFA3',
  secondary:        '#00E3FD',
  amber:            '#FFB800',
  error:            '#FF4D4D',

  border:           '#2A2A2A',
  divider:          '#1E1E1E',

  navBackground:    '#141414',
  navBorder:        '#222222',

  inputBackground:  '#1A1A1A',
  inputBorder:      '#2A2A2A',
  inputText:        '#F0F0F0',
  inputPlaceholder: '#505050',

  shadowColor:      '#000000',
};

/**
 * SYNTHETIC_EYE is always dark — no light variant needed.
 * Drop-in compatible with the otic-mobile useAppTheme() pattern.
 */
export function useAppTheme(): AppThemeTokens {
  return darkTheme;
}
