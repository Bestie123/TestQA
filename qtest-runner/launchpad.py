"""QTest Launcher — GUI-лаунчер для всех сервисов qtest-runner."""

import tkinter as tk
from tkinter import ttk, scrolledtext, messagebox
import subprocess
import threading
import socket
import os
import sys
import json
import time
from dataclasses import dataclass, field
from pathlib import Path
from datetime import datetime

try:
    import pystray
    from PIL import Image, ImageDraw
    HAS_TRAY = True
except ImportError:
    HAS_TRAY = False

try:
    import winreg
    HAS_WINREG = True
except ImportError:
    HAS_WINREG = False


# ─────────────────────────────────────────────
# КОНФИГУРАЦИЯ
# ─────────────────────────────────────────────

ROOT_DIR = Path(__file__).parent.resolve()
CONFIG_PATH = ROOT_DIR / "launchpad_config.json"
AUTORUN_KEY = r"Software\Microsoft\Windows\CurrentVersion\Run"
AUTORUN_NAME = "QTestLauncher"

DEFAULT_CONFIG = {
    "dark_mode": True,
    "auto_start": False,
    "auto_clean": True,
    "start_minimized": False,
    "add_to_startup": False,
    "font_size": 9,
    "window": {"x": 100, "y": 100, "width": 1000, "height": 700},
}

ALL_PORTS = [3000, 3001, 3002, 3003, 3004, 3005, 3006, 8080, 5173]


@dataclass
class Service:
    name: str
    port: int
    command: list
    cwd: str
    process: subprocess.Popen = None
    status: str = "stopped"
    logs: list = field(default_factory=list)
    log_thread: threading.Thread = None


SERVICES = [
    Service("api-gateway", 3000, ["node", "dist/index.js"], "packages/api-gateway"),
    Service("testcase-service", 3001, ["node", "dist/index.js"], "packages/testcase-service"),
    Service("step-library", 3002, ["node", "dist/index.js"], "packages/step-library-service"),
    Service("execution-service", 3003, ["node", "dist/index.js"], "packages/execution-service"),
    Service("recorder-service", 3004, ["node", "dist/index.js"], "packages/recorder-service"),
    Service("browser-agent", 3005, ["node", "dist/index.js"], "packages/browser-agent"),
    Service("web-ui", 8080, ["npx.cmd", "vite", "--port", "8080", "--host"], "packages/web-ui"),
    Service("docs", 5173, ["npx.cmd", "vitepress", "dev", "docs", "--port", "5173", "--host"], "."),
    Service("stub-site", 3006, ["node", "server.js"], "packages/stub-site"),
]


# ─────────────────────────────────────────────
# TRAY ICON
# ─────────────────────────────────────────────

def create_tray_image(count, total):
    img = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    color = "#3fb950" if count == total else "#f0883e" if count > 0 else "#f85149"
    draw.ellipse([4, 4, 60, 60], fill=color)
    text = str(count)
    bbox = draw.textbbox((0, 0), text)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    draw.text((32 - tw // 2, 32 - th // 2 - 2), text, fill="white")
    return img


# ─────────────────────────────────────────────
# WINDOWS STARTUP
# ─────────────────────────────────────────────

def is_in_startup():
    if not HAS_WINREG:
        return False
    try:
        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, AUTORUN_KEY, 0, winreg.KEY_READ) as key:
            winreg.QueryValueEx(key, AUTORUN_NAME)
            return True
    except FileNotFoundError:
        return False


def add_to_startup():
    if not HAS_WINREG:
        return False
    exe = sys.executable
    script = str(ROOT_DIR / "launchpad.py")
    cmd = f'"{exe}" "{script}" --minimized'
    try:
        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, AUTORUN_KEY, 0, winreg.KEY_SET_VALUE) as key:
            winreg.SetValueEx(key, AUTORUN_NAME, 0, winreg.REG_SZ, cmd)
        return True
    except Exception:
        return False


