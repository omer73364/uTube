#! /usr/bin/env node

import inquirer from 'inquirer';
import terminal from 'terminal-kit'
import { getListData, getVideoData } from './functions/getData.js';
import { downloadList, downloadVideo, getVideoOrListID } from './functions/heperFunctions.js';
import Innertube from 'youtubei.js';
import {oraPromise} from 'ora';
import fs from 'fs'

// initializing
try{
  console.clear()
  global.fs = fs
  global.term = terminal.terminal ;
  global.youtube = await oraPromise(new Innertube(),'- Check internet connection..');
}
catch(err){
  term.red('  - Internet Connection Error!')
  process.exit()
}

// hello uTube
term.bold.cyan('\n----------------  uTube  ----------------\n\n')

// ask for URL
const { url } = await inquirer.prompt([{
    name: 'url',
    message: 'Enter (video/playlist) url:'
  }
])

// check if the url for (video) or (playlist)
const urlResult = getVideoOrListID(url)

// if video
if(urlResult?.type === 'video'){
  
  try{
    const { title, metadata } = await oraPromise(getVideoData(urlResult.id),'- Get video data..')
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
  catch(err){
    term.red('  - Internet Connection Error!')
    process.exit()
  }

}

// if playlist
if(urlResult?.type === 'list'){

  try{
    const  data  = await oraPromise(getListData(urlResult.id),'- Get playlist data..')
    term('  --------------------  \n')
    term.bold(`  - title: ${data.title}\n`)
    term.bold(`  - videos: ${data.total_items}\n`)
    term('  --------------------  \n\n')

    // get available qualities for first video
    const video = await oraPromise(getVideoData(data.items[0].id),'- Get available qualities..')

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
      choices: data.items.map((v,i)=>`#${i+1} - ${v.title}`),
      message: '- Choose videos to be downloaded:\n\n'
    }])
      
    const items = data.items.filter((vid,i)=>videos.includes(`#${i+1} - ${vid.title}`))
    term.yellow(`\n  - Start Downloading ${items.length} selected videos..\n`)
    downloadList(data.title,items,quality)  
  }
  catch(err){
    term.red('  - Internet Connection Error!')
    process.exit()
  }
 
}