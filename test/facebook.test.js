import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {parseMediaURL,validMediaID} from '../packages/core/media-source.js';
import {facebookPageURL,facebookMediaURL,facebookPostData} from '../packages/core/facebook-metadata.js';
import {createFacebookClient} from '../packages/core/facebook.js';
import {createDownloadEngine} from '../packages/core/engine.js';
import {validateRequest} from '../apps/desktop/src/main/validation.mjs';
import {spawnSync} from 'node:child_process';
import {DownloadHistory} from '../apps/desktop/src/main/history.mjs';
import {postId,id,url,share,video,page} from './fixtures/facebook.js';
const engine = fetch => createDownloadEngine({client:{getInfo(){throw Error('Must not initialize YouTube');}},facebookClient:createFacebookClient({fetch})});

test('Facebook accepts canonical videos, Reels, mobile aliases and share links',()=>{
  for(const host of ['facebook.com','www.facebook.com','m.facebook.com','web.facebook.com','mbasic.facebook.com'])for(const route of [`/watch/?v=${postId}`,`/video.php?v=${postId}`,`/reel/${postId}/`,`/studio/videos/${postId}/`,`/studio/videos/title/${postId}/`]) {
    assert.equal(parseMediaURL(`https://${host}${route}`).id,id);
    assert.ok(facebookPageURL(`https://${host}${route}`));
  }
  assert.equal(parseMediaURL(share).postId,'share-r-1BhmM7uP7K');
  assert.equal(parseMediaURL('https://fb.watch/abcdef/').postId,'short-abcdef');
  assert.equal(validMediaID(id),true);
  for(const input of ['https://facebook.com.evil.test/reel/12345','https://user@facebook.com/reel/12345','https://facebook.com:444/reel/12345','https://facebook.com/groups/12345','https://facebook.com/watch/?v=hello','https://facebook.com/profile.php?id=12345'])assert.throws(()=>parseMediaURL(input),/valid/);
  assert.equal(facebookPageURL('https://facebook.com/accounts/login/'),null);
  assert.equal(facebookMediaURL('https://fbcdn.net.evil.test/video.mp4'),null);
  assert.equal(facebookMediaURL('https://video.fbcdn.net/video.m3u8'),null);
});

test('Facebook selects the requested video instead of recommended videos and keeps honest SD/HD labels',async()=>{
  const e=engine(async()=>new Response(page([video({id:'111111111111111'}),video()])));
  const p=await e.inspect(url);
  assert.equal(p.id,id);assert.equal(p.provider,'facebook');assert.deepEqual(p.qualities,['SD','HD']);assert.equal(p.author,'Studio');
  assert.equal(validateRequest({audio:false,quality:'HD',items:[{id,title:p.title}]}).quality,'HD');
  assert.throws(()=>facebookPostData(page(video({id:'111111111111111'})),postId),/requires sign-in/);
});

test('Facebook safely resolves share redirects and refuses login or external redirects',async()=>{
  const calls=[];
  const p=await engine(async(target,options)=>{
    calls.push(target);assert.equal(options.redirect,'manual');
    return calls.length===1?new Response(null,{status:302,headers:{Location:url}}):new Response(page(video()));
  }).inspect(share);
  assert.equal(p.id,id);assert.equal(calls.length,2);
  for(const target of ['https://evil.test/video','https://www.facebook.com/login/','http://www.facebook.com/reel/12345'])await assert.rejects(engine(async()=>new Response(null,{status:302,headers:{Location:target}})).inspect(share),/requires sign-in/);
  await assert.rejects(engine(async()=>new Response(null,{status:302,headers:{Location:share}})).inspect(share),/requires sign-in/);
});

test('Facebook supports current progressive metadata and rejects unsafe, streaming-only or gated media',async()=>{
  const modern=video({videoDeliveryLegacyFields:null,videoDeliveryResponseFragment:{videoDeliveryResponseResult:{progressive_urls:[{progressive_url:'https://video.fbcdn.net/test.mp4',metadata:{quality:'HD',width:720,height:1280}}]}}});
  assert.deepEqual((await engine(async()=>new Response(page(modern))).inspect(url)).qualities,['720p']);
  for(const status of [401,403,404])await assert.rejects(engine(async()=>new Response('',{status})).inspect(url),/requires sign-in/);
  await assert.rejects(engine(async()=>new Response('',{status:429})).inspect(url),/limiting/);
  await assert.rejects(engine(async()=>new Response(page(video({videoDeliveryLegacyFields:{browser_native_hd_url:'https://evil.test/video.mp4'}})))).inspect(url),/no downloadable MP4/);
  await assert.rejects(engine(async()=>new Response(page(video({is_live_streaming:true})))).inspect(url),/unavailable/);
  await assert.rejects(engine(async()=>new Response('x'.repeat(8*1024*1024+1))).inspect(url),/too much/);
});

test('Facebook refreshes links, downloads native MP4, saves history and downgrades failed HD to SD',async t=>{
  const folder=await fs.mkdtemp(path.join(os.tmpdir(),'utube-fb-'));t.after(()=>fs.rm(folder,{recursive:true,force:true}));
  const bytes=Buffer.from('MP4 fixture');let lookups=0;
  const e=engine(async target=>{
    if(target.includes('facebook.com')){lookups++;return new Response(page(video()));}
    if(target.includes('/hd.mp4'))return new Response('',{status:403});
    return new Response(bytes,{headers:{'Content-Type':'video/mp4','Content-Length':String(bytes.length)}});
  });
  await e.inspect(url);const events=[];
  const result=await e.download({folder,item:{id,title:'Facebook fixture'},quality:'HD',onEvent:event=>events.push(event)});
  assert.deepEqual(await fs.readFile(result.path),bytes);assert.ok(lookups>=3);
  assert.ok(events.some(event=>event.type==='start'&&event.quality==='SD'));
  const history=new DownloadHistory(path.join(folder,'history.json'));
  await history.save([{id:crypto.randomUUID(),videoId:id,title:'Facebook fixture',folder,audio:false,quality:'HD',status:'saved',path:result.path}]);
  assert.equal((await history.load())[0].videoId,id);
  const controller=new AbortController();controller.abort();await assert.rejects(e.inspect(url,{signal:controller.signal}),/abort/i);
});


test('CLI accepts Facebook HD and SD quality flags before downloading',()=>{
  for(const quality of ['HD','SD']) {
    const script = `import {readArgs} from './apps/cli/functions/readInput.js'; process.argv=['node','utube','-u',${JSON.stringify(url)},'-q',${JSON.stringify(quality)}]; console.log(JSON.stringify(await readArgs()));`;
    const result=spawnSync(process.execPath,['--input-type=module','-e',script],{encoding:'utf8',timeout:10000});
    assert.equal(result.status,0,result.stderr);assert.equal(JSON.parse(result.stdout).quality,quality);
  }
});
