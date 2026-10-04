
export interface IMap<T extends {id(): number}, U> extends IndexedMap<T, U> {}
export interface FlatValuesMap<T extends {id(): number}, U> extends IndexedMap<T, U> {}

export function createMap<T extends {id(): number}, U>(): IMap<T, U> {
  return new IndexedMap<T, U>()
}

export function createFlatValuesMap<T extends {id(): number}, U>(values: Int32Array) {
  return new FlatValuesMap<T, U>(values)
}

class IndexedMap<T extends {id(): number}, U> {
  public index = {} as {[id: number]: number | undefined}
  public array = [] as Array<Pair<T, U>>

  /**
   * Returns the number of items in the array.
   */
  public size(): number {
    return this.array.length
  }

  /**
   * Returns true if the array is empty.
   */
  public empty(): boolean {
    return this.array.length === 0
  }

  /**
   * Returns the item at the given array index.
   *
   * @param index The integer index of the desired item.
   */
  public itemAt(index: number): Pair<T, U> {
    return this.array[index]
  }

  /**
   * Returns true if the key is in the array, false otherwise.
   *
   * @param key The key to locate in the array.
   */
  public contains(key: T) {
    return this.index[key.id()] !== undefined
  }

  /**
   * Returns the pair associated with the given key, or undefined.
   *
   * @param key The key to locate in the array.
   */
  public find(key: T) {
    const i = this.index[key.id()]
    return i === undefined ? undefined : this.array[i]
  }

  /**
   * Returns the pair associated with the key if it exists.
   *
   * If the key does not exist, a new pair will be created and
   * inserted using the value created by the given factory.
   *
   * @param key The key to locate in the array.
   * @param factory The function which creates the default value.
   */
  public setDefault(key: T, factory: () => U): Pair<T, U> {
    const i = this.index[key.id()]
    if (i === undefined) {
      const pair = new Pair(key, factory())
      this.index[key.id()] = this.array.length
      this.array.push(pair)
      return pair
    } else {
      return this.array[i]
    }
  }

  /**
   * Insert the pair into the array and return the pair.
   *
   * This will overwrite any existing entry in the array.
   *
   * @param key The key portion of the pair.
   * @param value The value portion of the pair.
   */
  public insert(key: T, value: U): Pair<T, U> {
    const pair = new Pair(key, value)
    const i = this.index[key.id()]
    if (i === undefined) {
      this.index[key.id()] = this.array.length
      this.array.push(pair)
    } else {
      this.array[i] = pair
    }
    return pair
  }

  /**
   * Removes and returns the pair for the given key, or undefined.
   *
   * @param key The key to remove from the map.
   */

  public erase(key: T): Pair<T, U> | undefined {
    const i = this.index[key.id()]
    if (i === undefined) {
      return undefined
    }
    this.index[key.id()] = undefined
    const pair = this.array[i]
    const last = this.array.pop()
    if (pair !== undefined && last !== undefined && pair !== last) {
      this.array[i] = last
      this.index[last.first.id()] = i
    }
    return pair
  }

  /**
   * Create a copy of this associative array.
   */
  public copy(): IndexedMap<T, U> {
    const copy = new IndexedMap<T, U>()
    for (let i = 0; i < this.array.length; i++) {
      const pair = this.array[i].copy()
      copy.array[i] = pair
      copy.index[pair.first.id()] = i
    }
    return copy
  }
}

export class FlatValuesMap<T extends {id(): number}, U> extends IndexedMap<T, U> {

  private _values : Int32Array

  constructor(values: Int32Array) {
    super()
    this._values = values
  }

  /**
   * @param key The key portion of the pair.
   * @param value The value portion of the pair.
   */
  public setDefault(key: T, factory: () => U): Pair<T, U> {
    const i = this.index[key.id()]

    if (i === undefined) {
      const pair = new Pair(key, factory())
      const size = this.array.length
      this.index[key.id()] = size
      this.array.push(pair)

      if (size > this._values.length) {
        let buffer = this._values.buffer as SharedArrayBuffer
        buffer.grow(size + 512)
      }

      this._values[size] = 0

      return pair
    } else {
      return this.array[i]
    }
  }

  public findValue(key: T): number | bigint | undefined {
    const i = this.index[key.id()]
    if (i == undefined) {
      return undefined
    }

    return Atomics.load(this._values, i)
  }

  public insertValueAt(value: number, index: number, notify: number = 0) : number | bigint {
    let newValue = Atomics.store(this._values, index, Math.round(value))

    if (notify == 1) {
      Atomics.notify(this._values, index, 1)
    }

    return newValue
  }
}

/**
 * A class which defines a generic pair object.
 * @private
 */
// tslint:disable: max-classes-per-file
class Pair<T, U> {
  /**
   * Construct a new Pair object.
   *
   * @param first The first item of the pair.
   * @param second The second item of the pair.
   */
  constructor(
    public first: T,
    public second: U,
  ) {}

  /**
   * Create a copy of the pair.
   */
  public copy() {
    return new Pair(this.first, this.second)
  }
}
