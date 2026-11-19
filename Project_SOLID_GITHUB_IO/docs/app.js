const $ = (selector) => document.querySelector(selector);
const connection = $('#connection');
const editor = $('#editor');
const removal = $('#removal');
const connect = $('#connect');
const edit = $('#edit');
const remove = $('#remove');
let posts = [];
let session;
let version;
let editing;
let selectedCategory = '';
let loadError = '';
let busy = false;

function element(tag, text = '', className = '') {
  const node = document.createElement(tag);
  node.textContent = text;
  if (className) node.className = className;
  return node;
}

function inline(node, text) {
  const tokens = /(`[^`]+`|\*\*[^*]+\*\*|!?\[[^\]]+\]\([^)]+\))/g;
  for (const part of text.split(tokens)) {
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      node.append(element('code', part.slice(1, -1)));
    } else if (/^\*\*[^*]+\*\*$/.test(part)) {
      node.append(element('strong', part.slice(2, -2)));
    } else {
      const match = part.match(/^(!?)\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/i);
      if (!match) {
        node.append(part);
      } else if (match[1]) {
        const image = element('img');
        image.alt = match[2];
        image.src = match[3];
        image.loading = 'lazy';
        image.referrerPolicy = 'no-referrer';
        node.append(image);
      } else {
        const link = element('a', match[2]);
        link.href = match[3];
        node.append(link);
      }
    }
  }
}

function markdown(body) {
  const output = element('div', '', 'prose');
  const lines = body.replaceAll('\r\n', '\n').split('\n');
  let paragraph;
  let list;
  let code;
  for (const line of lines) {
    if (code) {
      if (/^```\s*$/.test(line)) code = undefined;
      else code.append(line + '\n');
      continue;
    }
    const heading = line.match(/^(#{1,5})\s+(.+)$/);
    const item = line.match(/^([-*]|\d+\.)\s+(.+)$/);
    if (!item || /^```/.test(line)) list = undefined;
    if (!line.trim() || heading || item || /^```/.test(line) || /^> /.test(line)) paragraph = undefined;
    if (/^```/.test(line)) {
      const pre = element('pre');
      code = element('code');
      pre.append(code);
      output.append(pre);
    } else if (heading) {
      const title = element('h' + Math.min(6, heading[1].length + 1));
      inline(title, heading[2]);
      output.append(title);
    } else if (item) {
      const tag = /\d/.test(item[1]) ? 'ol' : 'ul';
      if (!list || list.localName !== tag) {
        list = element(tag);
        output.append(list);
      }
      const li = element('li');
      inline(li, item[2]);
      list.append(li);
    } else if (line.startsWith('> ')) {
      const quote = element('blockquote');
      inline(quote, line.slice(2));
      output.append(quote);
    } else if (line.trim()) {
      if (!paragraph) {
        paragraph = element('p');
        output.append(paragraph);
      } else paragraph.append(' ');
      inline(paragraph, line);
    }
  }
  return output;
}

function dateLabel(date) {
  return new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeZone: 'Asia/Seoul' }).format(new Date(date));
}

function metadata(post) {
  return [post.category, dateLabel(post.created), ...post.tags.map((tag) => '#' + tag)].join(' · ');
}

function renderList() {
  const filters = $('#filters');
  const categories = [...new Set(posts.map((post) => post.category))].sort((a, b) => a.localeCompare(b, 'ko'));
  if (!categories.includes(selectedCategory)) selectedCategory = '';
  filters.replaceChildren();
  for (const category of ['', ...categories]) {
    const button = element('button', category || '전체');
    button.setAttribute('aria-pressed', String(category === selectedCategory));
    button.addEventListener('click', () => {
      selectedCategory = category;
      renderList();
      [...filters.children].find((child) => child.getAttribute('aria-pressed') === 'true')?.focus();
    });
    filters.append(button);
  }

  const query = $('#search').value.trim().toLowerCase();
  const matches = posts.filter((post) => (!selectedCategory || post.category === selectedCategory)
    && [post.title, post.category, post.summary, post.body, ...post.tags].join(' ').toLowerCase().includes(query));
  const list = $('#posts');
  list.replaceChildren();
  if (!matches.length) {
    const empty = element('div', '', 'empty');
    const title = loadError || (query ? '검색 결과가 없습니다.' : '아직 게시된 글이 없습니다.');
    empty.append(element('strong', title));
    if (!loadError && !query && !posts.length) empty.append(element('p', '새 글이 발행되면 여기에 표시됩니다.'));
    list.append(empty);
  }
  for (const post of matches) {
    const link = element('a', '', 'post');
    link.href = '#post/' + encodeURIComponent(post.id);
    link.append(element('p', metadata(post), 'meta'), element('h3', post.title));
    if (post.summary) link.append(element('p', post.summary));
    list.append(link);
  }
}

function route() {
  const hash = location.hash;
  const isPost = hash.startsWith('#post/');
  const post = posts.find((entry) => '#post/' + encodeURIComponent(entry.id) === hash);
  $('#home').hidden = isPost;
  const article = $('#article');
  article.hidden = !isPost;
  document.title = post ? post.title + ' · SOLID Engineering' : 'SOLID Engineering';
  if (!isPost) {
    if (hash === '#articles') $('#articles').scrollIntoView();
    return;
  }
  const back = element('a', '아티클 목록', 'back');
  back.href = '#articles';
  article.replaceChildren(back);
  if (!post) {
    article.append(element('h1', '글을 찾을 수 없습니다.'));
    return;
  }
  article.append(element('p', metadata(post), 'meta'), element('h1', post.title));
  if (post.summary) article.append(element('p', post.summary, 'meta'));
  article.append(markdown(post.body));
  if (session) {
    const actions = element('div', '', 'actions');
    const update = element('button', '수정');
    const deletion = element('button', '삭제');
    update.addEventListener('click', () => openEditor(post));
    deletion.addEventListener('click', () => {
      editing = post;
      $('#remove-title').textContent = post.title;
      feedback(remove);
      removal.showModal();
    });
    actions.append(update, deletion);
    article.append(actions);
  }
  article.tabIndex = -1;
  article.focus();
  window.scrollTo(0, 0);
}

function setPosts(data) {
  if (!Array.isArray(data) || data.some((post) => !post ||
    !['id', 'title', 'category', 'summary', 'body', 'created'].every((field) => typeof post[field] === 'string') ||
    Number.isNaN(Date.parse(post.created)) || !Array.isArray(post.tags) || post.tags.some((tag) => typeof tag !== 'string'))) {
    throw new Error('게시글 데이터 형식을 확인해 주세요.');
  }
  posts = [...data].sort((a, b) => Date.parse(b.created) - Date.parse(a.created));
  loadError = '';
  renderList();
  route();
}

function feedback(form, message = '') {
  form.querySelector('.feedback').textContent = message;
}

async function operation(form, task) {
  if (busy) return;
  busy = true;
  const buttons = [...form.querySelectorAll('button')];
  buttons.forEach((button) => { button.disabled = true; });
  feedback(form);
  try {
    await task();
  } catch (error) {
    feedback(form, error.message);
  } finally {
    busy = false;
    buttons.forEach((button) => { button.disabled = false; });
  }
}

function apiEndpoint(repository) {
  return 'https://api.github.com/repos/' + repository + '/contents/docs/posts.json';
}

async function github(config, method = 'GET', body) {
  const url = new URL(apiEndpoint(config.repo));
  if (method === 'GET') url.searchParams.set('ref', config.branch);
  const response = await fetch(url, {
    method,
    cache: 'no-store',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: 'Bearer ' + config.token,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    if (response.status === 409 || response.status === 422) {
      throw new Error('저장소에서 충돌이 발생했습니다. 연결을 해제하고 다시 연결한 뒤 최신 글을 확인해 주세요.');
    }
    throw new Error('GitHub 요청 실패 (' + response.status + '). 저장소, 브랜치, 토큰 권한을 확인해 주세요.');
  }
  return response.json();
}

function encode(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

async function save(next, message) {
  const content = JSON.stringify(next, null, 2) + '\n';
  if (new TextEncoder().encode(content).length > 1_000_000) {
    throw new Error('게시글 파일의 크기 한도에 도달했습니다. 본문 길이를 줄여 주세요.');
  }
  const result = await github(session, 'PUT', {
    message,
    branch: session.branch,
    sha: version,
    content: encode(content),
  });
  version = result.content.sha;
  setPosts(next);
}

function openEditor(post) {
  editing = post;
  edit.reset();
  feedback(edit);
  $('#editor-title').textContent = post ? '글 수정' : '새 글';
  edit.querySelector('.primary').textContent = post ? '수정 저장' : '발행';
  if (post) {
    for (const field of ['title', 'category', 'summary', 'body']) edit.elements[field].value = post[field];
    edit.elements.tags.value = post.tags.join(', ');
  }
  updatePreview();
  editor.showModal();
}

function updatePreview() {
  $('#preview').replaceChildren(markdown(edit.elements.body.value));
}

const manage = $('#manage');
const disconnect = element('button', '연결 해제');
disconnect.type = 'button';
disconnect.hidden = true;
manage.after(disconnect);
manage.addEventListener('click', () => {
  if (session) openEditor();
  else {
    feedback(connect);
    connection.showModal();
  }
});
disconnect.addEventListener('click', () => {
  session = undefined;
  version = undefined;
  manage.textContent = '블로그 관리';
  disconnect.hidden = true;
  route();
});
const owner = location.hostname.match(/^([a-z0-9-]+)\.github\.io$/i)?.[1];
if (owner) {
  const repo = location.pathname.split('/').filter(Boolean)[0] || location.hostname;
  connect.elements.repo.value = owner + '/' + repo;
}

connect.addEventListener('submit', (event) => {
  event.preventDefault();
  operation(connect, async () => {
    const config = Object.fromEntries(new FormData(connect));
    for (const key of ['repo', 'branch', 'token']) config[key] = config[key].trim();
    if (!/^[\w.-]+\/[\w.-]+$/.test(config.repo) || !config.branch || !config.token) {
      throw new Error('저장소, 브랜치와 토큰을 확인해 주세요.');
    }
    try {
      const file = await github(config);
      if (file.encoding !== 'base64' || typeof file.sha !== 'string') throw new Error('게시글 파일을 읽을 수 없습니다.');
      const bytes = Uint8Array.from(atob(file.content), (char) => char.charCodeAt(0));
      setPosts(JSON.parse(new TextDecoder().decode(bytes)));
      version = file.sha;
      session = config;
      manage.textContent = '글쓰기';
      disconnect.hidden = false;
      connection.close();
      route();
      if (!location.hash.startsWith('#post/')) openEditor();
    } finally {
      connect.elements.token.value = '';
    }
  });
});

edit.addEventListener('submit', (event) => {
  event.preventDefault();
  operation(edit, async () => {
    const values = Object.fromEntries(new FormData(edit));
    const post = {
      id: editing?.id || crypto.randomUUID(),
      title: values.title.trim(),
      category: values.category.trim(),
      tags: [...new Set(values.tags.split(',').map((tag) => tag.trim()).filter(Boolean))],
      summary: values.summary.trim(),
      body: values.body.trim(),
      created: editing?.created || new Date().toISOString(),
      updated: new Date().toISOString(),
    };
    if (!post.title || !post.category || !post.body) throw new Error('제목, 카테고리와 본문을 입력해 주세요.');
    await save([...posts.filter((entry) => entry.id !== post.id), post], (editing ? 'Edit: ' : 'Publish: ') + post.title);
    editor.close();
    location.hash = 'post/' + encodeURIComponent(post.id);
  });
});

remove.addEventListener('submit', (event) => {
  event.preventDefault();
  operation(remove, async () => {
    await save(posts.filter((post) => post.id !== editing.id), 'Delete: ' + editing.title);
    removal.close();
    location.hash = 'articles';
  });
});

for (const button of document.querySelectorAll('[data-close]')) {
  button.addEventListener('click', () => $('#' + button.dataset.close).close());
}
for (const dialog of [connection, editor, removal]) {
  dialog.addEventListener('cancel', (event) => { if (busy) event.preventDefault(); });
}
connection.addEventListener('close', () => { connect.elements.token.value = ''; });
edit.elements.body.addEventListener('input', updatePreview);
$('#search').addEventListener('input', renderList);
window.addEventListener('hashchange', route);
try {
  const response = await fetch('./posts.json', { cache: 'no-store' });
  if (!response.ok) throw new Error('게시글 파일을 읽을 수 없습니다.');
  const published = await response.json();
  if (!session) setPosts(published);
} catch {
  if (!session) loadError = '게시글을 불러오지 못했습니다. 페이지를 새로고침해 주세요.';
  renderList();
  route();
}

