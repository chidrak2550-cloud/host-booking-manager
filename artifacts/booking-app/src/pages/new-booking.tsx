import { useEffect, useState } from "react";
import { useLocation, Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { addHours, format, parseISO } from "date-fns";

import Layout from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { calculatePricing, formatThaiCurrency } from "@/lib/utils-booking";
import { useCreateBooking, getListBookingsQueryKey, getGetBookingsSummaryQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Clock, Save, ReceiptText } from "lucide-react";

// The schema matching the backend API requirements
const bookingSchema = z.object({
  guestName: z.string().min(1, "กรุณาระบุชื่อผู้เช่า"),
  checkInAt: z.string().min(1, "กรุณาระบุเวลาเช็คอิน"),
  checkOutAt: z.string().min(1, "กรุณาระบุเวลาเช็คเอาต์"),
  packageType: z.enum(["daily", "short_stay"]),
  paymentMethod: z.enum(["prepaid", "pay_at_counter"]),
  notes: z.string().optional(),
});

type BookingFormValues = z.infer<typeof bookingSchema>;

export default function NewBooking() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [pricingPreview, setPricingPreview] = useState({
    basePrice: 0,
    overtimeHours: 0,
    overtimeFee: 0,
    totalPrice: 0,
  });

  const now = new Date();
  // Round to nearest 15 mins for default check-in
  now.setMinutes(Math.ceil(now.getMinutes() / 15) * 15);
  const formattedNow = format(now, "yyyy-MM-dd'T'HH:mm");
  const formattedNextDay = format(addHours(now, 24), "yyyy-MM-dd'T'HH:mm");

  const form = useForm<BookingFormValues>({
    resolver: zodResolver(bookingSchema),
    defaultValues: {
      guestName: "",
      checkInAt: formattedNow,
      checkOutAt: formattedNextDay,
      packageType: "daily",
      paymentMethod: "prepaid",
      notes: "",
    },
  });

  const createBooking = useCreateBooking({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListBookingsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetBookingsSummaryQueryKey() });
        toast({
          title: "สร้างการจองสำเร็จ",
          description: "บันทึกข้อมูลการจองใหม่เรียบร้อยแล้ว",
        });
        setLocation("/");
      },
      onError: (err) => {
        toast({
          variant: "destructive",
          title: "เกิดข้อผิดพลาด",
          description: err.message || "ไม่สามารถสร้างการจองได้",
        });
      }
    }
  });

  const checkInAt = form.watch("checkInAt");
  const checkOutAt = form.watch("checkOutAt");
  const packageType = form.watch("packageType");

  // Auto-update check-out time when package changes (only for new setups to be helpful)
  // Or just update pricing preview whenever these 3 change
  useEffect(() => {
    if (checkInAt && checkOutAt && packageType) {
      try {
        const pricing = calculatePricing(checkInAt, checkOutAt, packageType);
        setPricingPreview(pricing);
      } catch (e) {
        // invalid dates, skip
      }
    }
  }, [checkInAt, checkOutAt, packageType]);

  const handlePackageChange = (val: "daily" | "short_stay") => {
    form.setValue("packageType", val);
    
    // Auto-adjust check-out time based on package choice
    if (checkInAt) {
      const inDate = new Date(checkInAt);
      if (!isNaN(inDate.getTime())) {
        const newOut = val === "daily" ? addHours(inDate, 24) : addHours(inDate, 3);
        form.setValue("checkOutAt", format(newOut, "yyyy-MM-dd'T'HH:mm"));
      }
    }
  };

  const onSubmit = (data: BookingFormValues) => {
    const payload = {
      ...data,
      // API expects ISO string
      checkInAt: new Date(data.checkInAt).toISOString(),
      checkOutAt: new Date(data.checkOutAt).toISOString(),
    };
    
    createBooking.mutate({ data: payload });
  };

  return (
    <Layout>
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-6">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="outline" size="icon" className="h-9 w-9">
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">สร้างการจองใหม่</h1>
              <p className="text-muted-foreground mt-1">กรอกข้อมูลผู้เช่าและรายละเอียดแพ็กเกจ</p>
            </div>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Left Column - Form */}
                <div className="lg:col-span-2 space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">ข้อมูลผู้เช่า</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
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
                              <Select onValueChange={handlePackageChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="เลือกประเภทแพ็กเกจ" />
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
                              <FormLabel>วิธีการชำระเงิน</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="เลือกวิธีการชำระเงิน" />
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
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">หมายเหตุ (เพิ่มเติม)</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <FormField
                        control={form.control}
                        name="notes"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Textarea 
                                placeholder="ข้อมูลเพิ่มเติม เช่น ความต้องการพิเศษ หรือข้อควรระวัง..." 
                                className="min-h-[100px] resize-none"
                                {...field} 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </CardContent>
                  </Card>
                </div>

                {/* Right Column - Pricing Preview */}
                <div className="lg:col-span-1">
                  <Card className="sticky top-6 border-primary/20 bg-primary/5">
                    <CardHeader className="pb-4">
                      <CardTitle className="flex items-center gap-2 text-lg text-primary">
                        <ReceiptText className="w-5 h-5" />
                        สรุปค่าใช้จ่าย
                      </CardTitle>
                      <CardDescription>
                        คำนวณจากเวลาที่เลือก
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-3 text-sm">
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">ราคาพื้นฐาน</span>
                          <span className="font-medium">{formatThaiCurrency(pricingPreview.basePrice)}</span>
                        </div>
                        
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground flex items-center gap-1">
                            ค่าเกินเวลา
                            {pricingPreview.overtimeHours > 0 && (
                              <span className="text-xs bg-amber-100 text-amber-800 px-1.5 rounded-sm">
                                {pricingPreview.overtimeHours} ชม.
                              </span>
                            )}
                          </span>
                          <span className="font-medium">{formatThaiCurrency(pricingPreview.overtimeFee)}</span>
                        </div>
                      </div>
                      
                      <Separator className="bg-primary/20" />
                      
                      <div className="flex justify-between items-center pt-2">
                        <span className="font-bold text-foreground">จำนวนเงินรวม</span>
                        <span className="text-2xl font-bold text-primary">
                          {formatThaiCurrency(pricingPreview.totalPrice)}
                        </span>
                      </div>
                    </CardContent>
                    <CardFooter>
                      <Button 
                        type="submit" 
                        className="w-full h-12 text-md gap-2"
                        disabled={createBooking.isPending}
                      >
                        <Save className="w-5 h-5" />
                        {createBooking.isPending ? "กำลังบันทึก..." : "บันทึกการจอง"}
                      </Button>
                    </CardFooter>
                  </Card>
                </div>

              </div>
            </form>
          </Form>

        </div>
      </div>
    </Layout>
  );
}
