export enum SolverCommand {
  INIT = 1,
  ADD_CONSTRAINTS,
  REMOVE_CONSTRAINTS,
  UPDATE_STRENGTH,
  UPDATE_CONSTANT,
  UPDATE_VARIABLES,
  ADD_EDIT_VARIABLE,
  REMOVE_EDIT_VARIABLE,
  SUGGEST_VALUE,
  TIME,
  PRINT,
}

/** Bit ajouté au type d'une commande envoyée avec un callback : le dernier mot du payload est l'id à acquitter. */
export const ACK_FLAG = 0x100

/** Mots d'acquittement partagés (voir AckChannel). */
export const ACK_DONE = 0 // commande traitée par le solveur
export const ACK_UPDATED = 1 // updateVariables() exécuté : les valeurs sont publiées
export const ACK_WORDS = 2
