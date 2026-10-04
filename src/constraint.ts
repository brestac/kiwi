import {Expression} from './expression.js'
import {Strength} from './strength.js'
import {SymbolicWeight} from './symbolicweight.js'
import {Variable} from './variable.js'
import { LEVEL_COUNT } from './symbolicweight.js'
/**
 * An enum defining the linear constraint operators.
 *
 * |Value|Operator|Description|
 * |----|-----|-----|
 * |`Le`|<=|Less than equal|
 * |`Ge`|>=|Greater than equal|
 * |`Eq`|==|Equal|
 *
 * @enum {Number}
 */
export enum Operator {
  Le, // <=
  Ge, // >=
  Eq, // ==
}

/**
 * A linear constraint equation.
 *
 * A constraint equation is composed of an expression, an operator,
 * and a strength. The RHS of the equation is implicitly zero.
 *
 * @class
 * @param {Expression} expression The constraint expression (LHS).
 * @param {Operator} operator The equation operator.
 * @param {Expression} [rhs] Right hand side of the expression.
 * @param {SymbolicWeight} [strength=Strength.required] The strength of the constraint.
 */
export class Constraint {
  constructor(
    expression: Expression | Variable,
    operator: Operator,
    rhs?: Expression | Variable | number,
    strength: SymbolicWeight = Strength.required,
  ) {
    this._operator = operator
    this._strength = strength

    if (expression instanceof Variable) {
      expression = new Expression(expression)
    }

    if (rhs === undefined) {
      this._expression = expression
    } else {
      this._expression = expression.minus(rhs)
    }
  }

  /**
   * Returns the unique id number of the constraint.
   * @private
   */
  public id(): number {
    return this._id
  }

  /**
   * Returns the expression of the constraint.
   *
   * @return {Expression} expression
   */
  public expression(): Expression {
    return this._expression
  }

  /**
   * Returns the relational operator of the constraint.
   *
   * @return {Operator} linear constraint operator
   */
  public op(): Operator {
    return this._operator
  }

  /**
   * Returns the strength of the constraint.
   *
   * @return {SymbolicWeight} strength
   */
  public strength(): SymbolicWeight {
    return this._strength
  }

  /**
   * Set the strength of the constraint.
   *
   * Intended to be called only by the Solver when incrementally
   * updating a non-required constraint's strength.
   * @private
   */
  public setStrength(strength: SymbolicWeight): void {
    this._strength = strength
  }

  /**
   * Set the constant of the constraint's expression.
   *
   * Intended to be called only by the Solver when incrementally
   * updating a constraint already present in the solver.
   * @private
   */
  public setConstant(constant: number): void {
    this._expression.setConstant(constant)
  }

  public toString(): string {
    return (
      this._expression.toString() + ' ' + ['<=', '>=', '='][this._operator] + ' 0 ' + this._strength.toString()
    )
  }
  /**
   * Returns the JSON representation of the constraint.
   * @private
   */
  public toJSON(): any {
    return {
      expression: this._expression.toJSON(),
      operator: this._operator,
      strength: this._strength.toJSON(),
      id: this._id
    }
  }

  static fromJSON(json: any) : Constraint {
    let expression = Expression.fromJSON(json.expression)
    let operator = json.operator
    let strength = SymbolicWeight.fromJSON(json.strength)

    let constraint = new Constraint(expression, operator, undefined, strength)
    constraint._id = json.id

    return constraint
  }

  public toBinary() : Int32Array {
    const id = this._id
    const exp = this._expression.toBinary()
    const strength = this._strength.toBinary()
    const size = exp.length + strength.length + 3 // the full size of the packed array, including the size number

    return new Int32Array([size, id, this._operator, ...strength, ...exp])
  }

  static fromBinary(data: Int32Array) : Constraint {
    let size = data.at(0) as number
    let id = data.at(1) as number
    let operator = data.at(2) as number
    let strength = SymbolicWeight.fromBinary(data.slice(3, 3 + LEVEL_COUNT))
    let expression = Expression.fromBinary(data.slice(3 + LEVEL_COUNT, size))

    let constraint = new Constraint(expression, operator, undefined, strength)
    constraint._id = id

    return constraint
  }

  private _expression: Expression
  private _operator: Operator
  private _strength: SymbolicWeight
  private _id: number = CnId++
}

/**
 * The internal constraint id counter.
 * @private
 */
let CnId = 0
