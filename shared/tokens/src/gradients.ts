/**
 * Gradient tokens.
 *
 * These are higher-order atmosphere primitives for vApps that need a strong
 * visual direction without inventing ad-hoc backgrounds every time.
 */

export const gradients = {
  aurora:
    "radial-gradient(circle at 0% 0%, rgba(45, 212, 168, 0.18), transparent 28%), radial-gradient(circle at 100% 0%, rgba(107, 149, 240, 0.18), transparent 32%), linear-gradient(180deg, rgba(7, 9, 20, 0.96), rgba(5, 6, 22, 0.86))",
  signal:
    "linear-gradient(135deg, rgba(34, 197, 94, 0.16), rgba(59, 130, 246, 0.12) 48%, rgba(245, 158, 11, 0.10))",
  chrome:
    "linear-gradient(180deg, rgba(255, 255, 255, 0.065), rgba(255, 255, 255, 0.02)), linear-gradient(180deg, rgba(16, 20, 31, 0.88), rgba(9, 11, 22, 0.82))",
  editorial:
    "linear-gradient(180deg, rgba(12, 16, 26, 0.92), rgba(8, 10, 18, 0.84)), radial-gradient(circle at top right, rgba(244, 63, 94, 0.12), transparent 28%)",
  ocean:
    "linear-gradient(135deg, rgba(14, 165, 233, 0.16), rgba(79, 70, 229, 0.14) 52%, rgba(6, 182, 212, 0.10))",
  ember:
    "linear-gradient(135deg, rgba(245, 158, 11, 0.18), rgba(244, 63, 94, 0.12) 54%, rgba(120, 53, 15, 0.22))",
  limewash:
    "radial-gradient(circle at 100% 0%, rgba(132, 204, 22, 0.16), transparent 34%), linear-gradient(180deg, rgba(10, 14, 28, 0.84), rgba(7, 9, 18, 0.76))",
  theater:
    "radial-gradient(circle at 50% 0%, rgba(167, 139, 250, 0.18), transparent 30%), radial-gradient(circle at 0% 100%, rgba(236, 72, 153, 0.08), transparent 26%), linear-gradient(180deg, rgba(7, 9, 20, 0.97), rgba(4, 5, 14, 0.94))",
} as const;

export type GradientName = keyof typeof gradients;
