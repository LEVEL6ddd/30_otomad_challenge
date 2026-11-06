// 30 OTOMAD CHALLENGE の動きを作るプログラムです。
// お題を変えるだけなら prompts.js を編集してください。

const STORAGE_KEY = "30-otomad-challenge";
const HASHTAG = "30OTOMADCHALLENGE";
const FONT = '"Noto Sans JP", sans-serif';

const BLANK_IMAGE = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";

const $ = (id) => document.getElementById(id);

let state = { items: {}, comment: "", nickname: "", xid: "", icon: "" };
let openEditor = null; // 開いている編集欄の番号

/* ---------- 保存 ---------- */

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved) state = { ...state, ...saved };
  } catch (error) {
    console.warn("保存データを読み込めませんでした", error);
  }
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.warn("保存できませんでした", error);
  }
}

/* ---------- URLの読み取り ---------- */

function parseVideoUrl(text) {
  let url;
  try {
    url = new URL(text.trim());
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^(www|m|sp|music)\./, "");

  if (host === "youtu.be" || host === "youtube.com") {
    const id = host === "youtu.be"
      ? url.pathname.split("/")[1]
      : url.searchParams.get("v") || (url.pathname.match(/^\/(?:shorts|embed|live)\/([\w-]+)/) || [])[1];
    if (id && /^[\w-]{6,}$/.test(id)) {
      return {
        site: "youtube",
        url: `https://www.youtube.com/watch?v=${id}`,
        thumb: `https://i.ytimg.com/vi/${id}/mqdefault.jpg`,
      };
    }
  }

  if (host === "nicovideo.jp" || host === "nico.ms") {
    const match = url.pathname.match(/((?:sm|nm|so)(\d+))/);
    if (match) {
      return {
        site: "niconico",
        url: `https://www.nicovideo.jp/watch/${match[1]}`,
        thumb: match[1].startsWith("so") ? "" : `https://nicovideo.cdn.nimg.jp/thumbnails/${match[2]}/${match[2]}`,
      };
    }
  }
  return null;
}

