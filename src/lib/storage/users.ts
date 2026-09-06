import { User } from '../types';
import { getStore, setStore } from './storage';

const KEY = 'users';

export function getUsers(): User[] {
  return getStore<User>(KEY);
}

export function getUserById(id: string): User | undefined {
  return getUsers().find(u => u.id === id);
}

export function getUserByEmail(email: string): User | undefined {
  return getUsers().find(u => u.email === email);
}

export function createUser(data: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): User {
  const users = getUsers();
  const user: User = {
    ...data,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  users.push(user);
  setStore(KEY, users);
  return user;
}

export function updateUser(id: string, data: Partial<User>): User | undefined {
  const users = getUsers();
  const idx = users.findIndex(u => u.id === id);
  if (idx === -1) return undefined;
  users[idx] = { ...users[idx], ...data, updatedAt: new Date().toISOString() };
  setStore(KEY, users);
  return users[idx];
}

export function deleteUser(id: string): boolean {
  const users = getUsers();
  const filtered = users.filter(u => u.id !== id);
  if (filtered.length === users.length) return false;
  setStore(KEY, filtered);
  return true;
}
