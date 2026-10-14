import { Expression } from './expression.js'
import { Constraint, Operator } from './constraint.js'
import { SymbolicWeight } from './symbolicweight.js'
import { Callback, Variable } from './variable.js'
import { SolverCommand } from './solvercommand.js'
import MyWorker from 'web-worker:./worker'
import { CommandProducer, createCommandBuffer } from './commandqueue.js'

export class SolverInterface {
	private _worker: Worker
	private _commands: CommandProducer
	private _sharedOuputArray: Int32Array
	private _sharedOutputIndex: number = 0
	private _lastCommand: number | undefined = undefined
  private _timeCallback: ((date: number) => void) | undefined = undefined

  constructor() {
		this._worker = new MyWorker()

		const sharedOutputBuffer = new SharedArrayBuffer(512, { maxByteLength: Math.pow(2, 20) })
		this._sharedOuputArray = new Int32Array(sharedOutputBuffer)

    const inputBuffer = createCommandBuffer() // 65 536 words by default
		this._commands = new CommandProducer(inputBuffer)

		this._worker.postMessage({
			type: SolverCommand.INIT,
			data: { input: inputBuffer, output: this._sharedOuputArray },
		})

		this._worker.onmessage = (event: any) => {
			const { type, data } = event.data

			switch (type) {
				case SolverCommand.AKNOWLEDGE:
					console.log(data)
					break;
				case SolverCommand.TIME: {
					if (this._timeCallback !== undefined) {
						this._timeCallback(data)
					}
				}
				default:
					break;
			}
		}
	}

  public sendCommand(type: number, payload: ArrayLike<number> = []): void {
		this._commands.send(type, payload)
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
  ): Constraint {
    let cn = new Constraint(lhs, operator, rhs, strength)
    this.addConstraint(cn)
    return cn
  }

	public addConstraint(constraint: Constraint): void {
		this.addConstraints([constraint])
	}

	public addConstraints(constraints: [Constraint]): void {

		let payload: Array<number> = []

		constraints.forEach(constraint => {
      constraint.expression().terms().array.forEach(({first: variable}: any) => {

        if (variable._sharedOutputIndex === -1) {
          if (variable._callback !== undefined) {
            variable._notify = 1
            watchValue(this._sharedOuputArray, this._sharedOutputIndex, variable._callback)
          }

          variable._sharedOutputIndex = this._sharedOutputIndex++
        }
			})

			const binary_cst = constraint.toBinary()
			payload = [...payload, ...binary_cst]
		})

		this.sendCommand(SolverCommand.ADD_CONSTRAINTS, payload)
	}

	public removeConstraint(constraint: Constraint): void {
		this.removeConstraints([constraint])
	}

	public removeConstraints(constraints: [Constraint]): void {
		const payload = constraints.map(cst => cst.id())
		this.sendCommand(SolverCommand.REMOVE_CONSTRAINTS, payload)
	}

	public updateConstantTo(constraint: Constraint, constant: number): void {
		const id = constraint.id()
		this.sendCommand2(SolverCommand.UPDATE_CONSTANT, id, constant)
	}

	public updateStrengthTo(constraint: Constraint, strength: SymbolicWeight): void {
		const id = constraint.id()
		const levels = strength.toBinary()
		const payload = [id, ...levels]
		this.sendCommand(SolverCommand.UPDATE_STRENGTH, payload)
	}

	public addEditVariable(variable: Variable, strength: SymbolicWeight): void {
		const id = variable.id()
		const levels = strength.toBinary()
		const payload = [id, ...levels]
		this.sendCommand(SolverCommand.ADD_EDIT_VARIABLE, payload)
	}

	public removeEditVariable(variable: Variable): void {
		const id = variable.id()
		const payload = [id]
		this.sendCommand(SolverCommand.REMOVE_EDIT_VARIABLE, payload)
	}

	public suggestValue(variable: Variable, value: number): void {
		const id = variable.id()
		this.sendCommand2(SolverCommand.SUGGEST_VALUE, id, value)
	}

	public updateVariables(): void {
		if (this._lastCommand !== SolverCommand.UPDATE_VARIABLES) {
			this.sendCommand(SolverCommand.UPDATE_VARIABLES)
		}
	}

	public valueOfVariable(variable: Variable): number | bigint | undefined {
		return (variable._sharedOutputIndex >= 0) ? Atomics.load(this._sharedOuputArray, variable._sharedOutputIndex) : undefined
	}

	public time(callback: (date: number) => void) {
		this._timeCallback = callback
		this.sendCommand(SolverCommand.TIME)
	}
}

function watchValue(typedArray: Int32Array, index: number, callback: Callback) {
	// Charger la valeur actuelle
	let currentVal = Atomics.load(typedArray, index)

	function waitForChange() {
		// Attendre de façon non-bloquante que la valeur change de "currentVal"
		const result = Atomics.waitAsync(typedArray, index, currentVal)

		if (result.async) {
			result.value.then((status) => {
				// La valeur a changé ou une notification a eu lieu
				if (status == 'ok') {
          const prev = currentVal
					currentVal = Atomics.load(typedArray, index)
					//console.log(`${status}: La valeur a changé pour : ${currentVal}`)
          callback(currentVal, prev)
				}

				// Relancer l'attente pour le prochain changement
				waitForChange()
			})
		} else {
			// La valeur était déjà différente au moment de l'appel
      const prev = currentVal
			currentVal = Atomics.load(typedArray, index)
      callback(currentVal, prev)
			waitForChange()
		}
	}

	waitForChange()
}
