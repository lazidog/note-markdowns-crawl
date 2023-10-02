const cheerio = require('cheerio');
var fs = require('fs');

const structureFilename = 'repo-structure.json';

function fetchTreeItems(url) {
  return new Promise((resolve, reject) => {
    fetch(url, { headers: { 'User-Agent': 'Mozzila/5.0' } })
      .then(res => res.json())
      .then(res => resolve(res.payload.tree.items));
  });
}

function formatData(data, category = 'Common') {
  return data.map(e => {
    const img = e.name.slice(e.name.indexOf('[') + 1, e.name.indexOf(']'));
    return {
      title: e.name.slice(e.name.indexOf(']') + 1),
      path: `https://raw.githubusercontent.com/lazidog/note-markdowns/main/${e.path}`,
      category: category,
      image: `https://raw.githubusercontent.com/lazidog/note-markdowns/main/images/${img}.png`,
    };
  });
}

async function updateRepoStructure() {
  const items = await fetchTreeItems(
    'https://github.com/lazidog/note-markdowns?search=1'
  );
  const directories = items.filter(
    x => x.contentType === 'directory' && x.name !== 'images'
  );
  const files = items.filter(x => x.contentType === 'file') || [];
  const data = formatData(files);
  await Promise.all(
    directories.map(async dir => {
      const subFiles =
        (await fetchTreeItems(
          `https://github.com/lazidog/note-markdowns/tree/main/${dir.name}`
        )) || [];
      data.push(...formatData(subFiles, dir.name));
    })
  );
  return data;
}

async function getLatestCommitDate() {
  const html = await fetch(
    `https://github.com/lazidog/note-markdowns/file-list/main`,
    {
      headers: { 'User-Agent': 'Mozzila/5.0' },
    }
  );
  const $ = cheerio.load(html);
  const info = $('relative-time');
  let latestCommitDate = '1900-01-01T00:00:00+07:00';
  info.each(function () {
    const date = $(this).attr('datetime');
    if (date > latestCommitDate) {
      latestCommitDate = date;
    }
  });
}

async function newCommitAvailable(latestCommitDate) {
  const newLatestCommitDate = await getLatestCommitDate();
  return latestCommitDate !== newLatestCommitDate;
}

function readStructure() {
  return new Promise((resolve, reject) => {
    fs.readFile(structureFilename, { encoding: 'utf8' }, (err, data) => {
      if (err) reject(err);
      else resolve(JSON.parse(data));
    });
  });
}

function writeStructure(repoStructure) {
  return new Promise((resolve, reject) => {
    fs.writeFile(structureFilename, JSON.stringify(repoStructure), err => {
      if (err) reject(err);
      resolve();
    });
  });
}

async function getRepoStructure() {
  const repoStructure = await readStructure();
  const newLatestCommitDate = await newCommitAvailable(repoStructure.date);
  if (newLatestCommitDate) {
    repoStructure.date = newLatestCommitDate;
    repoStructure.data = await updateRepoStructure();
    await writeStructure(repoStructure);
  }
  return repoStructure;
}

(async () => {
  getRepoStructure();
})();
