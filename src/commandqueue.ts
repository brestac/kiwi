// Command stack SPSC (1 producer = main thread, 1 consummer = worker)
// on top of a SharedArrayBuffer.
//
// Layout (Int32) : [0]=TAIL (writing index), [1]=HEAD (reading index), [2..]=ring
// Message        : [type, size, ...payload]

const TAIL = 0
const HEAD = 1
const HEADER = 2

export function createCommandBuffer(words = 1 << 16): SharedArrayBuffer {
  return new SharedArrayBuffer((HEADER + words) * Int32Array.BYTES_PER_ELEMENT)
}

/** main thread side non blocking */
export class CommandProducer {
  private buf: Int32Array
  private cap: number
  private pending: number[][] = []
  private waiting = false

  constructor(sab: SharedArrayBuffer) {
    this.buf = new Int32Array(sab)
    this.cap = this.buf.length - HEADER
  }

  send(type: number, payload: ArrayLike<number> = []): void {
    if (payload.length + 2 >= this.cap) throw new Error('command larger than the queue')
    this.pending.push([type, payload.length, ...Array.from(payload)])
    this.flush()
  }

  private flush(): void {
    const b = this.buf
    while (this.pending.length) {
      const msg = this.pending[0]
      const head = Atomics.load(b, HEAD)
      const tail = Atomics.load(b, TAIL)
      const free = (head - tail - 1 + this.cap) % this.cap
      if (msg.length > free) {
        // File pleine : on réessaie quand le worker aura avancé HEAD.
        if (!this.waiting) {
          this.waiting = true
          const r = Atomics.waitAsync(b, HEAD, head)
          const retry = () => { this.waiting = false; this.flush() }
          if (r.async) r.value.then(retry)
          //else queueMicrotask(retry)
        }
        return
      }
      for (let i = 0; i < msg.length; i++) b[HEADER + ((tail + i) % this.cap)] = msg[i]
      // Publication : l'écriture atomique de TAIL rend le message visible.
      Atomics.store(b, TAIL, (tail + msg.length) % this.cap)
      Atomics.notify(b, TAIL)
      this.pending.shift()
    }
  }
}

/** worker side blocking reading. */
export class CommandConsumer {
  private buf: Int32Array
  private cap: number

  constructor(sab: SharedArrayBuffer) {
    this.buf = new Int32Array(sab)
    this.cap = this.buf.length - HEADER
  }

  next(): {type: number; payload: Int32Array} {
    const b = this.buf
    const head = Atomics.load(b, HEAD)
    let tail: number
    // On dort uniquement si TAIL vaut encore la valeur qu'on vient de lire :
    // si le producteur est passé entre-temps, wait() rend "not-equal" aussitôt.
    while ((tail = Atomics.load(b, TAIL)) === head) Atomics.wait(b, TAIL, tail)

    const at = (i: number) => b[HEADER + ((head + i) % this.cap)]
    const type = at(0)
    const size = at(1)
    const payload = new Int32Array(size)
    for (let i = 0; i < size; i++) payload[i] = at(2 + i)

    Atomics.store(b, HEAD, (head + 2 + size) % this.cap)
    Atomics.notify(b, HEAD)
    return {type, payload}
  }
}
