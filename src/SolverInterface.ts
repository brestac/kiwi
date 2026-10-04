import { Expression } from './expression.js'
import { Constraint } from './constraint.js'
import { SymbolicWeight } from './symbolicweight.js'
import { Callback, Variable } from './variable.js'
import { SolverCommand } from './solvercommand.js'
import MyWorker from 'web-worker:./worker'

export class SolverInterface {

    private _worker : Worker
    private _sharedInputArray : Int32Array
    private _sharedOuputArray: Int32Array
    private _sharedVarIndex : number = 0

    constructor() {
      this._worker = new MyWorker()

      const sharedOutputBuffer = new SharedArrayBuffer(512, { maxByteLength: Math.pow(2, 20) /*1.048.576 bytes*/ });
      this._sharedOuputArray = new Int32Array(sharedOutputBuffer)

      const sharedInputBuffer = new SharedArrayBuffer(512);
      this._sharedInputArray = new Int32Array(sharedInputBuffer)

      this._worker.postMessage({type:SolverCommand.INIT, data:{input:this._sharedInputArray, output:this._sharedOuputArray}})
      this._worker.onmessage = (event:any) => console.log(event.data)
    }

    public sendCommand(type:number, payload:Array<number> = []) {
      let input = new Int32Array([type, payload.length, ...payload])

      if (input.length > this._sharedInputArray.length) {
        let buffer = this._sharedInputArray.buffer as SharedArrayBuffer
        buffer.grow(input.length)
      }

      this._sharedInputArray.set(input, 0)
      //console.log('sendCommand', input)
      Atomics.notify(this._sharedInputArray, 0)
    }

    public addConstraints(constraints: [Constraint]) : void {

      let payload: Array<number> = []

      constraints.forEach(constraint => {
        constraint.expression().terms().array.forEach((pair:any) => {
          let variable = pair.first

          if (variable._callback !== undefined) {
            variable._sharedVarIndex = this._sharedVarIndex
            variable._notify = true
            watchValue(this._sharedOuputArray, this._sharedVarIndex, variable)
            this._sharedVarIndex++
          } else {
            variable._notify = false
          }
        })

        const binary_cst = constraint.toBinary()
        payload = [...payload, ...binary_cst]
      })

      this.sendCommand(SolverCommand.ADD_CONSTRAINTS, payload)
    }

    public removeConstraints(constraints: [Constraint]) : void {
        const payload = constraints.map(cst => cst.id())
        this.sendCommand(SolverCommand.REMOVE_CONSTRAINTS, payload)
    }

    public updateVariables() : void {
      this.sendCommand(SolverCommand.UPDATE_VARIABLES)
    }

    public updateConstantTo(constraint: Constraint, constant: number) : void {
      const payload = [constraint.id(), constant]
      this.sendCommand(SolverCommand.UPDATE_CONSTANT, payload)
    }

    public updateStrengthTo(constraint: Constraint, strength: SymbolicWeight) : void {
      const levels = strength.toBinary()
      const payload = [constraint.id(), ...levels]
      this.sendCommand(SolverCommand.UPDATE_STRENGTH, payload)
    }

    public valueOfVariable(variable: Variable) : number | bigint | undefined {
      return (variable._sharedVarIndex >= 0) ? Atomics.load(this._sharedOuputArray, variable._sharedVarIndex) : undefined
    }
}

function watchValue(typedArray: Int32Array, index: number, variable: Variable) {
  // Charger la valeur actuelle
  let currentVal = Atomics.load(typedArray, index);

  function waitForChange() {
    // Attendre de façon non-bloquante que la valeur change de "currentVal"
    const result = Atomics.waitAsync(typedArray, index, currentVal);

    if (result.async) {
      result.value.then((status) => {
        // La valeur a changé ou une notification a eu lieu
				if (status == 'ok') {
          currentVal = Atomics.load(typedArray, index);
          //console.log(`${status}: La valeur a changé pour : ${currentVal}`);
          variable.setValue(currentVal)
				}

        // Relancer l'attente pour le prochain changement
        waitForChange();
      });
    } else {
      // La valeur était déjà différente au moment de l'appel
      currentVal = Atomics.load(typedArray, index);
      waitForChange();
    }
  }

  waitForChange();
}
