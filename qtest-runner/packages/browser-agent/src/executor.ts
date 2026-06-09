/* eslint-disable no-empty */
import { Page } from 'playwright';
import { getSession, switchToPage, getPages } from './browser-manager';
import { navigate, clickElement, clickElementAt, fillField, takeScreenshot, verifyText } from './browser-manager';
import { getSessionIdForProfile, getPendingActions } from './recorder';

function recordStep(actionsRef: any[] | undefined, actionType: string, data: Record<string, any>) {
  if (!actionsRef) return;
  actionsRef.push({ ...data, actionType, timestamp: Date.now() });
}

export interface StepCommand {
  action: string;
  selector?: string;
  value?: string;
  url?: string;
  text?: string;
  key?: string;
  file?: string;
  deltaX?: number;
  deltaY?: number;
  x?: number;
  y?: number;
  duration?: number;
  frameUrl?: string;
  frameName?: string;
  frameSelector?: string;
}

export interface StepResult {
  status: 'passed' | 'failed';
  screenshot?: string;
  error?: string;
  value?: string;
}

function resolveFrame(page: Page, cmd: StepCommand): { page: Page, frame: any } {
  let frame: any = null;
  // Try exact match by name
  if (cmd.frameName) {
    try { frame = page.frame({ name: cmd.frameName }); } catch {}
  }
  // Try exact match by URL
  if (!frame && cmd.frameUrl) {
    try { frame = page.frame({ url: cmd.frameUrl }); } catch {}
  }
  // Try frameSelector
  if (!frame && cmd.frameSelector) {
    try { frame = page.frame({ url: cmd.frameSelector as any }); } catch {}
  }
  if (!frame && cmd.frameName) {
    try {
      for (const f of page.frames()) {
        if (f.name() === cmd.frameName) { frame = f; break; }
      }
    } catch {}
  }
  if (!frame && cmd.frameUrl) {
    try {
      for (const f of page.frames()) {
        const fu = f.url();
        if (fu && (fu === cmd.frameUrl || fu.startsWith(cmd.frameUrl) || fu.includes(cmd.frameUrl))) {
          frame = f; break;
        }
      }
    } catch {}
  }
  if (frame) {
    console.log(`[executor] resolved frame: name="${frame.name()}" url="${frame.url().slice(0,80)}" for cmd=${cmd.action}`);
    return { page: page, frame };
  }
  console.log(`[executor] frame NOT found: name=${cmd.frameName} url=${cmd.frameUrl?.slice(0,80)} — using main page for ${cmd.action}`);
  return { page, frame: null };
}

