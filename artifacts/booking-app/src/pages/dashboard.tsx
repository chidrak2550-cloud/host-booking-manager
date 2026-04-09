import { useState } from "react";
import { Link } from "wouter";
import { format } from "date-fns";
import Layout from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { formatThaiCurrency, formatThaiDateTime } from "@/lib/utils-booking";
import { StatusBadge } from "@/components/status-badge";
import { useListBookings, getListBookingsQueryKey, useGetBookingsSummary, getGetBookingsSummaryQueryKey } from "@workspace/api-client-react";
import { FileText, Search, PlusCircle, Clock, CheckCircle2, CircleDollarSign, LogOut } from "lucide-react";
import { Empty } from "@/components/ui/empty";

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
    const matchesSearch = b.guestName.toLowerCase().includes(searchQuery.toLowerCase()) || b.id.toString() === searchQuery;
    return matchesStatus && matchesSearch;
  });

  return (
    <Layout>
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8">
          
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">แดชบอร์ด</h1>
              <p className="text-muted-foreground mt-1">ภาพรวมการจองและรายได้ของที่พัก</p>
            </div>
            <Link href="/new">
              <Button className="gap-2">
                <PlusCircle className="w-4 h-4" />
                สร้างการจองใหม่
              </Button>
            </Link>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-6 flex flex-row items-center gap-4">
                <div className="bg-primary/10 p-3 rounded-full">
                  <CalendarDaysIcon className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">การจองวันนี้</p>
                  <h3 className="text-2xl font-bold mt-1">
                    {isLoadingSummary ? <Skeleton className="h-8 w-16" /> : summary?.todayBookings || 0}
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
                    {isLoadingSummary ? <Skeleton className="h-8 w-16" /> : summary?.pendingCount || 0}
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
                    {isLoadingSummary ? <Skeleton className="h-8 w-16" /> : summary?.checkedOutCount || 0}
                  </h3>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
              <CardContent className="p-6 flex flex-row items-center gap-4">
                <div className="bg-primary/20 p-3 rounded-full">
                  <CircleDollarSign className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-primary">รายได้รวม</p>
                  <h3 className="text-2xl font-bold mt-1 text-primary-foreground">
                    {isLoadingSummary ? <Skeleton className="h-8 w-24" /> : formatThaiCurrency(summary?.totalRevenue || 0)}
                  </h3>
                </div>
              </CardContent>
            </Card>
          </div>

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
                      <TableHead>ชื่อผู้เช่า</TableHead>
                      <TableHead>เวลาเช็คอิน</TableHead>
                      <TableHead>แพ็กเกจ</TableHead>
                      <TableHead>สถานะ</TableHead>
                      <TableHead className="text-right">จำนวนเงินรวม</TableHead>
                      <TableHead className="text-right"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredBookings.map((booking) => (
                      <TableRow key={booking.id} className="hover:bg-muted/30 transition-colors">
                        <TableCell className="font-medium text-muted-foreground">
                          #{booking.id}
                        </TableCell>
                        <TableCell className="font-medium">{booking.guestName}</TableCell>
                        <TableCell>{formatThaiDateTime(booking.checkInAt)}</TableCell>
                        <TableCell>
                          {booking.packageType === "daily" ? "รายวัน" : "พักสั้น"}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={booking.status} />
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatThaiCurrency(booking.totalPrice)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Link href={`/bookings/${booking.id}`}>
                            <Button variant="ghost" size="sm" className="text-primary hover:text-primary-foreground hover:bg-primary">
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
