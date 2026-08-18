#!/usr/bin/env node
import { spawn } from 'node:child_process';

const api = spawn('node', ['packages/api/bin/server.js'], { stdio: 'inherit', shell: true });
const web = spawn('npm', ['run', 'dev', '-w', 'packages/web'], { stdio: 'inherit', shell: true });

function cleanup() {
  api.kill();
  web.kill();
  process.exit();
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

api.on('close', cleanup);
web.on('close', cleanup);
