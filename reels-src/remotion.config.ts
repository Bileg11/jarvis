import {Config} from '@remotion/cli/config';
Config.setBrowserExecutable(process.env.REMOTION_CHROME ?? '/tmp/chromium');
Config.setChromiumOpenGlRenderer('swangle');
Config.setVideoImageFormat('jpeg');
