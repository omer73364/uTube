const { _electron: electron } = require('playwright');
const { expect } = require('@playwright/test');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
(async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'utube-instagram-desktop-'));
  const prefs = path.join(root, 'prefs');
  const media = path.join(root, 'fixture.mp4');
  await fs.mkdir(prefs);
  await fs.writeFile(path.join(prefs,'settings.json'),JSON.stringify({folder:root}));
  execFileSync('ffmpeg',['-v','error','-f','lavfi','-i','color=c=red:s=1280x720:r=10','-f','lavfi','-i','sine=frequency=440:duration=1','-t','1','-c:v','libx264','-preset','ultrafast','-c:a','aac',media]);
  const env = {...process.env,UTUBE_TEST_MEDIA:media,UTUBE_TEST_USER_DATA:prefs,UTUBE_FFMPEG:'/missing/ffmpeg'};
  delete env.ELECTRON_RUN_AS_NODE;
  const app = await electron.launch({executablePath:require('electron'),args:['--no-sandbox',path.resolve(__dirname,'..')],env});
  try {
    const page = await app.firstWindow();
    await page.getByRole('button',{name:'Not now',exact:true}).click();
    await page.getByRole('textbox',{name:'YouTube, X, Instagram, or Facebook URL'}).fill('https://www.instagram.com/reel/DemPo6-NFZK/');
    await page.getByRole('button',{name:'Preview link',exact:true}).click();
    await expect(page.getByText('Instagram video',{exact:true})).toBeVisible();
    const quality = page.getByRole('combobox');
    await expect(quality).toHaveValue('720p');
    await page.getByRole('button',{name:'Download video',exact:true}).click();
    await expect.poll(()=>page.evaluate(async()=>(await window.utube.jobs())[0]?.status),{timeout:20000}).toBe('saved');
    const [job] = await page.evaluate(()=>window.utube.jobs());
    assert.equal(job.videoId,'ig-DemPo6-NFZK-1');
    assert.match(job.thumbnail,/cdninstagram.com/);
    const probe = JSON.parse(execFileSync('ffprobe',['-v','error','-show_streams','-of','json',job.path],{encoding:'utf8'}));
    assert.equal(probe.streams[0].height,720);
    console.log('PASS: Instagram preview, native HD without FFmpeg, CDN thumbnail and completed download.');
  } finally {await app.close();await fs.rm(root,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
