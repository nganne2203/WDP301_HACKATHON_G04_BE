import { readdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

const testFiles = readdirSync(new URL('.', import.meta.url))
  .filter((file) => file.endsWith('.test.js'))
  .sort()

for (const testFile of testFiles) {
  const result = spawnSync(process.execPath, ['--test', `tests/${testFile}`], {
    stdio: 'inherit'
  })

  if (result.status !== 0) process.exit(result.status || 1)
}
