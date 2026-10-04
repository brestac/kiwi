/*global describe, it*/
var assert = typeof window === 'undefined' ? (await import('assert')).default : window.chai.assert

describe('import kiwi', function () {
	it('imports kiwi', async function () {
		// const kiwi = await import('@lume/kiwi') // self-referencing import does not work due to https://github.com/nodejs/node/issues/50334
		const kiwi = await import('../dist/kiwi.js')

		describe('kiwi', function () {
			it('create Solver', function () {
				var solver = new kiwi.Solver()
				assert(solver)
			})
		})

		describe('Variable', function () {
			var solver = new kiwi.Solver()
			var variable
			it('new Variable() => value: 0', function () {
				variable = new kiwi.Variable()
				assert(variable)
				assert.equal(0, variable.value())
			})
			it('new Variable("somename") => name: "somename"', function () {
				var var2 = new kiwi.Variable('somename')
				assert.equal(var2.name(), 'somename')
			})
			it('variable.setName("skiwi") => name: "skiwi"', function () {
				var var2 = new kiwi.Variable()
				var2.setName('skiwi')
				assert.equal(var2.name(), 'skiwi')
			})
			it('solver.addEditVariable(variable, Strength.strong) => solver.hasEditVariable(): true', function () {
				solver.addEditVariable(variable, kiwi.Strength.strong)
				assert(solver.hasEditVariable(variable))
			})
			it('solver.suggestValue(variable, 200) => value: 200', function () {
				solver.suggestValue(variable, 200)
				solver.updateVariables()
				assert.equal(200, variable.value())
			})
			it('variable.subscribe(callback) => value: 400', function () {
				var var2 = new kiwi.Variable()
				var val, previousVal
				var2.subscribe((value, previousValue) => ((val = value), (previousVal = previousValue)))
				assert.equal(val, undefined)
				assert.equal(previousVal, undefined)
				solver.addEditVariable(var2, kiwi.Strength.strong)
				solver.suggestValue(var2, 400)
				solver.updateVariables()
				assert.equal(val, 400)
				assert.equal(previousVal, 0)
				solver.suggestValue(var2, 500)
				solver.updateVariables()
				assert.equal(val, 500)
				assert.equal(previousVal, 400)
			})
			it('variable.unsubscribe()', function () {
				var var2 = new kiwi.Variable()
				var val, previousVal
				var2.subscribe((value, previousValue) => ((val = value), (previousVal = previousValue)))
				solver.addEditVariable(var2, kiwi.Strength.strong)
				solver.suggestValue(var2, 300)
				var2.unsubscribe()
				solver.updateVariables()
				assert.equal(val, undefined)
				assert.equal(previousVal, undefined)
			})
			it('solver.removeEditVariable(variable) => solver.hasEditVariable(): false', function () {
				assert(solver.hasEditVariable(variable))
				solver.removeEditVariable(variable)
				assert(!solver.hasEditVariable(variable))
			})
			it('solver.addEditVariable(variable) => throw exception: "duplicate edit variable"', function () {
				assert(!solver.hasEditVariable(variable))
				solver.addEditVariable(variable, kiwi.Strength.strong)
				assert(solver.hasEditVariable(variable))
				try {
					solver.addEditVariable(variable, kiwi.Strength.strong)
					assert(false)
				} catch (err) {
					assert.equal(err.message, 'duplicate edit variable')
				}
			})
			it('solver.addEditVariable(variable) => throw exception: "unknown edit variable"', function () {
				assert(solver.hasEditVariable(variable))
				solver.removeEditVariable(variable)
				assert(!solver.hasEditVariable(variable))
				try {
					solver.removeEditVariable(variable)
					assert(false)
				} catch (err) {
					assert.equal(err.message, 'unknown edit variable')
				}
			})
		})

		describe('Expression', function () {
			it('new Expression()', function () {
				assert(new kiwi.Expression())
			})
			it('new Expression(variable)', function () {
				assert(new kiwi.Expression(new kiwi.Variable()))
			})
			it('new Expression([-1, new Variable()])', function () {
				assert(new kiwi.Expression([-1, new kiwi.Variable()]))
			})
			it('new Expression([variable, -1]) => throw exception: "array item 0 must be a number"', function () {
				try {
					new kiwi.Expression([new kiwi.Variable(), -1])
					assert(false)
				} catch (err) {
					assert.equal(err.message, 'array item 0 must be a number')
				}
			})
			it('new Expression([-1, 100]) => throw exception: "array item 1 must be a variable or expression"', function () {
				try {
					new kiwi.Expression([-1, 100])
					assert(false)
				} catch (err) {
					assert.equal(err.message, 'array item 1 must be a variable or expression')
				}
			})
			it('new Expression(10, 20, 30, 40) => constant: 100', function () {
				assert.equal(new kiwi.Expression(10, 20, 30, 40).constant(), 100)
			})
			it('new Expression([-1, new Expression(10)]) => constant: -10', function () {
				assert.equal(new kiwi.Expression([-1, new kiwi.Expression(10)]).constant(), -10)
			})
			it('new Expression(new Expression(10), new Expression(20)) => constant: 30', function () {
				assert.equal(new kiwi.Expression(new kiwi.Expression(10), new kiwi.Expression(20)).constant(), 30)
			})
			it('new Expression(20, [0.5, new Expression(10), -10]) => constant: 15', function () {
				assert.equal(new kiwi.Expression(20, [0.5, new kiwi.Expression(10)], -10).constant(), 15)
			})
		})

		describe('Constraint', function () {
			var solver = new kiwi.Solver()
			var vars = {}
			it('new Constraint(expr, ...) == constraint.expression()', function () {
				var expr = new kiwi.Expression(10)
				var cn = new kiwi.Constraint(expr, kiwi.Operator.Eq)
				assert.equal(cn.expression(), expr)
			})
			it('new Constraint(..., Operator.Ge, ...) == constraint.op()', function () {
				var cn = new kiwi.Constraint(new kiwi.Expression(10), kiwi.Operator.Ge)
				assert.equal(cn.op(), kiwi.Operator.Ge)
			})
			it('new Constraint(..., ..., ..., Strength.medium) == constraint.strength()', function () {
				var cn = new kiwi.Constraint(new kiwi.Expression(10), kiwi.Operator.Le, undefined, kiwi.Strength.medium)
				assert.equal(cn.strength(), kiwi.Strength.medium)
			})
			it('Optional strength => constraint.strength(): Strength.required', function () {
				var cn = new kiwi.Constraint(new kiwi.Expression(1), kiwi.Operator.Eq)
				assert.equal(cn.strength(), kiwi.Strength.required)
			})
			it('solver.addConstraint() => solver.hasConstraint(): true', function () {
				var cn = new kiwi.Constraint(new kiwi.Expression(1, -1), kiwi.Operator.Eq)
				assert(!solver.hasConstraint(cn))
				solver.addConstraint(cn)
				assert(solver.hasConstraint(cn))
			})
			it('solver.removeConstraint() => solver.hasConstraint(): false', function () {
				var cn = new kiwi.Constraint(new kiwi.Expression(1, -1), kiwi.Operator.Eq)
				assert(!solver.hasConstraint(cn))
				solver.addConstraint(cn)
				assert(solver.hasConstraint(cn))
				solver.removeConstraint(cn)
				assert(!solver.hasConstraint(cn))
			})
			it('solver.addConstraint() 2x => throw exception: "duplicate constraint"', function () {
				var cn = new kiwi.Constraint(new kiwi.Expression(1, -1), kiwi.Operator.Eq)
				solver.addConstraint(cn)
				try {
					solver.addConstraint(cn)
					assert(false)
				} catch (err) {
					assert.equal(err.message, 'duplicate constraint')
				}
			})
			it('solver.addConstraint() 2x => throw exception: "unsatisfiable constraint"', function () {
				// a constraint consisting of all numbers which are not 0
				var cn = new kiwi.Constraint(new kiwi.Expression(1, -1, 10), kiwi.Operator.Eq)
				try {
					solver.addConstraint(cn)
					assert(false)
				} catch (err) {
					assert.equal(err.message, 'unsatisfiable constraint')
				}
			})
			it('solver.addConstraint() 2x => throw exception: "unsatisfiable constraint"', function () {
				solver = new kiwi.Solver()
				var width = new kiwi.Variable()
				var width2 = new kiwi.Variable()
				var cn = new kiwi.Constraint(new kiwi.Expression(width, 100), kiwi.Operator.Eq)
				solver.addConstraint(cn)
				cn = new kiwi.Constraint(new kiwi.Expression(width2, 100), kiwi.Operator.Eq)
				solver.addConstraint(cn)
				try {
					cn = new kiwi.Constraint(new kiwi.Expression(width, width2), kiwi.Operator.Eq)
					solver.addConstraint(cn)
					assert(false)
				} catch (err) {
					assert.equal(err.message, 'unsatisfiable constraint')
				}
			})
			it('solver.addConstraint() => solver.getConstraints()', function () {
				solver = new kiwi.Solver()
				var width = new kiwi.Variable()
				var width2 = new kiwi.Variable()
				var cn_1 = new kiwi.Constraint(new kiwi.Expression(width, 100), kiwi.Operator.Eq)
				solver.addConstraint(cn_1)
				var cn_2 = new kiwi.Constraint(new kiwi.Expression(width2, 100), kiwi.Operator.Eq)
				solver.addConstraint(cn_2)
				var cns = solver.getConstraints()
				assert(cns.indexOf(cn_1) > -1)
				assert(cns.indexOf(cn_2) > -1)
			})
			it('solver.removeConstraint() => solver.getConstraints()', function () {
				solver = new kiwi.Solver()
				var width = new kiwi.Variable()
				var width2 = new kiwi.Variable()
				var cn_1 = new kiwi.Constraint(new kiwi.Expression(width, 100), kiwi.Operator.Eq)
				solver.addConstraint(cn_1)
				var cn_2 = new kiwi.Constraint(new kiwi.Expression(width2, 100), kiwi.Operator.Eq)
				solver.addConstraint(cn_2)
				solver.removeConstraint(cn_1)
				var cns = solver.getConstraints()
				assert(cns.indexOf(cn_1) === -1)
				assert(cns.indexOf(cn_2) > -1)
			})
		})

		describe('Constraint raw syntax: (expr, operator, undefined, strength)', function () {
			var solver = new kiwi.Solver()
			var vars = {}
			it('Constant left constraint (10)', function () {
				vars.left = new kiwi.Variable()
				var left = new kiwi.Constraint(new kiwi.Expression([-1, vars.left], 10), kiwi.Operator.Eq)
				solver.addConstraint(left)
				solver.updateVariables()
				assert.equal(vars.left.value(), 10)
			})
			it('Width edit variable (200)', function () {
				vars.width = new kiwi.Variable()
				solver.addEditVariable(vars.width, kiwi.Strength.strong)
				solver.suggestValue(vars.width, 200)
				solver.updateVariables()
				assert.equal(vars.width.value(), 200)
			})
			it('Right === left + width (210)', function () {
				vars.right = new kiwi.Variable()
				var right = new kiwi.Constraint(new kiwi.Expression([-1, vars.right], vars.left, vars.width), kiwi.Operator
					.Eq)
				solver.addConstraint(right)
				solver.updateVariables()
				assert.equal(vars.right.value(), 210)
			})
			it('centerX === left + (width / 2) (110)', function () {
				vars.centerX = new kiwi.Variable()
				var centerX = new kiwi.Constraint(
					new kiwi.Expression([-1, vars.centerX], vars.left, [0.5, vars.width]),
					kiwi.Operator.Eq,
				)
				solver.addConstraint(centerX)
				solver.updateVariables()
				assert.equal(vars.centerX.value(), 110)
			})
		})

		describe('Constraint new syntax: (lhs, operator, rhs, strength)', function () {
			var solver = new kiwi.Solver()
			var left = new kiwi.Variable()
			var width = new kiwi.Variable()
			var top = new kiwi.Variable()
			var height = new kiwi.Variable()
			var right = new kiwi.Variable()
			var bottom = new kiwi.Variable()
			var centerX = new kiwi.Variable()
			var leftOfCenterX = new kiwi.Variable()
			solver.addEditVariable(left, kiwi.Strength.strong)
			solver.addEditVariable(width, kiwi.Strength.strong)
			solver.addEditVariable(top, kiwi.Strength.strong)
			solver.addEditVariable(height, kiwi.Strength.strong)
			solver.suggestValue(left, 0)
			solver.suggestValue(width, 500)
			solver.suggestValue(top, 0)
			solver.suggestValue(height, 300)
			it('right == left.plus(width) => 500', function () {
				solver.addConstraint(new kiwi.Constraint(right, kiwi.Operator.Eq, left.plus(width)))
				solver.updateVariables()
				assert.equal(right.value(), 500)
			})
			it('centerX == left.plus(width.divide(2)) => 250', function () {
				solver.addConstraint(new kiwi.Constraint(centerX, kiwi.Operator.Eq, left.plus(width.divide(2))))
				solver.updateVariables()
				assert.equal(centerX.value(), 250)
			})
			it('leftOfCenterX == left.plus(width.divide(2)).minus(10) => 240', function () {
				solver.addConstraint(new kiwi.Constraint(leftOfCenterX, kiwi.Operator.Eq, left.plus(width.divide(2)).minus(
					10)))
				solver.updateVariables()
				assert.equal(leftOfCenterX.value(), 240)
			})
			it('createConstraint(bottom, Operator.Eq, top.plus(height)) => 300', function () {
				solver.createConstraint(bottom, kiwi.Operator.Eq, top.plus(height))
				solver.updateVariables()
				assert.equal(bottom.value(), 300)
			})
		})

		describe('Update Constraint constant', function () {
			it('left == 10 >> left == 20 >> left == 10', function () {
				var solver = new kiwi.Solver()
				var left = new kiwi.Variable()
				let constraint = new kiwi.Constraint(left, kiwi.Operator.Eq, 10)
				solver.addConstraint(constraint)

				solver.updateVariables()
				assert.equal(left.value(), 10)

				solver.updateConstantTo(constraint, 20)
				solver.updateVariables()
				assert.equal(left.value(), 20)

				solver.updateConstantTo(constraint, 10)
				solver.updateVariables()
				assert.equal(left.value(), 10)
			})

			it('left >= 10 >> left => 20 >> left => 10', function () {
				var solver = new kiwi.Solver()
				var left = new kiwi.Variable()
				let constraintEq = new kiwi.Constraint(left, kiwi.Operator.Eq, 0, kiwi.Strength.strong)
				let constraintGe = new kiwi.Constraint(left, kiwi.Operator.Ge, 10, kiwi.Strength.required)
				solver.addConstraint(constraintEq)
				solver.addConstraint(constraintGe)

				solver.updateVariables()
				assert.equal(left.value(), 10)

				solver.updateConstantTo(constraintGe, 20)
				solver.updateVariables()
				assert.equal(left.value(), 20)

				solver.updateConstantTo(constraintGe, 10)
				solver.updateVariables()
				assert.equal(left.value(), 10)
			})

			it('left <= 20 >> left <= 30 >> left <= 20', function () {
				var solver = new kiwi.Solver()
				var left = new kiwi.Variable()
				let constraintEq = new kiwi.Constraint(left, kiwi.Operator.Eq, 50, kiwi.Strength.strong)
				let constraintLe = new kiwi.Constraint(left, kiwi.Operator.Le, 20, kiwi.Strength.required)
				solver.addConstraint(constraintEq)
				solver.addConstraint(constraintLe)

				solver.updateVariables()
				assert.equal(left.value(), 20)

				solver.updateConstantTo(constraintLe, 30)
				solver.updateVariables()
				assert.equal(left.value(), 30)

				solver.updateConstantTo(constraintLe, 20)
				solver.updateVariables()
				assert.equal(left.value(), 20)
			})

			it('left == 20 && right == left + 10 >> right == left + 20', function () {
				var solver = new kiwi.Solver()
				var left = new kiwi.Variable()
				var right = new kiwi.Variable()
				let constraintLeft = new kiwi.Constraint(left, kiwi.Operator.Eq, 20, kiwi.Strength.strong)
				let constraintRight = new kiwi.Constraint(right, kiwi.Operator.Eq, new kiwi.Expression(left).plus(10), kiwi
					.Strength.required)
				solver.addConstraint(constraintLeft)
				solver.addConstraint(constraintRight)

				solver.updateVariables()
				assert.equal(left.value(), 20)
				assert.equal(right.value(), 30)

				solver.updateConstantTo(constraintRight, 20)
				solver.updateVariables()
				assert.equal(left.value(), 20)
				assert.equal(right.value(), 40)

			})

			it('left == 10 && right == left + 10 >> right == left + 20', function () {
				var solver = new kiwi.Solver()
				var left = new kiwi.Variable()
				var right = new kiwi.Variable()
				let constraintLeft = new kiwi.Constraint(left, kiwi.Operator.Eq, 10, kiwi.Strength.strong)
				let constraintRight = new kiwi.Constraint(right, kiwi.Operator.Eq, new kiwi.Expression(left).plus(10), kiwi
					.Strength.required)
				solver.addConstraint(constraintLeft)
				solver.addConstraint(constraintRight)

				solver.updateVariables()
				assert.equal(left.value(), 10)
				assert.equal(right.value(), 20)

				solver.updateConstantTo(constraintRight, 20)
				solver.updateVariables()
				assert.equal(left.value(), 10)
				assert.equal(right.value(), 30)
			})

			it('right == 30 && left == right - 10 >> left == right - 20', function () {
				var solver = new kiwi.Solver()
				var left = new kiwi.Variable()
				var right = new kiwi.Variable()
				let constraintRight = new kiwi.Constraint(right, kiwi.Operator.Eq, 30, kiwi.Strength.strong)
				let constraintLeft = new kiwi.Constraint(left, kiwi.Operator.Eq, new kiwi.Expression(right).minus(10), kiwi
					.Strength.required)
				solver.addConstraint(constraintLeft)
				solver.addConstraint(constraintRight)

				solver.updateVariables()
				assert.equal(right.value(), 30)
				assert.equal(left.value(), 20)

				solver.updateConstantTo(constraintLeft, -20)
				solver.updateVariables()
				assert.equal(right.value(), 30)
				assert.equal(left.value(), 10)

			})

			it('marker itself basic: left >= 10 && left >= 20 (required, redundant bound)', function () {
				// Adding `left >= 20` after `left >= 10` forces the solver
				// down the artificial-variable path (no External symbol
				// left in the row after substitution), which leaves the
				// FIRST constraint's own marker (its slack) basic in the
				// tableau. Updating that constraint's constant must hit
				// the "marker itself is basic" branch.
				var solver = new kiwi.Solver()
				var left = new kiwi.Variable()
				let constraintGe10 = new kiwi.Constraint(left, kiwi.Operator.Ge, 10, kiwi.Strength.required)
				let constraintGe20 = new kiwi.Constraint(left, kiwi.Operator.Ge, 20, kiwi.Strength.required)
				solver.addConstraint(constraintGe10)
				solver.addConstraint(constraintGe20)

				solver.updateVariables()
				assert.equal(left.value(), 20)

				solver.updateConstantTo(constraintGe10, 25)
				solver.updateVariables()
				assert.equal(left.value(), 25)

				solver.updateConstantTo(constraintGe10, 10)
				solver.updateVariables()
				assert.equal(left.value(), 20)
			})

			it('other (paired error) basic: weak left == 10 && required left <= 5', function () {
				// A weak equality whose target lies above a required
				// upper bound is forced below its target, so its
				// negative-deviation error variable ("other") ends up
				// basic while its own marker stays non-basic. Updating
				// the weak constraint's constant must hit the "other is
				// basic" branch, and must NOT move `left` while the
				// required bound still dominates.
				var solver = new kiwi.Solver()
				var left = new kiwi.Variable()
				let constraintWeak = new kiwi.Constraint(left, kiwi.Operator.Eq, 10, kiwi.Strength.weak)
				let constraintLe = new kiwi.Constraint(left, kiwi.Operator.Le, 5, kiwi.Strength.required)
				solver.addConstraint(constraintWeak)
				solver.addConstraint(constraintLe)

				solver.updateVariables()
				assert.equal(left.value(), 5)

				solver.updateConstantTo(constraintWeak, 20)
				solver.updateVariables()
				assert.equal(left.value(), 5)

				// Relaxing the required bound lets the weak target win.
				solver.updateConstantTo(constraintLe, 25)
				solver.updateVariables()
				assert.equal(left.value(), 20)
			})
		})

		describe('Symbolic strength ordering (lexicographic, not packed-decimal)', function () {
			it('1001 weak constraints never outweigh a single medium constraint', function () {
				// Regression test for the previous packed-number Strength
				// encoding, under which enough accumulated weak-level
				// contributions could carry over into the medium digit
				// place and incorrectly outrank a single medium constraint.
				var solver = new kiwi.Solver()
				var x = new kiwi.Variable()

				solver.addConstraint(new kiwi.Constraint(x, kiwi.Operator.Eq, 100, kiwi.Strength.medium))
				for (var i = 0; i < 1001; i++) {
					solver.addConstraint(new kiwi.Constraint(x, kiwi.Operator.Eq, 0, kiwi.Strength.weak))
				}

				solver.updateVariables()
				assert.equal(x.value(), 100)
			})

			it('a single strong constraint always outweighs any number of medium ones', function () {
				var solver = new kiwi.Solver()
				var x = new kiwi.Variable()

				solver.addConstraint(new kiwi.Constraint(x, kiwi.Operator.Eq, 100, kiwi.Strength.strong))
				for (var i = 0; i < 1001; i++) {
					solver.addConstraint(new kiwi.Constraint(x, kiwi.Operator.Eq, 0, kiwi.Strength.medium))
				}

				solver.updateVariables()
				assert.equal(x.value(), 100)
			})

			it('weight combines additively within a level without crossing into another', function () {
				var solver = new kiwi.Solver()
				var x = new kiwi.Variable()

				// A single level-6 constraint with a large weight still
				// never outweighs a single level-5 (stronger) constraint.
				solver.addConstraint(new kiwi.Constraint(x, kiwi.Operator.Eq, 100, kiwi.Strength.create(5, 0, 0)))
				solver.addConstraint(new kiwi.Constraint(x, kiwi.Operator.Eq, 0, kiwi.Strength.create(6, 1000000, 0)))

				solver.updateVariables()
				assert.equal(x.value(), 100)
			})
		})

		describe('toJSON', function () {
			it('constraint', function () {
				var x = new kiwi.Variable("left")
				x.setValue(100)
				x.setContext({ owner: "truc" })

				var constraint1 = new kiwi.Constraint(x, kiwi.Operator.Eq, 100, kiwi.Strength.medium)
				var json_constraint = constraint1.toJSON()
				var constraint2 = kiwi.Constraint.fromJSON(json_constraint)
				assert.equal(constraint1.toString(), constraint2.toString())
			})
		})

		describe('toBinary', function () {
			it('variable', function () {
				var x = new kiwi.Variable()
				x.setValue(100)

				var encoded = x.toBinary()
				var decoded = kiwi.Variable.fromBinary(encoded)
				assert.equal(x.toString(), decoded.toString())
			})

			it('expression', function () {
				var x = new kiwi.Variable()
				x.setValue(100)

				var exp = new kiwi.Expression(x, 100)
				var encoded = exp.toBinary()
				var decoded = kiwi.Expression.fromBinary(encoded)

				assert.equal(exp.toString(), decoded.toString())

				var exp2 = new kiwi.Expression(x, 100, exp)
				var encoded2 = exp2.toBinary()
				var decoded2 = kiwi.Expression.fromBinary(encoded2)

				assert.equal(exp2.toString(), decoded2.toString())

			})

			it('constraint', function () {
				var x = new kiwi.Variable()
				x.setValue(100)

				var constraint = new kiwi.Constraint(x, kiwi.Operator.Eq, 100, kiwi.Strength.medium)
				var encoded = constraint.toBinary()
				var decoded = kiwi.Constraint.fromBinary(encoded)
				assert.equal(constraint.toString(), decoded.toString())
			})

			it('constraints', function () {
				var x = new kiwi.Variable()
				x.setValue(100)

				var y = new kiwi.Variable()
				y.setValue(50)

				var constraint1 = new kiwi.Constraint(x, kiwi.Operator.Eq, 100, kiwi.Strength.medium)
				var constraint2 = new kiwi.Constraint(y, kiwi.Operator.Le, 50, kiwi.Strength.strong)
				var constraints = [constraint1, constraint2]

				var encoded_array = constraints.reduce((prev, curr) => {
					return [...prev, ...(curr.toBinary())]
				}, [])
				var encoded = new Int32Array(encoded_array)

				let decoded = []
				let offset = 0
				while (offset < encoded.length) {
					const size = encoded.at(offset)
					const constraint = kiwi.Constraint.fromBinary(encoded.slice(offset, offset + size))
					decoded.push(constraint)
					offset += size
				}

				let desc1 = constraints.map(cst => cst.toString()).join(",")
				let desc2 = decoded.map(cst => cst.toString()).join(",")
				assert.equal(desc1, desc2)
			})

		})

		describe('Worker', function () {

			it('addConstraints', function () {
				const worker = new kiwi.Solver.worker()
				const x = new kiwi.Variable("x")
				x.subscribe((value, prev) => {
					assert.equal(value, 100)
				})

				const constraint = new kiwi.Constraint(x, kiwi.Operator.Eq, 100, kiwi.Strength.medium)
				worker.addConstraints([constraint])
			})

			it('addConstraints => updateConstraint', function (done) {
				const worker = new kiwi.SolverInterface()

				const x = new kiwi.Variable("x")
				const constants = [100, 50]
				let i = 0;

				x.subscribe((value, prev) => {
					const expected = constants.at(i++)

					if (value === expected) {
						done()
					} else {
						done(new Error(`expected value == ${expected}, was ${value}`))
					}
				})

				const constraint = new kiwi.Constraint(x, kiwi.Operator.Eq, 100, kiwi.Strength.medium)
				wait(50).then(_ => {
						worker.addConstraints([constraint])
					}).then(_ => wait(50))
					.then(_ => {
						worker.updateConstantTo(constraint, 50)
					})
			})

			it('addConstraints => updateConstraint failing', function (done) {
				const worker = new kiwi.SolverInterface()

				const x = new kiwi.Variable("x")
				const constants = [100, 50]
				let i = 0;

				x.subscribe((value, prev) => {
					const expected = constants.at(i++)

					if (value === expected) {
						done()
					} else {
						done(new Error(`expected value == ${expected}, was ${value}`))
					}
				})

				const constraint = new kiwi.Constraint(x, kiwi.Operator.Eq, 100, kiwi.Strength.medium)
				worker.addConstraints([constraint])
				worker.updateConstantTo(constraint, 50)
			})
		})
	})
})

function wait(delay) {
	return new Promise((res, rej) => {
		window.setTimeout(res, delay, true)
	})
}
