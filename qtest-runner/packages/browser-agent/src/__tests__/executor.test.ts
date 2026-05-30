import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeStep, StepCommand } from '../executor';

const {
  mockNavigate, mockClickElement, mockClickElementAt, mockFillField, mockVerifyText,
  mockSwitchToPage, mockGetPages, mockTakeScreenshot, mockGetSession,
  mockGetSessionIdForProfile, mockGetPendingActions,
} = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockClickElement: vi.fn(),
  mockClickElementAt: vi.fn(),
  mockFillField: vi.fn(),
  mockVerifyText: vi.fn(),
  mockSwitchToPage: vi.fn(),
  mockGetPages: vi.fn(),
  mockTakeScreenshot: vi.fn(),
  mockGetSession: vi.fn(),
  mockGetSessionIdForProfile: vi.fn(),
  mockGetPendingActions: vi.fn(),
}));

vi.mock('../browser-manager', () => ({
  getSession: mockGetSession,
  navigate: mockNavigate,
  clickElement: mockClickElement,
  clickElementAt: mockClickElementAt,
  fillField: mockFillField,
  verifyText: mockVerifyText,
  switchToPage: mockSwitchToPage,
  getPages: mockGetPages,
  takeScreenshot: mockTakeScreenshot,
}));

vi.mock('../recorder', () => ({
  getSessionIdForProfile: mockGetSessionIdForProfile,
  getPendingActions: mockGetPendingActions,
}));

function makeMockPage() {
  const mockLocator = { dragTo: vi.fn().mockResolvedValue(undefined) };
  const mockFrame = {
    click: vi.fn().mockResolvedValue(undefined),
    fill: vi.fn().mockResolvedValue(undefined),
    dblclick: vi.fn().mockResolvedValue(undefined),
    selectOption: vi.fn().mockResolvedValue(undefined),
    evaluate: vi.fn().mockResolvedValue(undefined),
    waitForSelector: vi.fn().mockResolvedValue(undefined),
    setInputFiles: vi.fn().mockResolvedValue(undefined),
    hover: vi.fn().mockResolvedValue(undefined),
    locator: vi.fn(() => mockLocator),
    name: vi.fn(() => 'frame1'),
    url: vi.fn(() => 'https://frame.com'),
    inputValue: vi.fn().mockResolvedValue('test-val'),
    isChecked: vi.fn().mockResolvedValue(true),
    $: vi.fn(),
  };
  const page = {
    evaluate: vi.fn().mockResolvedValue(undefined),
    keyboard: { press: vi.fn().mockResolvedValue(undefined) },
    mouse: { wheel: vi.fn().mockResolvedValue(undefined) },
    touchscreen: { tap: vi.fn().mockResolvedValue(undefined) },
    frame: vi.fn(() => null),
    frames: vi.fn(() => []),
    url: vi.fn(() => 'https://example.com'),
    locator: vi.fn(() => mockLocator),
    click: vi.fn().mockResolvedValue(undefined),
    fill: vi.fn().mockResolvedValue(undefined),
    dblclick: vi.fn().mockResolvedValue(undefined),
    selectOption: vi.fn().mockResolvedValue(undefined),
    waitForSelector: vi.fn().mockResolvedValue(undefined),
    setInputFiles: vi.fn().mockResolvedValue(undefined),
    hover: vi.fn().mockResolvedValue(undefined),
    inputValue: vi.fn().mockResolvedValue('test-val'),
    isChecked: vi.fn().mockResolvedValue(true),
    $: vi.fn(),
  };
  return { page, mockFrame, mockLocator };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSessionIdForProfile.mockReturnValue('session-1');
  mockGetPendingActions.mockReturnValue([]);
  mockTakeScreenshot.mockResolvedValue('base64:ss');
  mockVerifyText.mockResolvedValue(true);
  mockSwitchToPage.mockReturnValue({ bringToFront: vi.fn().mockResolvedValue(undefined), url: vi.fn(() => 'https://tab2.com') });
  mockGetPages.mockReturnValue([]);
});

async function run(cmd: StepCommand) {
  const { page } = makeMockPage();
  mockGetSession.mockReturnValue({ page });
  return { result: await executeStep('p1', cmd), page };
}

async function runWithFrame(cmd: StepCommand) {
  const { page, mockFrame } = makeMockPage();
  page.frame.mockImplementation((opts: any) => {
    if (opts && opts.name === 'f1') return mockFrame;
    return null;
  });
  mockGetSession.mockReturnValue({ page });
  return { result: await executeStep('p1', cmd), page, mockFrame };
}

