
import { SolverWorker } from './solverworker.js'
import { SolverCommand } from './solvercommand.js'
import { CommandConsumer } from './commandqueue.js'

const ctx: Worker = self as any

ctx.onmessage = (e: MessageEvent<any>) => {
  const { type, data, options } = e.data

	if (type !== SolverCommand.INIT) return

  const refreshRate = options?.refreshRate??60
  const updatesMs = (refreshRate === 0) ? 0 : (1000 / refreshRate)
  //ctx.postMessage("Kiwi Solver running in web worker !!")

  new SolverWorker(data.output, new CommandConsumer(data.input), data.shared, options).run(updatesMs)
}

export default ctx
