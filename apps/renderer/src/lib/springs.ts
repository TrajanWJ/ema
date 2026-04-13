export const SPRINGS = {
  default: { stiffness: 300, damping: 25 },
  snappy: { stiffness: 500, damping: 30 },
  gentle: { stiffness: 200, damping: 20 },
  bouncy: { stiffness: 400, damping: 15 },
} as const;
