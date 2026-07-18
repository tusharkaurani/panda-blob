import { cn } from "@/lib/utils";

export function Logo({ className, size = "default" }: { className?: string; size?: "default" | "lg" }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <span
        role="img"
        aria-label="Panda"
        className={cn("shrink-0 leading-none", size === "lg" ? "text-4xl" : "text-2xl")}
      >
        🐼
      </span>
      <span
        className={cn(
          "font-semibold tracking-tight text-foreground",
          size === "lg" ? "text-xl" : "hidden text-lg sm:inline"
        )}
      >
        pandablob
      </span>
    </div>
  );
}
