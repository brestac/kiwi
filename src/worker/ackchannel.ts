/**
 * File de callbacks acquittés par le worker au moyen d'un mot partagé (Atomics), sans postMessage.
 *
 * Chaque commande envoyée avec un callback reçoit un id croissant (1, 2, 3...). Quand le worker a traité la
 * commande, il écrit son id dans `ack[index]` puis appelle Atomics.notify. L'écriture est monotone : un
 * acquittement `n` vaut pour tous les ids <= n. Plusieurs callbacks en attente, ou des acquittements fusionnés
 * (par exemple les updateVariables() limités en fréquence), sont donc tous honorés, une fois chacun et dans l'ordre.
 *
 * Le worker doit écrire les valeurs qu'il publie AVANT d'écrire l'acquittement : à l'appel du callback, elles
 * sont alors visibles avec Atomics.load.
 * @private
 */
export class AckChannel {
	private seq = 0
	private ids: number[] = []
	private callbacks: Array<() => void> = []
	private head = 0
	private listening = false

	/**
	 * @param ack Mots d'acquittement partagés avec le worker.
	 * @param index Mot de `ack` propre à ce canal.
	 * @param before Appelé avant chaque série de callbacks : permet de garantir qu'un autre canal (acquitté plus
	 * tôt par le worker) a déjà livré les siens.
	 */
	constructor(
		private ack: Int32Array,
		private index: number,
		private before?: () => void,
	) {}

	/**
	 * Attribue un id à `callback` et le passe à `send`, qui doit envoyer la commande au worker. Si `send` lève
	 * une exception (par exemple commande trop grande pour la file), le callback n'est pas enregistré.
	 */
	register(callback: () => void, send: (id: number) => void): void {
		let id = (this.seq + 1) | 0
		if (id === 0) id = 1 // 0 signifie "aucun acquittement"
		send(id)
		this.seq = id
		this.ids.push(id)
		this.callbacks.push(callback)
		this.listen()
	}

	/** Livre tout de suite les callbacks déjà acquittés (sans attendre). */
	poll(): void {
		this.drain(Atomics.load(this.ack, this.index))
	}

	private listen(): void {
		if (this.listening) return
		this.listening = true
		this.check()
	}

	private check = (): void => {
		this.before?.()
		const last = Atomics.load(this.ack, this.index)
		this.drain(last)

		if (this.head === this.ids.length) {
			// Plus rien en attente : on cesse d'écouter (aucun coût au repos).
			this.ids.length = 0
			this.callbacks.length = 0
			this.head = 0
			this.listening = false
			return
		}

		if (typeof Atomics.waitAsync === 'function') {
			const r = Atomics.waitAsync(this.ack, this.index, last)
			if (r.async) r.value.then(this.check)
			else queueMicrotask(this.check) // la valeur a déjà changé
		} else {
			setTimeout(this.check, 1) // repli pour les navigateurs sans Atomics.waitAsync
		}
	}

	private drain(last: number): void {
		// Comparaison modulo 2^32 : reste correcte si les ids dépassent 2^31.
		while (this.head < this.ids.length && ((last - this.ids[this.head]) | 0) >= 0) {
			const callback = this.callbacks[this.head++]
			try {
				callback()
			} catch (error) {
				queueMicrotask(() => {
					throw error // une exception du callback ne doit pas bloquer les suivants
				})
			}
		}

		if (this.head > 1024 && this.head * 2 > this.ids.length) {
			this.ids.splice(0, this.head)
			this.callbacks.splice(0, this.head)
			this.head = 0
		}
	}
}
