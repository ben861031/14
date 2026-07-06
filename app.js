const els = {
  rowsBody: document.getElementById('rowsBody'),
  rowTemplate: document.getElementById('rowTemplate'),
  addRowBtn: document.getElementById('addRowBtn'),
  clearBtn: document.getElementById('clearBtn'),
  loadSampleBtn: document.getElementById('loadSampleBtn'),
  copyBtn: document.getElementById('copyBtn'),
  settleBtn: document.getElementById('settleBtn'),
  exportHistoryBtn: document.getElementById('exportHistoryBtn'),
  clearHistoryBtn: document.getElementById('clearHistoryBtn'),
  historyList: document.getElementById('historyList'),
  exportCsvBtn: document.getElementById('exportCsvBtn'),
  printBtn: document.getElementById('printBtn'),
  resultCards: document.getElementById('resultCards'),
  messageBox: document.getElementById('messageBox'),
  summaryText: document.getElementById('summaryText'),
  grandTotal: document.getElementById('grandTotal'),
  shopName: document.getElementById('shopName'),
  orderDate: document.getElementById('orderDate'),
  finalPaidAmount: document.getElementById('finalPaidAmount'),
  onlyShareChecked: document.getElementById('onlyShareChecked'),
  memberNameInput: document.getElementById('memberNameInput'),
  addMemberBtn: document.getElementById('addMemberBtn'),
  clearMembersBtn: document.getElementById('clearMembersBtn'),
  memberChips: document.getElementById('memberChips'),
  memberOptions: document.getElementById('memberOptions')
};

const STORAGE_KEY = 'office-drink-calculator-v5-current';
const HISTORY_KEY = 'office-drink-calculator-v4-history';
const MEMBERS_KEY = 'office-drink-calculator-v5-members';

function money(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) return 0;
  return Math.round(num);
}

function todayText() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function allocateEven(total, count) {
  const safeCount = Math.max(0, count);
  if (safeCount === 0 || total === 0) return Array(safeCount).fill(0);

  const sign = total < 0 ? -1 : 1;
  const absTotal = Math.abs(Math.round(total));
  const base = Math.floor(absTotal / safeCount);
  const remainder = absTotal % safeCount;

  return Array.from({ length: safeCount }, (_, index) => sign * (base + (index < remainder ? 1 : 0)));
}

function addRow(data = {}) {
  const node = els.rowTemplate.content.cloneNode(true);
  const row = node.querySelector('tr');

  row.querySelector('.share').checked = data.share ?? true;
  row.querySelector('.name').value = data.name ?? '';
  row.querySelector('.item').value = data.item ?? '';
  row.querySelector('.price').value = data.price ?? 0;
  row.querySelector('.qty').value = data.qty ?? 1;

  row.querySelector('.pick-member').addEventListener('click', () => openMemberPicker(row));
  row.addEventListener('input', handleChange);
  row.addEventListener('change', handleChange);
  row.querySelector('.delete-row').addEventListener('click', () => {
    row.remove();
    handleChange();
  });

  els.rowsBody.appendChild(row);
  calculate();
}

function getRows() {
  return [...els.rowsBody.querySelectorAll('tr')].map((row, index) => {
    const price = money(row.querySelector('.price').value);
    const qty = Math.max(1, money(row.querySelector('.qty').value || 1));
    const base = price * qty;
    return {
      index,
      element: row,
      share: row.querySelector('.share').checked,
      name: row.querySelector('.name').value.trim() || `未命名${index + 1}`,
      item: row.querySelector('.item').value.trim(),
      price,
      qty,
      base,
      diffShare: 0,
      total: base
    };
  });
}

function getSettings() {
  return {
    shopName: els.shopName.value.trim(),
    orderDate: els.orderDate.value,
    payerName: '',
    orderNote: '',
    finalPaidAmount: money(els.finalPaidAmount.value),
    onlyShareChecked: els.onlyShareChecked.checked
  };
}

