const DAILY_RATE = 600;
const SHORT_STAY_RATE = 300;
const DAILY_DURATION_HOURS = 24;
const SHORT_STAY_DURATION_HOURS = 3;
const OVERTIME_RATE_PER_HOUR = 100;

export function calculatePricing(
  checkInAt: Date,
  checkOutAt: Date,
  packageType: "daily" | "short_stay",
): { basePrice: number; overtimeHours: number; overtimeFee: number; totalPrice: number } {
  const durationMs = checkOutAt.getTime() - checkInAt.getTime();
  const durationHours = durationMs / (1000 * 60 * 60);

  const basePrice = packageType === "daily" ? DAILY_RATE : SHORT_STAY_RATE;
  const includedHours = packageType === "daily" ? DAILY_DURATION_HOURS : SHORT_STAY_DURATION_HOURS;

  const rawOvertime = durationHours - includedHours;
  const overtimeHours = rawOvertime > 0 ? Math.ceil(rawOvertime) : 0;
  const overtimeFee = overtimeHours * OVERTIME_RATE_PER_HOUR;
  const totalPrice = basePrice + overtimeFee;

  return { basePrice, overtimeHours, overtimeFee, totalPrice };
}
