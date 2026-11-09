'use strict';

const cases = window.REENCONTRO_CASOS;
const byId = new Map(cases.map(item => [item.id, item]));
const $ = selector => document.querySelector(selector);
const storageKey = 'reencontro-protocolos-v1';

const reportPrompts = new Map([
  ['Atualização de contexto', {
    label: 'Quero corrigir ou complementar uma informação',
    placeholder: 'Qual informação você quer corrigir ou acrescentar?',
  }],
  ['Possível informação para triagem', {
    label: 'Acho que vi essa pessoa ou tenho uma pista',
    placeholder: 'Conte o que você viu. Se souber, indique onde e quando aconteceu.',
  }],
  ['Pedido de orientação', {
    label: 'Preciso de ajuda para saber o que fazer',
    placeholder: 'Conte sua dúvida ou diga em que etapa você precisa de ajuda.',
  }],
]);

const categories = [...reportPrompts.keys()];

const escape = value => String(value).replace(/[&<>"']/g, char => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}[char]));

const normalize = value => String(value)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .trim();

const formatDate = date => date.split('-').reverse().join('/');
const pageSize = 12;

let page = 1;
let opener;
let toastTimer;
let storageAvailable = true;
let protocols = [];

try {
  const saved = JSON.parse(localStorage.getItem(storageKey) || '[]');
  if (Array.isArray(saved)) {
    protocols = saved.filter(item =>
      item &&
      /^DEMO-\d+$/.test(item.id) &&
      ['Aguardando revisão', 'Revisado'].includes(item.status) &&
      (item.kind === 'cadastro'
        ? typeof item.name === 'string' &&
          Number.isInteger(item.age) &&
          typeof item.zone === 'string'
        : byId.has(item.caseId) && categories.includes(item.category))
    );
  }
} catch {
  storageAvailable = false;
}

function save() {
  try {
    localStorage.setItem(storageKey, JSON.stringify(protocols));
  } catch {
    storageAvailable = false;
  }
}

function addProtocol(data) {
  const number = 1 + Math.max(0, ...protocols.map(p => Number(p.id.slice(5))));
  const protocol = {
    ...data,
    id: `DEMO-${String(number).padStart(3, '0')}`,
    status: 'Aguardando revisão',
  };

  protocols.push(protocol);
  save();
  renderQueue();
  renderIndicators();
  return protocol;
}

function photoPair(item) {
  return `
    <div class="pair">
      <figure>
        <img src="${escape(item.fotoEpoca)}" alt="Retrato fictício aos ${item.idade} anos">
        <figcaption>
          ${item.idade} anos
          <small>Na época · ${item.data.slice(0, 4)}</small>
        </figcaption>
      </figure>
      <figure>
        <img src="${escape(item.foto2026)}" alt="Simulação de aparência aos ${item.idade2026} anos">
        <figcaption>
          ${item.idade2026} anos
          <small>Simulação em 2026</small>
        </figcaption>
      </figure>
    </div>`;
}

/* Carrossel de casos demonstrativos */
const demo = byId.get('SIM-001');
const carouselCases = ['SIM-001', 'SIM-003', 'SIM-009', 'SIM-013', 'SIM-039']
  .map(id => byId.get(id))
  .filter(Boolean);

const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
let carouselIndex = 0;
let carouselPaused = motionPreference.matches;
let carouselTimer;

$('#hero-case').innerHTML = `
  <div id="carousel-slide"></div>
  <div class="carousel-controls" aria-label="Controles do carrossel">
    <button id="carousel-prev" class="quiet" type="button" aria-label="Caso anterior">←</button>
    <span id="carousel-count" aria-live="off"></span>
    <button id="carousel-next" class="quiet" type="button" aria-label="Próximo caso">→</button>
    <button id="carousel-toggle" class="quiet" type="button"></button>
  </div>`;

function renderCarousel(manual = false) {
  const item = carouselCases[carouselIndex] ?? demo;

  $('#carousel-slide').innerHTML = `
    <header>
      <strong>${item.id} · Caso demonstrativo</strong>
      <span>Imagens sintéticas</span>
    </header>
    ${photoPair(item)}`;

  $('#carousel-count').setAttribute('aria-live', manual ? 'polite' : 'off');
  $('#carousel-count').textContent = `${carouselIndex + 1} de ${carouselCases.length}`;
  $('#carousel-toggle').textContent = carouselPaused ? 'Reproduzir' : 'Pausar';
}

function scheduleCarousel() {
  clearTimeout(carouselTimer);

  if (
    carouselPaused ||
    document.hidden ||
    $('#consulta').hidden ||
    carouselCases.length < 2 ||
    document.querySelector('dialog[open]')
  ) return;

  carouselTimer = setTimeout(() => {
    if (!document.querySelector('dialog[open]')) moveCarousel(1);
  }, 5000);
}

function moveCarousel(step, manual = false) {
  if (carouselCases.length < 2) return;
  carouselIndex = (carouselIndex + step + carouselCases.length) % carouselCases.length;
  renderCarousel(manual);
  scheduleCarousel();
}

$('#carousel-prev').addEventListener('click', () => moveCarousel(-1, true));
$('#carousel-next').addEventListener('click', () => moveCarousel(1, true));

$('#carousel-toggle').addEventListener('click', () => {
  carouselPaused = !carouselPaused;
  renderCarousel();
  scheduleCarousel();
});

document.addEventListener('visibilitychange', scheduleCarousel);

for (const dialog of document.querySelectorAll('dialog')) {
  dialog.addEventListener('close', scheduleCarousel);
}

motionPreference.addEventListener('change', event => {
  if (event.matches) carouselPaused = true;
  renderCarousel();
  scheduleCarousel();
});

renderCarousel();

/* Busca por nome e características */
for (const year of [...new Set(cases.map(item => item.data.slice(0, 4)))].sort()) {
  $('#year').add(new Option(year, year));
}

for (const zone of [...new Set(cases.map(item => item.zona))].sort()) {
  $('#zone').add(new Option(zone, zone));
}

function renderCases() {
  const query = normalize($('#query').value);
  const ageFromText = query.match(/\b(\d{1,2})\s*anos?\b/);
  const tokens = query.replace(/\b\d{1,2}\s*anos?\b/, '').split(/\s+/).filter(Boolean);
  const year = $('#year').value;
  const zone = $('#zone').value;
  const age = $('#age').value;
  const height = Number($('#height').value);
  const sex = $('#sex').value;

  const matches = cases.filter(item => {
    const searchable = normalize(`${item.id} ${item.nome} ${item.bairro} ${item.zona} ${item.sexo}`);
    return tokens.every(token => searchable.includes(token)) &&
      (!ageFromText || item.idade === Number(ageFromText[1])) &&
      (!year || item.data.startsWith(year)) &&
      (!zone || item.zona === zone) &&
      (!age || (age === 'child' ? item.idade < 12 : item.idade >= 12)) &&
      (!height || Math.abs(item.altura - height) <= 8) &&
      (!sex || item.sexo === sex);
  });

  const pages = Math.max(1, Math.ceil(matches.length / pageSize));
  page = Math.min(page, pages);
  const start = (page - 1) * pageSize;

  $('#result-count').textContent = `${matches.length} ${
    matches.length === 1 ? 'caso fictício encontrado' : 'casos fictícios encontrados'
  }`;

  $('#case-list').innerHTML = matches.slice(start, start + pageSize).map(item => `
    <article class="case-card">
      <img src="${escape(item.fotoEpoca)}" loading="lazy" alt="">
      <div>
        <small>${item.id} · ${item.data.slice(0, 4)}</small>
        <h3>${escape(item.nome)}</h3>
        <small>${escape(item.zona)} · ${item.idade} anos na época</small>
      </div>
      <button class="quiet" type="button" data-case="${item.id}">
        Ver ficha <span aria-hidden="true">↗</span>
      </button>
    </article>`).join('') ||
    '<p class="empty">Nenhum caso corresponde aos filtros. Ajuste a busca ou clique em Limpar.</p>';

  $('#page-number').textContent = `${page} de ${pages}`;
  $('#prev').disabled = page === 1;
  $('#next').disabled = page === pages;
}

/* Ficha e envio de informação adicional */
function openCase(id, trigger, possibleMatch = false) {
  const item = byId.get(id);
  if (!item) return;

  opener = trigger;
  $('#case-detail').innerHTML = `
    <h2 class="dialog-title" id="case-title">${escape(item.nome)}</h2>
    <p class="detail-meta">
      ${item.id} · ${formatDate(item.data)} · ${escape(item.bairro)},
      zona ${escape(item.zona)} · ${item.altura} cm na época
    </p>
    <div class="dialog-pair">${photoPair(item)}</div>
    <p class="notice">Idade estimada em 08/11/2026. Retratos sintéticos para demonstração acadêmica.</p>

    <form id="report-form" class="report-form">
      <label style="flex-basis:100%">
        Como você quer ajudar?
        <select id="category" required>
          <option value="">Escolha uma opção</option>
          ${[...reportPrompts].map(([value, prompt]) =>
            `<option value="${escape(value)}">${escape(prompt.label)}</option>`
          ).join('')}
        </select>
      </label>

      <label id="report-details-field" style="flex-basis:100%" hidden>
        Informação adicional
        <textarea
          id="report-details"
          rows="4"
          maxlength="500"
          aria-describedby="report-details-note"
          style="width:100%;min-width:0;resize:vertical;font:inherit;color:var(--ink);background:var(--surface);border:1px solid var(--line);border-radius:6px;padding:.65rem"
        ></textarea>
        <small id="report-details-note">Use informações fictícias nesta demonstração. Até 500 caracteres.</small>
      </label>

      <button id="send-report" type="submit" disabled>Enviar para revisão</button>
    </form>

    <p class="toast-inline" id="protocol-result" role="status"></p>`;

  const categoryInput = $('#category');
  const detailsInput = $('#report-details');

  function updateReportForm() {
    const prompt = reportPrompts.get(categoryInput.value);
    $('#report-details-field').hidden = !prompt;
    detailsInput.required = Boolean(prompt);
    detailsInput.placeholder = prompt?.placeholder ?? '';
    $('#send-report').disabled = !prompt;
  }

  if (possibleMatch) categoryInput.value = 'Possível informação para triagem';

  categoryInput.addEventListener('change', updateReportForm);
  detailsInput.addEventListener('input', () => detailsInput.setCustomValidity(''));
  updateReportForm();

  $('#report-form').addEventListener('submit', event => {
    event.preventDefault();

    const category = categoryInput.value;
    if (!categories.includes(category)) return;

    const details = detailsInput.value.trim();
    if (!details || details.length > 500) {
      detailsInput.setCustomValidity('Escreva uma informação adicional de até 500 caracteres.');
      detailsInput.reportValidity();
      return;
    }

    const existing = protocols.find(p =>
      p.caseId === id &&
      p.category === category &&
      typeof p.details === 'string' &&
      normalize(p.details) === normalize(details)
    );

    if (existing) {
      $('#protocol-result').textContent = `Essa informação já foi enviada no protocolo ${existing.id}.`;
      return;
    }

    const protocol = addProtocol({ caseId: id, category, details });
    detailsInput.value = '';
    $('#protocol-result').textContent = `Informação enviada. Protocolo ${protocol.id} ${
      storageAvailable ? 'aguardando revisão.' : 'disponível na fila durante esta sessão.'
    }`;
  });

  $('#case-dialog').showModal();
}

/* Fila de revisão e painel */
function renderQueue() {
  $('#queue').innerHTML = protocols.slice().reverse().map(p => {
    const summary = p.kind === 'cadastro'
      ? `${escape(p.name)} · ${p.age} anos · ${escape(p.zone)}`
      : escape(p.category);

    const report = p.kind !== 'cadastro' && typeof p.details === 'string' && p.details
      ? `<p style="white-space:pre-wrap;overflow-wrap:anywhere"><strong>Informação adicional</strong><br>${escape(p.details)}</p>`
      : '';

    const reviewButton = p.status === 'Aguardando revisão'
      ? `<button class="quiet" type="button" data-review="${escape(p.id)}">Simular revisão</button>`
      : '';

    return `
      <article class="queue-item">
        <div style="min-width:0;max-width:100%">
          <strong>${escape(p.id)} · ${p.kind === 'cadastro' ? 'Solicitação de cadastro' : escape(p.caseId)}</strong>
          <p>${summary}</p>
          ${report}
        </div>
        <div class="queue-actions">
          <span class="pill">${escape(p.status)}</span>
          ${reviewButton}
        </div>
      </article>`;
  }).join('') ||
    '<p class="empty">A fila está vazia. Consulte um caso ou faça uma busca por foto para criar um protocolo de teste.</p>';
}

function renderBars(target, field) {
  const totals = new Map();

  for (const item of cases) {
    const key = field === 'year' ? item.data.slice(0, 4) : item.zona;
    totals.set(key, (totals.get(key) || 0) + 1);
  }

  const max = Math.max(1, ...totals.values());

  $(target).innerHTML = [...totals]
    .sort(([a], [b]) => a.localeCompare(b, 'pt-BR'))
    .map(([name, count]) => `
      <div class="bar-row">
        <span>${escape(name)}</span>
        <div class="bar-track" aria-hidden="true">
          <div class="bar-fill" style="width:${count / max * 100}%"></div>
        </div>
        <strong>${count}</strong>
      </div>`).join('');
}

function renderIndicators() {
  const historic = cases.filter(item => Number(item.data.slice(0, 4)) < 2022).length;
  const children = cases.filter(item => item.idade < 12).length;
  const pending = protocols.filter(p => p.status === 'Aguardando revisão').length;

  const stats = [
    ['Casos fictícios', cases.length],
    ['Casos históricos', historic],
    ['Casos de 2022 a 2026', cases.length - historic],
    ['Crianças de 2 a 11 anos', children],
    ['Adolescentes de 12 a 17 anos', cases.length - children],
    ['Protocolos aguardando revisão', pending],
  ];

  $('#metrics').innerHTML = stats.map(([label, value]) =>
    `<article class="metric"><strong>${value}</strong><span>${label}</span></article>`
  ).join('');

  renderBars('#by-year', 'year');
  renderBars('#by-zone', 'zone');
}

function showPage() {
  const requested = location.hash.slice(1);
  const active = ['consulta', 'revisao', 'indicadores'].includes(requested)
    ? requested
    : 'consulta';

  for (const section of document.querySelectorAll('[data-page]')) {
    section.hidden = section.id !== active;
  }

  for (const link of document.querySelectorAll('nav a')) {
    if (link.hash === `#${active}`) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }

  scheduleCarousel();
}

function announce(message) {
  clearTimeout(toastTimer);
  $('#toast').textContent = message;
  $('#toast').hidden = false;
  toastTimer = setTimeout(() => { $('#toast').hidden = true; }, 3500);
}

$('#filters').addEventListener('submit', event => event.preventDefault());

$('#filters').addEventListener('input', () => {
  page = 1;
  renderCases();
});

$('#filters').addEventListener('reset', () => setTimeout(() => {
  page = 1;
  renderCases();
}, 0));

$('#prev').addEventListener('click', () => {
  page--;
  renderCases();
});

$('#next').addEventListener('click', () => {
  page++;
  renderCases();
});

$('#open-demo').addEventListener('click', event => {
  const item = carouselCases[carouselIndex] ?? demo;
  openCase(item.id, event.currentTarget);
});

$('#case-list').addEventListener('click', event => {
  const button = event.target.closest('button[data-case]');
  if (button) openCase(button.dataset.case, button);
});

$('#close-dialog').addEventListener('click', () => $('#case-dialog').close());
$('#case-dialog').addEventListener('close', () => opener?.focus());

$('#queue').addEventListener('click', event => {
  const button = event.target.closest('button[data-review]');
  if (!button) return;

  const protocol = protocols.find(item => item.id === button.dataset.review);
  if (!protocol || protocol.status !== 'Aguardando revisão') return;

  protocol.status = 'Revisado';
  save();
  renderQueue();
  renderIndicators();
  announce(`${protocol.id} revisado na simulação.`);
});

window.addEventListener('hashchange', showPage);

renderCases();
renderQueue();
renderIndicators();
showPage();