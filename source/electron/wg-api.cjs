"use strict";

const { shipsFromPort, summarizeSnowflakes } = require("./snowflake.cjs");

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
    const url = `https://${this.host(realm)}/wows/${endpoint}/?${query}`;
    const cacheKey = url.replace(applicationId, "<app>");
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.value;
    const response = await fetch(url, { headers: { "User-Agent": "No7Insert/0.1.1" } });
    if (!response.ok) throw new Error(`WG API HTTP ${response.status}`);
    const body = await response.json();
    if (body.status !== "ok") {
      throw new Error(body.error?.message || "WG API 返回错误");
    }
    if (cacheSeconds > 0) {
      this.cache.set(cacheKey, { value: body, expiresAt: Date.now() + cacheSeconds * 1000 });
    }
    return body;
  }

  async searchPlayers(query, realm = "asia") {
    const body = await this.request(realm, "account/list", { search: query.trim(), limit: "10" }, 60);
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
    for (const group of chunks([...new Set(shipIds)].filter(Boolean), 80)) {
      if (group.length === 0) continue;
      const body = await this.request(
        realm,
        "encyclopedia/ships",
        // zh-cn follows the mainland/360 localization and rewrites a number of
        // Japanese ship names. zh-tw is WG Asia's official, unfiltered catalog.
        { ship_id: group.join(","), language: "zh-tw", fields: "ship_id,name,tier,type,nation" },
        24 * 3600,
      );
      Object.assign(result, body.data ?? {});
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

  async playerDetails(accountId, realm = "asia", accessToken = "") {
    const id = String(accountId);
    const auth = accessToken ? { access_token: accessToken } : {};
    const [accountBody, shipsBody, rankedBody, clanAccountBody] = await Promise.all([
      this.request(realm, "account/info", {
        account_id: id,
        extra: "statistics.pvp_solo,statistics.pvp_div2,statistics.pvp_div3",
        ...auth,
      }, 120),
      this.request(realm, "ships/stats", { account_id: id, ...auth }, 300),
      this.request(realm, "seasons/accountinfo", { account_id: id, ...auth }, 600),
      this.request(realm, "clans/accountinfo", { account_id: id }, 600),
    ]);
    const account = accountBody.data?.[id];
    if (!account) throw new Error("玩家数据不存在");
    const rawShips = shipsBody.data?.[id] ?? [];
    const metadata = await this.shipMetadata(rawShips.map((ship) => ship.ship_id), realm);
    const clanAccount = clanAccountBody.data?.[id] ?? null;
    let clan = null;
    if (clanAccount?.clan_id) {
      const clanBody = await this.request(realm, "clans/info", { clan_id: String(clanAccount.clan_id) }, 900);
      clan = clanBody.data?.[String(clanAccount.clan_id)] ?? clanAccount;
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
            name: meta.name || `#${ship.ship_id}`,
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
      ranked: this.normalizeRanked(rankedBody.data?.[id]),
    };
  }

  async rosterStats(players, realm = "asia") {
    let metadata = {};
    try {
      metadata = await this.shipMetadata(players.map((player) => player.shipId), realm);
    } catch {
      // Player stats can still load if the ship catalog is temporarily unavailable.
    }
    const resolved = await concurrentMap(players, 4, async (player) => {
      const ship = metadata[String(player.shipId)] ?? {};
      const withShip = {
        ...player,
        shipName: ship.name || player.shipName,
        shipType: ship.type || player.shipType || "",
        shipTier: ship.tier || player.shipTier || 0,
      };
      try {
        let accountId = Number(player.accountId);
        if (!Number.isSafeInteger(accountId) || accountId <= 0) {
          const matches = await this.searchPlayers(player.name, realm);
          const exact = matches.find((match) => match.nickname.toLowerCase() === player.name.toLowerCase());
          if (!exact) return { ...withShip, status: "not-found" };
          accountId = exact.account_id;
        }
        const details = await this.playerDetails(accountId, realm);
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
          currentShip,
        };
      } catch (error) {
        return { ...withShip, status: "error", error: error.message };
      }
    });
    return resolved;
  }

  async snowflakeSummary(accountId, nickname, accessToken, realm = "asia") {
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
    const metadata = await this.shipMetadata(ships.map((ship) => ship.ship_id), realm);
    return summarizeSnowflakes(ships, metadata, { accountId, nickname, realm });
  }
}

module.exports = { WgApi, REALM_HOSTS, average, percent };
