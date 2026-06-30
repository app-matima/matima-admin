import { cn } from "@/lib/utils";

export type BadgeVariant =
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "neutral";

const badgeStyles: Record<BadgeVariant, string> = {
  success: "bg-[#E6F7F5] text-[#00796B]",
  warning: "bg-[#FFF8E1] text-[#B45309]",
  danger: "bg-[#FEF2F2] text-[#991B1B]",
  info: "bg-[#EEF2FF] text-[#3730A3]",
  neutral: "bg-[#F4F5F7] text-[#6B7280]",
};

interface BadgeProps {
  variant: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

export function Badge({ variant, children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        "text-xs px-2 py-1 rounded-full font-medium whitespace-nowrap",
        badgeStyles[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
