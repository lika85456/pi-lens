import { spawnSync } from "node:child_process";
import * as path from "node:path";
export class SubprocessClient {
    constructor(verbose = false) {
        this.available = null;
        this.toolName = this.getToolName();
        this.log = verbose
            ? (msg) => console.error(`[${this.toolName}] ${msg}`)
            : () => { };
    }
    isAvailable() {
        if (this.available !== null)
            return this.available;
        const cmd = this.getCheckCommand();
        try {
            const result = spawnSync(cmd[0], cmd.slice(1), {
                encoding: "utf-8",
                timeout: 10000,
                shell: true,
            });
            this.available = !result.error && result.status === 0;
            if (this.available) {
                this.log(`${this.toolName} found`);
            }
            else {
                this.log(`${this.toolName} not available`);
            }
        }
        catch (err) {
            void err;
            this.available = false;
        }
        return this.available;
    }
    isSupportedFile(filePath) {
        const ext = path.extname(filePath).toLowerCase();
        return this.getSupportedExtensions().includes(ext);
    }
    runCommand(cmd, options = {}) {
        const { cwd, timeout = 15000, input } = options;
        try {
            const result = spawnSync(cmd[0], cmd.slice(1), {
                encoding: "utf-8",
                timeout,
                cwd,
                shell: true,
                input,
            });
            if (result.error) {
                this.log(`Command error: ${result.error.message}`);
            }
            return result;
        }
        catch (err) {
            this.log(`Command failed: ${err.message}`);
            return {
                error: err,
                status: 1,
                stdout: "",
                stderr: err.message,
            };
        }
    }
}
