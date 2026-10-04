/**
 * The number of strictly-ordered priority levels a SymbolicWeight
 * spans. Level 0 is reserved for `Strength.required` (see strength.ts);
 * levels 1 through `LEVEL_COUNT - 1` are available to ordinary
 * (non-required) constraint strengths, from strongest (1) to weakest
 * (LEVEL_COUNT - 1).
 * @private
 */
export const LEVEL_COUNT = 8

/**
 * Test whether a plain number is approximately zero.
 * @private
 */
function nearZeroValue(value: number): boolean {
	let eps = 1.0e-8
	return value < 0 ? -value < eps : value < eps
}

/**
 * A symbolic (lexicographic) constraint weight, spread across
 * `LEVEL_COUNT` strictly-ordered priority levels.
 *
 * Unlike a single packed number, a SymbolicWeight guarantees that a
 * weight at a stronger level *always* dominates *any* combination of
 * weights at weaker levels, no matter how large those weaker
 * contributions grow through accumulation (e.g. many low-priority
 * constraints whose error terms end up summed into the same
 * objective cell). Comparison proceeds level by level, starting from
 * the most significant (index 0); the first level at which two
 * weights differ (beyond floating point noise) decides the
 * comparison, and every level after that is irrelevant.
 *
 * Instances are immutable; every arithmetic operation returns a new
 * SymbolicWeight. Construct one via `Strength.create` or
 * `Strength.required` rather than the constructor directly.
 *
 * @class
 * @private
 */
export class SymbolicWeight {
	private constructor(private readonly _levels: readonly number[]) {}

	/**
	 * The zero weight (identity for `plus`/`minus`).
	 */
	static readonly zero = new SymbolicWeight(new Array(LEVEL_COUNT).fill(0))

	/**
	 * A sentinel weight greater than any weight reachable through
	 * normal construction and arithmetic. Used internally as the
	 * initial "nothing found yet" value in ratio-minimization loops.
	 */
	static readonly infinity = new SymbolicWeight(new Array(LEVEL_COUNT).fill(Infinity))

	/**
	 * Construct a weight with `weight` at the given `level` and zero
	 * everywhere else.
	 *
	 * @private
	 */
	static create(level: number, weight: number = 1.0): SymbolicWeight {
		if (!Number.isInteger(level) || level > LEVEL_COUNT - 1) {
			throw new Error(`strength level must be an integer between 1 and ${LEVEL_COUNT - 1}`)
		}

		let levels = new Array(LEVEL_COUNT).fill(0)
		levels[level] = weight

		return new SymbolicWeight(levels)
	}

	/**
	 * Component-wise sum.
	 */
	plus(other: SymbolicWeight): SymbolicWeight {
		return new SymbolicWeight(this._levels.map((v, i) => v + other._levels[i]))
	}

	/**
	 * Component-wise difference.
	 */
	minus(other: SymbolicWeight): SymbolicWeight {
		return new SymbolicWeight(this._levels.map((v, i) => v - other._levels[i]))
	}

	/**
	 * Multiply every level by a plain scalar.
	 */
	multiply(scalar: number): SymbolicWeight {
		return new SymbolicWeight(this._levels.map(v => v * scalar))
	}

	/**
	 * Divide every level by a plain scalar.
	 */
	divide(scalar: number): SymbolicWeight {
		return this.multiply(1.0 / scalar)
	}

	/**
	 * The additive inverse.
	 */
	negate(): SymbolicWeight {
		return this.multiply(-1.0)
	}

	/**
	 * Whether this weight is negative in the lexicographic order: the
	 * first level that isn't approximately zero is itself negative.
	 */
	isNegative(): boolean {
		for (let i = 0; i < LEVEL_COUNT; i++) {
			if (!nearZeroValue(this._levels[i])) {
				return this._levels[i] < 0
			}
		}
		return false
	}

	/**
	 * Whether this weight is approximately zero at every level.
	 */
	nearZero(): boolean {
		for (let i = 0; i < LEVEL_COUNT; i++) {
			if (!nearZeroValue(this._levels[i])) {
				return false
			}
		}
		return true
	}

	/**
	 * Strict lexicographic less-than.
	 */
	lessThan(other: SymbolicWeight): boolean {
		for (let i = 0; i < LEVEL_COUNT; i++) {
			let diff = this._levels[i] - other._levels[i]
			if (!nearZeroValue(diff)) {
				return diff < 0
			}
		}
		return false
	}

	/**
	 * Approximate equality at every level.
	 */
	equals(other: SymbolicWeight): boolean {
		return this.minus(other).nearZero()
	}

	public toString(): string {
		return '[' + this._levels.join(', ') + ']'
	}
}
