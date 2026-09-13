import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve, relative, isAbsolute } from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'
import ts from 'typescript'

test('compiled gallery loads with JavaScript server dependencies', async t => {
  const root = fileURLToPath(new URL('../', import.meta.url))
  const config = ts.readConfigFile(join(root, 'tsconfig.json'), ts.sys.readFile)
  assert.equal(config.error, undefined)
  const { options } = ts.parseJsonConfigFileContent(config.config, ts.sys, root)
  const directory = await mkdtemp(join(tmpdir(), 's2b-deployment-'))
  t.after(async () => {
    const withinTemp = relative(resolve(tmpdir()), resolve(directory))
    assert.ok(withinTemp && !withinTemp.startsWith('..') && !isAbsolute(withinTemp))
    await rm(directory, { recursive: true })
  })
  await writeFile(join(directory, 'package.json'), JSON.stringify({ type: 'module' }))
  // Match Vercel's output layout: compiled .js files, without the .ts sources.
  const program = ts.createProgram([join(root, 'api/gallery.ts')], {
    ...options, rootDir: root, outDir: directory, noEmit: false,
    target: ts.ScriptTarget.ES2023, types: ['node'], skipLibCheck: true,
  })
  const diagnostics = ts.getPreEmitDiagnostics(program)
  assert.deepEqual(diagnostics.map(item => ts.flattenDiagnosticMessageText(item.messageText, '\n')), [])
  assert.equal(program.emit().emitSkipped, false)
  const { default: handler } = await import(pathToFileURL(join(directory, 'api/gallery.js')).href)
  const response = {
    statusCode: 0,
    setHeader() {},
    end(body) { this.body = JSON.parse(body) },
  }
  // Loading the handler resolves both server modules before handling this request.
  await handler({ method: 'PATCH', headers: {} }, response)
  assert.equal(response.statusCode, 405)
  assert.deepEqual(response.body, { error: 'Method not allowed.' })
})
