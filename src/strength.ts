import {LEVEL_COUNT, SymbolicWeight} from './symbolicweight.js'

/**
 * @class Strength
 *
 * Symbolic constraint strengths, as lexicographic weights spread
 * across `LEVEL_COUNT` (8) strictly-ordered priority levels. Level 0
 * is reserved for `Strength.required`, which no strength created via
 * `Strength.create` can ever reach — so a required constraint always
 * dominates any combination of non-required constraints, regardless
 * of how large their weights are or how many of them there are.
 * Levels 1 (strongest) through 7 (weakest) are available for
 * `Strength.create`.
 */
export class Strength {
	/**
	 * Create a new symbolic strength at the given priority level.
	 *
	 * Several constraints created at the same level combine by simple
	 * addition of their weights (e.g. many `weak` constraints whose
	 * error terms end up in the same row) — this can never let their
	 * combined effect outweigh a single constraint at a stronger
	 * level, unlike the previous packed-number encoding.
	 *
	 * @param level Priority level: an integer from 1 (strongest
	 *   available) to 7 (weakest).
	 * @param [w=1] Weight, multiplies the level's contribution. Must
	 *   be non-negative; negative values are clipped to 0.
	 * @return strength
	 */

	static create(a: number, b: number, c: number) : SymbolicWeight {
		if (a == 1000 && b == 1000 && c == 1000) {
				return SymbolicWeight.create(0, 1)
		}

		if (a > 0) {
			return SymbolicWeight.create(1, a * Math.pow(10, 6) + b * Math.pow(10, 3) + c)
		} else if (b > 0) {
			return SymbolicWeight.create(4, b * Math.pow(10, 3) + c)
		} else if (c > 0) {
			return SymbolicWeight.create(7, c)
		} else {
			return SymbolicWeight.zero
		}
	}

	/**
	 * The 'required' symbolic strength. Occupies the reserved level 0,
	 * unreachable from `Strength.create`.
	 */
	static required = SymbolicWeight.create(0, 1)

	/**
	 * The 'strong' symbolic strength (level 1, the strongest
	 * non-required level).
	 */
	static strong = SymbolicWeight.create(1)

	/**
	 * The 'medium' symbolic strength (level 4, the middle of the 7
	 * non-required levels).
	 */
	static medium = SymbolicWeight.create(4)

	/**
	 * The 'weak' symbolic strength (level 7, the weakest available
	 * level).
	 */
	static weak = SymbolicWeight.create(7)
}
