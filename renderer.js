const fs = require('fs');
const path = require('path');
const { ipcRenderer } = require('electron');

const mainTabs = document.getElementById('mainTabs');
const subTabs = document.getElementById('subTabs');
const emojiGrid = document.getElementById('emojiGrid');
const textField = document.getElementById('textField');
const descriptionBox = document.getElementById('descriptionBox');

// Define main categories.
const mainCategories = ["characters", "servers"];
let currentMainCategory = "";
let currentSubCategory = "";
// Global mapping for the current main category (all emojis from all subcategories).
// Keys are the base names (lowercase) and values are { src, code }.
let globalMainMapping = {};

// ------------------------------
// Utility functions for caret preservation using a marker.
// ------------------------------
function saveCaretPosition() {
  const sel = window.getSelection();
  if (!sel.rangeCount) return null;
  const range = sel.getRangeAt(0);
  const marker = document.createElement('span');
  marker.id = 'caret-marker';
  marker.appendChild(document.createTextNode('\u200B')); // zero-width space
  range.insertNode(marker);
  return marker;
}

function restoreCaretPosition() {
  const marker = document.getElementById('caret-marker');
  if (marker) {
    const range = document.createRange();
    range.setStartAfter(marker);
    range.collapse(true);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    marker.parentNode.removeChild(marker);
  }
}

// ------------------------------
// Utility: Append a trailing editable text node if not present.
// ------------------------------
function ensureTrailingTextNode(element) {
  if (!element.lastChild || element.lastChild.nodeType !== Node.TEXT_NODE) {
    element.appendChild(document.createTextNode('\u200B'));
  }
}

// ------------------------------
// Emoji insertion into the text field.
// ------------------------------
function insertEmojiIntoTextField(src, code) {
  // Create a non-editable image.
  const img = document.createElement('img');
  img.src = src;
  img.alt = code;
  img.setAttribute('data-code', code);
  img.style.width = '24px';
  img.style.height = '24px';
  img.style.verticalAlign = 'middle';
  img.style.display = 'inline-block';
  img.setAttribute('contenteditable', 'false');
  textField.appendChild(img);
  
  // Append a trailing zero-width space text node so the caret can be placed after the emoji.
  ensureTrailingTextNode(textField);
}

// ------------------------------
// Global mapping builder (case-insensitive) for current main category.
// ------------------------------
function buildGlobalMainMapping(mainCategory) {
  globalMainMapping = {};
  const dirPath = path.join(__dirname, 'img', mainCategory);
  let subFolders;
  try {
    subFolders = fs.readdirSync(dirPath);
  } catch (err) {
    console.error("Error reading main category folder:", err);
    return;
  }
  subFolders.forEach(folder => {
    const folderPath = path.join(dirPath, folder);
    if (fs.statSync(folderPath).isDirectory()) {
      let files;
      try {
        files = fs.readdirSync(folderPath);
      } catch (err) {
        console.error("Error reading subfolder:", err);
        return;
      }
      files.forEach(file => {
        if (!/\.(png|jpe?g|gif)$/i.test(file)) return;
        const imgPath = path.join(folderPath, file);
        const fullPath = 'file://' + imgPath;
        const baseName = file.split('.')[0].toLowerCase();
        const code = `:${baseName}:`;
        globalMainMapping[baseName] = { src: fullPath, code: code };
      });
    }
  });
}

// ------------------------------
// Main Tabs: "Characters" and "Servers".
// ------------------------------
function loadMainTabs() {
  mainTabs.innerHTML = "";
  mainCategories.forEach((cat, index) => {
    const btn = document.createElement('button');
    btn.className = 'main-tab';
    btn.textContent = cat.charAt(0).toUpperCase() + cat.slice(1);
    btn.dataset.category = cat;
    btn.addEventListener('click', () => {
      document.querySelectorAll('.main-tab').forEach(tab => tab.classList.remove('active'));
      btn.classList.add('active');
      currentMainCategory = cat;
      buildGlobalMainMapping(cat);
      loadSubCategories(cat);
    });
    mainTabs.appendChild(btn);
    if (index === 0) btn.click();
  });
}

// ------------------------------
// Sub-tabs: loaded from folders under img/<mainCategory>
// Each sub-tab shows an icon loaded from: tabicons/<mainCategory>/<subCategory>.png
// ------------------------------
function loadSubCategories(mainCategory) {
  subTabs.innerHTML = "";
  const dirPath = path.join(__dirname, 'img', mainCategory);
  let folders;
  try {
    folders = fs.readdirSync(dirPath);
  } catch (err) {
    console.error("Error reading main category folder:", err);
    return;
  }
  const subCategories = folders.filter(folder => {
    const folderPath = path.join(dirPath, folder);
    return fs.statSync(folderPath).isDirectory();
  });
  subCategories.forEach((subCat, index) => {
    const btn = document.createElement('button');
    btn.className = 'sub-tab';
    btn.dataset.subcategory = subCat;
    
    // Create icon element.
    const icon = document.createElement('img');
    const iconPath = 'file://' + path.join(__dirname, 'tabicons', currentMainCategory, subCat + '.png');
    icon.src = iconPath;
    icon.alt = subCat;
    btn.appendChild(icon);
    
    // Add a text label.
    const span = document.createElement('span');
    span.textContent = subCat;
    btn.appendChild(span);
    
    btn.addEventListener('click', () => {
      document.querySelectorAll('.sub-tab').forEach(tab => tab.classList.remove('active'));
      btn.classList.add('active');
      currentSubCategory = subCat;
      loadCategoryEmojis(currentMainCategory, subCat);
    });
    subTabs.appendChild(btn);
    if (index === 0) btn.click();
  });
}

