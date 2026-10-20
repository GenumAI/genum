// The session rules live in @genum/steps, which apps/web imports too, so the two sides
// cannot disagree about where a session ends. This module keeps the `@/ai/steps/session`
// path every core import site already uses.
export { effectiveSteps, lastEnabledFinal, turnsOf } from "@genum/steps";
