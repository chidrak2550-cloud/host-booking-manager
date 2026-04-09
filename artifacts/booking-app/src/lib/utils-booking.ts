import { format, differenceInHours } from "date-fns";

export function formatThaiDateTime(isoString: string | Date): string {
  const date = typeof isoString === "string" ? new Date(isoString) : isoString;
  return new Intl.DateTimeFormat("th-TH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Bangkok"
  }).format(date);
}

export function formatThaiDate(isoString: string | Date): string {
  const date = typeof isoString === "string" ? new Date(isoString) : isoString;
  return new Intl.DateTimeFormat("th-TH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "Asia/Bangkok"
  }).format(date);
}

export function formatThaiCurrency(amount: number): string {
  return new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
}

// Logic matches backend pricing
export function calculatePricing(
  checkInAt: string | Date,
  checkOutAt: string | Date,
  packageType: "daily" | "short_stay"
) {
  const checkIn = new Date(checkInAt);
  const checkOut = new Date(checkOutAt);
  
  if (checkOut <= checkIn) {
    return {
      basePrice: packageType === "daily" ? 600 : 300,
      overtimeHours: 0,
      overtimeFee: 0,
      totalPrice: packageType === "daily" ? 600 : 300,
    };
  }

  const basePrice = packageType === "daily" ? 600 : 300;
  const packageHours = packageType === "daily" ? 24 : 3;
  const overtimeRate = 100; // THB per hour

  // Total duration in hours
  // differenceInHours drops fractional hours, but typically we charge per commenced hour
  // Here we will use math.ceil for commenced hour beyond package
  const durationMs = checkOut.getTime() - checkIn.getTime();
  const durationHours = Math.ceil(durationMs / (1000 * 60 * 60));

  let overtimeHours = Math.max(0, durationHours - packageHours);
  const overtimeFee = overtimeHours * overtimeRate;
  const totalPrice = basePrice + overtimeFee;

  return {
    basePrice,
    overtimeHours,
    overtimeFee,
    totalPrice
  };
}
