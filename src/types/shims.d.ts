// Ambient modules for approved packages without shipping @types (keep deps list tight).

declare module "leaflet" {
  const L: any;
  export = L;
  export as namespace L;
}

declare module "leaflet/dist/leaflet.css";

declare module "web-push" {
  const webpush: any;
  export default webpush;
}
