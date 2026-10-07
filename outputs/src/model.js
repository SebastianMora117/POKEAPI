/* Model: owns PokéAPI access, normalized records, cache, and favorites. */
(function (global) {
  'use strict';

  const API_ROOT = 'https://pokeapi.co/api/v2/';
  const API_ORIGIN = 'https://pokeapi.co';
  const CACHE_PREFIX = 'dex:v2:';
  const CACHE_TTL = 24 * 60 * 60 * 1000;
  const CACHE_BUDGET = 1_800_000;
  const TYPE_KEYS = new Set([
    'normal', 'fire', 'water', 'electric', 'grass', 'ice', 'fighting', 'poison',
    'ground', 'flying', 'psychic', 'bug', 'rock', 'ghost', 'dragon', 'dark',
    'steel', 'fairy'
  ]);
  const STAT_KEYS = new Set(['hp', 'attack', 'defense', 'special-attack', 'special-defense', 'speed']);
  const NAME_PATTERN = /^[a-z0-9-]{1,80}$/;

  function readJSON(key, fallback) {
    try {
      const stored = global.localStorage.getItem(key);
      if (!stored || stored.length > 200_000) return fallback;
      return JSON.parse(stored) ?? fallback;
    }
    catch { return fallback; }
  }

  function parseId(url) {
    try {
      const parsed = new URL(url);
      if (parsed.origin !== API_ORIGIN || !/^\/api\/v2\/pokemon-species\/\d+\/$/.test(parsed.pathname)) return 0;
      const id = Number(parsed.pathname.match(/\/(\d+)\/$/)[1]);
      return Number.isSafeInteger(id) && id > 0 && id <= 2000 ? id : 0;
    } catch { return 0; }
  }

  class DexModel {
    constructor() {
      this.species = [];
      this.memory = new Map();
      this.pending = new Map();
      this.typeChart = null;
      const savedFavorites = readJSON('dex:favorites:v2', []);
      this.favoriteIds = new Set(
        (Array.isArray(savedFavorites) ? savedFavorites : [])
          .filter(id => Number.isSafeInteger(id) && id > 0 && id <= 2000)
      );
    }

    remember(url, data) {
      if (!this.memory.has(url) && this.memory.size >= 100) {
        const oldest = this.memory.keys().next().value;
        this.memory.delete(oldest);
      }
      this.memory.set(url, data);
    }

    async request(relativePath) {
      const url = new URL(relativePath, API_ROOT);
      if (url.origin !== API_ORIGIN || !url.pathname.startsWith('/api/v2/') || url.username || url.password) {
        throw new Error('Se rechazó una dirección de datos no permitida.');
      }
      if (this.memory.has(url.href)) return this.memory.get(url.href);
      if (this.pending.has(url.href)) return this.pending.get(url.href);

      const pending = this.fetchJSON(url.href).finally(() => this.pending.delete(url.href));
      this.pending.set(url.href, pending);
      return pending;
    }

    async fetchJSON(url) {
      const cacheKey = CACHE_PREFIX + url;
      const cached = readJSON(cacheKey, null);
      if (cached && cached.expires > Date.now() && Object.hasOwn(cached, 'data')) {
        this.remember(url, cached.data);
        return cached.data;
      }

      const abort = new AbortController();
      const timeout = global.setTimeout(() => abort.abort(), 15000);
      try {
        const response = await global.fetch(url, {
          method: 'GET',
          mode: 'cors',
          credentials: 'omit',
          redirect: 'error',
          referrerPolicy: 'no-referrer',
          headers: { Accept: 'application/json' },
          signal: abort.signal
        });
        if (!response.ok) throw new Error(`PokéAPI respondió ${response.status}.`);
        if (!/^application\/json\b/i.test(response.headers.get('content-type') || '')) {
          throw new Error('PokéAPI devolvió un formato inesperado.');
        }
        const contentLength = Number(response.headers.get('content-length'));
        if (Number.isFinite(contentLength) && contentLength > 1_500_000) {
          throw new Error('La respuesta de datos excede el tamaño esperado.');
        }
        const body = await response.text();
        if (body.length > 1_500_000) throw new Error('La respuesta de datos excede el tamaño esperado.');
        let data;
        try { data = JSON.parse(body); } catch { throw new Error('No se pudieron leer los datos de PokéAPI.'); }
        this.remember(url, data);
        this.saveCache(cacheKey, url, data);
        return data;
      } finally {
        global.clearTimeout(timeout);
      }
    }

    saveCache(key, url, data) {
      const entry = JSON.stringify({ expires: Date.now() + CACHE_TTL, data });
      if (entry.length > 180_000) return;
      try {
        global.localStorage.setItem(key, entry);
        const keys = [];
        let bytes = 0;
        for (let index = 0; index < global.localStorage.length; index++) {
          const candidate = global.localStorage.key(index);
          if (candidate && candidate.startsWith(CACHE_PREFIX)) {
            const value = global.localStorage.getItem(candidate) || '';
            keys.push({ key: candidate, size: value.length });
            bytes += value.length;
          }
        }
        while ((bytes > CACHE_BUDGET || keys.length > 80) && keys.length > 1) {
          const oldest = keys.shift();
          if (oldest.key !== key) {
            global.localStorage.removeItem(oldest.key);
            bytes -= oldest.size;
          }
        }
      } catch { /* Private mode or quota limits: in-memory caching still works. */ }
    }

    async loadSpecies() {
      const data = await this.request('pokemon-species?limit=2000');
      if (!Array.isArray(data.results) || data.results.length > 2000) throw new Error('El índice de especies no tiene el formato esperado.');
      this.species = data.results.map(row => ({ id: parseId(row?.url), name: row?.name }))
        .filter(row => row.id && typeof row.name === 'string' && NAME_PATTERN.test(row.name))
        .sort((a, b) => a.id - b.id);
      return this.species;
    }

    async loadTypeMembers(type) {
      if (!TYPE_KEYS.has(type)) throw new Error('El tipo solicitado no está permitido.');
      const data = await this.request(`type/${type}`);
      if (!Array.isArray(data.pokemon) || data.pokemon.length > 5000) throw new Error('La respuesta de tipos no es válida.');
      return new Set(data.pokemon
        .map(item => item?.pokemon?.name)
        .filter(name => typeof name === 'string' && NAME_PATTERN.test(name)));
    }

    async loadTypeChart() {
      if (this.typeChart) return this.typeChart;
      const names = [...TYPE_KEYS];
      const chart = Object.create(null);
      let cursor = 0;
      const workers = Array.from({ length: 6 }, async () => {
        while (cursor < names.length) {
          const typeName = names[cursor++];
          const data = await this.request(`type/${typeName}`);
          const relations = data?.damage_relations;
          if (data?.name !== typeName || !relations) throw new Error('La matriz de tipos recibida no es válida.');
          const readRelation = key => {
            const items = relations[key];
            if (!Array.isArray(items) || items.length > TYPE_KEYS.size) throw new Error('La matriz de tipos está incompleta.');
            const result = items.map(item => item?.name);
            if (result.some(name => !TYPE_KEYS.has(name))) throw new Error('La matriz contiene un tipo no reconocido.');
            return result;
          };
          chart[typeName] = {
            doubleTo: readRelation('double_damage_to'),
            halfTo: readRelation('half_damage_to'),
            noneTo: readRelation('no_damage_to'),
            doubleFrom: readRelation('double_damage_from'),
            halfFrom: readRelation('half_damage_from'),
            noneFrom: readRelation('no_damage_from')
          };
        }
      });
      await Promise.all(workers);
      this.typeChart = chart;
      return chart;
    }

    async loadRecord(species) {
      if (!species || !Number.isSafeInteger(species.id) || !NAME_PATTERN.test(species.name)) {
        throw new Error('El registro Pokémon no es válido.');
      }
      const [speciesData, pokemon] = await Promise.all([
        this.request(`pokemon-species/${species.id}`),
        this.request(`pokemon/${species.name}`)
      ]);
      if (pokemon.id !== species.id || !Array.isArray(pokemon.types) || pokemon.types.length > 2
        || !pokemon.types.length || !Array.isArray(pokemon.stats) || pokemon.stats.length > 10
        || !Array.isArray(pokemon.abilities) || !Number.isSafeInteger(pokemon.height)
        || !Number.isSafeInteger(pokemon.weight) || !speciesData || speciesData.id !== species.id) {
        throw new Error('PokéAPI devolvió un registro inesperado.');
      }
      const safeTypes = pokemon.types.map(row => row?.type?.name);
      if (safeTypes.some(type => !TYPE_KEYS.has(type))) throw new Error('PokéAPI devolvió un tipo inesperado.');
      const safeStats = pokemon.stats.map(row => ({
        base_stat: Number.isSafeInteger(row?.base_stat) ? Math.max(0, Math.min(255, row.base_stat)) : -1,
        stat: { name: row?.stat?.name }
      }));
      if (safeStats.some(row => row.base_stat < 0 || !STAT_KEYS.has(row.stat.name))) {
        throw new Error('PokéAPI devolvió estadísticas inesperadas.');
      }
      const safeAbilities = pokemon.abilities.slice(0, 8).map(row => ({
        ability: { name: this.cleanText(row?.ability?.name).replace(/[^a-z0-9-]/gi, '').slice(0, 60) },
        is_hidden: row?.is_hidden === true
      })).filter(row => row.ability.name);
      const safeSpecies = {
        id: species.id,
        names: Array.isArray(speciesData.names) ? speciesData.names.slice(0, 40).filter(row => ['es', 'en'].includes(row?.language?.name))
          .map(row => ({ language: { name: row.language.name }, name: this.cleanText(row.name) })) : [],
        genera: Array.isArray(speciesData.genera) ? speciesData.genera.slice(0, 40).filter(row => ['es', 'en'].includes(row?.language?.name))
          .map(row => ({ language: { name: row.language.name }, genus: this.cleanText(row.genus) })) : [],
        flavor_text_entries: Array.isArray(speciesData.flavor_text_entries) ? speciesData.flavor_text_entries.slice(0, 100)
          .filter(row => ['es', 'en'].includes(row?.language?.name))
          .map(row => ({ language: { name: row.language.name }, flavor_text: this.cleanText(row.flavor_text) })) : []
      };
      const safePokemon = {
        id: pokemon.id,
        name: species.name,
        height: Math.min(10000, Math.max(0, pokemon.height)),
        weight: Math.min(100000, Math.max(0, pokemon.weight)),
        base_experience: Number.isSafeInteger(pokemon.base_experience) ? Math.max(0, pokemon.base_experience) : null,
        types: safeTypes.map(name => ({ type: { name } })),
        stats: safeStats.map(row => ({ base_stat: row.base_stat, stat: { name: row.stat.name } })),
        abilities: safeAbilities,
      };
      const localized = Array.isArray(speciesData.names)
        ? speciesData.names.find(row => row?.language?.name === 'es')?.name
        : '';
      const artwork = pokemon.sprites?.other?.['official-artwork']?.front_default;
      const fallbackSprite = pokemon.sprites?.front_default;
      const image = this.safeImage(artwork) || this.safeImage(fallbackSprite);
      const cry = this.safeCry(pokemon.cries?.latest);
      return { id: species.id, name: species.name, localized: this.cleanText(localized) || this.titleCase(species.name), pokemon: safePokemon, speciesData: safeSpecies, image, cry };
    }

    safeImage(value) {
      if (typeof value !== 'string') return '';
      try {
        const url = new URL(value);
        if (url.protocol !== 'https:' || url.hostname !== 'raw.githubusercontent.com' || url.port || url.username || url.password || url.search || url.hash) return '';
        if (!/^\/PokeAPI\/sprites\/master\/sprites\/pokemon\/(?:other\/official-artwork\/)?(?:shiny\/)?\d+\.(?:png|svg)$/.test(url.pathname)) return '';
        return url.href;
      } catch { return ''; }
    }

    safeCry(value) {
      if (typeof value !== 'string') return '';
      try {
        const url = new URL(value);
        if (url.protocol !== 'https:' || url.hostname !== 'raw.githubusercontent.com' || url.port || url.username || url.password || url.search || url.hash) return '';
        if (!/^\/PokeAPI\/cries\/main\/cries\/pokemon\/(?:latest|legacy)\/\d+\.ogg$/.test(url.pathname)) return '';
        return url.href;
      } catch { return ''; }
    }

    cleanText(value) {
      if (typeof value !== 'string') return '';
      return value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 500);
    }

    titleCase(value) {
      return value.replaceAll('-', ' ').replace(/\b\w/g, char => char.toUpperCase());
    }

    hasFavorite(id) { return this.favoriteIds.has(id); }
    get favorites() { return new Set(this.favoriteIds); }

    toggleFavorite(id) {
      if (!Number.isSafeInteger(id) || id < 1 || id > 2000) return false;
      if (this.favoriteIds.has(id)) this.favoriteIds.delete(id);
      else this.favoriteIds.add(id);
      try { global.localStorage.setItem('dex:favorites:v2', JSON.stringify([...this.favoriteIds])); } catch {}
      return this.favoriteIds.has(id);
    }

    get favoriteCount() { return this.favoriteIds.size; }
  }

  global.PokedexModel = new DexModel();
})(window);

