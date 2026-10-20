const { _electron: electron } = require('playwright');
const { expect } = require('@playwright/test');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
(async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'utube-recovery-'));
  const prefs = path.join(root, 'prefs'); const folder = path.join(root, 'Downloads'); const media = path.join(root, 'fixture.mp4');
  await fs.mkdir(prefs); await fs.mkdir(folder);
  await fs.writeFile(path.join(prefs, 'settings.json'), JSON.stringify({ folder }));
  execFileSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'color=c=blue:s=640x360:r=10', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=1', '-t', '1', '-c:v', 'libx264', '-preset', 'ultrafast', '-c:a', 'aac', media]);
  const env = { ...process.env, UTUBE_TEST_USER_DATA: prefs, UTUBE_TEST_MEDIA: media, UTUBE_TEST_DELAY: '800', UTUBE_TEST_FAIL_ONCE: '1' }; delete env.ELECTRON_RUN_AS_NODE;
  const args = [path.resolve(__dirname, '..')]; if (process.env.UTUBE_TEST_NO_SANDBOX === '1') args.unshift('--no-sandbox');
  const app = await electron.launch({ executablePath: require('electron'), args, env });
  let closed = false;
  try {
    const page = await app.firstWindow();
    await page.getByRole('textbox', {name:'YouTube URL'}).fill('https://youtube.com/playlist?list=PL123');
    await page.getByRole('button', {name:'Find',exact:true}).click();
    await expect(page.getByText('2 selected')).toBeVisible();
    await page.getByRole('button', {name:'Download 2 videos',exact:true}).click();
    await expect.poll(() => page.evaluate(async()=> (await window.utube.jobs()).map(job=>job.status)), {timeout:20000}).toEqual(['saved','failed']);
    await page.getByRole('button', { name: /^Queue/ }).click();
    await page.getByRole('group', { name: 'Filter downloads' }).getByRole('button', { name: /^Needs attention/ }).click();
    await expect(page.getByTestId('job')).toHaveCount(1);
    await page.screenshot({ path: '/tmp/utube-desktop-attention.png' });
    await page.getByRole('button', {name:'Retry #2_The second chapter',exact:true}).click();
    await expect.poll(() => page.evaluate(async()=> (await window.utube.jobs())[1]?.status), {timeout:20000}).toBe('saved');
    await expect(page.getByText('No matching downloads')).toBeVisible();
    await page.getByRole('button', { name: 'New download', exact: true }).click();
    // Use the actual UI to start another transfer, then cancel it.
    await page.getByRole('textbox',{name:'YouTube URL'}).fill('https://youtu.be/BaW_jenozKc');
    await page.getByRole('button',{name:'Find',exact:true}).click();
    await page.getByRole('button',{name:'Download video',exact:true}).click();
    await page.getByRole('button',{name:'Cancel A small moment, worth keeping',exact:true}).click();
    await expect.poll(() => page.evaluate(async()=> (await window.utube.jobs())[2]?.status)).toBe('cancelled');
    // Closing with work in progress must wait for cancellation and cleanup.
    await page.getByRole('button',{name:'Retry A small moment, worth keeping',exact:true}).click();
    await expect.poll(() => page.evaluate(async()=> (await window.utube.jobs())[2]?.stage)).toBe('video');
    await page.screenshot({ path: '/tmp/utube-desktop-active.png', fullPage: true });
    await app.evaluate(({ dialog }) => { dialog.showMessageBox = async () => ({response:1,checkboxChecked:false}); });
    await app.close(); closed = true;
    const names=await fs.readdir(folder);
    expect(names.some(name=>name.startsWith('.utube-'))).toBe(false);
    expect(names.some(name=>name.endsWith('[BaW_jenozKc].mp4'))).toBe(false);
    console.log('PASS: failed playlist item, retry control, cancel control, quit cleanup.');
  } finally {
    if (!closed) {
      await app.evaluate(({dialog})=>{dialog.showMessageBox=async()=>({response:1,checkboxChecked:false});}).catch(()=>{});
      await app.close().catch(()=>{});
    }
    await fs.rm(root,{recursive:true,force:true,maxRetries:5,retryDelay:200});
  }
  const secondRoot=await fs.mkdtemp(path.join(os.tmpdir(),'utube-no-ffmpeg-'));
  const env2={...process.env,UTUBE_TEST_USER_DATA:secondRoot,UTUBE_FFMPEG:path.join(secondRoot,'missing-encoder'),UTUBE_TEST_MEDIA:media}; delete env2.ELECTRON_RUN_AS_NODE;
  // The original fixture has been cleaned up; create a separate file for this test.
  const audioFile=path.join(secondRoot,'source.m4a');
  execFileSync('ffmpeg',['-v','error','-f','lavfi','-i','sine=duration=0.2','-c:a','aac',audioFile]);env2.UTUBE_TEST_MEDIA=audioFile;
  const second=await electron.launch({executablePath:require('electron'),args,env:env2});
  try {
    const page=await second.firstWindow();
    await expect(page.getByText('FFmpeg not found')).toBeVisible();
    await page.getByRole('button',{name:/Audio only/}).click();
    await page.getByRole('textbox',{name:'YouTube URL'}).fill('https://youtu.be/jNQXAC9IVRw');
    await page.getByRole('button',{name:'Find',exact:true}).click();
    await expect(page.getByRole('button',{name:'Download MP3',exact:true})).toBeDisabled();
    await expect(page.getByText('Install FFmpeg to use MP3 conversion or separate video/audio streams.')).toBeVisible();
    console.log('PASS: missing FFmpeg is visible and MP3 conversion is disabled.');
  } finally {await second.close();await fs.rm(secondRoot,{recursive:true,force:true,maxRetries:5,retryDelay:200});}
})().catch(error=>{console.error(error);process.exitCode=1});
