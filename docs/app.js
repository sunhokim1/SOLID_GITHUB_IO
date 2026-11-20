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
let editorReturn = '#articles';
let attachments = [];
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
      const match = part.match(/^(!?)\[([^\]]+)\]\((https?:\/\/[^\s)]+|\.\/attachments\/[a-f0-9-]+\.(?:png|jpg|jpeg|gif|webp|avif|bin))\)$/i);
      if (!match) {
        node.append(part);
      } else if (match[1]) {
        const image = element('img');
        image.alt = match[2];
        const pending = attachments.find((item) => item.path === match[3]);
        image.src = pending?.previewUrl || match[3];
        image.loading = 'lazy';
        image.referrerPolicy = 'no-referrer';
        node.append(image);
      } else {
        const link = element('a', match[2]);
        link.href = match[3];
        if (match[3].startsWith('./attachments/')) link.download = match[2];
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

const newCategoryChoice = '__new_category__';

const technologyTopics = [
  { id: 'ftl-gc', label: 'FTL / GC', categories: ['FTL', 'Garbage Collection', 'GC', 'FTL / GC'] },
  { id: 'host-linux', label: 'Host/Linux', categories: ['Host/Linux'] },
  { id: 'nand', label: 'NAND 드라이버', categories: ['NAND 드라이버'] },
  { id: 'datasheets', label: '데이터시트', categories: ['데이터시트'] },
];
const nandTopics = technologyTopics.filter((topic) => topic.id !== 'host-linux');
const nandCategories = new Set(nandTopics.flatMap((topic) => topic.categories));
const technologyCategories = new Set(technologyTopics.flatMap((topic) => topic.categories));

function categoryHash(category) {
  return '#category/' + encodeURIComponent(category);
}

function renderList() {
  const filters = $('#filters');
  const categories = [...new Set(posts.map((post) => post.category))].sort((a, b) => a.localeCompare(b, 'ko'));
  const topic = technologyTopics.find((entry) => selectedCategory === '#topic/' + entry.id);
  const category = categories.find((entry) => selectedCategory === categoryHash(entry));
  const technology = selectedCategory === '#technology';
  const nand = selectedCategory === '#nand-flash';
  const heading = technology ? '사용 기술' : nand ? 'NAND Flash' : topic?.label || category || '아티클';
  function categoryButton(label, hash) {
    const button = element('button', label);
    button.type = 'button';
    button.setAttribute('aria-pressed', String(hash === (selectedCategory || '#articles')));
    button.addEventListener('click', () => { location.hash = hash; });
    return button;
  }

  function categoryMenu(id, label, active, children) {
    const previous = filters.querySelector('#' + id);
    const menu = element('details', '', 'category-menu');
    menu.id = id;
    menu.open = Boolean(previous?.open || (active && previous?.dataset.selection !== selectedCategory));
    menu.dataset.selection = selectedCategory;
    const group = element('div', '', 'category-group');
    group.append(...children);
    menu.append(element('summary', label), group);
    return menu;
  }

  const inNand = nand || nandTopics.includes(topic) || nandCategories.has(category);
  const nandMenu = categoryMenu('nand-menu', 'NAND Flash', inNand, [
    ...nandTopics.map((entry) => categoryButton(entry.label, '#topic/' + entry.id)),
  ]);
  const menu = categoryMenu('technology-menu', '사용 기술', technology || inNand || Boolean(topic) || technologyCategories.has(category), [
    nandMenu,
    categoryButton('Host/Linux', '#topic/host-linux'),
  ]);
  const otherCategories = categories.filter((entry) => !technologyCategories.has(entry));
  const projectPlan = '프로젝트 계획';
  filters.replaceChildren(
    categoryButton('전체', '#articles'),
    ...otherCategories.filter((entry) => entry === projectPlan)
      .map((entry) => categoryButton(entry, categoryHash(entry))),
    menu,
    ...otherCategories.filter((entry) => entry !== projectPlan)
      .map((entry) => categoryButton(entry, categoryHash(entry))),
  );

  $('#articles-title').textContent = heading;
  updateCategoryOptions(categories);
  const query = $('#search').value.trim().toLowerCase();
  const matches = posts.filter((post) =>
    (!technology || technologyCategories.has(post.category))
    && (!nand || nandCategories.has(post.category))
    && (!topic || topic.categories.includes(post.category))
    && (!category || post.category === category)
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

function updateCategoryOptions(categories) {
  const select = edit.elements.category;
  const previous = select.value;
  const placeholder = element('option');
  placeholder.value = '';
  placeholder.defaultSelected = true;

  const options = [...new Set([...technologyTopics.map((topic) => topic.label), ...categories])]
    .map((category) => {
      const option = element('option', category);
      option.value = categoryHash(category);
      return option;
    });
  const add = element('option', '+ 새 카테고리 추가');
  add.value = newCategoryChoice;
  select.replaceChildren(placeholder, ...options, add);
  select.value = [placeholder, ...options, add].some((option) => option.value === previous) ? previous : '';
  syncNewCategoryField();
}

function syncNewCategoryField() {
  const adding = edit.elements.category.value === newCategoryChoice;
  const input = edit.elements.newCategory;
  $('#new-category-field').hidden = !adding;
  input.disabled = !adding;
  input.required = adding;
}

function filtersFocus() {
  $('#filters').querySelector('[aria-pressed=true]')?.focus({ preventScroll: true });
}

function route() {
  const hash = location.hash;
  const isEditing = hash === '#write' && Boolean(session);
  editor.hidden = !isEditing;
  const topic = technologyTopics.find((entry) => '#topic/' + entry.id === hash);
  const isCategory = posts.some((entry) => categoryHash(entry.category) === hash);
  const category = hash === '#technology' || hash === '#nand-flash' || topic || isCategory ? hash : '';
  if (category !== selectedCategory) {
    selectedCategory = category;
    renderList();
    if (!isEditing) filtersFocus();
  }
  const isPost = hash.startsWith('#post/');
  const post = posts.find((entry) => '#post/' + encodeURIComponent(entry.id) === hash);
  $('#home').hidden = isPost || isEditing;
  const article = $('#article');
  article.hidden = !isPost;
  document.title = isEditing ? $('#editor-title').textContent + ' · SOLID Engineering'
    : post ? post.title + ' · SOLID Engineering' : 'SOLID Engineering';
  if (!isPost) {
    if (isEditing) return;
    if (hash === '#articles' || category) $('#articles').scrollIntoView();
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

function apiEndpoint(repository, path) {
  return 'https://api.github.com/repos/' + repository + '/contents/' + path;
}

async function github(config, method = 'GET', body, path = 'docs/posts.json') {
  const url = new URL(apiEndpoint(config.repo, path));
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
  const bytes = typeof text === 'string' ? new TextEncoder().encode(text) : text;
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
  if (location.hash === '#write' && !editor.hidden) {
    edit.elements.title.focus();
    return;
  }
  editorReturn = location.hash && location.hash !== '#write' ? location.hash : '#articles';
  editing = post;
  clearAttachments();
  $('#attachment-status').textContent = '';
  edit.reset();
  feedback(edit);
  $('#editor-title').textContent = post ? '글 수정' : '새 글';
  edit.querySelector('.primary').textContent = post ? '수정 저장' : '발행';
  if (post) {
    for (const field of ['title', 'summary', 'body']) edit.elements[field].value = post[field];
    edit.elements.tags.value = post.tags.join(', ');
  }
  edit.elements.category.value = post ? categoryHash(post.category) : '';
  syncNewCategoryField();
  updatePreview();
  location.hash = 'write';
  route();
  window.scrollTo(0, 0);
  edit.elements.title.focus();
}

const imageExtensions = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/avif': 'avif',
};

function clearAttachments() {
  for (const item of attachments) {
    if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
  }
  attachments = [];
}

function queueFiles(files) {
  if (busy) return;
  const skipped = [];
  const insertions = [];
  let includesImage = false;
  for (const file of files) {
    if (file.size > 5_000_000) {
      skipped.push(file.name || '스크린샷');
      continue;
    }
    const extension = Object.hasOwn(imageExtensions, file.type) ? imageExtensions[file.type] : null;
    const path = './attachments/' + crypto.randomUUID() + '.' + (extension || 'bin');
    const label = (file.name || '스크린샷').replace(/[\[\]()`*\r\n]/g, '_');
    const previewUrl = extension ? URL.createObjectURL(file) : null;
    attachments.push({file, path, label, previewUrl, uploaded: false});
    insertions.push((extension ? '!' : '') + '[' + label + '](' + path + ')');
    includesImage ||= Boolean(extension);
  }
  if (insertions.length) {
    const textarea = edit.elements.body;
    const cursor = textarea.selectionEnd;
    const before = textarea.value.slice(0, cursor);
    const after = textarea.value.slice(cursor);
    const separation = (text, boundary) => {
      if (!text || text[boundary] !== '\n') return text ? '\n\n' : '';
      return (boundary === 0 ? /^\n\n/.test(text) : /\n\n$/.test(text)) ? '' : '\n';
    };
    const prefix = separation(before, before.length - 1);
    const suffix = separation(after, 0) || (after ? '' : '\n\n');
    textarea.setRangeText(prefix + insertions.join('\n\n') + suffix, cursor, cursor, 'end');
    textarea.focus();
  }
  $('#attachment-status').textContent = [
    attachments.length ? '첨부 ' + attachments.length + '개 · 발행할 때 업로드됩니다.' : '',
    skipped.length ? '5 MB 초과: ' + skipped.join(', ') : '',
  ].filter(Boolean).join(' ');
  if (includesImage) $('#preview-details').open = true;
  updatePreview();
}

async function uploadAttachments(body) {
  for (const item of attachments) {
    if (item.uploaded || !body.includes('](' + item.path + ')')) continue;
    $('#attachment-status').textContent = '업로드 중 · ' + item.label;
    await github(session, 'PUT', {
      message: 'Upload blog attachment',
      branch: session.branch,
      content: encode(new Uint8Array(await item.file.arrayBuffer())),
    }, 'docs/' + item.path.slice(2));
    item.uploaded = true;
  }
  if (attachments.length) $('#attachment-status').textContent = '글 저장 중';
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
  if (busy) return;
  if (location.hash === '#write') location.hash = editorReturn;
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
      category: values.category === newCategoryChoice
        ? values.newCategory.trim()
        : decodeURIComponent(values.category.slice('#category/'.length)),
      tags: [...new Set(values.tags.split(',').map((tag) => tag.trim()).filter(Boolean))],
      summary: values.summary.trim(),
      body: values.body.trim(),
      created: editing?.created || new Date().toISOString(),
      updated: new Date().toISOString(),
    };
    if (!post.title || !post.category || !post.body) throw new Error('제목, 카테고리와 본문을 입력해 주세요.');
    await uploadAttachments(post.body);
    await save([...posts.filter((entry) => entry.id !== post.id), post], (editing ? 'Edit: ' : 'Publish: ') + post.title);
    clearAttachments();
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
for (const dialog of [connection, removal]) {
  dialog.addEventListener('cancel', (event) => { if (busy) event.preventDefault(); });
}
connection.addEventListener('close', () => { connect.elements.token.value = ''; });
edit.elements.category.addEventListener('change', () => {
  syncNewCategoryField();
  if (!edit.elements.newCategory.disabled) edit.elements.newCategory.focus();
});
$('#cancel-edit').addEventListener('click', () => {
  if (!busy) location.hash = editorReturn;
});
const attachmentInput = $('#attachment-file');
attachmentInput.addEventListener('change', () => {
  queueFiles(attachmentInput.files);
  attachmentInput.value = '';
});
const dropZone = $('#drop-zone');
dropZone.addEventListener('dragover', (event) => {
  event.preventDefault();
  dropZone.dataset.dragging = 'true';
});
dropZone.addEventListener('dragleave', () => { delete dropZone.dataset.dragging; });
dropZone.addEventListener('drop', (event) => {
  event.preventDefault();
  delete dropZone.dataset.dragging;
  queueFiles(event.dataTransfer.files);
});
edit.elements.body.addEventListener('paste', (event) => {
  const images = [...(event.clipboardData?.items || [])]
    .filter((item) => item.kind === 'file' && Object.hasOwn(imageExtensions, item.type))
    .map((item) => item.getAsFile())
    .filter(Boolean);
  if (!images.length) return;
  event.preventDefault();
  queueFiles(images);
});
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

