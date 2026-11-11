import type {Expression} from './expression.js'
import {BinaryDecoder, BinaryEncoder} from './worker/binary.js'

export type Callback = (value: number, previousValue: number) => void

interface VariableOptions {
	encodeName?: boolean,
	encodeOwner?: boolean
}

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
	constructor(nameOrOptions?: string | VariableOptions, options?:VariableOptions) {
		if (typeof nameOrOptions == 'object') {
			this._name = ''
			this._options = nameOrOptions
		} else {
			this._name = nameOrOptions ?? ''
			this._options = options
		}
	}

	public options() {
		return this._options
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

	public _setValue(value: number): void {
		this._value = value
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

	public sizeOf() : number {
			let byte_length = (4 /*size*/ + 4 /*_id*/ + 8 /*_value*/ + 4 /*_sharedOutputIndex*/ + 1 /*_notify*/ + 1 /*name length*/ + 1 /*owner length*/)
			if (this._options?.encodeName && this._name?.length) byte_length += this._name?.length??0
			if (this._options?.encodeOwner && this._owner?.length) byte_length += this._owner?.length??0

			return byte_length
	}

	public toBinary(encoder: BinaryEncoder) : void {
		encoder.encodeUint32(this.sizeOf())
		encoder.encodeUint32(this._id)
		encoder.encodeFloat64(this._value)
		encoder.encodeInt32(this._sharedOutputIndex)
		encoder.encodeUint8(this._notify)

		const name = this._options?.encodeName ? this._name : undefined
		const owner = this._options?.encodeOwner ? this._owner : undefined

		encoder.encodeString(name)
		encoder.encodeString(owner)
	}

	static fromBinary(decoder: BinaryDecoder) : Variable {
		let variable = new Variable()

		decoder.moveOffset(4)
		variable._id = decoder.decodeUint32()
		variable._value = decoder.decodeFloat64()
		variable._sharedOutputIndex = decoder.decodeInt32()
		variable._notify = decoder.decodeUint8()
		variable._name = decoder.decodeString()??''
		variable._owner = decoder.decodeString()

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
	private _options?: VariableOptions = undefined
	private _name: string
	private _value: number = 0.0
	private _context: any = undefined
	private _owner?: string = undefined
	private _id: number = VarId++
	public _callback: Callback | undefined = undefined
	public _sharedOutputIndex: number = -1
	public _notify: number = 0
}

/**
 * The internal variable id counter.
 * @private
 */
let VarId = 0
