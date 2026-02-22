import { spawn, ChildProcess } from "child_process";
import { config } from "../config.js";

let engineProcess: ChildProcess | null = null;

export function startEngine(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (engineProcess) {
      resolve();
      return;
    }

    const args = [
      "--websocket-port", String(config.intifacePort),
    ];

    console.log(`[Engine] Starting Intiface Engine on port ${config.intifacePort}`);

    engineProcess = spawn("intiface-engine", args, {
      stdio: ["ignore", "pipe", "pipe"],
    });

    engineProcess.stdout?.on("data", (data: Buffer) => {
      console.log(`[Engine] ${data.toString().trim()}`);
    });

    engineProcess.stderr?.on("data", (data: Buffer) => {
      console.error(`[Engine] ${data.toString().trim()}`);
    });

    engineProcess.on("error", (err) => {
      console.error("[Engine] Failed to start:", err.message);
      engineProcess = null;
      reject(err);
    });

    engineProcess.on("exit", (code) => {
      console.log(`[Engine] Exited with code ${code}`);
      engineProcess = null;
    });

    // Give the engine time to start up
    setTimeout(() => {
      if (engineProcess && !engineProcess.killed) {
        resolve();
      } else {
        reject(new Error("Intiface Engine did not start"));
      }
    }, 2000);
  });
}

export function stopEngine(): void {
  if (engineProcess) {
    console.log("[Engine] Stopping Intiface Engine");
    engineProcess.kill("SIGTERM");
    engineProcess = null;
  }
}

export function isEngineRunning(): boolean {
  return engineProcess !== null && !engineProcess.killed;
}
