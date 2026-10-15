import { Solver } from './solver.js'
import { SolverCommand } from './solvercommand.js'
import { Constraint } from './constraint.js'
import { SymbolicWeight } from './symbolicweight.js'
import { CommandConsumer, NO_COMMAND } from './commandqueue.js'

const UPDATE_INTERVAL_MS = 16

export class SolverWorker extends Solver {
  private _commands: CommandConsumer
  private _timeSeq: Int32Array
  private _timeVal: Float64Array
  private _needsUpdateVariables: boolean = false
  private _lastUpdate: number = -Infinity

  constructor(output: Int32Array, input: CommandConsumer, timeBuffer: SharedArrayBuffer) {
    super(output)
    this._commands = input
    this._timeSeq = new Int32Array(timeBuffer, 0, 2)
    this._timeVal = new Float64Array(timeBuffer, 8, 1)
  }

  public run() : void {
  	while (true) {
  		let type: number
      if (this._needsUpdateVariables) {
  			const now = performance.now()
  			if (now >= this._lastUpdate + UPDATE_INTERVAL_MS) this.flushVariables(now) // échéance atteinte (ou worker inactif : latence minimale)
  		}
      if (this._needsUpdateVariables) {
  			// Mise à jour en attente : on ne dort pas plus longtemps que la prochaine échéance.
  			type = this._commands.next(Math.max(0, this._lastUpdate + UPDATE_INTERVAL_MS - performance.now()))
  			if (type === NO_COMMAND) continue // l'échéance est passée : le haut de la boucle fait la mise à jour
  		} else {
  			type = this._commands.next()
  		}
  		this.handleCommand(type)
  	}
  }

  private flushVariables(now: number): void {
  	this._needsUpdateVariables = false
  	this._lastUpdate = now
    super.updateVariables()
  }

  private handleCommand(type: number) : void {
    const payload = this._commands.payload

  	switch (type) {
  		case SolverCommand.ADD_CONSTRAINTS: {
        this.addConstraintsFromBinary(payload, this._commands.size)
  		}
  			break
  		case SolverCommand.REMOVE_CONSTRAINTS: {
  			this.removeConstraintsFromBinary(payload, this._commands.size)
  		}
  			break
  		case SolverCommand.UPDATE_CONSTANT: {
  			const id = payload.at(0) as number
  			const constant = payload.at(1) as number
        super._updateConstantToById(id, constant)
  		}
  			break
  		case SolverCommand.UPDATE_STRENGTH: {
  			const id = payload.at(0) as number
  			const strength = SymbolicWeight.fromBinary(payload.slice(1, 2))
  			super._updateStrengthToById(id, strength)
  			break
  		}
  		case SolverCommand.UPDATE_VARIABLES:
        this._needsUpdateVariables = true // exécuté par run(), au plus une fois par UPDATE_INTERVAL_MS
  			break
  		case SolverCommand.ADD_EDIT_VARIABLE: {
  			const id = payload.at(0) as number
  			const strength = SymbolicWeight.fromBinary(payload.slice(1, this._commands.size))
        this._addEditVariable(id, strength)
  		}
  			break
  		case SolverCommand.REMOVE_EDIT_VARIABLE: {
  			const id = payload.at(0) as number
        this._removeEditVariable(id)
  		}
  			break
  		case SolverCommand.SUGGEST_VALUE: {
  			const id = payload.at(0) as number
  			const value = payload.at(1) as number
        this._suggestValue(id, value)
  		}
  			break
      case SolverCommand.TIME:
        this._timeVal[0] = performance.timeOrigin + performance.now() // juste avant de "sortir"
        Atomics.add(this._timeSeq, 0, 1)
        Atomics.notify(this._timeSeq, 0)
        break
  		default:
  			break
  	}
  }

  private addConstraintsFromBinary(data: Int32Array, size: number): void {
  	let offset = 0

  	while (offset < size) {
  		const cst_size = (data.at(offset) as number) + 1
  		const constraint = Constraint.fromBinary(data.slice(offset, offset + cst_size))
  		super.addConstraint(constraint, false)
  		offset += cst_size
  	}

  	super.optimize()
  }

  private removeConstraintsFromBinary(data: Int32Array, size: number): void {
  	const ids = data.slice(0, size)

  	super.getConstraints().forEach((constraint: Constraint) => {
  		if (ids.includes(constraint.id())) {
  			super.removeConstraint(constraint, false)
  		}
  	})

  	super.optimize()
  }

  private _addEditVariable(id: number, strength: SymbolicWeight): void {
  	const variable = super.getVariable(id)
  	if (variable !== undefined) {
  		super.addEditVariable(variable, strength)
  	}
  }

  private _removeEditVariable(id: number): void {
  	const variable = super.getVariable(id)
  	if (variable !== undefined) {
  		super.removeEditVariable(variable)
  	}
  }

  private _suggestValue(id: number, value: number): void {
  	const variable = super.getVariable(id)
  	if (variable !== undefined) {
      super.suggestValue(variable, value)
  	}
  }
}
