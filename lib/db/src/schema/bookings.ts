import { pgTable, text, serial, timestamp, integer, numeric, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const packageTypeEnum = pgEnum("package_type", ["daily", "short_stay"]);
export const paymentMethodEnum = pgEnum("payment_method", ["prepaid", "pay_at_counter"]);
export const bookingStatusEnum = pgEnum("booking_status", ["pending", "paid", "checked_out"]);

export const bookingsTable = pgTable("bookings", {
  id: serial("id").primaryKey(),
  guestName: text("guest_name").notNull(),
  checkInAt: timestamp("check_in_at", { withTimezone: true }).notNull(),
  checkOutAt: timestamp("check_out_at", { withTimezone: true }).notNull(),
  packageType: packageTypeEnum("package_type").notNull(),
  paymentMethod: paymentMethodEnum("payment_method").notNull(),
  status: bookingStatusEnum("status").notNull().default("pending"),
  basePrice: numeric("base_price", { precision: 10, scale: 2 }).notNull(),
  overtimeFee: numeric("overtime_fee", { precision: 10, scale: 2 }).notNull().default("0"),
  totalPrice: numeric("total_price", { precision: 10, scale: 2 }).notNull(),
  overtimeHours: integer("overtime_hours").notNull().default(0),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertBookingSchema = createInsertSchema(bookingsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertBooking = z.infer<typeof insertBookingSchema>;
export type Booking = typeof bookingsTable.$inferSelect;
