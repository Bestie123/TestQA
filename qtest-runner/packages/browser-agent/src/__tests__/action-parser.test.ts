import { describe, it, expect } from 'vitest';
import { parseStep } from '../action-parser';

describe('parseStep - Direct action types', () => {
  it('returns click for "click"', () => {
    const r = parseStep('click', '', '');
    expect(r).toHaveLength(1);
    expect(r[0].action).toBe('click');
  });

  it('returns fill with value from testData', () => {
    const r = parseStep('fill', 'test value', '');
    expect(r[0].action).toBe('fill');
    expect(r[0].value).toBe('test value');
  });

  it('returns fill with value from expectedResult when testData empty', () => {
    const r = parseStep('fill', '', 'expected');
    expect(r[0].action).toBe('fill');
    expect(r[0].value).toBe('expected');
  });

  it('returns select with testData', () => {
    const r = parseStep('select', 'option1', '');
    expect(r[0].action).toBe('select');
    expect(r[0].value).toBe('option1');
  });

  it('returns navigate with url from testData', () => {
    const r = parseStep('navigate', 'https://example.com', '');
    expect(r[0].action).toBe('navigate');
    expect(r[0].url).toBe('https://example.com');
  });

  it('returns click for "check"', () => {
    const r = parseStep('check', '', '');
    expect(r[0].action).toBe('click');
  });

  it('returns dblclick for "dblclick"', () => {
    const r = parseStep('dblclick', '', '');
    expect(r[0].action).toBe('dblclick');
  });

  it('returns rightClick for "rightclick"', () => {
    const r = parseStep('rightclick', '', '');
    expect(r[0].action).toBe('rightClick');
  });

  it('returns rightClick for "contextmenu"', () => {
    const r = parseStep('contextmenu', '', '');
    expect(r[0].action).toBe('rightClick');
  });

  it('returns keypress with value from testData', () => {
    const r = parseStep('press', 'Enter', '');
    expect(r[0].action).toBe('keypress');
    expect(r[0].value).toBe('Enter');
  });

  it('returns keypress with default Enter', () => {
    const r = parseStep('press', '', '');
    expect(r[0].action).toBe('keypress');
    expect(r[0].value).toBe('Enter');
  });

  it('returns wait with value from testData', () => {
    const r = parseStep('wait', '3', '');
    expect(r[0].action).toBe('wait');
    expect(r[0].value).toBe('3');
  });

  it('returns screenshot', () => {
    const r = parseStep('screenshot', '', '');
    expect(r[0].action).toBe('screenshot');
  });

  it('returns scroll', () => {
    const r = parseStep('scroll', '', '');
    expect(r[0].action).toBe('scroll');
  });

  it('returns drag with testData as value', () => {
    const r = parseStep('drag', '#target', '');
    expect(r[0].action).toBe('drag');
    expect(r[0].value).toBe('#target');
  });

  it('returns drop same as drag', () => {
    const r = parseStep('drop', '#dest', '');
    expect(r[0].action).toBe('drag');
  });

  it('returns assertText with text', () => {
    const r = parseStep('assertText', 'expected text', '');
    expect(r[0].action).toBe('assertText');
    expect(r[0].text).toBe('expected text');
  });

  it('returns assertVisible', () => {
    const r = parseStep('assertVisible', 'some text', '');
    expect(r[0].action).toBe('assertVisible');
    expect(r[0].text).toBe('some text');
  });

  it('returns assertValue', () => {
    const r = parseStep('assertValue', 'val', '');
    expect(r[0].action).toBe('assertValue');
    expect(r[0].value).toBe('val');
  });

  it('returns assertChecked', () => {
    const r = parseStep('assertChecked', 'true', '');
    expect(r[0].action).toBe('assertChecked');
    expect(r[0].value).toBe('true');
  });

  it('returns assertUrl', () => {
    const r = parseStep('assertUrl', 'https://example.com', '');
    expect(r[0].action).toBe('assertUrl');
    expect(r[0].text).toBe('https://example.com');
  });

  it('returns hover with selector from testData', () => {
    const r = parseStep('hover', '#myel', '');
    expect(r[0].action).toBe('hover');
    expect(r[0].selector).toBe('#myel');
  });

  it('returns wheel with delta', () => {
    const r = parseStep('wheel', '50', '');
    expect(r[0].action).toBe('wheel');
    expect(r[0].value).toBe('50');
    expect(r[0].deltaY).toBe(50);
  });

  it('returns touch', () => {
    const r = parseStep('touch', '100,200', '');
    expect(r[0].action).toBe('touch');
    expect(r[0].value).toBe('100,200');
  });

  it('returns fileUpload', () => {
    const r = parseStep('fileUpload', '/path/file.txt', '');
    expect(r[0].action).toBe('fileUpload');
    expect(r[0].file).toBe('/path/file.txt');
  });

  it('returns waitForSelector', () => {
    const r = parseStep('waitForSelector', '#btn', '');
    expect(r[0].action).toBe('waitForSelector');
    expect(r[0].value).toBe('#btn');
  });

  it('returns switchTab', () => {
    const r = parseStep('switchTab', '2', '');
    expect(r[0].action).toBe('switchTab');
    expect(r[0].value).toBe('2');
  });

  it('returns listTabs', () => {
    const r = parseStep('listTabs', '', '');
    expect(r[0].action).toBe('listTabs');
  });
});

