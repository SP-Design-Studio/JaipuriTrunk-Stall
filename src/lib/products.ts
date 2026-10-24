/**
 * What the stall stocks, and the sticker photograph of each.
 *
 * A trimmed copy of the catalogue in the JaipuriTrunk website — names, ids and
 * pictures only, no marketing copy. It is a copy rather than an import because
 * this is a separate app that deploys on its own; keep the two in step by hand
 * when the range changes.
 */
export type Item = {
  id: string;
  name: string;
  /** Path under /public. Items without a photograph show a text tile. */
  src?: string;
};

export type Category = { id: string; title: string; items: Item[] };

export const categories: Category[] = [
  {
    id: "juttis",
    title: "Jaipuri juttis",
    items: [
      {
        id: "leather-juttis",
        name: "Leather juttis",
        src: "/images/products/leather-juttis.webp",
      },
      {
        id: "embroidered-juttis",
        name: "Embroidered juttis",
        src: "/images/products/embroidered-juttis.webp",
      },
      { id: "khussa-shoes", name: "Khussa shoes" },
    ],
  },
  {
    id: "jewellery",
    title: "Statement oxidised jewellery",
    items: [
      { id: "jhumkas", name: "Jhumkas", src: "/images/products/jhumkas.webp" },
      {
        id: "enamel-oxidised-earrings",
        name: "Enamel oxidised earrings",
        src: "/images/products/enamel-oxidised-earrings.webp",
      },
      { id: "khadas", name: "Khadas", src: "/images/products/khadas.webp" },
      {
        id: "kundan-chandbalis",
        name: "Oxidised Kundan chandbalis",
        src: "/images/products/chandbalis.webp",
      },
      {
        id: "drop-motif-earrings",
        name: "Drop motif earrings",
        src: "/images/products/drop-motif-earrings.webp",
      },
    ],
  },
  {
    id: "bags",
    title: "Quilted Jaipur bags",
    items: [
      {
        id: "quilted-handbags",
        name: "Quilted handbags",
        src: "/images/products/quilted-handbags.webp",
      },
      {
        id: "quilted-pouches",
        name: "Quilted pouches",
        src: "/images/products/quilted-pouches.webp",
      },
      { id: "sling-bags", name: "Sling bags" },
    ],
  },
];