// ------------------------------
// Load emoji grid from: img/<mainCategory>/<subCategory>
// ------------------------------
function loadCategoryEmojis(mainCategory, subCategory) {
  emojiGrid.innerHTML = "";
  const dirPath = path.join(__dirname, 'img', mainCategory, subCategory);
  let files;
  try {
    files = fs.readdirSync(dirPath);
  } catch (err) {
    console.error("Error reading sub-category folder:", err);
    return;
  }
  files.forEach(file => {
    if (!/\.(png|jpe?g|gif)$/i.test(file)) return;
    const imgPath = path.join(dirPath, file);
    const fullPath = 'file://' + imgPath;
    const baseName = file.split('.')[0];
    const code = `:${baseName}:`;
    const img = document.createElement('img');
    img.src = fullPath;
    img.alt = code;
    img.setAttribute('data-code', code);
    img.addEventListener('click', () => {
      insertEmojiIntoTextField(fullPath, code);
    });
    img.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      showDescription(e.clientX, e.clientY, code, fullPath);
    });
    emojiGrid.appendChild(img);
  });
}

// ------------------------------
// Description box (for right-click)
// ------------------------------
function showDescription(x, y, code, src) {
  descriptionBox.innerHTML = `<strong>Code:</strong> ${code}<br><strong>Source:</strong> ${src}`;
  descriptionBox.style.left = x + "px";
  descriptionBox.style.top = y + "px";
  descriptionBox.style.display = "block";
}
document.addEventListener('click', () => {
  descriptionBox.style.display = "none";
});

// ------------------------------
// Auto-conversion: Replace typed codes (e.g., :1: or :1_2:) with emoji images.
// Uses a temporary marker to preserve caret position.
// ------------------------------
function replaceTextCodes(root) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
  let node;
  // Updated regex to include underscores.
  const regex = /:([A-Za-z0-9_]+):/g;
  while ((node = walker.nextNode())) {
    let text = node.nodeValue;
    if (!regex.test(text)) continue;
    regex.lastIndex = 0;
    const frag = document.createDocumentFragment();
    let lastIndex = 0;
    let match;
    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        frag.appendChild(document.createTextNode(text.substring(lastIndex, match.index)));
      }
      const key = match[1].toLowerCase();
      if (globalMainMapping[key]) {
        const img = document.createElement('img');
        img.src = globalMainMapping[key].src;
        img.alt = globalMainMapping[key].code;
        img.setAttribute('data-code', globalMainMapping[key].code);
        img.style.width = '24px';
        img.style.height = '24px';
        img.style.verticalAlign = 'middle';
        img.style.display = 'inline-block';
        img.setAttribute('contenteditable', 'false');
        frag.appendChild(img);
      } else {
        frag.appendChild(document.createTextNode(match[0]));
      }
      lastIndex = regex.lastIndex;
    }
    if (lastIndex < text.length) {
      frag.appendChild(document.createTextNode(text.substring(lastIndex)));
    }
    node.parentNode.replaceChild(frag, node);
  }
}

textField.addEventListener('input', () => {
  const marker = saveCaretPosition();
  replaceTextCodes(textField);
  restoreCaretPosition();
  ensureTrailingTextNode(textField);
});

// ------------------------------
// Copy event: Convert images back to their text codes and remove zero-width spaces.
// ------------------------------
textField.addEventListener('copy', function(e) {
  e.preventDefault();
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = textField.innerHTML;
  tempDiv.querySelectorAll('img').forEach(img => {
    const code = img.getAttribute('data-code') || img.alt || '';
    const textNode = document.createTextNode(code);
    img.parentNode.replaceChild(textNode, img);
  });
  let textToCopy = tempDiv.textContent.replace(/\u200B/g, '');
  e.clipboardData.setData('text/plain', textToCopy);
});

// ------------------------------
// Initial load and IPC handling.
// ------------------------------
loadMainTabs();
ipcRenderer.on('folder-changed', (event, data) => {
  console.log('Folder changed:', data);
  if (currentMainCategory) {
    buildGlobalMainMapping(currentMainCategory);
    loadSubCategories(currentMainCategory);
  }
});
