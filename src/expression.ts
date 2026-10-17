import {createMap, IMap} from './maptype.js'
import {Variable} from './variable.js'

/**
 * An expression of variable terms and a constant.
 *
 * The constructor accepts an arbitrary number of parameters,
 * each of which must be one of the following types:
 *  - number
 *  - Variable
 *  - Expression
 *  - 2-tuple of [number, Variable|Expression]
 *
 * The parameters are summed. The tuples are multiplied.
 *
 * @class
 * @param {...(number|Variable|Expression|Array)} args
 */
export class Expression {
  constructor(...args: any[])
  constructor() {
    let parsed = parseArgs(arguments)
    this._terms = parsed.terms
    this._constant = parsed.constant
  }

  /**
   * Returns the mapping of terms in the expression.
   *
   * This *must* be treated as const.
   * @private
   */
  public terms(): IMap<Variable, number> {
    return this._terms
  }

  /**
   * Returns the constant of the expression.
   * @private
   */
  public constant(): number {
    return this._constant
  }

  /**
   * Set the constant of the expression.
   *
   * Intended to be called only via Constraint#setConstant when the
   * Solver incrementally updates a constraint's constant.
   * @private
   */
  public setConstant(constant: number): void {
    this._constant = constant
  }

  /**
   * Returns the computed value of the expression.
   *
   * @private
   * @return {Number} computed value of the expression
   */
  public value(): number {
    let result = this._constant
    for (let i = 0, n = this._terms.size(); i < n; i++) {
      let pair = this._terms.itemAt(i)
      result += pair.first.value() * pair.second
    }
    return result
  }

  /**
   * Creates a new Expression by adding a number, variable or expression
   * to the expression.
   *
   * @param {Number|Variable|Expression} value Value to add.
   * @return {Expression} expression
   */
  public plus(value: number | Variable | Expression): Expression {
    return new Expression(this, value)
  }

  /**
   * Creates a new Expression by substracting a number, variable or expression
   * from the expression.
   *
   * @param {Number|Variable|Expression} value Value to substract.
   * @return {Expression} expression
   */
  public minus(value: number | Variable | Expression): Expression {
    return new Expression(this, typeof value === 'number' ? -value : [-1, value])
  }

  /**
   * Creates a new Expression by multiplying with a fixed number.
   *
   * @param {Number} coefficient Coefficient to multiply with.
   * @return {Expression} expression
   */
  public multiply(coefficient: number): Expression {
    return new Expression([coefficient, this])
  }

  /**
   * Creates a new Expression by dividing with a fixed number.
   *
   * @param {Number} coefficient Coefficient to divide by.
   * @return {Expression} expression
   */
  public divide(coefficient: number): Expression {
    return new Expression([1 / coefficient, this])
  }

  public isConstant(): boolean {
    return this._terms.size() == 0
  }

  public toString(): string {
    let result = this._terms.array
      .map(function (pair) {
        return ((pair.second == 1.0) ? '' : pair.second + ' * ') + pair.first.toString()
      })
      .join(' + ')

    if (!this.isConstant() && this._constant !== 0) {
      result += (this._constant > 0) ? ' + ' : ' - '
      result += Math.abs(this._constant)
    }

    return result
  }


  /**
   * Returns the JSON representation of the expression.
   * @private
   */
  public toJSON(): any {
    return {
      terms: this._terms.array.map(pair => ({variable:pair.first.toJSON(), coefficient:pair.second})),
      constant: this._constant,
    }
  }

  static fromJSON(json: any) : Expression {
    let terms = createMap<Variable, number>()
    let json_terms = json.terms
    for (let i = 0; i < json_terms.length; i++) {
      let json_term = json_terms[i]
      let variable = Variable.fromJSON(json_term.variable)
      terms.insert(variable, json_term.coefficient)
    }

    let expression = new Expression()
    expression._terms = terms
    expression._constant = json.constant

    return expression
  }

  public toBinary(): Int32Array {
    const terms_array = this._terms.array.reduce((prev: any, pair: any) => {
      const variable_data = pair.first.toBinary()
      const coefficient = pair.second
      return [...prev, ...variable_data, coefficient]
    }, [])

    const nterms = this._terms.array.length
    return new Int32Array([nterms, ...terms_array, this._constant])
  }

  static fromBinary(data: Int32Array) {
    // if (data.length < 6) {
    //   throw new Error('Expression.fromBinary(data: Int32Array) : invalid data length: ' + data.length)
    // }

    const nterms = data.at(0) as number

    let terms = createMap<Variable, number>()
    let offset = 1
    let n = 0

    while (n < nterms && offset < data.length) {
      const variable_data_size = data.at(offset) as number
      const variable_data = data.slice(offset, offset + variable_data_size)
      const variable = Variable.fromBinary(variable_data)
      const coefficient = data.at(offset + variable_data_size) as number

      terms.insert(variable, coefficient)
      offset += variable_data_size + 1
      n++
    }

    let expression = new Expression()
    expression._terms = terms
    expression._constant = data.at(offset) as number

    return expression
  }

  private _terms: IMap<Variable, number>
  private _constant: number
}

Variable._Expression = Expression

/**
 * An internal interface for the argument parse results.
 */
interface IParseResult {
  terms: IMap<Variable, number>
  constant: number
}

/**
 * An internal argument parsing function.
 * @private
 */
function parseArgs(args: IArguments): IParseResult {
  let constant = 0.0
  let factory = () => 0.0
  let terms = createMap<Variable, number>()
  for (let i = 0, n = args.length; i < n; ++i) {
    let item = args[i]
    if (typeof item === 'number') {
      constant += item
    } else if (item instanceof Variable) {
      terms.setDefault(item, factory).second += 1.0
    } else if (item instanceof Expression) {
      constant += item.constant()
      let terms2 = item.terms()
      for (let j = 0, k = terms2.size(); j < k; j++) {
        let termPair = terms2.itemAt(j)
        terms.setDefault(termPair.first, factory).second += termPair.second
      }
    } else if (item instanceof Array) {
      if (item.length !== 2) {
        throw new Error('array must have length 2')
      }
      let value: number = item[0]
      let value2 = item[1]
      if (typeof value !== 'number') {
        throw new Error('array item 0 must be a number')
      }
      if (value2 instanceof Variable) {
        terms.setDefault(value2, factory).second += value
      } else if (value2 instanceof Expression) {
        constant += value2.constant() * value
        let terms2 = value2.terms()
        for (let j = 0, k = terms2.size(); j < k; j++) {
          let termPair = terms2.itemAt(j)
          terms.setDefault(termPair.first, factory).second += termPair.second * value
        }
      } else {
        throw new Error('array item 1 must be a variable or expression')
      }
    } else {
      throw new Error('invalid Expression argument: ' + item)
    }
  }
  return {terms, constant}
}
