import { Badge } from "@/components/ui/badge";

export type BookingStatusType = "pending" | "paid" | "checked_out";

interface StatusBadgeProps {
  status: BookingStatusType;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  switch (status) {
    case "pending":
      return (
        <Badge variant="outline" className={`bg-amber-50 text-amber-700 border-amber-200 font-normal px-2.5 py-0.5 ${className}`}>
          รอดำเนินการ
        </Badge>
      );
    case "paid":
      return (
        <Badge variant="outline" className={`bg-emerald-50 text-emerald-700 border-emerald-200 font-normal px-2.5 py-0.5 ${className}`}>
          ชำระแล้ว
        </Badge>
      );
    case "checked_out":
      return (
        <Badge variant="outline" className={`bg-slate-100 text-slate-600 border-slate-200 font-normal px-2.5 py-0.5 ${className}`}>
          เช็คเอาต์แล้ว
        </Badge>
      );
    default:
      return null;
  }
}
