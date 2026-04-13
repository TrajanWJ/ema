/**
 * Layout tokens.
 *
 * These values define recurring spatial decisions for app shells and should
 * be preferred over one-off widths/heights in vApps.
 */

export const layout = {
  appMaxWidth: "1440px",
  contentMaxWidth: "1280px",
  readingMeasure: "72ch",
  topNavHeight: "56px",
  subNavHeight: "42px",
  titlebarHeight: "36px",
  dockHeight: "72px",
  railWidthSm: "280px",
  railWidthMd: "340px",
  railWidthLg: "420px",
  inspectorWidth: "380px",
  sidebarWidth: "260px",
  listColumnWidth: "320px",
  heroMinHeight: "240px",
  cardMinWidth: "280px",
  cardMaxWidth: "420px",
  sectionGap: "20px",
  clusterGap: "12px",
} as const;

export type LayoutToken = keyof typeof layout;
