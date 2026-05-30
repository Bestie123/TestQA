import { useState, useEffect } from 'react';
import { getSettings, setSettingsBulk } from '../api';

// ── Action type categories with descriptions ──
const CATEGORIES = [
  {
    name: 'Навигация',
    types: [
      { key: 'navigate', label: 'navigate', desc: 'Навигация (pushState, popstate, hashchange)' },
      { key: 'page_load', label: 'page_load', desc: 'Загрузка страницы (full load)' },
      { key: 'switchTab', label: 'switchTab', desc: 'Переключение вкладки браузера' },
      { key: 'listTabs', label: 'listTabs', desc: 'Получение списка вкладок' },
    ],
  },
  {
    name: 'Клики',
    types: [
      { key: 'click', label: 'click', desc: 'Левый клик по элементу' },
      { key: 'dblclick', label: 'dblclick', desc: 'Двойной клик' },
      { key: 'contextmenu', label: 'contextmenu', desc: 'Правый клик (контекстное меню)' },
      { key: 'canvas_click', label: 'canvas_click', desc: 'Клик по canvas с координатами (x, y)' },
      { key: 'hover', label: 'hover', desc: 'Наведение мыши (mouseenter/leave)' },
      { key: 'focus', label: 'focus', desc: 'Фокус на элементе' },
    ],
  },
  {
    name: 'Ввод',
    types: [
      { key: 'fill', label: 'fill', desc: 'Ввод текста в поле' },
      { key: 'select', label: 'select', desc: 'Выбор из выпадающего списка' },
      { key: 'check', label: 'check', desc: 'Переключение чекбокса/радио' },
      { key: 'keypress', label: 'keypress', desc: 'Нажатие клавиши (Enter, Tab, Escape и т.д.)' },
      { key: 'ime_composition', label: 'ime_composition', desc: 'Ввод через IME (CJK символы)' },
    ],
  },
  {
    name: 'Drag & Drop',
    types: [
      { key: 'dragstart', label: 'dragstart', desc: 'Начало перетаскивания (захват)' },
      { key: 'dragend', label: 'dragend', desc: 'Конец перетаскивания' },
      { key: 'drop', label: 'drop', desc: 'Отпускание элемента на цели' },
      { key: 'drag', label: 'drag', desc: 'Playwright dragTo команда' },
    ],
  },
  {
    name: 'Формы и файлы',
    types: [
      { key: 'submit', label: 'submit', desc: 'Отправка формы' },
      { key: 'file_upload', label: 'file_upload', desc: 'Выбор файла для загрузки' },
    ],
  },
  {
    name: 'Проверки (Assertions)',
    types: [
      { key: 'assertText', label: 'assertText', desc: 'Проверка текста элемента' },
      { key: 'assertVisible', label: 'assertVisible', desc: 'Проверка видимости элемента' },
      { key: 'assertValue', label: 'assertValue', desc: 'Проверка значения поля ввода' },
      { key: 'assertChecked', label: 'assertChecked', desc: 'Проверка состояния чекбокса' },
      { key: 'assertUrl', label: 'assertUrl', desc: 'Проверка URL страницы' },
      { key: 'waitForSelector', label: 'waitForSelector', desc: 'Ожидание появления элемента' },
      { key: 'wait', label: 'wait', desc: 'Ожидание указанного времени' },
      { key: 'verify', label: 'verify', desc: 'Проверка текста (альтернатива assertText)' },
    ],
  },
  {
    name: 'Скриншоты',
    types: [
      { key: 'screenshot', label: 'screenshot', desc: 'Скриншот страницы' },
    ],
  },
  {
    name: 'Клавиатура и буфер',
    types: [
      { key: 'clipboard', label: 'clipboard', desc: 'Копирование/вставка (copy/paste)' },
      { key: 'selection', label: 'selection', desc: 'Выделение текста' },
    ],
  },
  {
    name: 'Прокрутка и размер',
    types: [
      { key: 'scroll', label: 'scroll', desc: 'Прокрутка страницы' },
      { key: 'wheel', label: 'wheel', desc: 'Прокрутка колёсиком мыши' },
      { key: 'resize', label: 'resize', desc: 'Изменение размера окна' },
    ],
  },
  {
    name: 'Touch',
    types: [
      { key: 'touchstart', label: 'touchstart', desc: 'Касание экрана' },
      { key: 'touchend', label: 'touchend', desc: 'Конец касания' },
      { key: 'touchmove', label: 'touchmove', desc: 'Свайп по экрану' },
    ],
  },
  {
    name: 'Медиа',
    types: [
      { key: 'media_play', label: 'media_play', desc: 'Воспроизведение видео/аудио' },
      { key: 'media_pause', label: 'media_pause', desc: 'Пауза медиа' },
      { key: 'media_seeked', label: 'media_seeked', desc: 'Перемотка медиа' },
      { key: 'media_volume', label: 'media_volume', desc: 'Изменение громкости' },
    ],
  },
  {
    name: 'CSS Анимации',
    types: [
      { key: 'transition_start', label: 'transition_start', desc: 'Начало CSS transition' },
      { key: 'transition_end', label: 'transition_end', desc: 'Завершение CSS transition' },
      { key: 'animation_start', label: 'animation_start', desc: 'Начало CSS анимации' },
      { key: 'animation_end', label: 'animation_end', desc: 'Завершение CSS анимации' },
    ],
  },
  {
    name: 'Жизненный цикл страницы',
    types: [
      { key: 'visibility_change', label: 'visibility_change', desc: 'Смена видимости вкладки' },
      { key: 'page_hide', label: 'page_hide', desc: 'Страница скрыта (bfcache)' },
      { key: 'page_show', label: 'page_show', desc: 'Страница восстановлена из кэша' },
    ],
  },
  {
    name: 'UI Элементы',
    types: [
      { key: 'dialog', label: 'dialog', desc: 'Браузерный диалог (alert/confirm)' },
      { key: 'dialog_element', label: 'dialog_element', desc: 'HTML <dialog> элемент' },
      { key: 'details_toggle', label: 'details_toggle', desc: '<details> развёрнут/свёрнут' },
      { key: 'popover_toggle', label: 'popover_toggle', desc: 'Popover API элемент' },
    ],
  },
  {
    name: 'DOM Мутации',
    types: [
      { key: 'element_appear', label: 'element_appear', desc: 'Новый элемент появился в DOM' },
      { key: 'element_remove', label: 'element_remove', desc: 'Элемент удалён из DOM' },
      { key: 'attr_change', label: 'attr_change', desc: 'Атрибут элемента изменился' },
      { key: 'text_change', label: 'text_change', desc: 'Текст элемента изменился' },
      { key: 'element_resize', label: 'element_resize', desc: 'Элемент изменил размер (ResizeObserver)' },
      { key: 'element_intersect', label: 'element_intersect', desc: 'Элемент стал видим/скрыт (IntersectionObserver)' },
    ],
  },
  {
    name: 'Сеть',
    types: [
      { key: 'request', label: 'request', desc: 'HTTP запрос' },
      { key: 'response', label: 'response', desc: 'HTTP ответ' },
      { key: 'request_failed', label: 'request_failed', desc: 'HTTP запрос не удался' },
    ],
  },
  {
    name: 'Ошибки',
    types: [
      { key: 'js_error', label: 'js_error', desc: 'JavaScript ошибка' },
      { key: 'unhandled_rejection', label: 'unhandled_rejection', desc: 'Необработанный Promise rejection' },
      { key: 'console', label: 'console', desc: 'Сообщение из консоли браузера' },
    ],
  },
  {
    name: 'Окружение',
    types: [
      { key: 'cookie_consent', label: 'cookie_consent', desc: 'Обнаружен Cookie Consent баннер' },
      { key: 'jira_env', label: 'jira_env', desc: 'Обнаружено окружение Jira/Zephyr' },
      { key: 'captcha_detected', label: 'captcha_detected', desc: 'Обнаружена CAPTCHA' },
      { key: 'user_switch', label: 'user_switch', desc: 'Переключение пользователя (Ctrl+Shift+U)' },
    ],
  },
];

