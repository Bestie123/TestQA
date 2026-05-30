export interface ParsedCommand {
  action: 'navigate' | 'click' | 'dblclick' | 'rightClick' | 'fill' | 'verify' | 'screenshot' | 'select' | 'wait' | 'keypress' | 'scroll' | 'drag' | 'drop' | 'hover' | 'wheel' | 'touch' | 'assertText' | 'assertVisible' | 'assertValue' | 'assertChecked' | 'assertUrl' | 'dragTo' | 'fileUpload' | 'waitForSelector' | 'switchTab' | 'listTabs';
  selector?: string;
  value?: string;
  url?: string;
  text?: string;
  key?: string;
  file?: string;
  deltaY?: number;
  deltaX?: number;
  x?: number;
  y?: number;
  frameName?: string;
  frameUrl?: string;
  frameSelector?: string;
}

export function parseStep(action: string, testData: string, expectedResult: string): ParsedCommand[] {
  const commands: ParsedCommand[] = [];
  const a = action.trim().toLowerCase();
  const td = testData.trim();
  const er = expectedResult.trim();

  // Direct action types from recorder (English): click, fill, select, navigate, etc.
  if (a === 'click') {
    commands.push({ action: 'click' });
    return commands;
  }
  if (a === 'canvas_click') {
    commands.push({ action: 'click' });
    return commands;
  }
  if (a === 'fill') {
    commands.push({ action: 'fill', value: td || er || '' });
    return commands;
  }
  if (a === 'select') {
    commands.push({ action: 'select', value: td || er || '' });
    return commands;
  }
  if (a === 'navigate') {
    const url = td || er;
    if (url) commands.push({ action: 'navigate', url });
    return commands;
  }
  if (a === 'check') {
    commands.push({ action: 'click' });
    return commands;
  }
  if (a === 'dblclick') {
    commands.push({ action: 'dblclick' });
    return commands;
  }
  if (a === 'rightclick' || a === 'contextmenu') {
    commands.push({ action: 'rightClick' });
    return commands;
  }
  if (a === 'keypress' || a === 'press') {
    commands.push({ action: 'keypress', value: td || 'Enter' });
  }
  if (a === 'wait') {
    commands.push({ action: 'wait', value: td || '2' });
    return commands;
  }
  if (a === 'screenshot') {
    commands.push({ action: 'screenshot' });
    return commands;
  }
  if (a === 'scroll') {
    commands.push({ action: 'scroll' });
    return commands;
  }
  if (a === 'drag' || a === 'drop') {
    commands.push({ action: 'drag', value: td || er });
    return commands;
  }
  // New action types (Iteration 6): assert*, hover, wheel, touch, fileUpload, waitForSelector, dragTo
  // Note: all comparisons use lowercase 'a' from: const a = action.trim().toLowerCase()
  if (a === 'asserttext') {
    commands.push({ action: 'assertText', text: td || er || '' });
    return commands;
  }
  if (a === 'assertvisible') {
    commands.push({ action: 'assertVisible', text: td || er || '' });
    return commands;
  }
  if (a === 'assertvalue') {
    commands.push({ action: 'assertValue', value: td || er || '', text: td || er || '' });
    return commands;
  }
  if (a === 'assertchecked') {
    commands.push({ action: 'assertChecked', value: td || er || '' });
    return commands;
  }
  if (a === 'asserturl') {
    commands.push({ action: 'assertUrl', text: td || er, value: td || er });
    return commands;
  }
  if (a === 'hover') {
    if (td) commands.push({ action: 'hover', selector: td });
    return commands;
  }
  if (a === 'wheel') {
    commands.push({ action: 'wheel', value: td || '100', deltaY: parseInt(td || '100') });
    return commands;
  }
  if (a === 'touch') {
    commands.push({ action: 'touch', value: td || '0,0' });
    return commands;
  }
  if (a === 'fileupload' || a === 'setinputfiles') {
    commands.push({ action: 'fileUpload', file: td || er || '' });
    return commands;
  }
  if (a === 'waitforselector') {
    commands.push({ action: 'waitForSelector', value: td || er || '' });
    return commands;
  }
  if (a === 'dragto') {
    commands.push({ action: 'dragTo', value: td || er || '' });
    return commands;
  }
  if (a === 'switchtab') {
    commands.push({ action: 'switchTab', value: td || er || '0' });
    return commands;
  }
  if (a === 'listtabs') {
    commands.push({ action: 'listTabs' });
    return commands;
  }

  // Russian & English natural language patterns
  // Navigate: "Перейти по URL https://..." / "Открыть URL ..." / "navigate to URL" / "открыть страницу URL"
  const urlMatch = a.match(/(?:перейти|открыть|перейти\s+по|navigate\s+to|go\s+to)\s+(?:по\s+)?(?:url|ссылке|адресу|страницу|страница)?\s*(?:https?:\/\/[^\s]+)/i);
  if (urlMatch) {
    const url = urlMatch[0].replace(/^(?:перейти|открыть|перейти\s+по|navigate\s+to|go\s+to)\s+(?:по\s+)?(?:url|ссылке|адресу|страницу|страница)?\s*/i, '').trim();
    commands.push({ action: 'navigate', url });
    return commands;
  }

  // Navigate from testData if it's a URL
  if (td.startsWith('http://') || td.startsWith('https://')) {
    commands.push({ action: 'navigate', url: td });
    return commands;
  }

  // DblClick: "Дважды нажать ..." or "Двойной клик ..."
  const dblClickMatch = a.match(/(?:дважды\s+нажать|двойной\s+клик|двойное\s+нажатие|double\s+click)\s*(?:на\s+)?[«"']?([^»"']+)[»"']?/i);
  if (dblClickMatch) {
    commands.push({ action: 'dblclick', selector: `text=${dblClickMatch[1].trim()}` });
    return commands;
  }

  // RightClick: "Правый клик ..." / "Нажать правой кнопкой ..." / "right click ..."
  const rightClickMatch = a.match(/(?:правый\s+клик|правая\s+кнопка|нажать\s+правой\s+кнопкой|контекстное\s+меню|right\s+click)\s*(?:на\s+)?[«"']?([^»"']+)[»"']?/i);
  if (rightClickMatch) {
    commands.push({ action: 'rightClick', selector: `text=${rightClickMatch[1].trim()}` });
    return commands;
  }

  // Click: "Нажать ..." or "Нажать кнопку ..." or "Кликнуть ..."
  const clickMatch = a.match(/(?:нажать|кликнуть|нажать\s+кнопку|нажать\s+на)\s*(?:кнопку|ссылку|элемент)?\s*[«"']?([^»"']+)[»"']?/i);
  if (clickMatch) {
    const text = clickMatch[1].trim();
    commands.push({ action: 'click', selector: `text=${text}` });
    return commands;
  }

  // Fill: "Заполнить поле ..." or "Ввести ..."
  const fillMatch = a.match(/(?:заполнить|ввести|введите|заполните)\s+(?:поле\s+)?[«"']?([^»"']+)[»"']?/i);
  if (fillMatch) {
    const fieldName = fillMatch[1].trim();
    if (td) {
      commands.push({ action: 'fill', selector: `text=${fieldName}`, value: td });
    } else {
      commands.push({ action: 'fill', selector: `text=${fieldName}`, value: fieldName });
    }
    return commands;
  }

  // Select: "Выбрать ..." 
  const selectMatch = a.match(/(?:выбрать|выберите)\s+(?:из\s+)?(?:списка\s+)?[«"']?([^»"']+)[»"']?/i);
  if (selectMatch) {
    const field = selectMatch[1].trim();
    commands.push({ action: 'select', selector: `text=${field}`, value: td });
    return commands;
  }

  // Assert: "Проверить текст ..." / "Убедиться ..." / "Проверить что ..."
  // NOTE: проверить\s+что must be first so it captures the full prefix
  const assertTextMatch = a.match(/(?:проверить\s+что|проверить|убедиться)\s+(?:текст|наличие|видимость)?\s*[«"']?([^»"']+)[»"']?/i);
  if (assertTextMatch) {
    const txt = assertTextMatch[1].trim();
    if (a.match(/видимость|visible|отображается|появил/i)) {
      commands.push({ action: 'assertVisible', selector: `text=${txt}`, text: txt });
    } else if (a.match(/значение|value|равно|содержит/i)) {
      commands.push({ action: 'assertValue', selector: `text=${txt}`, text: td || txt, value: td || txt });
    } else {
      commands.push({ action: 'assertText', selector: `text=${txt}`, text: txt });
    }
    return commands;
  }

  // Assert URL: "Проверить URL" / "URL должен быть"
  const assertUrlMatch = a.match(/(?:проверить\s+)?url|(?:url|адрес|страница)\s+(?:должен|должна)\s+(?:быть|стать|содержать|равен|равна)\s*(https?:\/\/[^\s]+)/i);
  if (assertUrlMatch) {
    commands.push({ action: 'assertUrl', text: assertUrlMatch[1].trim(), value: assertUrlMatch[1].trim() });
    return commands;
  }

  // SwitchTab: "Переключить вкладку ..." / "Перейти на вкладку ..." / "switch tab N" / "select tab N"
  const switchTabMatch = a.match(/(?:переключить|перейти\s+на|выбрать|switch|select|change)\s+(?:to\s+)?(?:вкладку|таб|tab)\s*(?:номер\s*)?[#]?(\d+|0x[\da-f]+)/i);
  if (switchTabMatch) {
    commands.push({ action: 'switchTab', value: switchTabMatch[1].trim() });
    return commands;
  }
  const switchTabUrlMatch = a.match(/(?:переключить|перейти\s+на)\s+(?:вкладку|таб|tab)\s+(?:с\s+)?(?:url|адрес(?:ом)?)?\s*(https?:\/\/[^\s]+)/i);
  if (switchTabUrlMatch) {
    commands.push({ action: 'switchTab', value: switchTabUrlMatch[1].trim() });
    return commands;
  }

  // ListTabs: "Список вкладок" / "Показать вкладки"
  if (a.match(/(?:список\s+)?вкладок|tabs?|показать\s+вкладки/i)) {
    commands.push({ action: 'listTabs' });
    return commands;
  }

  // Selection: "Выделить ..." / "Выделить текст ..."
  const selectTextMatch = a.match(/(?:выделить|выбрать|селект)\s+(?:текст\s+)?[«"']?([^»"']+)[»"']?/i);
  if (selectTextMatch && !a.match(/(?:из\s+списка|вкладку|таб|tab|поле\s+ввода|color)/i)) {
    commands.push({ action: 'verify', text: selectTextMatch[1].trim() });
    return commands;
  }

  // Hover: "Навести ..." / "Ховер ..."
  const hoverMatch = a.match(/(?:навести|ховер|hover|навести\s+мышь)\s*(?:на\s+)?[«"']?([^»"']+)[»"']?/i);
  if (hoverMatch) {
    const text = hoverMatch[1].trim();
    commands.push({ action: 'hover', selector: `text=${text}` });
    return commands;
  }

  // Drag with "из" / "в" pattern: "Перетащить X в Y"
  const dragFromTo = a.match(/(?:перетащить|drag)\s+[«"']?([^»"']+)[»"']?\s+(?:в|на|to)\s+[«"']?([^»"']+)[»"']?/i);
  if (dragFromTo) {
    const source = dragFromTo[1].trim();
    const dest = dragFromTo[2].trim();
    commands.push({ action: 'dragTo', selector: `text=${source}`, value: `text=${dest}` });
    return commands;
  }

  // Wheel / Scroll with mouse wheel: "Прокрутить колёсиком"
  const wheelMatch = a.match(/(?:прокрутить\s+кол[её]сик[оа]м|wheel|mouse\s+wheel|покрутить\s+кол[её]сико)/i);
  if (wheelMatch) {
    commands.push({ action: 'wheel', value: td || '100' });
    return commands;
  }

  // Wait for selector: "Дождаться ..." / "Ожидать ..."
  const waitSelectorMatch = a.match(/(?:дождаться|ожидать|подождать|wait\s+for)\s+[«"']?([^»"']+)[»"']?/i);
  if (waitSelectorMatch) {
    commands.push({ action: 'waitForSelector', selector: `text=${waitSelectorMatch[1].trim()}`, value: td || '' });
    return commands;
  }

  // File upload: "Загрузить файл ..." / "Выбрать файл ..."
  const fileMatch = a.match(/(?:загрузить|выбрать|прикрепить)\s+(?:файл|file)\s+[«"']?([^»"']+)[»"']?/i);
  if (fileMatch) {
    commands.push({ action: 'fileUpload', selector: `text=${fileMatch[1].trim()}`, file: td || '' });
    return commands;
  }

  // Scroll: "Прокрутить" or "Скролл"
  const scrollMatch = a.match(/(?:прокрутить|скролл|scroll)/i);
  if (scrollMatch) {
    commands.push({ action: 'scroll' });
    return commands;
  }

  // Drag: "Перетащить ..." to "..." (simple)
  const dragMatch = a.match(/(?:перетащить|тянуть|拖)\s+[«"']?([^»"']+)[»"']?/i);
  if (dragMatch) {
    const source = dragMatch[1].trim();
    commands.push({ action: 'drag', selector: `text=${source}`, value: td ? `text=${td}` : '' });
    return commands;
  }

  // Canvas click with coordinates: "Нажать на canvas ... по координатам (x, y)"
  const canvasMatch = a.match(/(?:нажать|кликнуть)\s+на\s+canvas\s+[«"']?([^»"']+)[»"']?\s+(?:по\s+)?координатам\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)/i);
  if (canvasMatch) {
    commands.push({ action: 'click', selector: `text=${canvasMatch[1].trim()}`, x: parseInt(canvasMatch[2]), y: parseInt(canvasMatch[3]) });
    return commands;
  }

  // Default: try clicking by text from the action
  const words = a.replace(/<[^>]+>/g, '').trim();
  if (words.length > 2 && words.length < 60) {
    commands.push({ action: 'click', selector: `text=${words}` });
    return commands;
  }

  commands.push({ action: 'screenshot' });
  return commands;
}
