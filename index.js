import inquirer from 'inquirer';
import terminal from 'terminal-kit'
import { getListData, getVideoData } from './functions/getData.js';
import { downloadList, downloadVideo, getVideoOrListID } from './functions/heperFunctions.js';
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
        message: '  - Choose quality:'
      }]).then(answers=>{
        downloadVideo({id:urlResult.id,title:data.title},answers.quality)
      })
    })
  }

  if(urlResult?.type === 'list'){
    getListData(urlResult.id).then(data=>{
      term('  --------------------  \n')
      term.bold(`  - title: ${data.title}\n`)
      term.bold(`  - videos: ${data.total_items}\n`)
      term('  --------------------  \n\n')
      getVideoData(data.items[0].id).then(video=>{
        inquirer.prompt([{
          name: 'quality',
          type: 'list',
          choices: video.metadata.available_qualities,
          message: 'Choose quality:'
        }]).then(answers=>{
          downloadList(data.title,data.items,answers.quality)
        })
      })
    })
  }
});
