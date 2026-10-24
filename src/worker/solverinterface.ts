import { Expression } from '../expression.js'
import { Constraint, Operator } from '../constraint.js'
import { SymbolicWeight } from '../symbolicweight.js'
import { Callback, Variable, floatToInt32 } from '../variable.js'
import { SolverOptions } from '../solver.js'

import { SolverCommand, ACK_FLAG, ACK_DONE, ACK_UPDATED, ACK_WORDS } from './solvercommand.js'
import { AckChannel } from './ackchannel.js'
import MyWorker from 'web-worker:./worker'
import { CommandProducer, createCommandBuffer } from './commandqueue.js'

const COMMAND_DATA_LENGTH = 1 << 16

export class SolverInterface {
	private _worker: Worker
	private _commands: CommandProducer
	private _sharedOuputArray: Int32Array
	private _sharedOutputIndex: number = 0
	private _lastCommand: number | undefined = undefined
	private _timeSeq: Int32Array
	private _timeVal: Float64Array
	private _done: AckChannel // callbacks des commandes traitées
	private _updated: AckChannel // callbacks de updateVariables()
	private _coefficient: number

	constructor(options? : SolverOptions) {
		Variable.debug = options?.debug??false

		this._worker = new MyWorker()

		const sharedOutputBuffer = new SharedArrayBuffer(512, { maxByteLength: Math.pow(2, 20) })
		this._sharedOuputArray = new Int32Array(sharedOutputBuffer)

    const inputBuffer = createCommandBuffer(COMMAND_DATA_LENGTH) // 65 536 words by default
		this._commands = new CommandProducer(inputBuffer)

		const sharedBuffer = new SharedArrayBuffer(16 + ACK_WORDS * Int32Array.BYTES_PER_ELEMENT)
		this._timeSeq = new Int32Array(sharedBuffer, 0, 2)
		this._timeVal = new Float64Array(sharedBuffer, 8, 1)
		const acks = new Int32Array(sharedBuffer, 16, ACK_WORDS)
		this._done = new AckChannel(acks, ACK_DONE)
		// Le worker acquitte les commandes avant updateVariables : on livre d'abord leurs callbacks.
		this._updated = new AckChannel(acks, ACK_UPDATED, () => this._done.poll())
		this._coefficient = Math.pow(10, options?.floatPrecision??0)

		this._worker.postMessage({
			type: SolverCommand.INIT,
			data: { input: inputBuffer, output: this._sharedOuputArray, shared: sharedBuffer },
			options
		})

		this._worker.onmessage = (event: any) => {
			const {type, data} = event.data
			switch(type) {
				case SolverCommand.INIT: {
					console.log(`%c Solver worker initialized`, 'font-family:monospace;font-size:14px;color:red;font-weight:bold')
				}
					break
				default:
					break
			}
		}
	}

  /**
	 * Agrandit le tampon de sortie partagé pour que `index` soit valide, que la variable ait un callback ou non.
	 * Sans cela, une variable au-delà de la capacité initiale (128 mots) fait lever une RangeError au worker.
	 */
	private ensureOutputCapacity(index: number): void {
		const buffer = this._sharedOuputArray.buffer as SharedArrayBuffer
		const needed = (index + 1) * Int32Array.BYTES_PER_ELEMENT
		if (needed > buffer.byteLength) {
			buffer.grow(Math.min(buffer.maxByteLength, Math.max(needed, buffer.byteLength * 2)))
		}
	}

  /**
	 * Envoie une commande. Avec `callback`, le worker l'acquitte une fois traitée (voir AckChannel) et le callback
	 * est appelé sur le main thread ; sans callback, aucune allocation supplémentaire.
	 */
  public sendCommand(
		type: number,
		payload: ArrayLike<number> = [],
		callback?: () => void,
		channel: AckChannel = this._done,
	): void {
		if (callback === undefined) {
			this._commands.send(type, payload)
		} else {
			channel.register(callback, id => this._commands.send(type | ACK_FLAG, [...Array.from(payload), id]))
		}
		this._lastCommand = type
	}

	private sendCommand2(type: number, a: number, b: number): void {
		this._commands.send2(type, a, b)
		this._lastCommand = type
	}
/*
	private watchVariable(variable: Variable): void {
		if (variable._sharedOutputIndex !== -1) return

    if (variable._callback !== undefined) {
      variable._notify = 1
      watchValue(this._sharedOuputArray, this._sharedOutputIndex, variable._callback)
    }

    variable._sharedOutputIndex = this._sharedOutputIndex++
	}
*/
  public createConstraint(
    lhs: Expression | Variable,
    operator: Operator,
    rhs: Expression | Variable | number,
    strength: SymbolicWeight = SymbolicWeight.create(0, 1),
    callback?: () => void,
  ): Constraint {
    let cn = new Constraint(lhs, operator, rhs, strength)
    this.addConstraint(cn, callback)
    return cn
  }

	public addConstraint(constraint: Constraint, callback?: () => void): void {
		this.addConstraints([constraint], callback)
	}

