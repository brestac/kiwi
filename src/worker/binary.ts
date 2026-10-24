import { Variable } from '../variable.js'
import { Expression } from '../expression.js'
import { Constraint } from '../constraint.js'
import { SymbolicWeight } from '../symbolicweight.js'

export const COMMAND_DATA_LENGTH = 1 << 16    // 65 536

type Encodable = Constraint | Expression | Variable

class BinaryCoder {
	constructor(protected _buffer: ArrayBuffer) {
		this._dataView = new DataView(_buffer)
	}

	protected _dataView: DataView
	protected _byteOffset: number = 0

	public buffer() {
		return this._buffer
	}

	public moveOffset(offset: number): void {
		this._byteOffset += offset
	}

	public resize(bytesPerElement: number): void {
		const size = Math.ceil(this._byteOffset / bytesPerElement) * bytesPerElement

		if (size !== this._buffer.byteLength) {
			this._buffer.resize(size)
		}
	}

	public getInt32Array(): Int32Array {
		this.resize(Int32Array.BYTES_PER_ELEMENT)

		return new Int32Array(this._buffer)
	}
}

export class BinaryEncoder extends BinaryCoder {
	constructor() {
		const buffer = new ArrayBuffer(0, { maxByteLength: COMMAND_DATA_LENGTH })
		super(buffer)
	}

	private ensureOutputCapacity(size: number) {
		if (size > this._buffer.byteLength - this._byteOffset) {
			this._buffer.resize(this._byteOffset + size)
		}
	}

	public encodeString(value?: string): void {
		const length = Math.min(value ?.length ?? 0, 32)

		this.encodeUint8(length)

		if (length === 0) {
			return
		}

		const encoder = new TextEncoder();
		const u8Array = encoder.encode(value);

		for (let n = 0; n < length; n++) {
			this.encodeUint8(u8Array.at(n) as number)
		}
	}

	public encodeUint8(value: number): void {
		this.ensureOutputCapacity(Uint8Array.BYTES_PER_ELEMENT)
		this._dataView.setUint8(this._byteOffset, value)
		this._byteOffset += Uint8Array.BYTES_PER_ELEMENT
	}

	public encodeUint32(value: number): void {
		this.ensureOutputCapacity(Uint32Array.BYTES_PER_ELEMENT)
		this._dataView.setUint32(this._byteOffset, value)
		this._byteOffset += Uint32Array.BYTES_PER_ELEMENT
	}

	public encodeInt32(value: number): void {
		this.ensureOutputCapacity(Int32Array.BYTES_PER_ELEMENT)
		this._dataView.setInt32(this._byteOffset, value)
		this._byteOffset += Int32Array.BYTES_PER_ELEMENT
	}

	public encodeFloat64(value: number): void {
		this.ensureOutputCapacity(Float64Array.BYTES_PER_ELEMENT)
		this._dataView.setFloat64(this._byteOffset, value)
		this._byteOffset += Float64Array.BYTES_PER_ELEMENT
	}

	public encode(object: any): void {
		object.toBinary(this)
	}

	public encodeConstraints(constraints: Constraint[]): void {
		this.encodeUint32(constraints.length)
		for (let n = 0; n < constraints.length; n++) {
			this.encode(constraints[n])
		}
	}

	public encodeMany(objects: Array<Encodable>): void {
		this.encodeUint32(objects.length)

		for (let n = 0; n < objects.length; n++) {
			this.encode(objects[n])
		}
	}
}

export class BinaryDecoder extends BinaryCoder {
	constructor(buffer: ArrayBuffer) {
		super(buffer)
	}

	public decodeString(): string | undefined {
		const length = this.decodeUint8()

		if (length === 0) {
			return undefined
		}

		const decoder = new TextDecoder();
		let buffer = this._buffer.slice(this._byteOffset, this._byteOffset + length)
		let uint8Array = new Uint8Array(buffer)
		let value = decoder.decode(uint8Array);
		this._byteOffset += length

		return value
	}

	public decodeUint8(): number {
		const value = this._dataView.getUint8(this._byteOffset)
		this._byteOffset += Uint8Array.BYTES_PER_ELEMENT

		return value
	}

	public decodeUint32(): number {
		const value = this._dataView.getUint32(this._byteOffset)
		this._byteOffset += Uint32Array.BYTES_PER_ELEMENT

		return value
	}

	public decodeInt32(): number {
		const value = this._dataView.getInt32(this._byteOffset)
		this._byteOffset += Int32Array.BYTES_PER_ELEMENT

		return value
	}

	public decodeFloat64(): number {
		const value = this._dataView.getFloat64(this._byteOffset)
		this._byteOffset += Float64Array.BYTES_PER_ELEMENT

		return value
	}

	// public decode<T>(): T {
	//   return T.fromBinary(this)
	// }

	public decodeMany(cls: any): Array<Encodable> {
		let result: Encodable[] = []

		const size = this.decodeUint32()

		for (let n = 0; n < size; n++) {
			let decoded = cls.fromBinary(this)
			result.push(decoded)
		}

		return result
	}
}
