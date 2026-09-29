import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import TableRenderers from "react-pivottable/TableRenderers";
import { tableHeatmapColorScale } from "./tableHeatmap";

const parseRgb = (value) => {
  const match = value?.match(/rgb\(\s*255\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/i);
  if (!match) return null;
  return Number(match[1]);
};

const extractPvtValStyles = (html) => {
  const matches = [...html.matchAll(/class="pvtVal"[^>]*style="([^"]*)"/g)];
  return matches.map((m) => m[1]);
};

const contrastRatio = (hexText, rgbBg) => {
  const toLinear = (v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const toLuminance = (r, g, b) => 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
  const text = {
    r: Number.parseInt(hexText.slice(1, 3), 16),
    g: Number.parseInt(hexText.slice(3, 5), 16),
    b: Number.parseInt(hexText.slice(5, 7), 16),
  };
  const [r, g, b] = rgbBg;
  const l1 = toLuminance(text.r, text.g, text.b);
  const l2 = toLuminance(r, g, b);
  const [lighter, darker] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (lighter + 0.05) / (darker + 0.05);
};

describe("tableHeatmapColorScale", () => {
  test("aplica escala para [0,10,20] sin NaN", () => {
    const scale = tableHeatmapColorScale([0, 10, 20]);
    expect(scale(0)).toEqual({ backgroundColor: "rgb(255, 255, 255)" });
    expect(scale(10)).toEqual({ backgroundColor: "rgb(255, 127, 127)" });
    expect(scale(20)).toEqual({ backgroundColor: "rgb(255, 0, 0)" });
  });

  test("todos iguales y un solo valor usan intensidad 0.5", () => {
    const same = tableHeatmapColorScale([5, 5]);
    const single = tableHeatmapColorScale([7]);
    expect(same(5)).toEqual({ backgroundColor: "rgb(255, 127, 127)" });
    expect(single(7)).toEqual({ backgroundColor: "rgb(255, 127, 127)" });
  });

  test("soporta negativos y centro en rosado medio", () => {
    const scale = tableHeatmapColorScale([-10, 0, 10]);
    expect(scale(-10)).toEqual({ backgroundColor: "rgb(255, 255, 255)" });
    expect(scale(0)).toEqual({ backgroundColor: "rgb(255, 127, 127)" });
    expect(scale(10)).toEqual({ backgroundColor: "rgb(255, 0, 0)" });
  });

  test("ignora null/NaN/Infinity y evita NaN en CSS", () => {
    const scale = tableHeatmapColorScale([null, NaN, Infinity, -Infinity, 0, 20]);
    expect(scale(NaN)).toEqual({});
    expect(scale(Infinity)).toEqual({});
    expect(scale(null)).toEqual({});
    const css = scale(10).backgroundColor;
    expect(css).toBe("rgb(255, 127, 127)");
    expect(css.includes("NaN")).toBe(false);
  });

  test("lista vacía retorna función neutra", () => {
    const scale = tableHeatmapColorScale([]);
    expect(scale(1)).toEqual({});
  });

  test("contraste mínimo 4.5 con fondo rojo y texto #111111", () => {
    const ratio = contrastRatio("#111111", [255, 0, 0]);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });
});

describe("react-pivottable heatmap renderers", () => {
  const makeData = () => {
    const rows = [];
    const pushMany = (row, col, n) => {
      for (let i = 0; i < n; i += 1) rows.push({ row, col });
    };
    pushMany("r1", "c1", 1);
    pushMany("r1", "c2", 2);
    pushMany("r1", "c3", 3);
    pushMany("r2", "c1", 10);
    pushMany("r2", "c2", 20);
    pushMany("r2", "c3", 30);
    return rows;
  };

  const renderTable = (rendererName) => renderToStaticMarkup(
    React.createElement(TableRenderers[rendererName], {
      data: makeData(),
      rows: ["row"],
      cols: ["col"],
      aggregatorName: "Count",
      vals: [],
      tableColorScaleGenerator: tableHeatmapColorScale,
    })
  );

  test("Table no deja backgrounds inline residuales en pvtVal", () => {
    const html = renderTable("Table");
    const styles = extractPvtValStyles(html);
    expect(styles.every((s) => !s.includes("background-color"))).toBe(true);
  });

  test("Table Row Heatmap normaliza por fila (patrón se repite por cada fila)", () => {
    const html = renderTable("Table Row Heatmap");
    const styles = extractPvtValStyles(html).slice(0, 6);
    const channels = styles.map((s) => parseRgb(s));
    expect(channels).toEqual([255, 127, 0, 255, 127, 0]);
  });

  test("Table Col Heatmap normaliza por columna (fila1 clara, fila2 roja)", () => {
    const html = renderTable("Table Col Heatmap");
    const styles = extractPvtValStyles(html).slice(0, 6);
    const channels = styles.map((s) => parseRgb(s));
    expect(channels).toEqual([255, 255, 255, 0, 0, 0]);
  });

  test("Table Heatmap global difiere de patrones row/col", () => {
    const html = renderTable("Table Heatmap");
    const styles = extractPvtValStyles(html).slice(0, 6);
    const channels = styles.map((s) => parseRgb(s));
    expect(channels).not.toEqual([255, 127, 0, 255, 127, 0]);
    expect(channels).not.toEqual([255, 255, 255, 0, 0, 0]);
  });
});
