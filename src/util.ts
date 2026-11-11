export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** The JSON body of a response, or undefined when it is not JSON. */
export async function jsonBody(response: Response): Promise<unknown> {
  try {
    return await response.clone().json();
  } catch (error) {
    if (error instanceof SyntaxError) return undefined;
    throw error;
  }
}
