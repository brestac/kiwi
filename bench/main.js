/*global module:false*/
/*eslint strict:false, quotes: [2, "single"] */

var assert = typeof window === 'undefined' ? (await import('assert')).default : window.chai.assert
var _ = typeof window === 'undefined' ? (await import('lodash')).default : window._
var Platform = typeof window === 'undefined' ? (await import('platform')).default : window.Platform
var Benchmark = typeof window === 'undefined' ? (await import('benchmark')).default : window.Benchmark
var c = typeof window === 'undefined' ? (await import('cassowary')).default : window.c // cassowary

main()
async function main() {
	// const kiwi = await import('@lume/kiwi') // self-referencing import does not work due to https://github.com/nodejs/node/issues/50334
	const kiwi = await import('../dist/kiwi.js')

	var logElement
	function log(message) {
		console.log(message)
		if (typeof document !== 'undefined') {
			logElement = logElement || document.getElementById('log')
			logElement.innerHTML += message + '\n'
		}
	}

	function createKiwiSolver() {
		var solver = new kiwi.Solver()
		var strength = kiwi.Strength.create(0, 900, 1000)

		// super-view
		var superView = {
			left: new kiwi.Variable(),
			top: new kiwi.Variable(),
			width: new kiwi.Variable(),
			height: new kiwi.Variable(),
			right: new kiwi.Variable(),
			bottom: new kiwi.Variable(),
		}
		solver.addConstraint(new kiwi.Constraint(new kiwi.Expression(superView.left), kiwi.Operator.Eq))
		solver.addConstraint(new kiwi.Constraint(new kiwi.Expression(superView.top), kiwi.Operator.Eq))
		solver.addConstraint(
			new kiwi.Constraint(
				new kiwi.Expression([-1, superView.right], superView.left, superView.width),
				kiwi.Operator.Eq,
			),
		)
		solver.addConstraint(
			new kiwi.Constraint(
				new kiwi.Expression([-1, superView.bottom], superView.top, superView.height),
				kiwi.Operator.Eq,
			),
		)
		solver.addEditVariable(superView.width, kiwi.Strength.create(999, 1000, 1000))
		solver.addEditVariable(superView.height, kiwi.Strength.create(999, 1000, 1000))
		solver.suggestValue(superView.width, 300)
		solver.suggestValue(superView.height, 200)

		// subView1
		var subView1 = {
			left: new kiwi.Variable(),
			top: new kiwi.Variable(),
			width: new kiwi.Variable(),
			height: new kiwi.Variable(),
			right: new kiwi.Variable(),
			bottom: new kiwi.Variable(),
		}
		solver.addConstraint(
			new kiwi.Constraint(new kiwi.Expression([-1, subView1.right], subView1.left, subView1.width), kiwi.Operator.Eq),
		)
		solver.addConstraint(
			new kiwi.Constraint(new kiwi.Expression([-1, subView1.bottom], subView1.top, subView1.height), kiwi.Operator.Eq),
		)

		// subView2
		var subView2 = {
			left: new kiwi.Variable(),
			top: new kiwi.Variable(),
			width: new kiwi.Variable(),
			height: new kiwi.Variable(),
			right: new kiwi.Variable(),
			bottom: new kiwi.Variable(),
		}
		solver.addConstraint(
			new kiwi.Constraint(new kiwi.Expression([-1, subView2.right], subView2.left, subView2.width), kiwi.Operator.Eq),
		)
		solver.addConstraint(
			new kiwi.Constraint(new kiwi.Expression([-1, subView2.bottom], subView2.top, subView2.height), kiwi.Operator.Eq),
		)

		// Position sub-views in super-view
		solver.addConstraint(
			new kiwi.Constraint(
				new kiwi.Expression([-1, subView1.left], superView.left),
				kiwi.Operator.Eq,
				undefined,
				strength,
			),
		)
		solver.addConstraint(
			new kiwi.Constraint(
				new kiwi.Expression([-1, subView1.top], superView.top),
				kiwi.Operator.Eq,
				undefined,
				strength,
			),
		)
		solver.addConstraint(
			new kiwi.Constraint(
				new kiwi.Expression([-1, subView1.bottom], superView.bottom),
				kiwi.Operator.Eq,
				undefined,
				strength,
			),
		)
		solver.addConstraint(
			new kiwi.Constraint(
				new kiwi.Expression([-1, subView1.width], subView2.width),
				kiwi.Operator.Eq,
				undefined,
				strength,
			),
		)
		solver.addConstraint(
			new kiwi.Constraint(
				new kiwi.Expression([-1, subView1.right], subView2.left),
				kiwi.Operator.Eq,
				undefined,
				strength,
			),
		)
		solver.addConstraint(
			new kiwi.Constraint(
				new kiwi.Expression([-1, subView2.right], superView.right),
				kiwi.Operator.Eq,
				undefined,
				strength,
			),
		)
		solver.addConstraint(
			new kiwi.Constraint(
				new kiwi.Expression([-1, subView2.top], superView.top),
				kiwi.Operator.Eq,
				undefined,
				strength,
			),
		)
		solver.addConstraint(
			new kiwi.Constraint(
				new kiwi.Expression([-1, subView2.bottom], superView.bottom),
				kiwi.Operator.Eq,
				undefined,
				strength,
			),
		)

		// Calculate
		solver.updateVariables()

		// Uncomment to verify results
		//console.log('superView: ' + JSON.stringify(superView, undefined, 2));
		//console.log('subView1: ' + JSON.stringify(subView1, undefined, 2));
		//console.log('subView2: ' + JSON.stringify(subView2, undefined, 2));
		assert.equal(subView1.width.value(), 150)
		assert.equal(subView2.left.value(), 150)

		// Return data
		return {
			solver: solver,
			superView: superView,
			subView1: subView1,
			subView2: subView2,
		}
	}

	function _createKiwiSolverNewAPI(updateConstantTo) {
		var solver = new kiwi.Solver()
		var strength = kiwi.Strength.create(0, 900, 1000)

		// super-view
		var superView = {
			left: new kiwi.Variable(),
			top: new kiwi.Variable(),
			width: new kiwi.Variable(),
			height: new kiwi.Variable(),
			right: new kiwi.Variable(),
			bottom: new kiwi.Variable(),
		}
		solver.createConstraint(superView.left, kiwi.Operator.Eq, 0)
		solver.createConstraint(superView.top, kiwi.Operator.Eq, 0)
		solver.createConstraint(superView.right, kiwi.Operator.Eq, superView.left.plus(superView.width))
		solver.createConstraint(superView.bottom, kiwi.Operator.Eq, superView.top.plus(superView.height))

		let widthConstraint, heightConstraint

		if (updateConstantTo) {
			widthConstraint = new kiwi.Constraint(
				superView.width, kiwi.Operator.Eq, 300
			)
			heightConstraint = new kiwi.Constraint(
				superView.height, kiwi.Operator.Eq, 200
			)
			solver.addConstraint(widthConstraint)
			solver.addConstraint(heightConstraint)
		} else {
			solver.addEditVariable(superView.width, kiwi.Strength.create(999, 1000, 1000))
			solver.addEditVariable(superView.height, kiwi.Strength.create(999, 1000, 1000))
			solver.suggestValue(superView.width, 300)
			solver.suggestValue(superView.height, 200)
		}

		// subView1
		var subView1 = {
			left: new kiwi.Variable(),
			top: new kiwi.Variable(),
			width: new kiwi.Variable(),
			height: new kiwi.Variable(),
			right: new kiwi.Variable(),
			bottom: new kiwi.Variable(),
		}
		solver.createConstraint(subView1.right, kiwi.Operator.Eq, subView1.left.plus(subView1.width))
		solver.createConstraint(subView1.bottom, kiwi.Operator.Eq, subView1.top.plus(subView1.height))

		// subView2
		var subView2 = {
			left: new kiwi.Variable(),
			top: new kiwi.Variable(),
			width: new kiwi.Variable(),
			height: new kiwi.Variable(),
			right: new kiwi.Variable(),
			bottom: new kiwi.Variable(),
		}
		solver.createConstraint(subView2.right, kiwi.Operator.Eq, subView2.left.plus(subView2.width))
		solver.createConstraint(subView2.bottom, kiwi.Operator.Eq, subView2.top.plus(subView2.height))

		// Position sub-views in super-view
		solver.createConstraint(subView1.left, kiwi.Operator.Eq, superView.left, strength)
		solver.createConstraint(subView1.top, kiwi.Operator.Eq, superView.top, strength)
		solver.createConstraint(subView1.bottom, kiwi.Operator.Eq, superView.bottom, strength)
		solver.createConstraint(subView1.width, kiwi.Operator.Eq, subView2.width, strength)
		solver.createConstraint(subView1.right, kiwi.Operator.Eq, subView2.left, strength)
		solver.createConstraint(subView2.right, kiwi.Operator.Eq, superView.right, strength)
		solver.createConstraint(subView2.top, kiwi.Operator.Eq, superView.top, strength)
		solver.createConstraint(subView2.bottom, kiwi.Operator.Eq, superView.bottom, strength)

		// Calculate
		solver.updateVariables()

		// Uncomment to verify results
		// console.log('superView: ' + JSON.stringify(superView, undefined, 2));
		// console.log('subView1: ' + JSON.stringify(subView1, undefined, 2));
		// console.log('subView2: ' + JSON.stringify(subView2, undefined, 2));
		assert.equal(solver.valueOfVariable(subView1.width), 150)
		assert.equal(solver.valueOfVariable(subView2.left), 150)

		// Return data
		return {
			solver: solver,
			superView: superView,
			subView1: subView1,
			subView2: subView2,
			widthConstraint,
			heightConstraint
		}
	}

	function createKiwiSolverNewAPI() {
		return _createKiwiSolverNewAPI(false)
	}

	function createKiwiSolverWorker() {
		var solver = kiwi.Solver.create({worker: true})
		var strength = kiwi.Strength.create(0, 900, 1000)

		// super-view
		var superView = {
			left: new kiwi.Variable(),
			top: new kiwi.Variable(),
			width: new kiwi.Variable(),
			height: new kiwi.Variable(),
			right: new kiwi.Variable(),
			bottom: new kiwi.Variable(),
		}
		solver.createConstraint(superView.left, kiwi.Operator.Eq, 0)
		solver.createConstraint(superView.top, kiwi.Operator.Eq, 0)
		solver.createConstraint(superView.right, kiwi.Operator.Eq, superView.left.plus(superView.width))
		solver.createConstraint(superView.bottom, kiwi.Operator.Eq, superView.top.plus(superView.height))

		const widthConstraint = new kiwi.Constraint(
			superView.width, kiwi.Operator.Eq, 300
		)
		const heightConstraint = new kiwi.Constraint(
			superView.height, kiwi.Operator.Eq, 200
		)
		solver.addConstraint(widthConstraint)
		solver.addConstraint(heightConstraint)

		// subView1
		var subView1 = {
			left: new kiwi.Variable(),
			top: new kiwi.Variable(),
			width: new kiwi.Variable(),
			height: new kiwi.Variable(),
			right: new kiwi.Variable(),
			bottom: new kiwi.Variable(),
		}
		solver.createConstraint(subView1.right, kiwi.Operator.Eq, subView1.left.plus(subView1.width))
		solver.createConstraint(subView1.bottom, kiwi.Operator.Eq, subView1.top.plus(subView1.height))

		// subView2
		var subView2 = {
			left: new kiwi.Variable(),
			top: new kiwi.Variable(),
			width: new kiwi.Variable(),
			height: new kiwi.Variable(),
			right: new kiwi.Variable(),
			bottom: new kiwi.Variable(),
		}
		solver.createConstraint(subView2.right, kiwi.Operator.Eq, subView2.left.plus(subView2.width))
		solver.createConstraint(subView2.bottom, kiwi.Operator.Eq, subView2.top.plus(subView2.height))

		// Position sub-views in super-view
		solver.createConstraint(subView1.left, kiwi.Operator.Eq, superView.left, strength)
		solver.createConstraint(subView1.top, kiwi.Operator.Eq, superView.top, strength)
		solver.createConstraint(subView1.bottom, kiwi.Operator.Eq, superView.bottom, strength)
		solver.createConstraint(subView1.width, kiwi.Operator.Eq, subView2.width, strength)
		solver.createConstraint(subView1.right, kiwi.Operator.Eq, subView2.left, strength)
		solver.createConstraint(subView2.right, kiwi.Operator.Eq, superView.right, strength)
		solver.createConstraint(subView2.top, kiwi.Operator.Eq, superView.top, strength)
		solver.createConstraint(subView2.bottom, kiwi.Operator.Eq, superView.bottom, strength)

		// Calculate
		solver.updateVariables()

		// Uncomment to verify results
		// console.log('superView: ' + JSON.stringify(superView, undefined, 2));
		// console.log('subView1: ' + JSON.stringify(subView1, undefined, 2));
		// console.log('subView2: ' + JSON.stringify(subView2, undefined, 2));
		// assert.equal(solver.valueOfVariable(subView1.width), 150)
		// assert.equal(solver.valueOfVariable(subView2.left), 150)

		// Return data
		return {
			solver: solver,
			superView: superView,
			subView1: subView1,
			subView2: subView2,
			widthConstraint,
			heightConstraint
		}
	}
/*
	function createKiwiSolver4VariablesPerElement() {
		var solver = new kiwi.Solver()

		// super-view
		var superView = {
			left: new kiwi.Variable(),
			top: new kiwi.Variable(),
			width: new kiwi.Variable(),
			height: new kiwi.Variable()
		}
		solver.createConstraint(superView.left, kiwi.Operator.Eq, 0)
		solver.createConstraint(superView.top, kiwi.Operator.Eq, 0)
		const widthConstraint = new kiwi.Constraint(
			superView.width, kiwi.Operator.Eq, 300
		)
		const heightConstraint = new kiwi.Constraint(
			superView.height, kiwi.Operator.Eq, 200
		)
		solver.addConstraint(widthConstraint)
		solver.addConstraint(heightConstraint)

		// subView1
		var subView1 = {
			left: new kiwi.Variable(),
			top: new kiwi.Variable(),
			width: new kiwi.Variable(),
			height: new kiwi.Variable(),
		}
		solver.createConstraint(subView1.left, kiwi.Operator.Eq, 0)
		solver.createConstraint(subView1.top, kiwi.Operator.Eq, 0)
		solver.createConstraint(subView1.width, kiwi.Operator.Eq, superView.width.divide(2))
		solver.createConstraint(subView1.height, kiwi.Operator.Eq, superView.height.divide(2))

		// subView2
		var subView2 = {
			left: new kiwi.Variable(),
			top: new kiwi.Variable(),
			width: new kiwi.Variable(),
			height: new kiwi.Variable()
		}
		solver.createConstraint(subView2.left, kiwi.Operator.Eq, superView.width.divide(2))
		solver.createConstraint(subView2.top, kiwi.Operator.Eq, superView.height.divide(2))
		solver.createConstraint(subView2.width, kiwi.Operator.Eq, superView.width.divide(2))
		solver.createConstraint(subView2.height, kiwi.Operator.Eq, superView.height.divide(2))

		// Calculate
		solver.updateVariables()

		// Uncomment to verify results
		// console.log('superView: ' + JSON.stringify(superView, undefined, 2));
		// console.log('subView1: ' + JSON.stringify(subView1, undefined, 2));
		// console.log('subView2: ' + JSON.stringify(subView2, undefined, 2));
		assert.equal(solver.valueOfVariable(subView1.width), 150)
		assert.equal(solver.valueOfVariable(subView2.left), 150)

		// Return data
		return {
			solver,
			widthConstraint,
			heightConstraint
		}
	}
*/
	function createCassowarySolver() {
		var solver = new c.SimplexSolver()
		var strength = new c.Strength('priority', 0, 900, 1000)

		// super-view
		var superView = {
			left: new c.Variable({value: 0}),
			top: new c.Variable({value: 0}),
			width: new c.Variable(),
			height: new c.Variable(),
			right: new c.Variable(),
			bottom: new c.Variable(),
		}
		solver.addConstraint(new c.StayConstraint(superView.left, c.Strength.required))
		solver.addConstraint(new c.StayConstraint(superView.top, c.Strength.required))
		solver.addConstraint(new c.Equation(superView.right, c.plus(superView.left, superView.width)))
		solver.addConstraint(new c.Equation(superView.bottom, c.plus(superView.top, superView.height)))
		solver.addEditVar(superView.width, new c.Strength('required', 999, 1000, 1000))
		solver.addEditVar(superView.height, new c.Strength('required', 999, 1000, 1000))
		solver.suggestValue(superView.width, 300)
		solver.suggestValue(superView.height, 200)

		// subView1
		var subView1 = {
			left: new c.Variable(),
			top: new c.Variable(),
			width: new c.Variable(),
			height: new c.Variable(),
			right: new c.Variable(),
			bottom: new c.Variable(),
		}
		solver.addConstraint(new c.Equation(subView1.right, c.plus(subView1.left, subView1.width)))
		solver.addConstraint(new c.Equation(subView1.bottom, c.plus(subView1.top, subView1.height)))

		// subView2
		var subView2 = {
			left: new c.Variable(),
			top: new c.Variable(),
			width: new c.Variable(),
			height: new c.Variable(),
			right: new c.Variable(),
			bottom: new c.Variable(),
		}
		solver.addConstraint(new c.Equation(subView2.right, c.plus(subView2.left, subView2.width)))
		solver.addConstraint(new c.Equation(subView2.bottom, c.plus(subView2.top, subView2.height)))

		// Position sub-views in super-view
		solver.addConstraint(new c.Equation(subView1.left, superView.left, strength))
		solver.addConstraint(new c.Equation(subView1.top, superView.top, strength))
		solver.addConstraint(new c.Equation(subView1.bottom, superView.bottom, strength))
		solver.addConstraint(new c.Equation(subView1.right, subView2.left, strength))
		solver.addConstraint(new c.Equation(subView1.width, subView2.width, strength))
		solver.addConstraint(new c.Equation(subView2.right, superView.right, strength))
		solver.addConstraint(new c.Equation(subView2.top, superView.top, strength))
		solver.addConstraint(new c.Equation(subView2.bottom, superView.bottom, strength))

		// Calculate
		solver.resolve()

		// Return data
		return {
			solver: solver,
			superView: superView,
			subView1: subView1,
			subView2: subView2,
		}
		// Uncomment to verify results
		//assert.equal(subView1.width.value, 150);
		//assert.equal(subView2.left.value, 150);
	}

	var cassowaryData = createCassowarySolver()
	function solveCassowary(data) {
		var data = cassowaryData
		data.solver.suggestValue(data.superView.width, 100)
		data.solver.suggestValue(data.superView.height, 50)
		data.solver.resolve()
		data.solver.suggestValue(data.superView.width, 200)
		data.solver.suggestValue(data.superView.height, 500)
		data.solver.resolve()
	}

	var kiwiData = createKiwiSolver()
	function solveKiwi(data) {
		var data = kiwiData
		data.solver.suggestValue(data.superView.width, 100)
		data.solver.suggestValue(data.superView.height, 50)
		data.solver.updateVariables()
		data.solver.suggestValue(data.superView.width, 200)
		data.solver.suggestValue(data.superView.height, 500)
		data.solver.updateVariables()
	}

	var kiwiData2 = _createKiwiSolverNewAPI(true)
	function solveKiwi2(data) {
		var data = kiwiData2
		data.solver.updateConstantTo(data.widthConstraint, 100)
		data.solver.updateConstantTo(data.heightConstraint, 50)
		data.solver.updateVariables()
		data.solver.updateConstantTo(data.widthConstraint, 200)
		data.solver.updateConstantTo(data.heightConstraint, 500)
		data.solver.updateVariables()
	}

	var kiwiData3 = createKiwiSolverWorker()

	// Durées mesurées côté worker (ms) : premier envoi sur le main thread -> sortie de la dernière réponse du worker.
	// Même horloge (epoch) des deux côtés : performance.timeOrigin + performance.now().
	var workerSamples = {}
	var sendSamples = {}
	function makeWorkerBench(name, batch) {
		var samples = (workerSamples[name] = [])
		var sends = (sendSamples[name] = [])
		return function (deferred) {
			var data = kiwiData3
			var t0 = performance.timeOrigin + performance.now()
			for (var i = 0; i < batch; i++) {
				data.solver.updateConstantTo(data.widthConstraint, 100)
				data.solver.updateConstantTo(data.heightConstraint, 50)
				data.solver.updateVariables()
				data.solver.updateConstantTo(data.widthConstraint, 200)
				data.solver.updateConstantTo(data.heightConstraint, 500)
				data.solver.updateVariables()
			}
			sends.push(performance.timeOrigin + performance.now() - t0) // main thread : boucle d'envoi seule
			var done = false
			data.solver.time(function (tWorker) {
				if (done) return // garde-fou : un seul résolve par cycle
				done = true
				samples.push(tWorker - t0)
				deferred.resolve()
			})
		}
	}
	function logWorkerStats(name, batch) {
		var s = workerSamples[name].slice().sort(function (a, b) { return a - b })
		if (!s.length) return
		var median = s[s.length >> 1]
		var sd = sendSamples[name].slice().sort(function (a, b) { return a - b })
		var sendMedian = sd[sd.length >> 1]
		log(name + ' (worker side): median ' + median.toFixed(3) + ' ms per batch, min ' + s[0].toFixed(3) +
			' ms => ' + Math.round((batch * 1000) / median).toLocaleString() + ' sequences/sec')
		log(name + ' (main thread): send loop median ' + sendMedian.toFixed(3) + ' ms per batch (' +
			Math.round((sendMedian / median) * 100) + '% of the worker-side time)')
	}

	function runBench(name, benchmarks, callback) {
		log('----- Running ' + name + ' benchmark...')
		var suite = new Benchmark.Suite()
		for (var i = 0; i < benchmarks.length; i++) {
			suite.add(benchmarks[i].name, {defer: !!benchmarks[i].defer, fn: benchmarks[i].fn})
		}
		suite
			.on('cycle', function (event) {
				log(String(event.target))
			})
			.on('complete', function () {
				var fastest = this.filter('fastest')[0]
				var slowest = this.filter('slowest')[0]
				log('Fastest is ' + fastest.name + ' (± ' + Math.round((fastest.hz / slowest.hz) * 100) / 100 + 'x faster)')
				if (callback) callback()
			})
			.run({async: true})
	}

	await new Promise(function (resolve) { kiwiData3.solver.time(function () { resolve() }) })

	runBench(
		'creation',
		[
			{name: 'Cassowary.js', fn: createCassowarySolver},
			{name: 'kiwi', fn: createKiwiSolver},
			{name: 'kiwi new API', fn: createKiwiSolverNewAPI},
		],
		function () {
			runBench('solving', [
				{name: 'Cassowary.js', fn: solveCassowary},
				{name: 'kiwi suggestValue', fn: solveKiwi},
				{name: 'kiwi updateConstantTo', fn: solveKiwi2},
			], function () {
				runBench('solving worker', [
					{name: 'worker latency (1 sequence, first in -> last out)', defer: true, fn: makeWorkerBench('worker latency', 1)},
					{name: 'worker throughput (1000 sequences, first in -> last out)', defer: true, fn: makeWorkerBench('worker throughput', 1000)},
				], function() {
					logWorkerStats('worker latency', 1)
					logWorkerStats('worker throughput', 1000)
				})
			})
		},
	)
}
