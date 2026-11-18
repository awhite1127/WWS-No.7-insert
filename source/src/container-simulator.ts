import type { ContainerDetails, ContainerGroup, ContainerReward } from "./types";

interface Weighted<T> {
  value: T;
  weight: number;
}

export interface SimulatedReward {
  key: string;
  name: string;
  amount: number;
}

function weightTotal<T>(entries: Weighted<T>[]) {
  return entries.reduce((sum, entry) => sum + entry.weight, 0);
}

function draw<T>(entries: Weighted<T>[]): T {
  let ticket = Math.random() * weightTotal(entries);
  for (const entry of entries) {
    ticket -= entry.weight;
    if (ticket < 0) return entry.value;
  }
  return entries[entries.length - 1].value;
}

function groupForSimulation(group: ContainerGroup): Weighted<Weighted<ContainerReward>[]> | null {
  const probabilities = group.rewards.map(reward => reward.probability);
  const allPublished = probabilities.every(value => value !== null);
  const weight = group.probability ?? (allPublished ? probabilities.reduce<number>((sum, value) => sum + (value ?? 0), 0) : null);
  if (weight === null) return null;

  const rewards = group.rewards.map(reward => ({
    value: reward,
    weight: allPublished ? reward.probability ?? 0 : reward.probability === 0 ? 0 : 1,
  })).filter(entry => entry.weight > 0);
  return { value: rewards, weight };
}

function slotForSimulation(groups: ContainerGroup[]) {
  const onlyReward = groups.length === 1 && groups[0].rewards.length === 1 ? groups[0].rewards[0] : null;
  if (onlyReward && groups[0].probability === null && onlyReward.probability === null) {
    return [{ value: [{ value: onlyReward, weight: 1 }], weight: 100 }];
  }
  const weighted = groups.map(groupForSimulation);
  if (weighted.some(group => group === null)) return null;
  const available = weighted.filter((group): group is NonNullable<typeof group> => group !== null && group.weight > 0);
  if (Math.abs(weightTotal(available) - 100) > 1 || available.some(group => !group.value.length)) return null;
  return available;
}

export function createContainerSimulator(details: ContainerDetails) {
  const slots = details.slots.map(slot => slotForSimulation(slot.groups));
  const available = slots.filter((slot): slot is NonNullable<typeof slot> => slot !== null);
  if (!available.length || available.length !== slots.length) return null;

  return (count: number): SimulatedReward[] => {
    const results = new Map<string, SimulatedReward>();
    for (let index = 0; index < count; index++) {
      for (const slot of available) {
        const reward = draw(draw(slot));
        const key = JSON.stringify([reward.type, reward.id, reward.name]);
        const existing = results.get(key);
        if (existing) existing.amount += reward.amount;
        else results.set(key, { key, name: reward.name, amount: reward.amount });
      }
    }
    return [...results.values()];
  };
}
