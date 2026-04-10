import { useState, useMemo, useEffect } from "react";
import { Link } from "wouter";
import { 
  format, 
  addDays, 
  subDays, 
  startOfDay, 
  endOfDay, 
  eachDayOfInterval, 
  isSameDay,
  parseISO,
  differenceInMinutes,
  addHours,
  setHours,
  setMinutes
} from "date-fns";
import { motion } from "framer-motion";
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon, 
  RefreshCcw, 
  CreditCard,
  User,
  Clock,
  Save,
  ReceiptText,
  BedDouble,
  UserPlus,
  DoorOpen
} from "lucide-react";

import Layout from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Separator } from "@/components/ui/separator";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

import { 
  ROOMS, 
  formatThaiDate, 
  formatThaiDateTime, 
  formatThaiCurrency, 
  calculatePricing,
  formatDuration
} from "@/lib/utils-booking";

import { 
  useListBookings, 
  getListBookingsQueryKey, 
  useCreateBooking,
  getGetBookingsSummaryQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { StatusBadge } from "@/components/status-badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

const HOURS_IN_DAY = 24;
const HOUR_WIDTH = 72; // px per hour

const bookingSchema = z.object({
  roomId: z.coerce.number().min(1).max(5),
  guestName: z.string().min(1, "กรุณาระบุชื่อผู้เช่า"),
  numGuests: z.coerce.number().min(1).max(10),
  checkInAt: z.string().min(1, "กรุณาระบุเวลาเช็คอิน"),
  checkOutAt: z.string().min(1, "กรุณาระบุเวลาเช็คเอาต์"),
  packageType: z.enum(["daily", "short_stay"]),
  paymentMethod: z.enum(["prepaid", "pay_at_counter"]),
});
type BookingFormValues = z.infer<typeof bookingSchema>;

export default function Timeline() {
  const [baseDate, setBaseDate] = useState<Date>(startOfDay(new Date()));
  const [selectedBookingId, setSelectedBookingId] = useState<number | null>(null);
  const [isNewBookingModalOpen, setIsNewBookingModalOpen] = useState(false);
  const [cellClickedData, setCellClickedData] = useState<{ roomId: number, date: Date } | null>(null);
  
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const startDate = subDays(baseDate, 1);
  const endDate = addDays(baseDate, 1);
  const isoStartDate = format(startDate, "yyyy-MM-dd'T'00:00:00XXX");
  const isoEndDate = format(endOfDay(endDate), "yyyy-MM-dd'T'23:59:59XXX");

  const { data: bookings, isLoading, refetch, isRefetching } = useListBookings(
    { startDate: isoStartDate, endDate: isoEndDate },
    {
      query: {
        queryKey: getListBookingsQueryKey({ startDate: isoStartDate, endDate: isoEndDate })
      }
    }
  );

  const daysToRender = useMemo(() => {
    return eachDayOfInterval({ start: startDate, end: endDate });
  }, [startDate, endDate]);

  const handlePrevDay = () => setBaseDate(prev => subDays(prev, 1));
  const handleNextDay = () => setBaseDate(prev => addDays(prev, 1));
  const handleToday = () => setBaseDate(startOfDay(new Date()));

  const handleCellClick = (roomId: number, date: Date, hour: number) => {
    const clickedDate = setHours(setMinutes(date, 0), hour);
    setCellClickedData({ roomId, date: clickedDate });
    setIsNewBookingModalOpen(true);
  };

  const selectedBooking = useMemo(() => {
    return bookings?.find(b => b.id === selectedBookingId) || null;
  }, [bookings, selectedBookingId]);

  return (
    <Layout>
      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden bg-background">
        <div className="p-4 md:p-6 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card z-20 shrink-0">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">ตารางการจอง</h1>
            <p className="text-muted-foreground text-sm mt-1">จัดการห้องพักแบบไทม์ไลน์</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => refetch()} disabled={isRefetching || isLoading}>
              <RefreshCcw className={`w-4 h-4 ${isRefetching ? 'animate-spin' : ''}`} />
            </Button>
            <div className="flex items-center bg-muted rounded-md p-1 border border-border">
              <Button variant="ghost" size="sm" onClick={handlePrevDay} className="h-8 px-3">
                <ChevronLeft className="w-4 h-4 mr-1" /> ก่อนหน้า
              </Button>
              <Button variant="ghost" size="sm" onClick={handleToday} className="h-8 px-3 font-medium">
                <CalendarIcon className="w-4 h-4 mr-2" /> วันนี้
              </Button>
              <Button variant="ghost" size="sm" onClick={handleNextDay} className="h-8 px-3">
                ถัดไป <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-hidden relative">
          <ScrollArea className="w-full h-full" type="always">
            <div className="min-w-max pb-10">
              <div className="flex">
                {/* Fixed Room Column */}
                <div className="w-[120px] shrink-0 sticky left-0 z-30 bg-card border-r border-border shadow-[2px_0_5px_rgba(0,0,0,0.05)] dark:shadow-[2px_0_5px_rgba(0,0,0,0.2)]">
                  {/* Empty top-left header */}
                  <div className="h-[72px] border-b border-border bg-muted/30"></div>
                  
                  {daysToRender.map((day, dayIdx) => (
                    <div key={`sticky-day-${day.getTime()}`} className="border-b border-border last:border-0 relative">
                      {/* Day row header placeholder */}
                      <div className="h-[36px] bg-muted/50 border-b border-border flex items-center px-3 sticky top-0 z-40 shadow-sm">
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden sm:block">ห้องพัก</span>
                      </div>
                      
                      {ROOMS.map(room => (
                        <div key={`sticky-room-${room.id}`} className="h-[64px] border-b border-border/50 last:border-0 flex items-center justify-center bg-card">
                          <span className="font-medium text-sm text-foreground">{room.name}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>

                {/* Timeline Grid */}
                <div className="flex-1 relative">
                  {/* Hours Header Row - Sticky Top */}
                  <div className="h-[72px] sticky top-0 z-20 bg-muted/30 border-b border-border flex flex-col shadow-sm backdrop-blur-md">
                    <div className="h-full flex items-end pb-2">
                      {Array.from({ length: HOURS_IN_DAY }).map((_, i) => (
                        <div key={`header-hour-${i}`} className="shrink-0 flex items-center justify-center border-l border-border/50 text-xs font-medium text-muted-foreground" style={{ width: HOUR_WIDTH }}>
                          {i.toString().padStart(2, '0')}:00
                        </div>
                      ))}
                    </div>
                  </div>

                  {daysToRender.map(day => {
                    const startOfCurrentDay = startOfDay(day);
                    const endOfCurrentDay = endOfDay(day);
                    
                    return (
                      <div key={`grid-day-${day.getTime()}`} className="border-b border-border last:border-0 relative">
                        {/* Day Date Header - Sticky Top under hours */}
                        <div className="h-[36px] sticky top-[72px] z-10 bg-primary/5 backdrop-blur-md border-b border-primary/10 flex items-center px-4 shadow-sm">
                          <div className="font-semibold text-sm text-primary flex items-center gap-2">
                            <CalendarIcon className="w-4 h-4" />
                            {formatThaiDate(day)}
                            {isSameDay(day, new Date()) && (
                              <span className="ml-2 px-2 py-0.5 bg-primary text-primary-foreground text-[10px] rounded-full uppercase font-bold tracking-wider">วันนี้</span>
                            )}
                          </div>
                        </div>
                        
                        {/* Room Rows for this day */}
                        {ROOMS.map((room, roomIdx) => {
                          const roomBookings = bookings?.filter(b => b.roomId === room.id) || [];
                          
                          return (
                            <div key={`grid-room-${room.id}`} className="h-[64px] border-b border-border/50 last:border-0 flex relative group bg-card hover:bg-muted/20 transition-colors">
                              {/* Hour Cells (Background) */}
                              {Array.from({ length: HOURS_IN_DAY }).map((_, hour) => (
                                <div 
                                  key={`cell-${hour}`} 
                                  className="shrink-0 border-l border-border/30 h-full cursor-pointer hover:bg-primary/10 transition-colors" 
                                  style={{ width: HOUR_WIDTH }}
                                  onClick={() => handleCellClick(room.id, day, hour)}
                                />
                              ))}

                              {/* Bookings Overlay */}
                              {roomBookings.map(booking => {
                                const checkIn = parseISO(booking.checkInAt);
                                const checkOut = parseISO(booking.checkOutAt);
                                
                                // Does booking overlap with this day?
                                if (checkOut <= startOfCurrentDay || checkIn >= endOfCurrentDay) return null;
                                
                                // Calculate position and width for this day's segment
                                const segmentStart = checkIn < startOfCurrentDay ? startOfCurrentDay : checkIn;
                                const segmentEnd = checkOut > endOfCurrentDay ? endOfCurrentDay : checkOut;
                                
                                const startMinutes = differenceInMinutes(segmentStart, startOfCurrentDay);
                                const durationMinutes = differenceInMinutes(segmentEnd, segmentStart);
                                
                                const leftPx = (startMinutes / 60) * HOUR_WIDTH;
                                const widthPx = (durationMinutes / 60) * HOUR_WIDTH;
                                
                                const isStart = isSameDay(checkIn, day);
                                const isEnd = isSameDay(checkOut, day);
                                
                                const isPaidOrOut = booking.status === 'paid' || booking.status === 'checked_out';
                                
                                return (
                                  <motion.div
                                    key={`booking-${booking.id}-${day.getTime()}`}
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className={`absolute top-2 bottom-2 rounded-md shadow-sm border overflow-hidden cursor-pointer flex flex-col justify-center px-2 z-10 transition-shadow hover:shadow-md
                                      ${isPaidOrOut 
                                        ? 'bg-emerald-100/90 border-emerald-300 text-emerald-900 dark:bg-emerald-900/40 dark:border-emerald-800 dark:text-emerald-100 hover:border-emerald-400' 
                                        : 'bg-amber-100/90 border-amber-300 text-amber-900 dark:bg-amber-900/40 dark:border-amber-800 dark:text-amber-100 hover:border-amber-400'
                                      }
                                      ${!isStart ? 'rounded-l-none border-l-0' : ''}
                                      ${!isEnd ? 'rounded-r-none border-r-0' : ''}
                                    `}
                                    style={{ left: leftPx, width: Math.max(widthPx, 4) }}
                                    onClick={() => setSelectedBookingId(booking.id)}
                                  >
                                    {widthPx > 40 && (
                                      <div className="truncate text-xs font-semibold">
                                        {booking.guestName}
                                      </div>
                                    )}
                                    {widthPx > 60 && (
                                      <div className="truncate text-[10px] opacity-80 flex items-center gap-1">
                                        <UserPlus className="w-3 h-3" /> {booking.numGuests} คน
                                      </div>
                                    )}
                                  </motion.div>
                                );
                              })}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </div>
      </div>

      {/* Booking Details Modal */}
      <Dialog open={!!selectedBookingId} onOpenChange={(open) => !open && setSelectedBookingId(null)}>
        <DialogContent className="sm:max-w-md">
          {selectedBooking && (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between pr-6">
                  <DialogTitle className="text-xl">ข้อมูลการจอง #{selectedBooking.id}</DialogTitle>
                  <StatusBadge status={selectedBooking.status} />
                </div>
                <DialogDescription>
                  ข้อมูลและรายละเอียดค่าใช้จ่าย
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg border border-border">
                  <div>
                    <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">ชื่อผู้เช่า</span>
                    <div className="flex items-center gap-2 mt-1">
                      <User className="w-4 h-4 text-primary" />
                      <span className="font-medium text-foreground">{selectedBooking.guestName}</span>
                    </div>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">ห้องพัก</span>
                    <div className="flex items-center gap-2 mt-1">
                      <DoorOpen className="w-4 h-4 text-primary" />
                      <span className="font-medium text-foreground">{ROOMS.find(r => r.id === selectedBooking.roomId)?.name}</span>
                    </div>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">เวลาเช็คอิน</span>
                    <div className="flex items-center gap-2 mt-1">
                      <Clock className="w-4 h-4 text-primary" />
                      <span className="text-sm font-medium text-foreground">{formatThaiDateTime(selectedBooking.checkInAt)}</span>
                    </div>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">เวลาเช็คเอาต์</span>
                    <div className="flex items-center gap-2 mt-1">
                      <Clock className="w-4 h-4 text-primary" />
                      <span className="text-sm font-medium text-foreground">{formatThaiDateTime(selectedBooking.checkOutAt)}</span>
                    </div>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">จำนวนผู้เข้าพัก</span>
                    <div className="flex items-center gap-2 mt-1">
                      <UserPlus className="w-4 h-4 text-primary" />
                      <span className="font-medium text-foreground">{selectedBooking.numGuests} คน</span>
                    </div>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">ระยะเวลา</span>
                    <div className="mt-1 font-medium text-foreground text-sm">
                      {formatDuration(selectedBooking.checkInAt, selectedBooking.checkOutAt)}
                    </div>
                  </div>
                </div>

                <div className="space-y-2 px-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">ราคาพื้นฐาน</span>
                    <span className="font-medium">{formatThaiCurrency(selectedBooking.basePrice)}</span>
                  </div>
                  {selectedBooking.overtimeFee > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">ค่าเกินเวลา ({selectedBooking.overtimeHours} ชม.)</span>
                      <span className="font-medium text-amber-600">{formatThaiCurrency(selectedBooking.overtimeFee)}</span>
                    </div>
                  )}
                  {selectedBooking.extraBedFee > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">ค่าเตียงเสริม</span>
                      <span className="font-medium text-amber-600">{formatThaiCurrency(selectedBooking.extraBedFee)}</span>
                    </div>
                  )}
                  <Separator className="my-2" />
                  <div className="flex justify-between font-bold text-lg text-primary">
                    <span>ยอดรวมทั้งสิ้น</span>
                    <span>{formatThaiCurrency(selectedBooking.totalPrice)}</span>
                  </div>
                </div>
              </div>
              
              <DialogFooter className="sm:justify-between items-center gap-4 border-t border-border pt-4">
                <Button variant="outline" onClick={() => setSelectedBookingId(null)}>ปิด</Button>
                <Link href={`/bookings/${selectedBooking.id}`}>
                  <Button className="gap-2">
                    ดูรายละเอียด
                  </Button>
                </Link>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* New Booking Modal from Timeline */}
      <NewBookingModal 
        isOpen={isNewBookingModalOpen} 
        onClose={() => setIsNewBookingModalOpen(false)}
        initialData={cellClickedData}
      />
    </Layout>
  );
}

function NewBookingModal({ 
  isOpen, 
  onClose,
  initialData
}: { 
  isOpen: boolean; 
  onClose: () => void;
  initialData: { roomId: number, date: Date } | null;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [pricingPreview, setPricingPreview] = useState({
    basePrice: 0,
    overtimeHours: 0,
    overtimeFee: 0,
    extraBedFee: 0,
    totalPrice: 0,
  });

  const form = useForm<BookingFormValues>({
    resolver: zodResolver(bookingSchema),
    defaultValues: {
      roomId: 1,
      guestName: "",
      numGuests: 1,
      checkInAt: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
      checkOutAt: format(addHours(new Date(), 24), "yyyy-MM-dd'T'HH:mm"),
      packageType: "daily",
      paymentMethod: "prepaid",
    },
  });

  useEffect(() => {
    if (initialData && isOpen) {
      const inDate = initialData.date;
      const outDate = addHours(inDate, 24);
      form.reset({
        roomId: initialData.roomId,
        guestName: "",
        numGuests: 1,
        checkInAt: format(inDate, "yyyy-MM-dd'T'HH:mm"),
        checkOutAt: format(outDate, "yyyy-MM-dd'T'HH:mm"),
        packageType: "daily",
        paymentMethod: "prepaid",
      });
    }
  }, [initialData, isOpen, form]);

  const checkInAt = form.watch("checkInAt");
  const checkOutAt = form.watch("checkOutAt");
  const packageType = form.watch("packageType");
  const numGuests = form.watch("numGuests");

  useEffect(() => {
    if (checkInAt && checkOutAt && packageType) {
      try {
        const pricing = calculatePricing(checkInAt, checkOutAt, packageType, numGuests || 1);
        setPricingPreview(pricing);
      } catch (e) {}
    }
  }, [checkInAt, checkOutAt, packageType, numGuests]);

  const handlePackageChange = (val: "daily" | "short_stay") => {
    form.setValue("packageType", val);
    if (checkInAt) {
      const inDate = new Date(checkInAt);
      if (!isNaN(inDate.getTime())) {
        const newOut = val === "daily" ? addHours(inDate, 24) : addHours(inDate, 3);
        form.setValue("checkOutAt", format(newOut, "yyyy-MM-dd'T'HH:mm"));
      }
    }
  };

  const createBooking = useCreateBooking({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListBookingsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetBookingsSummaryQueryKey() });
        toast({ title: "สร้างการจองสำเร็จ", description: "บันทึกข้อมูลเรียบร้อย" });
        onClose();
      },
      onError: (err: any) => {
        // Display toast error, matching 409 conflict
        if (err.message?.includes('409') || err.message?.includes('ซ้อนทับ')) {
          toast({
            variant: "destructive",
            title: "ห้องไม่ว่าง",
            description: "ห้องนี้มีการจองซ้อนทับในช่วงเวลาที่เลือก กรุณาเลือกห้องอื่นหรือเวลาอื่น",
          });
        } else {
          toast({
            variant: "destructive",
            title: "เกิดข้อผิดพลาด",
            description: err.message || "ไม่สามารถสร้างการจองได้",
          });
        }
      }
    }
  });

  const onSubmit = (data: BookingFormValues) => {
    const payload = {
      ...data,
      checkInAt: new Date(data.checkInAt).toISOString(),
      checkOutAt: new Date(data.checkOutAt).toISOString(),
    };
    createBooking.mutate({ data: payload });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] overflow-y-auto max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>สร้างการจองใหม่</DialogTitle>
          <DialogDescription>กรอกข้อมูลการเข้าพักเพื่อสร้างการจอง</DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="roomId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>ห้องพัก</FormLabel>
                    <Select onValueChange={(v) => field.onChange(parseInt(v, 10))} value={field.value?.toString()}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="เลือกห้อง" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {ROOMS.map((r) => (
                          <SelectItem key={r.id} value={r.id.toString()}>{r.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="numGuests"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>จำนวนผู้เข้าพัก</FormLabel>
                    <FormControl>
                      <Input type="number" min={1} max={10} {...field} />
                    </FormControl>
                    <p className="text-[10px] text-muted-foreground mt-1 leading-tight">
                      ห้องรองรับ 2 คน เกินจาก 2 คน คิดค่าเตียงเสริม 100 บาท/คน/คืน
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="guestName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>ชื่อผู้เช่า</FormLabel>
                  <FormControl>
                    <Input placeholder="เช่น สมชาย ใจดี" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="checkInAt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>เวลาเช็คอิน</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="checkOutAt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>เวลาเช็คเอาต์</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="packageType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>ประเภทแพ็กเกจ</FormLabel>
                    <Select onValueChange={handlePackageChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="เลือกแพ็กเกจ" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="daily">รายวัน (600 บาท/24 ชม.)</SelectItem>
                        <SelectItem value="short_stay">พักสั้น (300 บาท/3 ชม.)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="paymentMethod"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>การชำระเงิน</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="เลือกการชำระเงิน" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="prepaid">จ่ายล่วงหน้า</SelectItem>
                        <SelectItem value="pay_at_counter">จ่ายหน้าเคาท์เตอร์</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Pricing Summary Inline */}
            <div className="bg-primary/5 border border-primary/20 rounded-md p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">ราคาพื้นฐาน</span>
                <span className="font-medium">{formatThaiCurrency(pricingPreview.basePrice)}</span>
              </div>
              {pricingPreview.overtimeFee > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">ค่าเกินเวลา ({pricingPreview.overtimeHours} ชม.)</span>
                  <span className="font-medium">{formatThaiCurrency(pricingPreview.overtimeFee)}</span>
                </div>
              )}
              {pricingPreview.extraBedFee > 0 && (
                <div className="flex justify-between text-sm text-amber-700">
                  <span className="text-amber-700">เตียงเสริม</span>
                  <span className="font-medium">{formatThaiCurrency(pricingPreview.extraBedFee)}</span>
                </div>
              )}
              <Separator className="bg-primary/20 my-2" />
              <div className="flex justify-between font-bold text-primary">
                <span>ยอดรวม</span>
                <span>{formatThaiCurrency(pricingPreview.totalPrice)}</span>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>ยกเลิก</Button>
              <Button type="submit" disabled={createBooking.isPending}>
                {createBooking.isPending ? "กำลังบันทึก..." : "บันทึกการจอง"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
