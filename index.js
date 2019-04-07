const commander = require('commander');
const package = require('./package.json');

commander
    .version(package.version)
    .option('--entry-list-url <entryListUrl>',
        'ameblo entry list URL.')
    .option('--limit-paging [limitPaging]',
        'limit page num. default is 20.')
    .parse(process.argv);

const entryListUrl = commander.entryListUrl;
if (!entryListUrl) {
  console.error('Entry List URL is empty.');
  process.exit(-1);
}
const re = /https:\/\/ameblo\.jp\/([0-9a-zA-Z\-]+)\/entrylist.html/;
if (!re.test(entryListUrl)) {
  console.error(`[${entryListUrl}] is not ameblo entry list URL.`);
  process.exit(-1);
}
const amebaID = entryListUrl.match(re)[1];

const blogOrigin = 'https://ameblo.jp';
const limitPaging = commander.limitPaging || '20';
const limitEntriesUrl =
  `${blogOrigin}/${amebaID}/entrylist-${limitPaging}.html`;

const axios = require('axios');
const jsdom = require('jsdom');
const {JSDOM} = jsdom;

const getEntryText = async (url) => {
  console.info(url);
  const page = await axios.get(url);
  const document = new JSDOM(page.data).window.document;
  return document.getElementById('entryBody').textContent;
};

const getEntries = async (url) => {
  console.info(url);
  const page = await axios.get(url);
  const document = new JSDOM(page.data).window.document;
  const entries = document
      .querySelectorAll('[data-uranus-component="entryItemBody"]');
  let res = [];
  for (let i = 0, l = entries.length; i < l; i++) {
    const entry = entries[i];
    const link = entry
        .querySelector('[data-uranus-component="entryItemTitle"] > a');
    const date = entry
        .querySelector('[data-uranus-component="entryItemDatetime"]')
        .textContent;
    res.push({
      url: link.getAttribute('href'),
      title: link.textContent,
      date: new Date(date),
      text: await getEntryText(`${blogOrigin}${link.getAttribute('href')}`),
    });
  }

  if (limitEntriesUrl && limitEntriesUrl === url) {
    return res;
  }

  const next = document
      .querySelector('[data-uranus-component="paginationNext"]');
  if (next) {
    const href = next.getAttribute('href');
    const nextUrl = `${blogOrigin}${href}`;
    if (url !== nextUrl) {
      res = res.concat(await getEntries(nextUrl));
    }
  }
  return res;
};

const fs = require('fs');
const path = require('path');
const distDir = path.resolve('dist');

// distディレクトリがなかったらつくっとこ
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir);
}

(async () => {
  const outputPath = path.resolve(distDir, `${amebaID}.jsonl`);
  const wstream = fs.createWriteStream(outputPath, 'utf8');
  try {
    const blogData = await getEntries(entryListUrl);
    blogData.forEach((data) => {
      wstream.write(`${JSON.stringify(data)}\n`);
    });
  } catch (e) {
    console.error(e);
  } finally {
    wstream.end();
  }
})();
