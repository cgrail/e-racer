// Car models, electric motor curve, livery colours.
export const CARSPEC = {
  volt: { name: 'VOLT GT', short: 'VOLT', top: 0.92, acc: 1.0, grip: 1.0, kw: 300 },
  spark: { name: 'SPARK ROADSTER', short: 'SPARK', top: 0.86, acc: 1.2, grip: 1.2, kw: 250 },
  ion: { name: 'ION CONCEPT', short: 'ION', top: 0.98, acc: 0.9, grip: 0.84, kw: 360 },
};
export const MODELS = ['volt', 'spark', 'ion'];
// Single-speed motor: full torque up to MOTOR_BASE of top speed, constant power above it.
export const MOTOR_ACC = 1.7, MOTOR_BASE = 0.35, REGEN_MAX = 0.6; // regen braking: share of rated kW
export const CAR_COLORS = ['#d81e1e', '#1e5ad8', '#f0d020', '#f2f2f2', '#22a040', '#26262a', '#a8b0b8', '#f07818', '#8a2be2', '#20c0d0'];
export const SUPER_T = 3; // seconds of super power per power-up charge
export const SHOCK_T = 3, SHOCK_CAP = 0.75; // electro shock: seconds held to this share of top speed
export const NO_INPUT = { throttle: 0, brake: 0, steer: 0, analog: false, power: false, shock: false };
