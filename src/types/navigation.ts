/**
 * Navigation types — otic-mobile pattern.
 *
 * AppRoute drives the custom useState router in App.tsx.
 * No React Navigation — routing is pure state.
 */

export type AppRoute = 'scan' | 'learn' | 'history';

/** Props injected into every screen component. */
export type NavigationProps = {
  navigateTo: (route: AppRoute) => void;
  goBack: () => void;
};
