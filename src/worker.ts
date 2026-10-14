
import { SolverWorker } from './solverworker.js'
import { SolverCommand } from './solvercommand.js'
import { CommandConsumer } from './commandqueue.js'

const ctx: Worker = self as any

ctx.onmessage = (e: MessageEvent<any>) => {
	const { type, data } = e.data

	if (type !== SolverCommand.INIT) return

	ctx.postMessage({ type: SolverCommand.AKNOWLEDGE, data: type })

  new SolverWorker(data.output, new CommandConsumer(data.input)).run()
}

export default ctx
