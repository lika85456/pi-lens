#!/usr/bin/env node
// Debug Python LSP through service

import { getLSPService, resetLSPService } from './clients/lsp/index.js';
import fs from 'fs/promises';
import path from 'path';

const service = getLSPService();

async function debugPython() {
  console.log('=== Debug Python LSP ===\n');
  
  const testDir = path.resolve('test-py-debug2');
  await fs.mkdir(testDir, { recursive: true });
  await fs.writeFile(path.join(testDir, 'requirements.txt'), '# test\n');
  
  const testContent = `def test():\n    x = "hello" + 5\n    return x`;
  const testFile = path.join(testDir, 'test.py');
  await fs.writeFile(testFile, testContent);
  
  console.log('Checking hasLSP...');
  const hasLSP = await service.hasLSP(testFile);
  console.log(`hasLSP: ${hasLSP ? '✅' : '❌'}`);
  
  if (!hasLSP) {
    await fs.rm(testDir, { recursive: true, force: true });
    return;
  }
  
  console.log('\nOpening file...');
  await service.openFile(testFile, testContent);
  console.log('File opened');
  
  console.log('Getting diagnostics (with 8s wait)...');
  const diags = await service.getDiagnostics(testFile);
  console.log(`Got ${diags.length} diagnostics`);
  
  diags.forEach((d, i) => {
    console.log(`  ${i+1}. Line ${(d.range?.start?.line ?? 0) + 1}: ${d.message?.slice(0, 40)}`);
  });
  
  await service.shutdown();
  resetLSPService();
  await fs.rm(testDir, { recursive: true, force: true });
}

debugPython().catch(console.error);
