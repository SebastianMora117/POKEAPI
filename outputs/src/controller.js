/* Controller: coordinates user input, model state, and view updates. */
(function (global) {
  'use strict';

  const PAGE_SIZE = 16;
  const GENERATIONS = {
    1: [1, 151], 2: [152, 251], 3: [252, 386], 4: [387, 493], 5: [494, 649],
    6: [650, 721], 7: [722, 809], 8: [810, 905], 9: [906, 1025]
  };
  const TYPE_NAMES = {
    normal: 'Normal', fire: 'Fuego', water: 'Agua', electric: 'Eléctrico', grass: 'Planta',
    ice: 'Hielo', fighting: 'Lucha', poison: 'Veneno', ground: 'Tierra', flying: 'Volador',
    psychic: 'Psíquico', bug: 'Bicho', rock: 'Roca', ghost: 'Fantasma', dragon: 'Dragón',
    dark: 'Siniestro', steel: 'Acero', fairy: 'Hada'
  };
  const byId = id => document.getElementById(id);

  class DexController {
    constructor(model, view) {
      this.model = model;
      this.view = view;
      this.filters = { query: '', generation: 'all', type: 'all', sort: 'id-up', favoritesOnly: false };
      this.page = 1;
      this.refreshToken = 0;
      this.pageToken = 0;
      this.modalToken = 0;
      this.searchTimer = 0;
      this.previousFocus = null;
      this.bindEvents();
    }

    bindEvents() {
      byId('search').addEventListener('input', event => {
        this.filters.query = event.currentTarget.value.slice(0, 80);
        global.clearTimeout(this.searchTimer);
        this.searchTimer = global.setTimeout(() => this.refresh(), 180);
      });
      byId('generation').addEventListener('change', event => {
        this.filters.generation = event.currentTarget.value;
        this.refresh();
      });
      byId('type').addEventListener('change', event => {
        this.filters.type = event.currentTarget.value;
        this.refresh();
      });
      byId('sort').addEventListener('change', event => {
        this.filters.sort = event.currentTarget.value;
        this.refresh();
      });
      byId('favorites-toggle').addEventListener('click', () => {
        this.filters.favoritesOnly = !this.filters.favoritesOnly;
        this.view.updateFavoriteButton(this.filters.favoritesOnly, this.model.favoriteCount);
        this.refresh();
      });
      byId('nav-favorites').addEventListener('click', () => {
        this.filters.favoritesOnly = true;
        this.view.updateFavoriteButton(true, this.model.favoriteCount);
        this.refresh();
      });
      byId('random-btn').addEventListener('click', () => this.openRandom());
      byId('modal-close').addEventListener('click', () => this.closeModal());
      this.view.onBackdropClick(() => this.closeModal());
      document.addEventListener('keydown', event => this.onKeydown(event));
    }

    async start() {
      this.view.setSystemState('POKEMORA // CONECTANDO', false);
      this.view.setStatus('Inicializando el índice de especies…');
      try {
        const species = await this.model.loadSpecies();
        if (!species.length) throw new Error('El índice de especies está vacío.');
        this.view.setSystemState('POKEMORA // EN LÍNEA', true);
        this.view.setDexCount(`${species.length.toLocaleString('es-CO')} ESPECIES / INDEX READY`);
        const featured = species.find(item => item.id === 25);
        if (featured) {
          try { this.view.setHero(await this.model.loadRecord(featured)); }
          catch { this.view.setHeroError(); }
        }
        await this.refresh();
      } catch {
        this.view.setSystemState('POKEMORA // SIN ENLACE', false);
        this.view.setHeroError();
        this.view.renderError('No fue posible inicializar la Pokédex.', () => this.start());
      }
    }

    filteredSpecies() {
      const query = this.filters.query.trim().toLocaleLowerCase('es');
      let records = this.model.species;
      if (this.filters.generation !== 'all') {
        const range = GENERATIONS[this.filters.generation];
        if (range) records = records.filter(item => item.id >= range[0] && item.id <= range[1]);
      }
      if (query) {
        const favoriteIds = this.model.favorites;
        records = records.filter(item => item.name.toLocaleLowerCase('es').includes(query)
          || String(item.id).includes(query)
          || favoriteIds.has(item.id) && String(item.id) === query);
      }
      if (this.filters.favoritesOnly) records = records.filter(item => this.model.hasFavorite(item.id));
      return records;
    }

    async refresh() {
      if (!this.model.species.length) return;
      const token = ++this.refreshToken;
      this.page = 1;
      this.view.renderSkeleton();
      this.view.setStatus('Consultando registros de especie…');
      try {
        let records = this.filteredSpecies();
        if (this.filters.type !== 'all') {
          const matching = await this.model.loadTypeMembers(this.filters.type);
          if (token !== this.refreshToken) return;
          records = records.filter(item => matching.has(item.name));
        }
        records = this.sortRecords(records);
        await this.renderPage(records, token);
      } catch {
        if (token !== this.refreshToken) return;
        this.view.renderError('No pudimos consultar estos registros.', () => this.refresh());
      }
    }

    sortRecords(records) {
      const sorted = [...records];
      switch (this.filters.sort) {
        case 'id-down': sorted.reverse(); break;
        case 'name-up': sorted.sort((a, b) => a.name.localeCompare(b.name)); break;
        case 'name-down': sorted.sort((a, b) => b.name.localeCompare(a.name)); break;
        default: sorted.sort((a, b) => a.id - b.id);
      }
      return sorted;
    }

    async renderPage(records, token) {
      const pageToken = ++this.pageToken;
      const pages = Math.max(1, Math.ceil(records.length / PAGE_SIZE));
      this.page = Math.min(this.page, pages);
      const offset = (this.page - 1) * PAGE_SIZE;
      const pageRecords = records.slice(offset, offset + PAGE_SIZE);
      this.view.setDexCount(`${records.length.toLocaleString('es-CO')} REGISTROS`);
      this.view.setResultsLabel(this.filters.favoritesOnly ? 'REGISTROS GUARDADOS' : 'FILTRO DE BASE DE DATOS');
      this.view.setStatus(records.length
        ? `MOSTRANDO ${offset + 1}–${Math.min(offset + PAGE_SIZE, records.length)} DE ${records.length.toLocaleString('es-CO')}`
        : 'SIN COINCIDENCIAS / AJUSTA LOS FILTROS');
      this.view.renderPagination(this.page, pages, {
        onPrevious: () => { this.page--; this.renderPage(records, this.refreshToken); },
        onNext: () => {
          this.page++;
          this.renderPage(records, this.refreshToken);
          byId('pokedex').scrollIntoView({ behavior: 'smooth' });
        }
      });

      const loaded = await this.pool(pageRecords, 6, item => this.model.loadRecord(item));
      if (token !== this.refreshToken || pageToken !== this.pageToken) return;
      this.view.renderCards(loaded.filter(Boolean), this.model.favorites, {
        onOpen: id => this.openRecord(id, pageRecords, loaded),
        onFavorite: id => this.toggleFavorite(id)
      });
    }

    async pool(items, limit, task) {
      const output = new Array(items.length);
      let cursor = 0;
      const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
        while (cursor < items.length) {
          const index = cursor++;
          try { output[index] = await task(items[index]); }
          catch { output[index] = null; }
        }
      });
      await Promise.all(workers);
      return output;
    }

    async openRecord(id, pageRecords, loaded) {
      const index = pageRecords.findIndex(item => item.id === id);
      if (index < 0 || !loaded[index]) return;
      this.previousFocus = document.activeElement;
      const record = loaded[index];
      const token = ++this.modalToken;
      this.view.openModal(record, url => this.playCry(url));
      await this.loadMatchups(record, token);
    }

    async openRandom() {
      if (!this.model.species.length) return;
      const record = this.model.species[Math.floor(Math.random() * this.model.species.length)];
      this.view.setStatus('ESCANEO ALEATORIO EN CURSO…');
      try {
        const loaded = await this.model.loadRecord(record);
        this.previousFocus = document.activeElement;
        const token = ++this.modalToken;
        this.view.openModal(loaded, url => this.playCry(url));
        this.view.setStatus(`REGISTRO ${String(record.id).padStart(4, '0')} CARGADO`);
        await this.loadMatchups(loaded, token);
      } catch {
        this.view.setStatus('EL ESCANEO NO RESPONDIÓ / INTENTA DE NUEVO');
      }
    }

    toggleFavorite(id) {
      this.model.toggleFavorite(id);
      this.view.updateFavoriteButton(this.filters.favoritesOnly, this.model.favoriteCount);
      this.refresh();
    }

    playCry(url) {
      // The model has already restricted this URL to PokéAPI's official audio path.
      const audio = new Audio(url);
      audio.preload = 'none';
      audio.play().catch(() => this.view.setStatus('NO SE PUDO REPRODUCIR EL AUDIO'));
    }

    async loadMatchups(record, token) {
      this.view.setMatchupStatus('DESCARGANDO MATRIZ DE TIPOS…');
      try {
        const chart = await this.model.loadTypeChart();
        if (token !== this.modalToken || !this.view.modalIsOpen()) return;
        this.view.renderMatchups(this.calculateMatchups(record, chart));
      } catch {
        if (token === this.modalToken && this.view.modalIsOpen()) {
          this.view.setMatchupStatus('MATRIZ NO DISPONIBLE / REINTENTA ABRIENDO DE NUEVO LA FICHA');
        }
      }
    }

    calculateMatchups(record, chart) {
      const allTypes = Object.keys(TYPE_NAMES);
      const ownTypes = record.pokemon.types.map(item => item.type.name);
      const multiplierTo = (attackType, defenderType) => {
        const relation = chart[attackType];
        if (relation.noneTo.includes(defenderType)) return 0;
        if (relation.doubleTo.includes(defenderType)) return 2;
        if (relation.halfTo.includes(defenderType)) return 0.5;
        return 1;
      };
      const multiplierFrom = (attackType, defenderTypes) => defenderTypes.reduce((value, defenderType) => {
        if (value === 0) return 0;
        const relation = chart[defenderType];
        if (relation.noneFrom.includes(attackType)) return 0;
        if (relation.doubleFrom.includes(attackType)) return value * 2;
        if (relation.halfFrom.includes(attackType)) return value * 0.5;
        return value;
      }, 1);
      const label = value => ({ 0: '0×', 0.25: '¼×', 0.5: '½×', 1: '1×', 2: '2×', 4: '4×' })[value] || `${value}×`;

      const offense = ownTypes.map(attackType => {
        const groups = new Map();
        for (const defenderType of allTypes) {
          const value = multiplierTo(attackType, defenderType);
          if (value === 1) continue;
          if (!groups.has(value)) groups.set(value, []);
          groups.get(value).push(defenderType);
        }
        return {
          attackType,
          groups: [...groups.entries()].sort((a, b) => b[0] - a[0])
            .map(([value, types]) => ({ multiplier: label(value), value, types }))
        };
      });

      const incomingGroups = new Map();
      for (const attackType of allTypes) {
        const value = multiplierFrom(attackType, ownTypes);
        if (value === 1) continue;
        if (!incomingGroups.has(value)) incomingGroups.set(value, []);
        incomingGroups.get(value).push(attackType);
      }
      const incoming = [...incomingGroups.entries()].sort((a, b) => b[0] - a[0])
        .map(([value, types]) => ({ multiplier: label(value), value, types }));
      return {
        offense,
        incoming,
        ownTypeNames: ownTypes.map(type => TYPE_NAMES[type]),
        note: 'La tabla ATACA muestra ataques del mismo tipo que esta especie frente a rivales monotipo. Contra un rival de dos tipos, sus multiplicadores se combinan. La defensa sí combina los tipos de esta especie. No se evalúan movimientos concretos, habilidades ni diferencias entre juegos.'
      };
    }

    closeModal() {
      if (!this.view.modalIsOpen()) return;
      this.modalToken++;
      this.view.closeModal();
      if (this.previousFocus?.isConnected) this.previousFocus.focus();
    }

    onKeydown(event) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        byId('search').focus();
      }
      if (event.key === 'Escape') this.closeModal();
      if (event.key === 'Tab' && this.view.modalIsOpen()) {
        const controls = this.view.visibleModalControls();
        if (!controls.length) return;
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }
  }

  const controller = new DexController(global.PokedexModel, global.PokedexView);
  controller.start();
})(window);

