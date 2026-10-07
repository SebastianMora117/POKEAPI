/* View: builds DOM nodes; API strings are only ever assigned as text. */
(function (global) {
  'use strict';

  const TYPE_NAMES = {
    normal: 'Normal', fire: 'Fuego', water: 'Agua', electric: 'Eléctrico', grass: 'Planta',
    ice: 'Hielo', fighting: 'Lucha', poison: 'Veneno', ground: 'Tierra', flying: 'Volador',
    psychic: 'Psíquico', bug: 'Bicho', rock: 'Roca', ghost: 'Fantasma', dragon: 'Dragón',
    dark: 'Siniestro', steel: 'Acero', fairy: 'Hada'
  };
  const STAT_NAMES = {
    hp: 'PS', attack: 'Ataque', defense: 'Defensa', 'special-attack': 'At. esp.',
    'special-defense': 'Def. esp.', speed: 'Velocidad'
  };
  const TYPES = new Set(Object.keys(TYPE_NAMES));
  const byId = id => document.getElementById(id);

  function node(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = String(text);
    return element;
  }

  function typeChip(type) {
    const validType = TYPES.has(type) ? type : 'normal';
    return node('span', `type-chip type-${validType}`, TYPE_NAMES[validType]);
  }

  function formatDex(id) { return String(id).padStart(4, '0'); }
  function capitalize(value) {
    return String(value || '').replaceAll('-', ' ').replace(/\b\w/g, character => character.toUpperCase());
  }

  function renderTypes(container, types) {
    container.replaceChildren();
    for (const type of types) if (TYPES.has(type)) container.append(typeChip(type));
  }

  function setImage(img, url, alt) {
    if (!url) return false;
    img.src = url;
    img.hidden = false;
    img.alt = String(alt || 'Ilustración de Pokémon');
    img.loading = 'lazy';
    img.decoding = 'async';
    img.referrerPolicy = 'no-referrer';
    img.addEventListener('error', () => img.remove(), { once: true });
    return true;
  }

  const view = {
    setStatus(message) { byId('status').textContent = message; },
    setSystemState(message, online) {
      const label = byId('system-state');
      label.textContent = message;
      label.dataset.online = String(Boolean(online));
    },
    setDexCount(message) { byId('dex-count').textContent = message; },
    setResultsLabel(message) { byId('results-label').textContent = message; },
    setFavoriteCount(count) {
      byId('favorites-count').textContent = String(count);
      byId('favorites-toggle').setAttribute('aria-pressed', String(byId('favorites-toggle').classList.contains('active')));
    },
    setHero(record) {
      const image = byId('hero-mon');
      if (!setImage(image, record.image, `Ilustración de ${record.localized}`)) image.hidden = true;
      byId('hero-name').textContent = record.localized.toUpperCase();
      byId('hero-index').textContent = `TACTICAL SCAN / #${formatDex(record.id)}`;
    },
    renderSkeleton(count = 8) {
      const grid = byId('grid');
      grid.replaceChildren();
      byId('pagination').replaceChildren();
      for (let i = 0; i < count; i++) grid.append(node('div', 'loading-card'));
    },
    renderCards(records, favorites, callbacks) {
      const grid = byId('grid');
      grid.replaceChildren();
      if (!records.length) {
        const empty = node('div', 'empty', 'No hay registros con estos filtros. Ajusta la búsqueda o cambia los filtros activos.');
        grid.append(empty);
        return;
      }
      for (const record of records) {
        if (!record) continue;
        const card = node('article', 'pokemon-card');
        card.tabIndex = 0;
        card.dataset.type = TYPES.has(record.pokemon.types[0]?.type?.name) ? record.pokemon.types[0].type.name : 'normal';
        card.setAttribute('aria-label', `Abrir ficha de ${record.localized || capitalize(record.name)}`);
        card.dataset.pokemonId = String(record.id);

        const number = node('span', 'dex-num', `N.º ${formatDex(record.id)}`);
        const favorite = node('button', `favorite${favorites.has(record.id) ? ' on' : ''}`, favorites.has(record.id) ? '♥' : '♡');
        favorite.type = 'button';
        favorite.setAttribute('aria-label', `${favorites.has(record.id) ? 'Quitar de' : 'Añadir a'} favoritos`);
        favorite.setAttribute('aria-pressed', String(favorites.has(record.id)));
        favorite.dataset.action = 'favorite';
        favorite.addEventListener('click', event => {
          event.stopPropagation();
          callbacks.onFavorite(record.id);
        });

        const art = node('div', 'card-image');
        art.dataset.type = card.dataset.type;
        const image = document.createElement('img');
        if (!setImage(image, record.image, record.localized || capitalize(record.name))) image.hidden = true;
        art.append(image);

        const info = node('div', 'card-info');
        const titleLine = node('div', 'card-title');
        titleLine.append(node('h3', '', record.localized || capitalize(record.name)));
        titleLine.append(node('small', '', `#${String(record.id).padStart(3, '0')}`));
        const types = node('div', 'types');
        renderTypes(types, record.pokemon.types.map(row => row.type.name));
        info.append(titleLine, types);
        card.append(number, favorite, art, info);
        card.addEventListener('click', () => callbacks.onOpen(record.id));
        card.addEventListener('keydown', event => {
          if ((event.key === 'Enter' || event.key === ' ') && event.target === card) {
            event.preventDefault();
            callbacks.onOpen(record.id);
          }
        });
        grid.append(card);
      }
    },
    renderPagination(page, pages, callbacks) {
      const nav = byId('pagination');
      nav.replaceChildren();
      if (pages <= 1) return;
      const previous = node('button', '', '← Anterior');
      previous.type = 'button';
      previous.disabled = page <= 1;
      previous.addEventListener('click', callbacks.onPrevious);
      const next = node('button', '', 'Siguiente →');
      next.type = 'button';
      next.disabled = page >= pages;
      next.addEventListener('click', callbacks.onNext);
      nav.append(previous, node('span', '', `${page} / ${pages}`), next);
    },
    renderError(message, onRetry) {
      const box = node('div', 'error-box');
      box.append(node('strong', '', message));
      box.append(node('br'));
      box.append(node('span', '', 'Verifica tu conexión y vuelve a intentarlo. No se requieren claves API.'));
      box.append(node('br'));
      const retry = node('button', '', 'Reintentar');
      retry.type = 'button';
      retry.addEventListener('click', onRetry);
      box.append(retry);
      byId('grid').replaceChildren();
      byId('pagination').replaceChildren();
      byId('status').replaceChildren(box);
    },
    updateFavoriteButton(active, count) {
      const button = byId('favorites-toggle');
      button.classList.toggle('active', active);
      button.replaceChildren(document.createTextNode(active ? '♥ Registros guardados ' : '♡ Ver registros guardados '));
      button.append(node('span', '', count));
      button.setAttribute('aria-pressed', String(active));
    },
    openModal(record, onPlayCry) {
      const pokemon = record.pokemon;
      const species = record.speciesData;
      const types = pokemon.types.map(row => row.type.name);
      const descriptionEntry = species.flavor_text_entries?.find(row => row?.language?.name === 'es')
        || species.flavor_text_entries?.find(row => row?.language?.name === 'en');
      const description = String(descriptionEntry?.flavor_text || 'No hay una descripción disponible para esta especie.')
        .replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').slice(0, 700);
      const genus = species.genera?.find(row => row?.language?.name === 'es')?.genus
        || species.genera?.find(row => row?.language?.name === 'en')?.genus || 'Pokémon';

      const content = node('div', 'modal-content');
      const visual = node('div', 'modal-visual');
      visual.dataset.type = TYPES.has(types[0]) ? types[0] : 'normal';
      const image = document.createElement('img');
      if (!setImage(image, record.image, record.localized)) image.hidden = true;
      visual.append(image);

      const details = node('div', 'modal-info');
      details.append(node('div', 'number', `N.º ${formatDex(record.id)} · ${capitalize(record.name)}`));
      const heading = node('h2', '', record.localized);
      heading.id = 'modal-name';
      details.append(heading);
      const typeList = node('div', 'types');
      renderTypes(typeList, types);
      details.append(typeList, node('div', 'genus', genus), node('p', 'description', description));

      const measurements = node('div', 'measurements');
      const values = [
        ['ALTURA', `${(pokemon.height / 10).toFixed(1)} m`],
        ['PESO', `${(pokemon.weight / 10).toFixed(1)} kg`],
        ['EXP. BASE', Number.isFinite(pokemon.base_experience) ? pokemon.base_experience : '—']
      ];
      for (const [label, value] of values) {
        const cell = node('div');
        cell.append(node('strong', '', label), document.createTextNode(String(value)));
        measurements.append(cell);
      }
      details.append(measurements);

      const stats = node('div', 'stat-list');
      for (const entry of pokemon.stats) {
        if (!Number.isFinite(entry.base_stat) || !STAT_NAMES[entry.stat.name]) continue;
        const row = node('div', 'stat-row');
        row.append(node('label', '', STAT_NAMES[entry.stat.name]), node('b', '', entry.base_stat));
        const progress = document.createElement('progress');
        progress.className = 'stat-bar';
        progress.max = 255;
        progress.value = Math.min(255, Math.max(0, entry.base_stat));
        progress.setAttribute('aria-label', `${STAT_NAMES[entry.stat.name]}: ${entry.base_stat}`);
        row.append(progress);
        stats.append(row);
      }
      details.append(stats);

      const matchupPanel = node('section', 'matchup-panel');
      matchupPanel.setAttribute('aria-label', 'Análisis de efectividad por tipo');
      matchupPanel.append(node('div', 'matchup-eyebrow', 'MATRIZ DE COMBATE // TYPE ANALYSIS'));
      matchupPanel.append(node('h3', '', 'Ventajas y riesgos'));
      matchupPanel.append(node('p', 'matchup-note-intro', `Tipos de la especie: ${record.pokemon.types.map(row => TYPE_NAMES[row.type.name]).join(' / ')}`));
      const matchupStatus = node('p', 'matchup-status', 'Calculando efectividades…');
      matchupStatus.id = 'matchup-status';
      const matchupContent = node('div', 'matchup-content');
      matchupContent.id = 'matchup-content';
      matchupPanel.append(matchupStatus, matchupContent);

      const bottom = node('div', 'modal-bottom');
      const abilities = node('div', 'abilities');
      abilities.append(node('strong', '', 'HABILIDADES'));
      abilities.append(document.createElement('br'));
      const abilityNames = pokemon.abilities.slice(0, 8).map(item => {
        const name = String(item.ability?.name || 'desconocida').replace(/[^a-z0-9-]/gi, '').slice(0, 60);
        return `${capitalize(name)}${item.is_hidden ? ' (oculta)' : ''}`;
      });
      abilities.append(document.createTextNode(abilityNames.join(' · ') || 'Sin datos'));
      bottom.append(abilities);
      if (record.cry) {
        const sound = node('button', 'sound', '▶ Reproducir sonido');
        sound.type = 'button';
        sound.addEventListener('click', () => onPlayCry(record.cry));
        bottom.append(sound);
      }
      details.append(bottom);
      content.append(visual, details, matchupPanel);
      byId('modal-content').replaceChildren(content);
      byId('modal-backdrop').classList.add('open');
      byId('modal-backdrop').setAttribute('aria-hidden', 'false');
      document.body.classList.add('modal-open');
      byId('modal-close').focus();
    },
    setMatchupStatus(message) {
      const status = byId('matchup-status');
      if (status) status.textContent = message;
    },
    renderMatchups(matchups) {
      const mount = byId('matchup-content');
      if (!mount) return;
      mount.replaceChildren();
      const grid = node('div', 'matchup-grid');

      const offense = node('section', 'matchup-block');
      offense.append(node('h4', '', 'ATACA / EFECTIVIDAD DE SUS TIPOS'));
      for (const attack of matchups.offense) {
        const row = node('div', 'matchup-row');
        row.append(node('div', 'matchup-attack', `ATAQUES TIPO ${TYPE_NAMES[attack.attackType].toUpperCase()}`));
        if (!attack.groups.length) {
          row.append(node('p', 'matchup-empty', 'Daño neutral contra todos los tipos individuales.'));
        }
        for (const group of attack.groups) {
          const line = node('div', 'matchup-group');
          const multiplier = node('span', `matchup-multiplier${group.value > 1 ? ' strong' : group.value === 0 ? ' immune' : ' reduced'}`, group.multiplier);
          const targets = node('div', 'matchup-types');
          for (const type of group.types) targets.append(typeChip(type));
          line.append(multiplier, targets);
          row.append(line);
        }
        offense.append(row);
      }

      const defense = node('section', 'matchup-block');
      defense.append(node('h4', '', 'DEFIENDE / DAÑO QUE RECIBE'));
      if (!matchups.incoming.length) {
        defense.append(node('p', 'matchup-empty', 'Daño neutral desde todos los tipos.'));
      }
      for (const group of matchups.incoming) {
        const line = node('div', 'matchup-group');
        const multiplier = node('span', `matchup-multiplier${group.value > 1 ? ' weak' : group.value === 0 ? ' immune' : ' resist'}`, group.multiplier);
        const category = group.value === 0 ? 'INMUNE' : group.value > 1 ? 'DÉBIL' : 'RESISTE';
        const targets = node('div', 'matchup-types');
        targets.append(node('span', 'matchup-category', category));
        for (const type of group.types) targets.append(typeChip(type));
        line.append(multiplier, targets);
        defense.append(line);
      }

      grid.append(offense, defense);
      mount.append(grid, node('p', 'matchup-footnote', matchups.note));
      const status = byId('matchup-status');
      if (status) status.textContent = 'MATRIZ LISTA / EFECTIVIDAD POR TIPO';
    },
    closeModal() {
      byId('modal-backdrop').classList.remove('open');
      byId('modal-backdrop').setAttribute('aria-hidden', 'true');
      byId('modal-content').replaceChildren();
      document.body.classList.remove('modal-open');
    },
    modalIsOpen() { return byId('modal-backdrop').classList.contains('open'); },
    visibleModalControls() { return [...byId('modal').querySelectorAll('button:not(:disabled)')]; },
    onBackdropClick(callback) {
      byId('modal-backdrop').addEventListener('click', event => {
        if (event.target === byId('modal-backdrop')) callback();
      });
    },
    setHeroError() {
      byId('hero-name').textContent = 'SIN ENLACE';
      byId('hero-mon').hidden = true;
    }
  };

  global.PokedexView = view;
})(window);