function calculate() {
  const settings = getSettings();
  const rows = getRows();
  const drinkTotal = rows.reduce((sum, row) => sum + row.base, 0);
  const finalPaid = settings.finalPaidAmount || drinkTotal;
  const difference = finalPaid - drinkTotal;
  const eligibleRows = settings.onlyShareChecked ? rows.filter(row => row.share) : rows;
  const diffShares = allocateEven(difference, eligibleRows.length);

  eligibleRows.forEach((row, index) => {
    row.diffShare = diffShares[index] || 0;
  });

  rows.forEach(row => {
    row.total = Math.max(0, row.base + row.diffShare);
    row.element.querySelector('.baseAmount').textContent = row.base;
    const diffText = row.diffShare > 0 ? `+${row.diffShare}` : String(row.diffShare || 0);
    row.element.querySelector('.diffShare').textContent = diffText;
    row.element.querySelector('.payAmount').textContent = row.total;
  });

  renderResult(rows, settings, drinkTotal, finalPaid, difference, eligibleRows.length);
  saveState();
}

function renderResult(rows, settings, drinkTotal, finalPaid, difference, shareCount) {
  const grandTotal = rows.reduce((sum, row) => sum + row.total, 0);
  els.grandTotal.textContent = grandTotal.toLocaleString('zh-TW');

  const diffLabel = difference > 0 ? `多出 ${difference} 元，平均加回` : difference < 0 ? `折扣 ${Math.abs(difference)} 元，平均扣除` : '無差額';
  els.summaryText.textContent = rows.length
    ? `飲料原價 ${drinkTotal} 元，最後實付 ${finalPaid} 元，${diffLabel}，參與分攤 ${shareCount} 人。`
    : '目前尚未輸入資料。';

  els.resultCards.innerHTML = '';
  const cards = [
    ['飲料原價總額', drinkTotal],
    ['最後實付總額', finalPaid],
    ['反推差額', difference],
    ['參與分攤人數', shareCount],
    ['最後應收', grandTotal]
  ];

  cards.forEach(([label, value]) => {
    const div = document.createElement('div');
    div.className = 'result-card';
    const displayValue = typeof value === 'number' ? value.toLocaleString('zh-TW') : value;
    div.innerHTML = `<span>${label}</span><strong>${displayValue}</strong>`;
    els.resultCards.appendChild(div);
  });

  els.messageBox.value = buildMessage(rows, settings, grandTotal);
}

function buildMessage(rows, settings, grandTotal) {
  if (!rows.length) return '';

  const title = settings.shopName ? `【${settings.shopName} 飲料收款】` : '【飲料收款】';
  const date = settings.orderDate ? `日期：${settings.orderDate}` : '';
  const detailLines = rows.map(row => `${row.name}：${row.total}元`);

  const noteLines = [
    `合計：${grandTotal}元`,
    '請依試算金額付款，謝謝～'
  ].filter(Boolean);

  return [title, date, '', ...detailLines, '', ...noteLines].filter(line => line !== '').join('\n');
}

function handleChange() {
  calculate();
}

function getMembers() {
  try {
    const saved = localStorage.getItem(MEMBERS_KEY);
    const members = saved ? JSON.parse(saved) : [];
    return Array.isArray(members) ? members.filter(Boolean) : [];
  } catch (error) {
    console.warn('載入人員名單失敗。', error);
    return [];
  }
}

function saveMembers(members) {
  const unique = [...new Set(members.map(name => String(name).trim()).filter(Boolean))];
  localStorage.setItem(MEMBERS_KEY, JSON.stringify(unique));
  renderMembers();
}

function addMember(name = els.memberNameInput.value) {
  const cleanName = String(name || '').trim();
  if (!cleanName) {
    showToast('請先輸入姓名');
    return;
  }
  const members = getMembers();
  if (members.includes(cleanName)) {
    showToast('這個姓名已在人員名單內');
    return;
  }
  saveMembers([...members, cleanName]);
  els.memberNameInput.value = '';
  showToast(`已加入 ${cleanName}`);
}

function removeMember(name) {
  saveMembers(getMembers().filter(member => member !== name));
  showToast(`已移除 ${name}`);
}

function renderMembers() {
  const members = getMembers();
  els.memberOptions.innerHTML = members.map(name => `<option value="${escapeHtml(name)}"></option>`).join('');

  if (!members.length) {
    els.memberChips.innerHTML = '<span class="empty-chip">尚未建立常用人員，可先輸入姓名加入。</span>';
    return;
  }

  els.memberChips.innerHTML = members.map(name => `
    <button class="member-chip" type="button" data-name="${escapeHtml(name)}">
      <span>${escapeHtml(name)}</span><small>＋</small>
    </button>
  `).join('');
}

function insertMemberToRow(name) {
  let targetRow = [...els.rowsBody.querySelectorAll('tr')].find(row => !row.querySelector('.name').value.trim());
  if (!targetRow) {
    addRow({ name });
    return;
  }
  targetRow.querySelector('.name').value = name;
  targetRow.querySelector('.item').focus();
  handleChange();
}

