import { useState, useEffect } from "react";
import { useParams, Link, useLocation } from "wouter";
import { format, parseISO } from "date-fns";

import Layout from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { StatusBadge } from "@/components/status-badge";
import { formatThaiCurrency, formatThaiDateTime, calculatePricing } from "@/lib/utils-booking";
import { 
  useGetBooking, 
  getGetBookingQueryKey, 
  useUpdateBooking,
  useDeleteBooking,
  getListBookingsQueryKey,
  getGetBookingsSummaryQueryKey,
  BookingStatus
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Clock, CalendarIcon, User, CreditCard, Trash2, Edit2, CheckCircle, ReceiptText } from "lucide-react";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export default function BookingDetail() {
  const params = useParams();
  const id = parseInt(params.id || "0", 10);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: booking, isLoading, isError } = useGetBooking(id, {
    query: { enabled: !!id, queryKey: getGetBookingQueryKey(id) }
  });

  const updateBooking = useUpdateBooking({
    mutation: {
      onSuccess: (data) => {
        // Update local cache
        queryClient.setQueryData(getGetBookingQueryKey(id), data);
        queryClient.invalidateQueries({ queryKey: getListBookingsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetBookingsSummaryQueryKey() });
        toast({ title: "อัปเดตสำเร็จ", description: "แก้ไขข้อมูลการจองเรียบร้อยแล้ว" });
        setEditMode(false);
      },
      onError: (err) => {
        toast({ variant: "destructive", title: "เกิดข้อผิดพลาด", description: err.message });
      }
    }
  });

  const deleteBooking = useDeleteBooking({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListBookingsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetBookingsSummaryQueryKey() });
        toast({ title: "ลบสำเร็จ", description: "ลบข้อมูลการจองเรียบร้อยแล้ว" });
        setLocation("/");
      },
      onError: (err) => {
        toast({ variant: "destructive", title: "เกิดข้อผิดพลาด", description: err.message });
      }
    }
  });

  const [statusUpdating, setStatusUpdating] = useState<boolean>(false);

  // Edit checkout & notes form
  const [editMode, setEditMode] = useState(false);
  const [editCheckOutAt, setEditCheckOutAt] = useState<string>("");
  const [editNotes, setEditNotes] = useState<string>("");
  const [previewPricing, setPreviewPricing] = useState({
    basePrice: 0,
    overtimeHours: 0,
    overtimeFee: 0,
    totalPrice: 0,
  });

  useEffect(() => {
    if (booking) {
      setEditCheckOutAt(format(parseISO(booking.checkOutAt), "yyyy-MM-dd'T'HH:mm"));
      setEditNotes(booking.notes || "");
    }
  }, [booking, editMode]);

  useEffect(() => {
    if (booking && editMode && editCheckOutAt) {
      try {
        const pricing = calculatePricing(booking.checkInAt, new Date(editCheckOutAt).toISOString(), booking.packageType);
        setPreviewPricing(pricing);
      } catch (e) {}
    }
  }, [editCheckOutAt, booking, editMode]);


  const handleStatusChange = (newStatus: "pending" | "paid" | "checked_out") => {
    setStatusUpdating(true);
    updateBooking.mutate({ id, data: { status: newStatus } }, {
      onSettled: () => setStatusUpdating(false)
    });
  };

  const handleSaveEdits = () => {
    try {
      const isoCheckOut = new Date(editCheckOutAt).toISOString();
      updateBooking.mutate({ id, data: { checkOutAt: isoCheckOut, notes: editNotes } });
    } catch (e) {
      toast({ variant: "destructive", title: "รูปแบบวันที่ไม่ถูกต้อง" });
    }
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-6 w-full">
          <Skeleton className="h-10 w-48" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Skeleton className="h-64 md:col-span-2" />
            <Skeleton className="h-64 md:col-span-1" />
          </div>
        </div>
      </Layout>
    );
  }

  if (isError || !booking) {
    return (
      <Layout>
        <div className="p-6 flex flex-col items-center justify-center h-full">
          <h2 className="text-xl font-bold">ไม่พบข้อมูลการจอง</h2>
          <Link href="/">
            <Button variant="link" className="mt-4">กลับไปหน้าแดชบอร์ด</Button>
          </Link>
        </div>
      </Layout>
    );
  }

  const isDaily = booking.packageType === "daily";
  const isPrepaid = booking.paymentMethod === "prepaid";

  return (
    <Layout>
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-6">
          
          {/* Header Action Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Link href="/">
                <Button variant="outline" size="icon" className="h-9 w-9">
                  <ArrowLeft className="w-4 h-4" />
                </Button>
              </Link>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold tracking-tight">รหัสการจอง #{booking.id}</h1>
                  <StatusBadge status={booking.status as BookingStatusType} className="text-sm px-3 py-1" />
                </div>
                <p className="text-muted-foreground text-sm mt-1">
                  วันที่สร้าง: {formatThaiDateTime(booking.createdAt)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Select 
                disabled={statusUpdating} 
                value={booking.status} 
                onValueChange={(val) => handleStatusChange(val as "pending" | "paid" | "checked_out")}
              >
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="เปลี่ยนสถานะ" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">รอดำเนินการ</SelectItem>
                  <SelectItem value="paid">ชำระแล้ว</SelectItem>
                  <SelectItem value="checked_out">เช็คเอาต์แล้ว</SelectItem>
                </SelectContent>
              </Select>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="icon">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>ยืนยันการลบ?</AlertDialogTitle>
                    <AlertDialogDescription>
                      คุณต้องการลบการจองรหัส #{booking.id} ของ {booking.guestName} ใช่หรือไม่? การกระทำนี้ไม่สามารถย้อนกลับได้
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
                    <AlertDialogAction onClick={() => deleteBooking.mutate({ id })} className="bg-destructive hover:bg-destructive/90">
                      ลบข้อมูล
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Left Col - Details */}
            <div className="lg:col-span-2 space-y-6">
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-4 border-b border-border/50">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <User className="w-5 h-5 text-primary" />
                    ข้อมูลผู้เช่า
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label className="text-muted-foreground text-xs uppercase tracking-wider">ชื่อผู้เช่า</Label>
                    <p className="font-medium text-lg mt-1">{booking.guestName}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs uppercase tracking-wider">แพ็กเกจ</Label>
                    <p className="font-medium text-lg mt-1">
                      {isDaily ? "รายวัน (600 บาท/24 ชม.)" : "พักสั้น (300 บาท/3 ชม.)"}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs uppercase tracking-wider">วิธีการชำระเงิน</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <CreditCard className="w-4 h-4 text-muted-foreground" />
                      <p className="font-medium">{isPrepaid ? "จ่ายล่วงหน้า" : "จ่ายหน้าเคาท์เตอร์"}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-4 border-b border-border/50">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <CalendarIcon className="w-5 h-5 text-primary" />
                    เวลาการเข้าพัก
                  </CardTitle>
                  <Dialog open={editMode} onOpenChange={setEditMode}>
                    <DialogTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 gap-2">
                        <Edit2 className="w-4 h-4" /> แก้ไข
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>แก้ไขการเข้าพัก</DialogTitle>
                        <DialogDescription>
                          เปลี่ยนแปลงเวลาเช็คเอาต์ หรือ หมายเหตุ
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label>เวลาเช็คเอาต์</Label>
                          <Input 
                            type="datetime-local" 
                            value={editCheckOutAt} 
                            onChange={(e) => setEditCheckOutAt(e.target.value)} 
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>หมายเหตุ</Label>
                          <Textarea 
                            value={editNotes} 
                            onChange={(e) => setEditNotes(e.target.value)} 
                            rows={3}
                          />
                        </div>

                        {/* Preview price changes inside dialog */}
                        <div className="bg-muted p-4 rounded-md space-y-2 mt-4">
                          <p className="text-sm font-medium mb-2">สรุปค่าใช้จ่ายที่จะปรับปรุง:</p>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">ราคาพื้นฐาน</span>
                            <span>{formatThaiCurrency(previewPricing.basePrice)}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">ค่าเกินเวลา ({previewPricing.overtimeHours} ชม.)</span>
                            <span>{formatThaiCurrency(previewPricing.overtimeFee)}</span>
                          </div>
                          <div className="flex justify-between font-bold text-primary mt-2 pt-2 border-t border-border">
                            <span>จำนวนเงินรวม</span>
                            <span>{formatThaiCurrency(previewPricing.totalPrice)}</span>
                          </div>
                        </div>

                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setEditMode(false)}>ยกเลิก</Button>
                        <Button onClick={handleSaveEdits} disabled={updateBooking.isPending}>
                          {updateBooking.isPending ? "กำลังบันทึก..." : "บันทึกการแก้ไข"}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </CardHeader>
                <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label className="text-muted-foreground text-xs uppercase tracking-wider">เวลาเช็คอิน</Label>
                    <p className="font-medium text-lg mt-1">{formatThaiDateTime(booking.checkInAt)}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs uppercase tracking-wider">เวลาเช็คเอาต์</Label>
                    <p className="font-medium text-lg mt-1">{formatThaiDateTime(booking.checkOutAt)}</p>
                  </div>
                </CardContent>
              </Card>

              {booking.notes && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground uppercase tracking-wider font-semibold">หมายเหตุ</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-foreground whitespace-pre-wrap">{booking.notes}</p>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Right Col - Receipt/Pricing */}
            <div className="lg:col-span-1 space-y-6">
              <Card className="border-primary/20 bg-primary/5 shadow-md">
                <CardHeader className="pb-4 border-b border-primary/10">
                  <CardTitle className="flex items-center gap-2 text-lg text-primary">
                    <ReceiptText className="w-5 h-5" />
                    ใบแจ้งหนี้
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6 space-y-4">
                  
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">ราคาพื้นฐาน</span>
                    <span className="font-medium">{formatThaiCurrency(booking.basePrice)}</span>
                  </div>
                  
                  {booking.overtimeHours > 0 && (
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground flex flex-col">
                        <span>เกินเวลา</span>
                        <span className="text-xs text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded-sm w-max mt-1">
                          {booking.overtimeHours} ชั่วโมง
                        </span>
                      </span>
                      <span className="font-medium text-amber-700">{formatThaiCurrency(booking.overtimeFee)}</span>
                    </div>
                  )}

                  <Separator className="bg-primary/20" />
                  
                  <div className="flex justify-between items-end pt-2">
                    <span className="font-bold text-foreground">จำนวนเงินรวม</span>
                    <span className="text-3xl font-bold text-primary">
                      {formatThaiCurrency(booking.totalPrice)}
                    </span>
                  </div>

                  <div className="mt-6 pt-6 border-t border-primary/10 flex justify-center">
                    {booking.status === 'paid' ? (
                      <div className="flex items-center gap-2 text-emerald-600 font-medium">
                        <CheckCircle className="w-5 h-5" />
                        ชำระเงินเรียบร้อยแล้ว
                      </div>
                    ) : booking.status === 'checked_out' ? (
                       <div className="flex items-center gap-2 text-slate-500 font-medium">
                        <CheckCircle className="w-5 h-5" />
                        จบการเข้าพัก
                      </div>
                    ) : (
                      <Button 
                        className="w-full bg-primary hover:bg-primary/90"
                        onClick={() => handleStatusChange("paid")}
                        disabled={statusUpdating}
                      >
                        ยืนยันการชำระเงิน
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

          </div>
        </div>
      </div>
    </Layout>
  );
}
// define type for component
type BookingStatusType = "pending" | "paid" | "checked_out";