describe('parseStep - Russian patterns', () => {
  it('parses нажать кнопку', () => {
    const r = parseStep('нажать кнопку Войти', '', '');
    expect(r[0].action).toBe('click');
    expect(r[0].selector).toContain('войти');
  });

  it('parses кликнуть на элемент', () => {
    const r = parseStep('кликнуть на кнопку Создать', '', '');
    expect(r[0].action).toBe('click');
    expect(r[0].selector).toContain('создать');
  });

  it('parses ввести текст в поле', () => {
    const r = parseStep('ввести текст в поле логин', 'admin', '');
    expect(r[0].action).toBe('fill');
    expect(r[0].value).toBe('admin');
  });

  it('parses заполнить поле', () => {
    const r = parseStep('заполнить поле Имя', 'Тест', '');
    expect(r[0].action).toBe('fill');
    expect(r[0].value).toBe('Тест');
  });

  it('parses выбрать опцию', () => {
    const r = parseStep('выбрать опцию', 'opt1', '');
    expect(r[0].action).toBe('select');
    expect(r[0].value).toBe('opt1');
  });

  it('parses дважды нажать', () => {
    const r = parseStep('дважды нажать на кнопку', '', '');
    expect(r[0].action).toBe('dblclick');
    expect(r[0].selector).toContain('кнопку');
  });

  it('parses двойной клик', () => {
    const r = parseStep('двойной клик по элементу', '', '');
    expect(r[0].action).toBe('dblclick');
    expect(r[0].selector).toContain('элементу');
  });

  it('parses правый клик', () => {
    const r = parseStep('правый клик по элементу', '', '');
    expect(r[0].action).toBe('rightClick');
    expect(r[0].selector).toContain('элементу');
  });

  it('parses нажать правой кнопкой', () => {
    const r = parseStep('нажать правой кнопкой мыши', '', '');
    expect(r[0].action).toBe('rightClick');
    expect(r[0].selector).toContain('мыши');
  });

  it('parses перейти по URL', () => {
    const r = parseStep('перейти по URL https://example.com', '', '');
    expect(r[0].action).toBe('navigate');
    expect(r[0].url).toBe('https://example.com');
  });

  it('parses открыть страницу', () => {
    const r = parseStep('открыть страницу https://test.com', '', '');
    expect(r[0].action).toBe('navigate');
    expect(r[0].url).toBe('https://test.com');
  });

  it('parses нажать Enter', () => {
    const r = parseStep('нажать Enter на поле', '', '');
    expect(r[0].action).toBe('click');
  });

  it('parses проверить текст', () => {
    const r = parseStep('проверить текст "Hello World"', '', '');
    expect(r[0].action).toBe('assertText');
    expect(r[0].text).toContain('hello world');
  });

  it('parses проверить что текст отображается as assertVisible', () => {
    const r = parseStep('проверить что текст "Успех" отображается', '', '');
    expect(r[0].action).toBe('assertVisible');
    expect(r[0].text).toContain('успех');
    expect(r[0].text).not.toContain('что текст');
  });

  it('parses перетащить элемент в другой', () => {
    const r = parseStep('перетащить "src" в "dest"', '', '');
    expect(r[0].action).toBe('dragTo');
    expect(r[0].selector).toContain('src');
    expect(r[0].value).toContain('dest');
  });

  it('parses сделать скриншот through default', () => {
    const r = parseStep('сделать скриншот', '', '');
    expect(r[0].action).toBe('click');
  });

  it('parses выделить текст', () => {
    const r = parseStep('выделить текст "important"', '', '');
    expect(r[0].action).toBe('verify');
    expect(r[0].text).toContain('important');
  });

  it('parses навести курсор', () => {
    const r = parseStep('навести курсор на кнопку', '', '');
    expect(r[0].action).toBe('hover');
    expect(r[0].selector).toContain('кнопку');
  });
});

