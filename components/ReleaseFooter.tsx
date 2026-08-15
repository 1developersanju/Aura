import { releaseLabel } from "@/lib/release";

export function ReleaseFooter({ className = "" }: { className?: string }) {
  return (
    <footer
      className={`px-4 py-4 text-center text-[11px] tabular-nums tracking-wide text-muted ${className}`}
    >
      Aura {releaseLabel()}
    </footer>
  );
}
