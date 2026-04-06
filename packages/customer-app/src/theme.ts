// Taxi Recanati Brand Theme
// Based on taxirecanati.it website palette

export const colors = {
  primaryBlue: '#4357AD',
  primaryBlueDark: '#354694',
  accentCoral: '#F55D3E',
  accentCoralDark: '#E04A2B',
  dark: '#191B1E',
  bodyText: '#68666C',
  lightBg: '#F7F7F7',
  white: '#FFFFFF',
  border: '#E8E8E8',
  inputBg: '#F2F3F7',
  success: '#4CAF50',
  warning: '#FF9800',
  error: '#F44336',
  info: '#4357AD',
};

export const fonts = {
  heading: 'System', // Playfair Display equivalent — system serif
  body: 'System',    // Roboto/Lato equivalent — system default
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
};

export const typography = {
  h1: {
    fontSize: 32,
    fontWeight: 'bold' as const,
    color: colors.primaryBlue,
  },
  h2: {
    fontSize: 24,
    fontWeight: 'bold' as const,
    color: colors.dark,
  },
  h3: {
    fontSize: 20,
    fontWeight: '600' as const,
    color: colors.dark,
  },
  body: {
    fontSize: 16,
    color: colors.bodyText,
  },
  caption: {
    fontSize: 14,
    color: colors.bodyText,
  },
  small: {
    fontSize: 12,
    color: colors.bodyText,
  },
};

export const shadows = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  panel: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
};
