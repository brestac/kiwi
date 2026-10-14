// On type le scope global du worker
import { Solver } from './solver.js'
import { SolverCommand } from './solvercommand.js'
import { Constraint } from './constraint.js'
import { SymbolicWeight } from './symbolicweight.js'
import { CommandConsumer, NO_COMMAND } from './commandqueue.js'

const ctx: Worker = self as any
let _solver: Solver
let _commands: CommandConsumer

// updateVariables() est limité à une fois par UPDATE_INTERVAL_MS, avec une mise à jour finale garantie
const UPDATE_INTERVAL_MS = 16
let _needsUpdateVariables = false
let _lastUpdate = -Infinity

function flushVariables(now: number): void {
	_needsUpdateVariables = false
	_lastUpdate = now
	solver().updateVariables()
}

function solver(): Solver {
	return _solver
}

function addConstraintsFromBinary(data: Int32Array, size: number): void {
	let offset = 0

	while (offset < size) {
		const cst_size = (data.at(offset) as number) + 1
		const constraint = Constraint.fromBinary(data.slice(offset, offset + cst_size))
		solver().addConstraint(constraint, false)
		offset += cst_size
	}

	solver().optimize()
}

function removeConstraintsFromBinary(data: Int32Array, size: number): void {
	const ids = data.slice(0, size)

	solver().getConstraints().forEach((constraint: Constraint) => {
		if (ids.includes(constraint.id())) {
			solver().removeConstraint(constraint, false)
		}
	})

	solver().optimize()
}

function addEditVariable(id: number, strength: SymbolicWeight): void {
	const variable = solver().getVariable(id)
	if (variable !== undefined) {
		solver().addEditVariable(variable, strength)
	}
}

function removeEditVariable(id: number): void {
	const variable = solver().getVariable(id)
	if (variable !== undefined) {
		solver().removeEditVariable(variable)
	}
}

function suggestValue(id: number, value: number): void {
	const variable = solver().getVariable(id)
	if (variable !== undefined) {
		solver().suggestValue(variable, value)
	}
}

// Plus aucun appel à waitForNextCommand() ici : la boucle est dans run().
function handleCommand(type: number, data: Int32Array, size: number) {
	switch (type) {
		case SolverCommand.ADD_CONSTRAINTS: {
			addConstraintsFromBinary(data, size)
		}
			break
		case SolverCommand.REMOVE_CONSTRAINTS: {
			removeConstraintsFromBinary(data, size)
		}
			break
		case SolverCommand.UPDATE_CONSTANT: {
			const id = data.at(0) as number
			const constant = data.at(1) as number
			solver()._updateConstantToById(id, constant)
		}
			break
		case SolverCommand.UPDATE_STRENGTH: {
			const id = data.at(0) as number
			const strength = SymbolicWeight.fromBinary(data.slice(1, 2))
			solver()._updateStrengthToById(id, strength)
			break
		}
		case SolverCommand.UPDATE_VARIABLES:
			_needsUpdateVariables = true // exécuté par run(), au plus une fois par UPDATE_INTERVAL_MS
			break
		case SolverCommand.ADD_EDIT_VARIABLE: {
			const id = data.at(0) as number
			const strength = SymbolicWeight.fromBinary(data.slice(1, size))
			addEditVariable(id, strength)
		}
			break
		case SolverCommand.REMOVE_EDIT_VARIABLE: {
			const id = data.at(0) as number
			removeEditVariable(id)
		}
			break
		case SolverCommand.SUGGEST_VALUE: {
			const id = data.at(0) as number
			const value = data.at(1) as number
			suggestValue(id, value)
		}
			break
		case SolverCommand.TIME: {
			const time = performance.timeOrigin + performance.now()
			ctx.postMessage({ type: SolverCommand.TIME, data: time })
		}
			break
		default:
			break
	}
}

// Boucle bloquante : Atomics.wait est autorisé dans un worker.
function run() {
	while (true) {
		let type: number
		if (_needsUpdateVariables) {
			const now = performance.now()
			if (now >= _lastUpdate + UPDATE_INTERVAL_MS) flushVariables(now) // échéance atteinte (ou worker inactif : latence minimale)
		}
		if (_needsUpdateVariables) {
			// Mise à jour en attente : on ne dort pas plus longtemps que la prochaine échéance.
			type = _commands.next(Math.max(0, _lastUpdate + UPDATE_INTERVAL_MS - performance.now()))
			if (type === NO_COMMAND) continue // l'échéance est passée : le haut de la boucle fait la mise à jour
		} else {
			type = _commands.next()
		}
		handleCommand(type, _commands.payload, _commands.size)
	}
}

ctx.onmessage = (e: MessageEvent<any>) => {
	const { type, data } = e.data

	if (type !== SolverCommand.INIT) return

	_solver = new Solver(data.output) // Int32Array de sortie, inchangé
	_commands = new CommandConsumer(data.input) // SharedArrayBuffer de la file de commandes

	// À poster AVANT run(), car run() ne rend jamais la main.
	ctx.postMessage({ type: SolverCommand.AKNOWLEDGE, data: type })

	run()
}

export default ctx
