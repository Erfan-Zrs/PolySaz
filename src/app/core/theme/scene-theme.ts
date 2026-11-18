import { ResolvedTheme } from './theme';


export interface SceneTheme {
  readonly background: number;
  readonly shadowOpacity: number;
  readonly guide: string;
  readonly flatOutside: string;
}

export const SCENE_THEMES: Record<ResolvedTheme, SceneTheme> = {
  light: {
    background: 0xe9ebef,
    shadowOpacity: 0.18,
    guide: '#3b5bdb',
    flatOutside: 'rgba(233, 235, 239, 0.62)',
  },
  dark: {
    background: 0x15171c,
    shadowOpacity: 0.45,
    guide: '#9db0ff',
    flatOutside: 'rgba(21, 23, 28, 0.62)',
  },
};
