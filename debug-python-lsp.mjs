#!/usr/bin/env node
// Debug Python LSP - check if diagnostics are received

import { spawn } from 'child_process';
import { createMessageConnection, StreamMessageReader, StreamMessageWriter } from 'vscode-jsonrpc/node.js';
import { pathToFileURL } from 'url';
import fs from 'fs/promises';
import path from 'path';

const testContent = `
def test():
    x = 1
    y = "hello" + 5  # Type error: can't add string and int
    return x
`;

async function main() {
  const testDir = path.resolve('test-py-debug');
  await fs.mkdir(testDir, { recursive: true });
  await fs.writeFile(path.join(testDir, 'requirements.txt'), '# test\n');
  const testFile = path.join(testDir, 'test.py');
  await fs.writeFile(testFile, testContent);
  
  console.log('=== Debug Python LSP (Pyright) ===\n');
  console.log('Test file:', testFile);
  
  // Spawn pyright via npx
  const proc = spawn('npx', ['-y', 'pyright-langserver', '--stdio'], {
    cwd: testDir,
    stdio: ['pipe', 'pipe', 'pipe'],
    shell: true,
    windowsHide: true,
  });
  
  console.log('Spawned PID:', proc.pid);
  
  // Capture stderr
  proc.stderr.on('data', (data) => {
    console.log('[stderr]:', data.toString().trim());
  });
  
  const conn = createMessageConnection(
    new StreamMessageReader(proc.stdout),
    new StreamMessageWriter(proc.stdin)
  );
  
  let diagsReceived = [];
  conn.onNotification('textDocument/publishDiagnostics', (params) => {
    console.log('\n📊 Received diagnostics:', params.diagnostics?.length || 0);
    console.log('URI:', params.uri);
    diagsReceived = params.diagnostics || [];
    if (diagsReceived.length > 0) {
      diagsReceived.forEach((d, i) => {
        console.log(`  ${i+1}. Line ${d.range?.start?.line + 1}: ${d.message?.slice(0, 50)}`);
      });
    }
  });
  
  conn.listen();
  
  // Initialize
  console.log('\nSending initialize...');
  const initResult = await conn.sendRequest('initialize', {
    processId: process.pid,
    rootUri: pathToFileURL(testDir).href,
    capabilities: {
      textDocument: { publishDiagnostics: {} }
    },
    initializationOptions: {
      // Pyright specific options
      python: {
        analysis: {
          typeCheckingMode: 'basic'
        }
      }
    }
  });
  console.log('Initialize result:', initResult ? '✅' : '❌');
  
  await conn.sendNotification('initialized', {});
  
  // Open file
  console.log('\nSending didOpen...');
  await conn.sendNotification('textDocument/didOpen', {
    textDocument: {
      uri: pathToFileURL(testFile).href,
      languageId: 'python',
      version: 0,
      text: testContent,
    },
  });
  
  // Wait for diagnostics
  console.log('Waiting 10 seconds...');
  await new Promise(r => setTimeout(r, 10000));
  
  console.log(`\n=== Final Result: ${diagsReceived.length > 0 ? '✅ Working' : '❌ No diagnostics'} ===`);
  
  proc.kill();
  await fs.rm(testDir, { recursive: true, force: true });
}

main().catch(console.error);