export async function executeStep(profileId: string, command: StepCommand): Promise<StepResult> {
  const session = getSession(profileId);
  if (!session) {
    return { status: 'failed', error: 'Session not found' };
  }

  const page: Page = session.page;
  const { frame } = resolveFrame(page, command);
  const ctx = frame || page;
  const sessionId = getSessionIdForProfile(profileId);
  // Capture direct reference to pendingActions — survives map deletions
  const pendingRef = sessionId ? getPendingActions(sessionId) : undefined;

  // Extract frame metadata for recordStep
  const frameMeta: Record<string, any> = {};
  if (command.frameName) { frameMeta.frameName = command.frameName; frameMeta.iframeAction = true; }
  if (command.frameUrl) { frameMeta.frameUrl = command.frameUrl; }
  if (command.frameSelector) { frameMeta.frameSelector = command.frameSelector; }

  // Collect recording data; recordStep is called after screenshot is taken
  let recordAction = ''; // eslint-disable-line no-useless-assignment
  let recordData: Record<string, any> = {}; // eslint-disable-line no-useless-assignment

  try {
    switch (command.action) {
      case 'navigate': {
        if (!command.url) return { status: 'failed', error: 'URL required' };
        await navigate(page, command.url);
        recordAction = 'navigate';
        recordData = { url: command.url, ...frameMeta };
        break;
      }
      case 'click': {
        if (!command.selector) return { status: 'failed', error: 'Selector required' };
        if (frame) {
          if (command.x !== undefined && command.y !== undefined) {
            await frame.click(command.selector, { position: { x: command.x, y: command.y } });
          } else {
            await frame.click(command.selector);
          }
        } else {
          if (command.x !== undefined && command.y !== undefined) {
            await clickElementAt(page, command.selector, command.x, command.y);
          } else {
            await clickElement(page, command.selector);
          }
        }
        recordAction = 'click';
        recordData = { selector: command.selector, x: command.x, y: command.y, ...frameMeta };
        break;
      }
      case 'dblclick': {
        if (!command.selector) return { status: 'failed', error: 'Selector required' };
        await ctx.dblclick(command.selector, { timeout: 10000 });
        recordAction = 'dblclick';
        recordData = { selector: command.selector, ...frameMeta };
        break;
      }
      case 'contextmenu':
      case 'rightClick': {
        if (!command.selector) return { status: 'failed', error: 'Selector required' };
        await ctx.click(command.selector, { button: 'right', timeout: 10000 });
        recordAction = 'contextmenu';
        recordData = { selector: command.selector, ...frameMeta };
        break;
      }
      case 'fill': {
        if (!command.selector || command.value === undefined) {
          return { status: 'failed', error: 'Selector and value required' };
        }
        if (frame) {
          await frame.fill(command.selector, command.value);
        } else {
          await fillField(page, command.selector, command.value);
        }
        recordAction = 'fill';
        recordData = { selector: command.selector, value: command.value, ...frameMeta };
        break;
      }
      case 'select': {
        if (!command.selector || command.value === undefined) {
          return { status: 'failed', error: 'Selector and value required' };
        }
        await ctx.selectOption(command.selector, command.value);
        recordAction = 'select';
        recordData = { selector: command.selector, value: command.value, ...frameMeta };
        break;
      }
      case 'check': {
        if (!command.selector) return { status: 'failed', error: 'Selector required' };
        await ctx.click(command.selector);
        recordAction = 'check';
        recordData = { selector: command.selector, ...frameMeta };
        break;
      }
      case 'keypress': {
        const key = command.value || 'Enter';
        await page.keyboard.press(key);
        recordAction = 'keypress';
        recordData = { key, selector: command.selector, ...frameMeta };
        break;
      }
      case 'drag': {
        if (!command.selector) return { status: 'failed', error: 'Source selector required' };
        const target = command.value || command.text;
        if (!target) return { status: 'failed', error: 'Target selector required for drag' };
        const sourceEl = ctx.locator(command.selector);
        const targetEl = ctx.locator(target);
        await sourceEl.dragTo(targetEl, { timeout: 10000 });
        recordAction = 'drag';
        recordData = { selector: command.selector, target, ...frameMeta };
        break;
      }
      case 'drop': {
        if (!command.selector) return { status: 'failed', error: 'Target selector required' };
        recordAction = 'drop';
        recordData = { selector: command.selector, ...frameMeta };
        break;
      }
      case 'scroll': {
        await ctx.evaluate(() => (globalThis as any).scrollBy(0, 300));
        recordAction = 'scroll';
        recordData = { selector: command.selector, value: command.value, ...frameMeta };
        break;
      }
      case 'wait': {
        const ms = parseInt(command.value || '2') * 1000;
        await new Promise(r => setTimeout(r, ms));
        recordAction = 'wait';
        recordData = { value: command.value, ...frameMeta };
        break;
      }
      case 'verify': {
        if (!command.text) return { status: 'failed', error: 'Text required' };
        const found = await verifyText(ctx, command.text);
        if (!found) return { status: 'failed', error: `Text "${command.text}" not found` };
        recordAction = 'verify';
        recordData = { text: command.text, ...frameMeta };
        break;
      }
      case 'hover': {
        if (!command.selector) return { status: 'failed', error: 'Selector required' };
        await ctx.hover(command.selector, { timeout: 10000 });
        recordAction = 'hover';
        recordData = { selector: command.selector, ...frameMeta };
        break;
      }
      case 'dragTo': {
        if (!command.selector) return { status: 'failed', error: 'Source selector required' };
        const target = command.value || command.text;
        if (!target) return { status: 'failed', error: 'Target selector required for drag' };
        const sourceEl = ctx.locator(command.selector);
        const targetEl = ctx.locator(target);
        await sourceEl.dragTo(targetEl, { timeout: 10000 });
        recordAction = 'drag';
        recordData = { selector: command.selector, target, ...frameMeta };
        break;
      }
      case 'wheel': {
        const dx = command.deltaX || 0;
        const dy = command.deltaY || 100;
        await page.mouse.wheel(dx, dy);
        recordAction = 'wheel';
        recordData = { deltaX: dx, deltaY: dy, ...frameMeta };
        break;
      }
      case 'touch': {
        await page.touchscreen.tap(command.x || 0, command.y || 0);
        recordAction = 'touch';
        recordData = { x: command.x, y: command.y, ...frameMeta };
        break;
      }
      case 'fileUpload':
      case 'setInputFiles': {
        if (!command.selector) return { status: 'failed', error: 'Selector required' };
        const filePath = command.file || command.value || '';
        if (filePath) {
          await ctx.setInputFiles(command.selector, filePath);
        } else {
          await ctx.setInputFiles(command.selector, []);
        }
        recordAction = 'fileUpload';
        recordData = { selector: command.selector, file: filePath, ...frameMeta };
        break;
      }
      case 'waitForSelector': {
        if (!command.selector) return { status: 'failed', error: 'Selector required' };
        await ctx.waitForSelector(command.selector, { timeout: 15000, state: command.value === 'hidden' ? 'hidden' : 'visible' });
        recordAction = 'waitForSelector';
        recordData = { selector: command.selector, ...frameMeta };
        break;
      }
      case 'assertText':
      case 'assertVisible':
      case 'assertValue':
      case 'assertChecked':
      case 'assertUrl': {
        let result = false;
        switch (command.action) {
          case 'assertText':
            result = await verifyText(ctx, command.text || '');
            break;
          case 'assertVisible':
            if (!command.selector) return { status: 'failed', error: 'Selector required' };
            await ctx.waitForSelector(command.selector, { state: 'visible', timeout: 10000 });
            result = true;
            break;
          case 'assertValue': {
            if (!command.selector) return { status: 'failed', error: 'Selector required' };
            const val = await ctx.inputValue(command.selector);
            result = val === (command.value || '');
            break;
          }
          case 'assertChecked':
            if (!command.selector) return { status: 'failed', error: 'Selector required' };
            result = await ctx.isChecked(command.selector);
            break;
          case 'assertUrl':
            result = page.url().includes(command.text || command.value || '');
            break;
        }
        if (!result) {
          return { status: 'failed', error: `Assertion failed: ${command.action} (selector=${command.selector}, expected=${command.text || command.value})` };
        }
        recordAction = command.action;
        recordData = { selector: command.selector, text: command.text, value: command.value, ...frameMeta };
        break;
      }
      case 'switchTab': {
        const target = command.value || command.selector || '0';
        const switched = switchToPage(profileId, target);
        if (!switched) return { status: 'failed', error: `Tab not found: ${target}` };
        await switched.bringToFront();
        recordAction = 'switchTab';
        recordData = { value: target, url: switched.url(), ...frameMeta };
        break;
      }
      case 'listTabs': {
        const allPages = getPages(profileId);
        const urls = allPages.map((p, i) => `${i}: ${p.url()}`);
        return { status: 'passed', screenshot: '', value: urls.join('\n') };
      }
      case 'screenshot': {
        const ss = await takeScreenshot(page);
        return { status: 'passed', screenshot: ss };
      }
      default:
        return { status: 'failed', error: `Unknown action: ${command.action}` };
    }

    const ss = await takeScreenshot(page);
    if (recordAction) {
      recordStep(pendingRef, recordAction, { ...recordData, screenshot: ss });
    }
    return { status: 'passed', screenshot: ss };
  } catch (err: any) {
    return { status: 'failed', error: err.message };
  }
}
