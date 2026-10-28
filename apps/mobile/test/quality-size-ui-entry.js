// Disposable emulator UI harness. Uses the real App and ShareScreen with metadata fixtures.
import '../src/polyfills';
import 'react-native-get-random-values';
import 'react-native-url-polyfill/auto';
import { AppRegistry } from 'react-native';
import { downloads } from '../src/native';
import { media } from '../src/tasks';
import App from '../App';
import ShareScreen from '../src/ShareScreen';
const fixture = {
  kind: 'video', provider: 'youtube', id: 'jNQXAC9IVRw', title: 'Quality size UI check', author: 'uTube test',
  qualities: ['1080p', '720p', '360p'], audioAvailable: true,
  sizeEstimates: { video: { best: 6000000, '1080p': 6000000, '720p': 3000000, '360p': 1000000 }, mp3: 2880000 },
};
Object.assign(downloads, {
  settings: async () => ({ language: 'en', theme: 'light' }), saveSettings: async () => {}, list: async () => [],
  enqueue: async () => { throw Error('UI test must not download'); },
});
media.inspect = async () => JSON.parse(JSON.stringify(fixture));
AppRegistry.registerComponent('uTubeMobile', () => App);
AppRegistry.registerComponent('uTubeShare', () => ShareScreen);
