#!/usr/bin/env node
// Test pyright spawn directly

import { launchViaPackageManager } from './clients/lsp/launch.js';
import { createMessageConnection, StreamMessageReader, StreamMessageWriter } from 'vscode-jsonrpc/node.js';
import { pathToFileURL } from 'url';
import fs from 'fs/promises';
import path from 'path';

async function testSpawn() {
  const testDir = path.resolve('test-py-spawn');
  await fs.mkdir(testDir, { recursive: true });
  await fs.writeFile(path.join(testDir, 'requirements.txt'), '# test\n');
  
  const testFile = path.join(testDir, 'test.py');
  await fs.writeFile(testFile, 'def test():\n    x = "hi" + 5\n    return x');
  
  console.log('Spawning pyright via launchViaPackageManager...');
  const handle = launchViaPackageManager('pyright-langserver', ['--stdio'], { cwd: testDir });
  
  console.log('PID:', handle.pid);
  console.log('Stdin:', !!handle.stdin);
  console.log('Stdout:', !!handle.stdout);
  
  // Capture stderr
  handle.stderr.on('data', (data) => {
    console.log('[stderr]:', data.toString().trim());
  });
  
  const conn = createMessageConnection(
    new StreamMessageReader(handle.stdout),
    new StreamMessageWriter(handle.stdin)
  );
  
  let diags = [];
  conn.onNotification('textDocument/publishDiagnostics', (params) => {
    console.log('Received diags:', params.diagnostics?.length);
    diags = params.diagnostics || [];
  });
  
  conn.listen();
  
  console.log('\nSending initialize...');
  await conn.sendRequest('initialize', {
    processId: process.pid,
    rootUri: pathToFileURL(testDir).href,
    capabilities: { textDocument: { publishDiagnostics: {} } }
  });
  await conn.sendNotification('initialized', {});
  
  console.log('Opening file...');
  await conn.sendNotification('textDocument/didOpen', {
    textDocument: {
      uri: pathToFileURL(testFile).href,
      languageId: 'python',
      version: 0,
      text: await fs.readFile(testFile, 'utf-8')
    }
  });
  
  console.log('Waiting 8s...');
  await new Promise(r => setTimeout(r, 8000));
  
  console.log(`\nResult: ${diags.length > 0 ? '✅ Working' : '❌ No diags'}`);
  if (diags.length > 0) {
    diags.forEach(d => console.log(`  Line ${d.range?.start?.line + 1}: ${d.message?.slice(0, 40)}`));
  }
  
  handle.process.kill();
  await fs.rm(testDir, { recursive: true, force: true });
}

testSpawn().catch(console.error);