// ── Navigate ──
describe('navigate', () => {
  it('calls navigate with url', async () => {
    mockNavigate.mockResolvedValue(undefined);
    const { result } = await run({ action: 'navigate', url: 'https://x.com' });
    expect(result.status).toBe('passed');
    expect(mockNavigate).toHaveBeenCalledWith(expect.anything(), 'https://x.com');
  });

  it('fails without url', async () => {
    const { result } = await run({ action: 'navigate' });
    expect(result.status).toBe('failed');
  });
});

// ── Click ──
describe('click', () => {
  it('calls clickElement with selector', async () => {
    mockClickElement.mockResolvedValue(undefined);
    const { result } = await run({ action: 'click', selector: '#btn' });
    expect(result.status).toBe('passed');
    expect(mockClickElement).toHaveBeenCalledWith(expect.anything(), '#btn');
  });

  it('fails without selector', async () => {
    const { result } = await run({ action: 'click' });
    expect(result.status).toBe('failed');
  });

  it('calls clickElementAt with coordinates', async () => {
    mockClickElementAt.mockResolvedValue(undefined);
    const { result } = await run({ action: 'click', selector: '#canvas', x: 100, y: 200 });
    expect(result.status).toBe('passed');
    expect(mockClickElementAt).toHaveBeenCalledWith(expect.anything(), '#canvas', 100, 200);
  });

  it('clicks inside frame when resolved', async () => {
    const { result, mockFrame } = await runWithFrame({ action: 'click', selector: '#btn', frameName: 'f1' });
    expect(result.status).toBe('passed');
    expect(mockFrame.click).toHaveBeenCalledWith('#btn');
  });
});

// ── DblClick ──
describe('dblclick', () => {
  it('calls dblclick on page', async () => {
    const { result, page } = await run({ action: 'dblclick', selector: '#btn' });
    expect(result.status).toBe('passed');
    expect(page.dblclick).toHaveBeenCalledWith('#btn', { timeout: 10000 });
  });

  it('fails without selector', async () => {
    const { result } = await run({ action: 'dblclick' });
    expect(result.status).toBe('failed');
  });
});

// ── RightClick ──
describe('rightClick', () => {
  it('calls click with right button on page', async () => {
    const { result, page } = await run({ action: 'rightClick', selector: '#btn' });
    expect(result.status).toBe('passed');
    expect(page.click).toHaveBeenCalledWith('#btn', { button: 'right', timeout: 10000 });
  });

  it('accepts contextmenu alias', async () => {
    const { result, page } = await run({ action: 'contextmenu', selector: '#btn' });
    expect(result.status).toBe('passed');
    expect(page.click).toHaveBeenCalledWith('#btn', { button: 'right', timeout: 10000 });
  });
});

// ── Fill ──
describe('fill', () => {
  it('calls fillField on page', async () => {
    mockFillField.mockResolvedValue(undefined);
    const { result } = await run({ action: 'fill', selector: '#input', value: 'hello' });
    expect(result.status).toBe('passed');
    expect(mockFillField).toHaveBeenCalledWith(expect.anything(), '#input', 'hello');
  });

  it('fails without selector', async () => {
    const { result } = await run({ action: 'fill', value: 'x' });
    expect(result.status).toBe('failed');
  });

  it('fails without value', async () => {
    const { result } = await run({ action: 'fill', selector: '#i' });
    expect(result.status).toBe('failed');
  });

  it('fills inside frame when resolved', async () => {
    const { result, mockFrame } = await runWithFrame({ action: 'fill', selector: '#input', value: 'hi', frameName: 'f1' });
    expect(result.status).toBe('passed');
    expect(mockFrame.fill).toHaveBeenCalledWith('#input', 'hi');
  });
});

// ── Select ──
describe('select', () => {
  it('calls selectOption on ctx', async () => {
    const { result, page } = await run({ action: 'select', selector: '#sel', value: 'opt1' });
    expect(result.status).toBe('passed');
    expect(page.selectOption).toHaveBeenCalledWith('#sel', 'opt1');
  });
});

// ── Keypress ──
describe('keypress', () => {
  it('presses the given key', async () => {
    const { result, page } = await run({ action: 'keypress', value: 'Tab' });
    expect(result.status).toBe('passed');
    expect(page.keyboard.press).toHaveBeenCalledWith('Tab');
  });

  it('defaults to Enter', async () => {
    const { result, page } = await run({ action: 'keypress' });
    expect(page.keyboard.press).toHaveBeenCalledWith('Enter');
  });
});

