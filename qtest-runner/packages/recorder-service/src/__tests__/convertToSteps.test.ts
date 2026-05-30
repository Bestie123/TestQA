import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import type { RecordedAction } from '../db';

// ── Hoisted: create in-memory DB before mock factories ──
const { memDbRef } = vi.hoisted(() => {
  // @ts-ignore – require is available in Node.js context
  const Database = require('better-sqlite3');
  const db = new Database(':memory:');
  return { memDbRef: { current: db } };
});

// ── Mock better-sqlite3 to return the in-memory DB ──
vi.mock('better-sqlite3', () => ({
  default: function () { return memDbRef.current; },
}));

// ── Import real functions AFTER mock ──
import { createSession, addAction, convertToSteps, getSession } from '../db';

// ── Helper: build action with defaults ──
function makeAction(overrides: Partial<RecordedAction>): Omit<RecordedAction, 'id' | 'sessionId' | 'index'> {
  const defaults: RecordedAction = {
    id: '',
    sessionId: '',
    actionType: 'click',
    selector: '',
    selectorText: '',
    value: '',
    url: '',
    pageTitle: '',
    tabId: '',
    screenshot: '',
    timestamp: new Date().toISOString(),
    index: 0,
    method: '',
    resourceType: '',
    postData: '',
    headers: '{}',
    status: 0,
    body: '',
    error: '',
    level: '',
    combo: '',
    modifiers: '',
    inputType: '',
    checked: false,
    optionIndex: 0,
    x: 0,
    y: 0,
    scrollY: 0,
    scrollMax: 0,
    shadowDom: false,
    displayValue: '',
    frameName: '',
    frameUrl: '',
    frameSelector: '',
    iframeAction: false,
    length: 0,
    selectionText: '',
  };
  return { ...defaults, ...overrides };
}

