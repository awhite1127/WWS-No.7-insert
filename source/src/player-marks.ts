import { ref } from "vue";

export type PlayerMarkKind = "favorite" | "monkey";

interface PlayerMark {
  realm: string;
  accountId: number | null;
  nickname: string;
  favorite: boolean;
  monkey: boolean;
}

const STORAGE_KEY = "wwsmonkey.playerMarks.v1";

function readMarks(): PlayerMark[] {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    if (!Array.isArray(saved)) return [];
    return saved.filter((item) => item && typeof item.realm === "string" && typeof item.nickname === "string")
      .map((item) => ({
        realm: item.realm.toLowerCase(),
        accountId: Number.isSafeInteger(item.accountId) && item.accountId > 0 ? item.accountId : null,
        nickname: item.nickname,
        favorite: item.favorite === true,
        monkey: item.monkey === true,
      }))
      .filter((item) => item.favorite || item.monkey);
  } catch {
    return [];
  }
}

const marks = ref<PlayerMark[]>(readMarks());

function matches(mark: PlayerMark, realm: string, accountId: number | null | undefined, nickname: string) {
  if (mark.realm !== realm.toLowerCase()) return false;
  if (accountId && mark.accountId === accountId) return true;
  return Boolean(nickname) && mark.nickname.toLowerCase() === nickname.toLowerCase();
}

export function playerMark(realm: string, accountId: number | null | undefined, nickname: string) {
  return marks.value.find((item) => matches(item, realm, accountId, nickname)) ?? { favorite: false, monkey: false };
}

export function togglePlayerMark(realm: string, accountId: number | null | undefined, nickname: string, kind: PlayerMarkKind) {
  const existing = marks.value.find((item) => matches(item, realm, accountId, nickname));
  const next: PlayerMark = {
    realm: realm.toLowerCase(),
    accountId: accountId || existing?.accountId || null,
    nickname: nickname || existing?.nickname || "",
    favorite: existing?.favorite ?? false,
    monkey: existing?.monkey ?? false,
  };
  next[kind] = !next[kind];
  marks.value = marks.value.filter((item) => item !== existing);
  if (next.favorite || next.monkey) marks.value = [...marks.value, next];
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(marks.value)); } catch {}
}

window.addEventListener("storage", (event) => {
  if (event.key === STORAGE_KEY) marks.value = readMarks();
});
