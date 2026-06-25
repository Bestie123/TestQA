import { v4 as uuid } from 'uuid';

export interface BrowserProfile {
  id: string;
  name: string;
  userDataDir: string;
  createdAt: string;
  lastUsed: string;
}

const profiles: Map<string, BrowserProfile> = new Map();

export function createProfile(name: string, userDataDir: string): BrowserProfile {
  const profile: BrowserProfile = {
    id: uuid(),
    name,
    userDataDir,
    createdAt: new Date().toISOString(),
    lastUsed: new Date().toISOString(),
  };
  profiles.set(profile.id, profile);
  return profile;
}

export function getProfile(id: string): BrowserProfile | undefined {
  return profiles.get(id);
}

export function listProfiles(): BrowserProfile[] {
  return Array.from(profiles.values());
}

export function deleteProfile(id: string): boolean {
  return profiles.delete(id);
}