describe('convertToSteps', () => {
  let sessionId: string;

  beforeAll(() => {
    // Init schema by creating a throwaway session
    const init = createSession('__init__', '__init__');
    if (memDbRef.current) {
      memDbRef.current.exec('DELETE FROM recorded_actions');
      memDbRef.current.exec('DELETE FROM recording_sessions');
    }
  });

  beforeEach(() => {
    if (memDbRef.current) {
      try { memDbRef.current.exec('DELETE FROM recorded_actions'); } catch { /* skip if table missing */ }
      try { memDbRef.current.exec('DELETE FROM recording_sessions'); } catch { /* skip if table missing */ }
    }
    const session = createSession('test-session', 'profile-1');
    sessionId = session.id;
  });

  // ── Edge cases ──
  describe('edge cases', () => {
    it('returns empty array for non-existent session', () => {
      const steps = convertToSteps('nonexistent-id');
      expect(steps).toEqual([]);
    });

    it('returns empty array for session with no actions', () => {
      const steps = convertToSteps(sessionId);
      expect(steps).toEqual([]);
    });

    it('prepends navigate step if first action has URL but no navigate action', () => {
      addAction(sessionId, makeAction({ actionType: 'click', url: 'https://example.com', selectorText: 'button', selector: '#btn' }));
      const steps = convertToSteps(sessionId);
      expect(steps).toHaveLength(2);
      expect(steps[0].action).toContain('Перейти по URL https://example.com');
      expect(steps[1].action).toContain('Нажать');
    });

    it('does not prepend navigate if first action has no URL', () => {
      addAction(sessionId, makeAction({ actionType: 'click', url: '', selectorText: 'button', selector: '#btn' }));
      const steps = convertToSteps(sessionId);
      expect(steps).toHaveLength(1);
      expect(steps[0].action).not.toContain('Перейти');
    });

    it('preserves action order', () => {
      addAction(sessionId, makeAction({ actionType: 'click', selectorText: 'btn1', selector: '#b1', url: 'https://x.com' }));
      addAction(sessionId, makeAction({ actionType: 'click', selectorText: 'btn2', selector: '#b2' }));
      addAction(sessionId, makeAction({ actionType: 'click', selectorText: 'btn3', selector: '#b3' }));
      const steps = convertToSteps(sessionId);
      expect(steps).toHaveLength(4);
      expect(steps[1].action).toContain('btn1');
      expect(steps[2].action).toContain('btn2');
      expect(steps[3].action).toContain('btn3');
    });
  });

  // ── Navigation ──
  describe('navigate', () => {
    it('converts navigate action', () => {
      addAction(sessionId, makeAction({ actionType: 'navigate', url: 'https://example.com', pageTitle: 'Example' }));
      const steps = convertToSteps(sessionId);
      expect(steps).toHaveLength(1);
      expect(steps[0].action).toBe('Перейти по URL https://example.com');
      expect(steps[0].testData).toBe('https://example.com');
      expect(steps[0].expectedResult).toContain('Страница загружена');
      expect(steps[0].expectedResult).toContain('Example');
    });

    it('skips duplicate URL navigations', () => {
      addAction(sessionId, makeAction({ actionType: 'navigate', url: 'https://example.com' }));
      addAction(sessionId, makeAction({ actionType: 'navigate', url: 'https://example.com' }));
      addAction(sessionId, makeAction({ actionType: 'navigate', url: 'https://other.com' }));
      const steps = convertToSteps(sessionId);
      expect(steps).toHaveLength(2);
      expect(steps[0].action).toContain('https://example.com');
      expect(steps[1].action).toContain('https://other.com');
    });

    it('converts page_load as first action to navigate step', () => {
      addAction(sessionId, makeAction({ actionType: 'page_load', url: 'https://page.com', pageTitle: 'Page' }));
      addAction(sessionId, makeAction({ actionType: 'click', selectorText: 'btn', selector: '#b' }));
      const steps = convertToSteps(sessionId);
      expect(steps[0].action).toContain('Перейти по URL https://page.com');
      expect(steps[1].action).toContain('Нажать');
    });

    it('skips page_load if navigate already exists', () => {
      addAction(sessionId, makeAction({ actionType: 'navigate', url: 'https://first.com' }));
      addAction(sessionId, makeAction({ actionType: 'page_load', url: 'https://first.com' }));
      const steps = convertToSteps(sessionId);
      expect(steps).toHaveLength(1);
    });
  });

  // ── Click actions ──
  describe('click actions', () => {
    it('converts click', () => {
      addAction(sessionId, makeAction({ actionType: 'click', selectorText: 'Login', selector: '#login-btn' }));
      const steps = convertToSteps(sessionId);
      expect(steps[0].action).toBe('Нажать "Login" [selector=#login-btn]');
      expect(steps[0].expectedResult).toBe('Элемент активирован');
    });

    it('converts dblclick', () => {
      addAction(sessionId, makeAction({ actionType: 'dblclick', selectorText: 'Item', selector: '.item' }));
      const steps = convertToSteps(sessionId);
      expect(steps[0].action).toBe('Дважды нажать "Item" [selector=.item]');
    });

    it('converts canvas_click with coordinates', () => {
      addAction(sessionId, makeAction({ actionType: 'canvas_click', selectorText: 'Canvas', selector: '#canvas', x: 100, y: 200 }));
      const steps = convertToSteps(sessionId);
      expect(steps[0].action).toBe('Нажать на canvas "Canvas" по координатам (100, 200) [selector=#canvas]');
      expect(steps[0].testData).toBe('{"x":100,"y":200}');
    });
  });

  // ── Input actions ──
  describe('input actions', () => {
    it('converts fill', () => {
      addAction(sessionId, makeAction({ actionType: 'fill', selectorText: 'Username', selector: '#user', value: 'admin' }));
      const steps = convertToSteps(sessionId);
      expect(steps[0].action).toBe('Заполнить "Username" [selector=#user] = "admin"');
      expect(steps[0].testData).toBe('admin');
      expect(steps[0].expectedResult).toBe('Поле заполнено');
    });

    it('converts input similarly to fill', () => {
      addAction(sessionId, makeAction({ actionType: 'input', selectorText: 'Email', selector: '#email', value: 'a@b.com' }));
      const steps = convertToSteps(sessionId);
      expect(steps[0].action).toContain('Заполнить');
    });

    it('converts select with displayValue', () => {
      addAction(sessionId, makeAction({ actionType: 'select', selectorText: 'Country', selector: '#country', value: 'US' }));
      const steps = convertToSteps(sessionId);
      expect(steps[0].action).toBe('Выбрать "US" в "Country" [selector=#country]');
      expect(steps[0].displayValue).toBe('US');
      expect(steps[0].testData).toBe('US');
    });

    it('converts keypress Enter', () => {
      addAction(sessionId, makeAction({ actionType: 'keypress', selectorText: 'Search', selector: '#search', value: 'Enter' }));
      const steps = convertToSteps(sessionId);
      expect(steps[0].action).toBe('Нажать Enter на "Search" [selector=#search]');
    });

    it('converts keypress Tab', () => {
      addAction(sessionId, makeAction({ actionType: 'keypress', value: 'Tab' }));
      const steps = convertToSteps(sessionId);
      expect(steps[0].action).toBe('Нажать Tab');
      expect(steps[0].expectedResult).toBe('Фокус перемещён');
    });

    it('converts keypress Escape', () => {
      addAction(sessionId, makeAction({ actionType: 'keypress', value: 'Escape' }));
      const steps = convertToSteps(sessionId);
      expect(steps[0].action).toBe('Нажать Escape');
      expect(steps[0].expectedResult).toBe('Действие отменено');
    });

    it('converts keypress with combo', () => {
      addAction(sessionId, makeAction({ actionType: 'keypress', combo: 'Ctrl+C', selectorText: 'Input', selector: '#input' }));
      const steps = convertToSteps(sessionId);
      expect(steps[0].action).toContain('Нажать Ctrl+C на "Input"');
    });

    it('converts keypress default', () => {
      addAction(sessionId, makeAction({ actionType: 'keypress', value: 'ArrowDown' }));
      const steps = convertToSteps(sessionId);
      expect(steps[0].action).toBe('Нажать клавишу "ArrowDown"');
    });
  });

  // ── Check actions ──
  describe('check actions', () => {
    it('converts check with value=checked', () => {
      addAction(sessionId, makeAction({ actionType: 'check', selectorText: 'Agree', selector: '#agree', value: 'checked', inputType: 'checkbox' }));
      const steps = convertToSteps(sessionId);
      expect(steps[0].action).toBe('Отметить "Agree" [selector=#agree, type=checkbox]');
      expect(steps[0].expectedResult).toBe('Состояние: checked');
    });

    it('converts check with value=unchecked', () => {
      addAction(sessionId, makeAction({ actionType: 'check', selectorText: 'Notify', selector: '#notify', value: 'unchecked' }));
      const steps = convertToSteps(sessionId);
      expect(steps[0].action).toBe('Снять отметку "Notify" [selector=#notify, type=]');
    });
  });

  // ── Drag actions ──
  describe('drag actions', () => {
    it('converts dragstart + drop as pair', () => {
      addAction(sessionId, makeAction({ actionType: 'dragstart', selectorText: 'Source item', selector: '.source' }));
      addAction(sessionId, makeAction({ actionType: 'drop', selectorText: 'Target zone', selector: '.target' }));
      const steps = convertToSteps(sessionId);
      expect(steps).toHaveLength(1);
      expect(steps[0].action).toBe('Перетащить "Source item" в "Target zone"');
      expect(steps[0].expectedResult).toBe('Элемент перетащен');
    });

    it('converts drop without preceding dragstart', () => {
      addAction(sessionId, makeAction({ actionType: 'drop', selectorText: 'Drop zone', selector: '.drop' }));
      const steps = convertToSteps(sessionId);
      expect(steps[0].action).toBe('Перетащить элемент в "Drop zone"');
    });

    it('skips dragend action', () => {
      addAction(sessionId, makeAction({ actionType: 'dragend' }));
      const steps = convertToSteps(sessionId);
      expect(steps).toHaveLength(0);
    });

    it('converts drag action with value', () => {
      addAction(sessionId, makeAction({ actionType: 'drag', selectorText: 'Elem', selector: '.elem', value: '#target' }));
      const steps = convertToSteps(sessionId);
      expect(steps[0].action).toBe('Перетащить элемент "Elem" в "#target"');
    });
  });

  // ── Page actions ──
  describe('page actions', () => {
    it('converts submit', () => {
      addAction(sessionId, makeAction({ actionType: 'submit', selectorText: 'Login form', selector: '#login-form' }));
      const steps = convertToSteps(sessionId);
      expect(steps[0].action).toBe('Отправить форму "Login form"');
      expect(steps[0].expectedResult).toBe('Форма отправлена');
    });

    it('converts scroll', () => {
      addAction(sessionId, makeAction({ actionType: 'scroll', value: '500px' }));
      const steps = convertToSteps(sessionId);
      expect(steps[0].action).toBe('Прокрутить страницу до 500px');
    });

    it('converts contextmenu', () => {
      addAction(sessionId, makeAction({ actionType: 'contextmenu', selectorText: 'Item', selector: '.item', x: 10, y: 20 }));
      const steps = convertToSteps(sessionId);
      expect(steps[0].action).toBe('Нажать правой кнопкой на "Item" [x=10, y=20]');
      expect(steps[0].expectedResult).toBe('Контекстное меню открыто');
    });

    it('converts hover', () => {
      addAction(sessionId, makeAction({ actionType: 'hover', selectorText: 'Button', selector: '#btn' }));
      const steps = convertToSteps(sessionId);
      expect(steps[0].action).toBe('Навести мышь на "Button" [selector=#btn]');
      expect(steps[0].expectedResult).toBe('Элемент подсвечен');
    });

    it('converts wheel', () => {
      addAction(sessionId, makeAction({ actionType: 'wheel', value: 'deltaY=120' }));
      const steps = convertToSteps(sessionId);
      expect(steps[0].action).toBe('Прокрутить колёсиком мыши: deltaY=120');
    });
  });

  // ── Assert actions ──
  describe('assert actions', () => {
    it('converts assertText', () => {
      addAction(sessionId, makeAction({ actionType: 'assertText', value: 'Welcome back!' }));
      const steps = convertToSteps(sessionId);
      expect(steps[0].action).toBe('Проверить что текст "Welcome back!" отображается');
      expect(steps[0].testData).toBe('Welcome back!');
    });

    it('converts assertVisible', () => {
      addAction(sessionId, makeAction({ actionType: 'assertVisible', selectorText: 'Submit button', selector: '#submit' }));
      const steps = convertToSteps(sessionId);
      expect(steps[0].action).toBe('Проверить видимость элемента "Submit button"');
      expect(steps[0].expectedResult).toBe('Элемент видим');
    });

    it('converts assertValue', () => {
      addAction(sessionId, makeAction({ actionType: 'assertValue', selectorText: 'Name field', value: 'John' }));
      const steps = convertToSteps(sessionId);
      expect(steps[0].action).toBe('Проверить значение поля "Name field" = "John"');
    });

    it('converts assertChecked', () => {
      addAction(sessionId, makeAction({ actionType: 'assertChecked', selectorText: 'Checkbox', value: 'checked' }));
      const steps = convertToSteps(sessionId);
      expect(steps[0].action).toBe('Проверить состояние чекбокса "Checkbox"');
      expect(steps[0].expectedResult).toBe('Чекбокс checked');
    });

    it('converts assertUrl', () => {
      addAction(sessionId, makeAction({ actionType: 'assertUrl', value: '/dashboard' }));
      const steps = convertToSteps(sessionId);
      expect(steps[0].action).toBe('Проверить URL содержит "/dashboard"');
    });
  });

  // ── Wait / element actions ──
  describe('wait & element actions', () => {
    it('converts waitForSelector', () => {
      addAction(sessionId, makeAction({ actionType: 'waitForSelector', selector: '.loaded', selectorText: '.loaded' }));
      const steps = convertToSteps(sessionId);
      expect(steps[0].action).toBe('Дождаться появления элемента ".loaded"');
      expect(steps[0].expectedResult).toBe('Элемент появился на странице');
    });

    it('converts element_appear', () => {
      addAction(sessionId, makeAction({ actionType: 'element_appear', selectorText: 'Popup', selector: '#popup', value: 'div' }));
      const steps = convertToSteps(sessionId);
      expect(steps[0].action).toBe('Появился <div> "Popup" [selector=#popup]');
      expect(steps[0].expectedResult).toBe('Элемент виден на странице');
    });

    it('converts element_resize', () => {
      addAction(sessionId, makeAction({ actionType: 'element_resize', selectorText: 'Panel', value: 'w:400 h:300' }));
      const steps = convertToSteps(sessionId);
      expect(steps[0].action).toBe('Элемент "Panel" изменил размер: w:400 h:300');
    });

    it('converts element_intersect visible', () => {
      addAction(sessionId, makeAction({ actionType: 'element_intersect', selectorText: 'Banner', value: 'visible' }));
      const steps = convertToSteps(sessionId);
      expect(steps[0].action).toBe('Элемент "Banner" стал видим');
    });

    it('converts element_intersect hidden', () => {
      addAction(sessionId, makeAction({ actionType: 'element_intersect', selectorText: 'Banner', value: 'hidden' }));
      const steps = convertToSteps(sessionId);
      expect(steps[0].action).toBe('Элемент "Banner" стал скрыт');
    });

    it('skips element_remove, attr_change, text_change', () => {
      addAction(sessionId, makeAction({ actionType: 'element_remove' }));
      addAction(sessionId, makeAction({ actionType: 'attr_change' }));
      addAction(sessionId, makeAction({ actionType: 'text_change' }));
      const steps = convertToSteps(sessionId);
      expect(steps).toHaveLength(0);
    });
  });

  // ── HTTP actions ──
  describe('HTTP actions', () => {
    it('converts request with POST and curl', () => {
      addAction(sessionId, makeAction({ actionType: 'request', method: 'POST', url: 'https://api.example.com/data', postData: '{"key":"val"}' }));
      const steps = convertToSteps(sessionId);
      // First step is prepended navigate (because action has url)
      expect(steps).toHaveLength(2);
      expect(steps[1].action).toBe('HTTP POST https://api.example.com/data');
      expect(steps[1].httpMethod).toBe('POST');
      expect(steps[1].httpUrl).toBe('https://api.example.com/data');
      expect(steps[1].requestBody).toBe('{"key":"val"}');
      expect(steps[1].curl).toBe(`curl -X POST "https://api.example.com/data" -H 'Content-Type: application/json' -d '{"key":"val"}'`);
      expect(steps[1].expectedResult).toBe('Запрос отправлен');
    });

    it('converts request with GET without postData', () => {
      addAction(sessionId, makeAction({ actionType: 'request', method: 'GET', url: 'https://api.example.com/items' }));
      const steps = convertToSteps(sessionId);
      expect(steps).toHaveLength(2);
      expect(steps[1].curl).toBe(`curl -X GET "https://api.example.com/items"`);
    });

    it('converts response with 200 OK', () => {
      addAction(sessionId, makeAction({ actionType: 'response', method: 'GET', url: 'https://api.example.com/items', status: 200, body: '{"items":[]}' }));
      const steps = convertToSteps(sessionId);
      expect(steps).toHaveLength(2);
      expect(steps[1].action).toContain('HTTP GET https://api.example.com/items → 200 OK');
      expect(steps[1].httpStatus).toBe(200);
      expect(steps[1].expectedResult).toBe('Ответ получен');
      expect(steps[1].curl).toBe('curl -X GET "https://api.example.com/items"');
    });

    it('converts response with 404 error', () => {
      addAction(sessionId, makeAction({ actionType: 'response', method: 'GET', url: 'https://api.example.com/missing', status: 404 }));
      const steps = convertToSteps(sessionId);
      expect(steps).toHaveLength(2);
      expect(steps[1].action).toContain('→ 404 ERROR');
      expect(steps[1].expectedResult).toBe('Ошибка: 404');
    });

    it('converts request_failed', () => {
      addAction(sessionId, makeAction({ actionType: 'request_failed', method: 'POST', url: 'https://api.example.com/data', error: 'timeout' }));
      const steps = convertToSteps(sessionId);
      expect(steps).toHaveLength(2);
      expect(steps[1].action).toBe('HTTP POST https://api.example.com/data → ОШИБКА: timeout');
      expect(steps[1].expectedResult).toBe('Ошибка: timeout');
    });
  });

  // ── File / Switch / Captcha ──
  describe('file & system actions', () => {
    it('converts file_upload', () => {
      addAction(sessionId, makeAction({ actionType: 'file_upload', selectorText: 'Avatar', value: 'C:\\photo.jpg' }));
      const steps = convertToSteps(sessionId);
      expect(steps[0].action).toBe('Загрузить файл "C:\\photo.jpg" в "Avatar"');
      expect(steps[0].expectedResult).toBe('Файл загружен');
    });

    it('converts switch_user', () => {
      addAction(sessionId, makeAction({ actionType: 'switch_user', value: 'admin' }));
      const steps = convertToSteps(sessionId);
      expect(steps[0].action).toBe('Сменить пользователя');
      expect(steps[0].testData).toBe('admin');
    });

    it('converts captcha_detected', () => {
      addAction(sessionId, makeAction({ actionType: 'captcha_detected', selectorText: 'captcha', value: 'recaptcha' }));
      const steps = convertToSteps(sessionId);
      expect(steps[0].action).toBe('Обнаружена CAPTCHA: captcha');
      expect(steps[0].expectedResult).toContain('ручное прохождение');
    });

    it('converts user_switch', () => {
      addAction(sessionId, makeAction({ actionType: 'user_switch', selectorText: 'user1', value: 'user2' }));
      const steps = convertToSteps(sessionId);
      expect(steps[0].action).toBe('Переключить пользователя с "user1" на "user2"');
    });
  });

  // ── Dialog / Console / Error ──
  describe('dialog & console', () => {
    it('converts dialog', () => {
      addAction(sessionId, makeAction({ actionType: 'dialog', selectorText: 'confirm', value: 'Are you sure?' }));
      const steps = convertToSteps(sessionId);
      expect(steps[0].action).toBe('Диалог "confirm": "Are you sure?"');
    });

    it('converts console message', () => {
      addAction(sessionId, makeAction({ actionType: 'console', level: 'warn', value: 'Deprecated API' }));
      const steps = convertToSteps(sessionId);
      expect(steps[0].action).toBe('Консоль [warn]: "Deprecated API"');
      expect(steps[0].expectedResult).toBe('Сообщение залогировано');
    });

    it('converts js_error', () => {
      addAction(sessionId, makeAction({ actionType: 'js_error', value: 'TypeError: undefined is not a function' }));
      const steps = convertToSteps(sessionId);
      expect(steps[0].action).toContain('JavaScript ошибка:');
      expect(steps[0].expectedResult).toBe('Ошибка зафиксирована');
    });

    it('converts unhandled_rejection', () => {
      addAction(sessionId, makeAction({ actionType: 'unhandled_rejection', value: 'NetworkError' }));
      const steps = convertToSteps(sessionId);
      expect(steps[0].action).toContain('Необработанный Promise');
    });

    it('converts cookie_consent', () => {
      addAction(sessionId, makeAction({ actionType: 'cookie_consent' }));
      const steps = convertToSteps(sessionId);
      expect(steps[0].action).toBe('Обнаружен Cookie Consent баннер');
    });

    it('skips jira_env', () => {
      addAction(sessionId, makeAction({ actionType: 'jira_env' }));
      const steps = convertToSteps(sessionId);
      expect(steps).toHaveLength(0);
    });
  });

  // ── Media actions ──
  describe('media actions', () => {
    it('converts media_play', () => {
      addAction(sessionId, makeAction({ actionType: 'media_play', selectorText: 'Video', selector: '#vid' }));
      const steps = convertToSteps(sessionId);
      expect(steps[0].action).toBe('Воспроизвести медиа "Video"');
    });

    it('converts media_pause', () => {
      addAction(sessionId, makeAction({ actionType: 'media_pause', selectorText: 'Audio', selector: '#aud' }));
      const steps = convertToSteps(sessionId);
      expect(steps[0].action).toBe('Поставить на паузу медиа "Audio"');
    });

    it('converts media_seeked', () => {
      addAction(sessionId, makeAction({ actionType: 'media_seeked', selectorText: 'Video', value: '00:30' }));
      const steps = convertToSteps(sessionId);
      expect(steps[0].action).toBe('Перемотать медиа "Video" на 00:30');
    });

    it('converts media_volume', () => {
      addAction(sessionId, makeAction({ actionType: 'media_volume', value: '0.5' }));
      const steps = convertToSteps(sessionId);
      expect(steps[0].action).toBe('Изменить громкость медиа: 0.5');
    });
  });

  // ── UI / popover / details / selection ──
  describe('UI actions', () => {
    it('converts popover_toggle show', () => {
      addAction(sessionId, makeAction({ actionType: 'popover_toggle', selectorText: 'Menu', value: 'show' }));
      const steps = convertToSteps(sessionId);
      expect(steps[0].action).toBe('Поповер "Menu" открыт');
    });

    it('converts popover_toggle hide', () => {
      addAction(sessionId, makeAction({ actionType: 'popover_toggle', selectorText: 'Menu', value: 'hide' }));
      const steps = convertToSteps(sessionId);
      expect(steps[0].action).toBe('Поповер "Menu" закрыт');
    });

    it('converts dialog_element open', () => {
      addAction(sessionId, makeAction({ actionType: 'dialog_element', selectorText: 'Modal', value: 'open' }));
      const steps = convertToSteps(sessionId);
      expect(steps[0].action).toBe('<dialog> открыт: "Modal"');
    });

    it('converts details_toggle open', () => {
      addAction(sessionId, makeAction({ actionType: 'details_toggle', selectorText: 'Details', value: 'open' }));
      const steps = convertToSteps(sessionId);
      expect(steps[0].action).toBe('<details> "Details" развёрнут');
    });

    it('converts selection', () => {
      addAction(sessionId, makeAction({ actionType: 'selection', value: 'selected text', length: 14 }));
      const steps = convertToSteps(sessionId);
      expect(steps[0].action).toBe('Выделить текст "selected text" [длина=14]');
      expect(steps[0].expectedResult).toBe('Текст выделен');
    });
  });

  // ── Touch / transition / animation ──
  describe('touch & animation', () => {
    it('converts touchstart', () => {
      addAction(sessionId, makeAction({ actionType: 'touchstart', selectorText: 'Button', x: 50, y: 100 }));
      const steps = convertToSteps(sessionId);
      expect(steps[0].action).toBe('Нажать на экран (touch) по [50, 100] на "Button"');
    });

    it('converts touchmove', () => {
      addAction(sessionId, makeAction({ actionType: 'touchmove', value: 'x:100,y:200' }));
      const steps = convertToSteps(sessionId);
      expect(steps[0].action).toBe('Свайп по экрану в позицию x:100,y:200');
    });

    it('skips touchend', () => {
      addAction(sessionId, makeAction({ actionType: 'touchend' }));
      const steps = convertToSteps(sessionId);
      expect(steps).toHaveLength(0);
    });

    it('converts transition_end', () => {
      addAction(sessionId, makeAction({ actionType: 'transition_end', selectorText: 'Box', value: 'opacity 0.3s' }));
      const steps = convertToSteps(sessionId);
      expect(steps[0].action).toBe('CSS transition "Box" завершена (opacity 0.3s)');
    });

    it('converts animation_end', () => {
      addAction(sessionId, makeAction({ actionType: 'animation_end', selectorText: 'Spinner', value: 'spin 1s' }));
      const steps = convertToSteps(sessionId);
      expect(steps[0].action).toBe('CSS animation "Spinner" завершена (spin 1s)');
    });

    it('converts visibility_change', () => {
      addAction(sessionId, makeAction({ actionType: 'visibility_change', value: 'hidden' }));
      const steps = convertToSteps(sessionId);
      expect(steps[0].action).toBe('Видимость страницы изменилась: вкладка скрыта');
    });
  });

  // ── IME / skipped / fallback ──
  describe('other actions', () => {
    it('converts ime_composition', () => {
      addAction(sessionId, makeAction({ actionType: 'ime_composition', displayValue: '你好', value: 'ni hao' }));
      const steps = convertToSteps(sessionId);
      expect(steps[0].action).toBe('Ввод текста через IME: "你好"');
      expect(steps[0].testData).toBe('你好');
    });

    it('skips focus and resize', () => {
      addAction(sessionId, makeAction({ actionType: 'focus' }));
      addAction(sessionId, makeAction({ actionType: 'resize' }));
      addAction(sessionId, makeAction({ actionType: 'clipboard' }));
      const steps = convertToSteps(sessionId);
      expect(steps).toHaveLength(0);
    });

    it('falls back to default format for unknown action types', () => {
      addAction(sessionId, makeAction({ actionType: 'customAction', selectorText: 'Custom element', value: 'test' }));
      const steps = convertToSteps(sessionId);
      expect(steps[0].action).toBe('customAction: Custom element');
      expect(steps[0].testData).toBe('test');
      expect(steps[0].expectedResult).toBe('Выполнено');
    });

    it('populates extended ConvertedStep fields', () => {
      addAction(sessionId, makeAction({
        actionType: 'click', selector: '#btn', selectorText: 'Btn',
        url: 'https://x.com', pageTitle: 'X', timestamp: '2024-01-01',
        screenshot: 'shot.png',
      }));
      const steps = convertToSteps(sessionId);
      expect(steps[0].actionType).toBe('click');
      expect(steps[0].selector).toBe('#btn');
      expect(steps[0].selectorText).toBe('Btn');
      expect(steps[0].url).toBe('https://x.com');
      expect(steps[0].pageTitle).toBe('X');
      expect(steps[0].timestamp).toBe('2024-01-01');
      expect(steps[0].screenshot).toBe('shot.png');
    });
  });
});
