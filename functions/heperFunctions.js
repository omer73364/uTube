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


export const downloadVideo = (item,quality) =>{
    const stream = youtube.download(item.id, {
      format: 'mp4', // defaults to mp4
      quality: quality, // falls back to 360p if a specific quality isn't available
      type: 'videoandaudio' 
    });
      
    stream.pipe(fs.createWriteStream(`./${item.title}.mp4`));
    
    stream.on('start', () => {
      console.info('[uTube]', 'Starting now!');
    });
      
    stream.on('info', (info) => {
      console.info('[uTube]', `Downloading ${item.title}`);
    });
      
    stream.on('progress', (info) => {
      process.stdout.clearLine();
      process.stdout.cursorTo(0);
      process.stdout.write(`[uTube] Downloaded ${info.percentage}% (${info.downloaded_size}MB) of ${info.size}MB`);
    });
      
    stream.on('end', () => {
      process.stdout.clearLine();
      process.stdout.cursorTo(0);
      console.info('[uTube]', 'Done!');
    });
      
    stream.on('error', (err) => console.error('[ERROR]', err)); 
  }