describe('parseStep - English patterns', () => {
  it('parses "press Enter"', () => {
    const r = parseStep('press Enter', '', '');
    expect(r[0].action).toBe('click');
  });

  it('parses "double click"', () => {
    const r = parseStep('double click button', '', '');
    expect(r[0].action).toBe('dblclick');
    expect(r[0].selector).toContain('button');
  });

  it('parses "right click"', () => {
    const r = parseStep('right click element', '', '');
    expect(r[0].action).toBe('rightClick');
    expect(r[0].selector).toContain('element');
  });

  it('parses "switch tab 2"', () => {
    const r = parseStep('switch tab 2', '', '');
    expect(r[0].action).toBe('switchTab');
    expect(r[0].value).toBe('2');
  });

  it('parses "navigate to"', () => {
    const r = parseStep('navigate to https://site.com', '', '');
    expect(r[0].action).toBe('navigate');
    expect(r[0].url).toBe('https://site.com');
  });

  it('parses "go to url"', () => {
    const r = parseStep('go to https://example.com', '', '');
    expect(r[0].action).toBe('navigate');
    expect(r[0].url).toBe('https://example.com');
  });

  it('parses "switch to tab 1"', () => {
    const r = parseStep('switch to tab 1', '', '');
    expect(r[0].action).toBe('switchTab');
    expect(r[0].value).toBe('1');
  });
});

describe('parseStep - Canvas click', () => {
  it('parses canvas_click direct action', () => {
    const r = parseStep('canvas_click', '', '');
    expect(r[0].action).toBe('click');
  });

  it('parses нажать на canvas по координатам', () => {
    const r = parseStep('нажать на canvas "myCanvas" по координатам (100, 200)', '', '');
    expect(r[0].action).toBe('click');
  });
});

describe('parseStep - Edge cases', () => {
  it('handles empty action gracefully', () => {
    const r = parseStep('', '', '');
    expect(r).toHaveLength(1);
    expect(r[0].action).toBe('screenshot');
  });

  it('handles undefined testData for navigate from action text URL', () => {
    const r = parseStep('открыть https://test.ru', '', '');
    expect(r[0].action).toBe('navigate');
    expect(r[0].url).toBe('https://test.ru');
  });

  it('handles long action text by clicking text', () => {
    const r = parseStep('Нажать на кнопку Отправить форму', '', '');
    expect(r[0].action).toBe('click');
    expect(r[0].selector).toContain('отправить форму');
  });

  it('falls back to screenshot for unrecognized short text', () => {
    const r = parseStep('??', '', '');
    expect(r[0].action).toBe('screenshot');
  });
});
