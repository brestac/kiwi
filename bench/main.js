/*global module:false*/
/*eslint strict:false, quotes: [2, "single"] */

import {Bench} from 'tinybench'

var assert = typeof window === 'undefined' ? (await import('assert')).default : window.chai.assert
var c = typeof window === 'undefined' ? (await import('cassowary')).default : window.c // cassowary

main().catch(function (error) {
	console.error(error)
	if (typeof process !== 'undefined') process.exitCode = 1
})
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
		assert.equal(subView1.width.value(), 150)
		assert.equal(subView2.left.value(), 150)

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
		var solver = kiwi.Solver.create({worker: true, refreshRate:60})
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
	function solveCassowary() {
		var data = cassowaryData
		data.solver.suggestValue(data.superView.width, 100)
		data.solver.suggestValue(data.superView.height, 50)
		data.solver.resolve()
		data.solver.suggestValue(data.superView.width, 200)
		data.solver.suggestValue(data.superView.height, 500)
		data.solver.resolve()
	}

	var kiwiData = createKiwiSolver()
	function solveKiwi() {
		var data = kiwiData
		data.solver.suggestValue(data.superView.width, 100)
		data.solver.suggestValue(data.superView.height, 50)
		data.solver.updateVariables()
		data.solver.suggestValue(data.superView.width, 200)
		data.solver.suggestValue(data.superView.height, 500)
		data.solver.updateVariables()
	}

	var kiwiData2 = _createKiwiSolverNewAPI(true)
	function solveKiwi2() {
		var data = kiwiData2
		data.solver.updateConstantTo(data.widthConstraint, 100)
		data.solver.updateConstantTo(data.heightConstraint, 50)
		data.solver.updateVariables()
		data.solver.updateConstantTo(data.widthConstraint, 200)
		data.solver.updateConstantTo(data.heightConstraint, 500)
		data.solver.updateVariables()
	}

	// Mesures (ms) collectées à chaque exécution du benchmark worker. Même horloge (epoch) des deux côtés :
	// performance.timeOrigin + performance.now().
	var workerSamples = {send: [], worker: []}

	// Une "opération" du benchmark worker : `batch` séquences de commandes envoyées au worker, puis une commande TIME.
	// La promesse se résout quand la réponse TIME sort du worker : tinybench mesure donc de la première commande
	// envoyée à la dernière réponse reçue (premier input -> dernier output).
	function solveKiwiWorker(data, batch) {
		var t0 = performance.timeOrigin + performance.now()
		for (var i = 0; i < batch; i++) {
			data.solver.updateConstantTo(data.widthConstraint, 100)
			data.solver.updateConstantTo(data.heightConstraint, 50)
			data.solver.updateVariables()
			data.solver.updateConstantTo(data.widthConstraint, 200)
			data.solver.updateConstantTo(data.heightConstraint, 500)
			data.solver.updateVariables()
		}
		workerSamples.send.push(performance.timeOrigin + performance.now() - t0) // main thread : boucle d'envoi seule
		return new Promise(function (resolve) {
			data.solver.time(function (tWorker) {
				workerSamples.worker.push(tWorker - t0) // premier envoi -> sortie de la dernière réponse du worker
				resolve()
			})
		})
	}

	function median(values) {
		var sorted = values.slice().sort(function (a, b) {
			return a - b
		})
		return sorted[sorted.length >> 1]
	}

	// Décomposition d'une exécution du benchmark worker (médianes, ramenées à une séquence).
	// total = durée mesurée par tinybench (promesse résolue côté main thread).
	function logWorkerStats(task, batch) {
		if (task.result.state !== 'completed') return
		var send = median(workerSamples.send)
		var worker = median(workerSamples.worker)
		var total = task.result.latency.p50
		var us = function (ms) {
			return ((ms * 1000) / batch).toFixed(2) + ' us/sequence'
		}
		log('  total (first in -> last output received): ' + us(total) + ' (median ' + total.toFixed(3) + ' ms per run)')
		log('  worker side (first in -> last output leaves the worker): ' + us(worker) + ' => ' +
			Math.round((batch * 1000) / worker).toLocaleString('en-US') + ' sequences/sec')
		log('  main thread (send loop only): ' + us(send) + ' (' + Math.round((send / worker) * 100) + '% of the worker-side time)')
		log('  return trip of the last output: ' + (Math.max(0, total - worker) * 1000).toFixed(0) + ' us per run')
	}

	// `ops` : nombre d'opérations élémentaires par exécution de la tâche (ex. 1000 séquences pour le worker),
	// pour que les ops/sec soient comparables avec les autres lignes.
	function formatTask(task, ops) {
		var result = task.result
		if (result.state !== 'completed') return task.name + ' failed: ' + (result.error && result.error.message)
		return (
			task.name +
			' x ' +
			Math.round(result.throughput.mean * ops).toLocaleString('en-US') +
			' ops/sec ±' +
			result.throughput.rme.toFixed(2) +
			'% (' +
			result.latency.samplesCount +
			' runs sampled)'
		)
	}

	// Les tâches peuvent être synchrones ou asynchrones (fonction renvoyant une promesse) : tinybench attend la promesse.
	async function runBench(name, tasks, options) {
		log('----- Running ' + name + ' benchmark...')
		var bench = new Bench(options)
		var opsByName = {}
	for (var i = 0; i < tasks.length; i++) {
		bench.add(tasks[i].name, tasks[i].fn)
		opsByName[tasks[i].name] = tasks[i].ops || 1
	}
		await bench.run()

		var completed = bench.tasks.filter(function (task) {
			return task.result.state === 'completed'
		})
		bench.tasks.forEach(function (task) {
			log(formatTask(task, opsByName[task.name]))
		})
		if (completed.length > 1) {
			completed.sort(function (a, b) {
				return b.result.throughput.mean * opsByName[b.name] - a.result.throughput.mean * opsByName[a.name]
			})
			var fastest = completed[0]
			var slowest = completed[completed.length - 1]
			var ratio =
			Math.round(
				((fastest.result.throughput.mean * opsByName[fastest.name]) /
					(slowest.result.throughput.mean * opsByName[slowest.name])) *
					100,
			) / 100
			log('Fastest is ' + fastest.name + ' (± ' + ratio + 'x faster)')
		}
		return bench
	}

	await runBench('creation', [
		{name: 'Cassowary.js', fn: createCassowarySolver},
		{name: 'kiwi', fn: createKiwiSolver},
		{name: 'kiwi new API', fn: createKiwiSolverNewAPI},
	])

	await runBench('solving', [
		{name: 'Cassowary.js', fn: solveCassowary},
		{name: 'kiwi suggestValue', fn: solveKiwi},
		{name: 'kiwi updateConstantTo', fn: solveKiwi2},
	])

	// Le web worker n'est disponible que dans un navigateur cross-origin isolated (SharedArrayBuffer + Atomics).
	var workerSupported = typeof window !== 'undefined' && globalThis.crossOriginIsolated === true
	if (workerSupported) {
		var workerData = createKiwiSolverWorker()
		// Échauffement : on attend que le worker ait traité la phase de création avant de mesurer.
		await new Promise(function (resolve) {
			workerData.solver.time(function () {
				resolve()
			})
		})
		var WORKER_BATCH = 1000 // séquences par exécution
		var workerBench = await runBench('solving worker', [
			{
				name: 'kiwi worker (' + WORKER_BATCH + ' sequences per run, first in -> last out)',
				ops: WORKER_BATCH, // 1 op = 1 séquence, comme pour les autres lignes
				fn: function () {
					return solveKiwiWorker(workerData, WORKER_BATCH)
				},
			},
		])
		logWorkerStats(workerBench.tasks[0], WORKER_BATCH)
	} else {
		log('----- Skipping web worker benchmark (needs a cross-origin isolated browser page)')
	}
}
