// Car models, gearbox tables, livery colours.
export const CARSPEC = {
  volt: { name: 'VOLT GT', short: 'VOLT', top: 0.92, acc: 1.0, grip: 1.0 },
  spark: { name: 'SPARK ROADSTER', short: 'SPARK', top: 0.86, acc: 1.2, grip: 1.2 },
  ion: { name: 'ION CONCEPT', short: 'ION', top: 0.98, acc: 0.9, grip: 0.84 },
};
export const MODELS = ['volt', 'spark', 'ion'];
export const GEAR_TOP = [0.3, 0.48, 0.66, 0.83, 1.0];
export const GEAR_ACC = [1.6, 1.32, 1.1, 0.9, 0.72];
export const CAR_COLORS = ['#d81e1e', '#1e5ad8', '#f0d020', '#f2f2f2', '#22a040', '#26262a', '#a8b0b8', '#f07818', '#8a2be2', '#20c0d0'];
export const SUPER_T = 3; // seconds of super power per power-up charge
export const NO_INPUT = { throttle: 0, brake: 0, steer: 0, analog: false, gearUp: false, gearDown: false, power: false };
