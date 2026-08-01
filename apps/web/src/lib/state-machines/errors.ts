export class InvalidTransitionError extends Error {
	constructor(entity: string, from: string, to: string) {
		super(`Invalid ${entity} transition: ${from} -> ${to}`);
		this.name = "InvalidTransitionError";
	}
}
