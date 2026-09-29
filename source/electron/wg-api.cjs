"use strict";

const { shipsFromPort, summarizeSnowflakes } = require("./snowflake.cjs");
const officialChinese = require("../data/wg-zh-sg-glossary.json");

const REALM_HOSTS = {
  asia: "api.worldofwarships.asia",
  eu: "api.worldofwarships.eu",
  na: "api.worldofwarships.com",
};

function percent(wins, battles) {
  return battles > 0 ? (wins / battles) * 100 : 0;
}

function average(total, battles) {
  return battles > 0 ? total / battles : 0;
}

function chunks(items, size) {
  const result = [];
  for (let index = 0; index < items.length; index += size) result.push(items.slice(index, index + size));
  return result;
}

function cacheValue(cache, key, value, ttlMs, limit) {
  const now = Date.now();
  for (const [entryKey, entry] of cache) if (entry.expiresAt <= now) cache.delete(entryKey);
  cache.delete(key);
  cache.set(key, { value, expiresAt: now + ttlMs });
  while (cache.size > limit) cache.delete(cache.keys().next().value);
}

async function concurrentMap(items, limit, mapper) {
  const results = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await mapper(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

class WgApi {
  constructor(getApplicationId) {
    this.getApplicationId = getApplicationId;
    this.cache = new Map();
    this.inFlight = new Map();
    this.shipCache = new Map();
    this.nextRequestAt = 0;
    this.requestQueue = Promise.resolve();
  }

  host(realm) {
    const host = REALM_HOSTS[realm];
    if (!host) throw new Error(`不支持的 WG 区服：${realm}`);
    return host;
  }

  async request(realm, endpoint, params = {}, cacheSeconds = 0) {
    const applicationId = this.getApplicationId();
    if (!applicationId) throw new Error("WG 服务尚未完成配置，请联系管理员");
    const query = new URLSearchParams({ application_id: applicationId, ...params });
    query.sort();
    const url = `https://${this.host(realm)}/wows/${endpoint}/?${query}`;
    const cacheKey = url;
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      this.cache.delete(cacheKey);
      this.cache.set(cacheKey, cached);
      return cached.value;
    }
    this.cache.delete(cacheKey);
    if (this.inFlight.has(cacheKey)) return this.inFlight.get(cacheKey);
    const operation = (async () => {
      // A full roster can trigger dozens of requests at once. Keep this client
      // below WG's usual standalone application limit of 10 requests/second.
      const turn = this.requestQueue.then(async () => {
        const wait = Math.max(0, this.nextRequestAt - Date.now());
        if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
        this.nextRequestAt = Date.now() + 140;
      });
      this.requestQueue = turn.catch(() => {});
      await turn;
      const response = await fetch(url, {
        headers: { "User-Agent": "No7Insert/0.1.5" }, signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) throw new Error(`WG API HTTP ${response.status}`);
      const body = await response.json();
      if (body.status !== "ok") {
        throw new Error(body.error?.message || "WG API 返回错误");
      }
      if (cacheSeconds > 0) {
        cacheValue(this.cache, cacheKey, body, cacheSeconds * 1000, 256);
      }
      return body;
    })();
    this.inFlight.set(cacheKey, operation);
    try { return await operation; }
    finally { this.inFlight.delete(cacheKey); }
  }

  async searchPlayers(query, realm = "asia") {
    const body = await this.request(realm, "account/list", { search: query.trim(), limit: "10" }, 60);
    return body.data ?? [];
  }

  async searchPlayersExact(names, realm = "asia") {
    if (!names.length) return [];
    const body = await this.request(realm, "account/list", {
      search: names.join(","), type: "exact", limit: "100",
    }, 60);
    return body.data ?? [];
  }

  async searchClans(query, realm = "asia") {
    const body = await this.request(realm, "clans/list", { search: query.trim(), limit: "10" }, 90);
    return body.data ?? [];
  }

  async clanDetails(clanId, realm = "asia") {
    const id = String(clanId);
    const body = await this.request(realm, "clans/info", { clan_id: id, extra: "members" }, 300);
    const clan = body.data?.[id];
    if (!clan) throw new Error("军团数据不存在");
    const rawMembers = clan.members ?? {};
    const members = Array.isArray(rawMembers) ? rawMembers : Object.values(rawMembers);
    return {
      clanId: clan.clan_id,
      tag: clan.tag,
      name: clan.name,
      description: clan.description ?? "",
      createdAt: clan.created_at ?? null,
      creatorName: clan.creator_name ?? "",
      leaderName: clan.leader_name ?? "",
      membersCount: clan.members_count ?? members.length,
      members: members
        .map((member) => ({
          accountId: member.account_id,
          accountName: member.account_name,
          joinedAt: member.joined_at ?? null,
          role: member.role ?? "private",
        }))
        .sort((a, b) => a.accountName.localeCompare(b.accountName)),
    };
  }

  async shipMetadata(shipIds, realm) {
    const result = {};
    const missing = [];
    for (const id of [...new Set(shipIds.filter(Boolean).map(String))].sort()) {
      const cached = this.shipCache.get(`${realm}:${id}`);
      if (cached && cached.expiresAt > Date.now()) result[id] = cached.value;
      else missing.push(id);
    }
    for (const group of chunks(missing, 80)) {
      if (group.length === 0) continue;
      const body = await this.request(
        realm,
        "encyclopedia/ships",
        // Keep the original English name alongside the official zh-sg title.
        { ship_id: group.join(","), language: "en", fields: "ship_id,name,tier,type,nation" },
        24 * 3600,
      );
      for (const [id, ship] of Object.entries(body.data ?? {})) {
        if (!ship) continue;
        result[id] = ship;
        cacheValue(this.shipCache, `${realm}:${id}`, ship, 24 * 3600 * 1000, 4096);
      }
    }
    for (const [id, ship] of Object.entries(result)) {
      const localized = officialChinese.ships[id];
      if (localized?.title) {
        result[id] = { ...ship, englishName: ship.name || "", name: localized.title, tier: ship.tier || localized.level };
      }
    }
    return result;
  }

  normalizeRanked(node) {
    const seasons = [];
    for (const [seasonId, ships] of Object.entries(node?.seasons ?? {})) {
      const aggregate = ships?.["0"] ?? Object.values(ships ?? {})[0] ?? {};
      const modes = [aggregate.rank_solo, aggregate.rank_div2, aggregate.rank_div3].filter(Boolean);
      const battles = modes.reduce((sum, mode) => sum + (mode.battles ?? 0), 0);
      const wins = modes.reduce((sum, mode) => sum + (mode.wins ?? 0), 0);
      const damage = modes.reduce((sum, mode) => sum + (mode.damage_dealt ?? 0), 0);
      if (battles > 0) {
        seasons.push({
          seasonId: Number(seasonId),
          battles,
          wins,
          winRate: percent(wins, battles),
          avgDamage: average(damage, battles),
        });
      }
    }
    return seasons.sort((a, b) => b.seasonId - a.seasonId);
  }

  async playerDetails(accountId, realm = "asia", accessToken = "", options = {}) {
    const id = String(accountId);
    const auth = accessToken ? { access_token: accessToken } : {};
    if (options.accountBody && !options.accountBody.data?.[id]) throw new Error("玩家数据不存在");
    const hidden = options.accountBody?.data?.[id]?.hidden_profile;
    const [accountBody, shipsResult, rankedResult, clanAccountResult] = await Promise.all([
      options.accountBody ?? this.request(realm, "account/info", {
        account_id: id,
        ...(!options.rosterMetadata ? { extra: "statistics.pvp_solo,statistics.pvp_div2,statistics.pvp_div3" } : {}),
        ...auth,
      }, 120),
      hidden ? { value: null } : this.request(realm, "ships/stats", {
        account_id: id, ...auth,
        ...(options.rosterMetadata ? { fields: "ship_id,pvp.battles,pvp.wins,pvp.damage_dealt,pvp.xp,pvp.frags" } : {}),
      }, 300).then((value) => ({ value }), (error) => ({ error })),
      options.rosterMetadata ? Promise.resolve({ value: null })
        : this.request(realm, "seasons/accountinfo", { account_id: id, ...auth }, 600).then((value) => ({ value }), (error) => ({ error })),
      options.clanAccountBody ? { value: options.clanAccountBody }
        : this.request(realm, "clans/accountinfo", { account_id: id }, 600).then((value) => ({ value }), (error) => ({ error })),
    ]);
    const account = accountBody.data?.[id];
    if (!account) throw new Error("玩家数据不存在");
    const rawShips = shipsResult.value?.data?.[id] ?? [];
    let metadata = options.rosterMetadata ?? {};
    if (!options.rosterMetadata) {
      try { metadata = await this.shipMetadata(rawShips.map((ship) => ship.ship_id), realm); } catch {}
    }
    const clanAccount = clanAccountResult.value?.data?.[id] ?? null;
    let clan = null;
    if (clanAccount?.clan_id) {
      try {
        const clanBody = options.clanBody ?? await this.request(realm, "clans/info", { clan_id: String(clanAccount.clan_id) }, 900);
        clan = clanBody.data?.[String(clanAccount.clan_id)] ?? clanAccount;
      } catch { clan = null; }
    }
    const pvp = account.statistics?.pvp ?? null;
    return {
      accountId: Number(id),
      nickname: account.nickname,
      realm,
      hiddenProfile: Boolean(account.hidden_profile || !pvp),
      createdAt: account.created_at ?? null,
      lastBattleTime: account.last_battle_time ?? null,
      clan: clan ? { id: clan.clan_id, tag: clan.tag, name: clan.name } : null,
      overall: pvp
        ? {
            battles: pvp.battles ?? 0,
            wins: pvp.wins ?? 0,
            winRate: percent(pvp.wins ?? 0, pvp.battles ?? 0),
            avgDamage: average(pvp.damage_dealt ?? 0, pvp.battles ?? 0),
            avgXp: average(pvp.xp ?? 0, pvp.battles ?? 0),
            avgFrags: average(pvp.frags ?? 0, pvp.battles ?? 0),
            survivalRate: percent(pvp.survived_battles ?? 0, pvp.battles ?? 0),
          }
        : null,
      cumulative: pvp
        ? {
            battles: pvp.battles ?? 0,
            wins: pvp.wins ?? 0,
            damageDealt: pvp.damage_dealt ?? 0,
            xp: pvp.xp ?? 0,
            frags: pvp.frags ?? 0,
            survivedBattles: pvp.survived_battles ?? 0,
          }
        : null,
      ships: rawShips
        .map((ship) => {
          const stats = ship.pvp ?? {};
          const battles = stats.battles ?? 0;
          const meta = metadata[String(ship.ship_id)] ?? {};
          return {
            shipId: ship.ship_id,
            name: officialChinese.ships[String(ship.ship_id)]?.title || meta.name || `#${ship.ship_id}`,
            englishName: meta.englishName || (/[a-z]/i.test(meta.name || "") ? meta.name : ""),
            tier: meta.tier ?? 0,
            type: meta.type ?? "Unknown",
            nation: meta.nation ?? "",
            battles,
            wins: stats.wins ?? 0,
            winRate: percent(stats.wins ?? 0, battles),
            avgDamage: average(stats.damage_dealt ?? 0, battles),
            avgXp: average(stats.xp ?? 0, battles),
            avgFrags: average(stats.frags ?? 0, battles),
          };
        })
        .sort((a, b) => b.battles - a.battles),
      ranked: this.normalizeRanked(rankedResult.value?.data?.[id]),
    };
  }

  async rosterStats(players, realm = "asia", isCurrent = () => true) {
    if (!players.length || !isCurrent()) return [];
    const metadataPromise = this.shipMetadata(players.map((player) => player.shipId), realm).catch(() => ({}));
    const unresolved = [...new Set(players.filter((player) => !Number.isSafeInteger(Number(player.accountId)) || Number(player.accountId) <= 0)
      .map((player) => player.name))];
    let exactMatches = [];
    let lookupError = null;
    try {
      for (const group of chunks(unresolved, 100)) exactMatches.push(...await this.searchPlayersExact(group, realm));
    } catch (error) { lookupError = error; }
    const metadata = await metadataPromise;
    if (!isCurrent()) return [];
    const accountsByName = new Map(exactMatches.map((match) => [match.nickname.toLowerCase(), match.account_id]));
    const accountIds = players.map((player) => Number(player.accountId) > 0 ? Number(player.accountId) : accountsByName.get(player.name.toLowerCase()))
      .filter((id) => Number.isSafeInteger(id) && id > 0);
    // Batch endpoints replace two requests per player and one per clan.
    // On a batch failure, playerDetails retains its individual-request fallback.
    const batch = async (endpoint, field, ids, ttl) => {
      const body = { data: {} };
      const fields = {
        "account/info": "account_id,nickname,hidden_profile,statistics.pvp,created_at,last_battle_time",
        "clans/accountinfo": "account_id,clan_id",
        "clans/info": "clan_id,tag,name",
      }[endpoint];
      try {
        for (const group of chunks([...new Set(ids)].sort((a, b) => a - b), 100)) {
          if (!isCurrent()) return undefined;
          const result = await this.request(realm, endpoint, { [field]: group.join(","), fields }, ttl);
          Object.assign(body.data, result.data ?? {});
        }
        return body;
      } catch { return undefined; }
    };
    const [accountBody, clanAccountBody] = await Promise.all([
      batch("account/info", "account_id", accountIds, 120),
      batch("clans/accountinfo", "account_id", accountIds, 600),
    ]);
    if (!isCurrent()) return [];
    const clanIds = Object.values(clanAccountBody?.data ?? {}).map((entry) => entry?.clan_id).filter(Boolean);
    const clanBody = clanAccountBody ? await batch("clans/info", "clan_id", clanIds, 900) : undefined;
    if (!isCurrent()) return [];
    const resolved = await concurrentMap(players, 4, async (player) => {
      if (!isCurrent()) return null;
      const ship = metadata[String(player.shipId)] ?? {};
      const withShip = {
        ...player,
        shipName: officialChinese.ships[String(player.shipId)]?.title || ship.name || player.shipName,
        shipType: ship.type || player.shipType || "",
        shipTier: ship.tier || player.shipTier || 0,
      };
      try {
        let accountId = Number(player.accountId);
        if (!Number.isSafeInteger(accountId) || accountId <= 0) {
          if (lookupError) throw lookupError;
          accountId = accountsByName.get(player.name.toLowerCase());
          if (!accountId) return { ...withShip, status: "not-found", error: "WG 未找到该昵称对应的账号" };
        }
        const details = await this.playerDetails(accountId, realm, "", { rosterMetadata: metadata, accountBody, clanAccountBody, clanBody });
        const shipName = String(withShip.shipName || "").trim().toLocaleLowerCase();
        const currentShip = details.ships.find((ship) => Number(ship.shipId) === Number(player.shipId))
          || (shipName ? details.ships.find((ship) => String(ship.name || "").trim().toLocaleLowerCase() === shipName) : null)
          || null;
        return {
          ...withShip,
          status: details.hiddenProfile ? "hidden" : "ok",
          accountId: details.accountId,
          clan: details.clan,
          overall: details.overall,
          currentShip: currentShip ? {
            ...currentShip,
            name: officialChinese.ships[String(currentShip.shipId)]?.title || currentShip.name,
          } : null,
        };
      } catch (error) {
        return { ...withShip, status: "error", error: error instanceof Error ? error.message : String(error) };
      }
    });
    return resolved.filter(Boolean);
  }

  async portShipIds(accountId, accessToken, realm = "asia") {
    const id = String(accountId);
    const accountBody = await this.request(realm, "account/info", {
      account_id: id,
      access_token: accessToken,
      extra: "private.port",
    });
    let ships = shipsFromPort(accountBody.data?.[id]?.private?.port);

    // A small number of legacy accounts/realms may temporarily omit private.port.
    // Keep the authenticated in-port stats query as a compatibility fallback.
    if (ships.length === 0) {
      const shipsBody = await this.request(realm, "ships/stats", {
        account_id: id,
        access_token: accessToken,
        in_garage: "1",
        fields: "ship_id",
      });
      ships = shipsFromPort(shipsBody.data?.[id] ?? []);
    }
    return [...new Set(ships.map((ship) => Number(ship.ship_id)).filter(Number.isFinite))];
  }

  async snowflakeSummary(accountId, nickname, accessToken, realm = "asia") {
    const ships = await this.portShipIds(accountId, accessToken, realm);
    const metadata = await this.shipMetadata(ships, realm);
    return summarizeSnowflakes(ships.map((ship_id) => ({ ship_id })), metadata, { accountId, nickname, realm });
  }
}

module.exports = { WgApi, REALM_HOSTS, average, percent };
