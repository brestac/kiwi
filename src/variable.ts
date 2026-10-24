import type {Expression} from './expression.js'

type Callback = (value: number, previousValue: number) => void
function newExpression(...args: any[]): Expression {
	const ctor = Variable._Expression
	if (ctor === undefined) throw new Error('Expression is not registered: import kiwi from its entry point')
	return new ctor(...args)
}
/**
 * The primary user constraint variable.
 *
 * @class
 * @param {String} [name=""] The name to associated with the variable.
 */
export class Variable {
	constructor(name: string = '') {
		this._name = name
	}

	/**
	 * Returns the unique id number of the variable.
	 * @private
	 */
	public id(): number {
		return this._id
	}

	/**
	 * Returns the name of the variable.
	 *
	 * @return {String} name of the variable
	 */
	public name(): string {
		return this._name
	}

	/**
	 * Set the name of the variable.
	 *
	 * @param {String} name Name of the variable
	 */
	public setName(name: string): void {
		this._name = name
	}

	/**
	 * Returns the user context object of the variable.
	 * @private
	 */
	public context(): any {
		return this._context
	}

	/**
	 * Set the user context object of the variable.
	 * @private
	 */
	public setContext(context: any): void {
		this._context = context
	}

	/**
	 * Returns the user owner string of the variable.
	 * @private
	 */
	public owner(): string | undefined {
		return this._owner
	}

	/**
	 * Set the user context object of the variable.
	 * @private
	 */
	public setOwner(owner: string): void {
		this._owner = owner
	}

	/**
	 * Returns the value of the variable.
	 *
	 * @return {Number} Calculated value
	 */
	public value(): number {
		return this._value
	}

	/**
	 * Set the value of the variable.
	 * @private
	 */
	public setValue(value: number): void {
		var previousValue = this._value
		this._value = value
		if (this._callback && previousValue !== value) {
			this._callback(value, previousValue)
		}
	}

	/**
	 * Set a callback for whenever the value changes.
	 *
	 * @param {function(number,number):void} callback to call whenever the variable value changes
	 */
	public subscribe(callback: Callback): void {
		this._callback = callback
	}

	/**
	 * Stops the variable from calling the callback when the variable value
	 * changes.
	 */
	public unsubscribe(): void {
		this._callback = undefined
	}

	/**
	 * Creates a new Expression by adding a number, variable or expression
	 * to the variable.
	 *
	 * @param {Number|Variable|Expression} value Value to add.
	 * @return {Expression} expression
	 */
	public plus(value: number | Variable | Expression): Expression {
		return newExpression(this, value)
	}

	/**
	 * Creates a new Expression by substracting a number, variable or expression
	 * from the variable.
	 *
	 * @param {Number|Variable|Expression} value Value to substract.
	 * @return {Expression} expression
	 */
	public minus(value: number | Variable | Expression): Expression {
		return newExpression(this, typeof value === 'number' ? -value : [-1, value])
	}

	/**
	 * Creates a new Expression by multiplying with a fixed number.
	 *
	 * @param {Number} coefficient Coefficient to multiply with.
	 * @return {Expression} expression
	 */
	public multiply(coefficient: number): Expression {
		return newExpression([coefficient, this])
	}

	/**
	 * Creates a new Expression by dividing with a fixed number.
	 *
	 * @param {Number} coefficient Coefficient to divide by.
	 * @return {Expression} expression
	 */
	public divide(coefficient: number): Expression {
		return newExpression([1 / coefficient, this])
	}

	/**
	 * Returns the JSON representation of the variable.
	 * @private
	 */
	public toJSON(): any {
		return {
			id: this._id,
			value: this._value,
			sharedVarIndex: this._sharedOutputIndex,
			notify: this._notify,
			name: this._name,
			context: this._context
		}
	}

	static fromJSON(json: any) : Variable {
		let variable = new Variable()
		variable._id = json.id
		variable._value = json.value
		variable._sharedOutputIndex = json.sharedVarIndex
		variable._notify = json.notify
		variable._name = json.name
		variable._context  = json.context

		return variable
	}