	public addConstraints(constraints: Constraint[], callback?: () => void): void {

		const payload = constraints.reduce((data:number[], constraint: Constraint) => {
			const constraint_data = constraint.toBinary((variable: Variable) => {
				if (variable._sharedOutputIndex === -1) {
					this.ensureOutputCapacity(this._sharedOutputIndex)
					if (variable._callback !== undefined) {
						variable._notify = 1
						watchValue(this._sharedOuputArray, this._sharedOutputIndex, this._coefficient, variable._callback)
					}

					variable._sharedOutputIndex = this._sharedOutputIndex++
				}
			})

			return [...data, ...constraint_data]
		}, [constraints.length])

		this.sendCommand(SolverCommand.ADD_CONSTRAINTS, payload, callback)
	}

	public removeConstraint(constraint: Constraint, callback?: () => void): void {
		this.removeConstraints([constraint], callback)
	}

	public removeConstraints(constraints: Constraint[], callback?: () => void): void {
		const payload = constraints.map(cst => cst.id())
		this.sendCommand(SolverCommand.REMOVE_CONSTRAINTS, payload, callback)
	}

	public updateConstantTo(constraint: Constraint, constant: number, callback?: () => void): void {
		const payload = new Int32Array(3)
		payload[0] = constraint.id()
		payload.set(floatToInt32(constant), 1)

		this.sendCommand(SolverCommand.UPDATE_CONSTANT, payload, callback)
	}

	public updateStrengthTo(constraint: Constraint, strength: SymbolicWeight, callback?: () => void): void {
		const strength_data = strength.toBinary()
		const payload = new Int32Array(1 + strength_data.length)
		payload[0] = constraint.id()
		payload.set(strength_data, 1)

		this.sendCommand(SolverCommand.UPDATE_STRENGTH, payload, callback)
	}

	public addEditVariable(variable: Variable, strength: SymbolicWeight, callback?: () => void): void {
		const id = variable.id()
		const strength_ = strength.toBinary()
		const payload = [id, ...strength_]
		this.sendCommand(SolverCommand.ADD_EDIT_VARIABLE, payload, callback)
	}

	public removeEditVariable(variable: Variable, callback?: () => void): void {
		const id = variable.id()
		this.sendCommand(SolverCommand.REMOVE_EDIT_VARIABLE, [id], callback)
	}

	public suggestValue(variable: Variable, value: number, callback?: () => void): void {
		const payload = new Int32Array(3)
		payload[0] = variable.id()
		payload.set(floatToInt32(value), 1)

		this.sendCommand(SolverCommand.SUGGEST_VALUE, payload, callback)
	}

	/**
	 * Demande la mise à jour des variables. Avec `callback`, il est appelé une fois la mise à jour effectuée par le
	 * worker : les valeurs sont alors disponibles via valueOfVariable().
	 */
	public updateVariables(callback?: () => void): void {
		if (callback !== undefined) {
			this.sendCommand(SolverCommand.UPDATE_VARIABLES, [], callback, this._updated)
		} else if (this._lastCommand !== SolverCommand.UPDATE_VARIABLES) {
			this.sendCommand(SolverCommand.UPDATE_VARIABLES)
		}
	}

	public valueOfVariable(variable: Variable): bigint | number {
		const index = variable._sharedOutputIndex
		if (index < 0 || index >= this._sharedOuputArray.length) {
			throw new Error(`Invalid Atomics access index ${index} out of bounds [0-${this._sharedOuputArray.length}]`)
		}

		return Atomics.load(this._sharedOuputArray, index) / this._coefficient
	}

	public getConstraints() : Constraint[] {
		console.warn("Solver getConstraints() is not implemented in worker mode")
		return []
	}

	public hasConstraints(constraint: Constraint) : boolean {
		console.warn("Solver hasConstraints() is not implemented in worker mode")
		return false
	}

	public print() {
		this.sendCommand(SolverCommand.PRINT)
	}

	public time(callback: (date: number) => void) {
		const seq = Atomics.load(this._timeSeq, 0)
		this.sendCommand(SolverCommand.TIME)
		const r = Atomics.waitAsync(this._timeSeq, 0, seq)
		const done = () => callback(this._timeVal[0])
		if (r.async) r.value.then(done)
		else done()
	}

	public isAsync() : boolean {
    return true
  }
}

function watchValue(typedArray: Int32Array, index: number, coefficient: number, callback: Callback) {

	if (index >= typedArray.length) {
		let buffer = typedArray.buffer as SharedArrayBuffer
		buffer.grow((typedArray.length + 128) * Int32Array.BYTES_PER_ELEMENT)
	}
	// Charger la valeur actuelle
	let currentVal = Atomics.load(typedArray, index)

	function waitForChange() {
		// Attendre de façon non-bloquante que la valeur change de "currentVal"
		const result = Atomics.waitAsync(typedArray, index, currentVal)

		if (result.async) {
			result.value.then((status) => {
				// La valeur a changé ou une notification a eu lieu
				if (status == 'ok') {
					const previousVal = currentVal
					currentVal = Atomics.load(typedArray, index)
					//console.log(`${status}: La valeur a changé pour : ${currentVal}`)
					callback(currentVal / coefficient, previousVal / coefficient)
				}

				// Relancer l'attente pour le prochain changement
				waitForChange()
			})
		} else {
			// La valeur était déjà différente au moment de l'appel
      const previousVal = currentVal
			currentVal = Atomics.load(typedArray, index)
      callback(currentVal / coefficient, previousVal / coefficient)
			waitForChange()
		}
	}

	waitForChange()
}
