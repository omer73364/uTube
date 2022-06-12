export const getVideoOrListID = (link) => {
  if(!/^(https?\:\/\/)?((www\.)?youtube\.com|youtu\.be)\/.+$/.test(link)){
    term.red("\n  - enter a valid youtube URL! ❌");
    return null
  }
  const url = new URL(link)
  const video_id = url.searchParams.get('v')
  const playlist_id = url.searchParams.get('list')

  if(video_id){
    term.cyan('\n  - Youtube video found ✅\n')
    term('  - getting video data..\n\n')
    return {type:'video',id:video_id}
  }
  else if(playlist_id){
    term.cyan('\n  - Youtube playlist found ✅\n')
    return {type:'list',id:playlist_id}
  }
  else{
    term.red('\n  - No valid video or playlist found.. ❌')
    return null
  }
}

export const downloadVideo = (item,quality,listTitle,next) => {
  const stream = youtube.download(item.id, {
    format: 'mp4', // defaults to mp4
    quality: quality, // falls back to 360p if a specific quality isn't available
    type: 'videoandaudio' 
  });
    
  let title = item.title.replace(/[|&:;$%@"<>()+,]/g, "")
  if(listTitle){ 
    const dir = './'+listTitle;

    if (!fs.existsSync(dir)){
      fs.mkdirSync(dir);
    }

    stream.pipe(fs.createWriteStream(`${dir}/${title}.mp4`));
  }
  else{
    stream.pipe(fs.createWriteStream(`./${title}.mp4`));
  }
  
  stream.on('start', () => {
    console.info('  - [uTube]', 'Starting now!');
  });
    
  stream.on('info', (info) => {
    console.info('  - [uTube]', `Downloading ${title}`);
  });
    
  stream.on('progress', (info) => {
    process.stdout.clearLine();
    process.stdout.cursorTo(0);
    process.stdout.write(`  - [uTube] Downloaded ${info.percentage}% (${info.downloaded_size}MB) of ${info.size}MB`);
  });
    
  stream.on('end', () => {
    process.stdout.clearLine();
    process.stdout.cursorTo(0);
    console.info('  - [uTube]', 'Done!');
    if(listTitle) next()
  });
    
  stream.on('error', (err) => console.error('  - [ERROR]', err)); 
}

export const downloadList = (title,items,quality) => {
  let index = -1
  const downloadNext = () => {
    index++
    if(index < items.length){
      term('\n');
      downloadVideo(items[index],quality,title,downloadNext)
    }
    else{
      term('\n  - Playlist Downloaded Successfully ✅\n')
    }
  }
  downloadNext()
}