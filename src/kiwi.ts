export * from './constraint.js'
export * from './expression.js'
export * from './solver.js'
export * from './strength.js'
export * from './symbolicweight.js'
export * from './variable.js'

import { Solver } from './solver.js'
import { SolverInterface } from './worker/solverinterface.js'

export type { SolverInterface }

Solver.workerFactory = () => new SolverInterface()
