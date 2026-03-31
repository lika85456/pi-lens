#!/usr/bin/env node
// Test Python LSP through service layer

import { getLSPService, resetLSPService } from './clients/lsp/index.js';
import fs from 'fs/promises';
import path from 'path';

const service = getLSPService();

async function testPython() {
  console.log('=== Python LSP Test (via Service) ===\n');
  
  const testDir = path.resolve('test-py-project');
  await fs.mkdir(testDir, { recursive: true });
  await fs.writeFile(path.join(testDir, 'requirements.txt'), '# test\n');
  
  const testContent = `
def test():
    x = 1
    y = "hello" + 5  # Type error: can't add string and int
    return x
`;
  const testFile = path.join(testDir, 'test.py');
  await fs.writeFile(testFile, testContent);
  
  console.log(`Test file: ${testFile}`);
  
  const hasLSP = await service.hasLSP(testFile);
  console.log(`LSP Available: ${hasLSP ? '✅ Yes' : '❌ No'}`);
  
  if (!hasLSP) {
    console.log('Python LSP not available');
    await fs.rm(testDir, { recursive: true, force: true });
    return false;
  }
  
  try {
    await service.openFile(testFile, testContent);
    console.log('File opened: ✅');
    
    console.log('Waiting 10 seconds for analysis...');
    await new Promise(r => setTimeout(r, 10000));
    
    const diags = await service.getDiagnostics(testFile);
    console.log(`\nDiagnostics: ${diags.length} issue(s)`);
    
    diags.forEach((d, i) => {
      const line = (d.range?.start?.line ?? 0) + 1;
      const icon = d.severity === 1 ? '🔴' : d.severity === 2 ? '🟡' : '🔵';
      console.log(`  ${i+1}. ${icon} Line ${line}: ${d.message?.slice(0, 50)}`);
    });
    
    await service.shutdown();
    resetLSPService();
    await fs.rm(testDir, { recursive: true, force: true });
    
    return diags.length > 0;
  } catch (err) {
    console.error('Error:', err.message);
    await fs.rm(testDir, { recursive: true, force: true });
    return false;
  }
}

testPython().then(success => {
  console.log(`\n${'='.repeat(40)}`);
  console.log(`Result: ${success ? '✅ Python LSP Working' : '❌ Python LSP Issues'}`);
}).catch(console.error);
