import subprocess,time,xml.etree.ElementTree as ET,re,os,shutil
from pathlib import Path
serial=os.environ.get('ANDROID_SERIAL','emulator-5554')
assert serial.startswith('emulator-'), 'Run this fixture test on an emulator.'
sdk=os.environ.get('ANDROID_HOME',str(Path.home()/'Library/Android/sdk'))
adb=[shutil.which('adb') or str(Path(sdk)/'platform-tools/adb'),'-s',serial]
def run(*args):
    return subprocess.check_output(adb+list(args),stderr=subprocess.STDOUT).decode()
def screen():
    run('shell','uiautomator','dump','/sdcard/utube-quality-ui-test.xml')
    value=run('exec-out','cat','/sdcard/utube-quality-ui-test.xml')
    return ET.fromstring(value[value.index('<?xml'):value.index('</hierarchy>')+len('</hierarchy>')])
def describe(root):
    return '\n'.join(' '.join([node.get('text',''),node.get('content-desc','')]).strip() for node in root.iter('node') if node.get('text') or node.get('content-desc'))
def tap(match):
    root=screen()
    for node in root.iter('node'):
        value=node.get('text','')+' '+node.get('content-desc','')
        if match(value):
            bounds=list(map(int,re.findall(r'\d+',node.get('bounds',''))))
            if len(bounds)==4:
                run('shell','input','tap',str((bounds[0]+bounds[2])//2),str((bounds[1]+bounds[3])//2));return
    raise AssertionError('Control not found:\n'+describe(root))
def assert_rows(text):
    for quality,size in [('1080p','6 MB'),('720p','3 MB'),('360p','1 MB')]:
        assert any(quality in line and size in line for line in text.splitlines()),text
run('shell','am','force-stop','io.github.omer73364.utube.mobile')
run('shell','am','start','-n','io.github.omer73364.utube.mobile/com.utubemobile.MainActivity','-a','android.intent.action.VIEW','-d','https://youtu.be/jNQXAC9IVRw')
time.sleep(3)
tap(lambda value: 'Preview link' in value)
time.sleep(1)
tap(lambda value: 'Video quality:' in value)
main=describe(screen());print('MAIN QUALITY MENU:\n'+main);assert_rows(main)
with open('/tmp/utube-android-each-quality.png','wb') as f:f.write(subprocess.check_output(adb+['exec-out','screencap','-p']))
# Confirm all choices were inspected before selecting a quality.
tap(lambda value: '720p' in value and '3 MB' in value)
run('shell','am','start','-n','io.github.omer73364.utube.mobile/com.utubemobile.ShareActivity','-a','android.intent.action.SEND','-t','text/plain','--es','android.intent.extra.TEXT','https://youtu.be/jNQXAC9IVRw')
time.sleep(2)
shared=describe(screen());print('SHARE SHEET:\n'+shared);assert_rows(shared)
with open('/tmp/utube-android-share-each-quality.png','wb') as f:f.write(subprocess.check_output(adb+['exec-out','screencap','-p']))
print('PASS: actual Android main quality menu and share sheet show every quality size before selection.')
