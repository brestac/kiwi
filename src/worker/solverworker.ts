import { Solver, Symbol, SymbolType, SolverOptions } from '../solver.js'
import { Constraint } from '../constraint.js'
import { SymbolicWeight, LEVEL_COUNT } from '../symbolicweight.js'
import { IMap, Pair } from '../maptype.js'
import { Variable, int32ToFloat } from '../variable.js'

import { SolverCommand, ACK_FLAG, ACK_DONE, ACK_UPDATED, ACK_WORDS } from './solvercommand.js'
import { CommandConsumer, NO_COMMAND } from './commandqueue.js'

export class SolverWorker extends Solver {
  private _commands: CommandConsumer
  private _output: Int32Array
  private _timeSeq: Int32Array
  private _timeVal: Float64Array
  private _acks: Int32Array
  private _needsUpdateVariables: boolean = false
  private _lastUpdate: number = -Infinity
  private _updateAckId: number = 0 // id du dernier updateVariables(callback) en attente de la prochaine mise à jour
  private _coefficient: number

  constructor(output: Int32Array, input: CommandConsumer, sharedBuffer: SharedArrayBuffer, options?: SolverOptions) {
    super(options)
    this._commands = input
    this._output = output
    this._timeSeq = new Int32Array(sharedBuffer, 0, 2)
    this._timeVal = new Float64Array(sharedBuffer, 8, 1)
    this._acks = new Int32Array(sharedBuffer, 16, ACK_WORDS)
    this._coefficient = Math.pow(10, options?.floatPrecision??0)
  }

  /**
  * Update the values of the variables.
  */
  public updateVariables(): void {
    let vars = this._varMap
    let rows = this._rowMap

    for (let i = 0, n = vars.size(); i < n; ++i) {
      let { first: variable, second: symbol } = vars.itemAt(i)
      let rowPair = rows.find(symbol)

      if (rowPair !== undefined) {
        this.insertValueAt(rowPair.second.constant(), variable._sharedOutputIndex, variable._notify)
      } else {
        this.insertValueAt(0, variable._sharedOutputIndex, variable._notify)
      }
    }

    // Les valeurs sont publiées : on acquitte les updateVariables(callback) en attente (un id vaut pour les précédents).
    if (this._updateAckId !== 0) {
      this.ack(ACK_UPDATED, this._updateAckId)
      this._updateAckId = 0
    }
  }

  private ack(index: number, id: number): void {
    Atomics.store(this._acks, index, id)
    Atomics.notify(this._acks, index)
  }

  /**
  * Get the symbol for the given variable.
  *
  * If a symbol does not exist for the variable, one will be created.
  * @private
  */
  protected _getVarSymbol(variable: Variable): Symbol {
    let factory = () => this._makeSymbol(SymbolType.External)
    return this.setDefault(variable, factory).second
  }

  private setDefault(key: Variable, factory: () => Symbol): Pair<Variable, Symbol> {
    const i = this._varMap.index[key.id()]

    if (i === undefined) {
      const pair = new Pair(key, factory())
      const size = this._varMap.array.length
      this._varMap.index[key.id()] = size
      this._varMap.array.push(pair)

      if (size > this._output.length) {
        let buffer = this._output.buffer as SharedArrayBuffer
        buffer.grow(size * Int32Array.BYTES_PER_ELEMENT)
      }

      this._output[key._sharedOutputIndex] = key.value() * this._coefficient

      return pair
    } else {
      return this._varMap.array[i]
    }
  }

  private insertValueAt(value: number, index: number, notify: number = 0) : void {
    const new_value = Math.round(value * this._coefficient)
    const old_value = Atomics.exchange(this._output, index, new_value)

    if (notify == 1 && old_value !== new_value) {
      Atomics.notify(this._output, index, 1)
    }
  }

  private getVariable(id: number): Variable | undefined {
    const i = this._varMap.index[id]
    if (i === undefined) return undefined

    return this._varMap.array[i]?.first
  }

  public run(updatesMs: number): void {
    if (updatesMs === 0) {
      this.run_no_limit()
    } else {
      this.run_every(updatesMs)
    }
  }