// ── Drag ──
describe('drag', () => {
  it('calls dragTo on locator', async () => {
    const { result, page } = await run({ action: 'drag', selector: '#src', value: '#dst' });
    expect(result.status).toBe('passed');
    expect(page.locator).toHaveBeenCalledWith('#src');
  });

  it('fails without target', async () => {
    const { result } = await run({ action: 'drag', selector: '#src' });
    expect(result.status).toBe('failed');
  });
});

// ── Scroll ──
describe('scroll', () => {
  it('calls evaluate with scrollBy', async () => {
    const { result, page } = await run({ action: 'scroll' });
    expect(result.status).toBe('passed');
    expect(page.evaluate).toHaveBeenCalled();
  });
});

// ── Wait ──
describe('wait', () => {
  it('waits for specified seconds', async () => {
    const start = Date.now();
    const { result } = await run({ action: 'wait', value: '1' });
    expect(result.status).toBe('passed');
    expect(Date.now() - start).toBeGreaterThanOrEqual(900);
  });
});

// ── Hover ──
describe('hover', () => {
  it('calls hover on ctx', async () => {
    const { result, page } = await run({ action: 'hover', selector: '#el' });
    expect(result.status).toBe('passed');
    expect(page.hover).toHaveBeenCalledWith('#el', { timeout: 10000 });
  });
});

// ── Wheel ──
describe('wheel', () => {
  it('calls mouse.wheel', async () => {
    const { result, page } = await run({ action: 'wheel', deltaY: 50 });
    expect(result.status).toBe('passed');
    expect(page.mouse.wheel).toHaveBeenCalledWith(0, 50);
  });

  it('defaults to deltaY 100', async () => {
    const { result, page } = await run({ action: 'wheel' });
    expect(page.mouse.wheel).toHaveBeenCalledWith(0, 100);
  });
});

// ── Touch ──
describe('touch', () => {
  it('calls touchscreen.tap', async () => {
    const { result, page } = await run({ action: 'touch', x: 10, y: 20 });
    expect(result.status).toBe('passed');
    expect(page.touchscreen.tap).toHaveBeenCalledWith(10, 20);
  });

  it('defaults to 0,0', async () => {
    const { result, page } = await run({ action: 'touch' });
    expect(page.touchscreen.tap).toHaveBeenCalledWith(0, 0);
  });
});

// ── FileUpload ──
describe('fileUpload', () => {
  it('calls setInputFiles with file path', async () => {
    const { result, page } = await run({ action: 'fileUpload', selector: '#file', file: '/path/f.txt' });
    expect(result.status).toBe('passed');
    expect(page.setInputFiles).toHaveBeenCalledWith('#file', '/path/f.txt');
  });

  it('clears files when no file given', async () => {
    const { result, page } = await run({ action: 'fileUpload', selector: '#file' });
    expect(page.setInputFiles).toHaveBeenCalledWith('#file', []);
  });
});

// ── WaitForSelector ──
describe('waitForSelector', () => {
  it('calls waitForSelector on ctx', async () => {
    const { result, page } = await run({ action: 'waitForSelector', selector: '#btn' });
    expect(result.status).toBe('passed');
    expect(page.waitForSelector).toHaveBeenCalledWith('#btn', { timeout: 15000, state: 'visible' });
  });

  it('supports hidden state', async () => {
    const { result, page } = await run({ action: 'waitForSelector', selector: '#btn', value: 'hidden' });
    expect(page.waitForSelector).toHaveBeenCalledWith('#btn', { timeout: 15000, state: 'hidden' });
  });
});

// ── Verify ──
describe('verify', () => {
  it('returns passed when text found', async () => {
    mockVerifyText.mockResolvedValue(true);
    const { result } = await run({ action: 'verify', text: 'hello' });
    expect(result.status).toBe('passed');
  });

  it('returns failed when text not found', async () => {
    mockVerifyText.mockResolvedValue(false);
    const { result } = await run({ action: 'verify', text: 'missing' });
    expect(result.status).toBe('failed');
    expect(result.error).toContain('missing');
  });

  it('fails without text', async () => {
    const { result } = await run({ action: 'verify' });
    expect(result.status).toBe('failed');
  });
});

// ── Assertions ──
describe('assertText', () => {
  it('passes when text is found', async () => {
    mockVerifyText.mockResolvedValue(true);
    const { result } = await run({ action: 'assertText', text: 'hello' });
    expect(result.status).toBe('passed');
  });

  it('fails when text not found', async () => {
    mockVerifyText.mockResolvedValue(false);
    const { result } = await run({ action: 'assertText', text: 'missing' });
    expect(result.status).toBe('failed');
  });
});

