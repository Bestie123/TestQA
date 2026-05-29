export const AutoCommit = async ({ $, directory, worktree }) => {
  return {
    "tool.execute.after": async (input, output) => {
      const commitTools = ["edit", "write", "apply_patch"]
      if (!commitTools.includes(input.tool)) return
      if (output.error) return

      const filePath = output?.args?.filePath || ""
      const desc = filePath ? `${input.tool}: ${filePath}` : `auto: ${input.tool} change`

      try {
        const diff = await $`git diff --stat`.text()
        if (!diff.trim()) return
        await $`git add -A`
        await $`git commit -m ${desc}`
      } catch {
        // игнорируем ошибки git (нет репозитория, ничего для коммита и т.д.)
      }
    },
  }
}