	public toBinary(): Int32Array {
		let size = 6
		let offset = 0
		let encoded_name : Int32Array = new Int32Array(0)
		let encoded_owner : Int32Array = new Int32Array(0)

		if (Variable.debug) {
			encoded_name = stringToInt32Array(this._name)
			encoded_owner = stringToInt32Array(this._owner)
			size += 2 + encoded_name.length + encoded_owner.length
		}

		let data: Int32Array = new Int32Array(size)

		data[offset++] = size
		data[offset++] = this._id
		data.set(floatToInt32(this._value), offset)
		offset += 2
		data[offset++] = this._sharedOutputIndex
		data[offset++] = this._notify

		if (Variable.debug) {
			data[offset++] = encoded_name.length
			data.set(encoded_name, offset)
			offset += encoded_name.length
			data[offset++] = encoded_owner.length
			data.set(encoded_owner, offset)
		}

		return data
	}

	static fromBinary(data: Int32Array) : Variable {
		let offset = 1
		let variable = new Variable()

		variable._id = data.at(offset++) as number
		variable._value = int32ToFloat(data.subarray(offset, offset + 2))
		offset += 2
		variable._sharedOutputIndex = data.at(offset++) as number
		variable._notify = data.at(offset++) as number

		if (Variable.debug) {
			const name_size = data.at(offset++) as number

			if (name_size > 0) {
				variable._name = int32ArrayToString(data.slice(offset, offset + name_size)) as string
				offset += name_size
			}

			const owner_size = data.at(offset++) as number

			if (owner_size > 0) {
				variable._owner = int32ArrayToString(data.slice(offset, offset + owner_size)) as string
			}
		}

		return variable
	}

	public toString(): string {
		const info = [this._owner, this._name].reduce((p : any, n: string | undefined) => {
			return (n?.length) ? [...p, n] : p
		}, []).join('.')

		return '[' + info + ':' + this._value + ']'
	}

	/** @private Renseigné par expression.ts. */
	static _Expression: (new (...args: any[]) => Expression) | undefined = undefined
	static debug: boolean = false

	private _name: string
	private _value: number = 0.0
	private _context: any = undefined
	private _owner?: string = undefined
	private _id: number = VarId++
	public _callback: Callback | undefined = undefined
}

/**
 * The internal variable id counter.
 * @private
 */
let VarId = 0

function stringToInt32Array(str?: string) : Int32Array {
		if (str == undefined) return new Int32Array(0)
		// 1. Encoder le string en octets UTF-8 (Uint8Array)
		const encoder = new TextEncoder();
		const u8Array = encoder.encode(str);

		// 2. Calculer le nombre d'éléments Int32 nécessaires (arrondi au supérieur)
		const int32Length = Math.ceil(u8Array.byteLength / 4);

		// 3. Créer un ArrayBuffer aligné sur 4 octets
		const buffer = new ArrayBuffer(int32Length * 4);

		// 4. Copier les octets du texte dans le buffer
		new Uint8Array(buffer).set(u8Array);

		// 5. Retourner la vue Int32Array
		return new Int32Array(buffer);
}

function int32ArrayToString(int32Array: Int32Array) : string | undefined {
		if (int32Array.length === 0) return undefined

		const u8Array = new Uint8Array(int32Array.buffer);

		// Partir de la fin pour trouver le dernier octet non nul
		let end = u8Array.length;
		while (end > 0 && u8Array[end - 1] === 0) {
				end--;
		}

		const decoder = new TextDecoder();
		return decoder.decode(u8Array.subarray(0, end));
}

export function floatToInt32(value: number) : Int32Array {
	const int_value = Math.trunc(value)
	const dec_value = Math.round((value - Math.trunc(value)) * Math.pow(10, 6))

	return new Int32Array([int_value, dec_value])
}

export function int32ToFloat(value: Int32Array) : number {
	const int_value = value.at(0) as number
	const dec_value = value.at(1) as number

	return Number((int_value + (dec_value / Math.pow(10, 6))).toFixed(6))
}
