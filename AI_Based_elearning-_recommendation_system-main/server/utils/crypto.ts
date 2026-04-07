import bcrypt from "bcrypt";

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 12);
}

export function verifyPassword(input: string, hash: string): boolean {
  return bcrypt.compareSync(input, hash);
}