async function fetchYouTubeInfo(videoUrl) {
  const api = `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(videoUrl)}`;
  const response = await fetch(api);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

/* ---------- 画像ファイルの読み込み ---------- */

function loadImage(src, useCors) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    if (useCors) image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

// 大きな画像は保存できないので、小さくしてから持っておく
async function fileToDataUrl(file, maxSize) {
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await loadImage(objectUrl, false);
    const scale = Math.min(1, maxSize / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(image.naturalWidth * scale);
    canvas.height = Math.round(image.naturalHeight * scale);
    canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.85);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/* ---------- お題カード ---------- */

function makeElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function makeThumb(src) {
  const image = makeElement("img", "video-thumb");
  image.alt = "";
  image.loading = "lazy";
  if (src) {
    image.src = src;
    image.onerror = () => { image.src = BLANK_IMAGE; };
  }
  return image;
}

function renderCard(number) {
  const card = document.querySelector(`[data-number="${number}"]`);
  const prompt = PROMPTS[number - 1];
  const item = state.items[number];
  card.replaceChildren();

  const title = makeElement("p", "prompt-title");
  title.append(makeElement("span", "", `${number}. `), prompt);
  card.append(title);

  if (openEditor === number) {
    card.append(makeEditor(number));
  } else if (item) {
    const row = makeElement("div", "video-row");
    const text = makeElement("div", "video-text");
    text.append(makeElement("p", "video-title", item.title));
    if (item.creator) text.append(makeElement("p", "video-creator", item.creator));

    const actions = makeElement("div", "video-actions");
    const edit = makeElement("button", "text-button", "編集");
    edit.type = "button";
    edit.onclick = () => showEditor(number);
    const clear = makeElement("button", "text-button", "クリア");
    clear.type = "button";
    clear.onclick = () => {
      delete state.items[number];
      save();
      renderCard(number);
      updateStatus();
    };
    actions.append(edit, clear);
    row.append(makeThumb(item.customThumb || item.thumb), text, actions);
    card.append(row);
  } else {
    const add = makeElement("button", "add-button", "＋ 動画を選ぶ");
    add.type = "button";
    add.onclick = () => showEditor(number);
    card.append(add);
  }
}

function showEditor(number) {
  const previous = openEditor;
  openEditor = number;
  if (previous) renderCard(previous);
  renderCard(number);
  document.querySelector(`[data-number="${number}"] input`).focus();
}

function closeEditor() {
  const number = openEditor;
  openEditor = null;
  if (number) renderCard(number);
}

function makeField(labelText, input) {
  const label = makeElement("label", "field");
  label.append(makeElement("span", "field-label", labelText), input);
  return label;
}

function makeEditor(number) {
  const draft = { url: "", title: "", creator: "", thumb: "", customThumb: "", ...state.items[number] };
  const editor = makeElement("form", "editor");

  const urlInput = makeElement("input");
  urlInput.type = "url";
  urlInput.placeholder = "ニコニコ動画・YouTubeのURL";
  urlInput.value = draft.url;

  const message = makeElement("p", "hint");
  message.setAttribute("aria-live", "polite");

  const titleInput = makeElement("input");
  titleInput.type = "text";
  titleInput.maxLength = 100;
  titleInput.required = true;
  titleInput.value = draft.title;

  const creatorInput = makeElement("input");
  creatorInput.type = "text";
  creatorInput.maxLength = 50;
  creatorInput.value = draft.creator;

  const preview = makeThumb(draft.customThumb || draft.thumb || BLANK_IMAGE);
  const fileLabel = makeElement("label", "button button-outline button-grow", "サムネイルを選ぶ");
  const fileInput = makeElement("input", "visually-hidden");
  fileInput.type = "file";
  fileInput.accept = "image/*";
  fileLabel.append(fileInput);

  fileInput.onchange = async () => {
    const file = fileInput.files[0];
    if (!file) return;
    try {
      draft.customThumb = await fileToDataUrl(file, 320);
      preview.src = draft.customThumb;
    } catch {
      message.textContent = "この画像は読み込めませんでした。";
      message.classList.add("error");
    }
  };

  urlInput.onchange = async () => {
    const text = urlInput.value.trim();
    message.classList.remove("error");
    message.textContent = "";
    if (!text) {
      draft.url = "";
      draft.thumb = "";
      preview.src = draft.customThumb || BLANK_IMAGE;
      return;
    }

    const video = parseVideoUrl(text);
    if (!video) {
      draft.url = "";
      draft.thumb = "";
      message.textContent = "このURLは読み取れませんでした。タイトルは手で入力できます。";
      message.classList.add("error");
      return;
    }
    draft.url = video.url;
    draft.thumb = video.thumb;
    preview.src = draft.customThumb || video.thumb || BLANK_IMAGE;

    if (video.site === "niconico") {
      message.textContent = "ニコニコ動画はタイトルを自動で取得できないため、手で入力してください。まとめ画像にサムネイルを入れるには、画像ファイルを選んでください。";
      titleInput.focus();
      return;
    }

    message.textContent = "動画の情報を取得しています…";
    try {
      const info = await fetchYouTubeInfo(video.url);
      if (draft.url !== video.url) return;
      titleInput.value = info.title || titleInput.value;
      creatorInput.value = info.author_name || creatorInput.value;
      message.textContent = "取得しました。";
    } catch {
      if (draft.url !== video.url) return;
      message.textContent = "動画の情報を取得できませんでした。タイトルは手で入力してください。";
      message.classList.add("error");
    }
  };

  const actions = makeElement("div", "editor-actions");
  const submit = makeElement("button", "button button-primary", "決定");
  submit.type = "submit";
  const cancel = makeElement("button", "button button-outline", "閉じる");
  cancel.type = "button";
  cancel.onclick = closeEditor;
  actions.append(submit, cancel);

  editor.onsubmit = (event) => {
    event.preventDefault();
    const title = titleInput.value.trim();
    if (!title) return;
    state.items[number] = { ...draft, title, creator: creatorInput.value.trim() };
    save();
    updateStatus();
    closeEditor();
  };

  const imageRow = makeElement("div", "editor-image");
  imageRow.append(preview, fileLabel);

  editor.append(
    makeField("動画URL（任意）", urlInput),
    message,
    makeField("タイトル（必須）", titleInput),
    makeField("投稿者（任意）", creatorInput),
    imageRow,
    actions,
  );
  return editor;
}

/* ---------- プロフィール ---------- */

function renderIcon() {
  const preview = $("icon-preview");
  if (state.icon) {
    const image = makeElement("img");
    image.alt = "";
    image.src = state.icon;
    preview.replaceChildren(image);
  } else {
    preview.textContent = "♪";
  }
  $("icon-clear").hidden = !state.icon;
}

function filledNumbers() {
  return PROMPTS.map((_, index) => index + 1).filter((number) => state.items[number]);
}

function updateStatus() {
  const count = filledNumbers().length;
  const nickname = state.nickname.trim();
  $("count").textContent = count;
  $("make").textContent = `画像を作る（${count}本）`;
  $("make").disabled = count === 0 || !nickname;
  $("make-hint").textContent = count === 0
    ? "まず1本、動画を選んでください。"
    : nickname ? "" : "ニックネームを入力すると画像を作れます。";
}

/* ---------- 画像づくり ---------- */

function fitLines(ctx, text, maxWidth, maxLines) {
  const lines = [];
  let line = "";
  const chars = Array.from(text);

  for (let index = 0; index < chars.length; index += 1) {
    const next = line + chars[index];
    if (ctx.measureText(next).width <= maxWidth) {
      line = next;
      continue;
    }
    if (lines.length === maxLines - 1) {
      while (line && ctx.measureText(`${line}…`).width > maxWidth) line = line.slice(0, -1);
      lines.push(`${line}…`);
      return lines;
    }
    lines.push(line);
    line = chars[index];
  }
  if (line) lines.push(line);
  return lines;
}

function drawLines(ctx, lines, x, y, lineHeight) {
  lines.forEach((line, index) => ctx.fillText(line, x, y + index * lineHeight));
}

function drawCover(ctx, image, x, y, width, height) {
  const sourceWidth = image.naturalWidth;
  const sourceHeight = image.naturalHeight;
  const scale = Math.max(width / sourceWidth, height / sourceHeight);
  const cropWidth = width / scale;
  const cropHeight = height / scale;
  ctx.drawImage(
    image,
    (sourceWidth - cropWidth) / 2, (sourceHeight - cropHeight) / 2, cropWidth, cropHeight,
    x, y, width, height,
  );
}

async function loadThumbForCanvas(item) {
  const src = item.customThumb || item.thumb;
  if (!src) return null;
  try {
    return await loadImage(src, !src.startsWith("data:"));
  } catch {
    return null;
  }
}

async function buildImage() {
  const numbers = filledNumbers();
  const items = numbers.map((number) => state.items[number]);
  const nickname = state.nickname.trim();
  const comment = state.comment.trim();
  const xid = state.xid.trim();

  // 使う文字のフォントを先に読み込む
  const allText = [
    "30 OTOMAD CHALLENGE", nickname, comment, xid,
    ...numbers.map((number) => PROMPTS[number - 1]),
    ...items.flatMap((item) => [item.title, item.creator]),
    "さんの本作0123456789.…@#",
  ].join("");
  await Promise.allSettled([
    document.fonts.load(`900 72px ${FONT}`, "30 OTOMAD CHALLENGE"),
    document.fonts.load(`700 24px ${FONT}`, allText),
    document.fonts.load(`500 18px ${FONT}`, allText),
  ]);

  const thumbs = await Promise.all(items.map(loadThumbForCanvas));
  const icon = state.icon ? await loadImage(state.icon, false).catch(() => null) : null;

  const width = 1080;
  const margin = 36;
  const gap = 12;
  const columns = 3;
  const cellWidth = (width - margin * 2 - gap * (columns - 1)) / columns;
  const thumbWidth = 140;
  const thumbHeight = 79;
  const rowHeight = 182;
  const headerHeight = 190;
  const rows = Math.ceil(items.length / columns);

  const measure = document.createElement("canvas").getContext("2d");
  measure.font = `500 24px ${FONT}`;
  const commentLines = comment ? fitLines(measure, comment.replace(/\s+/g, " "), width - margin * 2 - 48, 6) : [];
  const commentHeight = commentLines.length ? commentLines.length * 36 + 36 + 16 : 0;
  const footerHeight = 76;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = headerHeight + rows * rowHeight + commentHeight + footerHeight;
  const ctx = canvas.getContext("2d");
  ctx.textBaseline = "top";

  ctx.fillStyle = "#efefef";
  ctx.fillRect(0, 0, width, canvas.height);

  // 見出し
  ctx.textAlign = "center";
  ctx.fillStyle = "#333333";
  ctx.font = `900 74px ${FONT}`;
  ctx.fillText("30 OTOMAD CHALLENGE", width / 2, 28, width - margin * 2);

  const subtitle = `${nickname}さんの${items.length}本${xid ? `  @${xid}` : ""}`;
  ctx.font = `700 30px ${FONT}`;
  ctx.fillStyle = "#6e6e6e";
  const iconSize = icon ? 52 : 0;
  const subtitleLine = fitLines(ctx, subtitle, width - margin * 2 - iconSize - 12, 1)[0];
  const subtitleWidth = ctx.measureText(subtitleLine).width;
  const subtitleX = (width - subtitleWidth + iconSize + (icon ? 12 : 0)) / 2;
  if (icon) {
    const iconX = subtitleX - iconSize - 12;
    ctx.save();
    ctx.beginPath();
    ctx.arc(iconX + iconSize / 2, 142, iconSize / 2, 0, Math.PI * 2);
    ctx.clip();
    drawCover(ctx, icon, iconX, 116, iconSize, iconSize);
    ctx.restore();
  }
  ctx.textAlign = "left";
  ctx.fillText(subtitleLine, subtitleX, 120);

  // 動画の一覧
  let missingThumbs = 0;
  items.forEach((item, index) => {
    const x = margin + (index % columns) * (cellWidth + gap);
    const y = headerHeight + Math.floor(index / columns) * rowHeight;
    const textX = x + thumbWidth + 10;
    const textWidth = cellWidth - thumbWidth - 14;
    const thumb = thumbs[index];

    if (thumb) {
      drawCover(ctx, thumb, x, y, thumbWidth, thumbHeight);
    } else {
      missingThumbs += 1;
      ctx.fillStyle = "#d9d9d9";
      ctx.fillRect(x, y, thumbWidth, thumbHeight);
      ctx.fillStyle = "#555555";
      ctx.font = `700 15px ${FONT}`;
      drawLines(ctx, fitLines(ctx, item.title, thumbWidth - 16, 3), x + 8, y + 8, 21);
    }

    ctx.fillStyle = "#262626";
    ctx.font = `700 22px ${FONT}`;
    const titleLines = fitLines(ctx, item.title, textWidth, 3);
    drawLines(ctx, titleLines, textX, y - 4, 29);

    if (item.creator) {
      ctx.fillStyle = "#6e6e6e";
      ctx.font = `500 17px ${FONT}`;
      ctx.fillText(fitLines(ctx, item.creator, textWidth, 1)[0], textX, y - 2 + titleLines.length * 29);
    }

    ctx.fillStyle = "#555555";
    ctx.font = `700 18px ${FONT}`;
    const promptText = `${numbers[index]}. ${PROMPTS[numbers[index] - 1]}`;
    drawLines(ctx, fitLines(ctx, promptText, cellWidth - 4, 2), x, y + 122, 24);
  });

  // ひとこと
  let cursor = headerHeight + rows * rowHeight;
  if (commentLines.length) {
    ctx.fillStyle = "#fafafa";
    ctx.fillRect(margin, cursor, width - margin * 2, commentHeight - 16);
    ctx.fillStyle = "#262626";
    ctx.font = `500 24px ${FONT}`;
    drawLines(ctx, commentLines, margin + 24, cursor + 18, 36);
    cursor += commentHeight;
  }

  // フッター
  ctx.textAlign = "center";
  ctx.fillStyle = "#6e6e6e";
  ctx.font = `700 24px ${FONT}`;
  ctx.fillText(`#${HASHTAG}`, width / 2, cursor + 16);

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("画像を作れませんでした");
  return { blob, missingThumbs };
}

function videoListText() {
  return filledNumbers().map((number) => {
    const item = state.items[number];
    return `${number}. ${PROMPTS[number - 1]}\n${item.title}${item.url ? `\n${item.url}` : ""}`;
  }).join("\n\n");
}

let resultUrl = "";

async function makeImage() {
  const button = $("make");
  button.disabled = true;
  button.textContent = "画像を作っています…";
  $("make-hint").textContent = "";

  try {
    const { blob, missingThumbs } = await buildImage();
    if (resultUrl) URL.revokeObjectURL(resultUrl);
    resultUrl = URL.createObjectURL(blob);
    $("result-image").src = resultUrl;
    $("download").href = resultUrl;

    const warning = $("result-warning");
    warning.hidden = missingThumbs === 0;
    warning.textContent = `${missingThumbs}本はサムネイルの代わりにタイトルを表示しています。入れたい場合は、編集から画像ファイルを選んでください。`;

    const pageUrl = location.protocol.startsWith("http") ? `\n${location.origin}${location.pathname}` : "";
    const text = `30 OTOMAD CHALLENGE #${HASHTAG}${pageUrl}`;
    $("share").href = `https://x.com/intent/post?text=${encodeURIComponent(text)}`;

    $("result").hidden = false;
    $("result").scrollIntoView({ behavior: "smooth" });
  } catch (error) {
    console.error(error);
    $("make-hint").textContent = "画像を作れませんでした。もう一度お試しください。";
  }
  updateStatus();
}

/* ---------- はじまり ---------- */

function start() {
  load();

  const list = $("prompt-list");
  PROMPTS.forEach((_, index) => {
    const card = makeElement("article", "prompt-card");
    card.dataset.number = index + 1;
    list.append(card);
    renderCard(index + 1);
  });

  for (const key of ["comment", "nickname", "xid"]) {
    $(key).value = state[key];
    $(key).oninput = () => {
      if (key === "xid") $(key).value = $(key).value.replace(/[^\w]/g, "");
      state[key] = $(key).value;
      save();
      updateStatus();
    };
  }

  $("icon-file").onchange = async () => {
    const file = $("icon-file").files[0];
    if (!file) return;
    try {
      state.icon = await fileToDataUrl(file, 200);
      save();
      renderIcon();
    } catch {
      $("make-hint").textContent = "このアイコン画像は読み込めませんでした。";
    }
  };
  $("icon-clear").onclick = () => {
    state.icon = "";
    $("icon-file").value = "";
    save();
    renderIcon();
  };

  $("make").onclick = makeImage;

  $("copy").onclick = async () => {
    try {
      await navigator.clipboard.writeText(videoListText());
      $("copy").textContent = "コピーしました";
    } catch {
      $("copy").textContent = "コピーできませんでした";
    }
    setTimeout(() => { $("copy").textContent = "動画リストをコピー"; }, 2000);
  };

  $("reset").onclick = () => {
    if (!confirm("入力内容をすべて消します。よろしいですか？")) return;
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* 保存が使えない環境 */ }
    location.reload();
  };

  renderIcon();
  updateStatus();
}

start();
