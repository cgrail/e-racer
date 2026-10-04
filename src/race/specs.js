// Car models, electric motor curve, livery colours.
// Faster cars give up grip; the small and tall ones corner and pull away best.
export const CARSPEC = {
  pixel: { name: 'PIXEL HATCH', short: 'PIXEL', top: 0.86, acc: 1.15, grip: 1.18, kw: 150 },
  ridge: { name: 'RIDGE COMPACT SUV', short: 'RIDGE', top: 0.87, acc: 1.1, grip: 1.12, kw: 210 },
  granite: { name: 'GRANITE SUV', short: 'GRANITE', top: 0.89, acc: 1.05, grip: 1.05, kw: 230 },
  beach: { name: 'BEACH VAN', short: 'BEACH', top: 0.88, acc: 0.95, grip: 1.08, kw: 250 },
  aero: { name: 'AERO SPORTBACK', short: 'AERO', top: 0.93, acc: 1.0, grip: 1.0, kw: 280 },
  wave: { name: 'WAVE SEDAN', short: 'WAVE', top: 0.94, acc: 1.05, grip: 0.95, kw: 390 },
  flux: { name: 'FLUX GT', short: 'FLUX', top: 0.97, acc: 1.1, grip: 0.88, kw: 495 },
  blitz: { name: 'BLITZ ROADSTER', short: 'BLITZ', top: 0.99, acc: 1.2, grip: 0.84, kw: 600 },
};
export const MODELS = Object.keys(CARSPEC);
// Single-speed motor: full torque up to MOTOR_BASE of top speed, constant power above it.
export const MOTOR_ACC = 1.7, MOTOR_BASE = 0.35, REGEN_MAX = 0.6; // regen braking: share of rated kW
export const CAR_COLORS = ['#d81e1e', '#1e5ad8', '#f0d020', '#f2f2f2', '#22a040', '#26262a', '#a8b0b8', '#f07818', '#8a2be2', '#20c0d0'];
export const SUPER_T = 3; // seconds of super power per power-up charge
export const SHOCK_T = 3, SHOCK_CAP = 0.75; // electro shock: seconds held to this share of top speed
export const AI_SHOCKS = [0.35, 0.5, 0.65]; // share of rivals that use electro shocks, by difficulty
export const NO_INPUT = { throttle: 0, brake: 0, steer: 0, analog: false, power: false, shock: false };
