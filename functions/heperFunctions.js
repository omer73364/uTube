export const getVideoOrListID = (link) => {
    if(!/^(https?\:\/\/)?((www\.)?youtube\.com|youtu\.be)\/.+$/.test(link)){
        console.info("\n  - enter a valid youtube URL! ❌");
        return null
    }
    const url = new URL(link)
    const video_id = url.searchParams.get('v')
    const playlist_id = url.searchParams.get('list')

    if(video_id){
        console.info('\x1b[36m%s\x1b[0m','\n  - Youtube video found.. ✅\n\n')
        return {type:'video',id:video_id}
    }
    else if(playlist_id){
        console.info('\x1b[36m%s\x1b[0m','\n  - Youtube playlist found.. ✅\n\n')
        return {type:'list',id:playlist_id}
    }
    else{
        console.error('\n  - No valid video or playlist found.. ❌')
        return null
    }
}