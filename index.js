import inquirer from 'inquirer';
import terminal from 'terminal-kit'
import { getVideoData } from './functions/getData.js';
import { getVideoOrListID } from './functions/heperFunctions.js';
import Innertube from 'youtubei.js';
import fs from 'fs'
global.youtube = await new Innertube();
global.term = terminal.terminal ;

term.bold.cyan('\n----------------  uTube  ----------------\n\n')

const download = (item,quality) =>{
  const stream = youtube.download(item.id, {
    format: 'mp4', // defaults to mp4
    quality: quality, // falls back to 360p if a specific quality isn't available
    type: 'videoandaudio' 
  });
    
  stream.pipe(fs.createWriteStream(`./${item.title}.mp4`));
  
  stream.on('start', () => {
    console.info('[YOUTUBE.JS]', 'Starting now!');
  });
    
  stream.on('info', (info) => {
    console.info('[YOUTUBE.JS]', `Downloading ${item.title}`);
  });
    
  stream.on('progress', (info) => {
    process.stdout.clearLine();
    process.stdout.cursorTo(0);
    process.stdout.write(`[YOUTUBE.JS] Downloaded ${info.percentage}% (${info.downloaded_size}MB) of ${info.size}MB`);
  });
    
  stream.on('end', () => {
    process.stdout.clearLine();
    process.stdout.cursorTo(0);
    console.info('[YOUTUBE.JS]', 'Done!');
  });
    
  stream.on('error', (err) => console.error('[ERROR]', err)); 
}

inquirer.prompt([{
    name: 'url',
    message: 'Enter (video/playlist) url:'
  },
]).then(answers => {
  const urlResult = getVideoOrListID(answers.url)
  if(urlResult.type === 'video'){
    getVideoData(urlResult.id).then(data=>{
      term('  --------------------  \n')
      term.bold(`  - title: ${data.title}\n`)
      term.bold(`  - description: ${data.description}\n`)
      term('  --------------------  \n\n')
      inquirer.prompt([{
        name: 'quality',
        type: 'list',
        choices: data.metadata.available_qualities,
        message: 'Choose quality:'
      }]).then(answers=>{
        download({id:urlResult.id,title:data.title},answers.quality)
      })
    })
  }
});