function openMemberPicker(row) {
  const members = getMembers();
  if (!members.length) {
    showToast('尚未建立常用人員名單');
    return;
  }
  const old = document.querySelector('.member-popover');
  if (old) old.remove();

  const popover = document.createElement('div');
  popover.className = 'member-popover';
  popover.innerHTML = members.map(name => `<button type="button" data-name="${escapeHtml(name)}">${escapeHtml(name)}</button>`).join('');
  document.body.appendChild(popover);

  const rect = row.querySelector('.pick-member').getBoundingClientRect();
  popover.style.left = `${Math.min(rect.left, window.innerWidth - 220)}px`;
  popover.style.top = `${rect.bottom + 8}px`;

  popover.addEventListener('click', event => {
    const button = event.target.closest('button[data-name]');
    if (!button) return;
    row.querySelector('.name').value = button.dataset.name;
    row.querySelector('.item').focus();
    popover.remove();
    handleChange();
  });

  setTimeout(() => {
    document.addEventListener('click', function closePicker(event) {
      if (!popover.contains(event.target) && !event.target.classList.contains('pick-member')) {
        popover.remove();
        document.removeEventListener('click', closePicker);
      }
    });
  });
}

function saveState() {
  const state = {
    settings: getSettings(),
    rows: getRows().map(({ share, name, item, price, qty }) => ({ share, name, item, price, qty }))
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) {
    els.orderDate.value = todayText();
    addRow();
    addRow();
    addRow();
    return;
  }

  try {
    const state = JSON.parse(saved);
    const settings = state.settings || {};
    els.shopName.value = settings.shopName || '';
    // 開啟系統時一律帶入今天，避免沿用上一次暫存的訂購日期。
    // 歷史紀錄的「載入」功能仍會保留原本日期。
    els.orderDate.value = todayText();
    els.finalPaidAmount.value = settings.finalPaidAmount ?? 0;
    els.onlyShareChecked.checked = settings.onlyShareChecked ?? true;

    els.rowsBody.innerHTML = '';
    const rows = Array.isArray(state.rows) && state.rows.length ? state.rows : [{}, {}, {}];
    rows.forEach(addRow);
  } catch (error) {
    console.warn('載入暫存資料失敗，已重設。', error);
    localStorage.removeItem(STORAGE_KEY);
    els.orderDate.value = todayText();
    addRow();
  }
}

function loadSample() {
  els.shopName.value = '迷客夏';
  els.orderDate.value = todayText();
  els.onlyShareChecked.checked = true;

  els.rowsBody.innerHTML = '';
  [
    { name: '雨鑫', item: '珍珠紅茶拿鐵', price: 75, qty: 1, share: true },
    { name: '承遠', item: '大正紅茶', price: 35, qty: 1, share: true },
    { name: '天霖', item: '伯爵紅茶拿鐵', price: 70, qty: 1, share: true },
    { name: '倩如', item: '柳丁綠茶', price: 65, qty: 1, share: true }
  ].forEach(addRow);
  els.finalPaidAmount.value = 270;
  calculate();
  showToast('已載入範例資料');
}

function clearAll() {
  resetCurrentOrder(true);
  showToast('已清空目前畫面');
}

async function copyMessage() {
  const text = els.messageBox.value.trim();
  if (!text) {
    showToast('目前沒有可複製的內容');
    return;
  }
  await navigator.clipboard.writeText(text);
  showToast('已複製群組訊息');
}

function exportCsv() {
  const rows = getRows();
  if (!rows.length) {
    showToast('目前沒有資料可匯出');
    return;
  }

  const settings = getSettings();
  const drinkTotal = rows.reduce((sum, row) => sum + row.base, 0);
  const finalPaid = settings.finalPaidAmount || drinkTotal;
  const difference = finalPaid - drinkTotal;
  const header = ['姓名', '品項', '單價', '數量', '飲料金額', '差額分攤', '應付金額', '參與分攤', '飲料原價總額', '最後實付總額', '反推差額'];
  const lines = rows.map(row => [
    row.name,
    row.item,
    row.price,
    row.qty,
    row.base,
    row.diffShare,
    row.total,
    row.share ? '是' : '否',
    drinkTotal,
    finalPaid,
    difference
  ]);

  const csv = [header, ...lines]
    .map(line => line.map(value => `"${String(value).replaceAll('"', '""')}"`).join(','))
    .join('\n');

  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const fileDate = els.orderDate.value || todayText();
  link.href = url;
  link.download = `飲料試算_${fileDate}.csv`;
  link.click();
  URL.revokeObjectURL(url);
  showToast('CSV 已匯出');
}

