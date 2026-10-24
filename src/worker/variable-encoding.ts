import { Variable } from "./Variable";

// 1. On informe TypeScript de la nouvelle méthode (Declaration Merging)
declare module "./Variable" {
  interface Variable {
    toBinary(): Int32Array;
  }
}

// 2. On ajoute l'implémentation JavaScript réelle sur le prototype
Variable.prototype.toBinary = function(this: Variable) {
  return new Int32Array(0)
};
