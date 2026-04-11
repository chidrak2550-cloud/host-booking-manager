/**
 * Design tokens synced from the sibling booking-app web artifact.
 * Primary: Terracotta (#B05030) matching HSL(15, 55%, 45%)
 */

const colors = {
  light: {
    text: "#3A2F28",
    tint: "#B05030",

    background: "#FAF8F5",
    foreground: "#3A2F28",

    card: "#FFFFFF",
    cardForeground: "#3A2F28",

    primary: "#B05030",
    primaryForeground: "#FFFFFF",

    secondary: "#EDE8E0",
    secondaryForeground: "#3A2F28",

    muted: "#F3EFE9",
    mutedForeground: "#7A6E67",

    accent: "#EDE8E0",
    accentForeground: "#3A2F28",

    destructive: "#E03030",
    destructiveForeground: "#FFFFFF",

    border: "#EBE5DC",
    input: "#E0D8CE",

    // Status colors
    statusPending: "#D97706",
    statusPendingBg: "#FFFBEB",
    statusPaid: "#059669",
    statusPaidBg: "#ECFDF5",
    statusCheckedOut: "#6B7280",
    statusCheckedOutBg: "#F3F4F6",

    // Booking type colors
    colorDaily: "#059669",
    colorShortStay: "#EA580C",
  },

  radius: 12,
};

export default colors;