function getHistory() {
  try {
    const saved = localStorage.getItem(HISTORY_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch (error) {
    console.warn('載入歷史紀錄失敗。', error);
    return [];
  }
}

function saveHistory(history) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  renderHistory();
}

function settleOrder() {
  const rows = getRows().filter(row => row.base > 0 || row.name.trim !== '');
  if (!rows.length || rows.every(row => row.base === 0)) {
    showToast('目前沒有可結清的訂單');
    return;
  }
  const settings = getSettings();
  const drinkTotal = rows.reduce((sum, row) => sum + row.base, 0);
  const finalPaid = settings.finalPaidAmount || drinkTotal;
  const difference = finalPaid - drinkTotal;
  const grandTotal = rows.reduce((sum, row) => sum + row.total, 0);
  const record = {
    id: Date.now(),
    settledAt: new Date().toISOString(),
    settings,
    drinkTotal,
    finalPaid,
    difference,
    grandTotal,
    rows: rows.map(({ share, name, item, price, qty, base, diffShare, total }) => ({ share, name, item, price, qty, base, diffShare, total })),
    message: buildMessage(rows, settings, grandTotal)
  };
  const history = getHistory();
  history.unshift(record);
  saveHistory(history);
  resetCurrentOrder(false);
  showToast('已結清並存入歷史紀錄');
}

function resetCurrentOrder(askConfirm = true) {
  if (askConfirm && !confirm('確定要清空目前畫面嗎？這不會刪除歷史紀錄。')) return;
  localStorage.removeItem(STORAGE_KEY);
  els.shopName.value = '';
  els.orderDate.value = todayText();
  els.finalPaidAmount.value = 0;
  els.onlyShareChecked.checked = true;
  els.rowsBody.innerHTML = '';
  addRow();
  addRow();
  addRow();
  calculate();
}

function renderHistory() {
  const history = getHistory();
  if (!history.length) {
    els.historyList.innerHTML = '<div class="empty-history">尚無歷史紀錄。</div>';
    return;
  }
  els.historyList.innerHTML = history.map(record => {
    const date = record.settings?.orderDate || record.settledAt?.slice(0, 10) || '';
    const shop = record.settings?.shopName || '未填店家';
    const people = record.rows.map(row => `${escapeHtml(row.name)}：${row.total}元`).join('、');
    const diff = Number(record.difference || 0);
    const diffText = diff > 0 ? `多付 ${diff} 元` : diff < 0 ? `折扣 ${Math.abs(diff)} 元` : '無差額';
    return `
      <div class="history-item">
        <div class="history-main">
          <strong>${escapeHtml(shop)}</strong>
          <span>${escapeHtml(date)}｜${record.rows.length} 人｜實付 ${Number(record.finalPaid || record.grandTotal || 0).toLocaleString('zh-TW')} 元｜${diffText}</span>
          <p>${people}</p>
        </div>
        <div class="history-actions">
          <button class="ghost-btn" data-action="restore" data-id="${record.id}">載入</button>
          <button class="ghost-btn" data-action="copy" data-id="${record.id}">複製</button>
          <button class="ghost-btn danger" data-action="delete" data-id="${record.id}">刪除</button>
        </div>
      </div>`;
  }).join('');
}

function escapeHtml(text) {
  return String(text ?? '').replace(/[&<>"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]));
}

function handleHistoryClick(event) {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  const id = Number(button.dataset.id);
  const action = button.dataset.action;
  const history = getHistory();
  const record = history.find(item => item.id === id);
  if (!record) return;

  if (action === 'copy') {
    navigator.clipboard.writeText(record.message || '').then(() => showToast('已複製歷史收款訊息'));
  }
  if (action === 'delete') {
    if (!confirm('確定刪除這筆歷史紀錄嗎？')) return;
    saveHistory(history.filter(item => item.id !== id));
    showToast('已刪除歷史紀錄');
  }
  if (action === 'restore') {
    if (!confirm('要把這筆歷史紀錄載入到目前畫面嗎？目前未結清內容會被覆蓋。')) return;
    const settings = record.settings || {};
    els.shopName.value = settings.shopName || '';
    els.orderDate.value = settings.orderDate || todayText();
    els.finalPaidAmount.value = settings.finalPaidAmount ?? record.finalPaid ?? 0;
    els.onlyShareChecked.checked = settings.onlyShareChecked ?? true;
    els.rowsBody.innerHTML = '';
    record.rows.forEach(addRow);
    calculate();
    showToast('已載入歷史紀錄');
  }
}

function exportHistoryCsv() {
  const history = getHistory();
  if (!history.length) { showToast('目前沒有歷史紀錄'); return; }
  const header = ['結清時間', '訂購日期', '店家', '姓名', '品項', '應付金額', '飲料原價總額', '最後實付總額', '反推差額'];
  const lines = history.flatMap(record => record.rows.map(row => [
    record.settledAt, record.settings?.orderDate || '', record.settings?.shopName || '',
    row.name, row.item, row.total, record.drinkTotal || '', record.finalPaid || record.grandTotal || '', record.difference || 0
  ]));
  const csv = [header, ...lines].map(line => line.map(value => `"${String(value ?? '').replaceAll('"', '""')}"`).join(',')).join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `飲料歷史紀錄_${todayText()}.csv`;
  link.click();
  URL.revokeObjectURL(url);
  showToast('歷史 CSV 已匯出');
}

function clearHistory() {
  if (!confirm('確定要清空所有歷史紀錄嗎？')) return;
  localStorage.removeItem(HISTORY_KEY);
  renderHistory();
  showToast('歷史紀錄已清空');
}

function showToast(message) {
  const old = document.querySelector('.toast');
  if (old) old.remove();
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 1800);
}

function bindSideNav() {
  const links = [...document.querySelectorAll('.side-links a')];
  const sections = links
    .map(link => document.querySelector(link.getAttribute('href')))
    .filter(Boolean);

  if (!links.length || !sections.length) return;

  const setActive = () => {
    const current = sections
      .slice()
      .reverse()
      .find(section => section.getBoundingClientRect().top <= 140) || sections[0];

    links.forEach(link => {
      link.classList.toggle('active', link.getAttribute('href') === `#${current.id}`);
    });
  };

  links.forEach(link => {
    link.addEventListener('click', event => {
      const target = document.querySelector(link.getAttribute('href'));
      if (!target) return;
      event.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      links.forEach(item => item.classList.remove('active'));
      link.classList.add('active');
    });
  });

  window.addEventListener('scroll', setActive, { passive: true });
  setActive();
}

function bindGlobalEvents() {
  [
    els.shopName, els.orderDate,
    els.finalPaidAmount,
    els.onlyShareChecked
  ].forEach(el => {
    el.addEventListener('input', handleChange);
    el.addEventListener('change', handleChange);
  });

  els.addMemberBtn.addEventListener('click', () => addMember());
  els.memberNameInput.addEventListener('keydown', event => {
    if (event.key === 'Enter') addMember();
  });
  els.clearMembersBtn.addEventListener('click', () => {
    if (!confirm('確定要清空常用人員名單嗎？目前訂購明細不會被刪除。')) return;
    saveMembers([]);
    showToast('已清空常用人員名單');
  });
  els.memberChips.addEventListener('click', event => {
    const chip = event.target.closest('.member-chip');
    if (!chip) return;
    if (event.altKey) {
      removeMember(chip.dataset.name);
      return;
    }
    insertMemberToRow(chip.dataset.name);
  });
  els.memberChips.addEventListener('contextmenu', event => {
    const chip = event.target.closest('.member-chip');
    if (!chip) return;
    event.preventDefault();
    removeMember(chip.dataset.name);
  });

  els.addRowBtn.addEventListener('click', () => addRow());
  els.clearBtn.addEventListener('click', clearAll);
  els.settleBtn.addEventListener('click', settleOrder);
  els.historyList.addEventListener('click', handleHistoryClick);
  els.exportHistoryBtn.addEventListener('click', exportHistoryCsv);
  els.clearHistoryBtn.addEventListener('click', clearHistory);
  els.loadSampleBtn.addEventListener('click', loadSample);
  els.copyBtn.addEventListener('click', copyMessage);
  els.exportCsvBtn.addEventListener('click', exportCsv);
  els.printBtn.addEventListener('click', () => window.print());
}

bindGlobalEvents();
bindSideNav();
renderMembers();
loadState();
renderHistory();
calculate();
