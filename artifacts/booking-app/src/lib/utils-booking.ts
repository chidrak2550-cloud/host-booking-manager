import { format, differenceInHours } from "date-fns";

export const ROOMS = [
  { id: 1, name: "ห้อง 01" },
  { id: 2, name: "ห้อง 02" },
  { id: 3, name: "ห้อง 03" },
  { id: 4, name: "ห้อง 04" },
  { id: 5, name: "ห้อง 05" },
];

export const ROOM_CAPACITY = 2;
export const SHORT_STAY_BASE = 300;
export const DAILY_BASE = 600;
export const OVERTIME_RATE = 100;
export const EXTRA_BED_RATE = 100;

export function formatDuration(checkInAt: string | Date, checkOutAt: string | Date): string {
  const checkIn = new Date(checkInAt);
  const checkOut = new Date(checkOutAt);
  const totalMinutes = Math.max(0, Math.round((checkOut.getTime() - checkIn.getTime()) / (1000 * 60)));
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days} วัน`);
  if (hours > 0) parts.push(`${hours} ชั่วโมง`);
  if (minutes > 0 && days === 0) parts.push(`${minutes} นาที`);
  return parts.length > 0 ? parts.join(" ") : "0 นาที";
}

export function formatThaiDateTime(isoString: string | Date): string {
  const date = typeof isoString === "string" ? new Date(isoString) : isoString;
  return new Intl.DateTimeFormat("th-TH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Bangkok",
  }).format(date);
}

export function formatThaiDate(isoString: string | Date): string {
  const date = typeof isoString === "string" ? new Date(isoString) : isoString;
  return new Intl.DateTimeFormat("th-TH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "Asia/Bangkok",
  }).format(date);
}

export function formatThaiCurrency(amount: number): string {
  return new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Calculate pricing matching the backend logic exactly.
 *
 * Short-stay:
 *   <= 3h → 300 THB
 *   3h–24h → min(300 + ceil(hours-3)×100, 600)
 *   >= 24h → multi-day daily pricing
 *
 * Daily:
 *   <= 24h → 600 THB
 *   > 24h → floor(hours/24)×600 + overtime for remaining hours
 *
 * Overtime cap: if overtime cost >= 600, charge another full day instead.
 * Extra bed: (numGuests - 2) × 100 × numNights (where numNights = max(1, ceil(hours/24)))
 */
export function calculatePricing(
  checkInAt: string | Date,
  checkOutAt: string | Date,
  packageType: "daily" | "short_stay",
  numGuests: number = 1,
): {
  basePrice: number;
  overtimeHours: number;
  overtimeFee: number;
  extraBedFee: number;
  totalPrice: number;
} {
  const checkIn = new Date(checkInAt);
  const checkOut = new Date(checkOutAt);

  if (checkOut <= checkIn) {
    const basePrice = packageType === "daily" ? DAILY_BASE : SHORT_STAY_BASE;
    return { basePrice, overtimeHours: 0, overtimeFee: 0, extraBedFee: 0, totalPrice: basePrice };
  }

  const durationMs = checkOut.getTime() - checkIn.getTime();
  const durationHours = durationMs / (1000 * 60 * 60);

  let basePrice = 0;
  let overtimeHours = 0;
  let overtimeFee = 0;

  if (packageType === "short_stay") {
    if (durationHours <= 3) {
      basePrice = SHORT_STAY_BASE;
    } else if (durationHours < 24) {
      const rawOvertime = Math.ceil(durationHours - 3);
      const uncapped = SHORT_STAY_BASE + rawOvertime * OVERTIME_RATE;
      if (uncapped >= DAILY_BASE) {
        basePrice = DAILY_BASE;
      } else {
        basePrice = SHORT_STAY_BASE;
        overtimeHours = rawOvertime;
        overtimeFee = rawOvertime * OVERTIME_RATE;
      }
    } else {
      // Multi-day
      const fullDays = Math.floor(durationHours / 24);
      const remaining = durationHours - fullDays * 24;
      basePrice = fullDays * DAILY_BASE;
      if (remaining > 0) {
        const ot = Math.ceil(remaining);
        const otCost = ot * OVERTIME_RATE;
        if (otCost >= DAILY_BASE) {
          basePrice += DAILY_BASE;
        } else {
          overtimeHours = ot;
          overtimeFee = otCost;
        }
      }
    }
  } else {
    if (durationHours <= 24) {
      basePrice = DAILY_BASE;
    } else {
      const fullDays = Math.floor(durationHours / 24);
      const remaining = durationHours - fullDays * 24;
      basePrice = fullDays * DAILY_BASE;
      if (remaining > 0) {
        const ot = Math.ceil(remaining);
        const otCost = ot * OVERTIME_RATE;
        if (otCost >= DAILY_BASE) {
          basePrice += DAILY_BASE;
        } else {
          overtimeHours = ot;
          overtimeFee = otCost;
        }
      }
    }
  }

  const extraPersons = Math.max(0, numGuests - ROOM_CAPACITY);
  const numNights = Math.max(1, Math.ceil(durationHours / 24));
  const extraBedFee = extraPersons * EXTRA_BED_RATE * numNights;
  const totalPrice = basePrice + overtimeFee + extraBedFee;

  return { basePrice, overtimeHours, overtimeFee, extraBedFee, totalPrice };
}
