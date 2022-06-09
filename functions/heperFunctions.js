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