import { Router, type IRouter } from "express";
import { eq, and, or, lt, gt, ne } from "drizzle-orm";
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
  ListBookingsQueryParams,
} from "@workspace/api-zod";
import { calculatePricing } from "../lib/pricing";

const router: IRouter = Router();

const ROOMS = [1, 2, 3, 4, 5];

function toBookingJson(booking: typeof bookingsTable.$inferSelect) {
  return {
    ...booking,
    basePrice: Number(booking.basePrice),
    overtimeFee: Number(booking.overtimeFee),
    extraBedFee: Number(booking.extraBedFee),
    totalPrice: Number(booking.totalPrice),
    overtimeHours: booking.overtimeHours,
    checkInAt: booking.checkInAt.toISOString(),
    checkOutAt: booking.checkOutAt.toISOString(),
    createdAt: booking.createdAt.toISOString(),
    updatedAt: booking.updatedAt.toISOString(),
    notes: booking.notes ?? null,
  };
}

async function checkConflict(
  roomId: number,
  checkIn: Date,
  checkOut: Date,
  excludeId?: number,
): Promise<boolean> {
  const conflicts = await db
    .select({ id: bookingsTable.id })
    .from(bookingsTable)
    .where(
      and(
        eq(bookingsTable.roomId, roomId),
        excludeId ? ne(bookingsTable.id, excludeId) : undefined,
        // Overlap condition: existing.checkIn < new.checkOut AND existing.checkOut > new.checkIn
        lt(bookingsTable.checkInAt, checkOut),
        gt(bookingsTable.checkOutAt, checkIn),
      ),
    );
  return conflicts.length > 0;
}

router.get("/bookings/summary", async (req, res): Promise<void> => {
  const allBookings = await db.select().from(bookingsTable);

  const bangkokOffset = 7 * 60;
  const now = new Date();
  const bangkokNow = new Date(now.getTime() + bangkokOffset * 60 * 1000);
  const todayStart = new Date(
    Date.UTC(bangkokNow.getUTCFullYear(), bangkokNow.getUTCMonth(), bangkokNow.getUTCDate()) -
      bangkokOffset * 60 * 1000,
  );
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

  let totalRevenue = 0;
  let pendingCount = 0;
  let paidCount = 0;
  let checkedOutCount = 0;
  let todayBookings = 0;
  let todayRevenue = 0;

  for (const b of allBookings) {
    const price = Number(b.totalPrice);
    if (b.status === "paid" || b.status === "checked_out") totalRevenue += price;
    if (b.status === "pending") pendingCount++;
    if (b.status === "paid") paidCount++;
    if (b.status === "checked_out") checkedOutCount++;
    if (b.checkInAt >= todayStart && b.checkInAt < todayEnd) {
      todayBookings++;
      if (b.status === "paid" || b.status === "checked_out") todayRevenue += price;
    }
  }

  res.json(
    GetBookingsSummaryResponse.parse({
      totalBookings: allBookings.length,
      pendingCount,
      paidCount,
      checkedOutCount,
      totalRevenue,
      todayBookings,
      todayRevenue,
    }),
  );
});

router.get("/bookings", async (req, res): Promise<void> => {
  const queryParsed = ListBookingsQueryParams.safeParse(req.query);
  const filters: Parameters<typeof and>[0][] = [];

  if (queryParsed.success) {
    if (queryParsed.data.roomId) {
      filters.push(eq(bookingsTable.roomId, queryParsed.data.roomId));
    }
    if (queryParsed.data.startDate) {
      filters.push(gt(bookingsTable.checkOutAt, new Date(queryParsed.data.startDate)));
    }
    if (queryParsed.data.endDate) {
      filters.push(lt(bookingsTable.checkInAt, new Date(queryParsed.data.endDate)));
    }
  }

  const bookings =
    filters.length > 0
      ? await db
          .select()
          .from(bookingsTable)
          .where(and(...filters))
      : await db.select().from(bookingsTable);

  // Sort by check-in date descending
  bookings.sort((a, b) => b.checkInAt.getTime() - a.checkInAt.getTime());

  res.json(ListBookingsResponse.parse(bookings.map(toBookingJson)));
});

router.post("/bookings", async (req, res): Promise<void> => {
  const parsed = CreateBookingBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", message: parsed.error.message });
    return;
  }

  const { roomId, guestName, numGuests, checkInAt, checkOutAt, packageType, paymentMethod, notes } =
    parsed.data;

  // Validate room ID
  if (!ROOMS.includes(roomId)) {
    res.status(400).json({ error: "invalid_room", message: "Room ID must be between 1 and 5" });
    return;
  }

  const checkIn = new Date(checkInAt);
  const checkOut = new Date(checkOutAt);

  if (checkOut <= checkIn) {
    res.status(400).json({ error: "invalid_dates", message: "Check-out must be after check-in" });
    return;
  }

  // Check for booking conflicts
  const hasConflict = await checkConflict(roomId, checkIn, checkOut);
  if (hasConflict) {
    res.status(409).json({
      error: "booking_conflict",
      message: `ห้อง ${String(roomId).padStart(2, "0")} มีการจองซ้อนทับในช่วงเวลานี้แล้ว`,
    });
    return;
  }

  const { basePrice, overtimeHours, overtimeFee, extraBedFee, totalPrice } = calculatePricing(
    checkIn,
    checkOut,
    packageType,
    numGuests ?? 1,
  );

  const [booking] = await db
    .insert(bookingsTable)
    .values({
      roomId,
      guestName,
      numGuests: numGuests ?? 1,
      checkInAt: checkIn,
      checkOutAt: checkOut,
      packageType,
      paymentMethod,
      notes: notes ?? null,
      basePrice: String(basePrice),
      overtimeFee: String(overtimeFee),
      extraBedFee: String(extraBedFee),
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

  const newNumGuests = parsed.data.numGuests ?? existing.numGuests;
  if (parsed.data.numGuests !== undefined) updates.numGuests = newNumGuests;

  if (parsed.data.checkOutAt !== undefined) {
    const newCheckOut = new Date(parsed.data.checkOutAt);
    const checkIn = existing.checkInAt;

    // Conflict check for updated checkout
    const hasConflict = await checkConflict(existing.roomId, checkIn, newCheckOut, existing.id);
    if (hasConflict) {
      res.status(409).json({
        error: "booking_conflict",
        message: `ห้อง ${String(existing.roomId).padStart(2, "0")} มีการจองซ้อนทับในช่วงเวลาใหม่`,
      });
      return;
    }

    const { basePrice, overtimeHours, overtimeFee, extraBedFee, totalPrice } = calculatePricing(
      checkIn,
      newCheckOut,
      existing.packageType,
      newNumGuests,
    );
    updates.checkOutAt = newCheckOut;
    updates.basePrice = String(basePrice);
    updates.overtimeFee = String(overtimeFee);
    updates.extraBedFee = String(extraBedFee);
    updates.totalPrice = String(totalPrice);
    updates.overtimeHours = overtimeHours;
  } else if (parsed.data.numGuests !== undefined) {
    // Recalculate pricing for guest count change
    const { basePrice, overtimeHours, overtimeFee, extraBedFee, totalPrice } = calculatePricing(
      existing.checkInAt,
      existing.checkOutAt,
      existing.packageType,
      newNumGuests,
    );
    updates.basePrice = String(basePrice);
    updates.overtimeFee = String(overtimeFee);
    updates.extraBedFee = String(extraBedFee);
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