describe('assertVisible', () => {
  it('passes when selector is visible', async () => {
    const { result } = await run({ action: 'assertVisible', selector: '#btn' });
    expect(result.status).toBe('passed');
  });

  it('fails without selector', async () => {
    const { result } = await run({ action: 'assertVisible' });
    expect(result.status).toBe('failed');
  });
});

describe('assertValue', () => {
  it('passes when value matches', async () => {
    const { result, page } = await run({ action: 'assertValue', selector: '#input', value: 'test-val' });
    expect(result.status).toBe('passed');
    expect(page.inputValue).toHaveBeenCalledWith('#input');
  });

  it('fails when value differs', async () => {
    const { page } = makeMockPage();
    page.inputValue = vi.fn().mockResolvedValue('other');
    mockGetSession.mockReturnValue({ page });
    const result = await executeStep('p1', { action: 'assertValue', selector: '#input', value: 'expected' });
    expect(result.status).toBe('failed');
  });
});

describe('assertChecked', () => {
  it('passes when checked', async () => {
    const { result } = await run({ action: 'assertChecked', selector: '#chk' });
    expect(result.status).toBe('passed');
  });
});

describe('assertUrl', () => {
  it('passes when url contains expected text', async () => {
    const { result } = await run({ action: 'assertUrl', text: 'example' });
    expect(result.status).toBe('passed');
  });

  it('fails when url does not contain text', async () => {
    const { page } = makeMockPage();
    page.url = vi.fn(() => 'https://other.com');
    mockGetSession.mockReturnValue({ page });
    const result = await executeStep('p1', { action: 'assertUrl', text: 'example' });
    expect(result.status).toBe('failed');
  });
});

// ── Tab management ──
describe('switchTab', () => {
  it('calls switchToPage', async () => {
    const { result } = await run({ action: 'switchTab', value: '2' });
    expect(result.status).toBe('passed');
    expect(mockSwitchToPage).toHaveBeenCalledWith('p1', '2');
  });

  it('fails when tab not found', async () => {
    mockSwitchToPage.mockReturnValue(null);
    const { result } = await run({ action: 'switchTab', value: '99' });
    expect(result.status).toBe('failed');
  });
});

describe('listTabs', () => {
  it('returns tab list', async () => {
    mockGetPages.mockReturnValue([
      { url: () => 'https://tab1.com' },
      { url: () => 'https://tab2.com' },
    ]);
    const { result } = await run({ action: 'listTabs' });
    expect(result.status).toBe('passed');
    expect(result.value).toContain('https://tab1.com');
  });
});

// ── Screenshot ──
describe('screenshot', () => {
  it('calls takeScreenshot', async () => {
    const { result } = await run({ action: 'screenshot' });
    expect(result.status).toBe('passed');
    expect(result.screenshot).toBe('base64:ss');
  });
});

// ── Error handling ──
describe('error handling', () => {
  it('returns failed for unknown action', async () => {
    const { result } = await run({ action: 'bogus' as any });
    expect(result.status).toBe('failed');
  });

  it('returns failed when session not found', async () => {
    mockGetSession.mockReturnValue(null);
    const result = await executeStep('p1', { action: 'click', selector: '#btn' });
    expect(result.status).toBe('failed');
    expect(result.error).toContain('Session');
  });

  it('catches exceptions and returns failed', async () => {
    const { page } = makeMockPage();
    page.dblclick = vi.fn().mockRejectedValue(new Error('timeout'));
    mockGetSession.mockReturnValue({ page });
    const result = await executeStep('p1', { action: 'dblclick', selector: '#btn' });
    expect(result.status).toBe('failed');
    expect(result.error).toContain('timeout');
  });
});

// ── Frame resolution ──
describe('frame resolution', () => {
  it('resolves frame by name and routes commands to it', async () => {
    mockFillField.mockResolvedValue(undefined);
    const { result, mockFrame } = await runWithFrame({ action: 'fill', selector: '#input', value: 'hi', frameName: 'f1' });
    expect(result.status).toBe('passed');
    expect(mockFrame.fill).toHaveBeenCalledWith('#input', 'hi');
  });

  it('falls back to main page when frame not found', async () => {
    mockFillField.mockResolvedValue(undefined);
    const { page } = makeMockPage();
    page.frame.mockReturnValue(null);
    mockGetSession.mockReturnValue({ page });
    const result = await executeStep('p1', { action: 'fill', selector: '#input', value: 'hi', frameName: 'nonexistent' });
    expect(result.status).toBe('passed');
    expect(mockFillField).toHaveBeenCalled();
  });
});