  public run_no_limit() : void {
    while(true) {
      if (this._needsUpdateVariables) {
        this.flushVariables(0)
      } else {
        const type = this._commands.next()
        this.handleCommand(type)
      }
    }
  }

  public run_every(updatesMs: number) : void {
    while (true) {
      let type: number
      if (this._needsUpdateVariables) {
        const now = performance.now()
        if (now >= this._lastUpdate + updatesMs) this.flushVariables(now) // échéance atteinte (ou worker inactif : latence minimale)
      }
      if (this._needsUpdateVariables) {
        // Mise à jour en attente : on ne dort pas plus longtemps que la prochaine échéance.
        type = this._commands.next(Math.max(0, this._lastUpdate + updatesMs - performance.now()))
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
    this.updateVariables()
  }

  private handleCommand(rawType: number) : void {
    const payload = this._commands.payload
    let size = this._commands.size
    let type = rawType
    let ackId = 0

    // Commande envoyée avec un callback : le dernier mot du payload est l'id à acquitter.
    if (type & ACK_FLAG) {
      type &= ~ACK_FLAG
      ackId = payload[--size]
    }

  	switch (type) {
  		case SolverCommand.ADD_CONSTRAINTS: {
        this.addConstraintsFromBinary(payload, size)
  		}
  			break
  		case SolverCommand.REMOVE_CONSTRAINTS: {
  			this.removeConstraintsFromBinary(payload, size)
  		}
  			break
      case SolverCommand.SUGGEST_VALUE: {
        const id = payload.at(0) as number
        const constant = int32ToFloat(payload.subarray(1, 3))
        this._suggestValue(id, constant) // ? value * this._coefficient
  		}
  			break
  		case SolverCommand.UPDATE_CONSTANT: {
  			const id = payload.at(0) as number
        const constant = int32ToFloat(payload.subarray(1, 3))
        super._updateConstantToById(id, constant)
  		}
  			break
  		case SolverCommand.UPDATE_STRENGTH: {
  			const id = payload.at(0) as number
        const strength = SymbolicWeight.fromBinary(payload.slice(1, 1 + LEVEL_COUNT))
  			super._updateStrengthToById(id, strength)
  			break
  		}
  		case SolverCommand.UPDATE_VARIABLES:
        this._needsUpdateVariables = true // exécuté par run(), au plus une fois par refreshRate
        //this._notifyUpdateVariables = payload.at(0) as number
  			break
  		case SolverCommand.ADD_EDIT_VARIABLE: {
  			const id = payload.at(0) as number
  			const strength = SymbolicWeight.fromBinary(payload.slice(1, 1 + LEVEL_COUNT))
        this._addEditVariable(id, strength)
  		}
  			break
  		case SolverCommand.REMOVE_EDIT_VARIABLE: {
  			const id = payload.at(0) as number
        this._removeEditVariable(id)
  		}
  			break
      case SolverCommand.TIME:
        this._timeVal[0] = performance.timeOrigin + performance.now() // juste avant de "sortir"
        Atomics.add(this._timeSeq, 0, 1)
        Atomics.notify(this._timeSeq, 0)
        break
      case SolverCommand.PRINT:
        console.log(this.toString())
  		default:
  			break
  	}

    if (ackId !== 0) {
      if (type === SolverCommand.UPDATE_VARIABLES) {
        this._updateAckId = ackId // acquitté par updateVariables(), une fois les valeurs publiées
      } else {
        this.ack(ACK_DONE, ackId)
      }
    }
  }

  private addConstraintsFromBinary(data: Int32Array, size: number): void {
    let n_csts = data.at(0) as number
    let offset = 1

  	while (offset < size) {
  		const cst_size = (data.at(offset) as number)
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
    const variable = this.getVariable(id)
  	if (variable !== undefined) {
  		super.addEditVariable(variable, strength)
  	}
  }

  private _removeEditVariable(id: number): void {
    const variable = this.getVariable(id)
  	if (variable !== undefined) {
  		super.removeEditVariable(variable)
  	}
  }

  private _suggestValue(id: number, value: number): void {
    const variable = this.getVariable(id)
  	if (variable !== undefined) {
      super.suggestValue(variable, value)
  	}
  }
}
