import { useState, useMemo } from "react";
import { Link } from "wouter";
import Layout from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { formatThaiDateTime, formatDuration } from "@/lib/utils-booking";
import { StatusBadge } from "@/components/status-badge";
import { useListBookings, getListBookingsQueryKey, useGetBookingsSummary, getGetBookingsSummaryQueryKey } from "@workspace/api-client-react";
import { FileText, Search, PlusCircle, Clock, CheckCircle2, ChevronLeft, ChevronRight } from "lucide-react";
import { Empty } from "@/components/ui/empty";

const THAI_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const THAI_DAYS_SHORT = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];
const TOTAL_ROOMS = 5;
const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;

type DayType = "daily" | "short_stay" | "both" | "full";

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

function toThaiYear(year: number): number {
  return year + 543;
}

function buildBookingDayMap(
  bookings: Array<{ checkInAt: string; checkOutAt: string; roomId: number }>,
): Map<string, DayType> {
  // Per-day tracking
  const roomsPerDay = new Map<string, Set<number>>();
  const hasDailyPerDay = new Map<string, boolean>();
  const hasShortPerDay = new Map<string, boolean>();

  for (const b of bookings) {
    const checkIn = new Date(b.checkInAt);
    const checkOut = new Date(b.checkOutAt);
    const durationMs = checkOut.getTime() - checkIn.getTime();
    const isDaily = durationMs >= 24 * 60 * 60 * 1000;

    // Convert to Bangkok time for day boundary calculations
    const startBkk = new Date(checkIn.getTime() + BANGKOK_OFFSET_MS);
    const endBkk = new Date(checkOut.getTime() + BANGKOK_OFFSET_MS);

    // Iterate over every calendar day the booking overlaps (in Bangkok timezone)
    const firstDay = new Date(Date.UTC(startBkk.getUTCFullYear(), startBkk.getUTCMonth(), startBkk.getUTCDate()));
    const lastDay = new Date(Date.UTC(endBkk.getUTCFullYear(), endBkk.getUTCMonth(), endBkk.getUTCDate()));
    const endExactMidnight = endBkk.getUTCHours() === 0 && endBkk.getUTCMinutes() === 0 && endBkk.getUTCSeconds() === 0;

    let cur = firstDay.getTime();
    const limit = endExactMidnight ? lastDay.getTime() : lastDay.getTime() + 1;

    while (cur < limit) {
      const d = new Date(cur);
      const dayStr = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;

      if (!roomsPerDay.has(dayStr)) roomsPerDay.set(dayStr, new Set());
      roomsPerDay.get(dayStr)!.add(b.roomId);
      if (isDaily) hasDailyPerDay.set(dayStr, true);
      else hasShortPerDay.set(dayStr, true);

      cur += 24 * 60 * 60 * 1000;
    }
  }

  const result = new Map<string, DayType>();
  for (const dayStr of roomsPerDay.keys()) {
    const rooms = roomsPerDay.get(dayStr)!;
    if (rooms.size >= TOTAL_ROOMS) {
      result.set(dayStr, "full");
    } else {
      const hasDaily = hasDailyPerDay.get(dayStr) ?? false;
      const hasShort = hasShortPerDay.get(dayStr) ?? false;
      if (hasDaily && hasShort) result.set(dayStr, "both");
      else if (hasDaily) result.set(dayStr, "daily");
      else result.set(dayStr, "short_stay");
    }
  }
  return result;
}

