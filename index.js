import inquirer from 'inquirer';
import { getVideoData } from './functions/getData.js';
import { getVideoOrListID } from './functions/heperFunctions.js';

console.info('\x1b[36m%s\x1b[0m','\n----------------  uTube  ----------------\n')


inquirer.prompt([{
    name: 'url',
    message: 'Enter (video/playlist) url:'
  },
]).then(answers => {
  const urlResult = getVideoOrListID(answers.url)
  if(urlResult.type === 'video'){
    getVideoData(urlResult.id).then(data=>{
      console.log(data.title+'\n')
      inquirer.prompt([{
        name: 'quality',
        type: 'list',
        choices: data.metadata.available_qualities,
        message: 'Choose quality:'
      }]).then(answers=>{console.log(answers)})
    })
  }
});
