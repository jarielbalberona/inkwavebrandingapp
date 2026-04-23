import argon2 from "argon2"

const argon2Options: argon2.Options & { raw?: false } = {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
}

export function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, argon2Options)
}

export function verifyPassword(hash: string, password: string): Promise<boolean> {
  return argon2.verify(hash, password)
}
