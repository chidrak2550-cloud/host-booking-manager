/**
 * Pricing logic for room bookings (Asia/Bangkok GMT+7)
 *
 * Rules:
 * - Short-stay (short_stay): 300 THB for first 3 hours
 *   - If > 3h but < 24h: 300 + (extra hours × 100), capped at 600 for that "day"
 * - Daily (daily): 600 THB per 24 hours
 *   - Multi-day: floor(hours/24) × 600 + overtime for remaining hours
 * - Overtime: 100 THB per started hour beyond package duration
 * - Extra Bed: 100 THB per extra person (beyond 2) per night
 *   - num_nights = ceil(duration / 24h)
 */

const SHORT_STAY_BASE = 300;
const DAILY_BASE = 600;
const SHORT_STAY_HOURS = 3;
const DAILY_HOURS = 24;
const OVERTIME_RATE = 100;
const ROOM_CAPACITY = 2;
const EXTRA_BED_RATE = 100;

export function calculatePricing(
  checkInAt: Date,
  checkOutAt: Date,
  packageType: "daily" | "short_stay",
  numGuests: number = 1,
): {
  basePrice: number;
  overtimeHours: number;
  overtimeFee: number;
  extraBedFee: number;
  totalPrice: number;
} {
  const durationMs = checkOutAt.getTime() - checkInAt.getTime();
  const durationHours = durationMs / (1000 * 60 * 60);

  let basePrice = 0;
  let overtimeHours = 0;
  let overtimeFee = 0;

  if (packageType === "short_stay") {
    if (durationHours <= SHORT_STAY_HOURS) {
      // Within 3 hours: flat 300
      basePrice = SHORT_STAY_BASE;
      overtimeHours = 0;
      overtimeFee = 0;
    } else if (durationHours < DAILY_HOURS) {
      // More than 3 hours but less than 24: 300 + overtime, capped at 600
      const rawOvertime = Math.ceil(durationHours - SHORT_STAY_HOURS);
      const uncappedTotal = SHORT_STAY_BASE + rawOvertime * OVERTIME_RATE;
      if (uncappedTotal >= DAILY_BASE) {
        // Cap at daily rate — no overtime charged separately
        basePrice = DAILY_BASE;
        overtimeHours = 0;
        overtimeFee = 0;
      } else {
        basePrice = SHORT_STAY_BASE;
        overtimeHours = rawOvertime;
        overtimeFee = rawOvertime * OVERTIME_RATE;
      }
    } else {
      // >= 24 hours with short_stay: treat as multi-day daily
      const fullDays = Math.floor(durationHours / DAILY_HOURS);
      const remainingHours = durationHours - fullDays * DAILY_HOURS;
      basePrice = fullDays * DAILY_BASE;

      if (remainingHours > 0) {
        const remainingOvertime = Math.ceil(remainingHours);
        // Remaining hours: charge overtime per hour (already paid for full days)
        const remainingCost = remainingOvertime * OVERTIME_RATE;
        if (remainingCost >= DAILY_BASE) {
          // Would be cheaper as another full day
          basePrice += DAILY_BASE;
          overtimeHours = 0;
          overtimeFee = 0;
        } else {
          overtimeHours = remainingOvertime;
          overtimeFee = remainingCost;
        }
      }
    }
  } else {
    // daily package
    if (durationHours <= DAILY_HOURS) {
      // Up to 24 hours: flat 600
      basePrice = DAILY_BASE;
      overtimeHours = 0;
      overtimeFee = 0;
    } else {
      // More than 24 hours: full days × 600 + overtime for remaining hours
      const fullDays = Math.floor(durationHours / DAILY_HOURS);
      const remainingHours = durationHours - fullDays * DAILY_HOURS;
      basePrice = fullDays * DAILY_BASE;

      if (remainingHours > 0) {
        overtimeHours = Math.ceil(remainingHours);
        overtimeFee = overtimeHours * OVERTIME_RATE;
        // Cap remaining hours cost at another full day
        if (overtimeFee >= DAILY_BASE) {
          basePrice += DAILY_BASE;
          overtimeHours = 0;
          overtimeFee = 0;
        }
      }
    }
  }

  // Extra bed fee: 100 THB per extra person beyond 2, per night
  const extraPersons = Math.max(0, numGuests - ROOM_CAPACITY);
  const numNights = Math.max(1, Math.ceil(durationHours / DAILY_HOURS));
  const extraBedFee = extraPersons * EXTRA_BED_RATE * numNights;

  const totalPrice = basePrice + overtimeFee + extraBedFee;

  return { basePrice, overtimeHours, overtimeFee, extraBedFee, totalPrice };
}
