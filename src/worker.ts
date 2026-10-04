// On type le scope global du worker
import { Solver } from './solver.js'
import { SolverCommand } from './solvercommand.js'
import { Constraint } from './constraint.js'
import { SymbolicWeight, LEVEL_COUNT } from './symbolicweight.js'

const ctx: Worker = self as any
let _solver : Solver
let _sharedInputArray : Int32Array

function solver() : Solver {
  return _solver
}

function waitForNextCommand() {
  //console.log('worker:waiting')

  Atomics.wait(_sharedInputArray, 0, _sharedInputArray.at(0) as number)
  //console.log('worker:handleCommand', _sharedInputArray.at(0))
  const type = _sharedInputArray.at(0) as number
  const size = _sharedInputArray.at(1) as number
  const data = _sharedInputArray.slice(2, size + 2) as Int32Array
  handleCommand(type, data, size)
}

function addConstraintsFromBinary(data: Int32Array, size: number) {
    let offset = 0
    while(offset < size) {
      const cst_size = data.at(offset) as number
      const constraint = Constraint.fromBinary(data.slice(offset, offset + cst_size))
      solver().addConstraint(constraint, false)
      offset += cst_size
    }

    solver().optimize()
}

function removeConstraintsFromBinary(data: Int32Array, size: number) {
  const ids = data.slice(0, size)
  solver().getConstraints().forEach((constraint : Constraint) => {
    if (ids.includes(constraint.id())) {
      solver().removeConstraint(constraint, false)
    }
  })

  solver().optimize()
}

function updateVariables () {
  solver().updateVariables()
}

function handleCommand(type: number, data: Int32Array, size: number) {

  switch (type) {
    case SolverCommand.ADD_CONSTRAINTS: {
      //console.log('worker:ADD_CONSTRAINTS')
      addConstraintsFromBinary(data, size)
      solver().updateVariables()
      waitForNextCommand()
    }
    break
    case SolverCommand.REMOVE_CONSTRAINTS: {
      //console.log('worker:ADD_CONSTRAINTS')
      removeConstraintsFromBinary(data, size)
      solver().updateVariables()
      waitForNextCommand()
    }
    break
    case SolverCommand.UPDATE_CONSTANT: {
      //console.log('worker:UPDATE_CONSTANT')
      const id = data.at(0) as number
      const constraint = solver().getConstraints().find(cst => cst.id() === id)
      if (constraint !== undefined) {
        const constant = data.at(1) as number
        solver().updateConstantTo(constraint, constant)
        solver().updateVariables()
      }
      waitForNextCommand()
    }
    break
    case SolverCommand.UPDATE_STRENGTH:
      const id = data.at(0) as number
      const constraint = solver().getConstraints().find(cst => cst.id() === id)
      if (constraint !== undefined) {
        const strength = SymbolicWeight.fromBinary(data.slice(1, 1 + LEVEL_COUNT))
        solver().updateStrengthTo(constraint, strength)
      }
      waitForNextCommand()
      break
    default:
      break
  }
}

ctx.onmessage = (e: MessageEvent<number>) => {
  const {type, data, update} = e.data as any;

  switch (type) {
    case SolverCommand.INIT:
      _solver = new Solver(data.output)
      _sharedInputArray = data.input
      waitForNextCommand()
      break
    default:
      break
  }

  ctx.postMessage({type:SolverCommand.AKNOWLEDGE, data:type});
}

export default ctx
