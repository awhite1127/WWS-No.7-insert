export type Location = { cell?: string; x?: number; y?: number };
export type Point = Location & { label: string; kind?: string; towards?: { x: number; y: number } };
export type OverviewGroup = { number: string; title: string; stages: string[]; note: string };
export type Operation = {
  id: string; name: string; englishName: string; image: string; bounds: number[];
  legacy: boolean; source: string; sourceUpdated: string; routeSource?: string; routeNotice?: string;
  routes: { id: string; label: string; exitCell?: string; image?: string; baseMarkers?: {x:number;y:number;width:number;height:number}[] }[];
  terrainSource?: string;
  overview: { routeSelection: boolean; groups: OverviewGroup[] };
  pointSets: { title: string; description: string; stage: string; route: string; points: Point[] }[];
};
export type OverviewEntry = Point & { number: string; groupIndex: number };
export type OverviewMarker = Point & { numbers: string[]; groupIndices: number[]; entries: OverviewEntry[] };

export function buildOverview(operation: Operation, route: string) {
  const sets = operation.pointSets.filter(set => !operation.overview.routeSelection || set.route === '*' || set.route === route);
  const groups = operation.overview.groups.map((group, groupIndex) => {
    const entries: OverviewEntry[] = [];
    for (const set of sets.filter(s => group.stages.includes(s.stage))) for (const point of set.points.filter(p => p.kind !== 'movement')) {
      // Repeated wave candidates share one explanation and one marker, not fictitious new locations.
      if (!entries.some(p => p.label === point.label && p.cell === point.cell && p.x === point.x && p.y === point.y && p.kind === point.kind)) {
        entries.push({ ...point, number: group.number, groupIndex });
      }
    }
    return { ...group, entries };
  });
  const markers: OverviewMarker[] = [];
  const coordinates = (p: Point) => p.cell ? {x:(Number(p.cell.slice(1))-.5)*10,y:(p.cell.charCodeAt(0)-64.5)*10} : {x:p.x ?? 0,y:p.y ?? 0};
  for (const group of groups) for (const entry of group.entries) {
    const marker = markers.find(p => p.kind === entry.kind && (Math.hypot(coordinates(p).x-coordinates(entry).x,coordinates(p).y-coordinates(entry).y)<=2 || (entry.cell
      ? p.cell === entry.cell
      : !p.cell && Math.hypot((p.x ?? 0) - (entry.x ?? 0), (p.y ?? 0) - (entry.y ?? 0)) <= 4)));
    if (marker) {
      if (!marker.numbers.includes(entry.number)) marker.numbers.push(entry.number);
      if (!marker.groupIndices.includes(entry.groupIndex)) marker.groupIndices.push(entry.groupIndex);
      marker.entries.push(entry);
    } else markers.push({ ...entry, numbers: [entry.number], groupIndices: [entry.groupIndex], entries: [entry] });
  }
  return { groups, markers };
}
