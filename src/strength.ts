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
	 * Create a symbolic strength from the classic three components.
	 *
	 * - `a` (strong) is placed on level 1, `b` (medium) on level 4 and `c` (weak) on level 7.
	 * - Only the first non-zero component selects the level: its value is packed with the following ones as
	 *   `a * 10^6 + b * 10^3 + c`, so `create(5)` and `create(6, 1000000)` both land on level 1.
	 * - `create(1000, 1000, 1000)` is `Strength.required`.
	 *
	 * To pick any of the levels 1 to 7 explicitly (and combine weights within a level without ever crossing into
	 * another one), use `SymbolicWeight.create(level, weight)`.
	 *
	 * @param a Strong component.
	 * @param [b=0] Medium component.
	 * @param [c=0] Weak component.
	 * @return strength
	 */

	static create(a: number, b: number = 0, c: number = 0) : SymbolicWeight {
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
