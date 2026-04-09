import { Router, type IRouter } from "express";
import { eq, desc, sql } from "drizzle-orm";
import { db, bookingsTable } from "@workspace/db";
import {
  CreateBookingBody,
  UpdateBookingBody,
  UpdateBookingParams,
  GetBookingParams,
  DeleteBookingParams,
  GetBookingResponse,
  UpdateBookingResponse,
  ListBookingsResponse,
  GetBookingsSummaryResponse,
} from "@workspace/api-zod";
import { calculatePricing } from "../lib/pricing";

const router: IRouter = Router();

function toBookingJson(booking: typeof bookingsTable.$inferSelect) {
  return {
    ...booking,
    basePrice: Number(booking.basePrice),
    overtimeFee: Number(booking.overtimeFee),
    totalPrice: Number(booking.totalPrice),
    overtimeHours: booking.overtimeHours,
    checkInAt: booking.checkInAt.toISOString(),
    checkOutAt: booking.checkOutAt.toISOString(),
    createdAt: booking.createdAt.toISOString(),
    updatedAt: booking.updatedAt.toISOString(),
    notes: booking.notes ?? null,
  };
}

router.get("/bookings/summary", async (req, res): Promise<void> => {
  const allBookings = await db.select().from(bookingsTable);

  const now = new Date();
  const bangkokOffset = 7 * 60;
  const bangkokNow = new Date(now.getTime() + bangkokOffset * 60 * 1000);
  const todayStart = new Date(Date.UTC(bangkokNow.getUTCFullYear(), bangkokNow.getUTCMonth(), bangkokNow.getUTCDate()) - bangkokOffset * 60 * 1000);
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

  let totalRevenue = 0;
  let pendingCount = 0;
  let paidCount = 0;
  let checkedOutCount = 0;
  let todayBookings = 0;
  let todayRevenue = 0;

  for (const b of allBookings) {
    const price = Number(b.totalPrice);
    if (b.status === "paid" || b.status === "checked_out") {
      totalRevenue += price;
    }
    if (b.status === "pending") pendingCount++;
    if (b.status === "paid") paidCount++;
    if (b.status === "checked_out") checkedOutCount++;

    if (b.checkInAt >= todayStart && b.checkInAt < todayEnd) {
      todayBookings++;
      if (b.status === "paid" || b.status === "checked_out") {
        todayRevenue += price;
      }
    }
  }

  const summary = {
    totalBookings: allBookings.length,
    pendingCount,
    paidCount,
    checkedOutCount,
    totalRevenue,
    todayBookings,
    todayRevenue,
  };

  res.json(GetBookingsSummaryResponse.parse(summary));
});

router.get("/bookings", async (req, res): Promise<void> => {
  const bookings = await db
    .select()
    .from(bookingsTable)
    .orderBy(desc(bookingsTable.checkInAt));
  res.json(ListBookingsResponse.parse(bookings.map(toBookingJson)));
});

router.post("/bookings", async (req, res): Promise<void> => {
  const parsed = CreateBookingBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", message: parsed.error.message });
    return;
  }

  const { guestName, checkInAt, checkOutAt, packageType, paymentMethod, notes } = parsed.data;
  const checkIn = new Date(checkInAt);
  const checkOut = new Date(checkOutAt);

  if (checkOut <= checkIn) {
    res.status(400).json({ error: "invalid_dates", message: "Check-out must be after check-in" });
    return;
  }

  const { basePrice, overtimeHours, overtimeFee, totalPrice } = calculatePricing(checkIn, checkOut, packageType);

  const [booking] = await db
    .insert(bookingsTable)
    .values({
      guestName,
      checkInAt: checkIn,
      checkOutAt: checkOut,
      packageType,
      paymentMethod,
      notes: notes ?? null,
      basePrice: String(basePrice),
      overtimeFee: String(overtimeFee),
      totalPrice: String(totalPrice),
      overtimeHours,
    })
    .returning();

  res.status(201).json(GetBookingResponse.parse(toBookingJson(booking)));
});

router.get("/bookings/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetBookingParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: "invalid_params", message: params.error.message });
    return;
  }

  const [booking] = await db
    .select()
    .from(bookingsTable)
    .where(eq(bookingsTable.id, params.data.id));

  if (!booking) {
    res.status(404).json({ error: "not_found", message: "Booking not found" });
    return;
  }

  res.json(GetBookingResponse.parse(toBookingJson(booking)));
});

router.patch("/bookings/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = UpdateBookingParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: "invalid_params", message: params.error.message });
    return;
  }

  const parsed = UpdateBookingBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", message: parsed.error.message });
    return;
  }

  const [existing] = await db
    .select()
    .from(bookingsTable)
    .where(eq(bookingsTable.id, params.data.id));

  if (!existing) {
    res.status(404).json({ error: "not_found", message: "Booking not found" });
    return;
  }

  const updates: Record<string, unknown> = {};
  if (parsed.data.status !== undefined) updates.status = parsed.data.status;
  if (parsed.data.notes !== undefined) updates.notes = parsed.data.notes;

  if (parsed.data.checkOutAt !== undefined) {
    const newCheckOut = new Date(parsed.data.checkOutAt);
    const checkIn = existing.checkInAt;
    const { basePrice, overtimeHours, overtimeFee, totalPrice } = calculatePricing(
      checkIn,
      newCheckOut,
      existing.packageType,
    );
    updates.checkOutAt = newCheckOut;
    updates.basePrice = String(basePrice);
    updates.overtimeFee = String(overtimeFee);
    updates.totalPrice = String(totalPrice);
    updates.overtimeHours = overtimeHours;
  }

  const [updated] = await db
    .update(bookingsTable)
    .set(updates)
    .where(eq(bookingsTable.id, params.data.id))
    .returning();

  res.json(UpdateBookingResponse.parse(toBookingJson(updated)));
});

router.delete("/bookings/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = DeleteBookingParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: "invalid_params", message: params.error.message });
    return;
  }

  const [deleted] = await db
    .delete(bookingsTable)
    .where(eq(bookingsTable.id, params.data.id))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "not_found", message: "Booking not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
