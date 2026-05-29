import { chromium, BrowserContext, Page, Frame } from 'playwright';
import { BrowserProfile } from './profile-manager';

interface Session {
  profileId: string;
  context: BrowserContext;
  page: Page;
  pages: Page[];
}

const sessions: Map<string, Session> = new Map();
export const videoDir = 'videos';

export async function launchSession(profile: BrowserProfile): Promise<Session> {
  // Ensure video directory exists
  try { require('fs').mkdirSync(videoDir, { recursive: true }); } catch {}
  const context = await chromium.launchPersistentContext(profile.userDataDir, {
    headless: false,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-first-run',
      '--no-default-browser-check',
    ],
    recordVideo: { dir: videoDir, size: { width: 1440, height: 900 } },
  });

  let pages = context.pages();
  const page = pages.length > 0 ? pages[0] : await context.newPage();
  await page.setViewportSize({ width: 1440, height: 900 });

  const session: Session = { profileId: profile.id, context, page, pages };
  context.on('page', (newPage) => {
    if (!session.pages.some(p => p === newPage)) {
      session.pages.push(newPage);
    }
    session.page = newPage;
    newPage.setViewportSize({ width: 1440, height: 900 }).catch(() => {});
  });
  sessions.set(profile.id, session);
  return session;
}

export function getSession(profileId: string): Session | undefined {
  return sessions.get(profileId);
}

export function switchToPage(profileId: string, indexOrUrl: string): Page | null {
  const session = sessions.get(profileId);
  if (!session) return null;
  session.pages = session.context.pages();
  if (session.pages.length === 0) return null;
  const idx = parseInt(indexOrUrl, 10);
  if (!isNaN(idx) && idx >= 0 && idx < session.pages.length) {
    session.page = session.pages[idx];
    return session.page;
  }
  const byUrl = session.pages.find(p => p.url().includes(indexOrUrl));
  if (byUrl) {
    session.page = byUrl;
    return byUrl;
  }
  return null;
}

export function getPages(profileId: string): Page[] {
  const session = sessions.get(profileId);
  if (!session) return [];
  session.pages = session.context.pages();
  return session.pages;
}

export async function closeSession(profileId: string): Promise<void> {
  const session = sessions.get(profileId);
  if (session) {
    await session.context.close().catch(() => {});
    sessions.delete(profileId);
  }
}

export async function closeAllSessions(): Promise<void> {
  for (const [id] of sessions) {
    await closeSession(id);
  }
}

export async function navigate(page: Page, url: string): Promise<void> {
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
  } catch {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
  }
}

export async function clickElement(page: Page, selector: string): Promise<void> {
  await page.click(selector, { timeout: 10000 });
}

export async function clickElementAt(page: Page, selector: string, x: number, y: number): Promise<void> {
  await page.click(selector, { timeout: 10000, position: { x, y } });
}

export async function fillField(page: Page, selector: string, value: string): Promise<void> {
  await page.fill(selector, value, { timeout: 10000 });
}

export async function takeScreenshot(page: Page): Promise<string> {
  const buffer = await page.screenshot({ type: 'png' });
  return buffer.toString('base64');
}

export async function saveVideo(page: Page, sessionId: string): Promise<string | null> {
  try {
    const video = page.video();
    if (!video) return null;
    const destPath = `${videoDir}/${sessionId}.webm`;
    await video.saveAs(destPath);
    return destPath;
  } catch { return null; }
}

export async function getVideoPath(page: Page): Promise<string | null> {
  try {
    const video = page.video();
    if (!video) return null;
    return await video.path();
  } catch { return null; }
}

export function listVideos(): string[] {
  try {
    const fs = require('fs');
    const files = fs.readdirSync(videoDir) as string[];
    return files.filter((f: string) => f.endsWith('.webm')).map((f: string) => `${videoDir}/${f}`);
  } catch { return []; }
}

export function deleteVideo(path: string): void {
  try { require('fs').unlinkSync(path); } catch {}
}

export async function verifyText(ctx: Page | Frame, text: string): Promise<boolean> {
  const body = await ctx.textContent('body');
  return body?.includes(text) ?? false;
}
