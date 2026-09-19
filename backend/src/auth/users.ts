import { randomUUID } from "node:crypto";
import { jsonTable } from "./fileStore";
import { hashPassword } from "./passwords";

export interface User {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  createdAt: string;
}

/** What the client is allowed to see. Never leaks passwordHash. */
export interface PublicUser {
  id: string;
  email: string;
  name: string;
}

const table = jsonTable<User>("users.json");

/** One canonical form, so Jay@x.com and jay@x.com are the same account. */
export const normalizeEmail = (email: string) => email.trim().toLowerCase();

export const toPublicUser = (u: User): PublicUser => ({
  id: u.id,
  email: u.email,
  name: u.name,
});

export async function findByEmail(email: string): Promise<User | null> {
  const target = normalizeEmail(email);
  const users = await table.readAll();
  return users.find((u) => u.email === target) ?? null;
}

export async function findById(id: string): Promise<User | null> {
  const users = await table.readAll();
  return users.find((u) => u.id === id) ?? null;
}

/** Returns null when the email is already taken. */
export async function createUser(input: {
  email: string;
  name: string;
  password: string;
}): Promise<User | null> {
  const email = normalizeEmail(input.email);
  const users = await table.readAll();
  if (users.some((u) => u.email === email)) return null;

  const user: User = {
    id: randomUUID(),
    email,
    name: input.name.trim(),
    passwordHash: await hashPassword(input.password),
    createdAt: new Date().toISOString(),
  };

  await table.writeAll([...users, user]);
  return user;
}
