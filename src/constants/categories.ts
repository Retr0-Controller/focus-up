/** The nine fixed umbrellas. Ids match the seeded rows in the `categories` table. */
export const UMBRELLAS = [
  { id: 1, name: 'Home & Bills', emoji: '🏠' },
  { id: 2, name: 'Food', emoji: '🍽️' },
  { id: 3, name: 'Transportation', emoji: '🚗' },
  { id: 4, name: 'Shopping', emoji: '🛍️' },
  { id: 5, name: 'Health', emoji: '🩺' },
  { id: 6, name: 'Entertainment', emoji: '🎬' },
  { id: 7, name: 'Education', emoji: '📚' },
  { id: 8, name: 'Savings & Debt', emoji: '🐷' },
  { id: 9, name: 'Other', emoji: '✨' },
] as const;

export type Umbrella = (typeof UMBRELLAS)[number];

/** Common spending types shown during onboarding. The user decides where each one belongs. */
export const SPENDING_TYPES = [
  { name: 'Eating out', emoji: '🍔' },
  { name: 'Coffee', emoji: '☕' },
  { name: 'Concert tickets', emoji: '🎟️' },
  { name: 'Streaming', emoji: '📺' },
  { name: 'Gym', emoji: '💪' },
  { name: 'Video games', emoji: '🎮' },
  { name: 'Rideshare', emoji: '🚕' },
  { name: 'Books', emoji: '📖' },
] as const;
