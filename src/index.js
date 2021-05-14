'use strict';

const rpc = require('discord-rpc');
const axios = require('axios');
const languages = require('discord-vscode/src/data/languages.json');
const { basename } = require('path');

const client = new rpc.Client({transport: 'ipc'});

const instance = axios.create({
  baseURL: 'https://wakatime.com/api/v1/',
  headers: {
    Authorization: 'Basic ' + Buffer.from(process.env.WAKATIME_TOKEN ?? '').toString('base64'),
  },
});

const date = {
  date: new Date(),
  get format() {
    return this.date.getFullYear() + '-' + (this.date.getMonth()+1) + '-' + this.date.getDate();
  },
};

/**
 * @see https://github.com/iCrawl/discord-vscode/blob/76dffbc09eb94779b94a69f9f5c9dd10cb831860/src/util.ts#L42
 */
function resolveFileIcon(document) {
  const filename = basename(document.entity);
  const findKnownExtension = Object.keys(languages.KNOWN_EXTENSIONS).find((key) => {
    if (filename.endsWith(key)) return true;

    const match = /^\/(.*)\/([mgiy]+)$/.exec(key);
    if (!match) return false;

    const regex = new RegExp(match[1], match[2]);
    return regex.test(filename);
  });
  const findKnownLanguage = languages.KNOWN_LANGUAGES.find((key) => key.language === document.language?.toLowerCase());
  const fileIcon = findKnownExtension
  ? languages.KNOWN_EXTENSIONS[findKnownExtension]
  : findKnownLanguage
  ? findKnownLanguage.image
  : null;

  return typeof fileIcon === 'string' ? fileIcon : fileIcon?.image ?? 'text';
};

let heartbeat;

function activity() {
  client.setActivity({
    details: `${heartbeat.category} on ${heartbeat.project}`,
    startTimestamp: new Date(Date.now() - heartbeat.time),
    largeImageKey: resolveFileIcon(heartbeat),
    largeImageText: (heartbeat.is_write ? 'Written in ' : 'Look at ') + heartbeat.language,
    smallImageKey: heartbeat.branch ? 'git' : undefined,
    smallImageText: (heartbeat.branch ? Array.isArray(heartbeat.branch) ? heartbeat.branch[0] : heartbeat.branch : '') + ' branch',
    state: `${heartbeat.type}: ${basename(heartbeat.entity)} | line: ${heartbeat.lines}`,
    instance: false,
    buttons: [
      { label: 'WakaTime user', url: 'https://wakatime.com/@' + heartbeat.user_id },
    ],
  }, process.pid);
};

async function getHeartbeat() {
  heartbeat = await instance.get('/users/current/heartbeats?date=' + date.format)
  .then(({data: {data}}) => data?.pop());
};

client.on('ready', async () => {
    console.log('Authed for user', client.user.username);

    await getHeartbeat();
                                            // 2m
    setInterval(async () => getHeartbeat(), 1000 * 60 * 60 * 2);
    
    activity();
                                  // 1m
    setInterval(() => activity(), 1000*60);
});

client.login({ clientId: '383226320970055681' });
