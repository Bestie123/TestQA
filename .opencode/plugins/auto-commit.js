import fs from "node:fs"
import path from "node:path"

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// исключаем служебные директории
const IGNORE = new Set([".git", "node_modules", ".opencode", ".cache", "dist", "build", ".vscode"])

export const AutoCommit = async ({ $, project, directory }) => {
  let watcher = null
  let debounceTimer = null
  let committing = false

  const commitChanges = async (source) => {
    if (committing) return
    committing = true
    try {
      const result = await $`git status --porcelain`
      const text = result.stdout?.toString()?.trim()
      if (text) {
        await $`git add -A`
        const msg = `opencode: autocommit (${source})`
        await $`git commit -m ${msg}`
      }
    } catch (e) {
      // игнорируем
    } finally {
      committing = false
    }
  }

  const debouncedCommit = (source) => {
    clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => commitChanges(source), 1000)
  }

  // запускаем FileSystemWatcher для отслеживания внешних изменений
  try {
    watcher = fs.watch(directory, { recursive: true }, (event, filename) => {
      if (!filename) return
      const parts = filename.split(/[/\\]/)
      if (parts.some((p) => IGNORE.has(p))) return
      debouncedCommit("watcher")
    })
  } catch (e) {
    // recursive watch может не поддерживаться — игнорируем
  }

  return {
    "tool.execute.after": async (input, output) => {
      if (["edit", "write", "apply_patch", "bash"].includes(input.tool)) {
        await sleep(300)
        const source = input.tool === "bash" ? "shell" : output?.args?.filePath || input.tool
        await commitChanges(source)
      }
    },
  }
}
