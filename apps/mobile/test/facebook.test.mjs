import test from 'node:test';
import assert from 'node:assert/strict';
import {createFacebookService} from '../src/facebook.ts';
import {createMediaService} from '../src/media.ts';
import {shareRequests} from '../src/share.ts';
import {postId,id,url,share,video,page} from '../../../test/fixtures/facebook.js';
const response=data=>({status:200,text:async()=>page(data)});
test('mobile routes Facebook shares and saved retry IDs, selecting HD and preparing MP3',async()=>{
  const unavailable={inspect:async()=>{throw Error('wrong provider');},resolve:async()=>{throw Error('wrong provider');}};
  let calls=0;
  const facebook=createFacebookService(async target=>{
    calls++;
    if(target.includes('/share/'))return {status:302,headers:new Headers({Location:url}),text:async()=>''};
    return response(video());
  });
  const media=createMediaService(unavailable,unavailable,unavailable,facebook);
  const preview=await media.inspect(share);assert.equal(preview.provider,'facebook');assert.equal(preview.id,id);assert.deepEqual(preview.qualities,['HD','SD']);
  const [request]=shareRequests(preview,'mp3','HD');assert.equal(request.requestedQuality,'MP3');assert.equal(request.videoId,id);
  const audio=await media.resolve(id,'MP3','mp3');assert.ok(audio.candidates[0].audio);assert.equal(audio.requestedQuality,'MP3');
  const plan=await media.resolve(id,'best','video');assert.deepEqual(plan.candidates.map(x=>x.quality),['HD','SD']);assert.equal(plan.candidates[0].video.provider,'facebook');
  assert.ok(calls>=4);
});
test('mobile Facebook rejects foreign redirects and cancels even if the transport ignores abort',async()=>{
  await assert.rejects(createFacebookService(async()=>({status:302,headers:new Headers({Location:'https://evil.test/'}),text:async()=>''})).inspect(share),/requires sign-in/);
  const service=createFacebookService(async()=>new Promise(()=>{}));const controller=new AbortController();
  const pending=service.inspect(url,controller.signal);controller.abort();await assert.rejects(pending,/CANCELLED/);
});
