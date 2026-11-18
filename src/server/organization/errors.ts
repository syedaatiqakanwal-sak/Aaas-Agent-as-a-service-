export type OrganizationErrorCode =
  | "NOT_FOUND"
  | "FORBIDDEN"
  | "CONFLICT"
  | "VALIDATION"
  | "SUSPENDED";

export class OrganizationError extends Error {
  constructor(
    public readonly code: OrganizationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "OrganizationError";
  }
}
