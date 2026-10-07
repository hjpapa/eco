export interface MapView { x: number; y: number; scale: number }
export interface Point { x: number; y: number }
export const INITIAL_MAP_VIEW: MapView = { x: 0, y: 0, scale: 1 };
export const MIN_MAP_SCALE = 0.6;
export const MAX_MAP_SCALE = 2.5;

/** Full-size labels and 80px plots remain readable even on a narrow phone. */
export function readableMapSize(cells: number): number { return cells * 88 + 12; }
export function fitReadableMap(view: MapView, width: number, height: number, contentSize?: number): MapView {
  const next = contentSize && view.scale < 1 ? zoomMap(view, 1) : view;
  return constrainMap(next, Math.max(width, contentSize ?? 0), Math.max(height, contentSize ?? 0));
}

export function zoomMap(view: MapView, scale: number, anchor: Point = { x: 0, y: 0 }): MapView {
  const next = Math.max(MIN_MAP_SCALE, Math.min(MAX_MAP_SCALE, scale));
  const ratio = next / view.scale;
  return { scale: next, x: anchor.x - (anchor.x - view.x) * ratio, y: anchor.y - (anchor.y - view.y) * ratio };
}
export function constrainMap(view: MapView, width: number, height: number): MapView {
  const x = width * view.scale / 2;
  const y = height * view.scale / 2;
  return { ...view, x: Math.max(-x, Math.min(x, view.x)), y: Math.max(-y, Math.min(y, view.y)) };
}

/** Shared pointer state for both map renderers. A pinch stays a gesture after one finger lifts. */
export class MapGesture {
  points = new Map<number, Point>();
  origins = new Map<number, Point>();
  moved = false;
  down(id: number, point: Point) {
    if (!this.points.size) this.moved = false;
    this.points.set(id, point);
    this.origins.set(id, point);
    if (this.points.size > 1) this.moved = true;
  }
  move(id: number, point: Point, view: MapView, pan = true): MapView {
    const previous = this.points.get(id);
    if (!previous) return view;
    const origin = this.origins.get(id)!;
    if (Math.hypot(point.x - origin.x, point.y - origin.y) > 8) this.moved = true;
    const before = [...this.points.values()];
    this.points.set(id, point);
    if (!this.moved) return view;
    if (before.length === 1) return pan ? { ...view, x: view.x + point.x - previous.x, y: view.y + point.y - previous.y } : view;
    const after = [...this.points.values()];
    const midpoint = (p: Point[]) => ({ x: (p[0].x + p[1].x) / 2, y: (p[0].y + p[1].y) / 2 });
    const distance = (p: Point[]) => Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
    const a = midpoint(before), b = midpoint(after);
    const zoomed = zoomMap(view, view.scale * distance(after) / Math.max(1, distance(before)), a);
    return { ...zoomed, x: zoomed.x + b.x - a.x, y: zoomed.y + b.y - a.y };
  }
  up(id: number) { this.points.delete(id); this.origins.delete(id); }
  cancel() { this.points.clear(); this.origins.clear(); this.moved = true; }
}
