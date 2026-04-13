interface LoadingSpinnerProps {
  readonly size?: "sm" | "md" | "lg";
  readonly label?: string;
}

const SIZES = {
  sm: "w-4 h-4 border-[1.5px]",
  md: "w-5 h-5 border-2",
  lg: "w-7 h-7 border-2",
} as const;

export function LoadingSpinner({ size = "md", label }: LoadingSpinnerProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-8">
      <div
        className={`${SIZES[size]} rounded-full animate-spin`}
        style={{
          borderColor: "rgba(255,255,255,0.1)",
          borderTopColor: "var(--color-pn-primary-400)",
        }}
      />
      {label && (
        <span className="text-[0.7rem]" style={{ color: "var(--pn-text-muted)" }}>
          {label}
        </span>
      )}
    </div>
  );
}