const ALL_TYPE_KEYS = CATEGORIES.flatMap(c => c.types.map(t => t.key));

interface SettingsPageProps {
  api: string;
}

export default function SettingsPage({ api }: SettingsPageProps) {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSettings(api).then(s => {
      setSettings(s);
      setLoading(false);
    });
  }, [api]);

  const isEnabled = (key: string) => {
    const v = settings[key];
    return v === undefined ? true : v === 'true';
  };

  const toggleType = (key: string) => {
    setSettings(prev => ({
      ...prev,
      [key]: isEnabled(key) ? 'false' : 'true',
    }));
  };

  const setAll = (value: boolean) => {
    const update: Record<string, string> = {};
    for (const k of ALL_TYPE_KEYS) update[k] = value ? 'true' : 'false';
    setSettings(prev => ({ ...prev, ...update }));
  };

  const setCategory = (catName: string, value: boolean) => {
    const cat = CATEGORIES.find(c => c.name === catName);
    if (!cat) return;
    const update: Record<string, string> = {};
    for (const t of cat.types) update[t.key] = value ? 'true' : 'false';
    setSettings(prev => ({ ...prev, ...update }));
  };

  const setDragMode = (mode: string) => {
    setSettings(prev => ({ ...prev, dragMode: mode }));
  };

  const handleSave = async () => {
    setSaving(true);
    await setSettingsBulk(api, settings);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (loading) return <div style={{ padding: 24 }}>Загрузка...</div>;

  const dragMode = settings.dragMode || 'simple';
  const enabledCount = ALL_TYPE_KEYS.filter(k => isEnabled(k)).length;

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
      <h1 style={{ marginBottom: 16 }}>Настройки</h1>

      {/* Drag Mode */}
      <div style={{ marginBottom: 32, padding: 16, background: '#1a1a2e', borderRadius: 8 }}>
        <h2 style={{ marginTop: 0, marginBottom: 12 }}>Режим записи Drag & Drop</h2>
        <div style={{ display: 'flex', gap: 16 }}>
          <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="radio"
              name="dragMode"
              checked={dragMode === 'simple'}
              onChange={() => setDragMode('simple')}
            />
            <div>
              <div style={{ fontWeight: 600 }}>Простой</div>
              <div style={{ fontSize: 12, color: '#888' }}>3 шага: захват → отпускание → завершение</div>
            </div>
          </label>
          <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="radio"
              name="dragMode"
              checked={dragMode === 'smart'}
              onChange={() => setDragMode('smart')}
            />
            <div>
              <div style={{ fontWeight: 600 }}>Умный</div>
              <div style={{ fontSize: 12, color: '#888' }}>1 шаг: "Перетащить X в Y"</div>
            </div>
          </label>
        </div>
      </div>

      {/* Action Types */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ margin: 0 }}>Логирование действий ({enabledCount}/{ALL_TYPE_KEYS.length})</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setAll(true)} style={btnStyle}>Включить все</button>
            <button onClick={() => setAll(false)} style={btnStyle}>Выключить все</button>
          </div>
        </div>

        {CATEGORIES.map(cat => {
          const catEnabled = cat.types.every(t => isEnabled(t.key));
          return (
            <div key={cat.name} style={{ marginBottom: 20, padding: 16, background: '#1a1a2e', borderRadius: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <h3 style={{ margin: 0 }}>{cat.name}</h3>
                <button
                  onClick={() => setCategory(cat.name, !catEnabled)}
                  style={{ ...btnStyle, fontSize: 12 }}
                >
                  {catEnabled ? 'Выключить все' : 'Включить все'}
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 8 }}>
                {cat.types.map(t => (
                  <label
                    key={t.key}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '6px 10px',
                      borderRadius: 6,
                      background: isEnabled(t.key) ? '#0d2818' : '#1a1a1a',
                      border: `1px solid ${isEnabled(t.key) ? '#2d5a3d' : '#333'}`,
                      cursor: 'pointer',
                      fontSize: 13,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isEnabled(t.key)}
                      onChange={() => toggleType(t.key)}
                      style={{ accentColor: '#4ade80' }}
                    />
                    <div>
                      <code style={{ color: '#4ade80', fontSize: 12 }}>{t.label}</code>
                      <div style={{ color: '#888', fontSize: 11, marginTop: 2 }}>{t.desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Save Button */}
      <div style={{ position: 'sticky', bottom: 0, padding: '12px 0', background: '#0f0f23' }}>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            padding: '10px 24px',
            background: saved ? '#2d5a3d' : '#3b82f6',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            cursor: saving ? 'wait' : 'pointer',
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          {saving ? 'Сохранение...' : saved ? 'Сохранено!' : 'Сохранить настройки'}
        </button>
      </div>
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  padding: '4px 12px',
  background: '#333',
  color: '#fff',
  border: '1px solid #555',
  borderRadius: 4,
  cursor: 'pointer',
  fontSize: 12,
};
