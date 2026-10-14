// File de commandes SPSC (producteur = main thread, consommateur = worker) sur un SharedArrayBuffer.
//
// Layout (Int32) : [0]=TAIL  [1]=HEAD  [2]=CSLEEP (le worker dort)  [3]=PWAIT (le main thread attend de la place)
//                  puis un anneau de `words` mots (puissance de 2).
// Message        : [type, taille, ...payload]
//
// Principes :
//  - aucune allocation par commande côté producteur ;
//  - TAIL est publié une seule fois par rafale (microtask) ;
//  - Atomics.notify n'est appelé que si l'autre côté dort réellement ;
//  - si l'anneau est plein, les messages attendent dans un Int32Array (pas de number[][]).

const TAIL = 0
const HEAD = 1
const CSLEEP = 2
const PWAIT = 3
const HEADER = 4

export function createCommandBuffer(words = 1 << 16): SharedArrayBuffer {
  if (words < 8 || (words & (words - 1)) !== 0) throw new Error('queue size must be a power of two')
  return new SharedArrayBuffer((HEADER + words) * Int32Array.BYTES_PER_ELEMENT)
}

/** Côté main thread : ne bloque jamais. */
export class CommandProducer {
  private buf: Int32Array
  private mask: number
  private tail = 0 // copie locale : le producteur est le seul à écrire TAIL
  private head = 0 // copie en cache de HEAD, relue seulement quand l'anneau paraît plein
  private published = 0
  private scheduled = false
  private armed = false
  private pend = new Int32Array(1024) // zone d'attente quand l'anneau est plein
  private pr = 0 // index de lecture dans pend
  private pw = 0 // index d'écriture dans pend

  constructor(sab: SharedArrayBuffer) {
    this.buf = new Int32Array(sab)
    this.mask = this.buf.length - HEADER - 1
  }

  /** Cas général. */
  send(type: number, payload: ArrayLike<number> = []): void {
    const size = payload.length
    const n = size + 2
    if (n > this.mask) throw new Error('command larger than the queue')
    if (this.reserve(n)) {
      this.put(0, type)
      this.put(1, size)
      for (let i = 0; i < size; i++) this.put(2 + i, payload[i])
      this.tail = (this.tail + n) & this.mask
      this.schedule()
    } else {
      this.enqueue([type, size, ...Array.from(payload)])
    }
  }

  /** Chemin rapide sans tableau intermédiaire : commandes à 2 valeurs (updateConstantTo, suggestValue...). */
  send2(type: number, a: number, c: number): void {
    if (this.reserve(4)) {
      this.put(0, type)
      this.put(1, 2)
      this.put(2, a)
      this.put(3, c)
      this.tail = (this.tail + 4) & this.mask
      this.schedule()
    } else {
      this.enqueue([type, 2, a, c])
    }
  }

  /** Publie tout de suite (sinon la publication a lieu en fin de tâche JS courante). */
  flush = (): void => {
    this.scheduled = false
    if (this.tail !== this.published) this.publish()
    this.drainPending()
  }

  private put(i: number, v: number): void {
    this.buf[HEADER + ((this.tail + i) & this.mask)] = v
  }

  private free(): number {
    return (this.head - this.tail - 1) & this.mask
  }

  private reserve(n: number): boolean {
    if (this.pw !== this.pr) return false // on garde l'ordre : tout passe par la zone d'attente
    if (n <= this.free()) return true
    this.head = Atomics.load(this.buf, HEAD)
    return n <= this.free()
  }

  private schedule(): void {
    if (!this.scheduled) {
      this.scheduled = true
      queueMicrotask(this.flush)
    }
  }

  private publish(): void {
    Atomics.store(this.buf, TAIL, this.tail)
    this.published = this.tail
    if (Atomics.load(this.buf, CSLEEP) === 1) Atomics.notify(this.buf, TAIL)
  }

