import inquirer from 'inquirer';

inquirer.prompt([
    {
      name: 'url',
      message: 'Enter (video/playlist) url:'
    },
  ])
  .then(answers => {
    if(!/^(https?\:\/\/)?((www\.)?youtube\.com|youtu\.be)\/.+$/.test(answers.url)){
      console.info("enter a valid youtube URL!");
      return
    }
    const url = new URL(answers.url)
    const video_id = url.searchParams.get('v')
    const playlist_id = url.searchParams.get('list')

    if(video_id){
      console.info('\x1b[36m%s\x1b[0m','\n Youtube video found..\n\n')
    }
    else if(playlist_id){
      console.info('\x1b[36m%s\x1b[0m','\n Youtube playlist found..\n\n')
    }
    else{
      console.error('No valid video or playlist found')
    }
});
