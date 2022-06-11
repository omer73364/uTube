import inquirer from 'inquirer';
import terminal from 'terminal-kit'
import { getVideoData } from './functions/getData.js';
import { downloadVideo, getVideoOrListID } from './functions/heperFunctions.js';
import Innertube from 'youtubei.js';
import fs from 'fs'

global.fs = fs
global.youtube = await new Innertube();
global.term = terminal.terminal ;

term.bold.cyan('\n----------------  uTube  ----------------\n\n')

inquirer.prompt([{
    name: 'url',
    message: 'Enter (video/playlist) url:'
  },
]).then(answers => {
  const urlResult = getVideoOrListID(answers.url)
  if(urlResult?.type === 'video'){
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
        downloadVideo({id:urlResult.id,title:data.title},answers.quality)
      })
    })
  }
});
