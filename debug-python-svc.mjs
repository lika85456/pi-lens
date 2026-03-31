#!/usr/bin/env node
// Debug Python LSP via service with more logging

import { getLSPService, resetLSPService } from './clients/lsp/index.js';
import fs from 'fs/promises';
import path from 'path';

const service = getLSPService();

async function debugPython() {
  const testDir = path.resolve('test-py-svc');
  await fs.mkdir(testDir, { recursive: true });
  await fs.writeFile(path.join(testDir, 'requirements.txt'), '# test\n');
  
  const testContent = `def test():\n    x = "hello" + 5\n    return x`;
  const testFile = path.join(testDir, 'test.py');
  await fs.writeFile(testFile, testContent);
  
  console.log('=== Debug Python LSP via Service ===\n');
  
  const hasLSP = await service.hasLSP(testFile);
  console.log(`hasLSP: ${hasLSP ? '✅' : '❌'}`);
  
  if (hasLSP) {
    console.log('Opening file...');
    await service.openFile(testFile, testContent);
    console.log('File opened');
    
    console.log('Waiting 5s...');
    await new Promise(r => setTimeout(r, 5000));
    
    console.log('Getting diagnostics...');
    const diags = await service.getDiagnostics(testFile);
    console.log(`Got ${diags.length} diagnostics`);
    
    diags.forEach(d => {
      console.log(`  Line ${d.range?.start?.line + 1}: ${d.message?.slice(0, 40)}`);
    });
    
    console.log('\nWaiting another 5s and trying again...');
    await new Promise(r => setTimeout(r, 5000));
    const diags2 = await service.getDiagnostics(testFile);
    console.log(`Second check: ${diags2.length} diagnostics`);
  }
  
  await service.shutdown();
  resetLSPService();
  await fs.rm(testDir, { recursive: true, force: true });
}

debugPython().catch(console.error);
