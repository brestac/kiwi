// On type le scope global du worker
import { Solver } from './solver.js'
import { SolverCommand } from './solvercommand.js'
import { Constraint } from './constraint.js'
import { SymbolicWeight } from './symbolicweight.js'
import { CommandConsumer } from './commandqueue.js'

const AUTO_UPDATE = false
const ctx: Worker = self as any
let _solver: Solver
let _commands: CommandConsumer

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

			if (AUTO_UPDATE) {
				solver().updateVariables()
			}
		}
			break
		case SolverCommand.REMOVE_CONSTRAINTS: {
			removeConstraintsFromBinary(data, size)

			if (AUTO_UPDATE) {
				solver().updateVariables()
			}
		}
			break
		case SolverCommand.UPDATE_CONSTANT: {
			const id = data.at(0) as number
			const constant = data.at(1) as number
			solver()._updateConstantToById(id, constant)
			if (AUTO_UPDATE) {
				solver().updateVariables()
			}
		}
			break
		case SolverCommand.UPDATE_STRENGTH: {
			const id = data.at(0) as number
			const strength = SymbolicWeight.fromBinary(data.slice(1, 2))

			solver()._updateStrengthToById(id, strength)
			if (AUTO_UPDATE) {
				solver().updateVariables()
			}
			break
		}
		case SolverCommand.UPDATE_VARIABLES:
			solver().updateVariables()
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
			if (AUTO_UPDATE) {
				solver().updateVariables()
			}
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
		const type = _commands.next()
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
