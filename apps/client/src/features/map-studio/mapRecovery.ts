/** A receipt for one explicit recovery GET, never a map edit's acknowledgement. */
export type MapRecoveryOutcome = { status: "received" } | { status: "failed"; reason: string };
export type MapRecoveryCallback = (outcome: MapRecoveryOutcome) => void;