  private enqueue(words: number[]): void {
    const n = words.length
    if (this.pw + n > this.pend.length) {
      const live = this.pw - this.pr
      if (live + n > this.pend.length) {
        const bigger = new Int32Array(Math.max(this.pend.length * 2, live + n))
        bigger.set(this.pend.subarray(this.pr, this.pw))
        this.pend = bigger
      } else {
        this.pend.copyWithin(0, this.pr, this.pw)
      }
      this.pr = 0
      this.pw = live
    }
    for (let i = 0; i < n; i++) this.pend[this.pw + i] = words[i]
    this.pw += n
    this.flush()
  }

  private drainPending(): void {
    let wrote = false
    while (this.pr < this.pw) {
      const n = this.pend[this.pr + 1] + 2
      if (n > this.free()) {
        this.head = Atomics.load(this.buf, HEAD)
        if (n > this.free()) {
          if (wrote) this.publish()
          this.armWait()
          return
        }
      }
      for (let i = 0; i < n; i++) this.put(i, this.pend[this.pr + i])
      this.tail = (this.tail + n) & this.mask
      this.pr += n
      wrote = true
    }
    this.pr = this.pw = 0
    if (wrote) this.publish()
  }

  /** Attend (sans bloquer) que le worker ait avancé HEAD, puis relance drainPending. */
  private armWait(): void {
    if (this.armed) return
    this.armed = true
    Atomics.store(this.buf, PWAIT, 1)
    const head = Atomics.load(this.buf, HEAD) // relecture après l'annonce : évite de rater l'avance
    const retry = () => {
      this.armed = false
      Atomics.store(this.buf, PWAIT, 0)
      this.flush()
    }
    if (head !== this.head) {
      queueMicrotask(retry)
    } else if (typeof Atomics.waitAsync === 'function') {
      const r = Atomics.waitAsync(this.buf, HEAD, head)
      if (r.async) r.value.then(retry)
      else queueMicrotask(retry)
    } else {
      setTimeout(retry, 1) // repli (navigateurs sans Atomics.waitAsync)
    }
  }
}

/** Côté worker : lecture bloquante, sans allocation par commande. */
export class CommandConsumer {
  private buf: Int32Array
  private mask: number
  private head = 0
  /** Payload de la dernière commande lue. Réutilisé : valide jusqu'au prochain next(), seuls les `size` premiers mots comptent. */
  payload = new Int32Array(256)
  size = 0

  constructor(sab: SharedArrayBuffer) {
    this.buf = new Int32Array(sab)
    this.mask = this.buf.length - HEADER - 1
  }

  /** True s'il reste des commandes déjà publiées (utile pour ne mettre à jour les variables qu'en fin de rafale). */
  hasPending(): boolean {
    return Atomics.load(this.buf, TAIL) !== this.head
  }

  /** Bloque jusqu'à la prochaine commande ; renvoie son type (payload dans this.payload, taille dans this.size). */
  next(): number {
    const b = this.buf
    const head = this.head
    let tail = Atomics.load(b, TAIL)
    while (tail === head) {
      Atomics.store(b, CSLEEP, 1) // on annonce qu'on dort, puis on revérifie TAIL (pas de réveil perdu)
      tail = Atomics.load(b, TAIL)
      if (tail === head) Atomics.wait(b, TAIL, tail)
      Atomics.store(b, CSLEEP, 0)
      tail = Atomics.load(b, TAIL)
    }

    const mask = this.mask
    const type = b[HEADER + head]
    const size = b[HEADER + ((head + 1) & mask)]
    if (size > this.payload.length) this.payload = new Int32Array(Math.max(size, this.payload.length * 2))
    const payload = this.payload
    for (let i = 0; i < size; i++) payload[i] = b[HEADER + ((head + 2 + i) & mask)]
    this.size = size

    const newHead = (head + 2 + size) & mask
    this.head = newHead
    Atomics.store(b, HEAD, newHead)
    if (Atomics.load(b, PWAIT) === 1) Atomics.notify(b, HEAD)
    return type
  }
}
