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

const { url } = await inquirer.prompt([{
    name: 'url',
    message: 'Enter (video/playlist) url:'
  }
])

// check if the url for (video) or (playlist)
const urlResult = getVideoOrListID(url)

// if video
if(urlResult?.type === 'video'){
  
  const { title, metadata } = await getVideoData(urlResult.id)

  const videoData = {
    id:urlResult.id,
    title
  }

  term('  --------------------  \n')
  term.bold(`  - title: ${title}\n`)
  term('  --------------------  \n\n')

  const { quality } = await inquirer.prompt([{
    name: 'quality',
    type: 'list',
    choices: metadata.available_qualities,
    message: '- Choose quality:'
  }])

  downloadVideo(videoData,quality)
}

// if playlist
if(urlResult?.type === 'list'){

  const  data  = await getListData(urlResult.id)

  term('  --------------------  \n')
  term.bold(`  - title: ${data.title}\n`)
  term.bold(`  - videos: ${data.total_items}\n`)
  term('  --------------------  \n\n')
  
  // get available qualities for first video
  const video = await getVideoData(data.items[0].id)

  const { quality } = await inquirer.prompt([{
    name: 'quality',
    type: 'list',
    choices: video.metadata.available_qualities,
    message: '- Choose quality:'
  }])
  
  // select videos to be downloaded
  const { videos } = await inquirer.prompt([{
    name: 'videos',
    type: 'checkbox',
    choices: data.items.map(i=>i.title),
    message: '- Choose videos to be downloaded:\n\n'
  }])
    
  const items = data.items.filter(vid=>videos.includes(vid.title))
  downloadList(data.title,items,quality)
    
}