def remove_from_startup():
    if not HAS_WINREG:
        return False
    try:
        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, AUTORUN_KEY, 0, winreg.KEY_SET_VALUE) as key:
            winreg.DeleteValue(key, AUTORUN_NAME)
        return True
    except FileNotFoundError:
        return True


# ─────────────────────────────────────────────
# ORPHAN CLEANUP
# ─────────────────────────────────────────────

def kill_orphans():
    killed = 0
    try:
        for port in ALL_PORTS:
            killed += _kill_port(port)
    except Exception:
        pass
    return killed

def _kill_port(port: int) -> int:
    killed = 0
    try:
        result = subprocess.run(
            ["netstat", "-aon"], capture_output=True, text=True, timeout=10
        )
        for line in result.stdout.splitlines():
            if "LISTENING" not in line:
                continue
            if f":{port}" not in line:
                continue
            parts = line.split()
            if not parts:
                continue
            pid = parts[-1]
            try:
                subprocess.run(["taskkill", "/pid", pid, "/f"], capture_output=True, timeout=5)
                killed += 1
            except Exception:
                pass
    except Exception:
        pass
    return killed


# ─────────────────────────────────────────────
# MAIN APP
# ─────────────────────────────────────────────

class App(tk.Tk):
    def __init__(self, start_minimized=False):
        super().__init__()
        self.title("QTest Launcher v1.0")
        self.geometry("1000x700")
        self.minsize(800, 500)

        self._config = DEFAULT_CONFIG.copy()
        self._load_config()

        if self._config.get("window"):
            w = self._config["window"]
            self.geometry(f"{w['width']}x{w['height']}+{w['x']}+{w['y']}")

        self._dark_mode = self._config.get("dark_mode", True)
        self._services = SERVICES
        self._service_map = {s.name: s for s in self._services}
        self._log_queue = []
        self._tray_icon = None
        self._tray_thread = None
        self._building = False

        self._setup_styles()
        self._create_menu()
        self._create_toolbar()
        self._create_service_table()
        self._create_log_panel()
        self._create_status_bar()

        self._apply_theme()
        self.protocol("WM_DELETE_WINDOW", self._on_close)
        self.bind("<Control-q>", lambda e: self._on_close())
        self.bind("<Unmap>", self._on_minimize)

        if start_minimized or self._config.get("start_minimized"):
            self.after(200, self._start_in_tray)
        else:
            if self._config.get("auto_start"):
                self.after(500, self._start_all)

        self.after(1000, self._check_ports)
        self._update_status()

    # ─── CONFIG ───

    def _load_config(self):
        try:
            if CONFIG_PATH.exists():
                self._config.update(json.loads(CONFIG_PATH.read_text(encoding="utf-8")))
        except Exception:
            pass

    def _save_config(self):
        self._config["dark_mode"] = self._dark_mode
        self._config["auto_start"] = self.auto_start_var.get()
        self._config["add_to_startup"] = self._startup_var.get()
        try:
            geo = self.geometry()
            size, pos = geo.split("+")
            w, h = size.split("x")
            self._config["window"] = {
                "width": int(w), "height": int(h),
                "x": int(pos.split("+")[1]), "y": int(pos.split("+")[2]),
            }
        except Exception:
            pass
        try:
            CONFIG_PATH.write_text(json.dumps(self._config, indent=2), encoding="utf-8")
        except Exception:
            pass

    # ─── STYLES ───

    def _setup_styles(self):
        style = ttk.Style(self)
        style.theme_use("clam")
        style.configure("Treeview", rowheight=24, font=("Consolas", 9))
        style.configure("Treeview.Heading", font=("Segoe UI", 9, "bold"))
        style.configure("TButton", padding=4)
        style.configure("TLabel", padding=2)
        style.configure("Header.TLabel", font=("Segoe UI", 11, "bold"))
        style.configure("Status.TLabel", font=("Consolas", 9))
        style.configure("Danger.TButton", foreground="red")
        style.configure("Success.TButton", foreground="green")

    # ─── THEME ───

    def _apply_theme(self):
        style = ttk.Style()
        if self._dark_mode:
            bg, fg = "#1a1a1a", "#999999"
            tree_bg, tree_fg = "#1e1e1e", "#aaaaaa"
            heading_bg, entry_bg = "#252525", "#252525"
            btn_bg, btn_active = "#252525", "#1f6feb"
            accent = "#58a6ff"
        else:
            bg, fg = "#f0f0f0", "#333333"
            tree_bg, tree_fg = "#ffffff", "#333333"
            heading_bg, entry_bg = "#e0e0e0", "#ffffff"
            btn_bg, btn_active = "#e0e0e0", "#0078d4"
            accent = "#0078d4"

        self.configure(bg=bg)
        style.configure(".", background=bg, foreground=fg)
        style.configure("TFrame", background=bg)
        style.configure("TLabel", background=bg, foreground=fg)
        style.configure("Header.TLabel", background=bg, foreground=accent)
        style.configure("Status.TLabel", background=bg, foreground=fg)
        style.configure("Treeview", background=tree_bg, foreground=tree_fg,
                         fieldbackground=tree_bg, rowheight=24)
        style.configure("Treeview.Heading", background=heading_bg, foreground=fg,
                         font=("Segoe UI", 9, "bold"))
        style.configure("TButton", background=btn_bg, foreground=fg)
        style.configure("TEntry", fieldbackground=entry_bg, foreground=fg)
        style.configure("TCombobox", fieldbackground=entry_bg, foreground=fg)
        style.configure("TNotebook", background=bg)
        style.configure("TNotebook.Tab", background=btn_bg, foreground="#999999",
                         padding=[12, 6], font=("Segoe UI", 9))
        style.map("TNotebook.Tab",
                   background=[("selected", btn_active)],
                   foreground=[("selected", "#ffffff")])
        style.configure("TScrollbar", background="#777777", troughcolor=bg)
        style.configure("TSeparator", background=entry_bg)
        style.configure("Danger.TButton", background="#da3633", foreground="#ffffff")
        style.configure("Success.TButton", background="#238636", foreground="#ffffff")
        style.configure("TCheckbutton", background=bg, foreground=fg)

        if hasattr(self, "_log_text"):
            self._log_text.configure(bg=tree_bg, fg=tree_fg, insertbackground=fg,
                                      font=("Consolas", self._config.get("font_size", 9)))

    def _toggle_theme(self):
        self._dark_mode = not self._dark_mode
        self._apply_theme()
        self._save_config()

    # ─── MENU ───

    def _create_menu(self):
        menubar = tk.Menu(self)
        self.config(menu=menubar)

        file_menu = tk.Menu(menubar, tearoff=0)
        file_menu.add_command(label="Выход", command=self._on_close, accelerator="Ctrl+Q")
        menubar.add_cascade(label="Файл", menu=file_menu)

        view_menu = tk.Menu(menubar, tearoff=0)
        self._theme_label = tk.StringVar(value="☀️ Светлая тема" if not self._dark_mode else "🌙 Тёмная тема")
        view_menu.add_command(label="Переключить тему", command=self._toggle_theme)
        view_menu.add_separator()
        view_menu.add_command(label="Шрифт +", command=lambda: self._change_font(1))
        view_menu.add_command(label="Шрифт -", command=lambda: self._change_font(-1))
        menubar.add_cascade(label="Вид", menu=view_menu)

        services_menu = tk.Menu(menubar, tearoff=0)
        services_menu.add_command(label="Start All", command=self._start_all)
        services_menu.add_command(label="Stop All", command=self._stop_all)
        services_menu.add_separator()
        services_menu.add_command(label="Build All", command=self._build_all)
        services_menu.add_command(label="Kill orphans", command=self._kill_orphans_action)
        menubar.add_cascade(label="Сервисы", menu=services_menu)

        if HAS_WINREG:
            tools_menu = tk.Menu(menubar, tearoff=0)
            self._startup_label = tk.StringVar()
            self._update_startup_label()
            tools_menu.add_command(label="Toggle autostart", command=self._toggle_startup)
            menubar.add_cascade(label="Инструменты", menu=tools_menu)

        help_menu = tk.Menu(menubar, tearoff=0)
        help_menu.add_command(label="О программе", command=self._show_about)
        menubar.add_cascade(label="Справка", menu=help_menu)

    def _update_startup_label(self):
        if is_in_startup():
            self._startup_label.set("Удалить из автозагрузки")
        else:
            self._startup_label.set("Добавить в автозагрузку")

    def _toggle_startup(self):
        if is_in_startup():
            remove_from_startup()
            self._startup_var.set(False)
        else:
            add_to_startup()
            self._startup_var.set(True)
        self._update_startup_label()
        self._save_config()

    def _change_font(self, delta):
        size = self._config.get("font_size", 9) + delta
        size = max(7, min(16, size))
        self._config["font_size"] = size
        self._log_text.configure(font=("Consolas", size))
        self._save_config()

    def _show_about(self):
        messagebox.showinfo("О программе",
            "QTest Launcher v1.0\n\n"
            "GUI-лаунчер для всех сервисов qtest-runner.\n"
            "9 сервисов, live-логи, тёмная тема, трей.\n\n"
            "Запуск: python launchpad.py")

    # ─── TOOLBAR ───

    def _create_toolbar(self):
        toolbar = ttk.Frame(self)
        toolbar.pack(fill=tk.X, padx=5, pady=(5, 0))

        ttk.Button(toolbar, text="▶ Start All", command=self._start_all,
                    style="Success.TButton").pack(side=tk.LEFT, padx=2)
        ttk.Button(toolbar, text="⏹ Stop All", command=self._stop_all,
                    style="Danger.TButton").pack(side=tk.LEFT, padx=2)
        ttk.Button(toolbar, text="🔄 Restart All", command=self._restart_all).pack(side=tk.LEFT, padx=2)
        ttk.Separator(toolbar, orient=tk.VERTICAL).pack(side=tk.LEFT, fill=tk.Y, padx=5)
        ttk.Button(toolbar, text="🔨 Build", command=self._build_all).pack(side=tk.LEFT, padx=2)
        ttk.Button(toolbar, text="🧹 Kill orphans", command=self._kill_orphans_action).pack(side=tk.LEFT, padx=2)
        ttk.Separator(toolbar, orient=tk.VERTICAL).pack(side=tk.LEFT, fill=tk.Y, padx=5)
        ttk.Button(toolbar, text="📖 Docs", command=self._open_docs).pack(side=tk.LEFT, padx=2)
        ttk.Button(toolbar, text="🌐 Chrome DevTools", command=self._start_chrome_devtools).pack(side=tk.LEFT, padx=2)

        self.auto_start_var = tk.BooleanVar(value=self._config.get("auto_start", False))
        ttk.Checkbutton(toolbar, text="Auto-start",
                         variable=self.auto_start_var,
                         command=self._save_config).pack(side=tk.LEFT, padx=5)

        self._startup_var = tk.BooleanVar(value=is_in_startup())
        if HAS_WINREG:
            ttk.Checkbutton(toolbar, text="Windows startup",
                             variable=self._startup_var,
                             command=self._toggle_startup).pack(side=tk.LEFT, padx=5)

        self._build_label = ttk.Label(toolbar, text="")
        self._build_label.pack(side=tk.RIGHT, padx=5)

    # ─── SERVICE TABLE ───

    def _create_service_table(self):
        frame = ttk.Frame(self)
        frame.pack(fill=tk.X, padx=5, pady=5)

        columns = ("status", "name", "port", "url")
        self.tree = ttk.Treeview(frame, columns=columns, show="headings", height=9)

        self.tree.heading("status", text="●")
        self.tree.heading("name", text="Сервис")
        self.tree.heading("port", text="Порт")
        self.tree.heading("url", text="URL")

        self.tree.column("status", width=30, minwidth=30, stretch=False)
        self.tree.column("name", width=200, minwidth=120)
        self.tree.column("port", width=60, minwidth=50, stretch=False)
        self.tree.column("url", width=250, minwidth=150)

        scrollbar = ttk.Scrollbar(frame, orient=tk.VERTICAL, command=self.tree.yview)
        self.tree.configure(yscrollcommand=scrollbar.set)

        self.tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)

        self.tree.bind("<Double-1>", self._on_service_double_click)

        for svc in self._services:
            self.tree.insert("", tk.END, iid=svc.name,
                              values=("○", svc.name, svc.port,
                                      f"http://localhost:{svc.port}"))

        self._status_icons = {"running": "●", "stopped": "○", "error": "⚠", "building": "🔨"}

    def _on_service_double_click(self, event):
        sel = self.tree.selection()
        if sel:
            name = sel[0]
            svc = self._service_map.get(name)
            if svc:
                if svc.status == "running":
                    self._stop_service(svc)
                else:
                    self._start_service(svc)

    def _update_table(self):
        for svc in self._services:
            icon = self._status_icons.get(svc.status, "○")
            try:
                self.tree.item(svc.name, values=(icon, svc.name, svc.port,
                                                  f"http://localhost:{svc.port}"))
            except Exception:
                pass
        self._update_status()

    # ─── LOG PANEL ───

    def _create_log_panel(self):
        notebook = ttk.Notebook(self)
        notebook.pack(fill=tk.BOTH, expand=True, padx=5, pady=(0, 5))

        # Logs tab
        log_frame = ttk.Frame(notebook)
        notebook.add(log_frame, text="  Logs  ")

        log_toolbar = ttk.Frame(log_frame)
        log_toolbar.pack(fill=tk.X, padx=5, pady=(5, 0))
        ttk.Button(log_toolbar, text="Clear", command=self._clear_logs).pack(side=tk.RIGHT, padx=2)
        ttk.Label(log_toolbar, text="Фильтр:").pack(side=tk.LEFT, padx=(0, 5))
        self._log_filter = tk.StringVar()
        self._log_filter.trace_add("write", lambda *a: self._filter_logs())
        ttk.Entry(log_toolbar, textvariable=self._log_filter, width=20).pack(side=tk.LEFT)

        self._log_text = scrolledtext.ScrolledText(
            log_frame, wrap=tk.WORD, font=("Consolas", 9),
            state=tk.DISABLED, height=12
        )
        self._log_text.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)

        # Health tab
        health_frame = ttk.Frame(notebook)
        notebook.add(health_frame, text="  Health  ")
        self._health_text = scrolledtext.ScrolledText(
            health_frame, wrap=tk.WORD, font=("Consolas", 9),
            state=tk.DISABLED, height=12
        )
        self._health_text.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)

        # Build tab
        build_frame = ttk.Frame(notebook)
        notebook.add(build_frame, text="  Build  ")
        self._build_text = scrolledtext.ScrolledText(
            build_frame, wrap=tk.WORD, font=("Consolas", 9),
            state=tk.DISABLED, height=12
        )
        self._build_text.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)

    def _append_log(self, line):
        self._log_text.configure(state=tk.NORMAL)
        self._log_text.insert(tk.END, line + "\n")
        self._log_text.see(tk.END)
        self._log_text.configure(state=tk.DISABLED)

    def _append_build_log(self, line):
        self._build_text.configure(state=tk.NORMAL)
        self._build_text.insert(tk.END, line + "\n")
        self._build_text.see(tk.END)
        self._build_text.configure(state=tk.DISABLED)

    def _append_health(self, line):
        self._health_text.configure(state=tk.NORMAL)
        self._health_text.insert(tk.END, line + "\n")
        self._health_text.see(tk.END)
        self._health_text.configure(state=tk.DISABLED)

    def _clear_logs(self):
        self._log_text.configure(state=tk.NORMAL)
        self._log_text.delete("1.0", tk.END)
        self._log_text.configure(state=tk.DISABLED)

    def _filter_logs(self):
        filter_text = self._log_filter.get().lower()
        self._log_text.configure(state=tk.NORMAL)
        self._log_text.delete("1.0", tk.END)
        for svc in self._services:
            for line in svc.logs:
                if not filter_text or filter_text in line.lower():
                    self._log_text.insert(tk.END, line + "\n")
        self._log_text.see(tk.END)
        self._log_text.configure(state=tk.DISABLED)

    # ─── STATUS BAR ───

    def _create_status_bar(self):
        self._status_bar = ttk.Frame(self)
        self._status_bar.pack(fill=tk.X, side=tk.BOTTOM)

        self._status_label = ttk.Label(self._status_bar, text="", style="Status.TLabel")
        self._status_label.pack(side=tk.LEFT, padx=5, pady=2)

        self._right_label = ttk.Label(self._status_bar, text="", style="Status.TLabel")
        self._right_label.pack(side=tk.RIGHT, padx=5, pady=2)

    def _update_status(self):
        running = sum(1 for s in self._services if s.status == "running")
        total = len(self._services)
        ports = ", ".join(str(s.port) for s in self._services)
        build_status = "⚠ Building..." if self._building else "OK"

        self._status_label.config(text=f"Services: {running}/{total}  │  Ports: {ports}")
        self._right_label.config(text=f"Build: {build_status}")

        if HAS_TRAY and self._tray_icon:
            try:
                self._tray_icon.icon = create_tray_image(running, total)
            except Exception:
                pass

    # ─── SERVICE MANAGEMENT ───

    def _start_service(self, svc):
        if svc.status == "running" and svc.process and svc.process.poll() is None:
            return
        _kill_port(svc.port)
        cwd = str(ROOT_DIR / svc.cwd)
        # Auto-build if dist entry is missing
        if svc.command[0] == 'node' and len(svc.command) > 1:
            entry = Path(cwd) / svc.command[1]
            if not entry.exists():
                self._append_log(f"{self._ts()} [{svc.name}:{svc.port}] dist missing — rebuilding...")
                try:
                    subprocess.run(['npx.cmd', 'tsc'], cwd=cwd, capture_output=True, timeout=120,
                                   creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
                except Exception as e:
                    self._append_log(f"{self._ts()} [{svc.name}:{svc.port}] build failed: {e}")
                    svc.status = "error"
                    self._update_table()
                    return
        try:
            svc.process = subprocess.Popen(
                svc.command,
                cwd=cwd,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1,
                creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
            )
            svc.status = "running"
            svc.logs.append(f"{self._ts()} [{svc.name}:{svc.port}] STARTED (PID {svc.process.pid})")
            svc.log_thread = threading.Thread(target=self._read_service_output, args=(svc,), daemon=True)
            svc.log_thread.start()
            self._update_table()
        except Exception as e:
            svc.status = "error"
            svc.logs.append(f"{self._ts()} [{svc.name}:{svc.port}] ERROR: {e}")
            self._update_table()

    def _stop_service(self, svc):
        if svc.process:
            try:
                svc.process.terminate()
                try:
                    svc.process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    svc.process.kill()
                    svc.process.wait(timeout=3)
            except Exception:
                pass
            svc.process = None
        svc.status = "stopped"
        svc.logs.append(f"{self._ts()} [{svc.name}:{svc.port}] STOPPED")
        self._update_table()

    def _start_all(self):
        def _run():
            for svc in self._services:
                if svc.status != "running":
                    self.after(0, self._start_service, svc)
                    time.sleep(0.5)
        threading.Thread(target=_run, daemon=True).start()

    def _stop_all(self):
        def _run():
            for svc in self._services:
                self._stop_service(svc)
            self.after(0, self._update_table)
        threading.Thread(target=_run, daemon=True).start()

    def _restart_all(self):
        def _run():
            for svc in self._services:
                self._stop_service(svc)
            time.sleep(1)
            for svc in self._services:
                if svc.status != "running":
                    self.after(0, self._start_service, svc)
                    time.sleep(0.5)
        threading.Thread(target=_run, daemon=True).start()

    def _read_service_output(self, svc):
        try:
            batch = []
            for line in svc.process.stdout:
                if not line:
                    break
                ts = self._ts()
                log_line = f"{ts} [{svc.name}:{svc.port}] {line.rstrip()}"
                svc.logs.append(log_line)
                batch.append(log_line)
                if len(batch) >= 20:
                    self.after(0, self._append_batch_log, batch)
                    batch = []
            if batch:
                self.after(0, self._append_batch_log, batch)
        except Exception:
            pass
        finally:
            if svc.process and svc.process.poll() is not None:
                exit_code = svc.process.returncode
                svc.status = "stopped" if exit_code == 0 else "error"
                svc.logs.append(f"{self._ts()} [{svc.name}:{svc.port}] EXIT (code {exit_code})")
                self.after(0, self._update_table)

    def _append_batch_log(self, lines):
        self._log_text.configure(state=tk.NORMAL)
        for line in lines:
            self._log_text.insert(tk.END, line + "\n")
        self._log_text.see(tk.END)
        self._log_text.configure(state=tk.DISABLED)

    # ─── BUILD ───

    def _build_all(self):
        if self._building:
            return
        self._building = True
        self._update_status()

        def _run():
            self.after(0, self._append_build_log, f"{self._ts()} === Starting build ===")
            try:
                result = subprocess.run(
                    ["npx", "turbo", "run", "build"],
                    cwd=str(ROOT_DIR),
                    capture_output=True, text=True,
                    timeout=300,
                    creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
                )
                for line in result.stdout.splitlines():
                    self.after(0, self._append_build_log, line)
                if result.returncode == 0:
                    self.after(0, self._append_build_log, f"{self._ts()} === Build OK ===")
                else:
                    self.after(0, self._append_build_log, f"{self._ts()} === Build FAILED (code {result.returncode}) ===")
            except Exception as e:
                self.after(0, self._append_build_log, f"{self._ts()} === Build ERROR: {e} ===")
            finally:
                self._building = False
                self.after(0, self._update_status)

        threading.Thread(target=_run, daemon=True).start()

    # ─── PORT CHECK ───

    def _check_ports(self):
        def _run():
            for svc in self._services:
                if svc.process and svc.process.poll() is not None:
                    exit_code = svc.process.returncode
                    svc.status = "stopped" if exit_code == 0 else "error"
                    continue
                try:
                    sock = socket.create_connection(("localhost", svc.port), timeout=1)
                    sock.close()
                    new_status = "running"
                except (ConnectionRefusedError, OSError, TimeoutError):
                    new_status = "stopped"
                if svc.status != new_status:
                    svc.status = new_status
                    self.after(0, self._update_table)
        threading.Thread(target=_run, daemon=True).start()
        self.after(5000, self._check_ports)

    # ─── HEALTH CHECK ───

    def _health_check_action(self):
        def _run():
            self._health_text.configure(state=tk.NORMAL)
            self._health_text.delete("1.0", tk.END)
            self._health_text.insert(tk.END, f"{self._ts()} Health check...\n")
            self._health_text.configure(state=tk.DISABLED)

            for svc in self._services:
                try:
                    sock = socket.create_connection(("localhost", svc.port), timeout=2)
                    sock.close()
                    line = f"  ✅ {svc.name}:{svc.port} — UP"
                except (ConnectionRefusedError, OSError, TimeoutError):
                    line = f"  ❌ {svc.name}:{svc.port} — DOWN"
                self.after(0, self._append_health, line)

            self.after(0, self._append_health, f"{self._ts()} Done.\n")

        threading.Thread(target=_run, daemon=True).start()

    # ─── ORPHAN KILL ───

    def _kill_orphans_action(self):
        killed = kill_orphans()
        self._append_log(f"{self._ts()} Killed {killed} orphan process(es)")

    def _open_docs(self):
        docs_port = 5173
        import webbrowser
        webbrowser.open(f"http://localhost:{docs_port}")
        self._append_log(f"{self._ts()} Opened VitePress docs (port {docs_port})")

    def _start_chrome_devtools(self):
        chrome_path = r"C:\Program Files\Google\Chrome Dev\Application\chrome.exe"
        if not os.path.exists(chrome_path):
            self._append_log(f"{self._ts()} Chrome Dev not found at: {chrome_path}")
            return
        import subprocess
        try:
            subprocess.Popen([chrome_path, "--remote-debugging-port=9222", "--no-first-run"],
                             creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
            self._append_log(f"{self._ts()} Chrome DevTools started on port 9222")
        except Exception as e:
            self._append_log(f"{self._ts()} Failed to start Chrome: {e}")

    # ─── UTILITY ───

    def _ts(self):
        return datetime.now().strftime("%H:%M:%S")

    # ─── TRAY ───

    def _start_in_tray(self):
        if not HAS_TRAY:
            if self._config.get("auto_start"):
                self.after(500, self._start_all)
            return
        self.withdraw()
        self._create_tray_icon()

    def _create_tray_icon(self):
        if not HAS_TRAY:
            return
        try:
            running = sum(1 for s in self._services if s.status == "running")
            menu = pystray.Menu(
                pystray.MenuItem("Показать", self._tray_show, default=True),
                pystray.Menu.SEPARATOR,
                pystray.MenuItem("Start All", self._tray_start_all),
                pystray.MenuItem("Stop All", self._tray_stop_all),
                pystray.Menu.SEPARATOR,
                pystray.MenuItem("Выход", self._tray_exit),
            )
            icon_image = create_tray_image(running, len(self._services))
            self._tray_icon = pystray.Icon(
                "QTestLauncher",
                icon_image,
                "QTest Launcher",
                menu,
            )
            self._tray_thread = threading.Thread(target=self._tray_icon.run, daemon=True)
            self._tray_thread.start()
        except Exception as e:
            print(f"Tray error: {e}")
            self._tray_icon = None

    def _tray_show(self, icon=None, item=None):
        self.after(0, self._show_window)

    def _tray_start_all(self, icon=None, item=None):
        self.after(0, self._start_all)

    def _tray_stop_all(self, icon=None, item=None):
        self.after(0, self._stop_all)

    def _tray_exit(self, icon=None, item=None):
        if self._tray_icon:
            self._tray_icon.stop()
        self.after(0, self._force_exit)

    def _show_window(self):
        self.deiconify()
        self.lift()
        self.focus_force()

    def _force_exit(self):
        self._stop_all()
        self._save_config()
        self.destroy()

    # ─── CLOSE / MINIMIZE ───

    def _on_minimize(self, event=None):
        if HAS_TRAY and self.winfo_viewable():
            self.withdraw()
            if not self._tray_icon:
                self._create_tray_icon()

    def _on_close(self):
        if HAS_TRAY:
            self.withdraw()
            if not self._tray_icon:
                self._create_tray_icon()
        else:
            if messagebox.askokcancel("Выход", "Остановить все сервисы и выйти?"):
                self._force_exit()


# ─────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────

def main():
    start_minimized = "--minimized" in sys.argv

    if not ROOT_DIR.exists():
        print(f"ERROR: Root dir not found: {ROOT_DIR}")
        sys.exit(1)

    if not (ROOT_DIR / "node_modules").exists():
        print("ERROR: node_modules not found. Run: npm install")
        sys.exit(1)

    app = App(start_minimized=start_minimized)
    app.mainloop()


if __name__ == "__main__":
    main()
