import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ffmpegPath = require('ffmpeg-static');

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    proc.stderr.on('data', (data) => { stderr += data.toString(); });
    proc.once('error', reject);
    proc.once('close', (code) => {
      if (code === 0) resolve(stderr);
      else reject(new Error(`FFmpeg exited ${code}: ${stderr.slice(-3000)}`));
    });
  });
}

async function feedWebmToMasterRecorder(sourcePath, outputPath) {
  const source = await fs.readFile(sourcePath);
  const proc = spawn(ffmpegPath, [
    '-probesize', '2M', '-analyzeduration', '1000000',
    '-f', 'webm', '-i', 'pipe:0',
    '-map', '0:v:0', '-map', '0:a?',
    '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '18',
    '-maxrate', '10M', '-bufsize', '20M', '-pix_fmt', 'yuv420p',
    '-r', '30', '-g', '60', '-keyint_min', '30',
    '-c:a', 'aac', '-b:a', '192k', '-ar', '48000',
    '-movflags', '+faststart', '-y', outputPath,
  ], { stdio: ['pipe', 'ignore', 'pipe'] });
  let stderr = '';
  proc.stderr.on('data', (data) => { stderr += data.toString(); });
  const closed = once(proc, 'close');
  for (let offset = 0; offset < source.length; offset += 64 * 1024) {
    if (!proc.stdin.write(source.subarray(offset, offset + 64 * 1024))) await once(proc.stdin, 'drain');
  }
  proc.stdin.end();
  const [code] = await closed;
  assert.equal(code, 0, `Master FFmpeg finalization failed: ${stderr.slice(-3000)}`);
}

test('records a valid master MP4 and exports all four aspect ratios with thumbnails', { timeout: 120000 }, async () => {
  assert.ok(ffmpegPath, 'ffmpeg-static must be installed');
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'podcastudio-recording-test-'));
  try {
    const sourcePath = path.join(tempRoot, 'source.webm');
    const masterPath = path.join(tempRoot, 'master.mp4');
    await runFfmpeg([
      '-f', 'lavfi', '-i', 'testsrc2=size=640x360:rate=30',
      '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000',
      '-t', '2', '-c:v', 'libvpx', '-deadline', 'realtime', '-cpu-used', '8', '-b:v', '2M',
      '-c:a', 'libopus', '-b:a', '96k', '-f', 'webm', '-y', sourcePath,
    ]);
    await feedWebmToMasterRecorder(sourcePath, masterPath);

    const masterStat = await fs.stat(masterPath);
    assert.ok(masterStat.size > 10000, 'master MP4 must contain video and audio data');
    await runFfmpeg(['-v', 'error', '-i', masterPath, '-f', 'null', '-']);

    const formats = [
      ['Facebook_16x9', 'scale=1920:1080', '1920x1080'],
      ['YouTube_16x9', 'scale=1920:1080', '1920x1080'],
      ['TikTok_Reels_9x16', 'crop=ih*9/16:ih:(iw-ih*9/16)/2:0,scale=1080:1920', '1080x1920'],
      ['Instagram_Feed_1x1', 'crop=ih:ih:(iw-ih)/2:0,scale=1080:1080', '1080x1080'],
      ['Facebook_Feed_4x5', 'crop=ih*4/5:ih:(iw-ih*4/5)/2:0,scale=1080:1350', '1080x1350'],
    ];

    const outputNames = new Set();
    for (const [suffix, filter, dimensions] of formats) {
      const outputPath = path.join(tempRoot, `${suffix}.mp4`);
      const thumbnailPath = outputPath.replace(/\.mp4$/i, '_Thumbnail.jpg');
      outputNames.add(path.basename(outputPath));
      await runFfmpeg([
        '-y', '-i', masterPath, '-vf', filter,
        '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '18', '-pix_fmt', 'yuv420p',
        '-c:a', 'copy', '-movflags', '+faststart', outputPath,
      ]);
      const probe = await runFfmpeg(['-i', outputPath, '-f', 'null', '-']);
      assert.ok(probe.includes(dimensions), `${suffix} should be ${dimensions}`);
      await runFfmpeg(['-y', '-ss', '00:00:00.800', '-i', outputPath, '-vframes', '1', '-q:v', '2', thumbnailPath]);
      const thumb = await fs.readFile(thumbnailPath);
      assert.ok(thumb.length > 1000, `${suffix} thumbnail must be non-empty`);
      assert.equal(thumb[0], 0xff, `${suffix} thumbnail should be a JPEG`);
      assert.equal(thumb[1], 0xd8, `${suffix} thumbnail should be a JPEG`);
    }
    assert.equal(outputNames.size, 5, 'Facebook and YouTube horizontal exports must not overwrite each other');
  } finally {
    const absoluteTempRoot = path.resolve(tempRoot);
    const allowedTempRoot = path.resolve(os.tmpdir()) + path.sep;
    if (!absoluteTempRoot.startsWith(allowedTempRoot)) throw new Error('Refusing to clean test files outside the temporary directory');
    await fs.rm(absoluteTempRoot, { recursive: true, force: true });
  }
});
