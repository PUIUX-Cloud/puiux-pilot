/**
 * Logger — wraps stdout/stderr output.
 * Uses process.stdout.write to avoid linter console.log stripping.
 */

export function print(msg: string): void {
  process.stdout.write(msg + "\n");
}

export function printError(msg: string): void {
  process.stderr.write(msg + "\n");
}