function MonthCalendar({
  year, month, bookingDays,
}: {
  year: number;
  month: number;
  bookingDays: Map<string, DayType>;
}) {
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfWeek(year, month);
  const cells: (number | null)[] = Array(firstDay).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="min-w-0">
      <p className="text-xs font-semibold text-center mb-1 text-foreground">
        {THAI_MONTHS[month]}
      </p>
      <div className="grid grid-cols-7 gap-0">
        {THAI_DAYS_SHORT.map((d) => (
          <div key={d} className="text-[9px] text-center text-muted-foreground pb-0.5 font-medium">
            {d}
          </div>
        ))}
        {cells.map((day, i) => {
          if (!day) return <div key={`empty-${i}`} />;
          const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const type = bookingDays.get(dateStr);
          return (
            <div key={day} className="flex items-center justify-center" style={{ height: 20 }}>
              {type ? (
                <div
                  title={
                    type === "full" ? "ห้องพักเต็มทุกห้อง (5/5 ห้อง)" :
                    type === "both" ? "มีทั้งรายวันและพักสั้น" :
                    type === "daily" ? "พักรายวัน (≥24 ชม.)" :
                    "พักสั้น (<24 ชม.)"
                  }
                  className={[
                    "w-5 h-5 rounded-sm flex items-center justify-center text-[9px] font-bold",
                    type === "full" ? "bg-purple-600 text-white" :
                    type === "daily" ? "bg-emerald-500 text-white" :
                    type === "short_stay" ? "bg-orange-400 text-white" :
                    "bg-gradient-to-br from-emerald-500 to-orange-400 text-white",
                  ].join(" ")}
                >
                  {day}
                </div>
              ) : (
                <span className="text-[10px] text-muted-foreground">{day}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function YearlyCalendar({ bookings }: { bookings: Array<{ checkInAt: string; checkOutAt: string }> }) {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const bookingDays = useMemo(() => buildBookingDayMap(bookings), [bookings]);

  return (
    <Card className="border-border shadow-sm">
      <CardHeader className="px-6 py-4 border-b border-border/50 bg-muted/20">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">ปฏิทินการจองประจำปี</CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setYear(y => y - 1)}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm font-semibold w-16 text-center">พ.ศ. {toThaiYear(year)}</span>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setYear(y => y + 1)}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
        <div className="flex items-center flex-wrap gap-x-4 gap-y-1 mt-2">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-emerald-500" />
            <span className="text-xs text-muted-foreground">พักรายวัน (24 ชม.+)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-orange-400" />
            <span className="text-xs text-muted-foreground">พักสั้น (น้อยกว่า 24 ชม.)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-purple-600" />
            <span className="text-xs text-muted-foreground">เต็มทุกห้อง (5/5 ห้อง)</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4">
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-x-4 gap-y-5">
          {Array.from({ length: 12 }, (_, m) => (
            <MonthCalendar key={m} year={year} month={m} bookingDays={bookingDays} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const { data: summary, isLoading: isLoadingSummary } = useGetBookingsSummary({
    query: { queryKey: getGetBookingsSummaryQueryKey() }
  });

  const { data: bookings, isLoading: isLoadingBookings } = useListBookings({
    query: { queryKey: getListBookingsQueryKey() }
  });

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const filteredBookings = bookings?.filter((b) => {
    const matchesStatus = statusFilter === "all" || b.status === statusFilter;
    const matchesSearch =
      b.guestName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.id.toString() === searchQuery;
    return matchesStatus && matchesSearch;
  });

  return (
    <Layout>
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8">

          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">แดชบอร์ด</h1>
              <p className="text-muted-foreground mt-1">ภาพรวมการจองของที่พัก</p>
            </div>
            <Link href="/new">
              <Button className="gap-2">
                <PlusCircle className="w-4 h-4" />
                สร้างการจองใหม่
              </Button>
            </Link>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-6 flex flex-row items-center gap-4">
                <div className="bg-primary/10 p-3 rounded-full">
                  <CalendarDaysIcon className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">การจองวันนี้</p>
                  <h3 className="text-2xl font-bold mt-1">
                    {isLoadingSummary ? <Skeleton className="h-8 w-16" /> : summary?.todayBookings ?? 0}
                  </h3>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6 flex flex-row items-center gap-4">
                <div className="bg-amber-50 p-3 rounded-full">
                  <Clock className="w-6 h-6 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">รอดำเนินการ</p>
                  <h3 className="text-2xl font-bold mt-1">
                    {isLoadingSummary ? <Skeleton className="h-8 w-16" /> : summary?.pendingCount ?? 0}
                  </h3>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6 flex flex-row items-center gap-4">
                <div className="bg-emerald-50 p-3 rounded-full">
                  <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">เช็คเอาต์แล้ว</p>
                  <h3 className="text-2xl font-bold mt-1">
                    {isLoadingSummary ? <Skeleton className="h-8 w-16" /> : summary?.checkedOutCount ?? 0}
                  </h3>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Yearly Calendar */}
          {isLoadingBookings ? (
            <Skeleton className="h-64 w-full rounded-xl" />
          ) : (
            <YearlyCalendar bookings={bookings ?? []} />
          )}

          {/* Bookings Table */}
          <Card className="border-border shadow-sm">
            <CardHeader className="px-6 py-5 border-b border-border/50 bg-muted/20">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <CardTitle className="text-xl">รายการจอง</CardTitle>
                <div className="flex items-center gap-2">
                  <div className="relative w-full sm:w-64">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="search"
                      placeholder="ค้นหาชื่อผู้เช่า..."
                      className="pl-9 bg-background"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[160px] bg-background">
                      <SelectValue placeholder="กรองตามสถานะ" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">ทั้งหมด</SelectItem>
                      <SelectItem value="pending">รอดำเนินการ</SelectItem>
                      <SelectItem value="paid">ชำระแล้ว</SelectItem>
                      <SelectItem value="checked_out">เช็คเอาต์แล้ว</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {isLoadingBookings ? (
                <div className="p-6 space-y-4">
                  {[1, 2, 3, 4].map((i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : filteredBookings && filteredBookings.length > 0 ? (
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow>
                      <TableHead className="w-[80px]">รหัส</TableHead>
                      <TableHead className="w-[90px]">ห้อง</TableHead>
                      <TableHead>ชื่อผู้เช่า</TableHead>
                      <TableHead>เวลาเช็คอิน</TableHead>
                      <TableHead>ระยะเวลาพัก</TableHead>
                      <TableHead>สถานะ</TableHead>
                      <TableHead className="text-right"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredBookings.map((booking) => (
                      <TableRow key={booking.id} className="hover:bg-muted/30 transition-colors">
                        <TableCell className="font-medium text-muted-foreground">
                          #{booking.id}
                        </TableCell>
                        <TableCell className="font-medium">
                          ห้อง {booking.roomId.toString().padStart(2, "0")}
                        </TableCell>
                        <TableCell className="font-medium">{booking.guestName}</TableCell>
                        <TableCell>{formatThaiDateTime(booking.checkInAt)}</TableCell>
                        <TableCell className="text-muted-foreground tabular-nums">
                          {formatDuration(booking.checkInAt, booking.checkOutAt)}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={booking.status} />
                        </TableCell>
                        <TableCell className="text-right">
                          <Link href={`/bookings/${booking.id}`}>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-primary hover:text-primary-foreground hover:bg-primary"
                            >
                              ดูรายละเอียด
                            </Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <Empty
                  icon={FileText}
                  title="ไม่พบรายการจอง"
                  description="ไม่มีรายการจองที่ตรงกับเงื่อนไขการค้นหาของคุณ"
                  className="py-12"
                />
              )}
            </CardContent>
          </Card>

        </div>
      </div>
    </Layout>
  );
}

function CalendarDaysIcon(props: React.ComponentProps<"svg">) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M8 2v4" />
      <path d="M16 2v4" />
      <rect width="18" height="18" x="3" y="4" rx="2" />
      <path d="M3 10h18" />
      <path d="M8 14h.01" />
      <path d="M12 14h.01" />
      <path d="M16 14h.01" />
      <path d="M8 18h.01" />
      <path d="M12 18h.01" />
      <path d="M16 18h.01" />
    </svg>
  );
}
